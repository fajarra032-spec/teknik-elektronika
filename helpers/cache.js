/**
 * helpers/cache.js
 * Cache in-memory sederhana dengan TTL (time-to-live), untuk mengurangi
 * pembacaan Firestore yang berulang-ulang pada data yang jarang berubah
 * (mis. data mata kuliah, daftar dosen). Pola ini sudah dipakai dengan baik
 * di routes/display.js — helper ini menyediakannya untuk dipakai bersama
 * di seluruh aplikasi.
 *
 * PENTING: cache ini per-proses (in-memory). Jika aplikasi berjalan di lebih
 * dari satu instance/container, masing-masing instance punya cache sendiri
 * (tidak dibagi). Ini tetap aman untuk data yang boleh sedikit basi (stale)
 * selama beberapa menit, seperti nama dosen atau info mata kuliah.
 */

class TTLCache {
  /**
   * @param {number} ttlMs - masa berlaku cache dalam milidetik (default 5 menit)
   */
  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.store = new Map(); // key -> { value, expiresAt }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  /**
   * Ambil dari cache; jika tidak ada/kedaluwarsa, jalankan fetchFn untuk
   * mengambil nilai baru, simpan ke cache, lalu kembalikan.
   * @param {string} key
   * @param {() => Promise<any>} fetchFn
   */
  async getOrFetch(key, fetchFn) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fetchFn();
    this.set(key, value);
    return value;
  }
}

// Cache bersama untuk data referensi yang jarang berubah
const mataKuliahCache = new TTLCache(10 * 60 * 1000); // 10 menit
const dosenCache = new TTLCache(10 * 60 * 1000);      // 10 menit
const tugasAktifCache = new TTLCache(3 * 60 * 1000);  // 3 menit (lebih singkat karena lebih dinamis)

// Daftar mahasiswa (role='mahasiswa') dipakai di banyak tempat (landing page,
// papan display, direktori pencarian) dan sebelumnya di-fetch ULANG dari
// awal (scan seluruh koleksi `users`) di SETIAP kunjungan halaman publik -
// salah satu sumber pemborosan read terbesar di aplikasi ini. Data mahasiswa
// tidak berubah tiap menit, jadi aman di-cache 10 menit dan dipakai bersama
// (shared) oleh semua route lewat helper getAllMahasiswa() di bawah.
const mahasiswaCache = new TTLCache(10 * 60 * 1000); // 10 menit

/**
 * Ambil semua dokumen user dengan role='mahasiswa', dari cache kalau masih
 * berlaku. Mengembalikan array plain object (bukan QuerySnapshot) supaya
 * gampang dipakai ulang di berbagai route tanpa perlu tahu detail Firestore.
 * @param {import('firebase-admin').firestore.Firestore} db
 * @returns {Promise<Array<Object>>}
 */
async function getAllMahasiswa(db) {
  return mahasiswaCache.getOrFetch('all', async () => {
    const snap = await db.collection('users').where('role', '==', 'mahasiswa').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
}

/**
 * Ambil semua dokumen mataKuliah (urut kode), dari cache kalau masih
 * berlaku. Dipakai di banyak halaman admin (rekap nilai, KRS, dsb) yang
 * masing-masing sebelumnya query 'mataKuliah' sendiri-sendiri padahal
 * datanya sama dan jarang berubah.
 * @param {import('firebase-admin').firestore.Firestore} db
 * @returns {Promise<Array<Object>>}
 */
async function getAllMataKuliah(db) {
  return mataKuliahCache.getOrFetch('all', async () => {
    const snap = await db.collection('mataKuliah').orderBy('kode').get();
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
}

// Daftar semester unik yang PERNAH punya entri logbook, per mahasiswa.
// Dipakai untuk dropdown filter semester di halaman detail logbook dosen -
// sebelumnya dihitung dengan membaca SEMUA dokumen logbook mahasiswa (bisa
// 100+ dokumen per mahasiswa) hanya untuk mengumpulkan nilai field
// `semester` yang unik. TTL pendek (2 menit) karena nilainya bisa
// bertambah tiap mahasiswa mengisi logbook baru - lihat cache.delete()
// di routes/mahasiswa/magang.js sesudah logbook baru dibuat.
const logbookSemesterCache = new TTLCache(2 * 60 * 1000); // 2 menit

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} userId
 * @returns {Promise<string[]>} daftar semester unik, terurut
 */
async function getSemesterListLogbook(db, userId) {
  return logbookSemesterCache.getOrFetch(userId, async () => {
    const snap = await db.collection('logbookMagang').where('userId', '==', userId).get();
    const semesterSet = new Set();
    snap.docs.forEach(doc => {
      const s = doc.data().semester;
      if (s) semesterSet.add(s);
    });
    return Array.from(semesterSet).sort();
  });
}

// ============================================================================
// CACHE PROFIL USER UNTUK MIDDLEWARE AUTH (verifyToken / attachUserIfLoggedIn)
// ============================================================================
// Ini cache PALING BERDAMPAK di seluruh aplikasi: verifyToken() dipakai di
// ~84 file route (praktis SEMUA halaman admin/dosen/mahasiswa) dan
// attachUserIfLoggedIn() jalan di SEMUA request (termasuk halaman publik).
// Sebelumnya, SETIAP kali user klik satu link/menu, middleware ini baca
// dokumen 'users' (atau query 'dosen') dari Firestore ULANG - jadi 1
// kunjungan admin yang klik 10 menu = minimal 10 baca dokumen HANYA untuk
// tahu "siapa yang sedang login", di luar baca data halaman itu sendiri.
//
// TTL sengaja pendek (90 detik) karena ini menyangkut identitas/otorisasi -
// kalau admin mengubah role/data seseorang, perubahan idealnya cepat
// terlihat. 90 detik adalah kompromi: cukup untuk memangkas mayoritas baca
// berulang saat seseorang berpindah-pindah halaman dengan cepat, tapi tidak
// membuat perubahan penting (mis. reset biodata gate) basi terlalu lama.
// Untuk kasus yang butuh langsung fresh (mis. submit biodata sendiri),
// panggil invalidateUserProfile(uid) - lihat pemakaiannya di
// routes/mahasiswa/biodata.js.
const userProfileCache = new TTLCache(90 * 1000); // 90 detik

/**
 * Cari identitas user berdasarkan uid: coba di collection 'users' dulu
 * (admin/mahasiswa), kalau tidak ada baru cek 'dosen'. Hasilnya di-cache
 * per uid selama 90 detik supaya middleware auth tidak baca Firestore
 * ulang di setiap request dari user yang sama.
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} uid
 * @returns {Promise<Object|null>} objek user siap pakai untuk req.user, atau null kalau tidak ditemukan
 */
async function getUserProfileByUid(db, uid) {
  return userProfileCache.getOrFetch(uid, async () => {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      return { id: uid, ...userDoc.data() };
    }
    const dosenSnapshot = await db.collection('dosen').where('userId', '==', uid).limit(1).get();
    if (!dosenSnapshot.empty) {
      const dosenData = dosenSnapshot.docs[0].data();
      return {
        id: uid,
        nama: dosenData.nama,
        email: dosenData.email,
        role: 'dosen',
        dosenId: dosenSnapshot.docs[0].id,
        ...dosenData
      };
    }
    return null; // tidak terdaftar sama sekali
  });
}

/** Hapus cache profil satu user - panggil setiap kali data user/dosen itu berubah. */
function invalidateUserProfile(uid) {
  userProfileCache.delete(uid);
}

module.exports = {
  TTLCache,
  mataKuliahCache,
  dosenCache,
  tugasAktifCache,
  mahasiswaCache,
  getAllMahasiswa,
  getAllMataKuliah,
  logbookSemesterCache,
  getSemesterListLogbook,
  userProfileCache,
  getUserProfileByUid,
  invalidateUserProfile
};
