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

const NAVBAR_TTL_MS = 15 * 1000; // 15 detik
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
  return { id: ref.id, ...doc };
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
  unique.forEach(uid => navbarNotifCache.delete(uid));
}

/**
 * Ambil ringkasan untuk navbar: jumlah belum dibaca + beberapa notifikasi
 * terbaru (dibaca maupun belum). Hasilnya di-cache singkat per user.
 */
async function getNavbarSummary(db, userId) {
  if (!userId) return { unreadCount: 0, items: [] };
  return navbarNotifCache.getOrFetch(userId, async () => {
    const snap = await db.collection(COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(NAVBAR_LIMIT)
      .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const unreadSnap = await db.collection(COLLECTION)
      .where('userId', '==', userId)
      .where('read', '==', false)
      .limit(50) // cukup untuk badge "50+", tidak perlu hitung persis kalau sudah banyak
      .get();

    return { unreadCount: unreadSnap.size, items };
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

module.exports = {
  createNotification,
  createNotificationForUsers,
  getNavbarSummary,
  getAllNotifications,
  markAsRead,
  markAllAsRead
};
