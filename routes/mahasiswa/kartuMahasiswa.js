/**
 * Kartu Mahasiswa digital.
 * Data diambil langsung dari profil mahasiswa pada req.user
 * (diisi oleh middleware/auth.js dari collection Firestore users).
 */
const express = require('express');
const router = express.Router();
const { verifyToken, isMahasiswa } = require('../../middleware/auth');

router.use(verifyToken);
router.use(isMahasiswa);

router.get('/', (req, res) => {
  const user = req.user || {};

  res.render('mahasiswa/kartu-mahasiswa/index', {
    title: 'Kartu Mahasiswa',
    user: {
      id: user.id || '',
      nama: user.nama || 'Mahasiswa',
      nim: user.nim || '-',
      foto: user.foto || null,
      fotoFileId: user.fotoFileId || null
    }
  });
});

module.exports = router;
