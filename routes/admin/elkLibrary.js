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

// Aksi dari daftar (setujui/tolak/hapus) mengirim field tersembunyi "next".
// Setelah selesai, admin dikembalikan ke daftar yang sama (tab, filter, dan
// pencarian tetap), bukan dilempar ke tab "pending".
router.use((req, res, next) => {
  const tujuan = req.method === 'POST' && req.body && req.body.next;
  if (typeof tujuan === 'string' && tujuan.startsWith('/admin/elk-library') && !tujuan.startsWith('//')) {
    const asli = res.redirect.bind(res);
    res.redirect = (...args) => (args.length === 1 && typeof args[0] === 'string') ? asli(tujuan) : asli(...args);
  }
  next();
});

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
const JENIS = [
  { key: 'laporan',    col: 'laporanMagang' },
  { key: 'artikel',    col: 'artikelDosen' },
  { key: 'penelitian', col: 'penelitian' },
  { key: 'pengabdian', col: 'pengabdian' },
  { key: 'buku',       col: 'buku' }
];
const STATUS_VALID = ['pending', 'approved', 'rejected'];

function tsMs(v) {
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

// Ubah dokumen dari koleksi mana pun menjadi satu bentuk yang seragam untuk daftar
function normalisasi(key, d) {
  const gabung = v => Array.isArray(v) ? v.join(', ') : (v || '');
  const base = { id: d.id, _type: key, status: STATUS_VALID.includes(d.status) ? d.status : 'pending', createdAt: d.createdAt || null, fileUrl: d.fileUrl || '' };
  switch (key) {
    case 'laporan':
      return { ...base, judul: d.judulPublik || ('Laporan magang ' + (d.nama || '')).trim(), penulis: d.nama || '-', penulisSub: d.nim || '', tahun: d.tahun || '', info: d.pembimbing ? 'Pembimbing: ' + d.pembimbing : '' };
    case 'artikel':
      return { ...base, judul: d.judul || '(Tanpa judul)', penulis: gabung(d.penulis) || gabung(d.authors) || '-', penulisSub: '', tahun: d.publicationYear || d.tahun || '', info: (d.metadata && d.metadata.jurnal) || '' };
    case 'penelitian':
      return { ...base, judul: d.judul || '(Tanpa judul)', penulis: d.dosenNama || gabung(d.penulis) || '-', penulisSub: '', tahun: d.tahun || '', info: d.namaJurnal || '' };
    case 'pengabdian':
      return { ...base, judul: d.judul || d.namaKegiatan || '(Tanpa judul)', penulis: d.dosenNama || gabung(d.penulis) || '-', penulisSub: '', tahun: d.tahun || '', info: d.mitra ? 'Mitra: ' + d.mitra : '' };
    default: // buku
      return { ...base, judul: d.judul || '(Tanpa judul)', penulis: gabung(d.penulis) || d.dosenNama || '-', penulisSub: '', tahun: d.tahun || '', info: d.penerbit || '', sumber: d.sumber === 'admin' ? 'Admin' : 'Dosen' };
  }
}

router.get('/', async (req, res) => {
  try {
    const type = JENIS.some(j => j.key === req.query.type) ? req.query.type : 'all';
    const status = STATUS_VALID.includes(req.query.status) ? req.query.status : 'all';

    // Ambil semua koleksi sekali, supaya angka di tab & filter selalu lengkap
    const hasil = await Promise.all(JENIS.map(async j => {
      const snap = await db.collection(j.col).get();
      return snap.docs.map(doc => normalisasi(j.key, { ...doc.data(), id: doc.id }));
    }));
    const semua = hasil.flat();

    // counts[jenis|'all'][status|'all']
    const kosong = () => ({ all: 0, pending: 0, approved: 0, rejected: 0 });
    const counts = { all: kosong() };
    JENIS.forEach(j => { counts[j.key] = kosong(); });
    semua.forEach(it => {
      [counts.all, counts[it._type]].forEach(c => { c.all++; c[it.status]++; });
    });

    // Filter, lalu urutkan: yang menunggu di atas, sisanya terbaru dulu
    let items = semua;
    if (type !== 'all') items = items.filter(it => it._type === type);
    if (status !== 'all') items = items.filter(it => it.status === status);
    const rank = it => (it.status === 'pending' ? 0 : 1);
    items.sort((a, b) => rank(a) - rank(b) || tsMs(b.createdAt) - tsMs(a.createdAt));

    res.render('admin/elkLibrary_list', {
      title: 'ELK Library',
      items, counts,
      currentType: type, currentStatus: status,
      listUrl: req.originalUrl
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

// ========== EDIT & HAPUS: artikel, penelitian, pengabdian ==========
const EDIT_CFG = {
  artikel: {
    col: 'artikelDosen', label: 'Artikel Dosen',
    data: b => {
      const authors = String(b.authors || '').split(',').map(x => x.trim()).filter(Boolean);
      const tahun = parseInt(b.tahun) || null;
      return {
        judul: b.judul, abstrak: b.abstrak, authors, penulis: authors.join(', '),
        tahun, publicationYear: tahun,
        metadata: { jurnal: b.metadataJurnal || '', doi: b.metadataDoi || '' }
      };
    }
  },
  penelitian: {
    col: 'penelitian', label: 'Penelitian',
    data: b => ({ judul: b.judul, namaJurnal: b.namaJurnal || '', linkJurnal: b.linkJurnal || '', tahun: parseInt(b.tahun) || null })
  },
  pengabdian: {
    col: 'pengabdian', label: 'Pengabdian',
    data: b => ({ judul: b.judul, namaKegiatan: b.namaKegiatan || '', mitra: b.mitra || '', tahun: parseInt(b.tahun) || null })
  }
};

router.get('/:type/:id/edit', async (req, res, next) => {
  try {
    const cfg = EDIT_CFG[req.params.type];
    if (!cfg) return next();
    const doc = await db.collection(cfg.col).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    res.render('admin/elkLibrary_edit', { title: 'Edit ' + cfg.label, item: { ...doc.data(), id: doc.id }, type: req.params.type });
  } catch (err) { res.status(500).send(err.message); }
});

router.post('/:type/:id/edit', async (req, res, next) => {
  try {
    const cfg = EDIT_CFG[req.params.type];
    if (!cfg) return next();
    await db.collection(cfg.col).doc(req.params.id).update({ ...cfg.data(req.body), updatedAt: new Date().toISOString() });
    res.redirect('/admin/elk-library?type=' + req.params.type);
  } catch (err) { res.status(500).send(err.message); }
});

router.post('/:type/:id/delete', async (req, res, next) => {
  try {
    const cfg = EDIT_CFG[req.params.type];
    if (!cfg) return next();
    await deleteItem(cfg.col, req.params.id);
    res.redirect('/admin/elk-library?type=' + req.params.type);
  } catch (err) { res.status(500).send(err.message); }
});

// ========== DETAIL (admin) ==========
// Dipakai tombol "Detail" di daftar. Harus diletakkan SETELAH '/buku/tambah'
// supaya "tambah" tidak dianggap sebagai :id.
const DETAIL_KOLEKSI = {
  laporan: 'laporanMagang',
  artikel: 'artikelDosen',
  penelitian: 'penelitian',
  pengabdian: 'pengabdian',
  buku: 'buku'
};
const DETAIL_LABEL = {
  laporan: 'Laporan Magang',
  artikel: 'Artikel Dosen',
  penelitian: 'Penelitian Dosen',
  pengabdian: 'Pengabdian Dosen',
  buku: 'Buku'
};

// Catatan: Express 5 tidak mendukung regex di dalam parameter (":type(a|b)"),
// jadi jenis divalidasi manual di bawah.
router.get('/:type/:id', async (req, res, next) => {
  try {
    const { type, id } = req.params;
    if (!Object.prototype.hasOwnProperty.call(DETAIL_KOLEKSI, type)) return next();
    const doc = await db.collection(DETAIL_KOLEKSI[type]).doc(id).get();
    if (!doc.exists) {
      return res.status(404).send('Data tidak ditemukan');
    }
    const item = { ...doc.data(), id: doc.id };

    // Normalisasi supaya view tidak error
    if (Array.isArray(item.penulis)) item.penulis = item.penulis.join(', ');
    if (Array.isArray(item.authors)) item.authors = item.authors.join(', ');
    let kataKunci = item.kataKunci;
    if (Array.isArray(kataKunci)) kataKunci = kataKunci.map(k => String(k).trim()).filter(Boolean);
    else if (typeof kataKunci === 'string') kataKunci = kataKunci.split(/[,;]/).map(k => k.trim()).filter(Boolean);
    else kataKunci = [];

    res.render('admin/elkLibrary_detail', {
      title: 'Detail ' + DETAIL_LABEL[type],
      item,
      type,
      typeLabel: DETAIL_LABEL[type],
      kataKunci
    });
  } catch (err) {
    console.error('Error detail admin ELK Library:', err);
    res.status(500).send('Gagal memuat detail: ' + err.message);
  }
});

module.exports = router;
