/**
 * routes/mahasiswa/kelasChat.js
 * Chat Kelas: obrolan grup untuk mahasiswa yang terdaftar aktif di suatu
 * mata kuliah pada periode aktif, lengkap dengan daftar peserta kelas yang
 * bisa diklik untuk melihat kartu profil (foto, nama, identitas).
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isMahasiswa } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const {
  getPesertaKelas,
  isMahasiswaPesertaKelas,
  getPesanKelas,
  kirimPesanKelas
} = require('../../helpers/kelasChatHelper');

router.use(verifyToken);
router.use(isMahasiswa);

/**
 * GET /mahasiswa/kelas-chat/:mkId
 * Menampilkan halaman chat kelas beserta daftar peserta
 */
router.get('/:mkId', async (req, res) => {
  try {
    const { mkId } = req.params;
    const boleh = await isMahasiswaPesertaKelas(mkId, req.user.id);
    if (!boleh) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda tidak terdaftar aktif di mata kuliah ini pada periode berjalan.'
      });
    }

    const { peserta, mkData } = await getPesertaKelas(mkId);

    res.render('mahasiswa/kelas_chat', {
      title: `Chat Kelas - ${mkData.kode || ''} ${mkData.nama || ''}`,
      mk: mkData,
      peserta,
      currentUserId: req.user.id
    });
  } catch (error) {
    console.error('Error memuat chat kelas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat chat kelas' });
  }
});

/**
 * GET /mahasiswa/kelas-chat/:mkId/messages
 * Mengambil pesan chat kelas (dipanggil berkala oleh halaman)
 */
router.get('/:mkId/messages', async (req, res) => {
  try {
    const { mkId } = req.params;
    const boleh = await isMahasiswaPesertaKelas(mkId, req.user.id);
    if (!boleh) return res.status(403).json({ error: 'Akses ditolak' });

    const pesan = await getPesanKelas(mkId, req.query.sejak || null);
    res.json(pesan);
  } catch (error) {
    console.error('Error mengambil pesan kelas:', error);
    res.status(500).json({ error: 'Gagal mengambil pesan' });
  }
});

/**
 * POST /mahasiswa/kelas-chat/:mkId/send
 * Mengirim pesan ke chat kelas
 */
router.post('/:mkId/send', async (req, res) => {
  try {
    const { mkId } = req.params;
    const { pesan } = req.body;
    if (!pesan || !pesan.trim()) {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
    }
    const boleh = await isMahasiswaPesertaKelas(mkId, req.user.id);
    if (!boleh) return res.status(403).json({ error: 'Akses ditolak' });

    const id = await kirimPesanKelas(mkId, req.user.id, req.user.nama, 'mahasiswa', pesan.trim());
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error mengirim pesan kelas:', error);
    res.status(500).json({ error: 'Gagal mengirim pesan' });
  }
});

module.exports = router;
