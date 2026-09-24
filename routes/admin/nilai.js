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
const { getAllMataKuliah } = require('../../helpers/cache');
const { getAngkatanFromNim } = require('../../helpers/academicHelper');

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
    const mkList = await getAllMataKuliah(db);
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

    const courses = await getAllMataKuliah(db);

    const { items, perSemester, ipk, totalSKS } = await getTranskripMahasiswa(req.params.userId);

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
      semesterCetak: perSemester.map(s => s.semester),
      ipk,
      totalSKS,
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
    const courses = await getAllMataKuliah(db);
    const { items, perSemester, ipk, totalSKS } = await getTranskripMahasiswa(userId);
    const semesterSet = new Set(perSemester.map(s => s.semester));
    semesterSet.add(getPeriodeAktif());
    res.status(400).render('admin/nilai_form', {
      title: `Input Nilai - ${mahasiswa.nama || mahasiswa.id}`,
      mahasiswa,
      courses,
      grades: items,
      semesterOptions: Array.from(semesterSet).sort(),
      semesterCetak: perSemester.map(s => s.semester),
      ipk,
      totalSKS,
      error: error.message
    });
  }
});

// ============================================================================
// CETAK TRANSKRIP & KHS PER MAHASISWA (dibuka dari halaman Input Nilai)
// Memakai ulang view cetak mahasiswa (views/mahasiswa/transkrip_print.ejs &
// views/mahasiswa/khs_detail.ejs) - bedanya cuma `user` diisi data mahasiswa
// yang dipilih admin (bukan req.user) dan tombol "Kembali" diarahkan lagi
// ke halaman Input Nilai lewat `backUrl`. Data tetap dari
// getTranskripMahasiswa() yang sama dengan yang dipakai sisi mahasiswa,
// jadi angka di dokumen cetak admin pasti identik dengan yang dilihat mahasiswa.
// Rute ini didaftarkan SEBELUM '/:mkId' supaya tidak tertelan rute itu.
// ============================================================================

/**
 * Ambil data mahasiswa untuk dokumen cetak. null kalau tidak ada.
 */
async function getMahasiswaUntukCetak(userId) {
  const doc = await db.collection('users').doc(userId).get();
  return doc.exists ? { id: userId, ...doc.data() } : null;
}

/**
 * GET /admin/nilai/mahasiswa/:userId/transkrip/cetak?semester=...
 * Transkrip kumulatif dari semester 1 s.d. semester yang dipilih
 * (default: semester terbaru yang punya data).
 */
router.get('/mahasiswa/:userId/transkrip/cetak', async (req, res) => {
  try {
    const { userId } = req.params;
    const mahasiswa = await getMahasiswaUntukCetak(userId);
    if (!mahasiswa) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mahasiswa tidak ditemukan' });
    }

    const { perSemester, items, ipk: ipkTotal, totalSKS: totalSKSTotal } = await getTranskripMahasiswa(userId);
    const semesterList = perSemester.map(s => s.semester);
    const semesterDipilih = (req.query.semester && semesterList.includes(req.query.semester))
      ? req.query.semester
      : (semesterList.length > 0 ? semesterList[semesterList.length - 1] : null);

    let grades = items;
    let ipk = ipkTotal;
    let totalSKS = totalSKSTotal;
    let totalSksIndeks = perSemester.reduce((sum, s) => sum + (s.totalSksIndeks || 0), 0);

    if (semesterDipilih) {
      const idx = semesterList.indexOf(semesterDipilih);
      const sampaiSemesterIni = perSemester.slice(0, idx + 1);
      grades = sampaiSemesterIni.flatMap(s => s.matkul);
      let sksKum = 0, bobotKum = 0;
      sampaiSemesterIni.forEach(s => { sksKum += s.totalSKS; bobotKum += s.totalSksIndeks; });
      totalSKS = sksKum;
      totalSksIndeks = bobotKum;
      ipk = sksKum > 0 ? (bobotKum / sksKum).toFixed(2) : '0.00';
    }

    res.render('mahasiswa/transkrip_print', {
      title: `Transkrip - ${mahasiswa.nama || mahasiswa.id}`,
      user: mahasiswa,
      angkatan: getAngkatanFromNim(mahasiswa.nim),
      grades, ipk, totalSKS, totalSksIndeks,
      semesterList, semesterDipilih,
      backUrl: `/admin/nilai/mahasiswa/${encodeURIComponent(userId)}/tambah`
    });
  } catch (error) {
    console.error('Error cetak transkrip (admin):', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat transkrip: ' + error.message });
  }
});

/**
 * GET /admin/nilai/mahasiswa/:userId/khs/cetak?semester=...
 * KHS satu semester (default: semester terbaru yang punya data).
 * Label semester dikirim lewat query string (bukan segmen path) karena
 * mengandung spasi & slash, mis. "Ganjil 2025/2026".
 */
router.get('/mahasiswa/:userId/khs/cetak', async (req, res) => {
  try {
    const { userId } = req.params;
    const mahasiswa = await getMahasiswaUntukCetak(userId);
    if (!mahasiswa) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mahasiswa tidak ditemukan' });
    }

    const { perSemester, ipk, totalSKS } = await getTranskripMahasiswa(userId);
    if (perSemester.length === 0) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: `Belum ada data nilai untuk ${mahasiswa.nama || 'mahasiswa ini'}, KHS belum bisa dicetak`
      });
    }

    const semesterLabel = req.query.semester || perSemester[perSemester.length - 1].semester;
    const idx = perSemester.findIndex(s => s.semester === semesterLabel);
    if (idx === -1) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: `Belum ada data nilai untuk ${mahasiswa.nama || 'mahasiswa ini'} pada semester "${semesterLabel}"`
      });
    }
    const khs = perSemester[idx];

    // SKS & IPK kumulatif "s.d. semester ini"
    let sksKum = 0, bobotKum = 0;
    perSemester.slice(0, idx + 1).forEach(s => { sksKum += s.totalSKS; bobotKum += s.totalSksIndeks; });
    const ipkSampaiSemesterIni = sksKum > 0 ? (bobotKum / sksKum).toFixed(2) : '0.00';

    res.render('mahasiswa/khs_detail', {
      title: `KHS - ${mahasiswa.nama || mahasiswa.id} - ${semesterLabel}`,
      user: mahasiswa,
      khs,
      ipkSampaiSemesterIni,
      sksKumulatif: sksKum,
      ipkAkhir: ipk,
      totalSKSAkhir: totalSKS,
      backUrl: `/admin/nilai/mahasiswa/${encodeURIComponent(userId)}/tambah`
    });
  } catch (error) {
    console.error('Error cetak KHS (admin):', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat KHS: ' + error.message });
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

    // Semua periode yang PERNAH punya enrollment untuk MK ini (termasuk
    // periode histori, mis. dari input nilai lama lewat script) - dipakai
    // untuk dropdown pemilih periode, supaya admin tidak perlu menebak-nebak
    // atau mengedit URL manual untuk melihat data semester yang sudah lewat.
    const semuaEnrollmentMkSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkId)
      .where('status', '==', 'active')
      .get();
    const periodeSet = new Set(semuaEnrollmentMkSnapshot.docs.map(d => d.data().semester).filter(Boolean));
    periodeSet.add(getPeriodeAktif()); // selalu sertakan periode aktif sekarang walau belum ada enrollment-nya
    periodeSet.add(periode); // jaga-jaga kalau periode dari URL belum ada di enrollment manapun
    const periodeOptions = Array.from(periodeSet).sort().reverse();

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
      periode,
      periodeOptions
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