/**
 * helpers/kuliahReminderHelper.js
 * Pengingat jadwal kuliah untuk DOSEN dan MAHASISWA, dikirim otomatis (bell + WhatsApp)
 * tanpa menunggu pengguna membuka website.
 *
 * Sumber data (sama dengan fitur yang sudah ada, tidak ada koleksi baru):
 *   - Jadwal   : field teks bebas `mataKuliah.jadwal` (mis. "Senin 08:00-10:30, Ruang A101"),
 *                di-parse oleh helpers/jadwalHelper.js. Boleh lebih dari satu sesi dipisah ";" / baris baru.
 *   - Dosen    : `mataKuliah.dosenIds` -> dokumen `dosen` (field userId) -> akun users.
 *   - Mahasiswa: koleksi `enrollment` (status 'active' DAN semester = periode akademik berjalan,
 *                supaya angkatan lama yang masih 'active' tidak ikut diingatkan).
 *
 * Dua jenis pengingat:
 *   1. Ringkasan pagi  (type 'kuliah-pagi')   - 1 pesan/hari berisi semua jadwal hari itu.
 *   2. Sebelum kelas   (type 'kuliah-sebelum') - per kelas, N menit sebelum mulai (bawaan MATI).
 *
 * Pesan dibuat lewat createNotificationOnce (ID deterministik) sehingga:
 *   - tidak pernah ganda walau PM2 restart / penjadwal terpicu ulang,
 *   - ikut tampil di lonceng website,
 *   - diteruskan ke WhatsApp oleh helpers/waNotifier.js (dengan semua pengamannya).
 *
 * Penjadwal HANYA berjalan bila WA_AUTO_ENABLED=true (tidak menambah tulis Firestore bila WA mati).
 *
 * .env (opsional):
 *   KULIAH_REMINDER_ENABLED=true      false = matikan penjadwal ini
 *   KULIAH_PAGI_JAM=06:30             jam kirim ringkasan pagi (WITA)
 *   KULIAH_PAGI_BATAS=10:00           lewat jam ini ringkasan hari itu tidak dikirim lagi (mis. server baru hidup)
 *   KULIAH_REMINDER_MENIT=0           0 = tanpa pengingat sebelum kelas; mis. 60 = 1 jam sebelum
 *   KULIAH_UNTUK_DOSEN=true  KULIAH_UNTUK_MAHASISWA=true
 */
const { getAllMataKuliah } = require('./cache');
const { parseJadwalText, HARI_LIST } = require('./jadwalHelper');
const { getCurrentAcademicSemester } = require('./academicHelper');
const { createNotificationOnce } = require('./notificationHelper');

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const bool = (k, d) => String(env(k, d)).toLowerCase() === 'true';
const num = (k, d) => { const n = Number(env(k, d)); return Number.isFinite(n) ? n : d; };
const jamKeMenit = (s, d) => { const m = String(env(s, d)).match(/^(\d{1,2})[.:](\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : jamKeMenit('', d); };

const WITA_MS = 8 * 3600 * 1000;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const RENCANA_TTL_MS = 3 * 3600 * 1000;
const MAKS_BARIS = 8;

// ---------------------------------------------------------------------------
// Parsing jadwal (banyak sesi)
// ---------------------------------------------------------------------------
function parseSemuaJadwal(text) {
  if (!text) return [];
  const hasil = [];
  let hariTerakhir = null;
  String(text).split(/[;\n]+|\s+&\s+|\s+dan\s+/i).forEach(seg => {
    let s = parseJadwalText(seg);
    if (!s && hariTerakhir) s = parseJadwalText(`${hariTerakhir} ${seg}`); // "13:00-15:00" tanpa hari -> pakai hari sebelumnya
    if (s) { hariTerakhir = s.hari; hasil.push(s); }
  });
  return hasil;
}
const menitDariJam = (jam) => { const [h, m] = String(jam).split(':').map(Number); return h * 60 + (m || 0); };

// ---------------------------------------------------------------------------
// Rencana hari ini: siapa (uid) punya kelas apa jam berapa
// ---------------------------------------------------------------------------
async function bangunRencana(db, hariNama) {
  const perOrang = new Map(); // uid -> { role, items: [...] }
  const tambah = (uid, role, item) => {
    if (!uid) return;
    const o = perOrang.get(uid) || { role, items: [] };
    if (!o.items.some(x => x.mkId === item.mkId && x.jamMulai === item.jamMulai)) o.items.push(item);
    perOrang.set(uid, o);
  };

  const mkList = await getAllMataKuliah(db);
  const sesiHariIni = [];
  mkList.forEach(mk => parseSemuaJadwal(mk.jadwal).forEach(s => { if (s.hari === hariNama) sesiHariIni.push({ mk, s }); }));
  if (!sesiHariIni.length) return { perOrang, jumlahKelas: 0 };

  const itemDari = ({ mk, s }) => ({
    mkId: mk.id, kode: mk.kode || '', nama: mk.nama || mk.kode || 'Mata kuliah',
    jamMulai: s.jamMulai, jamSelesai: s.jamSelesai, ruangan: s.ruangan || '', mulaiMenit: menitDariJam(s.jamMulai)
  });

  // Dosen
  if (bool('KULIAH_UNTUK_DOSEN', 'true')) {
    const uidPerDosen = await require('./dosenAkunHelper').petaUserPerDosen(db);
    sesiHariIni.forEach(x => {
      (Array.isArray(x.mk.dosenIds) ? x.mk.dosenIds : []).forEach(did => tambah(uidPerDosen[did], 'dosen', itemDari(x)));
    });
  }

  // Mahasiswa
  if (bool('KULIAH_UNTUK_MAHASISWA', 'true')) {
    const periode = getCurrentAcademicSemester().label;
    const perMk = new Map();
    sesiHariIni.forEach(x => { const a = perMk.get(x.mk.id) || []; a.push(x); perMk.set(x.mk.id, a); });
    const ids = [...perMk.keys()];
    for (let i = 0; i < ids.length; i += 10) {
      const snap = await db.collection('enrollment')
        .where('mkId', 'in', ids.slice(i, i + 10))
        .where('status', '==', 'active')
        .get();
      snap.docs.forEach(d => {
        const e = d.data();
        if (e.semester !== periode) return; // hanya periode berjalan
        (perMk.get(e.mkId) || []).forEach(x => tambah(e.userId, 'mahasiswa', itemDari(x)));
      });
    }
  }

  perOrang.forEach(o => o.items.sort((a, b) => a.mulaiMenit - b.mulaiMenit));
  return { perOrang, jumlahKelas: sesiHariIni.length };
}

// ---------------------------------------------------------------------------
// Penyusunan & pengiriman
// ---------------------------------------------------------------------------
function baris(it) {
  return `• ${it.jamMulai}–${it.jamSelesai} ${it.nama}${it.ruangan ? ` (${it.ruangan})` : ''}`;
}

function notifPagi(role, items, hariNama, tglLabel) {
  const lebih = items.length - MAKS_BARIS;
  const daftar = items.slice(0, MAKS_BARIS).map(baris).join('\n') + (lebih > 0 ? `\n… dan ${lebih} lainnya` : '');
  return role === 'dosen'
    ? { type: 'kuliah-pagi', title: `Jadwal mengajar hari ini (${hariNama}, ${tglLabel})`, message: daftar, link: '/dosen/dashboard' }
    : { type: 'kuliah-pagi', title: `Jadwal kuliah hari ini (${hariNama}, ${tglLabel})`, message: daftar, link: '/mahasiswa/dashboard' };
}

function notifSebelum(role, it, menitLagi) {
  const ruang = it.ruangan ? ` di ${it.ruangan}` : '';
  return role === 'dosen'
    ? { type: 'kuliah-sebelum', title: `Mengajar pukul ${it.jamMulai}: ${it.nama}`, message: `Dimulai sekitar ${menitLagi} menit lagi${ruang}.`, link: '/dosen/dashboard' }
    : { type: 'kuliah-sebelum', title: `Kuliah pukul ${it.jamMulai}: ${it.nama}`, message: `Dimulai sekitar ${menitLagi} menit lagi${ruang}.`, link: '/mahasiswa/dashboard' };
}

async function kirimPagi(db, rencana, tanggal, hariNama, tglLabel) {
  let dibuat = 0;
  for (const [uid, o] of rencana.perOrang) {
    if (!o.items.length) continue;
    const ok = await createNotificationOnce(db, uid, `kuliah-pagi-${uid}-${tanggal}`, notifPagi(o.role, o.items, hariNama, tglLabel));
    if (ok) dibuat++;
  }
  return dibuat;
}

async function kirimSebelum(db, rencana, tanggal, menitSekarang, batasMenit, sudah) {
  let dibuat = 0;
  for (const [uid, o] of rencana.perOrang) {
    for (const it of o.items) {
      const lagi = it.mulaiMenit - menitSekarang;
      if (lagi <= 0 || lagi > batasMenit) continue;
      const kunci = `${uid}|${it.mkId}|${it.jamMulai}`;
      if (sudah.has(kunci)) continue;
      sudah.add(kunci);
      const id = `kuliah-sebelum-${uid}-${tanggal}-${it.mkId}-${it.jamMulai.replace(':', '')}`;
      if (await createNotificationOnce(db, uid, id, notifSebelum(o.role, it, lagi))) dibuat++;
    }
  }
  return dibuat;
}

// ---------------------------------------------------------------------------
// Penjadwal (1 tick / menit)
// ---------------------------------------------------------------------------
let timer = null;
let dbRef = null;
let sedangTick = false;
let status = { tanggal: null, pagi: false, sebelum: new Set(), rencana: null, rencanaT: 0, pagiDibuat: 0 };

const aktif = () => bool('WA_AUTO_ENABLED', 'false') && bool('KULIAH_REMINDER_ENABLED', 'true');

async function tick() {
  if (!aktif() || !dbRef || sedangTick) return;
  sedangTick = true;
  try {
    const w = new Date(Date.now() + WITA_MS);
    const tanggal = w.toISOString().slice(0, 10);
    const menit = w.getUTCHours() * 60 + w.getUTCMinutes();
    const hariNama = HARI_LIST[w.getUTCDay()];
    const tglLabel = `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}`;

    if (status.tanggal !== tanggal) status = { tanggal, pagi: false, sebelum: new Set(), rencana: null, rencanaT: 0, pagiDibuat: 0 };
    if (menit < 6 * 60 || menit > 21 * 60) return; // di luar jam kerja penjadwal: tanpa baca Firestore

    const pagiMulai = jamKeMenit('KULIAH_PAGI_JAM', '06:30');
    const pagiBatas = jamKeMenit('KULIAH_PAGI_BATAS', '10:00');
    const sebelum = num('KULIAH_REMINDER_MENIT', 0);

    const dapatRencana = async (paksa) => {
      if (!paksa && status.rencana && Date.now() - status.rencanaT < RENCANA_TTL_MS) return status.rencana;
      status.rencana = await bangunRencana(dbRef, hariNama);
      status.rencanaT = Date.now();
      return status.rencana;
    };

    if (!status.pagi && menit >= pagiMulai && menit <= pagiBatas) {
      const r = await dapatRencana(true);
      status.pagiDibuat = await kirimPagi(dbRef, r, tanggal, hariNama, tglLabel);
      status.pagi = true; // hanya setelah sukses; bila error, dicoba lagi di tick berikutnya (ID deterministik mencegah ganda)
      console.log(`[Kuliah] Ringkasan pagi ${tanggal}: ${status.pagiDibuat} pengingat dibuat (${r.jumlahKelas} sesi kelas hari ini).`);
    }

    if (sebelum > 0) {
      const r = await dapatRencana(false);
      if (r.jumlahKelas) {
        const n = await kirimSebelum(dbRef, r, tanggal, menit, sebelum, status.sebelum);
        if (n) console.log(`[Kuliah] Pengingat sebelum kelas: ${n} dibuat.`);
      }
    }
  } catch (e) {
    console.error('[Kuliah] Penjadwal gagal:', e.message);
  } finally {
    sedangTick = false;
  }
}

/** Idempotent: aman dipanggil berkali-kali (app.js saat start, atau lewat notificationHelper). */
function mulai(db) {
  if (timer || !db) return;
  if (!aktif()) return;
  dbRef = db;
  timer = setInterval(() => { tick(); }, 60 * 1000);
  if (timer.unref) timer.unref();
  const t = setTimeout(() => { tick(); }, 5000);
  if (t.unref) t.unref();
  console.log('[Kuliah] Penjadwal pengingat kuliah aktif.');
}

function info() {
  return {
    aktif: aktif(), berjalan: !!timer,
    pagi: env('KULIAH_PAGI_JAM', '06:30'), sebelumMenit: num('KULIAH_REMINDER_MENIT', 0),
    dosen: bool('KULIAH_UNTUK_DOSEN', 'true'), mahasiswa: bool('KULIAH_UNTUK_MAHASISWA', 'true')
  };
}

module.exports = { mulai, info, _test: { parseSemuaJadwal, bangunRencana, kirimPagi, kirimSebelum, notifPagi, notifSebelum, tick } };
