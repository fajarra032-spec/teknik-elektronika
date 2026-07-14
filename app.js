/**
 * app.js - Entry point aplikasi Teknik Elektronika
 * Dengan inisialisasi Firebase async, Sitemap, SEO, dan Webhook
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { setFirebaseInstances } = require('./config/firebaseAdmin');

const app = express();

// ============================================================================
// MIDDLEWARE GLOBAL
// ============================================================================
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// SESSION CONFIGURATION
// ============================================================================
app.use(cookieParser());
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
// SEO, SITEMAP & WEBHOOK (Tanpa Firebase)
// ============================================================================

/**
 * robots.txt - Memberi tahu crawler mana yang diizinkan
 */
app.get('/robots.txt', (req, res) => {
  const robots = `User-agent: *
Allow: /
Sitemap: https://elektronika.polidewa.ac.id/sitemap.xml
Sitemap: https://casaos.polidewa.ac.id/sitemap.xml
`;
  res.type('text/plain');
  res.send(robots);
});

/**
 * Webhook - Auto deploy dari GitHub
 */
app.post('/webhook', (req, res) => {
  const exec = require('child_process').exec;
  console.log('🔔 Webhook diterima! Memulai deploy...');
  
  exec('cd /DATA/teknik-elektronika && git pull origin main && npm install && pm2 restart teknik-elektronika', 
    (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Deploy error:', error);
        return res.status(500).send('Deploy failed');
      }
      console.log('✅ Deploy berhasil!');
      console.log(stdout);
      res.send('OK');
    }
  );
});

/**
 * Sitemap Generator - Statis + Dinamis dari Firebase
 */
app.get('/sitemap.xml', async (req, res) => {
  const baseUrl = 'https://elektronika.polidewa.ac.id';
  const today = new Date().toISOString().split('T')[0];

  // URL Statis
  const staticUrls = [
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/panduan', changefreq: 'monthly', priority: 0.7 },
    { url: '/display', changefreq: 'weekly', priority: 0.6 },
    { url: '/ic3', changefreq: 'weekly', priority: 0.7 },
    { url: '/elk-library', changefreq: 'weekly', priority: 0.7 },
    { url: '/auth/login', changefreq: 'yearly', priority: 0.3 },
    { url: '/auth/register', changefreq: 'yearly', priority: 0.3 },
  ];

  // Mulai XML
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // URL Statis
  staticUrls.forEach(item => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${item.url}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${item.changefreq}</changefreq>\n`;
    xml += `    <priority>${item.priority}</priority>\n`;
    xml += '  </url>\n';
  });

  // ============================================
  // URL DINAMIS DARI FIREBASE (Berita)
  // ============================================
  try {
    const { getFirebaseInstances } = require('./config/firebaseAdmin');
    const { db } = getFirebaseInstances();

    if (db) {
      const beritaSnapshot = await db.collection('berita')
        .orderBy('createdAt', 'desc')
        .limit(1000)
        .get();

      if (!beritaSnapshot.empty) {
        beritaSnapshot.forEach(doc => {
          const data = doc.data();
          const slug = data.slug || doc.id;
          let lastmod = today;
          
          if (data.updatedAt) {
            lastmod = new Date(data.updatedAt.seconds * 1000).toISOString().split('T')[0];
          } else if (data.createdAt) {
            lastmod = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
          }

          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/berita/${slug}</loc>\n`;
          xml += `    <lastmod>${lastmod}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.8</priority>\n';
          xml += '  </url>\n';
        });
      }
    }
  } catch (error) {
    console.error('❌ Gagal ambil berita untuk sitemap:', error.message);
  }

  xml += '</urlset>';
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

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

    // ROUTES PORAL IC3 DIGITAL LITERACY
    const ic3Router = require('./routes/ic3');
    app.use('/ic3', ic3Router);

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
    const bukuRouter = require('./routes/dosen/buku');
    app.use('/dosen/penelitian', penelitianRouter);
    app.use('/dosen/pengabdian', pengabdianRouter);
    app.use('/dosen/buku', bukuRouter);
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

    // ============================================================================
    // START SERVER
    // ============================================================================
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Gagal inisialisasi Firebase:', error);
    process.exit(1);
  }
}

startServer();