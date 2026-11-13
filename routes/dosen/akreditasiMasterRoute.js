// routes/dosen/akreditasiMasterRoute.js
// Master Dokumen Prodi - DOSEN: melihat status kelengkapan & mengunggah bukti.
// Status/PIC/catatan hanya bisa diubah admin. Dimount di /dosen/akreditasi/master.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { hapusFileDrive } = require('../../helpers/akreditasiHelper');
const { COL, getMasterItems, groupMaster, hitungProgresMaster, uploadBuktiMaster, STATUS_MASTER } = require('../../helpers/masterDokumenHelper');

router.use(verifyToken);
router.use(isDosen);

router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('akreditasi_periode').where('status', '==', 'berjalan').orderBy('createdAt', 'desc').limit(1).get();
    const periode = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    const items = periode ? await getMasterItems(periode.id) : [];
    res.render('dosen/akreditasi/master', {
      title: 'Master Dokumen Prodi', periode,
      grouped: groupMaster(items), total: hitungProgresMaster(items), STATUS_MASTER
    });
  } catch (error) {
    console.error('Error memuat master dokumen (dosen):', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat master dokumen prodi' });
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
    if (d.fileId) await hapusFileDrive(d.fileId);
    const patch = { ...up, updatedBy: req.dosen.nama, updatedAt: new Date().toISOString() };
    if (d.status === 'belum') patch.status = 'ada';
    await ref.update(patch);
    res.redirect(`/dosen/akreditasi/master#kel-${d.kelompok}`);
  } catch (error) {
    console.error('Error unggah bukti master (dosen):', error);
    res.status(500).send('Gagal mengunggah berkas');
  }
});

module.exports = router;
