// routes/admin/pmb.js
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const XLSX = require('xlsx');

router.use(verifyToken);
router.use(isAdmin);

// Daftar pendaftar
router.get('/', async (req, res) => {
  try {
    let { status, search, page = 1 } = req.query;
    page = parseInt(page);
    const limit = 20;
    let query = db.collection('pmb_pendaftaran').orderBy('createdAt', 'desc');
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();
    let pendaftar = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (search) {
      const lower = search.toLowerCase();
      pendaftar = pendaftar.filter(p => 
        p.nama.toLowerCase().includes(lower) || 
        (p.nis && p.nis.includes(lower)) ||
        (p.wa && p.wa.includes(lower))
      );
    }
    const total = pendaftar.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    pendaftar = pendaftar.slice(start, start + limit);
    res.render('admin/pmb', { pendaftar, filterStatus: status || '', search: search || '', totalPages, currentPage: page });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error');
  }
});

// Detail API
router.get('/detail/:id', async (req, res) => {
  const doc = await db.collection('pmb_pendaftaran').doc(req.params.id).get();
  if (!doc.exists) return res.json({ success: false });
  res.json({ success: true, data: { id: doc.id, ...doc.data() } });
});

// Ubah status
router.post('/status/:id', async (req, res) => {
  const { status } = req.body;
  await db.collection('pmb_pendaftaran').doc(req.params.id).update({ status, updatedAt: new Date().toISOString() });
  res.json({ success: true });
});

// Hapus
router.delete('/hapus/:id', async (req, res) => {
  await db.collection('pmb_pendaftaran').doc(req.params.id).delete();
  res.json({ success: true });
});

// Export Excel
router.get('/export', async (req, res) => {
  const snapshot = await db.collection('pmb_pendaftaran').orderBy('createdAt', 'desc').get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const wsData = [['Nama', 'NIS', 'Asal Sekolah', 'Jurusan', 'WA', 'Jalur', 'Status', 'Tanggal Daftar']];
  data.forEach(p => {
    wsData.push([
      p.nama, p.nis || '', p.asal_sekolah || '', p.jurusan,
      p.wa || '', p.jalur, p.status,
      p.createdAt ? new Date(p.createdAt).toLocaleString('id-ID') : ''
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pendaftar PMB');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=pendaftar_pmb.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

module.exports = router;