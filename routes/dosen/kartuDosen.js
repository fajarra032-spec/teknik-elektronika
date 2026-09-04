const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
router.use(verifyToken);
router.use(isDosen);
router.get('/', (req, res) => {
  const dosen = req.dosen || {};
  res.render('dosen/kartu-dosen/index', {
    title: 'Kartu Tanda Dosen',
    dosen: {
      id: dosen.id || '', nama: dosen.nama || 'Dosen',
      nip: dosen.nip || dosen.NIP || '',
      nidn: dosen.nidn || dosen.NIDN || '',
      nuptk: dosen.nuptk || dosen.NUPTK || '',
      email: dosen.email || '', foto: dosen.foto || null
    }
  });
});
module.exports = router;
