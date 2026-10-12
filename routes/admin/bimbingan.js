/**
 * routes/admin/bimbingan.js
 * Admin: Daftar Pembimbing Magang (read-only).
 *
 * REVISI: Pembimbing 1 & 2 DITIADAKAN. Hanya ada SATU pembimbing magang, yaitu
 * Dosen Pembimbing Akademik (PA) mahasiswa (users.dosenPaId). Karena itu
 * halaman ini TIDAK lagi dipakai untuk menetapkan pembimbing - penetapan
 * dilakukan di menu Mahasiswa (Edit Mahasiswa / "Tetapkan Dosen PA" massal /
 * script assign-dosen-pa-*). Halaman ini hanya menampilkan siapa pembimbing
 * (Dosen PA) tiap mahasiswa aktif, dan mana yang BELUM punya Dosen PA (belum
 * bisa mengisi logbook/laporan magang).
 *
 * Koleksi `bimbingan` lama tidak lagi dibaca/ditulis (data dibiarkan untuk arsip).
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isAdmin);

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .get();

    const semua = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(m => !m.statusMahasiswa || m.statusMahasiswa === 'Aktif')
      .sort((a, b) => String(a.nim || '').localeCompare(String(b.nim || '')));

    const mahasiswaList = semua.map(m => ({
      id: m.id,
      nim: m.nim || '-',
      nama: m.nama || '-',
      kelas: m.kelas || '-',
      semester: m.semester || '-',
      dosenPaId: m.dosenPaId || null,
      dosenPaNama: m.dosenPaNama || null
    }));

    const belumPa = mahasiswaList.filter(m => !m.dosenPaId).length;

    res.render('admin/bimbingan/index', {
      title: 'Pembimbing Magang (Dosen PA)',
      mahasiswaList,
      totalMahasiswa: mahasiswaList.length,
      totalBelumPa: belumPa,
      search: req.query.search || ''
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat daftar pembimbing magang'
    });
  }
});

module.exports = router;
