/**
 * helpers/dosenReminderHelper.js
 * Dua notifikasi otomatis khusus dosen:
 *   1. "Pengingat mengajar" - kalau hari ini ada jadwal mengajar (dibaca dari
 *      field bebas isian `mataKuliah.jadwal`, sama seperti yang dipakai
 *      papan Display - lihat helpers/jadwalHelper.js).
 *   2. "Tugas belum dinilai" - ringkasan harian kalau ada pengumpulan tugas
 *      mahasiswa yang statusnya masih 'dikumpulkan' (belum dinilai dosen).
 *
 * SENGAJA cuma dicek SEKALI PER BEBERAPA JAM per dosen (bukan tiap request),
 * dan SEKALI PER HARI per jenis notifikasi (pakai ID dokumen deterministik
 * supaya tidak dobel notifikasi kalau dosen buka banyak halaman) - jadi
 * tidak menambah baca Firestore yang berarti meski dipanggil dari
 * middleware global. Dipanggil dari app.js, hanya untuk req.user.role
 * === 'dosen'.
 */

const { TTLCache, getAllMataKuliah } = require('./cache');
const { parseJadwalText } = require('./jadwalHelper');
const { createNotification } = require('./notificationHelper');

// Sekali dicek, tidak dicek ulang selama 4 jam per dosen - cukup untuk
// "terasa harian" tanpa membebani Firestore di setiap request.
const CHECK_TTL_MS = 4 * 60 * 60 * 1000;
const sudahDicekCache = new TTLCache(CHECK_TTL_MS);

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/** Buat notifikasi HANYA kalau ID deterministik ini belum pernah dibuat sebelumnya. */
async function buatJikaBelumAda(db, id, userId, data) {
  const ref = db.collection('notifications').doc(id);
  const existing = await ref.get();
  if (existing.exists) return;
  await ref.set({
    userId,
    type: data.type,
    title: data.title,
    message: data.message || '',
    link: data.link || null,
    read: false,
    createdAt: new Date().toISOString()
  });
}

/** 1. Pengingat jadwal mengajar hari ini, satu notifikasi per mata kuliah. */
async function ingatkanJadwalMengajar(db, user, tanggal) {
  const dosenId = user.dosenId;
  if (!dosenId) return;

  const HARI_LIST = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const hariIni = HARI_LIST[new Date().getDay()];

  const mkList = await getAllMataKuliah(db);
  const mkHariIni = mkList
    .filter(mk => Array.isArray(mk.dosenIds) && mk.dosenIds.includes(dosenId))
    .map(mk => ({ mk, jadwal: parseJadwalText(mk.jadwal) }))
    .filter(x => x.jadwal && x.jadwal.hari === hariIni);

  for (const { mk, jadwal } of mkHariIni) {
    const id = `jadwal-${dosenId}-${tanggal}-${mk.id}`;
    const jamText = jadwal.jamMulai && jadwal.jamSelesai ? ` pukul ${jadwal.jamMulai}-${jadwal.jamSelesai}` : '';
    const ruangText = jadwal.ruangan ? ` di ${jadwal.ruangan}` : '';
    await buatJikaBelumAda(db, id, user.id, {
      type: 'jadwal-mengajar',
      title: `Jadwal mengajar hari ini: ${mk.kode || ''} ${mk.nama || ''}`.trim(),
      message: `Anda mengajar hari ini${jamText}${ruangText}.`,
      link: `/dosen/mk/${mk.id}`
    });
  }
}

/** 2. Ringkasan harian tugas mahasiswa yang belum dinilai. */
async function ingatkanTugasBelumDinilai(db, user, tanggal) {
  const dosenId = user.dosenId;
  if (!dosenId) return;

  const tugasSnap = await db.collection('tugas').where('dosenId', '==', dosenId).get();
  const tugasIds = tugasSnap.docs.map(d => d.id);
  if (tugasIds.length === 0) return;

  const counts = await Promise.all(
    chunkArray(tugasIds, 10).map(async chunk => {
      const snap = await db.collection('pengumpulan')
        .where('tugasId', 'in', chunk)
        .where('status', '==', 'dikumpulkan')
        .get();
      return snap.size;
    })
  );
  const totalBelumDinilai = counts.reduce((a, b) => a + b, 0);
  if (totalBelumDinilai === 0) return;

  const id = `tugas-nilai-${dosenId}-${tanggal}`;
  await buatJikaBelumAda(db, id, user.id, {
    type: 'tugas-belum-dinilai',
    title: `${totalBelumDinilai} tugas mahasiswa menunggu dinilai`,
    message: 'Ada pengumpulan tugas yang belum Anda beri nilai.',
    link: `/dosen/nilai`
  });
}

/**
 * Dipanggil dari middleware global (app.js) - lihat catatan performa di
 * bagian atas file ini soal cache 4 jam supaya aman dipanggil per request.
 */
async function cekPengingatDosen(db, user) {
  if (!user || user.role !== 'dosen' || !user.dosenId) return;

  await sudahDicekCache.getOrFetch(user.dosenId, async () => {
    const tanggal = todayStr();
    try {
      await Promise.all([
        ingatkanJadwalMengajar(db, user, tanggal),
        ingatkanTugasBelumDinilai(db, user, tanggal)
      ]);
    } catch (error) {
      console.error('Gagal membuat pengingat otomatis dosen:', error);
    }
    return true; // nilai cache-nya tidak penting, cuma dipakai sbg penanda "sudah dicek"
  });
}

module.exports = { cekPengingatDosen };
