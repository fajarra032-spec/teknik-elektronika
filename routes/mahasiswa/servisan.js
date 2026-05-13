const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const sharp = require('sharp');

const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

// Konstanta folder Data WEB (sama dengan modul magang)
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

// ====================== Fungsi Bantu Google Drive ======================
async function getOrCreateSubFolder(parentId, name) {
  const query = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) {
    return query.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    });
    return folder.data.id;
  }
}

async function getServisanFolder(nim, nama, tanggalServis) {
  const tahun = new Date(tanggalServis).getFullYear().toString();
  const sanitizedNama = nama.replace(/[^a-zA-Z0-9]/g, '_');
  const folderMahasiswa = `${nim}_${sanitizedNama}`;

  const parent = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Dokumentasi Servisan');
  const tahunFolder = await getOrCreateSubFolder(parent, tahun);
  const mahasiswaFolder = await getOrCreateSubFolder(tahunFolder, folderMahasiswa);
  return mahasiswaFolder;
}

// ====================== Generate Nomor Kupon ======================
function generateNoKupon() {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SRV/${yyyymmdd}/${random}`;
}

// ====================== Hitung Kelompok (Round Robin) ======================
async function getNextKelompok() {
  const snapshot = await db.collection('servisan').get();
  const count = snapshot.size;
  const JUMLAH_KELOMPOK = 4;
  const nextKelompok = (count % JUMLAH_KELOMPOK) + 1;
  return `Kelompok ${nextKelompok}`;
}

// ====================== Daftar Semua Servisan ======================
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

// ====================== Form Tambah ======================
router.get('/tambah', (req, res) => {
  res.render('mahasiswa/servisan/form', { title: 'Tambah Servisan', servisan: null, user: req.user });
});

// ====================== Simpan Servisan + Upload Gambar ======================
router.post('/', upload.array('images', 5), async (req, res) => {
  try {
    const data = req.body;
    const files = req.files || [];
    const noKupon = generateNoKupon();
    const kelompokPenanggungJawab = await getNextKelompok();

    // Upload gambar ke Google Drive
    const imageUrls = [];
    const imageFileIds = [];
    if (files.length > 0) {
      const folderId = await getServisanFolder(req.user.nim, req.user.nama, data.tanggalServis);
      for (const file of files) {
        const compressedBuffer = await sharp(file.buffer)
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        const fileName = `${req.user.nim}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const fileMetadata = { name: fileName, parents: [folderId] };
        const media = { mimeType: 'image/jpeg', body: Readable.from(compressedBuffer) };
        const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });

        await drive.permissions.create({
          fileId: response.data.id,
          requestBody: { role: 'reader', type: 'anyone' }
        });

        imageUrls.push(`https://drive.google.com/uc?export=view&id=${response.data.id}`);
        imageFileIds.push(response.data.id);
      }
    }

    const servisanData = {
      userId: req.user.id,
      namaMahasiswa: req.user.nama,
      nim: req.user.nim,
      noKupon: noKupon,
      kelompokPenanggungJawab: kelompokPenanggungJawab,
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
      imageUrls: imageUrls,
      imageFileIds: imageFileIds,
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

// ====================== Form Edit ======================
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

// ====================== Update Servisan (dengan tambah gambar) ======================
router.post('/update/:id', upload.array('images', 5), async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const files = req.files || [];
    const docRef = db.collection('servisan').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');

    const existingData = doc.data();
    const newImageUrls = [...(existingData.imageUrls || [])];
    const newImageFileIds = [...(existingData.imageFileIds || [])];

    // Upload gambar baru (jika ada)
    if (files.length > 0) {
      const folderId = await getServisanFolder(req.user.nim, req.user.nama, data.tanggalServis);
      for (const file of files) {
        const compressedBuffer = await sharp(file.buffer)
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        const fileName = `${req.user.nim}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const fileMetadata = { name: fileName, parents: [folderId] };
        const media = { mimeType: 'image/jpeg', body: Readable.from(compressedBuffer) };
        const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });

        await drive.permissions.create({
          fileId: response.data.id,
          requestBody: { role: 'reader', type: 'anyone' }
        });

        newImageUrls.push(`https://drive.google.com/uc?export=view&id=${response.data.id}`);
        newImageFileIds.push(response.data.id);
      }
    }

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
      imageUrls: newImageUrls,
      imageFileIds: newImageFileIds,
      updatedAt: new Date().toISOString()
    };
    await docRef.update(updateData);
    res.redirect('/mahasiswa/servisan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal mengupdate data: ' + err.message);
  }
});

// ====================== Hapus Servisan (termasuk gambar di Drive) ======================
router.get('/hapus/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await db.collection('servisan').doc(id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const data = doc.data();
    if (data.imageFileIds && data.imageFileIds.length) {
      for (const fileId of data.imageFileIds) {
        try {
          await drive.files.delete({ fileId });
        } catch (err) {
          console.error('Gagal hapus gambar:', err.message);
        }
      }
    }
    await db.collection('servisan').doc(id).delete();
    res.redirect('/mahasiswa/servisan');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus data');
  }
});

// ====================== Detail Servisan ======================
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