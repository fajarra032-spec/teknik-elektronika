/**
 * routes/admin/sop.js - Buku Induk SOP untuk admin/Kaprodi.
 *   GET  /admin/sop               tabel 47 SOP + status
 *   POST /admin/sop/:kode/status  ubah status, versi, tanggal berlaku, catatan (disimpan di koleksi sop_status)
 *   GET  /admin/sop/export.xlsx   unduh Buku Induk SOP (.xlsx)
 */
const express = require('express');
const router = express.Router();
const XLSX = require('xlsx');
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const sop = require('../../data/sop');

router.use(verifyToken);
router.use(isAdmin);

const STATUS = ['Belum ada', 'Ada - perlu diformat', 'Draf disusun', 'Menunggu pengesahan', 'Disahkan'];

async function gabung() {
  const snap = await db.collection('sop_status').get();
  const st = {}; snap.forEach(d => { st[d.id] = d.data(); });
  return sop.semua().map(s => {
    const o = st[s.kode] || {};
    const statusAwal = s.tersedia ? 'Draf disusun' : s.statusAwal;
    return { ...s, status: o.status || statusAwal, versi: o.versi || '', tanggalBerlaku: o.tanggalBerlaku || '', catatanAdmin: o.catatan || '' };
  });
}

router.get('/', async (req, res) => {
  const daftar = await gabung();
  const hitung = {}; STATUS.forEach(s => { hitung[s] = daftar.filter(d => d.status === s).length; });
  res.render('admin/sop/index', { title: 'Buku Induk SOP', daftar, STATUS, hitung, pesan: req.session && req.session.success, user: req.user });
  if (req.session) delete req.session.success;
});

router.get('/export.xlsx', async (req, res) => {
  const daftar = await gabung();
  const ws = XLSX.utils.json_to_sheet(daftar.map(d => ({
    'No. Dokumen': d.kode, 'Kelompok': d.kelompok, 'Judul SOP': d.judul, 'Penanggung Jawab (usulan)': d.pj,
    'Modul Sistem': d.modul, 'Prioritas': d.prioritas, 'Status': d.status, 'Versi': d.versi,
    'Tanggal Berlaku': d.tanggalBerlaku, 'Catatan': d.catatanAdmin || d.catatan
  })));
  ws['!cols'] = [14, 24, 60, 30, 36, 10, 22, 8, 16, 60].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Buku Induk SOP');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Buku_Induk_SOP.xlsx"');
  res.send(buf);
});

router.post('/:kode/status', async (req, res) => {
  const { kode } = req.params;
  if (!/^SOP-TE-\d{3}$/.test(kode) || !sop.get(kode)) return res.status(404).send('SOP tidak ditemukan');
  const { status, versi, tanggalBerlaku, catatan } = req.body;
  if (!STATUS.includes(status)) return res.status(400).send('Status tidak valid');
  await db.collection('sop_status').doc(kode).set({
    status, versi: String(versi || '').slice(0, 20), tanggalBerlaku: String(tanggalBerlaku || '').slice(0, 20),
    catatan: String(catatan || '').slice(0, 500), updatedAt: new Date(), updatedBy: (req.user && (req.user.email || req.user.uid)) || ''
  }, { merge: true });
  if (req.session) req.session.success = `${kode} diperbarui.`;
  res.redirect('/admin/sop#' + kode);
});

module.exports = router;
