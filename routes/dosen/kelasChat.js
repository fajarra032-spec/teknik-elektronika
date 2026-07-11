/**
 * routes/dosen/kelasChat.js
 * Chat Kelas: obrolan grup untuk dosen pengampu suatu mata kuliah, lengkap
 * dengan daftar peserta kelas yang bisa diklik untuk melihat kartu profil.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const {
  getPesertaKelas,
  isDosenPengampuMk,
  getPesanKelas,
  kirimPesanKelas
} = require('../../helpers/kelasChatHelper');

router.use(verifyToken);
router.use(isDosen);

/**
 * GET /dosen/kelas-chat/:mkId
 * Menampilkan halaman chat kelas beserta daftar peserta
 */
router.get('/:mkId', async (req, res) => {
  try {
    const { mkId } = req.params;
    const boleh = await isDosenPengampuMk(mkId, req.dosen.id);
    if (!boleh) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda bukan dosen pengampu mata kuliah ini.'
      });
    }

    const { peserta, mkData } = await getPesertaKelas(mkId);

    res.render('dosen/kelas_chat', {
      title: `Chat Kelas - ${mkData.kode || ''} ${mkData.nama || ''}`,
      mk: mkData,
      peserta,
      currentUserId: req.dosen.id
    });
  } catch (error) {
    console.error('Error memuat chat kelas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat chat kelas' });
  }
});

/**
 * GET /dosen/kelas-chat/:mkId/messages
 */
router.get('/:mkId/messages', async (req, res) => {
  try {
    const { mkId } = req.params;
    const boleh = await isDosenPengampuMk(mkId, req.dosen.id);
    if (!boleh) return res.status(403).json({ error: 'Akses ditolak' });

    const pesan = await getPesanKelas(mkId, req.query.sejak || null);
    res.json(pesan);
  } catch (error) {
    console.error('Error mengambil pesan kelas:', error);
    res.status(500).json({ error: 'Gagal mengambil pesan' });
  }
});

/**
 * POST /dosen/kelas-chat/:mkId/send
 */
router.post('/:mkId/send', async (req, res) => {
  try {
    const { mkId } = req.params;
    const { pesan } = req.body;
    if (!pesan || !pesan.trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }
    const boleh = await isDosenPengampuMk(mkId, req.dosen.id);
    if (!boleh) return res.status(403).json({ error: 'Akses ditolak' });

    const id = await kirimPesanKelas(mkId, req.dosen.id, req.dosen.nama, 'dosen', pesan.trim());
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error mengirim pesan kelas:', error);
    res.status(500).json({ error: 'Gagal mengirim pesan' });
  }
});

module.exports = router;
