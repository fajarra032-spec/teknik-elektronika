// middleware/auth.js
const { auth, db } = require('../config/firebaseAdmin');

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

    // Coba ambil dari collection users (untuk admin & mahasiswa)
    let userDoc = await db.collection('users').doc(uid).get();

    if (userDoc.exists) {
      req.user = { id: uid, ...userDoc.data() };
    } else {
      // Coba cek di collection dosen
      const dosenSnapshot = await db.collection('dosen').where('userId', '==', uid).limit(1).get();
      if (!dosenSnapshot.empty) {
        const dosenData = dosenSnapshot.docs[0].data();
        req.user = {
          id: uid,
          nama: dosenData.nama,
          email: dosenData.email,
          role: 'dosen',
          dosenId: dosenSnapshot.docs[0].id, // simpan id dokumen dosen
          ...dosenData
        };
      } else {
        return res.redirect('/auth/login');
      }
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
    const dosenDoc = await db.collection('dosen').doc(req.user.dosenId).get();
    if (!dosenDoc.exists) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Data dosen tidak ditemukan'
      });
    }
    req.dosen = { id: dosenDoc.id, ...dosenDoc.data() };
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

    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      req.user = { id: uid, ...userDoc.data() };
    } else {
      const dosenSnapshot = await db.collection('dosen').where('userId', '==', uid).limit(1).get();
      if (!dosenSnapshot.empty) {
        const dosenData = dosenSnapshot.docs[0].data();
        req.user = {
          id: uid,
          nama: dosenData.nama,
          email: dosenData.email,
          role: 'dosen',
          dosenId: dosenSnapshot.docs[0].id,
          ...dosenData
        };
      } else {
        req.user = null;
      }
    }
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