// ==================== KOMPRESI GAMBAR (sebelum upload ke Drive) ====================
// Dipelajari dari pola referensi: resize ke lebar maksimal 800px + kompres ke JPEG
// kualitas 80% supaya foto tidak memakan storage Drive secara berlebihan, sekaligus
// mempercepat loading di dashboard & sertifikat.
const sharp = require('sharp');

async function compressImage(buffer, { width = 800, quality = 80 } = {}) {
  return sharp(buffer)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

module.exports = { compressImage };
