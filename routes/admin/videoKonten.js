/**
 * routes/admin/videoKonten.js
 * Kelola Video Konten yang tampil di landing page (section "Video Konten").
 * Sebelumnya 4 video hardcode di views/landing/index.ejs (mengarah ke file
 * lokal /videos/video1.mp4, dst) - sekarang admin bisa tambah/edit/hapus
 * video (URL/file path) tanpa perlu ubah kode.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// DAFTAR VIDEO
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('videoKonten').orderBy('urutan', 'asc').get();
    const videoList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('admin/video_konten', { title: 'Kelola Video Konten', videoList, success: req.query.success });
  } catch (error) {
    console.error('Error mengambil video konten:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengambil data video' });
  }
});

// ============================================================================
// TAMBAH VIDEO
// ============================================================================
router.get('/create', async (req, res) => {
  const countSnapshot = await db.collection('videoKonten').count().get();
  res.render('admin/video_konten_form', {
    title: 'Tambah Video',
    video: null,
    urutanBerikutnya: countSnapshot.data().count + 1
  });
});

router.post('/', async (req, res) => {
  try {
    const { judul, deskripsi, videoUrl, urutan, aktif } = req.body;
    if (!judul || !videoUrl) {
      return res.status(400).send('Judul dan URL video wajib diisi');
    }
    await db.collection('videoKonten').add({
      judul,
      deskripsi: deskripsi || '',
      videoUrl,
      urutan: parseInt(urutan) || 0,
      aktif: aktif === 'on',
      createdAt: new Date().toISOString()
    });
    res.redirect('/admin/video-konten?success=ditambahkan');
  } catch (error) {
    console.error('Error menambah video:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menambah video' });
  }
});

// ============================================================================
// EDIT VIDEO
// ============================================================================
router.get('/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('videoKonten').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Video tidak ditemukan' });
    res.render('admin/video_konten_form', {
      title: 'Edit Video',
      video: { id: doc.id, ...doc.data() },
      urutanBerikutnya: null
    });
  } catch (error) {
    console.error('Error memuat video:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat video' });
  }
});

router.post('/:id/update', async (req, res) => {
  try {
    const { judul, deskripsi, videoUrl, urutan, aktif } = req.body;
    if (!judul || !videoUrl) {
      return res.status(400).send('Judul dan URL video wajib diisi');
    }
    await db.collection('videoKonten').doc(req.params.id).update({
      judul,
      deskripsi: deskripsi || '',
      videoUrl,
      urutan: parseInt(urutan) || 0,
      aktif: aktif === 'on',
      updatedAt: new Date().toISOString()
    });
    res.redirect('/admin/video-konten?success=diperbarui');
  } catch (error) {
    console.error('Error memperbarui video:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memperbarui video' });
  }
});

// ============================================================================
// HAPUS VIDEO
// ============================================================================
router.post('/:id/delete', async (req, res) => {
  try {
    await db.collection('videoKonten').doc(req.params.id).delete();
    res.redirect('/admin/video-konten?success=dihapus');
  } catch (error) {
    console.error('Error menghapus video:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menghapus video' });
  }
});

module.exports = router;
