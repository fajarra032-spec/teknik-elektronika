/**
 * routes/admin/nilai.js
 * Rekap Nilai Seluruh Mata Kuliah (Admin)
 * Menampilkan daftar MK, lalu detail nilai per MK
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { saveGradeFinal, getTranskripMahasiswa, getPeriodeAktif, getHasilRubrikSemuaMahasiswa, getHasilRubrikSatuMahasiswa, getRincianTugasByMkId, saveKomponenRubrik, saveNilai, TIPE_RUBRIK_KOMPONEN } = require('../../helpers/nilaiHelper');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/**
 * Mendapatkan data mahasiswa dari UID
 */
async function getMahasiswaById(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      return { id: uid, ...userDoc.data() };
    }
    return { id: uid, nama: 'Unknown', nim: '-' };
  } catch (error) {
    console.error('Error getMahasiswaById:', error);
    return { id: uid, nama: 'Error', nim: '-' };
  }
}

// ============================================================================
// DAFTAR MATA KULIAH
// ============================================================================

/**
 * GET /admin/nilai
 * Menampilkan daftar semua mata kuliah
 */
/**
 * GET /admin/nilai
 * Daftar mata kuliah - pilih satu untuk lihat/edit rekap nilainya.
 */
router.get('/', async (req, res) => {
  try {
    const mkSnapshot = await db.collection('mataKuliah').orderBy('kode').get();
    const mkList = mkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/nilai_list', {
      title: 'Rekap Nilai',
      mkList
    });
  } catch (error) {
    console.error('Error mengambil MK:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data MK' });
  }
});

// ============================================================================
// INPUT NILAI AKHIR (FINAL) PER MAHASISWA -> koleksi 'grades'
// Sebelumnya view ini (nilai_form.ejs) sudah ada tapi tidak punya rute sama
// sekali, sehingga tidak bisa diakses dan koleksi 'grades' tidak pernah terisi.
// ============================================================================

/**
 * GET /admin/nilai/mahasiswa/:userId/tambah
 * Menampilkan form untuk menambah/mengubah nilai akhir seorang mahasiswa
 */
router.get('/mahasiswa/:userId/tambah', async (req, res) => {
  try {
    const mahasiswa = await getMahasiswaById(req.params.userId);

    const mkSnapshot = await db.collection('mataKuliah').orderBy('kode').get();
    const courses = mkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const { items, perSemester } = await getTranskripMahasiswa(req.params.userId);

    // Daftar semester untuk dropdown - gabungan semester yang sudah pernah
    // dipakai mahasiswa ini (dari KRS/enrollment/nilai) + periode aktif saat
    // ini (supaya tetap bisa input nilai untuk semester berjalan meski
    // belum ada histori sama sekali). Ini menggantikan input teks bebas
    // yang sebelumnya rawan typo (bikin data nilai "nyasar" karena string
    // semester tidak persis sama dengan yang dipakai KRS/enrollment).
    const semesterSet = new Set(perSemester.map(s => s.semester));
    semesterSet.add(getPeriodeAktif());
    const semesterOptions = Array.from(semesterSet).sort();

    res.render('admin/nilai_form', {
      title: `Input Nilai - ${mahasiswa.nama || mahasiswa.id}`,
      mahasiswa,
      courses,
      grades: items,
      semesterOptions,
      success: req.query.success
    });
  } catch (error) {
    console.error('Error menampilkan form nilai:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat form input nilai' });
  }
});

/**
 * POST /admin/nilai
 * Menyimpan (atau memperbarui, kalau kombinasi mahasiswa+kodeMk+semester
 * sudah ada) nilai akhir mahasiswa ke koleksi 'grades'.
 */
router.post('/', async (req, res) => {
  const { userId, kodeMk, namaMk, sks, nilai, semester } = req.body;
  try {
    const { isNew } = await saveGradeFinal({ userId, kodeMk, namaMk, sks, nilai, semester });
    res.redirect(`/admin/nilai/mahasiswa/${userId}/tambah?success=${isNew ? 'ditambahkan' : 'diperbarui'}`);
  } catch (error) {
    console.error('Error menyimpan nilai akhir:', error);
    const mahasiswa = await getMahasiswaById(userId);
    const mkSnapshot = await db.collection('mataKuliah').orderBy('kode').get();
    const courses = mkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const { items, perSemester } = await getTranskripMahasiswa(userId);
    const semesterSet = new Set(perSemester.map(s => s.semester));
    semesterSet.add(getPeriodeAktif());
    res.status(400).render('admin/nilai_form', {
      title: `Input Nilai - ${mahasiswa.nama || mahasiswa.id}`,
      mahasiswa,
      courses,
      grades: items,
      semesterOptions: Array.from(semesterSet).sort(),
      error: error.message
    });
  }
});

// ============================================================================
// DETAIL NILAI PER MATA KULIAH - bisa diedit langsung dari sini.
// Nilai Akhir dihitung pakai rumus RESMI yang sama dengan Rubrik Penilaian
// (getHasilRubrikSemuaMahasiswa -> hitungRubrik, bobot bisa diatur per
// prodi), BUKAN rumus 40/30/30 tetap yang lama - supaya "Nilai Akhir" yang
// tampil di sini selalu sama persis dengan yang tampil di Rubrik, dan
// mengedit nilai di sini otomatis nyambung ke perhitungan Rubrik juga
// (keduanya baca/tulis koleksi 'nilai' yang sama).
// ============================================================================

/**
 * GET /admin/nilai/:mkId
 * Menampilkan grid nilai (kehadiran/sikap/keaktifan/kuis/UTS/UAS/tugas)
 * semua mahasiswa di MK ini, siap diedit inline.
 */
router.get('/:mkId', async (req, res) => {
  try {
    const mkId = req.params.mkId;
    const periode = req.query.periode || getPeriodeAktif();
    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    if (!mkDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    }
    const mk = { id: mkId, ...mkDoc.data() };

    // Mahasiswa yang terdaftar aktif (KRS disetujui) untuk MK+periode ini
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkId)
      .where('semester', '==', periode)
      .where('status', '==', 'active')
      .get();
    const mahasiswaIds = enrollmentSnapshot.docs.map(d => d.data().userId);

    const [{ komponenMap, hasilMap }, { tugasList, perMahasiswa: tugasPerMahasiswa }, mahasiswaArr] = await Promise.all([
      getHasilRubrikSemuaMahasiswa(mkId, periode),
      getRincianTugasByMkId(mkId, periode),
      Promise.all(mahasiswaIds.map(uid => getMahasiswaById(uid)))
    ]);

    const mahasiswaList = mahasiswaIds.map((uid, i) => ({
      mahasiswaId: uid,
      mahasiswa: mahasiswaArr[i],
      komponen: komponenMap[uid] || {},
      tugas: tugasPerMahasiswa[uid] || {},
      hasil: hasilMap[uid] || { nilaiAkhir: null, huruf: null }
    })).sort((a, b) => (a.mahasiswa.nim || '').localeCompare(b.mahasiswa.nim || ''));

    res.render('admin/nilai_detail', {
      title: `Rekap Nilai - ${mk.kode} ${mk.nama} (${periode})`,
      mk,
      mahasiswaList,
      tugasList,
      tipeKomponen: TIPE_RUBRIK_KOMPONEN,
      periode
    });
  } catch (error) {
    console.error('Error detail nilai:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail nilai: ' + error.message });
  }
});

/**
 * POST /admin/nilai/:mkId/set
 * Menyimpan SATU nilai komponen (kehadiran/sikap/keaktifan/kuis/UTS/UAS)
 * atau satu nilai tugas, dipanggil lewat AJAX tiap kali admin selesai
 * mengedit satu kotak (auto-save, sama seperti pola di halaman Rubrik).
 * Body: { mahasiswaId, tipe, nilai, periode, judulTugas? }
 * `tipe` = salah satu TIPE_RUBRIK_KOMPONEN (komponen rubrik), ATAU
 * `tugas_<tugasId>` (nilai tugas individual).
 */
router.post('/:mkId/set', async (req, res) => {
  try {
    const mkId = req.params.mkId;
    const { mahasiswaId, tipe, nilai, periode, judulTugas } = req.body;
    if (!mahasiswaId || !tipe || nilai === undefined || nilai === '') {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }
    const p = periode || getPeriodeAktif();

    if (TIPE_RUBRIK_KOMPONEN.includes(tipe)) {
      await saveKomponenRubrik(mahasiswaId, mkId, tipe, nilai, p);
    } else if (tipe.startsWith('tugas_')) {
      const tugasId = tipe.replace('tugas_', '');
      await saveNilai(mahasiswaId, mkId, tugasId, judulTugas || 'Tugas', nilai, p);
    } else {
      return res.status(400).json({ success: false, message: 'Tipe nilai tidak dikenali' });
    }

    const hasil = await getHasilRubrikSatuMahasiswa(mahasiswaId, mkId, p);
    res.json({ success: true, hasil });
  } catch (error) {
    console.error('Error menyimpan nilai (grid admin):', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;