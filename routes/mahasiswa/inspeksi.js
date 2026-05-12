const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);

// Form inspeksi
router.get('/', (req, res) => {
  res.render('mahasiswa/inspeksi/form', { title: 'Form Inspeksi Listrik', user: req.user });
});

// Daftar inspeksi milik mahasiswa yang login
router.get('/list', async (req, res) => {
  try {
    const snapshot = await db.collection('inspeksi_listrik')
      .where('userId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('mahasiswa/inspeksi/index', { title: 'Riwayat Inspeksi', data, user: req.user });
  } catch (err) {
    console.error('Error detail:', err);
    if (err.message && err.message.includes('index')) {
      res.status(500).send(`Gagal memuat data. Buat indeks terlebih dahulu: ${err.message.match(/https:\/\/console\.firebase\.google\.com\/[^\s]+/)?.[0] || 'lihat console'}`);
    } else {
      res.status(500).send('Gagal memuat data: ' + err.message);
    }
  }
});

// Halaman edit inspeksi
router.get('/edit/:id', async (req, res) => {
  try {
    const doc = await db.collection('inspeksi_listrik').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const data = { id: doc.id, ...doc.data() };
    // Pastikan hanya pemilik data yang bisa edit
    if (data.userId !== req.user.id) {
      return res.status(403).send('Anda tidak berhak mengedit data ini');
    }
    res.render('mahasiswa/inspeksi/edit', { title: 'Edit Inspeksi', data, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data');
  }
});

// Update inspeksi
router.post('/update/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Ambil dokumen terlebih dahulu untuk cek kepemilikan
    const doc = await db.collection('inspeksi_listrik').doc(id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    if (doc.data().userId !== req.user.id) {
      return res.status(403).send('Anda tidak berhak mengedit data ini');
    }

    const data = req.body;
    let bebanList = [];
    let rekomendasiList = [];

    // Parse bebanList dan rekomendasiList dengan aman
    try {
      if (data.bebanList) bebanList = JSON.parse(data.bebanList);
      if (data.rekomendasiList) rekomendasiList = JSON.parse(data.rekomendasiList);
    } catch (e) {
      console.error('Gagal parse JSON:', e.message);
    }

    const updateData = {
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
      kabelTerkelupasLokasi: data.kabelTerkelupasLokasi || '',
      sambunganRapi: data.sambunganRapi === 'Ya',
      sambunganTidakRapiLokasi: data.sambunganTidakRapiLokasi || '',
      stopKontakLonggar: data.stopKontakLonggar === 'Ya',
      jumlahStopKontakLonggar: data.jumlahStopKontakLonggar ? parseInt(data.jumlahStopKontakLonggar) : 0,
      adaGrounding: data.adaGrounding === 'Ya',
      lembab: data.lembab === 'Ya',
      lembabLokasi: data.lembabLokasi || '',
      komentarInspeksi: data.komentarInspeksi || '',
      rekomendasiOtomatis: data.rekomendasiOtomatis || '',
      rekomendasiList: rekomendasiList,
      kesimpulan: data.kesimpulan,
      petugasNama: data.petugasNama,
      pemilikNama: data.pemilikNama,
      updatedAt: new Date().toISOString()
    };

    await db.collection('inspeksi_listrik').doc(id).update(updateData);
    res.redirect('/mahasiswa/inspeksi/list');
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal mengupdate data: ' + error.message);
  }
});

// Simpan data inspeksi baru
router.post('/', async (req, res) => {
  try {
    const data = req.body;
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
      jumlahStopKontakLonggar: data.jumlahStopKontakLonggar ? parseInt(data.jumlahStopKontakLonggar) : 0,
      adaGrounding: data.adaGrounding === 'Ya',
      lembab: data.lembab === 'Ya',
      kabelTerkelupasLokasi: data.kabelTerkelupasLokasi || '',
      sambunganTidakRapiLokasi: data.sambunganTidakRapiLokasi || '',
      lembabLokasi: data.lembabLokasi || '',
      komentarInspeksi: data.komentarInspeksi || '',
      rekomendasiOtomatis: data.rekomendasiOtomatis || '',
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