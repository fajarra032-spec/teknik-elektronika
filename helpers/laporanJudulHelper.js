// helpers/laporanJudulHelper.js
// Judul laporan magang dibuat OTOMATIS: "Laporan Magang {ke} di {nama perusahaan}"
// contoh: "Laporan Magang 1 di PT PLN". Perusahaan diambil dari periode magang
// mahasiswa (periode aktif/terbaru yang punya nama perusahaan).

const { getMagangPeriodsByMahasiswa } = require('../models/magangPeriodModel');
const { getNamaPerusahaanUntukNomor } = require('./laporanPdkHelper');

const POLA_JUDUL_OTOMATIS = /^Laporan Magang \d+( di .+)?$/;

/**
 * Nama perusahaan untuk judul laporan.
 * - Dengan laporanKe (1/2/3): perusahaan milik periode Magang N saja ('' bila
 *   periode itu belum ada) - TIDAK lagi jatuh ke periode terbaru, supaya
 *   Laporan 1 tidak berjudul dengan perusahaan Magang 2/3.
 * - Tanpa laporanKe: perilaku lama (periode terbaru), untuk pemakaian umum.
 */
async function getNamaPerusahaanMagang(userId, laporanKe) {
  if (laporanKe !== undefined && laporanKe !== null && laporanKe !== '') {
    try {
      return await getNamaPerusahaanUntukNomor(userId, parseInt(laporanKe, 10));
    } catch (err) {
      console.error('Error getNamaPerusahaanMagang (per nomor):', err);
      return '';
    }
  }
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
  return formatJudulLaporan(laporanKe, await getNamaPerusahaanMagang(userId, laporanKe));
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
  const kunci = [...new Set(perlu.filter((it) => it.userId).map((it) => `${it.userId}|${it.laporanKe}`))];
  const peta = {};
  await Promise.all(kunci.map(async (k) => {
    const [uid, ke] = k.split('|');
    peta[k] = await getNamaPerusahaanMagang(uid, ke);
  }));
  perlu.forEach((it) => { it.judul = formatJudulLaporan(it.laporanKe, peta[`${it.userId}|${it.laporanKe}`] || ''); });
  return items;
}

/**
 * Lengkapi field publikasi ELK Library yang masih kosong (tidak menimpa yang sudah ada).
 * Mengembalikan objek siap di-update ke dokumen laporanMagang.
 */
async function lengkapiDataPublikasiLaporan(d, opsi = {}) {
  const perusahaan = await getNamaPerusahaanMagang(d.userId, d.laporanKe);
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
  const uid = userId || (list[0] && list[0].userId);
  const nomor = [...new Set(list.map((l) => l.laporanKe))];
  const peta = {};
  await Promise.all(nomor.map(async (ke) => { peta[ke] = await getNamaPerusahaanMagang(uid, ke); }));
  list.forEach((l) => {
    const perusahaan = peta[l.laporanKe] || '';
    // Judul otomatis (pola "Laporan Magang N [di X]") selalu disamakan dengan
    // perusahaan periode Magang N; judul yang diedit manual tidak disentuh.
    if (!l.judul || (perusahaan && POLA_JUDUL_OTOMATIS.test(l.judul))) {
      l.judul = formatJudulLaporan(l.laporanKe, perusahaan);
    }
  });
  return list;
}

module.exports = {
  getNamaPerusahaanMagang, formatJudulLaporan, buildJudulLaporan, namaFileDariJudul,
  buatAbstrakLaporan, isiJudulOtomatis, lengkapiDataPublikasiLaporan, terapkanJudulLaporan
};
