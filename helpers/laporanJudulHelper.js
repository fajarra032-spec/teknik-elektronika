// helpers/laporanJudulHelper.js
// Judul laporan magang dibuat OTOMATIS: "Laporan Magang {ke} di {nama perusahaan}"
// contoh: "Laporan Magang 1 di PT PLN". Perusahaan diambil dari periode magang
// mahasiswa (periode aktif/terbaru yang punya nama perusahaan).

const { getMagangPeriodsByMahasiswa } = require('../models/magangPeriodModel');

/** Nama perusahaan dari periode magang terbaru mahasiswa ('' bila belum ada). */
async function getNamaPerusahaanMagang(userId) {
  try {
    const periods = await getMagangPeriodsByMahasiswa(userId);
    const urut = (periods || [])
      .filter((p) => p && p.perusahaan && String(p.perusahaan.nama || '').trim())
      .sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')));
    return urut.length ? String(urut[0].perusahaan.nama).trim().replace(/\s+/g, ' ') : '';
  } catch (err) {
    console.error('Error getNamaPerusahaanMagang:', err);
    return '';
  }
}

function formatJudulLaporan(laporanKe, namaPerusahaan) {
  const ke = parseInt(laporanKe, 10);
  const dasar = `Laporan Magang ${Number.isNaN(ke) ? '' : ke}`.trim();
  return namaPerusahaan ? `${dasar} di ${namaPerusahaan}` : dasar;
}

async function buildJudulLaporan(userId, laporanKe) {
  return formatJudulLaporan(laporanKe, await getNamaPerusahaanMagang(userId));
}

/** Nama file aman untuk Google Drive / unduhan. */
function namaFileDariJudul(judul) {
  return String(judul || 'Laporan Magang').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) + '.pdf';
}

module.exports = { getNamaPerusahaanMagang, formatJudulLaporan, buildJudulLaporan, namaFileDariJudul };
