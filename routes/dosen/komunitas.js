/**
 * routes/dosen/komunitas.js
 * Komunitas: obrolan grup terbuka lintas peran (admin, dosen, mahasiswa) -
 * berbeda dari Chat Kelas yang dibatasi per mata kuliah.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const {
  getPesanKomunitas,
  kirimPesanKomunitas,
  hapusPesanKomunitas,
  getPesanById
} = require('../../helpers/komunitasHelper');

router.use(verifyToken);
router.use(isDosen);

/**
 * GET /dosen/komunitas
 */
router.get('/', (req, res) => {
  res.render('dosen/komunitas', {
    title: 'Komunitas',
    currentUserId: req.dosen.id,
    currentUserRole: 'dosen'
  });
});

/**
 * GET /dosen/komunitas/messages
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
 * POST /dosen/komunitas/send
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
      req.dosen.id, req.dosen.nama, 'dosen', req.dosen.foto, pesan.trim()
    );
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error mengirim pesan komunitas:', error);
    res.status(500).json({ error: 'Gagal mengirim pesan' });
  }
});

/**
 * POST /dosen/komunitas/:id/delete
 * Dosen hanya boleh menghapus pesan miliknya sendiri.
 */
router.post('/:id/delete', async (req, res) => {
  try {
    const pesan = await getPesanById(req.params.id);
    if (!pesan) return res.status(404).json({ error: 'Pesan tidak ditemukan' });
    if (pesan.senderId !== req.dosen.id) {
      return res.status(403).json({ error: 'Anda hanya bisa menghapus pesan sendiri' });
    }
    await hapusPesanKomunitas(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error menghapus pesan komunitas:', error);
    res.status(500).json({ error: 'Gagal menghapus pesan' });
  }
});

module.exports = router;
