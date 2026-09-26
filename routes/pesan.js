/**
 * routes/pesan.js
 * "Pusat Pesan" bergaya Messenger - satu halaman (/pesan) yang menyatukan:
 *   1. Pesan Pribadi (DM)     -> helpers/messengerHelper.js
 *   2. Chat Kelas (per MK)    -> helpers/kelasChatHelper.js (dipakai ulang APA ADANYA)
 *   3. Komunitas (1 ruang)    -> helpers/komunitasHelper.js (dipakai ulang APA ADANYA)
 *
 * Halaman lama /mahasiswa/kelas-chat, /dosen/kelas-chat, dan halaman
 * komunitas per role TIDAK dihapus/diubah - tetap jalan sebagai pintu
 * masuk alternatif, karena
 * keduanya sama-sama membaca/menulis ke koleksi Firestore yang sama persis.
 *
 * Sesuai preferensi awal (tanpa polling berkala): pesan baru dari lawan
 * bicara/kelas/komunitas muncul saat halaman dibuka ulang, bukan live.
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
const { getKelasRoomsForUser } = require('../helpers/pesanHubHelper');
const {
  isMahasiswaPesertaKelas,
  isDosenPengampuMk,
  getPesanKelas,
  kirimPesanKelas
} = require('../helpers/kelasChatHelper');
const { getPesanKomunitas, kirimPesanKomunitas } = require('../helpers/komunitasHelper');

router.use(verifyToken);

// Data sidebar (dipakai di semua halaman /pesan/*) - diambil sekali di sini
// supaya tiap route di bawah tidak menulis ulang Promise.all yang sama.
async function getSidebarData(req) {
  const [{ items: dmConversations }, kelasRooms, contacts] = await Promise.all([
    getConversations(db, req.user.id),
    getKelasRoomsForUser(db, req.user),
    getContactsForUser(db, req.user)
  ]);
  return { dmConversations, kelasRooms, contacts };
}

function renderHub(req, res, room) {
  getSidebarData(req)
    .then(sidebar => {
      res.render('pesan/index', {
        title: 'Pesan',
        user: req.user,
        dmConversations: sidebar.dmConversations,
        kelasRooms: sidebar.kelasRooms,
        contacts: sidebar.contacts,
        room // null = belum ada obrolan dipilih, atau object { type, ... }
      });
    })
    .catch(error => {
      console.error('Error memuat pusat pesan:', error);
      res.status(500).render('error', { title: 'Error', message: 'Gagal memuat pesan' });
    });
}

// GET /pesan - beranda pusat pesan, belum ada obrolan yang dipilih
router.get('/', (req, res) => renderHub(req, res, null));

// ---------------------------------------------------------------------------
// PESAN PRIBADI (DM)
// ---------------------------------------------------------------------------
router.get('/pribadi/:userId', async (req, res) => {
  try {
    const partnerId = req.params.userId;
    if (partnerId === req.user.id) return res.redirect('/pesan');

    const partner = await getUserProfileByUid(db, partnerId);
    if (!partner) {
      return res.status(404).render('error', { title: 'Tidak ditemukan', message: 'Pengguna tidak ditemukan' });
    }

    const messages = await getMessages(db, req.user.id, partnerId);
    await markConversationRead(db, req.user.id, partnerId);

    renderHub(req, res, { type: 'pribadi', partner, messages });
  } catch (error) {
    console.error('Error load percakapan pribadi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat percakapan' });
  }
});

router.post('/pribadi/:userId/kirim', async (req, res) => {
  try {
    const saved = await sendMessage(db, req.user, req.params.userId, req.body.message);
    if (!saved) return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    res.json({ success: true, pesan: saved });
  } catch (error) {
    console.error('Error kirim pesan pribadi:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
  }
});

// ---------------------------------------------------------------------------
// CHAT KELAS (per mata kuliah) - dosen & mahasiswa saja
// ---------------------------------------------------------------------------
async function cekAksesKelas(req, res, mkId) {
  if (req.user.role === 'mahasiswa') return isMahasiswaPesertaKelas(mkId, req.user.id);
  if (req.user.role === 'dosen') return isDosenPengampuMk(mkId, req.user.dosenId);
  return false; // admin tidak punya kelas
}

router.get('/kelas/:mkId', async (req, res) => {
  try {
    const { mkId } = req.params;
    const boleh = await cekAksesKelas(req, res, mkId);
    if (!boleh) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak terdaftar/mengampu di kelas ini pada periode berjalan.' });
    }
    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    const mk = mkDoc.exists ? { id: mkDoc.id, ...mkDoc.data() } : { id: mkId, nama: 'Mata Kuliah' };
    const messages = await getPesanKelas(mkId, null);
    renderHub(req, res, { type: 'kelas', mk, messages });
  } catch (error) {
    console.error('Error load chat kelas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat chat kelas' });
  }
});

router.post('/kelas/:mkId/kirim', async (req, res) => {
  try {
    const { mkId } = req.params;
    const { pesan } = req.body;
    if (!pesan || !pesan.trim()) return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    const boleh = await cekAksesKelas(req, res, mkId);
    if (!boleh) return res.status(403).json({ success: false, message: 'Akses ditolak' });
    const id = await kirimPesanKelas(mkId, req.user.id, req.user.nama, req.user.role, pesan.trim());
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error kirim chat kelas:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
  }
});

// ---------------------------------------------------------------------------
// KOMUNITAS (satu ruang global, semua role)
// ---------------------------------------------------------------------------
router.get('/komunitas', async (req, res) => {
  try {
    const messages = await getPesanKomunitas(null);
    renderHub(req, res, { type: 'komunitas', messages });
  } catch (error) {
    console.error('Error load komunitas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat komunitas' });
  }
});

router.post('/komunitas/kirim', async (req, res) => {
  try {
    const { pesan } = req.body;
    if (!pesan || !pesan.trim()) return res.status(400).json({ success: false, message: 'Pesan tidak boleh kosong' });
    if (pesan.length > 1000) return res.status(400).json({ success: false, message: 'Pesan terlalu panjang (maks 1000 karakter)' });
    const id = await kirimPesanKomunitas(req.user.id, req.user.nama, req.user.role, req.user.foto, pesan.trim());
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error kirim komunitas:', error);
    res.status(500).json({ success: false, message: 'Gagal mengirim pesan' });
  }
});

module.exports = router;
