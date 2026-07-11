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

module.exports = { TTLCache, mataKuliahCache, dosenCache, tugasAktifCache };
