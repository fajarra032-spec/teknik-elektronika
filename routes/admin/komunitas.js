/**
 * routes/admin/komunitas.js
 * Komunitas: obrolan grup terbuka lintas peran (admin, dosen, mahasiswa) -
 * berbeda dari Chat Kelas yang dibatasi per mata kuliah. Admin berperan
 * sebagai moderator: bisa menghapus pesan siapa pun (bukan hanya miliknya
 * sendiri) untuk menjaga ruang obrolan tetap kondusif.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const {
  getPesanKomunitas,
  kirimPesanKomunitas,
  hapusPesanKomunitas,
  getPesanById
} = require('../../helpers/komunitasHelper');

router.use(verifyToken);
router.use(isAdmin);

/**
 * GET /admin/komunitas
 */
router.get('/', (req, res) => {
  res.render('admin/komunitas', {
    title: 'Komunitas',
    currentUserId: req.user.id,
    currentUserRole: 'admin'
  });
});

/**
 * GET /admin/komunitas/messages
 */
router.get('/messages', async (req, res) => {
  try {
    const pesan = await getPesanKomunitas(req.query.sejak || null);
    res.json(pesan);
  } catch (error) {
    console.error('Error mengambil pesan komunitas:', error);
    res.status(500).json({ error: 'Gagal mengambil pesan' });
  }
});

/**
 * POST /admin/komunitas/send
 */
router.post('/send', async (req, res) => {
  try {
    const { pesan } = req.body;
    if (!pesan || !pesan.trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }
    if (pesan.length > 1000) {
      return res.status(400).json({ error: 'Pesan terlalu panjang (maks 1000 karakter)' });
    }
    const id = await kirimPesanKomunitas(
      req.user.id, req.user.nama, 'admin', req.user.foto, pesan.trim()
    );
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error mengirim pesan komunitas:', error);
    res.status(500).json({ error: 'Gagal mengirim pesan' });
  }
});

/**
 * POST /admin/komunitas/:id/delete
 * Admin = moderator, boleh menghapus pesan siapa pun.
 */
router.post('/:id/delete', async (req, res) => {
  try {
    const pesan = await getPesanById(req.params.id);
    if (!pesan) return res.status(404).json({ error: 'Pesan tidak ditemukan' });
    await hapusPesanKomunitas(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error menghapus pesan komunitas:', error);
    res.status(500).json({ error: 'Gagal menghapus pesan' });
  }
});

module.exports = router;
