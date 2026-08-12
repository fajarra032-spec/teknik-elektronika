// ==================== HELPER NOTIFIKASI (dipakai bersama) ====================
const { admin, db } = require('../config/firebase');

// Notifikasi untuk 1 user
async function notifyUser({ userId, type, title, message, link }) {
  if (!userId) return;
  await db.collection('notifications').add({
    userId, type, title, message, link: link || null,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// Notifikasi untuk banyak user sekaligus (mis. semua siswa di satu kelas)
async function notifyManyUsers({ userIds, type, title, message, link }) {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return;
  const batch = db.batch();
  ids.forEach(uid => {
    const ref = db.collection('notifications').doc();
    batch.set(ref, {
      userId: uid, type, title, message, link: link || null,
      isRead: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

module.exports = { notifyUser, notifyManyUsers };
