// helpers/konsultasiPaHelper.js
// ============================================================================
// LEMBAR KONSULTASI BIMBINGAN AKADEMIK (DOSEN PA <-> MAHASISWA)
//
// Dosen PA mencatat tiap pertemuan konsultasi dengan mahasiswa bimbingannya.
// Mahasiswa melihat & mencetak lembarnya (read-only). Cetak dosen dan mahasiswa
// memakai template yang sama: views/konsultasi_pa_print.ejs.
//
// Koleksi `konsultasiPa`, satu dokumen per pertemuan:
//   { mahasiswaId, dosenId, dosenNama, tanggal ('YYYY-MM-DD'), kategori, topik,
//     uraian, saran, semester (label periode saat dicatat), createdAt, updatedAt }
// Query hanya memakai SATU filter (mahasiswaId) lalu diurutkan di kode, jadi
// TIDAK butuh composite index baru di Firestore.
// ============================================================================

const { db } = require('../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('./academicHelper');
const { getPembimbingMahasiswa } = require('./pembimbingHelper');

const COLLECTION = 'konsultasiPa';

const KATEGORI = [
  'KRS / Rencana Studi',
  'Nilai & Prestasi',
  'Kehadiran & Disiplin',
  'Magang',
  'Kendala Pribadi / Keluarga',
  'Beasiswa & Biaya Kuliah',
  'Lainnya'
];

const BATAS = { topik: 150, uraian: 2000, saran: 2000 };

/** Daftar konsultasi satu mahasiswa, urut tanggal LAMA -> BARU. */
async function getKonsultasiMahasiswa(mahasiswaId) {
  const snap = await db.collection(COLLECTION).where('mahasiswaId', '==', mahasiswaId).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const c = String(a.tanggal || '').localeCompare(String(b.tanggal || ''));
      return c !== 0 ? c : String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
}

/** Validasi & bersihkan input form. Mengembalikan { data } atau { error }. */
function bersihkanInput(body) {
  const tanggal = String(body.tanggal || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || Number.isNaN(new Date(tanggal + 'T00:00:00').getTime())) {
    return { error: 'Tanggal konsultasi tidak valid.' };
  }
  const kategori = KATEGORI.includes(body.kategori) ? body.kategori : 'Lainnya';
  const topik = String(body.topik || '').trim().slice(0, BATAS.topik);
  const uraian = String(body.uraian || '').trim().slice(0, BATAS.uraian);
  const saran = String(body.saran || '').trim().slice(0, BATAS.saran);
  if (!topik) return { error: 'Topik konsultasi wajib diisi.' };
  if (!uraian) return { error: 'Uraian pembahasan wajib diisi.' };
  return { data: { tanggal, kategori, topik, uraian, saran } };
}

/** Semester/periode akademik berjalan sebagai label (untuk dicatat di dokumen). */
function labelSemesterBerjalan() {
  try { return getCurrentAcademicSemester().label || ''; } catch (e) { return ''; }
}

/**
 * Data untuk views/konsultasi_pa_print.ejs. Hak akses TIDAK dicek di sini -
 * pemanggil (rute) wajib memastikannya.
 * @returns {Promise<Object|null>} null kalau mahasiswa tidak ditemukan
 */
async function buildPrintData(mahasiswaId) {
  const doc = await db.collection('users').doc(mahasiswaId).get();
  if (!doc.exists) return null;
  const mahasiswa = { id: doc.id, ...doc.data() };
  const [daftar, dosenPa] = await Promise.all([
    getKonsultasiMahasiswa(mahasiswaId),
    getPembimbingMahasiswa(mahasiswa)
  ]);
  return {
    title: `Lembar Konsultasi - ${mahasiswa.nama || ''}`,
    mahasiswa,
    dosenPa,
    daftar,
    prodi: 'Teknik Elektronika',
    semesterBerjalan: labelSemesterBerjalan(),
    generatedAt: new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
  };
}

module.exports = {
  COLLECTION,
  KATEGORI,
  BATAS,
  getKonsultasiMahasiswa,
  bersihkanInput,
  labelSemesterBerjalan,
  buildPrintData
};
