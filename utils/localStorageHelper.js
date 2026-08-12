// ==================== PENYIMPANAN FILE LOKAL (PENGGANTI GOOGLE DRIVE) ====================
// v3.0 Migrasi MariaDB: server ini sekarang jalan di Armbian/STB lokal tanpa akses
// internet ke Google Drive, jadi file (materi, foto profil, foto galeri, bukti
// pembayaran, dst) disimpan langsung di disk server, di folder /uploads, dan
// disajikan lewat express.static (lihat app.js: app.use('/uploads', ...)).
//
// Fungsi & bentuk hasil (fileId/fileUrl/previewUrl) SENGAJA dibuat sama persis
// dengan utils/googleDriveHelper.js supaya route yang sudah ada (admin-programs,
// admin-gallery, account) tidak perlu diubah logikanya — cukup ganti baris
// `require('../utils/googleDriveHelper')` menjadi `require('../utils/localStorageHelper')`.
const fs = require('fs');
const path = require('path');

// Lokasi folder upload BISA diatur lewat .env (UPLOAD_DIR) — penting supaya bisa
// diarahkan ke storage eksternal (USB/SD card) yang di-mount, bukan eMMC internal
// board Armbian (eMMC biasanya kecil & umur tulis-nya terbatas). Kalau UPLOAD_DIR
// tidak diisi, default-nya tetap <root project>/uploads seperti sebelumnya.
const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

function sanitizeSegment(name) {
  // Cegah path traversal & karakter aneh di nama folder/file, tetap izinkan
  // huruf, angka, spasi, titik, strip, underscore (nama folder di Drive dulu
  // sering pakai spasi, misal "Foto Akun").
  return String(name).replace(/[^a-zA-Z0-9 _.\-]/g, '_').trim() || 'file';
}

/**
 * Penyimpanan lokal selalu tersedia (tidak butuh kredensial API apa pun),
 * beda dengan Google Drive yang perlu OAuth. Nama fungsi dipertahankan
 * (isDriveConfigured) supaya kompatibel dengan kode pemanggil yang sudah ada.
 */
function isDriveConfigured() {
  return true;
}

/**
 * Padanan getNestedFolder(['ELMS', 'Materi', 'General English']) versi Drive:
 * di sini cukup memastikan folder bertingkat itu ada di disk, dan mengembalikan
 * path relatifnya (dipakai sebagai "folderId" oleh kode pemanggil).
 */
async function getNestedFolder(pathParts) {
  const safeParts = pathParts.map(sanitizeSegment);
  const relDir = path.join(...safeParts);
  const absDir = path.join(UPLOAD_ROOT, relDir);
  await fs.promises.mkdir(absDir, { recursive: true });
  return relDir; // "folderId" di sini adalah path relatif dari UPLOAD_ROOT
}

/**
 * Simpan buffer (dari multer memoryStorage) ke disk lokal.
 * @returns {Promise<{fileId: string, fileUrl: string, previewUrl: string}>}
 *   fileId    -> path relatif file (dipakai untuk hapus nanti)
 *   fileUrl   -> URL publik untuk <img src="...">/<video src="...">
 *   previewUrl-> sama seperti fileUrl (di lokal tidak ada mode "preview" khusus)
 */
async function uploadBufferToDrive({ buffer, fileName, mimeType, folderId }) {
  const safeFileName = sanitizeSegment(fileName);
  const relPath = path.join(folderId, safeFileName);
  const absPath = path.join(UPLOAD_ROOT, relPath);
  await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
  await fs.promises.writeFile(absPath, buffer);

  // Path URL selalu pakai forward-slash walau di server Windows sekalipun.
  const urlPath = relPath.split(path.sep).join('/');
  const fileUrl = `/uploads/${urlPath}`;

  return {
    fileId: relPath,
    fileUrl,
    previewUrl: fileUrl
  };
}

/**
 * Hapus file lokal (best-effort — kalau memang sudah tidak ada, cukup dicatat
 * di log, tidak melempar error yang menggagalkan proses utama).
 */
async function deleteDriveFile(fileId) {
  if (!fileId) return;
  try {
    const absPath = path.join(UPLOAD_ROOT, fileId);
    await fs.promises.unlink(absPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[Storage Lokal] Gagal hapus file:', fileId, err.message);
    }
  }
}

module.exports = { isDriveConfigured, getNestedFolder, uploadBufferToDrive, deleteDriveFile };
