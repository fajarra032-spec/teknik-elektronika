/**
 * helpers/fotoAlatHelper.js
 * Upload / hapus foto alat lab di Google Drive (pola sama dengan modul servisan:
 * folder "Data WEB", gambar dikompres sharp, dibuat publik-baca).
 */
const { Readable } = require('stream');
const sharp = require('sharp');

const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';
const NAMA_FOLDER = 'Foto Alat Lab';

// drive di-require saat dipakai (bukan saat file dimuat) supaya modul lain
// tidak ikut gagal bila kredensial Google belum tersedia.
const getDrive = () => require('../config/googleDrive');

async function folderFoto(drive) {
  const q = await drive.files.list({
    q: `'${DATA_WEB_FOLDER_ID}' in parents and name='${NAMA_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)'
  });
  if (q.data.files.length) return q.data.files[0].id;
  const f = await drive.files.create({
    resource: { name: NAMA_FOLDER, mimeType: 'application/vnd.google-apps.folder', parents: [DATA_WEB_FOLDER_ID] },
    fields: 'id'
  });
  return f.data.id;
}

/** Kompres & unggah foto. @returns {{fotoUrl:string, fotoFileId:string}} */
async function simpanFoto(buffer, kodeAlat) {
  const drive = getDrive();
  const jpeg = await sharp(buffer).rotate().resize({ width: 800, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const parent = await folderFoto(drive);
  const nama = `${String(kodeAlat || 'alat').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.jpg`;
  const res = await drive.files.create({
    resource: { name: nama, parents: [parent] },
    media: { mimeType: 'image/jpeg', body: Readable.from(jpeg) },
    fields: 'id'
  });
  await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  // thumbnail?id=...&sz=w1000 lebih konsisten tampil di <img> daripada uc?export=view
  // (konvensi yang sama dipakai di views/landing/*.ejs)
  return { fotoUrl: `https://drive.google.com/thumbnail?id=${res.data.id}&sz=w1000`, fotoFileId: res.data.id };
}

/** Hapus foto di Drive. Tidak pernah melempar error (best effort). */
async function hapusFoto(fileId) {
  if (!fileId) return;
  try { await getDrive().files.delete({ fileId }); }
  catch (err) { console.error('Gagal hapus foto alat di Drive:', err.message); }
}

module.exports = { simpanFoto, hapusFoto };
