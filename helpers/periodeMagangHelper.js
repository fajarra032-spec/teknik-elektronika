// helpers/periodeMagangHelper.js
// ============================================================================
// PEMISAHAN LOGBOOK ANTAR PERIODE MAGANG (Magang 1 / 2 / 3)
//
// Aturan:
//  1. Periode yang tanggalSelesai-nya sudah lewat dianggap SUDAH BERAKHIR
//     (walau status dokumennya masih 'active' sampai admin menutup/menilai).
//     Periode berakhir tidak lagi menjadi periode default; tetap terarsip.
//  2. Periode default (yang dibuka otomatis) = periode yang sedang berjalan,
//     bukan sekadar urutan kode PDK.
//  3. Rekap/hitungan logbook SELALU per periode, tidak dijumlah antar Magang.
//  4. Bila ada >1 periode memakai PDK yang sama (mis. dimulai ulang), logbook
//     dipisah lewat TANGGAL: tiap periode memegang logbook dari tanggal
//     mulainya sampai sehari sebelum periode berikutnya dimulai. Tanpa
//     migrasi data dan tanpa indeks Firestore baru.
// ============================================================================

const MS_HARI = 86400000;

/** Tanggal hari ini (WITA) format YYYY-MM-DD. */
function hariIniWITA() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10);
}

function tambahHari(tgl, n) {
  const d = new Date(String(tgl).substring(0, 10) + 'T00:00:00Z');
  return new Date(d.getTime() + n * MS_HARI).toISOString().substring(0, 10);
}

/** Sudah berakhir: status completed/cancelled, atau tanggalSelesai sudah lewat. */
function periodeSudahBerakhir(period, today) {
  if (!period) return false;
  if (period.status === 'completed' || period.status === 'cancelled') return true;
  today = today || hariIniWITA();
  return !!(period.tanggalSelesai && today > String(period.tanggalSelesai).substring(0, 10));
}

/**
 * Pilih periode default dari daftar periode mahasiswa.
 *  0) active/locked, sudah mulai, belum berakhir  (terbaru dulu)
 *  1) active/locked, belum mulai                  (terdekat dulu)
 *  2) selebihnya (sudah berakhir / selesai)        (terbaru dulu)
 * Periode 'cancelled' diabaikan (kecuali semuanya cancelled).
 */
function pilihPeriodeDefault(periods, today) {
  const semua = Array.isArray(periods) ? periods : [];
  if (semua.length === 0) return null;
  today = today || hariIniWITA();
  const kandidat = semua.filter((p) => p.status !== 'cancelled');
  if (kandidat.length === 0) return semua[0];

  const mulai = (p) => String(p.tanggalMulai || '');
  const rank = (p) => {
    if (periodeSudahBerakhir(p, today)) return 2;
    if (p.status !== 'active' && p.status !== 'locked') return 2;
    return mulai(p) && mulai(p) > today ? 1 : 0;
  };
  return kandidat.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const cmp = ra === 1 ? mulai(a).localeCompare(mulai(b)) : mulai(b).localeCompare(mulai(a));
    return cmp || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  })[0];
}

/**
 * Rentang tanggal logbook milik satu periode: { awal, akhir } (string atau null).
 * Hanya membatasi bila ada periode lain (tidak dibatalkan) dengan PDK yang sama.
 */
function rentangLogbookPeriode(period, allPeriods) {
  const kosong = { awal: null, akhir: null };
  if (!period || !period.pdkId || !period.tanggalMulai) return kosong;
  const saudara = (allPeriods || [])
    .filter((p) => p.pdkId === period.pdkId && p.status !== 'cancelled' && p.tanggalMulai)
    .sort((a, b) =>
      String(a.tanggalMulai).localeCompare(String(b.tanggalMulai)) ||
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  if (saudara.length <= 1) return kosong;
  const idx = saudara.findIndex((p) => p.id === period.id);
  if (idx < 0) return kosong;
  return {
    awal: idx === 0 ? null : String(period.tanggalMulai).substring(0, 10),
    akhir: idx === saudara.length - 1 ? null : tambahHari(saudara[idx + 1].tanggalMulai, -1)
  };
}

/** Tambahkan batas tanggal ke query Firestore (pakai indeks userId+pdkId+tanggal yang sudah ada). */
function terapkanRentang(query, rentang) {
  if (rentang && rentang.awal) query = query.where('tanggal', '>=', rentang.awal);
  if (rentang && rentang.akhir) query = query.where('tanggal', '<=', rentang.akhir);
  return query;
}

/** Apakah tanggal (string/ISO) berada dalam rentang? */
function dalamRentang(tanggal, rentang) {
  if (!rentang) return true;
  const t = String(tanggal || '').substring(0, 10);
  if (rentang.awal && t < rentang.awal) return false;
  if (rentang.akhir && t > rentang.akhir) return false;
  return true;
}

/** Ambil semua periode (selain cancelled) untuk banyak mahasiswa: Map(mahasiswaId -> [periode]). */
async function ambilPeriodePerMahasiswa(db, ids) {
  const peta = new Map();
  const unik = Array.from(new Set(ids || []));
  for (let i = 0; i < unik.length; i += 10) {
    const chunk = unik.slice(i, i + 10);
    const snap = await db.collection('magangPeriod').where('mahasiswaId', 'in', chunk).get();
    snap.docs.forEach((d) => {
      const p = { id: d.id, ...d.data() };
      if (!peta.has(p.mahasiswaId)) peta.set(p.mahasiswaId, []);
      peta.get(p.mahasiswaId).push(p);
    });
  }
  return peta;
}

/**
 * Statistik logbook SATU periode: { total, pending, approved, rejected }.
 * Tanpa rentang: 4 query count() (murah). Dengan rentang (kasus PDK sama
 * dimulai >1 kali): baca status saja lalu hitung di JS (tanpa indeks baru).
 */
async function statistikLogbookPeriode(db, mahasiswaId, period, allPeriods) {
  if (!period) return { total: 0, pending: 0, approved: 0, rejected: 0 };
  const rentang = rentangLogbookPeriode(period, allPeriods);
  const dasar = db.collection('logbookMagang')
    .where('userId', '==', mahasiswaId)
    .where('pdkId', '==', period.pdkId);

  if (rentang.awal || rentang.akhir) {
    const snap = await terapkanRentang(dasar, rentang).select('status').get();
    const hasil = { total: snap.size, pending: 0, approved: 0, rejected: 0 };
    snap.docs.forEach((d) => {
      const s = d.get('status');
      if (hasil[s] !== undefined) hasil[s]++;
    });
    return hasil;
  }

  const hitung = async (q) => {
    try { return (await q.count().get()).data().count; }
    catch (e) { return (await q.get()).size; }
  };
  const [total, pending, approved, rejected] = await Promise.all([
    hitung(dasar),
    hitung(dasar.where('status', '==', 'pending')),
    hitung(dasar.where('status', '==', 'approved')),
    hitung(dasar.where('status', '==', 'rejected'))
  ]);
  return { total, pending, approved, rejected };
}

/**
 * Periode yang memegang sebuah TANGGAL (untuk foto/entri lama): periode dengan
 * tanggalMulai terakhir yang <= tanggal; bila tanggal sebelum semuanya, yang paling awal.
 */
function pilihPeriodeUntukTanggal(periods, tanggal) {
  const daftar = (periods || [])
    .filter((p) => p.status !== 'cancelled' && p.tanggalMulai)
    .sort((a, b) => String(a.tanggalMulai).localeCompare(String(b.tanggalMulai)));
  if (daftar.length === 0) return (periods || []).find((p) => p.status !== 'cancelled') || null;
  const t = String(tanggal || '').substring(0, 10);
  let hasil = daftar[0];
  daftar.forEach((p) => { if (t && String(p.tanggalMulai).substring(0, 10) <= t) hasil = p; });
  return hasil;
}

/** Jumlah logbook 'approved' milik SATU periode (1 count() bila tanpa rentang). */
async function hitungApprovedPeriode(db, mahasiswaId, period, allPeriods) {
  if (!period) return 0;
  const rentang = rentangLogbookPeriode(period, allPeriods);
  const dasar = db.collection('logbookMagang')
    .where('userId', '==', mahasiswaId)
    .where('pdkId', '==', period.pdkId);
  if (rentang.awal || rentang.akhir) {
    const snap = await terapkanRentang(dasar, rentang).select('status').get();
    return snap.docs.filter((d) => d.get('status') === 'approved').length;
  }
  const q = dasar.where('status', '==', 'approved');
  try { return (await q.count().get()).data().count; }
  catch (e) { return (await q.get()).size; }
}

module.exports = {
  pilihPeriodeUntukTanggal,
  hitungApprovedPeriode,
  hariIniWITA,
  periodeSudahBerakhir,
  pilihPeriodeDefault,
  rentangLogbookPeriode,
  terapkanRentang,
  dalamRentang,
  ambilPeriodePerMahasiswa,
  statistikLogbookPeriode
};
