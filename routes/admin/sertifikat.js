/**
 * routes/admin/sertifikat.js
 * Admin dapat melihat seluruh sertifikat dosen (yang diunggah dosen sendiri
 * maupun yang dikirim admin), dan mengirim/menerbitkan sertifikat baru untuk
 * seorang dosen.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

router.use(verifyToken);
router.use(isAdmin);

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
 * GET /admin/sertifikat
 * Daftar seluruh sertifikat dosen, dengan filter opsional per dosen
 */
router.get('/', async (req, res) => {
  try {
    const { dosenId } = req.query;
    let query = db.collection('sertifikatDosen');
    if (dosenId) query = query.where('dosenId', '==', dosenId);

    const snapshot = await query.get();
    const sertifikat = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const dosenSnapshot = await db.collection('dosen').orderBy('nama').get();
    const dosenList = dosenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.render('admin/sertifikat_list', {
      title: 'Sertifikat Dosen',
      sertifikat,
      dosenList,
      filterDosenId: dosenId || ''
    });
  } catch (error) {
    console.error('Error mengambil sertifikat dosen:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data sertifikat' });
  }
});

/**
 * GET /admin/sertifikat/kirim
 * Form untuk mengirim/menerbitkan sertifikat baru ke seorang dosen
 */
router.get('/kirim', async (req, res) => {
  try {
    const dosenSnapshot = await db.collection('dosen').orderBy('nama').get();
    const dosenList = dosenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/sertifikat_kirim', { title: 'Kirim Sertifikat', dosenList });
  } catch (error) {
    console.error('Error memuat form kirim sertifikat:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat form' });
  }
});

/**
 * POST /admin/sertifikat/kirim
 * Menyimpan sertifikat yang diterbitkan admin untuk seorang dosen
 */
router.post('/kirim', upload.single('file'), async (req, res) => {
  try {
    const { dosenId, judul, penerbit, tanggalTerbit } = req.body;
    const file = req.file;

    if (!dosenId || !judul || !file) {
      return res.status(400).send('Dosen, judul sertifikat, dan file wajib diisi');
    }

    const dosenDoc = await db.collection('dosen').doc(dosenId).get();
    if (!dosenDoc.exists) {
      return res.status(404).send('Dosen tidak ditemukan');
    }
    const dosenNama = dosenDoc.data().nama;

    const folderId = await getSertifikatFolder(dosenId);
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
      dosenId,
      dosenNama,
      judul,
      penerbit: penerbit || 'Politeknik Dewantara',
      tanggalTerbit: tanggalTerbit || null,
      fileUrl: `https://drive.google.com/file/d/${response.data.id}/view`,
      fileId: response.data.id,
      fileName: file.originalname,
      sumber: 'admin',
      dikirimOleh: req.user.nama || req.user.email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.redirect('/admin/sertifikat');
  } catch (error) {
    console.error('Error mengirim sertifikat:', error);
    res.status(500).send('Gagal mengirim sertifikat');
  }
});

/**
 * POST /admin/sertifikat/:id/delete
 * Admin dapat menghapus sertifikat apa pun (baik dari dosen maupun admin)
 */
router.post('/:id/delete', async (req, res) => {
  try {
    const docRef = db.collection('sertifikatDosen').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send('Sertifikat tidak ditemukan');
    }
    const data = doc.data();
    if (data.fileId) {
      try { await drive.files.delete({ fileId: data.fileId }); } catch (err) { console.error('Gagal hapus file Drive:', err); }
    }
    await docRef.delete();
    res.redirect('/admin/sertifikat');
  } catch (error) {
    console.error('Error hapus sertifikat:', error);
    res.status(500).send('Gagal menghapus sertifikat');
  }
});

module.exports = router;
