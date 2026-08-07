/**
 * routes/admin/testimoni.js
 * Kelola Testimoni Alumni yang tampil di landing page (section "Apa Kata
 * Alumni?"). Sebelumnya konten ini hardcode di views/landing/index.ejs -
 * sekarang admin bisa tambah/edit/hapus/atur urutan dari sini tanpa perlu
 * ubah kode.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// DAFTAR TESTIMONI
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('testimoniAlumni').orderBy('urutan', 'asc').get();
    const testimoni = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/testimoni', { title: 'Kelola Testimoni Alumni', testimoni, success: req.query.success });
  } catch (error) {
    console.error('Error mengambil testimoni:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengambil data testimoni' });
  }
});

// ============================================================================
// TAMBAH TESTIMONI
// ============================================================================
router.get('/create', async (req, res) => {
  const countSnapshot = await db.collection('testimoniAlumni').count().get();
  res.render('admin/testimoni_form', {
    title: 'Tambah Testimoni',
    testimoni: null,
    urutanBerikutnya: countSnapshot.data().count + 1
  });
});

router.post('/', async (req, res) => {
  try {
    const { nama, role, tahunLulus, testimoniText, foto, urutan, aktif } = req.body;
    if (!nama || !testimoniText) {
      return res.status(400).send('Nama dan isi testimoni wajib diisi');
    }
    await db.collection('testimoniAlumni').add({
      nama,
      role: role || '',
      tahunLulus: tahunLulus || '',
      testimoni: testimoniText,
      foto: foto || null,
      urutan: parseInt(urutan) || 0,
      aktif: aktif === 'on',
      createdAt: new Date().toISOString()
    });
    res.redirect('/admin/testimoni?success=ditambahkan');
  } catch (error) {
    console.error('Error menambah testimoni:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menambah testimoni' });
  }
});

// ============================================================================
// EDIT TESTIMONI
// ============================================================================
router.get('/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('testimoniAlumni').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Testimoni tidak ditemukan' });
    res.render('admin/testimoni_form', {
      title: 'Edit Testimoni',
      testimoni: { id: doc.id, ...doc.data() },
      urutanBerikutnya: null
    });
  } catch (error) {
    console.error('Error memuat testimoni:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat testimoni' });
  }
});

router.post('/:id/update', async (req, res) => {
  try {
    const { nama, role, tahunLulus, testimoniText, foto, urutan, aktif } = req.body;
    if (!nama || !testimoniText) {
      return res.status(400).send('Nama dan isi testimoni wajib diisi');
    }
    await db.collection('testimoniAlumni').doc(req.params.id).update({
      nama,
      role: role || '',
      tahunLulus: tahunLulus || '',
      testimoni: testimoniText,
      foto: foto || null,
      urutan: parseInt(urutan) || 0,
      aktif: aktif === 'on',
      updatedAt: new Date().toISOString()
    });
    res.redirect('/admin/testimoni?success=diperbarui');
  } catch (error) {
    console.error('Error memperbarui testimoni:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memperbarui testimoni' });
  }
});

// ============================================================================
// HAPUS TESTIMONI
// ============================================================================
router.post('/:id/delete', async (req, res) => {
  try {
    await db.collection('testimoniAlumni').doc(req.params.id).delete();
    res.redirect('/admin/testimoni?success=dihapus');
  } catch (error) {
    console.error('Error menghapus testimoni:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menghapus testimoni' });
  }
});

module.exports = router;
