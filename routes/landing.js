/**
 * routes/landing.js
 * Halaman utama publik (landing page) dan halaman publik lainnya
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================================================
// FUNGSI BANTU
// ============================================================================
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ============================================================================
// HALAMAN UTAMA (LANDING PAGE)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    // 1. Statistik prodi
    const statistikDoc = await db.collection('statistik').doc('data').get();
    const statistik = statistikDoc.exists ? statistikDoc.data() : {
      mahasiswaAktif: 0,
      mahasiswaMagang: 0,
      angkatan: []
    };

    const mahasiswaSnapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
    let aktifCount = 0;
    let magangCount = 0;
    mahasiswaSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.statusMahasiswa === 'Aktif' || data.status === 'aktif') aktifCount++;
      if (data.statusMagang && (data.statusMagang.includes('Magang') || data.statusMagang === 'Selesai Magang')) magangCount++;
    });
    statistik.mahasiswaAktif = aktifCount;
    statistik.mahasiswaMagang = magangCount;
    const dosenSnapshot = await db.collection('dosen').get();
const jumlahDosen = dosenSnapshot.size;

    // 2. Berita terbaru
    const beritaSnapshot = await db.collection('berita')
      .orderBy('tanggal', 'desc')
      .limit(6)
      .get();
    const berita = beritaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Jadwal penting (event mendatang)
    const today = new Date().toISOString().split('T')[0];
    const jadwalSnapshot = await db.collection('jadwalPenting')
      .where('tanggal', '>=', today)
      .orderBy('tanggal', 'asc')
      .limit(5)
      .get();
    const jadwal = jadwalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 4. Jadwal seminar
    const seminarSnapshot = await db.collection('seminar')
      .orderBy('tanggal', 'asc')
      .limit(5)
      .get();
    const seminar = seminarSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 5. Lulusan (tracer study yang disetujui)
    let lulusan = [];
    try {
      const lulusanSnapshot = await db.collection('tracerStudy')
        .where('isPublic', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get();
      lulusan = lulusanSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('TracerStudy tidak dapat diambil:', err.message);
    }

    // 6. Aktivitas prodi
    let aktivitas = [];
    try {
      const aktivitasSnapshot = await db.collection('aktivitas')
        .orderBy('tanggal', 'desc')
        .limit(4)
        .get();
      aktivitas = aktivitasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Aktivitas tidak dapat diambil:', err.message);
    }

    // 7. Dosen pengajar (4 dosen)
    let dosenList = [];
    try {
      const dosenSnapshot = await db.collection('dosen').limit(4).get();
      dosenList = dosenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Gagal mengambil data dosen:', err.message);
    }

    // 8. Lulusan yang bekerja
    let lulusanKerja = [];
    try {
      const kerjaSnapshot = await db.collection('tracerStudy')
        .where('statusPekerjaan', '==', 'bekerja')
        .limit(4)
        .get();
      lulusanKerja = kerjaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Gagal mengambil data lulusan bekerja:', err.message);
      try {
        const kerjaSnapshot = await db.collection('tracerStudy')
          .where('pekerjaan', '!=', null)
          .limit(4)
          .get();
        lulusanKerja = kerjaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn('Alternatif gagal:', e.message);
      }
    }

    // ============ 9. DOKUMENTASI MAGANG UNTUK CAROUSEL ============
    let magangSlides = [];
    try {
      const logbookSnapshot = await db.collection('logbookMagang')
        .where('status', '==', 'approved')
        .orderBy('tanggal', 'desc')
        .limit(20)
        .get();

      const logs = logbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const mahasiswaCache = new Map();
      const perusahaanCache = new Map();
      const progressCache = new Map();

      for (const log of logs) {
        const imageUrls = log.imageUrls || [];
        if (imageUrls.length === 0) continue;

        let mahasiswaInfo = mahasiswaCache.get(log.userId);
        if (!mahasiswaInfo) {
          const userDoc = await db.collection('users').doc(log.userId).get();
          mahasiswaInfo = {
            nama: userDoc.exists ? userDoc.data().nama : 'Mahasiswa',
            nim: userDoc.exists ? userDoc.data().nim : '-'
          };
          mahasiswaCache.set(log.userId, mahasiswaInfo);
        }

        let perusahaan = log.perusahaan?.nama || '-';
        if (perusahaan === '-' && log.perusahaanId) {
          if (perusahaanCache.has(log.perusahaanId)) {
            perusahaan = perusahaanCache.get(log.perusahaanId);
          } else {
            try {
              const perusahaanDoc = await db.collection('perusahaan').doc(log.perusahaanId).get();
              perusahaan = perusahaanDoc.exists ? perusahaanDoc.data().nama : '-';
              perusahaanCache.set(log.perusahaanId, perusahaan);
            } catch (e) { perusahaan = '-'; }
          }
        }

        const progressKey = `${log.userId}_${log.pdkId}`;
        let progress = progressCache.get(progressKey);
        if (!progress) {
          const periodSnap = await db.collection('magangPeriod')
            .where('mahasiswaId', '==', log.userId)
            .where('pdkId', '==', log.pdkId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          if (!periodSnap.empty) {
            const period = periodSnap.docs[0].data();
            const start = new Date(period.tanggalMulai);
            const end = period.tanggalSelesai ? new Date(period.tanggalSelesai) : new Date();
            const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            const logSnap = await db.collection('logbookMagang')
              .where('userId', '==', log.userId)
              .where('pdkId', '==', log.pdkId)
              .where('status', '==', 'approved')
              .get();
            const uniqueDates = new Set();
            logSnap.docs.forEach(doc => {
              if (doc.data().tanggal) uniqueDates.add(doc.data().tanggal);
            });
            const uploadedDays = uniqueDates.size;
            const percentage = totalDays > 0 ? Math.min(100, Math.round((uploadedDays / totalDays) * 100)) : 0;
            progress = { uploadedDays, totalDays, percentage };
          } else {
            progress = { uploadedDays: 0, totalDays: 0, percentage: 0 };
          }
          progressCache.set(progressKey, progress);
        }

        for (const rawUrl of imageUrls) {
          let imageUrl = rawUrl;
          if (imageUrl.includes('drive.google.com')) {
            const match = imageUrl.match(/id=([^&]+)/);
            if (match) imageUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
          }
          magangSlides.push({
            imageUrl,
            caption: log.kegiatan || 'Aktivitas magang',
            mahasiswa: mahasiswaInfo.nama,
            nim: mahasiswaInfo.nim,
            tanggal: log.tanggal ? new Date(log.tanggal).toLocaleDateString('id-ID') : '-',
            perusahaan: perusahaan,
            progressUploaded: progress.uploadedDays,
            progressTotal: progress.totalDays,
            progressPercent: progress.percentage
          });
          if (magangSlides.length >= 12) break;
        }
        if (magangSlides.length >= 12) break;
      }

      if (magangSlides.length === 0) {
        magangSlides.push({
          imageUrl: 'https://via.placeholder.com/1200x600?text=Belum+Ada+Dokumentasi+Magang',
          caption: 'Belum ada foto magang yang disetujui',
          mahasiswa: '-',
          nim: '-',
          tanggal: '-',
          perusahaan: '-',
          progressUploaded: 0,
          progressTotal: 0,
          progressPercent: 0
        });
      }
    } catch (err) {
      console.warn('Gagal mengambil dokumentasi magang:', err.message);
      magangSlides = [{
        imageUrl: 'https://via.placeholder.com/1200x600?text=Error+Load+Data',
        caption: 'Gagal memuat data magang',
        mahasiswa: '-',
        nim: '-',
        tanggal: '-',
        perusahaan: '-',
        progressUploaded: 0,
        progressTotal: 0,
        progressPercent: 0
      }];
    }

    // ============ RENDER VIEW ============
res.render('landing/index', {
      title: 'Teknik Elektronika - Politeknik Dewantara',
      user: req.user || null,
      statistik,     
      jumlahDosen,   
      berita,
      jadwalPenting: jadwal,
      seminar,
      lulusan,
      aktivitas,
      dosenList,
      lulusanKerja,
      magangSlides,
      formatDate
    });
  } catch (error) {
    console.error('Error landing page:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Terjadi kesalahan server'
    });
  }
});

// ============================================================================
// CEK MAHASISWA (DAFTAR + PENCARIAN)
// ============================================================================
router.get('/cekmahasiswa', async (req, res) => {
  try {
    const { search } = req.query;
    let mahasiswa = [];

    if (search && search.trim() !== '') {
      const keyword = search.trim();
      const nimSnapshot = await db.collection('users')
        .where('role', '==', 'mahasiswa')
        .where('nim', '==', keyword)
        .get();
      const namaSnapshot = await db.collection('users')
        .where('role', '==', 'mahasiswa')
        .where('nama', '>=', keyword)
        .where('nama', '<=', keyword + '\uf8ff')
        .get();

      const combined = new Map();
      nimSnapshot.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() }));
      namaSnapshot.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() }));
      mahasiswa = Array.from(combined.values());
    } else {
      const snapshot = await db.collection('users')
        .where('role', '==', 'mahasiswa')
        .orderBy('nim')
        .get();
      mahasiswa = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    res.render('landing/cek_mahasiswa', {
      title: 'Cek Data Mahasiswa - Teknik Elektronika',
      mahasiswa,
      search: search || ''
    });
  } catch (error) {
    console.error('Error di /cekmahasiswa:', error);
    res.status(500).send('Terjadi kesalahan saat memuat data mahasiswa');
  }
});

// ============================================================================
// CEK DOSEN (DAFTAR + PENCARIAN)
// ============================================================================
router.get('/cekdosen', async (req, res) => {
  try {
    const { search } = req.query;
    let dosen = [];

    if (search && search.trim() !== '') {
      const keyword = search.trim();
      const nuptkSnapshot = await db.collection('dosen')
        .where('nuptk', '==', keyword)
        .get();
      const namaSnapshot = await db.collection('dosen')
        .where('nama', '>=', keyword)
        .where('nama', '<=', keyword + '\uf8ff')
        .get();

      const combined = new Map();
      nuptkSnapshot.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() }));
      namaSnapshot.forEach(doc => combined.set(doc.id, { id: doc.id, ...doc.data() }));
      dosen = Array.from(combined.values());
    } else {
      const snapshot = await db.collection('dosen').orderBy('nama').get();
      dosen = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    res.render('landing/cek_dosen', {
      title: 'Cek Data Dosen - Teknik Elektronika',
      dosen,
      search: search || ''
    });
  } catch (error) {
    console.error('Error di /cekdosen:', error);
    res.status(500).send('Terjadi kesalahan saat memuat data dosen');
  }
});

// ============================================================================
// DETAIL MAHASISWA (PUBLIK)
// ============================================================================
router.get('/cekmahasiswa/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const userDoc = await db.collection('users').doc(id).get();
    if (!userDoc.exists || userDoc.data().role !== 'mahasiswa') {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data mahasiswa tidak ditemukan' });
    }
    const mahasiswa = { id: userDoc.id, ...userDoc.data() };

    // 5 logbook terbaru
    const logbookSnapshot = await db.collection('logbookMagang')
      .where('userId', '==', id)
      .orderBy('tanggal', 'desc')
      .limit(5)
      .get();
    const logbook = logbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Statistik semua logbook
    const allLogbook = await db.collection('logbookMagang')
      .where('userId', '==', id)
      .get();
    const stats = {
      total: allLogbook.size,
      approved: allLogbook.docs.filter(d => d.data().status === 'approved').length,
      pending: allLogbook.docs.filter(d => d.data().status === 'pending').length,
      rejected: allLogbook.docs.filter(d => d.data().status === 'rejected').length
    };

    res.render('landing/cek_mahasiswa_detail', {
      title: `Detail Mahasiswa - ${mahasiswa.nama}`,
      mahasiswa,
      logbook,
      stats
    });
  } catch (error) {
    console.error('Error detail mahasiswa:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail mahasiswa' });
  }
});

// ============================================================================
// AKTIVITAS PRODI
// ============================================================================
router.get('/aktivitas', async (req, res) => {
  try {
    const { kategori } = req.query;
    let query = db.collection('aktivitas').orderBy('tanggal', 'desc');
    if (kategori && kategori !== 'semua') {
      query = query.where('kategori', '==', kategori);
    }
    const snapshot = await query.get();
    const aktivitas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('aktivitas/index', {
      title: 'Aktivitas Prodi',
      aktivitas,
      kategoriAktif: kategori || 'semua',
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat aktivitas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat aktivitas' });
  }
});

router.get('/aktivitas/:id', async (req, res) => {
  try {
    const doc = await db.collection('aktivitas').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Aktivitas tidak ditemukan' });
    const aktivitas = { id: doc.id, ...doc.data() };
    res.render('aktivitas/detail', { title: aktivitas.judul, aktivitas, user: req.user || null });
  } catch (error) {
    console.error('Error detail aktivitas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail aktivitas' });
  }
});

// ============================================================================
// BERITA
// ============================================================================
router.get('/berita/:id', async (req, res) => {
  try {
    const berita = await db.collection('berita').doc(req.params.id).get();
    if (!berita.exists) return res.status(404).send('Berita tidak ditemukan');
    res.render('berita_detail', { berita: berita.data() });
  } catch (error) {
    res.status(500).send('Error');
  }
});

// ============================================================================
// VALIDASI SURAT
// ============================================================================
router.get('/validasi', (req, res) => {
  const { kode } = req.query;
  res.render('validasi', { title: 'Validasi Surat', kode, user: req.user || null });
});

// ============================================================================
// LULUSAN (TRACER STUDY)
// ============================================================================
router.get('/lulusan', async (req, res) => {
  try {
    const { angkatan, status } = req.query;
    let query = db.collection('tracerStudy')
      .where('isPublic', '==', true)
      .orderBy('tahunLulus', 'desc')
      .orderBy('nama');
    if (angkatan) query = query.where('tahunLulus', '==', parseInt(angkatan));
    if (status && status !== 'semua') query = query.where('status', '==', status);

    const snapshot = await query.get();
    const lulusan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const statSnapshot = await db.collection('tracerStudy').where('isPublic', '==', true).get();
    const total = statSnapshot.size;
    const bekerja = statSnapshot.docs.filter(d => d.data().status === 'bekerja').length;
    const wirausaha = statSnapshot.docs.filter(d => d.data().status === 'wirausaha').length;
    const kuliah = statSnapshot.docs.filter(d => d.data().status === 'kuliah').length;
    const stats = { total, bekerja, wirausaha, kuliah };

    const angkatanSet = new Set();
    statSnapshot.docs.forEach(d => angkatanSet.add(d.data().tahunLulus));
    const angkatanList = Array.from(angkatanSet).sort((a, b) => b - a);

    res.render('lulusan/index', {
      title: 'Lulusan',
      lulusan,
      stats,
      angkatanList,
      filterAngkatan: angkatan || '',
      filterStatus: status || 'semua',
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat halaman lulusan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data lulusan' });
  }
});

router.get('/lulusan/:id', async (req, res) => {
  try {
    const doc = await db.collection('tracerStudy').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data tidak ditemukan' });
    const lulusan = { id: doc.id, ...doc.data() };
    res.render('lulusan/detail', { title: lulusan.nama, lulusan, user: req.user || null });
  } catch (error) {
    console.error('Error detail lulusan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail lulusan' });
  }
});

// ============================================================================
// PMB (PENERIMAAN MAHASISWA BARU)
// ============================================================================
const uploadDir = path.join(__dirname, '../public/uploads/pmb');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `pmb-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  return (ext && mime) ? cb(null, true) : cb(new Error('Hanya gambar (JPG, PNG) atau PDF'));
};
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter });

router.get('/pmb', (req, res) => {
  res.render('landing/pmb', { title: 'Pendaftaran Mahasiswa Baru - Polidewa', user: req.user || null });
});

router.post('/pmb/submit', upload.single('bukti_pembayaran'), async (req, res) => {
  try {
    const { nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur } = req.body;
    const buktiPembayaran = req.file ? `/uploads/pmb/${req.file.filename}` : null;

    if (!nama || !jenis_kelamin || !nis || !asal_sekolah || !wa || !jurusan || !jalur || !buktiPembayaran) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).send('Semua field wajib diisi, termasuk bukti pembayaran.');
    }

    await db.collection('pmb_pendaftaran').add({
      nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur,
      bukti_pembayaran: buktiPembayaran,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.render('landing/pmb_success', {
      title: 'Pendaftaran Berhasil - Politeknik Dewantara',
      user: req.user || null,
      nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur
    });
  } catch (error) {
    console.error('Error submit PMB:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).send('Terjadi kesalahan server. Silakan coba lagi nanti.');
  }
});

// ============================================================================
// EKSPOR ROUTER
// ============================================================================
module.exports = router;