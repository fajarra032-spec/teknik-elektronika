// helpers/fotoDuplikatHelper.js
// ============================================================================
// DETEKSI FOTO DOKUMENTASI LOGBOOK YANG SAMA
//
// Sidik foto = dHash 64-bit (perceptual hash): tahan terhadap kompresi ulang,
// perubahan ukuran, dan kiriman ulang via WhatsApp, sehingga foto yang sama
// tetap terdeteksi walau byte filenya berbeda.
//
// Daftar sidik disimpan di koleksi `fotoLogbookHash` dengan ID dokumen
// `${userId}_${hash}`, jadi pengecekan cukup 1x get() per foto (tanpa
// memindai seluruh logbook => hemat kuota Firestore).
// ============================================================================
const sharp = require('sharp');
const { db } = require('../config/firebaseAdmin');

const KOLEKSI = 'fotoLogbookHash';

/** dHash 64-bit (16 karakter hex) dari buffer gambar. */
async function hashFoto(buffer) {
  const px = await sharp(buffer)
    .rotate()                       // ikuti orientasi EXIF (foto HP)
    .resize(9, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += px[y * 9 + x] < px[y * 9 + x + 1] ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.substr(i, 4), 2).toString(16);
  return hex;
}

const docId = (userId, hash) => `${userId}_${hash}`;

/** True bila foto dengan sidik ini sudah pernah diunggah mahasiswa tsb. */
async function sudahAda(userId, hash) {
  const snap = await db.collection(KOLEKSI).doc(docId(userId, hash)).get();
  return snap.exists;
}

/** Catat sidik foto yang baru tersimpan (dipanggil setelah entri logbook dibuat/diperbarui). */
async function catatHash(userId, logbookId, daftar) {
  if (!daftar || !daftar.length) return;
  const batch = db.batch();
  daftar.forEach(({ hash, fileId }) => {
    batch.set(db.collection(KOLEKSI).doc(docId(userId, hash)), {
      userId, logbookId, hash, fileId: fileId || '', createdAt: new Date().toISOString()
    });
  });
  await batch.commit();
}

/** Hapus catatan sidik (saat entri logbook dihapus) agar foto boleh diunggah lagi. */
async function hapusHash(userId, hashes) {
  if (!hashes || !hashes.length) return;
  const batch = db.batch();
  hashes.forEach((h) => batch.delete(db.collection(KOLEKSI).doc(docId(userId, h))));
  await batch.commit();
}

module.exports = { hashFoto, sudahAda, catatHash, hapusHash };
