/**
 * routes/dosen/sertifikat.js
 * Sertifikat Dosen: dosen dapat mengunggah sertifikat kompetensi/pelatihan
 * milik sendiri, dan juga melihat sertifikat yang diterbitkan/dikirim oleh admin.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

router.use(verifyToken);
router.use(isDosen);

/**
 * Membuat/mendapatkan subfolder di Drive
 */
async function getOrCreateSubFolder(parentId, name) {
  const query = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) {
    return query.data.files[0].id;
  }
  const folder = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return folder.data.id;
}

async function getSertifikatFolder(dosenId) {
  const parent = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Sertifikat Dosen');
  return getOrCreateSubFolder(parent, dosenId);
}

/**
 * GET /dosen/sertifikat
 * Menampilkan daftar sertifikat milik dosen (yang diupload sendiri maupun
 * yang dikirim oleh admin) beserta form unggah baru
 */
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('sertifikatDosen')
      .where('dosenId', '==', req.dosen.id)
      .get();

    const sertifikat = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.render('dosen/sertifikat', {
      title: 'Sertifikat Kompetensi',
      sertifikat
    });
  } catch (error) {
    console.error('Error mengambil sertifikat dosen:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data sertifikat' });
  }
});

/**
 * POST /dosen/sertifikat
 * Dosen mengunggah sertifikat miliknya sendiri
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { judul, penerbit, tanggalTerbit } = req.body;
    const file = req.file;

    if (!judul || !file) {
      return res.status(400).send('Judul sertifikat dan file wajib diisi');
    }

    const folderId = await getSertifikatFolder(req.dosen.id);
    const ext = (file.originalname.split('.').pop() || 'pdf').toLowerCase();
    const fileName = `${judul.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;
    const fileMetadata = { name: fileName, parents: [folderId] };
    const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
    const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });

    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    await db.collection('sertifikatDosen').add({
      dosenId: req.dosen.id,
      dosenNama: req.dosen.nama,
      judul,
      penerbit: penerbit || '',
      tanggalTerbit: tanggalTerbit || null,
      fileUrl: `https://drive.google.com/file/d/${response.data.id}/view`,
      fileId: response.data.id,
      fileName: file.originalname,
      sumber: 'dosen',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.redirect('/dosen/sertifikat');
  } catch (error) {
    console.error('Error mengunggah sertifikat:', error);
    res.status(500).send('Gagal mengunggah sertifikat');
  }
});

/**
 * POST /dosen/sertifikat/:id/delete
 * Dosen hanya bisa menghapus sertifikat yang ia unggah sendiri (bukan yang
 * dikirim oleh admin)
 */
router.post('/:id/delete', async (req, res) => {
  try {
    const docRef = db.collection('sertifikatDosen').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().dosenId !== req.dosen.id) {
      return res.status(404).send('Sertifikat tidak ditemukan');
    }
    const data = doc.data();
    if (data.sumber !== 'dosen') {
      return res.status(403).send('Sertifikat yang dikirim admin tidak dapat dihapus dari sini');
    }
    if (data.fileId) {
      try { await drive.files.delete({ fileId: data.fileId }); } catch (err) { console.error('Gagal hapus file Drive:', err); }
    }
    await docRef.delete();
    res.redirect('/dosen/sertifikat');
  } catch (error) {
    console.error('Error hapus sertifikat:', error);
    res.status(500).send('Gagal menghapus sertifikat');
  }
});

module.exports = router;
