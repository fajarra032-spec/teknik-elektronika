/**
 * helpers/notificationHelper.js
 * Logika bersama untuk fitur Notifikasi (lonceng di navbar).
 *
 * Skema koleksi Firestore 'notifications':
 *   { userId, type, title, message, link, read: boolean, createdAt: ISOString }
 *
 * Catatan performa: notifikasi dibaca (hitung belum-dibaca + daftar terbaru)
 * di SETIAP halaman yang dibuka user yang sudah login, karena ditampilkan di
 * navbar (lihat middleware navbarBadges di app.js). Supaya tidak membaca
 * Firestore berulang-ulang saat user berpindah halaman dengan cepat, hasilnya
 * di-cache per user selama beberapa detik saja - cukup singkat supaya
 * notifikasi baru tetap terasa "hampir langsung" muncul setelah refresh,
 * tapi tetap memangkas mayoritas baca berulang. Pola cache ini sama seperti
 * userProfileCache di helpers/cache.js.
 */

const { TTLCache } = require('./cache');
// Teruskan ke WhatsApp (mati kecuali WA_AUTO_ENABLED=true; tidak pernah melempar error).
const waNotifier = require('./waNotifier');

// 60 detik (dulu 15): navbar dibangun di setiap halaman. Cache user dihapus
// langsung saat notifikasi dibuat / dibaca, jadi angka tetap terasa real-time.
const NAVBAR_TTL_MS = 60 * 1000;
const navbarNotifCache = new TTLCache(NAVBAR_TTL_MS);

const COLLECTION = 'notifications';
const NAVBAR_LIMIT = 6; // jumlah item yang ditampilkan di dropdown navbar

/**
 * Buat satu notifikasi untuk satu user.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} userId - uid (id dokumen 'users', atau uid dosen)
 * @param {{type: string, title: string, message?: string, link?: string}} data
 */
async function createNotification(db, userId, data) {
  if (!userId || !data || !data.title) return null;
  const doc = {
    userId,
    type: data.type || 'info',
    title: data.title,
    message: data.message || '',
    link: data.link || null,
    read: false,
    createdAt: new Date().toISOString()
  };
  const ref = await db.collection(COLLECTION).add(doc);
  navbarNotifCache.delete(userId); // biar langsung kehitung di halaman berikutnya
  waNotifier.enqueue(db, userId, doc); // WhatsApp otomatis (tanpa await)
  return { id: ref.id, ...doc };
}

/**
 * Buat notifikasi dengan ID dokumen deterministik: kalau ID itu sudah ada,
 * tidak dibuat lagi (aman dipanggil berulang untuk pengingat harian/berkala).
 * @returns {Promise<boolean>} true bila notifikasi baru dibuat
 */
async function createNotificationOnce(db, userId, docId, data) {
  if (!userId || !docId || !data || !data.title) return false;
  const ref = db.collection(COLLECTION).doc(docId);
  const ada = await ref.get();
  if (ada.exists) return false;
  const doc = {
    userId,
    type: data.type || 'info',
    title: data.title,
    message: data.message || '',
    link: data.link || null,
    read: false,
    createdAt: new Date().toISOString()
  };
  await ref.set(doc);
  navbarNotifCache.delete(userId);
  waNotifier.enqueue(db, userId, doc); // WhatsApp otomatis (tanpa await)
  return true;
}

/**
 * Buat notifikasi yang sama untuk banyak user sekaligus (mis. seluruh
 * mahasiswa satu kelas). Dipakai untuk pemicu yang target-nya jelas &
 * terbatas jumlahnya - JANGAN dipakai untuk broadcast ke seluruh pengguna
 * aplikasi (bisa ratusan/ribuan write Firestore sekaligus).
 * @param {FirebaseFirestore.Firestore} db
 * @param {string[]} userIds
 * @param {{type: string, title: string, message?: string, link?: string}} data
 */
async function createNotificationForUsers(db, userIds, data) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (unique.length === 0) return;
  const batch = db.batch();
  const now = new Date().toISOString();
  unique.forEach(uid => {
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, {
      userId: uid,
      type: data.type || 'info',
      title: data.title,
      message: data.message || '',
      link: data.link || null,
      read: false,
      createdAt: now
    });
  });
  await batch.commit();
  unique.forEach(uid => {
    navbarNotifCache.delete(uid);
    waNotifier.enqueue(db, uid, { type: data.type || 'info', title: data.title, message: data.message || '', link: data.link || null });
  });
}

/**
 * Ambil ringkasan untuk navbar: jumlah belum dibaca + beberapa notifikasi
 * terbaru (dibaca maupun belum). Hasilnya di-cache singkat per user.
 */
async function getNavbarSummary(db, userId) {
  // Cadangan: pastikan penjadwal pengingat kuliah berjalan (idempotent; no-op bila WA mati).
  try { require('./kuliahReminderHelper').mulai(db); } catch (_) { /* jangan ganggu navbar */ }
  if (!userId) return { unreadCount: 0, items: [] };
  return navbarNotifCache.getOrFetch(userId, async () => {
    // Dua query berjalan paralel. Jumlah belum dibaca memakai count()
    // (agregasi): dihitung sebagai ~1 read berapa pun jumlahnya, bukan
    // membaca sampai 50 dokumen hanya untuk mengambil angkanya.
    const [snap, unreadAgg] = await Promise.all([
      db.collection(COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(NAVBAR_LIMIT)
        .get(),
      db.collection(COLLECTION)
        .where('userId', '==', userId)
        .where('read', '==', false)
        .count()
        .get()
    ]);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return { unreadCount: unreadAgg.data().count, items };
  });
}

/** Daftar notifikasi lengkap (halaman /notifikasi), terbaru dulu. */
async function getAllNotifications(db, userId, limit = 50) {
  const snap = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Tandai satu notifikasi sudah dibaca (memastikan itu milik userId ybs). */
async function markAsRead(db, userId, notifId) {
  const ref = db.collection(COLLECTION).doc(notifId);
  const doc = await ref.get();
  if (!doc.exists || doc.data().userId !== userId) return false;
  await ref.update({ read: true });
  navbarNotifCache.delete(userId);
  return true;
}

/** Tandai SEMUA notifikasi milik user sebagai sudah dibaca. */
async function markAllAsRead(db, userId) {
  const snap = await db.collection(COLLECTION)
    .where('userId', '==', userId)
    .where('read', '==', false)
    .limit(200)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
  navbarNotifCache.delete(userId);
}

/** Hapus satu notifikasi milik userId (memastikan itu miliknya). */
async function deleteNotification(db, userId, notifId) {
  const ref = db.collection(COLLECTION).doc(notifId);
  const doc = await ref.get();
  if (!doc.exists || doc.data().userId !== userId) return false;
  await ref.delete();
  navbarNotifCache.delete(userId);
  return true;
}

/**
 * Hapus (bersihkan) notifikasi milik user. Dikerjakan per 400 dokumen sampai
 * habis (maks. 5 putaran = 2000 dokumen per panggilan, cukup untuk pemakaian wajar).
 * @param {{hanyaDibaca?: boolean}} opsi - true: hanya yang sudah dibaca
 * @returns {Promise<number>} jumlah yang terhapus
 */
async function deleteAllNotifications(db, userId, opsi = {}) {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    let q = db.collection(COLLECTION).where('userId', '==', userId);
    if (opsi.hanyaDibaca) q = q.where('read', '==', true);
    const snap = await q.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < 400) break;
  }
  navbarNotifCache.delete(userId);
  return total;
}

module.exports = {
  createNotification,
  createNotificationOnce,
  createNotificationForUsers,
  getNavbarSummary,
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
};
