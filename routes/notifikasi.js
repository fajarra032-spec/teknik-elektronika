/**
 * routes/notifikasi.js
 * Halaman & aksi notifikasi - dipakai SEMUA role (mahasiswa/dosen/admin), makanya
 * di-mount langsung di app.js sebagai '/notifikasi', bukan di bawah
 * routes/admin, routes/dosen, atau routes/mahasiswa.
 *
 * Semua aksi tulis (baca / baca-semua / hapus / hapus-semua) mengenali permintaan
 * AJAX (header Accept: application/json atau X-Requested-With): dibalas JSON
 * TANPA redirect, sehingga lonceng di navbar bisa dibersihkan tanpa pindah
 * halaman. Tanpa AJAX tetap redirect seperti sebelumnya (cadangan bila JS mati).
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebaseAdmin');
const {
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications
} = require('../helpers/notificationHelper');

router.use(verifyToken);

function wantsJson(req) {
  return req.xhr || req.get('X-Requested-With') === 'fetch' || String(req.get('Accept') || '').includes('application/json');
}
/** Hanya izinkan tujuan internal ("/..." tetapi bukan "//host") - cegah open redirect. */
function tujuanAman(link, cadangan) {
  return typeof link === 'string' && /^\/(?!\/)/.test(link) ? link : cadangan;
}
function balas(req, res, hasil, redirectKe) {
  if (wantsJson(req)) return res.json({ ok: true, ...hasil });
  return res.redirect(redirectKe);
}
function gagal(req, res, redirectKe, e) {
  console.error('Error aksi notifikasi:', e);
  if (wantsJson(req)) return res.status(500).json({ ok: false, message: 'Gagal memproses notifikasi' });
  return res.redirect(redirectKe);
}

// GET /notifikasi - daftar lengkap notifikasi milik user yang login
router.get('/', async (req, res) => {
  try {
    const items = await getAllNotifications(db, req.user.id, 50);
    res.render('notifikasi', { title: 'Notifikasi', user: req.user, items });
  } catch (error) {
    console.error('Error load notifikasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat notifikasi' });
  }
});

// POST /notifikasi/baca-semua - tandai semua dibaca
router.post('/baca-semua', async (req, res) => {
  try {
    await markAllAsRead(db, req.user.id);
    balas(req, res, {}, req.get('Referer') || '/notifikasi');
  } catch (e) { gagal(req, res, req.get('Referer') || '/notifikasi', e); }
});

// POST /notifikasi/hapus-semua - bersihkan semua notifikasi (body: hanyaDibaca=1 untuk yang sudah dibaca saja)
router.post('/hapus-semua', async (req, res) => {
  try {
    const hanyaDibaca = req.body && (req.body.hanyaDibaca === true || req.body.hanyaDibaca === '1' || req.body.hanyaDibaca === 'true');
    const jumlah = await deleteAllNotifications(db, req.user.id, { hanyaDibaca });
    balas(req, res, { dihapus: jumlah }, req.get('Referer') || '/notifikasi');
  } catch (e) { gagal(req, res, req.get('Referer') || '/notifikasi', e); }
});

// POST /notifikasi/:id/baca - tandai satu dibaca (AJAX: JSON; biasa: lanjut ke link-nya)
router.post('/:id/baca', async (req, res) => {
  try {
    await markAsRead(db, req.user.id, req.params.id);
    balas(req, res, {}, tujuanAman(req.body && req.body.link, '/notifikasi'));
  } catch (e) { gagal(req, res, '/notifikasi', e); }
});

// POST /notifikasi/:id/hapus - hapus satu notifikasi
router.post('/:id/hapus', async (req, res) => {
  try {
    const berhasil = await deleteNotification(db, req.user.id, req.params.id);
    balas(req, res, { dihapus: berhasil ? 1 : 0 }, req.get('Referer') || '/notifikasi');
  } catch (e) { gagal(req, res, req.get('Referer') || '/notifikasi', e); }
});

module.exports = router;
