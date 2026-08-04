const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isDosen);

router.get('/', async (req, res) => {
  try {
    // Ambil semua periode magang yang memiliki data perusahaan (nama tidak null)
    const snapshot = await db.collection('magangPeriod')
      .where('perusahaan.nama', '!=', null)
      .orderBy('perusahaan.nama', 'asc')
      .get();

    // Kelompokkan berdasarkan nama perusahaan (unik)
    const perusahaanMap = new Map();
    const periodsData = snapshot.docs.map(doc => doc.data());

    // ✅ OPTIMISASI KUOTA: kumpulkan dulu semua mahasiswaId unik, ambil
    // datanya SEKALIGUS lewat db.getAll() - bukan satu per satu di dalam
    // loop (sebelumnya N query utk N periode magang).
    const mahasiswaIdsUnik = [...new Set(periodsData.map(p => p.mahasiswaId).filter(Boolean))];
    const mahasiswaNamaMap = new Map();
    if (mahasiswaIdsUnik.length > 0) {
      const userDocs = await db.getAll(...mahasiswaIdsUnik.map(id => db.collection('users').doc(id)));
      userDocs.forEach((doc, i) => {
        mahasiswaNamaMap.set(mahasiswaIdsUnik[i], doc.exists ? doc.data().nama : 'Tidak diketahui');
      });
    }

    for (const period of periodsData) {
      const perusahaan = period.perusahaan || {};
      const namaPerusahaan = perusahaan.nama;
      if (!namaPerusahaan) continue;

      if (!perusahaanMap.has(namaPerusahaan)) {
        perusahaanMap.set(namaPerusahaan, {
          nama: namaPerusahaan,
          alamat: perusahaan.alamat || '-',
          kontak: perusahaan.kontak || perusahaan.kontakHp || '-',
          pembimbingLapangan: perusahaan.pembimbingLapangan || '-',
          mahasiswaList: []
        });
      }
      const mahasiswaNama = period.mahasiswaId
        ? (mahasiswaNamaMap.get(period.mahasiswaId) || 'Tidak diketahui')
        : 'Tidak diketahui';
      perusahaanMap.get(namaPerusahaan).mahasiswaList.push({
        id: period.mahasiswaId,
        nama: mahasiswaNama,
        pdkKode: period.pdkKode,
        periode: `${period.tanggalMulai} s/d ${period.tanggalSelesai || 'Selesai'}`
      });
    }

    const perusahaanList = Array.from(perusahaanMap.values());

    res.render('dosen/perusahaan/index', {
      title: 'Daftar Perusahaan Magang',
      perusahaanList
    });
  } catch (error) {
    console.error('Error ambil perusahaan magang:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data perusahaan' });
  }
});

module.exports = router;