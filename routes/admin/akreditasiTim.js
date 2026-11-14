// routes/admin/akreditasiTim.js - Tim Persiapan Akreditasi (data dari SK 5666/ELK/POLIDEWA/XI/2026)
// di /admin/akreditasi/tim
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const T = require('../../data/akreditasi/timPersiapan');
const { getMasterItems, groupMaster, ringkasTim } = require('../../helpers/masterDokumenHelper');

router.use(verifyToken);
router.use(isAdmin);

router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('akreditasi_periode').orderBy('createdAt', 'desc').limit(1).get();
    const periode = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    const ringkas = periode ? ringkasTim(groupMaster(await getMasterItems(periode.id))) : [];
    res.render('admin/akreditasi/tim', { title: 'Tim Persiapan Akreditasi', role: 'admin', T, periode, ringkas, catatan: T.catatan });
  } catch (e) {
    console.error('Error memuat tim akreditasi:', e);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat Tim Persiapan Akreditasi' });
  }
});
module.exports = router;
