/**
 * helpers/komunitasHelper.js
 * Logika bersama untuk fitur "Komunitas" - obrolan grup terbuka yang bisa
 * diikuti SEMUA pengguna (admin, dosen, mahasiswa) sekaligus, berbeda dari
 * Chat Kelas (kelasChatHelper.js) yang dibatasi per mata kuliah & periode
 * aktif. Dipakai oleh routes/admin/komunitas.js, routes/dosen/komunitas.js,
 * dan routes/mahasiswa/komunitas.js supaya query Firestore-nya satu sumber.
 */

const { db } = require('../config/firebaseAdmin');

const KOMUNITAS_COLLECTION = 'komunitasChat';
// Dibatasi 1 "ruang" saja untuk sekarang - kalau nanti mau dipecah per topik
// (mis. "Umum", "Lowongan Kerja", "Tanya Akademik"), tinggal tambah
// parameter `ruangId` di setiap fungsi di bawah ini.
const RUANG_DEFAULT = 'umum';

/**
 * Mengambil pesan komunitas.
 *
 * PENTING (biaya baca Firestore): jika `sejak` diisi, hanya pesan yang
 * lebih baru dari timestamp itu yang dibaca - dipakai untuk polling berkala
 * supaya tidak membaca ulang SELURUH riwayat pesan tiap beberapa detik.
 * Tanpa `sejak` (pemuatan pertama), dibatasi ke 50 pesan terakhir saja.
 *
 * @param {string} [sejak] - ISO timestamp; jika diisi hanya ambil pesan setelah ini
 * @param {string} [ruangId]
 */
async function getPesanKomunitas(sejak = null, ruangId = RUANG_DEFAULT) {
  if (sejak) {
    try {
      const snapshot = await db.collection(KOMUNITAS_COLLECTION)
        .where('ruangId', '==', ruangId)
        .where('timestamp', '>', sejak)
        .orderBy('timestamp', 'asc')
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (indexError) {
      console.error('Index komunitasChat belum siap, fallback:', indexError.message);
      const snapshot = await db.collection(KOMUNITAS_COLLECTION).where('ruangId', '==', ruangId).get();
      return snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(m => m.timestamp > sejak)
        .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
    }
  }

  try {
    const snapshot = await db.collection(KOMUNITAS_COLLECTION)
      .where('ruangId', '==', ruangId)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
  } catch (indexError) {
    console.error('Index komunitasChat belum siap, fallback:', indexError.message);
    const snapshot = await db.collection(KOMUNITAS_COLLECTION).where('ruangId', '==', ruangId).get();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
      .slice(-50);
  }
}

/**
 * Mengirim satu pesan ke komunitas.
 */
async function kirimPesanKomunitas(senderId, senderNama, senderRole, senderFoto, pesan, ruangId = RUANG_DEFAULT) {
  const docRef = await db.collection(KOMUNITAS_COLLECTION).add({
    ruangId,
    senderId,
    senderNama,
    senderRole,
    senderFoto: senderFoto || null,
    pesan,
    timestamp: new Date().toISOString()
  });
  return docRef.id;
}

/**
 * Menghapus satu pesan (moderasi). Dipanggil dari sisi admin, atau oleh
 * pengirim pesan itu sendiri.
 */
async function hapusPesanKomunitas(messageId) {
  await db.collection(KOMUNITAS_COLLECTION).doc(messageId).delete();
}

async function getPesanById(messageId) {
  const doc = await db.collection(KOMUNITAS_COLLECTION).doc(messageId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

module.exports = {
  RUANG_DEFAULT,
  getPesanKomunitas,
  kirimPesanKomunitas,
  hapusPesanKomunitas,
  getPesanById
};
