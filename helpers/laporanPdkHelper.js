// helpers/laporanPdkHelper.js
// ============================================================================
// PEMETAAN "MAGANG 1/2/3" <-> PERIODE (magangPeriod) <-> LAPORAN (laporanMagang)
//
// Aturan tunggal untuk seluruh aplikasi:
//   Magang N = mata kuliah PDK dengan urutanPDK == N
//   Laporan N (laporanMagang.laporanKe == N) = laporan untuk PDK urutan N
//
// Sebelumnya laporan tidak menyimpan pdkId/periodId sehingga syarat penilaian,
// judul laporan, dan data Penyelesaian Studi "bercampur" antar Magang 1/2/3.
// Dokumen laporan baru kini menyimpan pdkId + periodId; dokumen lama tetap
// terbaca lewat laporanKe -> urutanPDK (fallback), dan bisa dilengkapi dengan
// skrip scripts/migrasi-laporan-pdk.js.
// ============================================================================

const { db } = require('../config/firebaseAdmin');
const { TTLCache } = require('./cache');
const { getMagangPeriodsByMahasiswa } = require('../models/magangPeriodModel');

const urutanCache = new TTLCache(10 * 60 * 1000);

/** { [pdkId]: urutanPDK } untuk semua mata kuliah PDK (1 query, cache 10 menit). */
async function getUrutanPdkMap() {
  return urutanCache.getOrFetch('pdk-urutan', async () => {
    const snap = await db.collection('mataKuliah').where('isPDK', '==', true).get();
    const map = {};
    snap.docs.forEach((d) => {
      const u = Number(d.data().urutanPDK);
      if (Number.isFinite(u)) map[d.id] = u;
    });
    return map;
  });
}

function terbaru(daftar) {
  return daftar
    .slice()
    .sort((a, b) =>
      String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    )[0] || null;
}

/**
 * Periode magang per nomor: { 1: period|null, 2: period|null, 3: period|null }.
 * Periode 'cancelled' diabaikan. Bila satu PDK punya >1 periode (mis. dibatalkan
 * lalu dibuat ulang), yang dipakai adalah yang tanggal mulainya paling baru.
 * Fallback (hanya bila TIDAK ADA mata kuliah PDK yang punya urutanPDK):
 * diurutkan berdasarkan tanggal mulai, satu per PDK.
 */
async function getPeriodePerNomor(userId) {
  const [periods, urutanMap] = await Promise.all([
    getMagangPeriodsByMahasiswa(userId),
    getUrutanPdkMap()
  ]);
  const aktif = periods.filter((p) => p.status !== 'cancelled');
  const hasil = { 1: null, 2: null, 3: null };

  if (aktif.some((p) => urutanMap[p.pdkId] !== undefined)) {
    [1, 2, 3].forEach((ke) => {
      hasil[ke] = terbaru(aktif.filter((p) => urutanMap[p.pdkId] === ke));
    });
  } else {
    const perPdk = {};
    aktif.forEach((p) => {
      if (!perPdk[p.pdkId] || terbaru([perPdk[p.pdkId], p]) === p) perPdk[p.pdkId] = p;
    });
    Object.values(perPdk)
      .sort((a, b) => String(a.tanggalMulai || '').localeCompare(String(b.tanggalMulai || '')))
      .slice(0, 3)
      .forEach((p, i) => { hasil[i + 1] = p; });
  }
  return hasil;
}

/** Periode untuk satu nomor (1/2/3), atau null. */
async function getPeriodeUntukNomor(userId, ke) {
  const peta = await getPeriodePerNomor(userId);
  return peta[Number(ke)] || null;
}

/** Nama perusahaan milik Magang N ('' bila periodenya belum ada). */
async function getNamaPerusahaanUntukNomor(userId, ke) {
  const p = await getPeriodeUntukNomor(userId, ke);
  return p && p.perusahaan && p.perusahaan.nama
    ? String(p.perusahaan.nama).trim().replace(/\s+/g, ' ')
    : '';
}

/**
 * Apakah dokumen laporan milik PDK ini? Dokumen baru: bandingkan pdkId.
 * Dokumen lama (tanpa pdkId): laporanKe harus == urutanPDK. Bila urutan PDK
 * tidak diketahui sama sekali, dianggap cocok (perilaku lama, tidak mengunci).
 */
function laporanMilikPdk(laporan, pdkId, urutanMap) {
  if (laporan.pdkId) return laporan.pdkId === pdkId;
  const urutan = urutanMap[pdkId];
  if (urutan === undefined) return true;
  return Number(laporan.laporanKe) === urutan;
}

/** Saring daftar laporan untuk satu PDK (pdkId kosong = tanpa saringan). */
async function saringLaporanUntukPdk(laporanList, pdkId) {
  if (!pdkId) return laporanList;
  const urutanMap = await getUrutanPdkMap();
  return laporanList.filter((l) => laporanMilikPdk(l, pdkId, urutanMap));
}

/** Sudah ada laporan berstatus 'approved' untuk PDK ini? */
async function adaLaporanAccUntukPdk(userId, pdkId) {
  const snap = await db.collection('laporanMagang').where('userId', '==', userId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const milik = await saringLaporanUntukPdk(list, pdkId);
  return milik.some((l) => l.status === 'approved');
}

/** Label tampilan, mis. 'Magang 2'. */
function labelMagang(urutan) {
  return Number.isFinite(Number(urutan)) ? `Magang ${urutan}` : 'Magang';
}

module.exports = {
  getUrutanPdkMap,
  getPeriodePerNomor,
  getPeriodeUntukNomor,
  getNamaPerusahaanUntukNomor,
  laporanMilikPdk,
  saringLaporanUntukPdk,
  adaLaporanAccUntukPdk,
  labelMagang
};
