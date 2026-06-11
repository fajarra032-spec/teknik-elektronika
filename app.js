/**
 * app.js - Entry point aplikasi Teknik Elektronika
 * Dengan inisialisasi Firebase async agar kompatibel dengan firebase-admin v13+
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { setFirebaseInstances } = require('./config/firebaseAdmin');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
// ============================================================================
// MIDDLEWARE GLOBAL (tidak butuh Firebase)
// ============================================================================
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================
app.use(session({
  secret: process.env.SESSION_SECRET || 'rahasia-super-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// ============================================================================
// VIEW ENGINE
// ============================================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================================================
// INISIALISASI FIREBASE (ASYNC) DAN START SERVER
// ============================================================================
async function startServer() {
  try {
    // Import dinamis firebase-admin (ESM)
    const firebaseAdmin = await import('firebase-admin');
    const admin = firebaseAdmin.default;

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
    }

    const db = admin.firestore();
    const auth = admin.auth();

    // Simpan instance ke firebaseAdmin.js (sinkron)
    setFirebaseInstances({ admin, db, auth });

    // ============================================================================
    // ROUTES (semua require setelah Firebase siap)
    // ============================================================================
    const { verifyToken } = require('./middleware/auth');

    // ROUTES PUBLIK
    const landingRoutes = require('./routes/landing');
    app.use('/', landingRoutes);

    const authRoutes = require('./routes/auth');
    app.use('/auth', authRoutes);

    app.get('/api/current-user', verifyToken, (req, res) => {
      res.json({ nama: req.user.nama || '', nim: req.user.nim || '' });
    });

    // SPMP
    const adminSpmpRouter = require('./routes/admin/spmp');
    const dosenSpmpRouter = require('./routes/dosen/spmp');
    app.use('/admin/spmp', adminSpmpRouter);
    app.use('/dosen/spmp', dosenSpmpRouter);

    // Perusahaan magang
    const adminPerusahaanRouter = require('./routes/admin/perusahaan');
    const dosenPerusahaanRouter = require('./routes/dosen/perusahaan');
    app.use('/admin/perusahaan', adminPerusahaanRouter);
    app.use('/dosen/perusahaan', dosenPerusahaanRouter);

    // EDOM
    const mahasiswaEdomRouter = require('./routes/mahasiswa/edom');
    const dosenEdomRouter = require('./routes/dosen/edom');
    const adminEdomRouter = require('./routes/admin/edom');
    app.use('/mahasiswa/edom', mahasiswaEdomRouter);
    app.use('/dosen/edom', dosenEdomRouter);
    app.use('/admin/edom', adminEdomRouter);

    // Kurikulum
    app.get('/dosen/kurikulum/detail/:id', (req, res) => {
      res.render('dosen/kurikulum/detail', { id: req.params.id });
    });
    app.get('/dosen/kurikulum/my-rps', (req, res) => {
      res.render('dosen/kurikulum/my_rps');
    });

    // Berita
    const beritaPublicRoutes = require('./routes/berita');
    app.use('/berita', beritaPublicRoutes);
    const adminBeritaRoutes = require('./routes/admin/berita');
    app.use('/admin/berita', adminBeritaRoutes);

    // Mahasiswa
    const mahasiswaRoutes = require('./routes/mahasiswa/index');
    app.use('/mahasiswa', mahasiswaRoutes);
    const inspeksiRouter = require('./routes/mahasiswa/inspeksi');
    app.use('/mahasiswa/inspeksi', inspeksiRouter);
    const servisanRoutes = require('./routes/mahasiswa/servisan');
    app.use('/mahasiswa/servisan', servisanRoutes);

    // Admin inspeksi & servisan
    const adminInspeksiRouter = require('./routes/admin/inspeksi');
    app.use('/admin/inspeksi', adminInspeksiRouter);
    const adminServisanRoutes = require('./routes/admin/servisan');
    app.use('/admin/servisan', adminServisanRoutes);

    // Dosen
    const dosenSuratRouter = require('./routes/dosen/surat');
    app.use('/dosen/surat', dosenSuratRouter);
    const penelitianRouter = require('./routes/dosen/penelitian');
    const pengabdianRouter = require('./routes/dosen/pengabdian');
    app.use('/dosen/penelitian', penelitianRouter);
    app.use('/dosen/pengabdian', pengabdianRouter);
    const dosenSkRouter = require('./routes/dosen/sk');
    app.use('/dosen/sk', dosenSkRouter);
    const dosenRoutes = require('./routes/dosen/index');
    app.use('/dosen', dosenRoutes);
    const adminSkRouter = require('./routes/admin/sk');
    app.use('/admin/sk', adminSkRouter);
    const dosenArtikelRouter = require('./routes/dosen/artikel');
    app.use('/dosen/artikel', dosenArtikelRouter);
    const dosenKalenderRouter = require('./routes/dosen/kalender');
    app.use('/dosen/kalender', dosenKalenderRouter);

    // Admin
    const adminRoutes = require('./routes/admin/index');
    app.use('/admin', adminRoutes);
    const adminLaporanMagangRouter = require('./routes/admin/elkLibrary');
    app.use('/admin/laporan-magang', adminLaporanMagangRouter);
    const adminElkLibraryRouter = require('./routes/admin/elkLibrary');
    app.use('/admin/elk-library', adminElkLibraryRouter);

    // Umum
    const elkLibraryRouter = require('./routes/elkLibrary');
    app.use('/elk-library', elkLibraryRouter);
    const mahasiswaKalenderRouter = require('./routes/mahasiswa/kalender');
    app.use('/mahasiswa/kalender', mahasiswaKalenderRouter);

    app.get('/panduan', (req, res) => {
      res.render('landing/panduan', { title: 'Panduan Penggunaan' });
    });

    // Dashboard redirect
    app.get('/dashboard', verifyToken, (req, res) => {
      if (req.user.role === 'admin') res.redirect('/admin/dashboard');
      else if (req.user.role === 'dosen') res.redirect('/dosen/dashboard');
      else res.redirect('/mahasiswa/dashboard');
    });

    // Display (TV Kampus)
    const displayRoutes = require('./routes/display');
    app.use('/display', displayRoutes);

    // ============================================================================
    // HANDLE 404 & ERROR HANDLER
    // ============================================================================
    app.use((req, res) => {
      res.status(404).render('404', {
        title: 'Halaman Tidak Ditemukan',
        user: req.user || null
      });
    });

    app.use((err, req, res, next) => {
      console.error('❌ Error:', err.stack);
      res.status(500).render('error', {
        title: 'Terjadi Kesalahan',
        message: err.message || 'Internal Server Error',
        user: req.user || null
      });
    });

    // START SERVER
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Gagal inisialisasi Firebase:', error);
    process.exit(1);
  }
}

startServer();