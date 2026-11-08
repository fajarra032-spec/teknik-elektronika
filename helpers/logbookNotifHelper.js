// helpers/logbookNotifHelper.js
// ============================================================================
// NOTIFIKASI LOGBOOK MAGANG
//  - Mahasiswa : "Logbook hari ini masih kosong nih" (banner + badge navbar +
//                notifikasi lonceng setelah pukul 15.00 WITA).
//  - Dosen PA  : "N mahasiswa menunggu persetujuan logbook - Buka sekarang"
//                (banner + badge navbar + notifikasi lonceng harian).
//
// Hemat kuota Firestore: hasil di-cache (mahasiswa 10 menit, dosen 2 menit) dan
// notifikasi lonceng memakai ID dokumen deterministik per hari (tidak dobel).
// ============================================================================

const { TTLCache } = require('./cache');
const { getActiveMagangPeriods } = require('../models/magangPeriodModel');
const { getMahasiswaBimbinganPa } = require('./pembimbingHelper');

const cacheMahasiswa = new TTLCache(10 * 60 * 1000);
const cacheDosen = new TTLCache(2 * 60 * 1000);
const cacheNotifMhs = new TTLCache(60 * 60 * 1000);

const JAM_NOTIF_LONCENG = 15; // notifikasi lonceng mahasiswa mulai pukul 15.00 WITA

function todayWITA() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
}
function jamWITA() {
  return parseInt(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Makassar', hour: '2-digit', hour12: false }), 10);
}
function hariKe(tanggal) { return new Date(tanggal + 'T00:00:00Z').getUTCDay(); } // 0=Min ... 6=Sab
function tanggalPanjang(tanggal) {
  return new Date(tanggal + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function chunk(arr, n) { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; }

// ----------------------------------------------------------------------------
// MAHASISWA
// ----------------------------------------------------------------------------
async function hitungLogbookHariIni(db, userId) {
  const tanggal = todayWITA();
  const dasar = { perluDiisi: false, tanggal, tanggalPanjang: tanggalPanjang(tanggal), periodId: '', link: '/mahasiswa/magang/logbook' };

  const hari = hariKe(tanggal);
  if (hari === 0 || hari === 6) return dasar;                 // hari kerja Senin-Jumat saja

  const periods = await getActiveMagangPeriods(userId);
  if (!periods.length) return dasar;
  const period = periods[0];

  const snap = await db.collection('logbookMagang')
    .where('userId', '==', userId)
    .where('tanggal', '==', tanggal)
    .limit(1)
    .get();

  return {
    ...dasar,
    perluDiisi: snap.empty,
    periodId: period.id,
    link: `/mahasiswa/magang/logbook?periodId=${encodeURIComponent(period.id)}`
  };
}

async function cekLogbookHariIni(db, userId) {
  if (!userId) return { perluDiisi: false };
  const cached = cacheMahasiswa.get(userId);
  if (cached && cached.tanggal === todayWITA()) return cached;   // ganti hari => hitung ulang
  const hasil = await hitungLogbookHariIni(db, userId);
  cacheMahasiswa.set(userId, hasil);
  return hasil;
}

/** Panggil setelah mahasiswa menyimpan logbook: banner hilang & notifikasi lonceng ditandai dibaca. */
function logbookHariIniTerisi(db, userId) {
  cacheMahasiswa.delete(userId);
  const id = `logbook-hari-ini-${userId}-${todayWITA()}`;
  db.collection('notifications').doc(id).update({ read: true }).catch(() => {}); // abaikan bila tidak ada
}

/** Notifikasi lonceng harian untuk mahasiswa (setelah 15.00 WITA, bila belum isi). */
async function cekPengingatMahasiswa(db, user) {
  if (!user || user.role !== 'mahasiswa' || !user.id) return;
  // Pengingat masa magang hampir berakhir (H-7/H-3/H-1): sekali per hari, tanpa menunggu jam 15.00
  require('./magangNotifHelper').cekPengingatPeriodeMahasiswa(db, user);
  if (jamWITA() < JAM_NOTIF_LONCENG) return;
  const tanggal = todayWITA();
  const kunci = `${user.id}_${tanggal}`;
  if (cacheNotifMhs.get(kunci)) return;

  const status = await cekLogbookHariIni(db, user.id);
  if (!status.perluDiisi) return;                              // tidak di-cache: dicek lagi nanti

  const ref = db.collection('notifications').doc(`logbook-hari-ini-${user.id}-${tanggal}`);
  const ada = await ref.get();
  if (!ada.exists) {
    await ref.set({
      userId: user.id,
      type: 'logbook-hari-ini',
      title: 'Logbook hari ini masih kosong nih 📝',
      message: `Yuk catat kegiatan magangmu hari ini (${status.tanggalPanjang}) selagi masih segar di ingatan. Cukup beberapa menit kok!`,
      link: status.link,
      read: false,
      createdAt: new Date().toISOString()
    });
  }
  cacheNotifMhs.set(kunci, true);
}

// ----------------------------------------------------------------------------
// DOSEN PA
// ----------------------------------------------------------------------------
async function hitungPendingDosen(db, dosenId) {
  const kosong = { jumlahMahasiswa: 0, jumlahEntri: 0, daftar: [], linkBuka: '/dosen/magang' };
  const mhsList = await getMahasiswaBimbinganPa(dosenId);
  if (!mhsList.length) return kosong;

  const info = new Map(mhsList.map((m) => [m.id, m]));
  const pdkAktif = new Map();                                  // mahasiswaId -> Set(pdkId periode aktif)
  const pending = new Map();                                   // mahasiswaId -> { pdkId: jumlah }

  await Promise.all(chunk([...info.keys()], 10).map(async (ids) => {
    const [pSnap, lSnap] = await Promise.all([
      db.collection('magangPeriod').where('mahasiswaId', 'in', ids).where('status', '==', 'active').get(),
      db.collection('logbookMagang').where('userId', 'in', ids).where('status', '==', 'pending').select('userId', 'pdkId').get()
    ]);
    pSnap.docs.forEach((d) => {
      const x = d.data();
      if (!pdkAktif.has(x.mahasiswaId)) pdkAktif.set(x.mahasiswaId, new Set());
      pdkAktif.get(x.mahasiswaId).add(x.pdkId);
    });
    lSnap.docs.forEach((d) => {
      const x = d.data();
      if (!pending.has(x.userId)) pending.set(x.userId, {});
      pending.get(x.userId)[x.pdkId] = (pending.get(x.userId)[x.pdkId] || 0) + 1;
    });
  }));

  const daftar = [];
  pending.forEach((perPdk, mid) => {
    const aktif = pdkAktif.get(mid);
    if (!aktif) return;                                        // hanya periode magang yang sedang aktif
    let n = 0;
    Object.keys(perPdk).forEach((pdk) => { if (aktif.has(pdk)) n += perPdk[pdk]; });
    if (n > 0) daftar.push({ id: mid, nama: (info.get(mid) || {}).nama || '-', nim: (info.get(mid) || {}).nim || '', pending: n });
  });
  daftar.sort((a, b) => b.pending - a.pending || a.nama.localeCompare(b.nama));

  return {
    jumlahMahasiswa: daftar.length,
    jumlahEntri: daftar.reduce((s, x) => s + x.pending, 0),
    daftar,
    linkBuka: daftar.length === 1 ? `/dosen/magang/${daftar[0].id}#mingguan` : '/dosen/magang'
  };
}

async function getRingkasanPendingDosen(db, dosenId) {
  if (!dosenId) return { jumlahMahasiswa: 0, jumlahEntri: 0, daftar: [], linkBuka: '/dosen/magang' };
  return cacheDosen.getOrFetch(dosenId, () => hitungPendingDosen(db, dosenId));
}

function invalidateRingkasanDosen(dosenId) { if (dosenId) cacheDosen.delete(dosenId); }

module.exports = {
  todayWITA, cekLogbookHariIni, logbookHariIniTerisi, cekPengingatMahasiswa,
  getRingkasanPendingDosen, invalidateRingkasanDosen
};
