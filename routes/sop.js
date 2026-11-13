/**
 * routes/sop.js - halaman SOP prodi (publik/internal) + unduh Word.
 *   GET /sop              daftar SOP yang sudah tersedia
 *   GET /sop/:kode        detail SOP
 *   GET /sop/:kode/docx   unduh .docx
 * SOP berakses 'internal' hanya untuk dosen/admin yang sudah login.
 * Catatan: /sop/magang (infografis pedoman) tetap dilayani route lain bila ada;
 * route ini hanya menangkap kode berformat SOP-TE-###.
 */
const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const sop = require('../data/sop');
const { buatSopDocx } = require('../helpers/sopDocx');

const POLA_KODE = /^SOP-TE-\d{3}$/;
const boleh = (item, user) => item.akses === 'publik' || (user && (user.role === 'admin' || user.role === 'dosen'));

async function statusMap() {
  try {
    const snap = await db.collection('sop_status').get();
    const m = {}; snap.forEach(d => { m[d.id] = d.data(); });
    return m;
  } catch (e) { console.error('sop_status gagal dibaca:', e.message); return {}; }
}

router.get('/', async (req, res) => {
  const st = await statusMap();
  const daftar = sop.semua()
    .filter(s => (s.tersedia || s.urlEksternal) && boleh(s, req.user))
    .map(s => ({ ...s, st: st[s.kode] || {} }));
  const perKelompok = {};
  daftar.forEach(s => { (perKelompok[s.kelompok] = perKelompok[s.kelompok] || []).push(s); });
  res.render('sop/index', {
    title: 'SOP Program Studi', description: 'Standar Operasional Prosedur Program Studi D3 Teknik Elektronika Politeknik Dewantara.',
    perKelompok, total: daftar.length, user: req.user || null
  });
});

// Pedoman Magang (infografis) - view lama views/sop/magang.ejs yang sebelumnya belum punya route
router.get('/magang', (req, res) => res.render('sop/magang', { title: 'Alur Magang', user: req.user || null }));

router.get('/:kode', async (req, res, next) => {
  if (!POLA_KODE.test(req.params.kode)) return next();
  const item = sop.get(req.params.kode);
  if (!item || !item.isi || !boleh(item, req.user)) return next();
  const st = (await statusMap())[item.kode] || {};
  res.render('sop/detail', { title: `${item.kode} ${item.isi.judul}`, description: item.isi.tujuan[0], item, st, user: req.user || null });
});

router.get('/:kode/docx', async (req, res, next) => {
  if (!POLA_KODE.test(req.params.kode)) return next();
  const item = sop.get(req.params.kode);
  if (!item || !item.isi || !boleh(item, req.user)) return next();
  const st = (await statusMap())[item.kode];
  const buf = await buatSopDocx(item, st);
  const nama = `${item.kode}_${item.isi.judul.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}_V${(st && st.versi) || item.isi.versi.split(' ')[0]}.docx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="${nama}"`);
  res.send(buf);
});

module.exports = router;
