// routes/admin/akreditasiMaster.js
// Master Dokumen Prodi (Buku Induk Administrasi) - ADMIN: kelola status, PIC, catatan,
// unggah bukti, tambah/hapus item, ekspor CSV. Dimount di /admin/akreditasi/master.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { hapusFileDrive } = require('../../helpers/akreditasiHelper');
const { MASTER_DOKUMEN } = require('../../helpers/masterDokumenConfig');
const {
  COL, seedMasterDokumen, getMasterItems, groupMaster, hitungProgresMaster,
  uploadBuktiMaster, masterToCsv, STATUS_MASTER
} = require('../../helpers/masterDokumenHelper');

router.use(verifyToken);
router.use(isAdmin);

const back = (periodeId, kode) =>
  `/admin/akreditasi/master?periodeId=${periodeId}${kode ? '#kel-' + kode : ''}`;

router.get('/', async (req, res) => {
  try {
    const periodeList = (await db.collection('akreditasi_periode').orderBy('createdAt', 'desc').get())
      .docs.map(d => ({ id: d.id, ...d.data() }));
    const periodeId = req.query.periodeId || (periodeList[0] && periodeList[0].id) || null;
    let items = [];
    if (periodeId) items = await getMasterItems(periodeId);
    res.render('admin/akreditasi/master', {
      title: 'Master Dokumen Prodi',
      periodeList, periodeId,
      grouped: groupMaster(items),
      total: hitungProgresMaster(items),
      STATUS_MASTER,
      kelompokTemplate: MASTER_DOKUMEN.map(g => ({ kode: g.kode, nama: g.nama }))
    });
  } catch (error) {
    console.error('Error memuat master dokumen:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat master dokumen prodi' });
  }
});

router.post('/seed', async (req, res) => {
  try {
    await seedMasterDokumen(req.body.periodeId);
    res.redirect(back(req.body.periodeId));
  } catch (error) {
    console.error('Error seed master dokumen:', error);
    res.status(500).send('Gagal menyiapkan template master dokumen');
  }
});

router.post('/item/baru', async (req, res) => {
  try {
    const { periodeId, kelompok, nama, keterangan } = req.body;
    if (!periodeId || !kelompok || !nama || !nama.trim()) return res.status(400).send('Kelompok dan nama dokumen wajib diisi');
    const tpl = MASTER_DOKUMEN.find(g => g.kode === kelompok);
    const sama = await db.collection(COL).where('periodeId', '==', periodeId).get();
    const urutan = sama.docs.filter(d => d.data().kelompok === kelompok).length + 1;
    const now = new Date().toISOString();
    await db.collection(COL).add({
      periodeId, kelompok, kelompokNama: tpl ? tpl.nama : kelompok, kriteriaKode: tpl ? (tpl.kriteria || '') : '',
      sub: '', urutan, nama: nama.trim(), keterangan: (keterangan || '').trim(),
      status: 'belum', picNama: '', catatan: '', fileId: null, fileUrl: null, fileName: null,
      createdAt: now, updatedAt: now
    });
    res.redirect(back(periodeId, kelompok));
  } catch (error) {
    console.error('Error menambah item master:', error);
    res.status(500).send('Gagal menambah dokumen');
  }
});

router.post('/item/:id/update', async (req, res) => {
  try {
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Item tidak ditemukan');
    const status = STATUS_MASTER[req.body.status] ? req.body.status : doc.data().status;
    await ref.update({
      status,
      picNama: (req.body.picNama || '').trim(),
      catatan: (req.body.catatan || '').trim(),
      updatedBy: req.user.nama || req.user.email,
      updatedAt: new Date().toISOString()
    });
    res.redirect(back(doc.data().periodeId, doc.data().kelompok));
  } catch (error) {
    console.error('Error update item master:', error);
    res.status(500).send('Gagal menyimpan perubahan');
  }
});

router.post('/item/:id/upload', upload.single('file'), async (req, res) => {
  try {
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Item tidak ditemukan');
    if (!req.file) return res.status(400).send('File wajib dipilih');
    const d = doc.data();
    const up = await uploadBuktiMaster({ periodeId: d.periodeId, kelompok: d.kelompok, file: req.file });
    if (d.fileId) await hapusFileDrive(d.fileId); // satu item = satu berkas terbaru
    const patch = { ...up, updatedBy: req.user.nama || req.user.email, updatedAt: new Date().toISOString() };
    if (d.status === 'belum') patch.status = 'ada';
    await ref.update(patch);
    res.redirect(back(d.periodeId, d.kelompok));
  } catch (error) {
    console.error('Error unggah bukti master:', error);
    res.status(500).send('Gagal mengunggah berkas');
  }
});

router.post('/item/:id/hapus-file', async (req, res) => {
  try {
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Item tidak ditemukan');
    await hapusFileDrive(doc.data().fileId);
    await ref.update({ fileId: null, fileUrl: null, fileName: null, updatedAt: new Date().toISOString() });
    res.redirect(back(doc.data().periodeId, doc.data().kelompok));
  } catch (error) {
    console.error('Error hapus berkas master:', error);
    res.status(500).send('Gagal menghapus berkas');
  }
});

router.post('/item/:id/delete', async (req, res) => {
  try {
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Item tidak ditemukan');
    await hapusFileDrive(doc.data().fileId);
    await ref.delete();
    res.redirect(back(doc.data().periodeId, doc.data().kelompok));
  } catch (error) {
    console.error('Error hapus item master:', error);
    res.status(500).send('Gagal menghapus dokumen');
  }
});

router.get('/export', async (req, res) => {
  try {
    const { periodeId } = req.query;
    if (!periodeId) return res.status(400).send('periodeId wajib diisi');
    const p = await db.collection('akreditasi_periode').doc(periodeId).get();
    if (!p.exists) return res.status(404).send('Periode tidak ditemukan');
    const csv = masterToCsv(groupMaster(await getMasterItems(periodeId)), p.data().nama);
    const nama = `master-dokumen-${p.data().nama}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nama}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Error ekspor master dokumen:', error);
    res.status(500).send('Gagal mengekspor master dokumen');
  }
});

module.exports = router;
