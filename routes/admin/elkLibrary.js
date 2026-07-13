const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);
router.use(isAdmin);

const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

async function getOrCreateSubFolder(parentId, name) {
  const query = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length) return query.data.files[0].id;
  const folder = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return folder.data.id;
}

async function getFolderBukuAdmin() {
  const parent = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Karya Dosen');
  const jenisFolder = await getOrCreateSubFolder(parent, 'Buku');
  const adminFolder = await getOrCreateSubFolder(jenisFolder, 'admin');
  return adminFolder;
}

// ========== FUNGSI BANTU ==========
async function updateStatus(collection, id, status, userId) {
  const ref = db.collection(collection).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Dokumen tidak ditemukan');
  const updateData = { status, updatedAt: new Date().toISOString() };
  if (status === 'approved') {
    updateData.approvedAt = new Date().toISOString();
    updateData.approvedBy = userId;
  } else if (status === 'rejected') {
    updateData.rejectedAt = new Date().toISOString();
    updateData.rejectedBy = userId;
  }
  await ref.update(updateData);
}

async function deleteItem(collection, id) {
  const ref = db.collection(collection).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Dokumen tidak ditemukan');
  const data = doc.data();
  if (data.fileId) {
    try { await drive.files.delete({ fileId: data.fileId }); } catch (err) { console.error('Gagal hapus file Drive:', err.message); }
  }
  await ref.delete();
}

// ========== HALAMAN UTAMA ==========
router.get('/', async (req, res) => {
  try {
    const { type = 'all', status = 'all' } = req.query;
    let laporanList = [], artikelList = [], penelitianList = [], pengabdianList = [], bukuList = [];

    if (type === 'all' || type === 'laporan') {
      const snap = await db.collection('laporanMagang').get();
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (status !== 'all') data = data.filter(d => d.status === status);
      laporanList = data;
    }
    if (type === 'all' || type === 'artikel') {
      const snap = await db.collection('artikelDosen').get();
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (status !== 'all') data = data.filter(d => d.status === status);
      artikelList = data;
    }
    if (type === 'all' || type === 'penelitian') {
      const snap = await db.collection('penelitian').get();
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (status !== 'all') data = data.filter(d => d.status === status);
      penelitianList = data;
    }
    if (type === 'all' || type === 'pengabdian') {
      const snap = await db.collection('pengabdian').get();
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (status !== 'all') data = data.filter(d => d.status === status);
      pengabdianList = data;
    }
    if (type === 'all' || type === 'buku') {
      const snap = await db.collection('buku').get();
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (status !== 'all') data = data.filter(d => d.status === status);
      bukuList = data;
    }

    // Optional: urutkan secara manual (descending berdasarkan createdAt)
    const sortByDate = (arr) => arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    laporanList = sortByDate(laporanList);
    artikelList = sortByDate(artikelList);
    penelitianList = sortByDate(penelitianList);
    pengabdianList = sortByDate(pengabdianList);
    bukuList = sortByDate(bukuList);

    res.render('admin/elkLibrary_list', {
      laporanList, artikelList, penelitianList, pengabdianList, bukuList,
      currentType: type, currentStatus: status
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data: ' + err.message);
  }
});

// ========== APPROVE / REJECT ==========
// Laporan
router.post('/laporan/:id/approve', async (req, res) => {
  try {
    await updateStatus('laporanMagang', req.params.id, 'approved', req.user.id);
    res.redirect('/admin/elk-library?type=laporan&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
router.post('/laporan/:id/reject', async (req, res) => {
  try {
    await updateStatus('laporanMagang', req.params.id, 'rejected', req.user.id);
    res.redirect('/admin/elk-library?type=laporan&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
// Artikel
router.post('/artikel/:id/approve', async (req, res) => {
  try {
    await updateStatus('artikelDosen', req.params.id, 'approved', req.user.id);
    res.redirect('/admin/elk-library?type=artikel&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
router.post('/artikel/:id/reject', async (req, res) => {
  try {
    await updateStatus('artikelDosen', req.params.id, 'rejected', req.user.id);
    res.redirect('/admin/elk-library?type=artikel&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
// Penelitian
router.post('/penelitian/:id/approve', async (req, res) => {
  try {
    await updateStatus('penelitian', req.params.id, 'approved', req.user.id);
    res.redirect('/admin/elk-library?type=penelitian&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
router.post('/penelitian/:id/reject', async (req, res) => {
  try {
    await updateStatus('penelitian', req.params.id, 'rejected', req.user.id);
    res.redirect('/admin/elk-library?type=penelitian&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
// Pengabdian
router.post('/pengabdian/:id/approve', async (req, res) => {
  try {
    await updateStatus('pengabdian', req.params.id, 'approved', req.user.id);
    res.redirect('/admin/elk-library?type=pengabdian&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
router.post('/pengabdian/:id/reject', async (req, res) => {
  try {
    await updateStatus('pengabdian', req.params.id, 'rejected', req.user.id);
    res.redirect('/admin/elk-library?type=pengabdian&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});

// ========== EDIT ==========
// Laporan
router.get('/laporan/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('laporanMagang').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Laporan tidak ditemukan');
    res.render('admin/elkLibrary_edit', { title: 'Edit Laporan', item: { id: doc.id, ...doc.data() }, type: 'laporan' });
  } catch (err) { res.status(500).send(err.message); }
});
router.post('/laporan/:id/edit', async (req, res) => {
  try {
    const { judulPublik, abstrak, pembimbing, tahun } = req.body;
    await db.collection('laporanMagang').doc(req.params.id).update({
      judulPublik, abstrak, pembimbing, tahun: parseInt(tahun), updatedAt: new Date().toISOString()
    });
    res.redirect('/admin/elk-library');
  } catch (err) { res.status(500).send(err.message); }
});
// (sama untuk artikel, penelitian, pengabdian – Anda bisa salin pola di atas)

// ========== HAPUS ==========
router.post('/laporan/:id/delete', async (req, res) => {
  try {
    await deleteItem('laporanMagang', req.params.id);
    res.redirect('/admin/elk-library');
  } catch (err) { res.status(500).send(err.message); }
});
// (sama untuk lainnya)

// ========== BUKU ==========
// Daftar buku sudah termasuk dalam GET '/' (bukuList). Berikut rute khusus buku:

// Form tambah buku oleh admin (langsung disetujui, karena admin sendiri yang menambahkan)
router.get('/buku/tambah', (req, res) => {
  res.render('admin/buku_form', { title: 'Tambah Buku', item: null });
});

router.post('/buku/tambah', upload.single('file'), async (req, res) => {
  try {
    const { judul, penulis, penerbit, isbn, tahun, deskripsi } = req.body;
    if (!judul) return res.status(400).send('Judul wajib diisi');
    let fileUrl = null, fileId = null;
    if (req.file) {
      const folderId = await getFolderBukuAdmin();
      const fileName = `${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const fileMetadata = { name: fileName, parents: [folderId] };
      const media = { mimeType: req.file.mimetype, body: Readable.from(req.file.buffer) };
      const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
      await drive.permissions.create({ fileId: response.data.id, requestBody: { role: 'reader', type: 'anyone' } });
      fileUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      fileId = response.data.id;
    }
    await db.collection('buku').add({
      judul,
      penulis: penulis || 'Admin',
      penerbit: penerbit || '',
      isbn: isbn || '',
      deskripsi: deskripsi || '',
      tahun: parseInt(tahun) || new Date().getFullYear(),
      fileUrl,
      fileId,
      sumber: 'admin',
      status: 'approved', // langsung disetujui karena admin yang menambahkan
      approvedAt: new Date().toISOString(),
      approvedBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    res.redirect('/admin/elk-library?type=buku');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan buku: ' + err.message);
  }
});

// Approve / reject (untuk buku yang diunggah dosen)
router.post('/buku/:id/approve', async (req, res) => {
  try {
    await updateStatus('buku', req.params.id, 'approved', req.user.id);
    res.redirect('/admin/elk-library?type=buku&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});
router.post('/buku/:id/reject', async (req, res) => {
  try {
    await updateStatus('buku', req.params.id, 'rejected', req.user.id);
    res.redirect('/admin/elk-library?type=buku&status=pending');
  } catch (err) { res.status(500).send(err.message); }
});

// Edit
router.get('/buku/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('buku').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Buku tidak ditemukan');
    res.render('admin/buku_form', { title: 'Edit Buku', item: { id: doc.id, ...doc.data() } });
  } catch (err) { res.status(500).send(err.message); }
});
router.post('/buku/:id/edit', upload.single('file'), async (req, res) => {
  try {
    const { judul, penulis, penerbit, isbn, tahun, deskripsi } = req.body;
    const updateData = {
      judul, penulis, penerbit: penerbit || '', isbn: isbn || '',
      deskripsi: deskripsi || '', tahun: parseInt(tahun) || new Date().getFullYear(),
      updatedAt: new Date().toISOString()
    };
    if (req.file) {
      const folderId = await getFolderBukuAdmin();
      const fileName = `${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const fileMetadata = { name: fileName, parents: [folderId] };
      const media = { mimeType: req.file.mimetype, body: Readable.from(req.file.buffer) };
      const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
      await drive.permissions.create({ fileId: response.data.id, requestBody: { role: 'reader', type: 'anyone' } });
      updateData.fileUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      updateData.fileId = response.data.id;
    }
    await db.collection('buku').doc(req.params.id).update(updateData);
    res.redirect('/admin/elk-library?type=buku');
  } catch (err) { res.status(500).send(err.message); }
});

// Hapus
router.post('/buku/:id/delete', async (req, res) => {
  try {
    await deleteItem('buku', req.params.id);
    res.redirect('/admin/elk-library?type=buku');
  } catch (err) { res.status(500).send(err.message); }
});

module.exports = router;