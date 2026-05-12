const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);

// Konfigurasi jumlah kelompok (1–4)
const JUMLAH_KELOMPOK = 4;

// Generate nomor kupon (SRV/YYYYMMDD/xxxx)
function generateNoKupon() {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SRV/${yyyymmdd}/${random}`;
}

// Hitung jumlah data servisan saat ini untuk menentukan kelompok berikutnya (round-robin)
async function getNextKelompok() {
  const snapshot = await db.collection('servisan').get();
  const count = snapshot.size; // jumlah dokumen
  const nextKelompok = (count % JUMLAH_KELOMPOK) + 1;
  return `Kelompok ${nextKelompok}`;
}

// Daftar semua servisan (tanpa filter mahasiswa)
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('servisan')
      .orderBy('createdAt', 'desc')
      .get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('mahasiswa/servisan/index', { title: 'Daftar Servisan Alat', data, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data servisan');
  }
});

// Form tambah servisan
router.get('/tambah', (req, res) => {
  res.render('mahasiswa/servisan/form', { title: 'Tambah Servisan', servisan: null, user: req.user });
});

// Simpan servisan baru (otomatis tentukan kelompok penanggung jawab)
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const noKupon = generateNoKupon();
    const kelompokPenanggungJawab = await getNextKelompok();

    const servisanData = {
      userId: req.user.id,
      namaMahasiswa: req.user.nama,
      nim: req.user.nim,
      noKupon: noKupon,
      kelompokPenanggungJawab: kelompokPenanggungJawab, // ditentukan sistem
      namaPemilik: data.namaPemilik,
      alamat: data.alamat,
      noHp: data.noHp || '',
      jenisAlat: {
        riceCooker: data.jenisAlat_riceCooker === 'on',
        kipasAngin: data.jenisAlat_kipasAngin === 'on',
        dispenser: data.jenisAlat_dispenser === 'on',
        mesinCuci: data.jenisAlat_mesinCuci === 'on',
        lainnya: data.jenisAlat_lainnya || ''
      },
      merkModel: data.merkModel || '',
      keluhan: data.keluhan || '',
      diagnosis: {
        fusePutus: data.diagnosis_fusePutus === 'on',
        kabelPutus: data.diagnosis_kabelPutus === 'on',
        sakelarRusak: data.diagnosis_sakelarRusak === 'on',
        elemenPemanas: data.diagnosis_elemenPemanas === 'on',
        termostat: data.diagnosis_termosat === 'on',
        kapasitorKipas: data.diagnosis_kapasitorKipas === 'on',
        motor: data.diagnosis_motor === 'on',
        pompaAir: data.diagnosis_pompaAir === 'on',
        lainnya: data.diagnosis_lainnya || ''
      },
      tindakan: {
        gantiKomponen: data.tindakan_gantiKomponen === 'on',
        gantiKomponenDetail: data.tindakan_gantiKomponenDetail || '',
        penyolderan: data.tindakan_penyolderan === 'on',
        pembersihan: data.tindakan_pembersihan === 'on',
        tidakBisaDiperbaiki: data.tindakan_tidakBisa === 'on',
        alasanTidakBisa: data.tindakan_alasanTidakBisa || ''
      },
      sukuCadang: data.sukuCadang || '',
      biayaKomponen: parseInt(data.biayaKomponen) || 0,
      hasilPerbaikan: data.hasilPerbaikan,
      sudahDiuji: data.sudahDiuji,
      keteranganTambahan: data.keteranganTambahan || '',
      waktuSelesai: data.waktuSelesai || '',
      tanggalServis: data.tanggalServis,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.collection('servisan').add(servisanData);
    res.redirect('/mahasiswa/servisan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menyimpan data servisan: ' + err.message);
  }
});

// Form edit (tanpa pengecekan userId)
router.get('/edit/:id', async (req, res) => {
  try {
    const doc = await db.collection('servisan').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const servisan = { id: doc.id, ...doc.data() };
    res.render('mahasiswa/servisan/form', { title: 'Edit Servisan', servisan, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data');
  }
});

// Update servisan (tanpa pengecekan userId)
router.post('/update/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const doc = await db.collection('servisan').doc(id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    // Tidak ada pengecekan userId → semua mahasiswa bisa edit data apapun

    const updateData = {
      namaPemilik: data.namaPemilik,
      alamat: data.alamat,
      noHp: data.noHp || '',
      jenisAlat: {
        riceCooker: data.jenisAlat_riceCooker === 'on',
        kipasAngin: data.jenisAlat_kipasAngin === 'on',
        dispenser: data.jenisAlat_dispenser === 'on',
        mesinCuci: data.jenisAlat_mesinCuci === 'on',
        lainnya: data.jenisAlat_lainnya || ''
      },
      merkModel: data.merkModel || '',
      keluhan: data.keluhan || '',
      diagnosis: {
        fusePutus: data.diagnosis_fusePutus === 'on',
        kabelPutus: data.diagnosis_kabelPutus === 'on',
        sakelarRusak: data.diagnosis_sakelarRusak === 'on',
        elemenPemanas: data.diagnosis_elemenPemanas === 'on',
        termostat: data.diagnosis_termosat === 'on',
        kapasitorKipas: data.diagnosis_kapasitorKipas === 'on',
        motor: data.diagnosis_motor === 'on',
        pompaAir: data.diagnosis_pompaAir === 'on',
        lainnya: data.diagnosis_lainnya || ''
      },
      tindakan: {
        gantiKomponen: data.tindakan_gantiKomponen === 'on',
        gantiKomponenDetail: data.tindakan_gantiKomponenDetail || '',
        penyolderan: data.tindakan_penyolderan === 'on',
        pembersihan: data.tindakan_pembersihan === 'on',
        tidakBisaDiperbaiki: data.tindakan_tidakBisa === 'on',
        alasanTidakBisa: data.tindakan_alasanTidakBisa || ''
      },
      sukuCadang: data.sukuCadang || '',
      biayaKomponen: parseInt(data.biayaKomponen) || 0,
      hasilPerbaikan: data.hasilPerbaikan,
      sudahDiuji: data.sudahDiuji,
      keteranganTambahan: data.keteranganTambahan || '',
      waktuSelesai: data.waktuSelesai || '',
      tanggalServis: data.tanggalServis,
      updatedAt: new Date().toISOString()
    };
    await db.collection('servisan').doc(id).update(updateData);
    res.redirect('/mahasiswa/servisan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal mengupdate data');
  }
});

// Hapus servisan (tanpa pengecekan userId)
router.get('/hapus/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await db.collection('servisan').doc(id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    // Tidak ada pengecekan userId → semua mahasiswa bisa hapus data apapun
    await db.collection('servisan').doc(id).delete();
    res.redirect('/mahasiswa/servisan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus data');
  }
});

// Detail servisan (tanpa pengecekan userId)
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('servisan').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const servisan = { id: doc.id, ...doc.data() };
    res.render('mahasiswa/servisan/detail', { title: 'Detail Servisan', servisan, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail');
  }
});

module.exports = router;