const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isAdmin);

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('inspeksi_listrik').orderBy('createdAt', 'desc').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/inspeksi/index', { title: 'Rekap Inspeksi Listrik', data });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('inspeksi_listrik').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const data = { id: doc.id, ...doc.data() };
    res.render('admin/inspeksi/detail', { title: 'Detail Inspeksi', data });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail');
  }
});

module.exports = router;