// routes/dosen/akreditasiKurikulumRoute.js - Dokumen Kurikulum 2024 (hanya lihat) di /dosen/akreditasi/kurikulum
const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const K = require('../../helpers/kurikulumHelper');

router.use(verifyToken);
router.use(isDosen);

router.get('/', (req, res) => {
  res.render('admin/akreditasi/kurikulum', { title: 'Dokumen Kurikulum 2024', role: 'dosen', D: K.D, K, pemeriksaan: K.pemeriksaan(), catatan: [] });
});
module.exports = router;
