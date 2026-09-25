/**
 * routes/notifikasi.js
 * Halaman notifikasi - dipakai SEMUA role (mahasiswa/dosen/admin), makanya
 * di-mount langsung di app.js sebagai '/notifikasi', bukan di bawah
 * routes/admin, routes/dosen, atau routes/mahasiswa.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebaseAdmin');
const {
  getAllNotifications,
  markAsRead,
  markAllAsRead
} = require('../helpers/notificationHelper');

router.use(verifyToken);

// GET /notifikasi - daftar lengkap notifikasi milik user yang login
router.get('/', async (req, res) => {
  try {
    const items = await getAllNotifications(db, req.user.id, 50);
    res.render('notifikasi', {
      title: 'Notifikasi',
      user: req.user,
      items
    });
  } catch (error) {
    console.error('Error load notifikasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat notifikasi' });
  }
});

// POST /notifikasi/:id/baca - tandai satu notifikasi dibaca, lalu lanjut ke link-nya (kalau ada)
router.post('/:id/baca', async (req, res) => {
  try {
    await markAsRead(db, req.user.id, req.params.id);
    const tujuan = req.body.link && typeof req.body.link === 'string' ? req.body.link : '/notifikasi';
    res.redirect(tujuan);
  } catch (error) {
    console.error('Error tandai notifikasi:', error);
    res.redirect('/notifikasi');
  }
});

// POST /notifikasi/baca-semua - tandai semua notifikasi milik user dibaca
router.post('/baca-semua', async (req, res) => {
  try {
    await markAllAsRead(db, req.user.id);
  } catch (error) {
    console.error('Error tandai semua notifikasi:', error);
  }
  res.redirect(req.get('Referer') || '/notifikasi');
});

module.exports = router;
