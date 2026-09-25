/**
 * routes/pesan.js
 * Messenger (pesan pribadi) - dipakai SEMUA role, di-mount di app.js
 * sebagai '/pesan'. Terpisah dari:
 *   - routes/dosen/chat.js  (chat dosen->mahasiswa versi lama, tetap ada,
 *     tidak diubah, supaya tidak ada yang bergantung padanya jadi rusak)
 *   - routes/{mahasiswa,dosen}/kelasChat.js (obrolan GRUP per kelas/MK,
 *     beda tujuan dengan pesan pribadi di sini)
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { db } = require('../config/firebaseAdmin');
const { getUserProfileByUid } = require('../helpers/cache');
const {
  getContactsForUser,
  sendMessage,
  getMessages,
  markConversationRead,
  getConversations
} = require('../helpers/messengerHelper');

router.use(verifyToken);

// GET /pesan - inbox: daftar percakapan + tombol mulai obrolan baru
router.get('/', async (req, res) => {
  try {
    const [{ items: conversations }, contacts] = await Promise.all([
      getConversations(db, req.user.id),
      getContactsForUser(db, req.user)
    ]);
    res.render('pesan/index', {
      title: 'Pesan',
      user: req.user,
      conversations,
      contacts
    });
  } catch (error) {
    console.error('Error load inbox pesan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat pesan' });
  }
});

// GET /pesan/:userId - halaman percakapan dengan satu lawan bicara
router.get('/:userId', async (req, res) => {
  try {
    const partnerId = req.params.userId;
    if (partnerId === req.user.id) return res.redirect('/pesan');

    const partner = await getUserProfileByUid(db, partnerId);
    if (!partner) {
      return res.status(404).render('error', { title: 'Tidak ditemukan', message: 'Pengguna tidak ditemukan' });
    }

    const messages = await getMessages(db, req.user.id, partnerId);
    await markConversationRead(db, req.user.id, partnerId);

    res.render('pesan/chat', {
      title: `Pesan - ${partner.nama || partner.email}`,
      user: req.user,
      partner,
      messages
    });
  } catch (error) {
    console.error('Error load percakapan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat percakapan' });
  }
});

// POST /pesan/:userId/kirim - kirim pesan (dipanggil via fetch dari halaman chat)
router.post('/:userId/kirim', async (req, res) => {
  try {
    const { message } = req.body;
    const saved = await sendMessage(db, req.user, req.params.userId, message);
    if (!saved) {
      return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    }
    res.json({ success: true, pesan: saved });
  } catch (error) {
    console.error('Error kirim pesan:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
  }
});

module.exports = router;
