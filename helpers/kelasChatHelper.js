/**
 * helpers/kelasChatHelper.js
 * Logika bersama untuk fitur Chat Kelas (obrolan grup per mata kuliah).
 * Dipakai oleh routes/mahasiswa/kelasChat.js dan routes/dosen/kelasChat.js
 * supaya query Firestore-nya satu sumber, tidak terduplikasi.
 */

const { db } = require('../config/firebaseAdmin');
const { getPeriodeAktif } = require('./nilaiHelper');

/**
 * Mengambil daftar peserta kelas (mahasiswa yang aktif terdaftar + dosen
 * pengampu) untuk satu mata kuliah pada periode aktif, lengkap dengan foto
 * profil untuk ditampilkan sebagai kartu profil saat diklik.
 * @param {string} mkId
 * @returns {Promise<Array>} daftar peserta { id, nama, role, foto, ...detail }
 */
async function getPesertaKelas(mkId) {
  const periode = getPeriodeAktif();
  const peserta = [];

  // Dosen pengampu
  const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
  const mkData = mkDoc.exists ? mkDoc.data() : {};
  const dosenIds = mkData.dosenIds || [];
  for (const dosenId of dosenIds) {
    const dosenDoc = await db.collection('dosen').doc(dosenId).get();
    if (dosenDoc.exists) {
      const d = dosenDoc.data();
      peserta.push({
        id: dosenId,
        role: 'dosen',
        nama: d.nama || '-',
        identitas: d.nip || '-',
        foto: d.foto || null,
        email: d.email || '',
        kontak: d.kontak || ''
      });
    }
  }

  // Mahasiswa yang aktif terdaftar di MK ini pada periode aktif
  const enrollmentSnapshot = await db.collection('enrollment')
    .where('mkId', '==', mkId)
    .where('semester', '==', periode)
    .where('status', '==', 'active')
    .get();

  for (const doc of enrollmentSnapshot.docs) {
    const userId = doc.data().userId;
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const u = userDoc.data();
      peserta.push({
        id: userId,
        role: 'mahasiswa',
        nama: u.nama || '-',
        identitas: u.nim || '-',
        foto: u.foto || null,
        email: u.email || '',
        kontak: u.noHp || u.telepon || '',
        angkatan: u.angkatan || '-',
        prodi: u.prodi || 'Teknik Elektronika'
      });
    }
  }

  return { peserta, periode, mkData: { id: mkId, ...mkData } };
}

/**
 * Memastikan seorang mahasiswa berhak mengakses chat kelas ini (harus
 * terdaftar aktif di MK tsb pada periode aktif).
 */
async function isMahasiswaPesertaKelas(mkId, userId) {
  const periode = getPeriodeAktif();
  const snapshot = await db.collection('enrollment')
    .where('mkId', '==', mkId)
    .where('userId', '==', userId)
    .where('semester', '==', periode)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  return !snapshot.empty;
}

/**
 * Memastikan seorang dosen adalah pengampu MK ini.
 */
async function isDosenPengampuMk(mkId, dosenId) {
  const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
  if (!mkDoc.exists) return false;
  const dosenIds = mkDoc.data().dosenIds || [];
  return dosenIds.includes(dosenId);
}

/**
 * Mengambil seluruh pesan chat kelas untuk satu MK pada periode aktif,
 * diurutkan dari yang paling lama ke yang terbaru.
 */
async function getPesanKelas(mkId) {
  const periode = getPeriodeAktif();
  const snapshot = await db.collection('kelasChat')
    .where('mkId', '==', mkId)
    .where('periode', '==', periode)
    .orderBy('timestamp', 'asc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Mengirim satu pesan ke chat kelas.
 */
async function kirimPesanKelas(mkId, senderId, senderNama, senderRole, pesan) {
  const periode = getPeriodeAktif();
  const docRef = await db.collection('kelasChat').add({
    mkId,
    periode,
    senderId,
    senderNama,
    senderRole,
    pesan,
    timestamp: new Date().toISOString()
  });
  return docRef.id;
}

module.exports = {
  getPesertaKelas,
  isMahasiswaPesertaKelas,
  isDosenPengampuMk,
  getPesanKelas,
  kirimPesanKelas
};
