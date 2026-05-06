const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);

// Form inspeksi
router.get('/', (req, res) => {
  res.render('mahasiswa/inspeksi/form', { title: 'Form Inspeksi Listrik', user: req.user });
});

// Simpan data
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    // parse array beban dari form (dikirim sebagai JSON string)
    let bebanList = [];
    if (data.bebanList) {
      bebanList = JSON.parse(data.bebanList);
    }

    const inspeksiData = {
      userId: req.user.id,
      namaMahasiswa: req.user.nama,
      nim: req.user.nim,
      kelompok: data.kelompok,
      tanggal: data.tanggal,
      desa: data.desa,
      dusunRt: data.dusunRt,
      pemilikRumah: data.pemilikRumah,
      alamat: data.alamat,
      dayaTerpasang: parseInt(data.dayaTerpasang),
      jumlahPenghuni: parseInt(data.jumlahPenghuni),
      pernahKorsleting: data.pernahKorsleting === 'Ya',
      keteranganKorsleting: data.keteranganKorsleting || '',
      tegangan: parseFloat(data.tegangan),
      arusTotal: data.arusTotal ? parseFloat(data.arusTotal) : null,
      bebanTerpasang: data.bebanTerpasang ? parseFloat(data.bebanTerpasang) : null,
      bebanList: bebanList,
      totalBeban: parseFloat(data.totalBeban),
      mcbUtamaAda: data.mcbUtamaAda === 'Y',
      mcbUtamaUkuran: data.mcbUtamaUkuran ? parseInt(data.mcbUtamaUkuran) : null,
      mcbUtamaSesuai: data.mcbUtamaSesuai === 'Y',
      mcbUtamaRekomendasi: data.mcbUtamaRekomendasi || '',
      mcbCabangAda: data.mcbCabangAda === 'Y',
      mcbCabangUkuran: data.mcbCabangUkuran ? parseInt(data.mcbCabangUkuran) : null,
      mcbCabangSesuai: data.mcbCabangSesuai === 'Y',
      mcbCabangRekomendasi: data.mcbCabangRekomendasi || '',
      mcbPernahTrip: data.mcbPernahTrip === 'Ya',
      kabelUtamaUkuran: data.kabelUtamaUkuran ? parseFloat(data.kabelUtamaUkuran) : null,
      kabelUtamaSesuai: data.kabelUtamaSesuai === 'Y',
      kabelCabangUkuran: data.kabelCabangUkuran ? parseFloat(data.kabelCabangUkuran) : null,
      kabelCabangSesuai: data.kabelCabangSesuai === 'Y',
      kabelTerbuka: data.kabelTerbuka === 'Bahaya',
      sambunganRapi: data.sambunganRapi === 'Ya',
      stopKontakLonggar: data.stopKontakLonggar === 'Ya',
      adaGrounding: data.adaGrounding === 'Ya',
      lembab: data.lembab === 'Ya',
      rekomendasiList: data.rekomendasiList ? JSON.parse(data.rekomendasiList) : [],
      kesimpulan: data.kesimpulan,
      petugasNama: data.petugasNama,
      pemilikNama: data.pemilikNama,
      createdAt: new Date().toISOString()
    };
    await db.collection('inspeksi_listrik').add(inspeksiData);
    res.redirect('/mahasiswa/inspeksi/selesai');
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal menyimpan data inspeksi');
  }
});
// Halaman cetak laporan (POST)
router.post('/cetak', (req, res) => {
  const data = JSON.parse(req.body.data);
  // Kirim data ke view cetak
  res.render('mahasiswa/inspeksi/cetak', { 
    title: 'Cetak Laporan Inspeksi',
    data: data,
    tanggalCetak: new Date().toLocaleDateString('id-ID')
  });
});
router.get('/selesai', (req, res) => {
  res.render('mahasiswa/inspeksi/selesai', { title: 'Terima Kasih' });
});


module.exports = router;