/**
 * routes/mahasiswa/konsultasiPa.js
 * Mahasiswa melihat & mencetak LEMBAR KONSULTASI bimbingan akademik miliknya
 * (dicatat oleh Dosen PA - lihat routes/dosen/mahasiswaPa.js). Read-only.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getPembimbingMahasiswa } = require('../../helpers/pembimbingHelper');
const { getKonsultasiMahasiswa, buildPrintData } = require('../../helpers/konsultasiPaHelper');

router.use(verifyToken);

// GET /mahasiswa/konsultasi-pa
router.get('/', async (req, res) => {
  try {
    const mahasiswaId = req.user.id;
    const doc = await db.collection('users').doc(mahasiswaId).get();
    const mahasiswa = doc.exists ? { id: doc.id, ...doc.data() } : { id: mahasiswaId, ...req.user };
    const [daftar, dosenPa] = await Promise.all([
      getKonsultasiMahasiswa(mahasiswaId),
      getPembimbingMahasiswa(mahasiswa)
    ]);
    res.render('mahasiswa/konsultasi_pa', {
      title: 'Lembar Konsultasi',
      mahasiswa,
      dosenPa,
      daftar: daftar.reverse() // terbaru di atas
    });
  } catch (error) {
    console.error('Error memuat lembar konsultasi mahasiswa:', error);
    res.status(500).send('Gagal memuat lembar konsultasi');
  }
});

// GET /mahasiswa/konsultasi-pa/print - hanya milik sendiri (id dari sesi, bukan dari URL)
router.get('/print', async (req, res) => {
  try {
    const data = await buildPrintData(req.user.id);
    if (!data) return res.status(404).send('Data mahasiswa tidak ditemukan');
    res.render('konsultasi_pa_print', data);
  } catch (error) {
    console.error('Error mencetak lembar konsultasi mahasiswa:', error);
    res.status(500).send('Gagal mencetak lembar konsultasi');
  }
});

module.exports = router;
