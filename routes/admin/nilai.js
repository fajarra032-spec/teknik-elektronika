/**
 * routes/admin/nilai.js
 * Rekap Nilai Seluruh Mata Kuliah (Admin)
 * Menampilkan daftar MK, lalu detail nilai per MK
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { hitungNilaiAkhir, saveGradeFinal, getTranskripMahasiswa, getPeriodeAktif } = require('../../helpers/nilaiHelper');

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
// DETAIL NILAI PER MATA KULIAH
// ============================================================================

/**
 * GET /admin/nilai/:mkId
 * Menampilkan daftar mahasiswa beserta nilai tugas, UTS, UAS, dan nilai akhir
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

    // Ambil semua mahasiswa yang terdaftar di MK ini pada periode yang dipilih
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkId)
      .where('semester', '==', periode)
      .where('status', '==', 'active')
      .get();

    const mahasiswaIds = enrollmentSnapshot.docs.map(d => d.data().userId);
    const mahasiswaList = [];

    for (const uid of mahasiswaIds) {
      const mahasiswa = await getMahasiswaById(uid);
      // Jalur murah: query terfilter periode. Kalau kosong, kemungkinan data
      // lama belum ditandai - ambil semua & tandai otomatis (self-heal).
      let nilaiSnapshot = await db.collection('nilai')
        .where('mkId', '==', mkId)
        .where('mahasiswaId', '==', uid)
        .where('periode', '==', periode)
        .get();

      if (nilaiSnapshot.empty) {
        const semuaSnapshot = await db.collection('nilai')
          .where('mkId', '==', mkId)
          .where('mahasiswaId', '==', uid)
          .get();
        const perluDitandai = semuaSnapshot.docs.filter(doc => !doc.data().periode);
        if (perluDitandai.length > 0) {
          await Promise.all(perluDitandai.map(doc => doc.ref.update({ periode }).catch(() => {})));
        }
        nilaiSnapshot = semuaSnapshot;
      }

      const nilaiMap = {};
      nilaiSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if ((data.periode || periode) !== periode) return;
        nilaiMap[data.tipe] = data.nilai;
      });

      // Hitung nilai akhir
      const nilaiAkhir = hitungNilaiAkhir(nilaiMap);

      mahasiswaList.push({
        mahasiswa,
        nilai: nilaiMap,
        nilaiAkhir
      });
    }

    // Urutkan berdasarkan NIM
    mahasiswaList.sort((a, b) => a.mahasiswa.nim.localeCompare(b.mahasiswa.nim));

    // Kumpulkan semua tipe nilai yang ada (untuk header tabel)
    const tipeSet = new Set();
    mahasiswaList.forEach(item => {
      Object.keys(item.nilai).forEach(tipe => tipeSet.add(tipe));
    });
    const tipeList = Array.from(tipeSet).sort();

    res.render('admin/nilai_detail', {
      title: `Rekap Nilai - ${mk.kode} ${mk.nama} (${periode})`,
      mk,
      mahasiswaList,
      tipeList,
      periode
    });
  } catch (error) {
    console.error('Error detail nilai:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail nilai' });
  }
});

module.exports = router;