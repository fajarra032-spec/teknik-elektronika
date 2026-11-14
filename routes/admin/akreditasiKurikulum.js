// routes/admin/akreditasiKurikulum.js - Dokumen Kurikulum 2024 di workspace akreditasi (/admin/akreditasi/kurikulum)
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const K = require('../../helpers/kurikulumHelper');

router.use(verifyToken);
router.use(isAdmin);

router.get('/', (req, res) => {
  res.render('admin/akreditasi/kurikulum', {
    title: 'Dokumen Kurikulum 2024', role: 'admin', D: K.D, K,
    pemeriksaan: K.pemeriksaan(), catatan: require('../../data/kurikulum/catatanDokumen')
  });
});
module.exports = router;
