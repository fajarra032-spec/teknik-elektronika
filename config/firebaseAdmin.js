// config/firebaseAdmin.js
const admin = require('firebase-admin');
require('dotenv').config();

let db, auth;

try {
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin SDK initialized with environment variables');
  } else {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin SDK initialized with service account file');
  }

  db = admin.firestore();
  auth = admin.auth();
  console.log('✅ Firestore dan Auth siap');
} catch (error) {
  console.error('❌ Gagal inisialisasi Firebase Admin SDK:', error.message);
  // Tidak exit, biarkan db dan auth null
}

// Fungsi dummy untuk kompatibilitas dengan app.js
function setFirebaseInstances(instances) {
  // Jika diperlukan, bisa simpan ke global
  if (instances) {
    global.db = instances.db;
    global.auth = instances.auth;
  } else {
    // Jika dipanggil tanpa argumen, set global dari instance yang sudah ada
    global.db = db;
    global.auth = auth;
  }
}

/**
 * Pasangan setFirebaseInstances() di atas - sebelumnya TIDAK ADA sama
 * sekali, padahal app.js mengimpor & memanggilnya (getFirebaseInstances()
 * di rute /sitemap.xml). Akibatnya rute itu selalu lempar
 * "getFirebaseInstances is not a function" (tertangkap try/catch di
 * app.js, jadi tidak crash - tapi sitemap jadi selalu cuma berisi URL
 * statis, URL berita/dokumen dinamis tidak pernah ikut masuk).
 * Baca dari global.db/global.auth dulu (yang di-set app.js lewat
 * setFirebaseInstances saat startup, pakai instance Firebase Admin SDK
 * miliknya sendiri), baru fallback ke db/auth hasil inisialisasi di file
 * ini kalau global belum di-set.
 */
function getFirebaseInstances() {
  return {
    admin,
    db: global.db || db,
    auth: global.auth || auth
  };
}

module.exports = { admin, db, auth, setFirebaseInstances, getFirebaseInstances };