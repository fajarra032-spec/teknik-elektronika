const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isAdmin);

// Daftar semua servisan
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('servisan').orderBy('createdAt', 'desc').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/servisan/index', { title: 'Monitoring Servisan Alat', data, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data servisan');
  }
});

// Detail servisan
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('servisan').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const servisan = { id: doc.id, ...doc.data() };
    res.render('admin/servisan/detail', { title: 'Detail Servisan', servisan, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail');
  }
});

// Hapus servisan
router.get('/hapus/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await db.collection('servisan').doc(id).delete();
    res.redirect('/admin/servisan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus data');
  }
});

router.get('/cetak', async (req, res) => {
  console.log('🟢 Route cetak dipanggil');
  try {
    const snapshot = await db.collection('servisan').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`📦 Jumlah data: ${data.length}`);
    res.json({ success: true, total: data.length, sample: data.slice(0, 3) });
  } catch (err) {
    console.error('❌ Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;