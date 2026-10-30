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

const { getAllMahasiswa, enrollmentCountCache } = require('./cache');

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

/**
 * Jumlah mahasiswa AKTIF (status enrollment 'active', tanpa Cuti/Keluar) pada
 * satu mata kuliah. Dipakai di halaman daftar MK dosen/admin.
 *
 * Hemat kuota: hasil di-cache 5 menit (dibersihkan saat admin menulis), dan
 * kalau tidak ada mahasiswa Cuti/Keluar cukup count() = ~1 read. Dulu semua
 * dokumen enrollment dibaca untuk setiap MK di setiap kunjungan halaman.
 * @param {string} mkId
 * @param {string|null} semester - null = tanpa filter semester
 */
async function getJumlahMahasiswaAktifMk(db, mkId, semester) {
  const key = `${mkId}|${semester || '*'}`;
  return enrollmentCountCache.getOrFetch(key, async () => {
    let q = db.collection('enrollment').where('mkId', '==', mkId);
    if (semester) q = q.where('semester', '==', semester);
    q = q.where('status', '==', 'active');

    const tidakIkut = await getIdTidakIkut(db);
    if (tidakIkut.size === 0) {
      return (await q.count().get()).data().count;
    }
    const snap = await q.get();
    return snap.docs.filter(d => !tidakIkut.has(d.data().userId)).length;
  });
}

module.exports = {
  getJumlahMahasiswaAktifMk,
  STATUS_DIKECUALIKAN,
  isTidakIkutKegiatan,
  getIdTidakIkut,
  isIdTidakIkut,
  filterIdMahasiswaAktif,
  filterEnrollmentDocsAktif
};
