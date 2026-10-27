// helpers/kartuKontrolMagangHelper.js
// ============================================================================
// DATA CETAK KARTU KONTROL KONSULTASI/BIMBINGAN MAGANG + LEMBAR ISIAN HASIL
// KONSULTASI/BIMBINGAN MAGANG (format resmi Politeknik Dewantara).
//
// Sumber data = koleksi `konsultasiPa` (Lembar Konsultasi PA, lihat
// helpers/konsultasiPaHelper.js) HANYA yang berkategori 'Magang'. Jadi Dosen PA
// mencatat bimbingan magang di menu Konsultasi seperti biasa (pilih kategori
// Magang); tidak ada input data baru. Hak akses TIDAK dicek di sini.
//   Kartu Kontrol : No | Hari/Tanggal | Agenda/Kegiatan (= topik) | Paraf
//   Lembar Isian  : satu pertemuan: Hari/Tanggal, Agenda, Hasil (= uraian + saran)
// ============================================================================

const { db } = require('../config/firebaseAdmin');
const { getKonsultasiMahasiswa } = require('./konsultasiPaHelper');
const { getPembimbingMahasiswa } = require('./pembimbingHelper');
const { getMagangPeriodById, getMagangPeriodsByMahasiswa } = require('../models/magangPeriodModel');
const { extractTahunAjaran } = require('./logbookPrintHelper');

const KATEGORI_MAGANG = 'Magang';

function hariTanggal(t) {
  if (!t) return '';
  const d = new Date(t + 'T00:00:00');
  return isNaN(d) ? t : d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * @param {string} mahasiswaId
 * @param {string} [periodId]
 * @param {string|null} [kid] id konsultasi -> lembar isian satu pertemuan
 * @param {string} [lembarBase] awalan URL tautan "Lembar" tiap baris (kid ditempel di belakangnya)
 * @returns {Promise<Object|null>} null kalau mahasiswa/konsultasi tidak ditemukan
 */
async function buildKartuKontrolData(mahasiswaId, periodId, kid, lembarBase) {
  const doc = await db.collection('users').doc(mahasiswaId).get();
  if (!doc.exists) return null;
  const mahasiswa = { id: doc.id, ...doc.data() };

  let period = null;
  if (periodId) {
    const p = await getMagangPeriodById(periodId);
    if (p && p.mahasiswaId === mahasiswaId) period = p;
  } else {
    const semua = await getMagangPeriodsByMahasiswa(mahasiswaId).catch(() => []);
    if (semua.length > 0) period = semua[0];
  }

  const [semuaKonsultasi, dosenPa] = await Promise.all([
    getKonsultasiMahasiswa(mahasiswaId),
    getPembimbingMahasiswa(mahasiswa.dosenPaId ? mahasiswa : mahasiswaId)
  ]);
  let daftar = semuaKonsultasi.filter(k => k.kategori === KATEGORI_MAGANG);

  // Batasi ke rentang periode magang bila tanggalnya terisi (konsultasi lain di luar periode tidak ikut)
  if (period && period.tanggalMulai) {
    const awal = String(period.tanggalMulai).slice(0, 10);
    const akhir = period.tanggalSelesai ? String(period.tanggalSelesai).slice(0, 10) : '9999-12-31';
    const dalam = daftar.filter(k => k.tanggal >= awal && k.tanggal <= akhir);
    if (dalam.length > 0) daftar = dalam;
  }

  const semesterLabel = (period && period.semester) || mahasiswa.semester || '';
  const base = {
    mahasiswa,
    prodi: 'Teknik Elektronika',
    dosenPa,
    tahunAkademik: semesterLabel ? extractTahunAjaran(String(semesterLabel)) : '',
    generatedAt: new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
  };

  if (kid) {
    const k = semuaKonsultasi.find(x => x.id === kid); // hanya milik mahasiswa ini (query by mahasiswaId)
    if (!k) return null;
    return {
      ...base,
      title: `Lembar Konsultasi Magang - ${mahasiswa.nama || ''}`,
      hariTanggal: hariTanggal(k.tanggal),
      agenda: k.topik || '',
      hasil: [k.uraian, k.saran ? 'Saran / tindak lanjut:\n' + k.saran : ''].filter(Boolean).join('\n\n')
    };
  }

  return {
    ...base,
    title: `Kartu Kontrol Bimbingan Magang - ${mahasiswa.nama || ''}`,
    lembarBase: lembarBase || '',
    daftar: daftar.map(k => ({ id: k.id, hariTanggal: hariTanggal(k.tanggal), agenda: k.topik || '' }))
  };
}

module.exports = { buildKartuKontrolData, KATEGORI_MAGANG };
