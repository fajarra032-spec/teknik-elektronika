// helpers/cacheHelper.js
//
// Cache in-memory sederhana (per proses Node, bukan Redis) buat data yang
// SERING dibaca ulang tapi JARANG berubah - contoh paling boros sebelumnya:
// daftar mahasiswa di admin, yang membaca ULANG SELURUH koleksi `users`
// (role=mahasiswa) di SETIAP kali halaman dibuka, padahal datanya baru
// berubah kalau ada admin yang tambah/edit/hapus/impor mahasiswa.
//
// Dengan cache ber-TTL (kadaluarsa otomatis) + invalidate manual saat data
// diubah, pembacaan Firestore yang sesungguhnya cuma terjadi sesekali,
// bukan di setiap request - jadi kuota baca jauh lebih hemat dan halaman
// terasa lebih cepat (tidak perlu network round-trip ke Firestore tiap buka).
//
// PENTING: cache ini per-proses Node. Kalau aplikasi dijalankan lebih dari
// satu instance (mis. beberapa dyno/container), masing-masing instance
// punya cache sendiri - itu wajar dan tetap aman (tidak ada instance yang
// menyajikan data basi lebih dari TTL yang ditentukan).

const store = new Map(); // key -> { value, expiresAt }

/**
 * Ambil dari cache kalau masih berlaku; kalau tidak ada / sudah kedaluwarsa,
 * jalankan fetchFn(), simpan hasilnya, lalu kembalikan.
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<any>} fetchFn
 */
async function getOrSet(key, ttlMs, fetchFn) {
  const now = Date.now();
  const cached = store.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await fetchFn();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/** Hapus satu entri cache (dipanggil setelah data terkait diubah/dihapus). */
function invalidate(key) {
  store.delete(key);
}

/** Hapus semua entri cache yang key-nya diawali prefix tertentu. */
function invalidatePrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = { getOrSet, invalidate, invalidatePrefix };
