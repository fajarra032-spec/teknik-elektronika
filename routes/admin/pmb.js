// routes/admin/pmb.js
// Pendaftar PMB (Penerimaan Mahasiswa Baru) - diverifikasi admin.
// Data masuk dari formulir publik /pmb (routes/landing.js) ke koleksi pmb_pendaftaran.
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const XLSX = require('xlsx');
const { invalidateAdminPending } = require('../../helpers/adminBadgeHelper');

router.use(verifyToken);
router.use(isAdmin);

const KOLEKSI = 'pmb_pendaftaran';
const STATUS_VALID = ['pending', 'verified', 'rejected'];
const PER_HALAMAN = 20;

// Perubahan data membuang cache badge admin (jumlah pendaftar pending)
router.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', invalidateAdminPending);
  next();
});

const digit = (s) => String(s || '').replace(/\D/g, '');

// ============================================================================
// DAFTAR PENDAFTAR
// ============================================================================
router.get('/', async (req, res) => {
  try {
    // Ambil semua lalu saring di memori: tab status menampilkan jumlah, dan
    // tidak butuh composite index (where + orderBy) di Firestore.
    const snapshot = await db.collection(KOLEKSI).orderBy('createdAt', 'desc').get();
    const semua = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const tujuhHari = new Date(Date.now() - 7 * 864e5).toISOString();
    const hitung = {
      semua: semua.length,
      pending: semua.filter(p => (p.status || 'pending') === 'pending').length,
      verified: semua.filter(p => p.status === 'verified').length,
      rejected: semua.filter(p => p.status === 'rejected').length,
      baru7: semua.filter(p => (p.createdAt || '') >= tujuhHari).length
    };

    const status = String(req.query.status || '');
    // Tanpa ?status= : fokus ke yang perlu diverifikasi bila ada, selain itu semua
    const filterStatus = STATUS_VALID.includes(status) ? status : (status === 'semua' ? 'semua' : (hitung.pending > 0 ? 'pending' : 'semua'));
    let pendaftar = filterStatus === 'semua' ? semua : semua.filter(p => (p.status || 'pending') === filterStatus);

    const search = String(req.query.search || '').trim().slice(0, 80);
    if (search) {
      const q = search.toLowerCase(); const qd = digit(search);
      pendaftar = pendaftar.filter(p =>
        String(p.nama || '').toLowerCase().includes(q) ||
        String(p.nis || '').toLowerCase().includes(q) ||
        String(p.asal_sekolah || '').toLowerCase().includes(q) ||
        String(p.jurusan || '').toLowerCase().includes(q) ||
        (qd.length >= 3 && digit(p.wa).includes(qd)));
    }

    const total = pendaftar.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_HALAMAN));
    const currentPage = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), totalPages);
    pendaftar = pendaftar.slice((currentPage - 1) * PER_HALAMAN, currentPage * PER_HALAMAN);

    res.render('admin/pmb', {
      title: 'Pendaftar PMB', user: req.user,
      pendaftar, filterStatus, search, totalPages, currentPage, total, hitung
    });
  } catch (error) {
    console.error('Error daftar PMB:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data pendaftar PMB' });
  }
});

// ============================================================================
// DETAIL (JSON untuk modal)
// ============================================================================
router.get('/detail/:id', async (req, res) => {
  try {
    const doc = await db.collection(KOLEKSI).doc(req.params.id).get();
    if (!doc.exists) return res.json({ success: false });
    res.json({ success: true, data: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error('Error detail PMB:', error);
    res.status(500).json({ success: false });
  }
});

// ============================================================================
// UBAH STATUS
// ============================================================================
router.post('/status/:id', async (req, res) => {
  try {
    const status = req.body && req.body.status;
    if (!STATUS_VALID.includes(status)) return res.status(400).json({ success: false, message: 'Status tidak valid' });
    const ref = db.collection(KOLEKSI).doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    await ref.update({
      status,
      diprosesOleh: req.user.nama || req.user.email || 'Admin',
      updatedAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error ubah status PMB:', error);
    res.status(500).json({ success: false });
  }
});

// ============================================================================
// HAPUS (juga menghapus file bukti pembayaran dari server)
// ============================================================================
router.delete('/hapus/:id', async (req, res) => {
  try {
    const ref = db.collection(KOLEKSI).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    const bukti = snap.data().bukti_pembayaran;
    await ref.delete();
    // Hanya berkas di /uploads/pmb/ (path dibentuk ulang dari nama berkas saja)
    if (typeof bukti === 'string' && bukti.startsWith('/uploads/pmb/')) {
      const berkas = path.join(__dirname, '../../public/uploads/pmb', path.basename(bukti));
      fs.unlink(berkas, () => {});
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error hapus PMB:', error);
    res.status(500).json({ success: false });
  }
});

// ============================================================================
// EXPORT EXCEL
// ============================================================================
router.get('/export', async (req, res) => {
  try {
    const snapshot = await db.collection(KOLEKSI).orderBy('createdAt', 'desc').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const label = { pending: 'Pending', verified: 'Terverifikasi', rejected: 'Ditolak' };
    const wsData = [['Nama', 'Jenis Kelamin', 'NIS', 'Asal Sekolah', 'Jurusan', 'WA', 'Jalur', 'Status', 'Tanggal Daftar']];
    data.forEach(p => {
      wsData.push([
        p.nama, p.jenis_kelamin || '', p.nis || '', p.asal_sekolah || '', p.jurusan,
        p.wa || '', p.jalur, label[p.status] || p.status,
        p.createdAt ? new Date(p.createdAt).toLocaleString('id-ID') : ''
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pendaftar PMB');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=pendaftar_pmb.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error export PMB:', error);
    res.status(500).send('Gagal mengekspor data');
  }
});

module.exports = router;
