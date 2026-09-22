// middleware/auth.js
const { auth, db } = require('../config/firebaseAdmin');
const { isBiodataLengkap } = require('../helpers/biodataHelper');
const { getUserProfileByUid } = require('../helpers/cache');

/**
 * Path yang tetap boleh diakses mahasiswa WALAUPUN biodatanya belum lengkap
 * - supaya mahasiswa bisa melengkapi biodatanya sendiri, dan tetap bisa
 * logout. Dicek dengan startsWith terhadap req.originalUrl (jadi tidak
 * peduli lewat router mana request itu masuk).
 */
const BIODATA_GATE_PENGECUALIAN = ['/mahasiswa/biodata', '/auth/logout'];

function bolehLewatiGateBiodata(originalUrl) {
  return BIODATA_GATE_PENGECUALIAN.some(prefix => originalUrl.startsWith(prefix));
}

/**
 * Middleware untuk memverifikasi token sesi dan mendapatkan data user
 */
const verifyToken = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  if (!sessionCookie) {
    return res.redirect('/auth/login');
  }

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // ✅ OPTIMISASI KUOTA PALING BERDAMPAK: sebelumnya baris ini baca
    // dokumen 'users' (atau query 'dosen') dari Firestore di SETIAP
    // request ke SETIAP halaman yang butuh login (~84 file route pakai
    // middleware ini). getUserProfileByUid() cache hasilnya 90 detik per
    // uid (helpers/cache.js) - jadi user yang klik banyak menu berturut-turut
    // tidak memicu baca Firestore berulang hanya untuk tahu identitasnya.
    const profile = await getUserProfileByUid(db, uid);

    if (profile && profile.role !== 'dosen') {
      req.user = profile;

      // ======================================================================
      // GATE BIODATA MAHASISWA: kalau role-nya mahasiswa dan biodata wajibnya
      // (NIK, TTL, alamat, data ortu, data sekolah, dst - lihat
      // helpers/biodataHelper.js) belum lengkap, paksa ke halaman lengkapi
      // biodata dulu sebelum bisa akses menu lain manapun. Berlaku untuk
      // SEMUA angkatan (bukan hanya mahasiswa baru), karena dicek di sini -
      // satu-satunya titik yang dilewati semua route mahasiswa (verifyToken
      // dipakai oleh routes/mahasiswa/index.js DAN router-router mahasiswa
      // lain yang di-mount langsung di app.js seperti edom/inspeksi/servisan/
      // kalender), jadi tidak perlu ditambahkan satu-satu di tiap router.
      // ======================================================================
      if (req.user.role === 'mahasiswa' && !bolehLewatiGateBiodata(req.originalUrl) && !isBiodataLengkap(req.user)) {
        return res.redirect('/mahasiswa/biodata/edit?wajib=1');
      }
    } else if (profile && profile.role === 'dosen') {
      req.user = profile;
    } else {
      return res.redirect('/auth/login');
    }
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.clearCookie('session');
    res.redirect('/auth/login');
  }
};

/**
 * Middleware untuk memeriksa apakah user adalah admin
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).send('Akses ditolak. Hanya untuk admin.');
  }
};

/**
 * Middleware untuk memeriksa apakah user adalah mahasiswa
 */
const isMahasiswa = (req, res, next) => {
  if (req.user && req.user.role === 'mahasiswa') {
    next();
  } else {
    res.status(403).send('Akses ditolak. Hanya untuk mahasiswa.');
  }
};

/**
 * Middleware untuk memeriksa apakah user adalah dosen
 * dan menyimpan data lengkap dosen ke req.dosen
 */
const isDosen = async (req, res, next) => {
  try {
    if (!req.user || !req.user.dosenId) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda bukan dosen'
      });
    }
    // ✅ OPTIMISASI KUOTA: sebelumnya baris ini baca ULANG dokumen dosen
    // yang PERSIS SAMA yang sudah dibaca verifyToken() beberapa baris kode
    // sebelumnya (req.user untuk role dosen sudah berisi seluruh data
    // dokumen dosen, hasil spread `...dosenData`) - jadi setiap request ke
    // 31 file route yang pakai middleware ini baca dokumen dosen 2x. Sekarang
    // req.dosen tinggal disusun dari req.user yang sudah ada, TANPA baca
    // Firestore sama sekali di sini (bukan cache - datanya memang identik).
    req.dosen = { id: req.user.dosenId, ...req.user };
    next();
  } catch (error) {
    console.error('Error in isDosen middleware:', error);
    res.status(500).render('error', {
      title: 'Error Server',
      message: 'Terjadi kesalahan saat memverifikasi dosen'
    });
  }
};

/**
 * Middleware untuk memeriksa apakah user adalah admin atau dosen
 */
const isAdminOrDosen = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'dosen')) {
    next();
  } else {
    res.status(403).send('Akses ditolak. Hanya untuk admin atau dosen.');
  }
};

/**
 * Middleware OPSIONAL: coba kenali user yang sedang login (dari session
 * cookie), tapi TIDAK PERNAH redirect/blokir kalau belum login atau
 * cookie-nya tidak valid - selalu lanjut ke next(). Beda dengan verifyToken
 * yang wajib login.
 *
 * Dipakai secara global di app.js supaya req.user tersedia di halaman
 * publik (landing, dokumen/layanan, cek data, panduan, dll) - dipakai
 * partials/header-landing.ejs untuk menampilkan menu "Dashboard/Logout"
 * alih-alih "Login" kalau user sudah login. Sebelumnya halaman-halaman
 * publik ini tidak pernah diberi middleware auth sama sekali, jadi req.user
 * selalu undefined dan navbar selalu menampilkan "Login" walau user sudah
 * login di tab/kunjungan lain.
 */
const attachUserIfLoggedIn = async (req, res, next) => {
  const sessionCookie = req.cookies && req.cookies.session;
  if (!sessionCookie) {
    req.user = null;
    return next();
  }

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;

    // Sama seperti verifyToken() - pakai cache 90 detik, bukan baca
    // Firestore di setiap request (middleware ini jalan di SEMUA halaman,
    // termasuk yang publik seperti landing page).
    req.user = await getUserProfileByUid(db, uid);
  } catch (error) {
    // Cookie kadaluarsa/tidak valid - anggap saja belum login, jangan
    // clear cookie atau redirect di sini (biarkan verifyToken yang urus
    // itu di halaman yang memang wajib login).
    req.user = null;
  }

  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isMahasiswa,
  isDosen,
  isAdminOrDosen,
  attachUserIfLoggedIn
};