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

/** Abstrak otomatis bila dosen/admin tidak mengetik abstrak. */
function buatAbstrakLaporan(d, namaPerusahaan) {
  return `Laporan magang ${d.nama || ''}${d.nim ? ' (NIM ' + d.nim + ')' : ''}${namaPerusahaan ? ' di ' + namaPerusahaan : ''}, Program Studi Teknik Elektronika Politeknik Dewantara.`;
}

/**
 * Isi judul otomatis untuk banyak dokumen laporan sekaligus (cache per mahasiswa).
 * items: array objek { userId, laporanKe, judul, _judulAuto } -> judul diganti bila _judulAuto.
 */
async function isiJudulOtomatis(items) {
  const perlu = items.filter((it) => it && it._judulAuto);
  const userIds = [...new Set(perlu.map((it) => it.userId).filter(Boolean))];
  const peta = {};
  await Promise.all(userIds.map(async (uid) => { peta[uid] = await getNamaPerusahaanMagang(uid); }));
  perlu.forEach((it) => { it.judul = formatJudulLaporan(it.laporanKe, peta[it.userId] || ''); });
  return items;
}

/**
 * Lengkapi field publikasi ELK Library yang masih kosong (tidak menimpa yang sudah ada).
 * Mengembalikan objek siap di-update ke dokumen laporanMagang.
 */
async function lengkapiDataPublikasiLaporan(d, opsi = {}) {
  const perusahaan = await getNamaPerusahaanMagang(d.userId);
  const judul = d.judulPublik || d.judul || formatJudulLaporan(d.laporanKe, perusahaan);
  const tahunUnggah = d.uploadedAt ? new Date(d.uploadedAt).getFullYear() : new Date().getFullYear();
  const out = {};
  if (!d.judul) out.judul = judul;
  if (!d.judulPublik) out.judulPublik = judul;
  if (!d.abstrak) out.abstrak = (opsi.abstrak && String(opsi.abstrak).trim()) || buatAbstrakLaporan(d, perusahaan);
  if (!d.pembimbing) out.pembimbing = opsi.pembimbing || d.pembimbingNama || '';
  if (!d.tahun) out.tahun = tahunUnggah;
  return out;
}

/**
 * Pastikan setiap laporan milik SATU mahasiswa punya judul lengkap
 * "Laporan Magang {N} di {perusahaan}" untuk tampilan (dosen/admin). Mengubah list di tempat.
 * Judul tersimpan yang belum memuat perusahaan diperbarui bila perusahaan kini sudah diketahui.
 */
async function terapkanJudulLaporan(list, userId) {
  if (!Array.isArray(list) || list.length === 0) return list;
  const perusahaan = await getNamaPerusahaanMagang(userId || (list[0] && list[0].userId));
  list.forEach((l) => {
    const tanpaPerusahaan = formatJudulLaporan(l.laporanKe, '');
    if (!l.judul || (perusahaan && l.judul === tanpaPerusahaan)) {
      l.judul = formatJudulLaporan(l.laporanKe, perusahaan);
    }
  });
  return list;
}

module.exports = {
  getNamaPerusahaanMagang, formatJudulLaporan, buildJudulLaporan, namaFileDariJudul,
  buatAbstrakLaporan, isiJudulOtomatis, lengkapiDataPublikasiLaporan, terapkanJudulLaporan
};
