/**
 * routes/landing.js
 * Halaman utama publik (landing page) dan halaman publik lainnya
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');

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

        // Info mahasiswa
        let mahasiswaInfo = mahasiswaCache.get(log.userId);
        if (!mahasiswaInfo) {
          const userDoc = await db.collection('users').doc(log.userId).get();
          mahasiswaInfo = {
            nama: userDoc.exists ? userDoc.data().nama : 'Mahasiswa',
            nim: userDoc.exists ? userDoc.data().nim : '-'
          };
          mahasiswaCache.set(log.userId, mahasiswaInfo);
        }

        // Nama perusahaan
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

        // Progress magang
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

        // Loop setiap gambar
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
// HALAMAN AKTIVITAS PRODI (DAFTAR)
// ============================================================================
router.get('/aktivitas', async (req, res) => {
  try {
    const { kategori } = req.query;
    
    let query = db.collection('aktivitas').orderBy('tanggal', 'desc');
    if (kategori && kategori !== 'semua') {
      query = query.where('kategori', '==', kategori);
    }
    
    const snapshot = await query.get();
    const aktivitas = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.render('aktivitas/index', {
      title: 'Aktivitas Prodi',
      aktivitas,
      kategoriAktif: kategori || 'semua',
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat aktivitas:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat aktivitas'
    });
  }
});

// ============================================================================
// DETAIL AKTIVITAS
// ============================================================================
router.get('/aktivitas/:id', async (req, res) => {
  try {
    const doc = await db.collection('aktivitas').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Aktivitas tidak ditemukan'
      });
    }
    const aktivitas = { id: doc.id, ...doc.data() };
    res.render('aktivitas/detail', {
      title: aktivitas.judul,
      aktivitas,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error detail aktivitas:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat detail aktivitas'
    });
  }
});

// ============================================================================
// DETAIL BERITA
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
// HALAMAN VALIDASI SURAT
// ============================================================================
router.get('/validasi', (req, res) => {
  const { kode } = req.query;
  res.render('validasi', {
    title: 'Validasi Surat',
    kode,
    user: req.user || null
  });
});

// ============================================================================
// HALAMAN LULUSAN (DAFTAR)
// ============================================================================
router.get('/lulusan', async (req, res) => {
  try {
    const { angkatan, status } = req.query;
    
    let query = db.collection('tracerStudy')
      .where('isPublic', '==', true)
      .orderBy('tahunLulus', 'desc')
      .orderBy('nama');

    if (angkatan) {
      query = query.where('tahunLulus', '==', parseInt(angkatan));
    }
    if (status && status !== 'semua') {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const lulusan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Statistik
    const statSnapshot = await db.collection('tracerStudy').where('isPublic', '==', true).get();
    const total = statSnapshot.size;
    const bekerja = statSnapshot.docs.filter(d => d.data().status === 'bekerja').length;
    const wirausaha = statSnapshot.docs.filter(d => d.data().status === 'wirausaha').length;
    const kuliah = statSnapshot.docs.filter(d => d.data().status === 'kuliah').length;
    const stats = { total, bekerja, wirausaha, kuliah };

    // Angkatan unik
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
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat data lulusan'
    });
  }
});
// ============================================================================
// HALAMAN PMB (PENERIMAAN MAHASISWA BARU)
// ============================================================================
router.get('/pmb', (req, res) => {
  res.render('landing/pmb', {
    title: 'Pendaftaran Mahasiswa Baru - Polidewa',
    user: req.user || null
  });
});
// ============================================================================
// PMB - KONFIGURASI UPLOAD & ROUTE POST
// ============================================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads/pmb');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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

// Route POST untuk submit pendaftaran
router.post('/pmb/submit', upload.single('bukti_pembayaran'), async (req, res) => {
    try {
        const { nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur } = req.body;
        const buktiPembayaran = req.file ? `/uploads/pmb/${req.file.filename}` : null;

        // Validasi
        if (!nama || !jenis_kelamin || !nis || !asal_sekolah || !wa || !jurusan || !jalur || !buktiPembayaran) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).send('Semua field wajib diisi, termasuk bukti pembayaran.');
        }

        // Simpan ke Firestore
        const pendaftaranRef = db.collection('pmb_pendaftaran');
        await pendaftaranRef.add({
            nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur,
            bukti_pembayaran: buktiPembayaran,
            status: 'pending',
            createdAt: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        // ✅ Redirect ke halaman sukses dengan data
        res.render('landing/pmb_success', {
            title: 'Pendaftaran Berhasil - Politeknik Dewantara',
            user: req.user || null,
            nama: nama,
            jenis_kelamin: jenis_kelamin,
            nis: nis,
            asal_sekolah: asal_sekolah,
            wa: wa,
            jurusan: jurusan,
            jalur: jalur
        });
    } catch (error) {
        console.error('Error submit PMB:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).send('Terjadi kesalahan server. Silakan coba lagi nanti.');
    }
});
// ============================================================================
// DETAIL LULUSAN
// ============================================================================
router.get('/lulusan/:id', async (req, res) => {
  try {
    const doc = await db.collection('tracerStudy').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Data tidak ditemukan'
      });
    }
    const lulusan = { id: doc.id, ...doc.data() };
    res.render('lulusan/detail', {
      title: lulusan.nama,
      lulusan,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error detail lulusan:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat detail lulusan'
    });
  }
});

module.exports = router;