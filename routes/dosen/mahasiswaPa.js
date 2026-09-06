/**
 * routes/dosen/mahasiswaPa.js
 *
 * Daftar mahasiswa yang Dosen PA (Pembimbing Akademik)-nya adalah dosen
 * yang sedang login - berdasarkan field `dosenPaId` di dokumen mahasiswa
 * (di-set lewat /admin/mahasiswa atau script assign-dosen-pa-*).
 *
 * BEDA dengan "Mahasiswa Bimbingan" yang sudah ada di routes/dosen/mahasiswa.js
 * (itu berdasarkan mata kuliah yang diampu) dan stat "Mahasiswa Bimbingan" di
 * dashboard (itu berdasarkan pembimbing magang) - supaya tidak tertukar,
 * fitur ini konsisten disebut "Mahasiswa Bimbingan Akademik (PA)" di semua
 * tampilan.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isDosen);

router.get('/', async (req, res) => {
  try {
    const dosenId = req.dosen.id;

    const snapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .where('dosenPaId', '==', dosenId)
      .get();

    const mahasiswaList = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));

    res.render('dosen/mahasiswa_pa', {
      title: 'Mahasiswa Bimbingan Akademik (PA)',
      dosen: req.dosen,
      mahasiswaList,
      search: req.query.search || ''
    });
  } catch (error) {
    console.error('Error memuat mahasiswa PA:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat daftar mahasiswa bimbingan akademik'
    });
  }
});

module.exports = router;
