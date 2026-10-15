/**
 * scripts/perbaiki-gambar-berita.js
 * Memperbaiki gambar berita lama yang diunggah ke Drive:
 *  - membagikan file Drive secara publik (reader / anyone)
 *  - mengganti field `gambar` dari webViewLink ke URL thumbnail yang bisa dipakai di <img>
 * Aman dijalankan berulang. Jalankan dari root proyek:  node scripts/perbaiki-gambar-berita.js
 */
const { db } = require('../config/firebaseAdmin');
const drive = require('../config/googleDrive');

(async () => {
  const snap = await db.collection('berita').get();
  let ok = 0, lewat = 0, gagal = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.gambarFileId) { lewat++; continue; }
    try {
      await drive.permissions.create({ fileId: d.gambarFileId, requestBody: { role: 'reader', type: 'anyone' } });
      await doc.ref.update({ gambar: `https://drive.google.com/thumbnail?id=${d.gambarFileId}&sz=w1600` });
      ok++;
    } catch (e) {
      gagal++;
      console.error('Gagal', doc.id, e.message);
    }
  }
  console.log(`Selesai. Diperbaiki: ${ok}, dilewati (tanpa file Drive): ${lewat}, gagal: ${gagal}`);
  process.exit(0);
})();
