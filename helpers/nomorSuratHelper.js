// helpers/nomorSuratHelper.js
// Format nomor surat prodi: <nomor urut>/ELK/POLIDEWA/<bulan romawi>/<tahun>
// Admin cukup mengetik nomor urutnya (mis. "012"); bagian lain dilengkapi otomatis dari
// tanggal surat (bila diisi) atau hari ini (WITA). Bila yang diketik sudah memuat "/"
// dianggap nomor lengkap dan dipakai apa adanya (surat lama / format khusus).
// Kode tengah bisa diubah lewat env NOMOR_SURAT_KODE (default "ELK/POLIDEWA").
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const KODE = (process.env.NOMOR_SURAT_KODE || 'ELK/POLIDEWA').replace(/^\/+|\/+$/g, '');

function hariIniWita() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** @param {string} mentah input admin  @param {string} [tanggal] 'YYYY-MM-DD'  @returns {string} nomor lengkap ('' bila kosong) */
function normalisasiNomorSurat(mentah, tanggal) {
  const v = String(mentah == null ? '' : mentah).trim();
  if (!v) return '';
  if (v.includes('/')) return v;                       // sudah lengkap
  const tgl = /^\d{4}-\d{2}-\d{2}$/.test(String(tanggal || '')) ? tanggal : hariIniWita();
  const bulan = parseInt(tgl.slice(5, 7), 10);
  const tahun = tgl.slice(0, 4);
  return `${v}/${KODE}/${ROMAWI[bulan - 1] || ROMAWI[0]}/${tahun}`;
}

/** Middleware: lengkapi req.body.nomorSurat (idempoten). Pasang SESUDAH multer bagi form multipart. */
function nomorSuratMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body.nomorSurat === 'string' && req.body.nomorSurat.trim()) {
      req.body.nomorSurat = normalisasiNomorSurat(req.body.nomorSurat, req.body.tanggalSurat);
    }
  } catch (e) { /* biarkan apa adanya */ }
  next();
}

module.exports = { normalisasiNomorSurat, nomorSuratMiddleware, KODE };
