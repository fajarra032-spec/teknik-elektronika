/**
 * routes/mahasiswa/akademik.js
 * Modul Akademik Mahasiswa: KRS, KHS, Transkrip, Kalender Akademik
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const {
  getCurrentAcademicSemester,
  getAngkatanFromNim,
  getStudentCurrentSemester
} = require('../../helpers/academicHelper');
const { getTranskripMahasiswa } = require('../../helpers/nilaiHelper');

// Semua route memerlukan autentikasi
router.use(verifyToken);

// ============================================================================
// FUNGSI BANTU (HELPER)
// ============================================================================

/**
 * Mendapatkan data mahasiswa dari req.user (sudah diisi verifyToken)
 */
function getMahasiswa(user) {
  return {
    nim: user.nim,
    nama: user.nama,
    prodi: 'Teknik Elektronika',
    angkatan: user.nim && user.nim.length >= 2 ? '20' + user.nim.substring(0, 2) : '-'
  };
}

/**
 * Menentukan folder angkatan di Google Drive
 */
async function getOrCreateFolder(parentId, namaFolder) {
  const query = await drive.files.list({
    q: `'${parentId}' in parents and name='${namaFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) {
    return query.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      resource: { name: namaFolder, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    });
    return folder.data.id;
  }
}

// ============================================================================
// HALAMAN UTAMA AKADEMIK
// ============================================================================

/**
 * GET /mahasiswa/akademik
 * Menampilkan ringkasan akademik mahasiswa (menu navigasi)
 */
router.get('/', async (req, res) => {
  try {
    res.render('mahasiswa/akademik', { title: 'Akademik', user: req.user });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat halaman akademik' });
  }
});

// ============================================================================
// KARTU RENCANA STUDI (KRS)
// ============================================================================

/**
 * GET /mahasiswa/akademik/krs
 * Daftar KRS yang pernah dibuat
 */
router.get('/krs', async (req, res) => {
  try {
    const snapshot = await db.collection('krs')
      .where('userId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();

    // ✅ OPTIMISASI KUOTA: sebelumnya fetch mataKuliah dilakukan SATU PER
    // SATU dalam loop bersarang (per KRS x per mkId, serial) - sekarang
    // kumpulkan dulu semua mkId unik yang dibutuhkan (maks 3 per KRS, sama
    // seperti perilaku asli), ambil sekaligus lewat db.getAll().
    const krsDataList = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    const mkIdSet = new Set();
    krsDataList.forEach(({ data }) => {
      (data.mataKuliah || []).slice(0, 3).forEach(mkId => { if (mkId) mkIdSet.add(mkId); });
    });
    const mkIdArr = Array.from(mkIdSet);
    const mkDataMap = new Map();
    if (mkIdArr.length > 0) {
      const mkDocs = await db.getAll(...mkIdArr.map(id => db.collection('mataKuliah').doc(id)));
      mkDocs.forEach((mkDoc, i) => { if (mkDoc.exists) mkDataMap.set(mkIdArr[i], mkDoc.data()); });
    }

    const krsList = krsDataList.map(({ id, data }) => {
      const mkIds = data.mataKuliah || [];
      const courses = mkIds.slice(0, 3)
        .filter(mkId => mkId && mkDataMap.has(mkId))
        .map(mkId => {
          const mk = mkDataMap.get(mkId);
          return { kode: mk.kode, nama: mk.nama, sks: mk.sks };
        });
      return { id, ...data, courses, courseCount: mkIds.length };
    });

    res.render('mahasiswa/krs_list', {
      title: 'Daftar KRS',
      user: req.user,
      krsList
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat KRS' });
  }
});

/**
 * GET /mahasiswa/akademik/krs/baru
 * Form buat KRS baru (pilih mata kuliah) dengan semester otomatis
 */
router.get('/krs/baru', async (req, res) => {
  try {
    const angkatan = getAngkatanFromNim(req.user.nim);
    if (!angkatan) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'NIM tidak valid untuk menentukan angkatan'
      });
    }
    const currentSemesterNumber = getStudentCurrentSemester(angkatan);
    const academicLabel = getCurrentAcademicSemester().label;

    const coursesSnapshot = await db.collection('mataKuliah').orderBy('kode').get();
    const courses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Tandai mata kuliah yang direkomendasikan (sesuai semester saat ini)
    courses.forEach(c => {
      c.isRecommended = (c.semester === currentSemesterNumber);
    });

    res.render('mahasiswa/krs_form', {
      user: req.user,
      courses,
      currentSemester: currentSemesterNumber,
      academicLabel
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data mata kuliah' });
  }
});

/**
 * POST /mahasiswa/akademik/krs
 * Simpan KRS baru atau gabungkan dengan KRS pending yang sudah ada
 */
router.post('/krs', async (req, res) => {
  try {
    const { courses } = req.body; // string JSON dari array ID
    if (!courses) {
      return res.status(400).render('error', { title: 'Error', message: 'Mata kuliah harus dipilih' });
    }

    const mkIds = JSON.parse(courses);
    if (!Array.isArray(mkIds) || mkIds.length === 0) {
      return res.status(400).render('error', { title: 'Error', message: 'Pilih minimal satu mata kuliah' });
    }

    const angkatan = getAngkatanFromNim(req.user.nim);
    if (!angkatan) {
      return res.status(400).render('error', { title: 'Error', message: 'NIM tidak valid' });
    }

    const academicLabel = getCurrentAcademicSemester().label;

    // Cek apakah sudah ada KRS pending untuk semester ini
    const existingSnapshot = await db.collection('krs')
      .where('userId', '==', req.user.id)
      .where('semester', '==', academicLabel)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Gabungkan dengan KRS yang sudah ada
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const existingMkIds = existingData.mataKuliah || [];
      const combined = [...new Set([...existingMkIds, ...mkIds])]; // hilangkan duplikat
      await existingDoc.ref.update({
        mataKuliah: combined,
        updatedAt: new Date().toISOString()
      });
      res.redirect(`/mahasiswa/akademik/krs/${existingDoc.id}`);
    } else {
      // Buat KRS baru
      const krsData = {
        userId: req.user.id,
        semester: academicLabel,
        mataKuliah: mkIds,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      const docRef = await db.collection('krs').add(krsData);
      res.redirect(`/mahasiswa/akademik/krs/${docRef.id}`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menyimpan KRS' });
  }
});

/**
 * GET /mahasiswa/akademik/krs/:id
 * Detail KRS dan upload file
 */
router.get('/krs/:id', async (req, res) => {
  try {
    const krsDoc = await db.collection('krs').doc(req.params.id).get();
    if (!krsDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'KRS tidak ditemukan' });
    }
    const krs = { id: krsDoc.id, ...krsDoc.data() };
    if (krs.userId !== req.user.id) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke KRS ini' });
    }

    const mkIds = (krs.mataKuliah || []).filter(Boolean);
    // ✅ OPTIMISASI KUOTA: ambil semua mataKuliah SEKALIGUS lewat db.getAll(),
    // bukan satu per satu di dalam loop serial.
    const mkList = [];
    if (mkIds.length > 0) {
      const mkDocs = await db.getAll(...mkIds.map(id => db.collection('mataKuliah').doc(id)));
      mkDocs.forEach((mkDoc, i) => {
        if (mkDoc.exists) {
          mkList.push({
            id: mkIds[i],
            kode: mkDoc.data().kode,
            nama: mkDoc.data().nama,
            sks: mkDoc.data().sks
          });
        }
      });
    }

    res.render('mahasiswa/krs_detail', {
      user: req.user,
      krs,
      mkList
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail KRS' });
  }
});

/**
 * POST /mahasiswa/akademik/krs/:id/upload
 * Upload file KRS ke Google Drive (struktur folder otomatis)
 */
/**
/**
 * GET /mahasiswa/akademik/krs/krs_print/:id
 * Menampilkan halaman cetak KRS
 */
router.get('/krs/krs_print/:id', async (req, res) => {
  try {
    // 1. Ambil dokumen KRS
    const krsDoc = await db.collection('krs').doc(req.params.id).get();
    if (!krsDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'KRS tidak ditemukan' });
    }
    const krsData = krsDoc.data();
    krsData.id = krsDoc.id;

    if (krsData.userId !== req.user.id) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke KRS ini' });
    }

    // ========================================================================
    // 2. MENGAMBIL DATA MATA KULIAH (LOGIKA SUPER AMAN)
    // ========================================================================
    const mkIds = krsData.mataKuliah || krsData.mkList || [];
    const mkList = [];

    // ✅ OPTIMISASI KUOTA: normalisasi ID dulu (murni JS, tanpa DB), lalu
    // ambil SEMUA dokumen mataKuliah SEKALIGUS lewat db.getAll() - bukan
    // satu per satu di dalam loop serial. Logika "PENGAMAN" (item bisa
    // string atau object) tetap sama persis seperti sebelumnya.
    const mkIdStrings = mkIds
      .filter(item => item)
      .map(item => typeof item === 'object' ? (item.id || item.kode || item.mkId) : String(item))
      .filter(Boolean);

    if (mkIdStrings.length > 0) {
      const mkDocs = await db.getAll(...mkIdStrings.map(id => db.collection('mataKuliah').doc(id)));
      mkDocs.forEach((mkDoc, i) => {
        const mkIdString = mkIdStrings[i];
        if (mkDoc.exists) {
          const dataMk = mkDoc.data();
          mkList.push({
            id: mkDoc.id,
            kode: dataMk.kode || '-',
            nama: dataMk.nama || dataMk.nama_mk || dataMk.mata_kuliah || '-', // Fallback nama
            sks: parseFloat(dataMk.sks) || 0 // Paksa jadi angka
          });
        } else {
          console.log(`[WARNING] Data mata kuliah dengan ID ${mkIdString} tidak ditemukan di database.`);
        }
      });
    }

    // ========================================================================
    // 3. MENGHITUNG IPK & SKS SEBELUMNYA
    // ========================================================================
    try {
      const { totalSKS, ipk } = await getTranskripMahasiswa(req.user.id);
      krsData.ipk = ipk;
      krsData.sksSebelumnya = totalSKS;
    } catch (gradeError) {
      console.error('Gagal menghitung IPK/SKS untuk cetak KRS:', gradeError);
      krsData.ipk = '-';
      krsData.sksSebelumnya = '-';
    }

    // ========================================================================
    // 4. RENDER KE EJS PRINT
    // ========================================================================
    res.render('mahasiswa/krs_print', {
      title: 'Cetak KRS - ' + req.user.nama,
      user: req.user,
      krs: krsData,
      mkList: mkList // Sekarang mkList pasti berisi data lengkap yang siap dicetak
    });

  } catch (error) {
    console.error('Error saat memuat halaman print KRS:', error);
    res.status(500).render('error', { 
      title: 'Terjadi Kesalahan Server', 
      message: 'Gagal memuat halaman cetak KRS.' 
    });
  }
});
router.post('/krs/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const krsDoc = await db.collection('krs').doc(req.params.id).get();
    if (!krsDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'KRS tidak ditemukan' });
    }
    const krsData = krsDoc.data();
    if (krsData.userId !== req.user.id) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke KRS ini' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).render('error', { title: 'Error', message: 'Tidak ada file yang diupload' });
    }

    const user = req.user;
    const nim = user.nim;
    const nama = user.nama;
    const angkatan = nim && nim.length >= 2 ? '20' + nim.substring(0, 2) : new Date().getFullYear().toString();

    const rootFolderId = process.env.KRS_FOLDER_ID;
    if (!rootFolderId) throw new Error('KRS_FOLDER_ID tidak diatur di environment');

    const folderAngkatanId = await getOrCreateFolder(rootFolderId, angkatan);
    const folderMahasiswaId = await getOrCreateFolder(folderAngkatanId, `${nama.replace(/\s+/g, '_')}_${nim}`);

    const fileName = `KRS_${krsData.semester.replace(/\s+/g, '_')}.pdf`;
    const fileMetadata = { name: fileName, parents: [folderMahasiswaId] };
    const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
    const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id, webViewLink' });

    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    const directLink = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
    await db.collection('krs').doc(req.params.id).update({
      driveFileId: response.data.id,
      driveFileLink: directLink,
      driveFolder: `${angkatan}/${folderMahasiswaId}`
    });

    res.redirect(`/mahasiswa/akademik/krs/${req.params.id}`);
  } catch (error) {
    console.error('Gagal upload KRS:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal upload KRS: ' + error.message });
  }
});

// ============================================================================
// KARTU HASIL STUDI (KHS)
// ============================================================================
// Dihitung LIVE dari koleksi 'grades' (bukan lagi file PDF yang diupload
// admin). Satu semester = satu KHS, dengan IPS/IPK dihitung otomatis
// memakai skala resmi (lihat helpers/nilaiHelper.js -> nilaiKeHuruf), yang
// sudah diselaraskan dengan file KHS/Transkrip Excel prodi.
// ============================================================================

/**
 * GET /mahasiswa/akademik/khs
 * Daftar KHS milik mahasiswa yang login, satu baris per semester
 * (dengan filter opsional ?semester=...)
 */
router.get('/khs', async (req, res) => {
  try {
    const { semester } = req.query;

    const { perSemester } = await getTranskripMahasiswa(req.user.id);

    const semesterList = perSemester.map(s => s.semester);
    const khsList = semester
      ? perSemester.filter(s => s.semester === semester)
      : perSemester;

    res.render('mahasiswa/khs_list', {
      title: 'Kartu Hasil Studi (KHS)',
      user: req.user,
      khsList,
      semesterList,
      filters: { semester: semester || '' }
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat KHS' });
  }
});

/**
 * GET /mahasiswa/akademik/khs/:semester
 * Detail/cetak KHS satu semester milik mahasiswa yang login.
 * :semester harus di-encodeURIComponent oleh pemanggil karena label
 * semester mengandung spasi/slash (mis. "Ganjil 2025/2026").
 */
router.get('/khs/:semester', async (req, res) => {
  try {
    const semesterLabel = decodeURIComponent(req.params.semester);
    const { perSemester, ipk, totalSKS } = await getTranskripMahasiswa(req.user.id);

    const idx = perSemester.findIndex(s => s.semester === semesterLabel);
    if (idx === -1) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'KHS untuk semester ini belum tersedia' });
    }
    const khs = perSemester[idx];

    // IPK kumulatif "s.d. semester ini"
    const sampaiSemesterIni = perSemester.slice(0, idx + 1);
    let sksKum = 0, bobotKum = 0;
    sampaiSemesterIni.forEach(s => { sksKum += s.totalSKS; bobotKum += s.totalSksIndeks; });
    const ipkSampaiSemesterIni = sksKum > 0 ? (bobotKum / sksKum).toFixed(2) : '0.00';

    res.render('mahasiswa/khs_detail', {
      title: 'Detail KHS',
      user: req.user,
      khs,
      ipkSampaiSemesterIni,
      sksKumulatif: sksKum,
      ipkAkhir: ipk,
      totalSKSAkhir: totalSKS
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail KHS' });
  }
});

// ============================================================================
// TRANSKRIP NILAI
// ============================================================================

/**
 * GET /mahasiswa/akademik/transkrip
 * Menampilkan transkrip nilai (dari collection grades)
 */
router.get('/transkrip', async (req, res) => {
  try {
    const { items, ipk, totalSKS } = await getTranskripMahasiswa(req.user.id);

    res.render('mahasiswa/transkrip', {
      title: 'Transkrip Nilai',
      user: req.user,
      grades: items, // nama variabel view tetap 'grades' agar template EJS tidak perlu diubah
      ipk,
      totalSKS
    });
  } catch (error) {
    console.error(error);
    if (error.code === 9) {
      return res.status(500).render('error', {
        title: 'Error',
        message: 'Fitur transkrip membutuhkan indeks database. Silakan hubungi administrator.'
      });
    }
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat transkrip' });
  }
});

// ============================================================================
// KALENDER AKADEMIK
// ============================================================================

/**
 * GET /mahasiswa/akademik/kalender
 * Menampilkan kalender akademik (dari collection kalenderAkademik)
 */
// routes/mahasiswa/akademik.js bagian kalender
router.get('/kalender', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await db.collection('jadwalPenting')
      .where('tanggal', '>=', today)
      .orderBy('tanggal', 'asc')
      .get();
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Group events per bulan
    const months = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthName = date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0 = Minggu, 1 = Senin, ...
      // Ubah ke Senin = 0? Kita ingin Senin pertama. Kita akan buat array 35 atau 42.
      // Sederhana: buat array 42 elemen (6 minggu)
      const days = [];
      // Hitung offset: jika firstDay = 0 (Minggu), maka Senin adalah 1? Kita ingin grid dimulai Senin.
      // Di Indonesia, minggu dimulai Senin. Kita perlu menyesuaikan.
      // firstDay dari JS: 0 = Minggu, 1 = Senin, ... 6 = Sabtu.
      // Agar Senin menjadi kolom pertama, kita hitung offset: jika firstDay = 0 (Minggu), maka offset = 6 (karena Minggu adalah hari ke-7)
      let offset = firstDay === 0 ? 6 : firstDay - 1;
      
      // Isi dengan kosong untuk hari sebelum tanggal 1
      for (let j = 0; j < offset; j++) {
        days.push({ date: null, events: [] });
      }
      // Isi tanggal
      for (let d = 1; d <= daysInMonth; d++) {
        days.push({ date: d, events: [] });
      }
      // Sisa sampai 42
      while (days.length < 42) {
        days.push({ date: null, events: [] });
      }
      
      months.push({
        monthName,
        monthIndex: date.getMonth(),
        year: date.getFullYear(),
        days,
        events: []
      });
    }

    // Masukkan event ke dalam days dan juga ke events array bulan
    events.forEach(event => {
      const eventDate = new Date(event.tanggal);
      const eventMonth = eventDate.getMonth();
      const eventYear = eventDate.getFullYear();
      const monthItem = months.find(m => m.monthIndex === eventMonth && m.year === eventYear);
      if (monthItem) {
        monthItem.events.push(event);
        const day = eventDate.getDate();
        const dayItem = monthItem.days.find(d => d.date === day);
        if (dayItem) {
          dayItem.events.push(event);
        }
      }
    });

    res.render('mahasiswa/kalender', { 
      title: 'Kalender Akademik', 
      user: req.user, 
      months 
    });
  } catch (error) {
    console.error('Error mengambil kalender:', error);
    res.status(500).render('error', { message: 'Gagal memuat kalender' });
  }
});

module.exports = router;