/**
 * app.js - Entry point aplikasi Teknik Elektronika
 * Dengan inisialisasi Firebase async, Sitemap, SEO, dan Webhook
 * 
 * Catatan: createdAt/updatedAt di koleksi 'berita' disimpan sebagai string ISO,
 * bukan Firestore Timestamp, sehingga parsing langsung menggunakan new Date(string).
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { setFirebaseInstances, getFirebaseInstances } = require('./config/firebaseAdmin');

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
// SEO: canonical URL otomatis + blokir indexing halaman privat
// ============================================================================
// Halaman privat (admin/mahasiswa/dosen/auth) tidak boleh diindex Google,
// walaupun crawler tetap bisa "menyasar" ke sana (mis. lewat link internal).
// Header X-Robots-Tag ini jadi lapisan kedua selain Disallow di robots.txt,
// karena Disallow hanya mencegah crawling, bukan menjamin de-index bila
// URL-nya sudah kadung ditemukan Google dari sumber lain.
const SEO_BASE_URL = 'https://elektronika.polidewa.ac.id';
app.use((req, res, next) => {
  const isHalamanPrivat = /^\/(admin|mahasiswa|dosen|auth|webhook)(\/|$)/.test(req.path);
  if (isHalamanPrivat) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.locals.robotsMeta = 'noindex, nofollow';
  } else {
    res.locals.robotsMeta = 'index, follow';
  }
  // URL kanonik tanpa query string (?search=, ?page=, dsb) supaya Google
  // tidak menganggap /berita?page=2 sebagai halaman duplikat dari /berita
  res.locals.canonicalUrl = SEO_BASE_URL + req.path;
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
Disallow: /admin
Disallow: /mahasiswa
Disallow: /dosen
Disallow: /auth
Disallow: /webhook
Disallow: /*?*search=
Disallow: /*?*page=

Sitemap: https://elektronika.polidewa.ac.id/sitemap.xml
`;
  res.type('text/plain');
  res.send(robots);
});

/**
 * Webhook - Auto deploy dari GitHub dengan security
 */
app.post('/webhook', (req, res) => {
  const crypto = require('crypto');
  const signature = req.headers['x-hub-signature-256'];
  
  // Verifikasi webhook signature (jika WEBHOOK_SECRET di-set)
  if (process.env.WEBHOOK_SECRET) {
    const payload = JSON.stringify(req.body);
    const expectedSignature = 'sha256=' + 
      crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
    
    if (!signature || !crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )) {
      console.warn('⚠️ Webhook signature tidak valid');
      return res.status(401).send('Unauthorized');
    }
  }
  
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
 * Sitemap Generator - Statis + Dinamis dari Firebase dengan caching (6 jam)
 */
let sitemapCache = null;
let sitemapCacheTime = 0;
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 jam

app.get('/sitemap.xml', async (req, res) => {
  // Jika cache masih berlaku, kirim langsung
  if (sitemapCache && (Date.now() - sitemapCacheTime) < CACHE_DURATION) {
    return res.header('Content-Type', 'application/xml').send(sitemapCache);
  }

  const baseUrl = 'https://elektronika.polidewa.ac.id';
  const today = new Date().toISOString().split('T')[0];

  // URL Statis
  const staticUrls = [
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/panduan', changefreq: 'monthly', priority: 0.7 },
    { url: '/display', changefreq: 'weekly', priority: 0.6 },
    { url: '/ic3', changefreq: 'weekly', priority: 0.7 },
    { url: '/elk-library', changefreq: 'weekly', priority: 0.7 },
    { url: '/berita', changefreq: 'daily', priority: 0.8 },
    { url: '/lulusan', changefreq: 'weekly', priority: 0.6 },
    { url: '/validasi', changefreq: 'monthly', priority: 0.3 },
    // Catatan: halaman /auth/login dan /auth/register sengaja TIDAK
    // dimasukkan ke sitemap. Halaman login tidak punya nilai konten untuk
    // pencarian dan sebaiknya tidak diindeks Google.
  ];

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
    const instances = getFirebaseInstances();
    const db = instances.db;

    if (!db) {
      console.warn('⚠️ Firestore tidak tersedia, sitemap hanya berisi URL statis.');
    } else {
      const beritaSnapshot = await db.collection('berita')
        .orderBy('createdAt', 'desc')
        .limit(1000)
        .get();

      if (!beritaSnapshot.empty) {
        beritaSnapshot.forEach(doc => {
          const data = doc.data();
          const slug = data.slug || doc.id;
          let lastmod = today;

          // createdAt/updatedAt adalah string ISO, bukan Firestore Timestamp
          try {
            if (data.updatedAt) {
              const date = new Date(data.updatedAt);
              if (!isNaN(date.getTime())) {
                lastmod = date.toISOString().split('T')[0];
              }
            } else if (data.createdAt) {
              const date = new Date(data.createdAt);
              if (!isNaN(date.getTime())) {
                lastmod = date.toISOString().split('T')[0];
              }
            }
          } catch (e) {
            console.warn('⚠️ Gagal parsing tanggal untuk berita:', slug);
          }

          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/berita/${slug}</loc>\n`;
          xml += `    <lastmod>${lastmod}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.8</priority>\n';
          xml += '  </url>\n';
        });
      } else {
        console.log('ℹ️ Tidak ada berita ditemukan di Firebase');
      }

      // ============================================
      // URL DINAMIS DARI FIREBASE (ELK Library)
      // Hanya karya yang sudah "approved" yang layak
      // muncul di sitemap & diindeks Google - termasuk
      // laporan magang mahasiswa.
      // ============================================
      const elkCollections = [
        { name: 'laporanMagang', changefreq: 'monthly', priority: 0.6 },
        { name: 'penelitian', changefreq: 'monthly', priority: 0.5 },
        { name: 'pengabdian', changefreq: 'monthly', priority: 0.5 },
        { name: 'buku', changefreq: 'monthly', priority: 0.5 },
      ];

      for (const col of elkCollections) {
        try {
          const snapshot = await db.collection(col.name)
            .where('status', '==', 'approved')
            .limit(1000)
            .get();

          snapshot.forEach(doc => {
            const data = doc.data();
            let lastmod = today;
            try {
              const rawDate = data.approvedAt || data.updatedAt || data.createdAt;
              if (rawDate) {
                const date = new Date(rawDate);
                if (!isNaN(date.getTime())) lastmod = date.toISOString().split('T')[0];
              }
            } catch (e) { /* pakai lastmod default */ }

            xml += '  <url>\n';
            xml += `    <loc>${baseUrl}/elk-library/${doc.id}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>${col.changefreq}</changefreq>\n`;
            xml += `    <priority>${col.priority}</priority>\n`;
            xml += '  </url>\n';
          });
        } catch (colError) {
          console.error(`❌ Gagal ambil koleksi '${col.name}' untuk sitemap:`, colError.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Gagal ambil berita untuk sitemap:', error.message);
  }

  xml += '</urlset>';

  // Simpan cache
  sitemapCache = xml;
  sitemapCacheTime = Date.now();

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// ============================================================================
// INISIALISASI FIREBASE (ASYNC) DAN START SERVER
// ============================================================================
async function startServer() {
  try {
    // Validasi environment variables
    const requiredEnv = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
    const missingEnv = requiredEnv.filter(key => !process.env[key]);
    if (missingEnv.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnv.join(', ')}`);
    }

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
    const { verifyToken, attachUserIfLoggedIn } = require('./middleware/auth');

    // Middleware global (opsional, tidak redirect): supaya req.user tersedia
    // di semua halaman publik (landing, dokumen/layanan, cek data, panduan,
    // berita) - dipakai navbar (partials/header-landing.ejs) untuk
    // menampilkan "Dashboard/Logout" alih-alih "Login" kalau user sudah
    // login. Dipasang di sini (sebelum semua route) supaya berlaku untuk
    // seluruh route publik sekaligus tanpa perlu ditambahkan satu-satu.
    app.use(attachUserIfLoggedIn);

    // ROUTES PUBLIK
    const landingRoutes = require('./routes/landing');
    app.use('/', landingRoutes);

    // ROUTES DOKUMEN (baru)
    app.use('/dokumen', require('./routes/dokumen'));

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

    // Berita (catatan: rute publik /berita/:id sudah ditangani di routes/landing.js)
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

    // Health Check Endpoint
    app.get('/health', (req, res) => {
      const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        firebase: {
          initialized: true
        }
      };
      res.json(health);
    });

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
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Gagal inisialisasi Firebase:', error);
    process.exit(1);
  }
}

startServer();