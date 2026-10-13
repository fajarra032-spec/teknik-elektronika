// helpers/statusMahasiswaHelper.js
// ============================================================================
// MAHASISWA CUTI / KELUAR TIDAK DIIKUTKAN DI KEGIATAN AKADEMIK
//
// Mahasiswa berstatus "Cuti" atau "Keluar" (users.statusMahasiswa) TIDAK
// ditampilkan di:
//   - daftar peserta kelas E-Learning (roster, nilai, rubrik, tugas, chat kelas)
//   - daftar/monitoring Magang (admin e-magang, PDK mahasiswa)
//   - halaman cetak (mis. SK PA, daftar mahasiswa)
//
// Pendekatan: FILTER SAAT MEMBACA, data enrollment/nilai/logbook TIDAK diubah
// atau dihapus. Jadi kalau statusnya dikembalikan ke "Aktif" mahasiswa itu
// langsung muncul lagi, dan riwayat nilainya aman.
// Status "Lulus" sengaja TIDAK dikecualikan di sini (riwayat tetap tampil).
//
// Pembacaan status memakai cache getAllMahasiswa() (helpers/cache.js, 10 menit,
// otomatis dibersihkan saat admin mengubah data mahasiswa) -> 0 read tambahan
// di Firestore.
// ============================================================================

const { getAllMahasiswa } = require('./cache');

const STATUS_DIKECUALIKAN = ['Cuti', 'Keluar'];

function _norm(s) {
  return String(s || '').trim().toLowerCase();
}

/** true kalau dokumen/objek mahasiswa berstatus Cuti atau Keluar. */
function isTidakIkutKegiatan(mahasiswa) {
  if (!mahasiswa) return false;
  return STATUS_DIKECUALIKAN.some(s => _norm(s) === _norm(mahasiswa.statusMahasiswa));
}

/** Set berisi ID semua mahasiswa Cuti/Keluar (dari cache). */
async function getIdTidakIkut(db) {
  const semua = await getAllMahasiswa(db);
  const set = new Set();
  semua.forEach(m => { if (isTidakIkutKegiatan(m)) set.add(m.id); });
  return set;
}

/** Cek satu mahasiswa berdasarkan ID. */
async function isIdTidakIkut(db, mahasiswaId) {
  const set = await getIdTidakIkut(db);
  return set.has(mahasiswaId);
}

/** Buang ID mahasiswa Cuti/Keluar dari array ID. */
async function filterIdMahasiswaAktif(db, ids) {
  const arr = Array.isArray(ids) ? ids : [];
  if (arr.length === 0) return arr;
  const set = await getIdTidakIkut(db);
  if (set.size === 0) return arr;
  return arr.filter(id => !set.has(id));
}

/** Buang dokumen enrollment milik mahasiswa Cuti/Keluar (doc.data().userId). */
async function filterEnrollmentDocsAktif(db, docs) {
  const arr = Array.isArray(docs) ? docs : [];
  if (arr.length === 0) return arr;
  const set = await getIdTidakIkut(db);
  if (set.size === 0) return arr;
  return arr.filter(d => !set.has(d.data().userId));
}

module.exports = {
  STATUS_DIKECUALIKAN,
  isTidakIkutKegiatan,
  getIdTidakIkut,
  isIdTidakIkut,
  filterIdMahasiswaAktif,
  filterEnrollmentDocsAktif
};
