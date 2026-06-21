/**
 * routes/ic3.js - Router Pengelolaan Pendaftaran & Pendataan Minat Ujian IC3
 * Politeknik Dewantara (Palopo)
 * 
 * Menggunakan database JSON lokal dan Google Drive untuk penyimpanan KTM
 * dengan kompresi gambar menggunakan sharp.
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { Readable } = require('stream');
const drive = require('../config/googleDrive');

// ===== MIDDLEWARE PAYLOAD LIMIT =====
router.use(express.json({ limit: '15mb' }));
router.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ===== KONFIGURASI MULTER =====
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file gambar (JPG, PNG, WEBP) yang diperbolehkan.'), false);
    }
  }
});

// ===== KONSTANTA FOLDER GOOGLE DRIVE =====
// Folder root "Data WEB" – sesuaikan dengan ID folder Anda
const ROOT_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

// ===== LOKASI DATABASE =====
const DATA_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'registrations.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Data awal (mock)
const initialRegistrants = [
  {
    id: 'reg-1',
    name: 'Ahmad Fauzi',
    nim: '202401042',
    prodi: 'Teknologi Rekayasa Multimedia',
    email: 'ahmad.fauzi@student.polidewa.ac.id',
    whatsapp: '081234567890',
    ic3Level: 'Level 1',
    registrationNo: 1,
    fee: 0,
    paymentStatus: 'not_applicable',
    verificationStatus: 'approved',
    verificationReason: 'KTM Terverifikasi Otomatis. Nama dan NIM sesuai dengan Mahasiswa Politeknik Dewantara.',
    ktmFileId: null,
    ktmFileUrl: null,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: 'reg-2',
    name: 'Siti Rahmawati',
    nim: '202302115',
    prodi: 'Teknik Elektronika',
    email: 'siti.rahma@student.polidewa.ac.id',
    whatsapp: '082345678901',
    ic3Level: 'Level 2',
    registrationNo: 2,
    fee: 0,
    paymentStatus: 'not_applicable',
    verificationStatus: 'approved',
    verificationReason: 'KTM Terverifikasi Otomatis. Nama dan NIM sesuai untuk mahasiswa Politeknik Dewantara.',
    ktmFileId: null,
    ktmFileUrl: null,
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  },
  {
    id: 'reg-3',
    name: 'Budi Pratama',
    nim: '202401089',
    prodi: 'Teknik Sipil',
    email: 'budi.pratama@student.polidewa.ac.id',
    whatsapp: '083456789012',
    ic3Level: 'Level 1',
    registrationNo: 3,
    fee: 0,
    paymentStatus: 'not_applicable',
    verificationStatus: 'pending',
    verificationReason: 'KTM sedang dalam antrean verifikasi otomatis.',
    ktmFileId: null,
    ktmFileUrl: null,
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  }
];

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(initialRegistrants, null, 2), 'utf8');
}

// --- Helper database ---
function getRegistrants() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database:', err);
    return [];
  }
}

function saveRegistrants(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

function computeStats(registrants) {
  const total = registrants.length;
  const freeLimit = 80;
  const freeSlotsUsed = Math.min(total, freeLimit);
  const freeSlotsRemaining = Math.max(0, freeLimit - total);
  const paidSlotsCount = Math.max(0, total - freeLimit);

  const levelDistribution = {
    'Level 1': registrants.filter(r => r.ic3Level === 'Level 1').length,
    'Level 2': registrants.filter(r => r.ic3Level === 'Level 2').length,
    'Level 3': registrants.filter(r => r.ic3Level === 'Level 3').length,
  };

  const prodiDistribution = {};
  registrants.forEach(r => {
    prodiDistribution[r.prodi] = (prodiDistribution[r.prodi] || 0) + 1;
  });

  return {
    totalRegistrants: total,
    freeSlotsUsed,
    freeSlotsRemaining,
    paidSlotsCount,
    levelDistribution,
    prodiDistribution,
  };
}

// ============================================================================
// FUNGSI GOOGLE DRIVE – GET OR CREATE FOLDER
// ============================================================================

/**
 * Mendapatkan atau membuat folder di Google Drive
 * @param {string} parentId - ID folder induk
 * @param {string} folderName - Nama folder yang dicari/dibuat
 * @returns {Promise<string>} ID folder
 */
async function getOrCreateFolder(parentId, folderName) {
  try {
    // Cari folder dengan nama yang sama di parent
    const query = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: 'files(id)',
    });

    if (query.data.files.length > 0) {
      return query.data.files[0].id;
    }

    // Buat folder baru
    const folder = await drive.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });

    console.log(`✅ Folder "${folderName}" berhasil dibuat di Drive.`);
    return folder.data.id;
  } catch (error) {
    console.error('Error getOrCreateFolder:', error.message);
    throw new Error(`Gagal mengakses folder di Google Drive: ${error.message}`);
  }
}

/**
 * Mendapatkan folder KTM dengan struktur:
 * Data WEB / IC3 / KTM / [tahun] / [NIM]
 * @param {string} nim - NIM mahasiswa
 * @param {string} tahun - Tahun (dari NIM)
 * @returns {Promise<string>} ID folder tujuan
 */
async function getKtmFolder(nim, tahun) {
  try {
    // 1. Folder "IC3" di bawah ROOT_FOLDER_ID
    const ic3FolderId = await getOrCreateFolder(ROOT_FOLDER_ID, 'IC3');
    
    // 2. Folder "KTM" di bawah IC3
    const ktmFolderId = await getOrCreateFolder(ic3FolderId, 'KTM');
    
    // 3. Folder tahun (contoh: "2024")
    const tahunFolderId = await getOrCreateFolder(ktmFolderId, tahun);
    
    // 4. Folder NIM mahasiswa
    const nimFolderId = await getOrCreateFolder(tahunFolderId, nim);
    
    return nimFolderId;
  } catch (error) {
    console.error('Error getKtmFolder:', error);
    throw error;
  }
}

// ============================================================================
// FUNGSI UPLOAD DENGAN KOMPRESI
// ============================================================================

/**
 * Kompresi gambar dan upload ke Google Drive
 * @param {Buffer} fileBuffer - Buffer file asli
 * @param {string} originalName - Nama asli file
 * @param {string} mimeType - MIME type
 * @param {string} folderId - ID folder tujuan
 * @param {string} customName - Nama file kustom
 * @returns {Promise<{fileId: string, webViewLink: string, webContentLink: string}>}
 */
async function compressAndUpload(fileBuffer, originalName, mimeType, folderId, customName = null) {
  try {
    // 1. Kompresi gambar
    let compressedBuffer;
    try {
      compressedBuffer = await sharp(fileBuffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch (sharpError) {
      console.error('Sharp compression error:', sharpError);
      compressedBuffer = fileBuffer; // fallback ke asli
    }

    // 2. Upload ke Google Drive
    const fileName = customName || `KTM_${Date.now()}_${originalName}`;
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };
    const media = {
      mimeType: 'image/jpeg',
      body: Readable.from(compressedBuffer),
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    // 3. Set izin publik
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    console.log(`✅ File ${fileName} berhasil diupload ke Drive (ID: ${response.data.id})`);
    console.log(`   Ukuran: ${(fileBuffer.length / 1024).toFixed(0)}KB → ${(compressedBuffer.length / 1024).toFixed(0)}KB`);

    return {
      fileId: response.data.id,
      webViewLink: response.data.webViewLink,
      webContentLink: response.data.webContentLink || `https://drive.google.com/uc?id=${response.data.id}&export=view`,
    };
  } catch (error) {
    console.error('Error compressAndUpload:', error);
    throw new Error(`Gagal upload ke Google Drive: ${error.message}`);
  }
}

// ============================================================================
// ROUTES
// ============================================================================

// 1. GET: HALAMAN UTAMA
router.get('/', (req, res, next) => {
  console.log('✅ Route /ic3 dipanggil');
  try {
    const registrants = getRegistrants();
    console.log('📊 Jumlah registrants:', registrants.length);
    const stats = computeStats(registrants);
    console.log('📊 Stats:', stats);

    // Render dengan callback untuk menangkap error
    res.render('ic3/register', {
      title: 'Pendataan Minat & Ujian IC3 Digital Literacy',
      stats: stats,
      registrants: registrants,
      user: req.user || null,
      isFreeSlotAvailable: stats.totalRegistrants < 80,
      nextRegistrationNo: stats.totalRegistrants + 1,
    }, (err, html) => {
      if (err) {
        console.error('❌ EJS Render Error:', err);
        return res.status(500).send(`<h1>Error Rendering</h1><pre>${err.stack}</pre>`);
      }
      res.send(html);
    });
  } catch (error) {
    console.error('❌ Error loading IC3 main page:', error);
    next(error);
  }
});

// 2. POST: PENDAFTARAN
router.post('/register', upload.single('ktmFile'), async (req, res) => {
  const { name, nim, prodi, email, whatsapp, ic3Level } = req.body;
  const file = req.file;

  // Validasi
  if (!name || !nim || !prodi || !email || !whatsapp || !ic3Level) {
    return res.status(400).json({ success: false, error: 'Mohon isi semua data yang wajib.' });
  }
  if (!file) {
    return res.status(400).json({ success: false, error: 'Mohon unggah foto Kartu Tanda Mahasiswa (KTM).' });
  }

  try {
    const registrants = getRegistrants();

    // Cek duplikasi NIM
    const exists = registrants.find(r => r.nim?.toLowerCase() === nim?.toLowerCase());
    if (exists) {
      return res.status(400).json({
        success: false,
        error: `NIM ${nim} sudah terdaftar dalam sistem. Silakan cek status di kolom pencarian.`
      });
    }

    // Dapatkan tahun dari NIM (2 digit pertama)
    const tahun = `20${nim.substring(0, 2)}`;

    // Dapatkan folder tujuan di Google Drive
    let folderId;
    try {
      folderId = await getKtmFolder(nim, tahun);
    } catch (folderError) {
      console.error('Gagal mendapatkan folder Drive:', folderError);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengakses Google Drive. Silakan coba lagi atau hubungi admin.'
      });
    }

    // Upload dan kompresi
    let uploadResult;
    try {
      uploadResult = await compressAndUpload(
        file.buffer,
        file.originalname,
        file.mimetype,
        folderId,
        `KTM_${nim}_${Date.now()}.jpg`
      );
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengunggah KTM. Silakan coba lagi.'
      });
    }

    // Hitung nomor urut dan biaya
    const registrationNo = registrants.length + 1;
    const fee = registrationNo <= 80 ? 0 : 700000;
    const paymentStatus = fee === 0 ? 'not_applicable' : 'pending';

    // Verifikasi sederhana
    let verificationStatus = 'pending';
    let verificationReason = 'KTM sedang diproses oleh sistem pintar.';
    if (nim.length >= 5) {
      verificationStatus = 'approved';
      verificationReason = '[Verifikasi Simulasi] Berhasil mencocokkan format NIM Politeknik Dewantara secara otomatis.';
    } else {
      verificationStatus = 'rejected';
      verificationReason = '[Verifikasi Simulasi] Gagal memvalidasi KTM. NIM terlalu pendek / tidak sesuai format.';
    }

    // Simpan data
    const newRegistrant = {
      id: 'reg-' + Date.now(),
      name: name.trim(),
      nim: nim.trim(),
      prodi: prodi,
      email: email.toLowerCase().trim(),
      whatsapp: whatsapp.trim(),
      ic3Level: ic3Level,
      registrationNo: registrationNo,
      fee: fee,
      paymentStatus: paymentStatus,
      verificationStatus: verificationStatus,
      verificationReason: verificationReason,
      ktmFileId: uploadResult.fileId,
      ktmFileUrl: uploadResult.webViewLink,
      createdAt: new Date().toISOString()
    };

    registrants.push(newRegistrant);
    saveRegistrants(registrants);

    res.json({
      success: true,
      message: 'Pendaftaran berhasil disimpan!',
      registrant: {
        registrationNo: newRegistrant.registrationNo,
        fee: newRegistrant.fee,
        verificationStatus: newRegistrant.verificationStatus,
        verificationReason: newRegistrant.verificationReason,
        ktmFileUrl: newRegistrant.ktmFileUrl,
      }
    });
  } catch (error) {
    console.error('Error saving registration:', error);
    res.status(500).json({ success: false, error: 'Terjadi kesalahan internal server.' });
  }
});

// 3. GET: PENCARIAN STATUS
router.get('/status/:nim', (req, res) => {
  const { nim } = req.params;
  if (!nim) {
    return res.status(400).json({ success: false, error: 'NIM wajib disertakan.' });
  }

  try {
    const registrants = getRegistrants();
    const found = registrants.find(r => r.nim?.toLowerCase() === nim.toLowerCase().trim());

    if (!found) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
    }

    res.json({ success: true, data: found });
  } catch (error) {
    console.error('Error searching NIM:', error);
    res.status(500).json({ success: false, error: 'Gagal memproses pencarian.' });
  }
});

// 4. GET: STATISTIK
router.get('/stats-summary', (req, res) => {
  try {
    const registrants = getRegistrants();
    const stats = computeStats(registrants);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ totalRegistrants: 0, freeSlotsRemaining: 80 });
  }
});

// 5. API ADMIN: Dapatkan semua pendaftar
router.get('/api/registrants', (req, res) => {
  const list = getRegistrants();
  res.json([...list].sort((a, b) => b.registrationNo - a.registrationNo));
});

// 6. API ADMIN: Update status
router.post('/api/registrants/update-status', (req, res) => {
  const { id, verificationStatus, paymentStatus, verificationReason } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID pendaftar diperlukan.' });
  }

  const list = getRegistrants();
  const index = list.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Pendaftar tidak ditemukan.' });
  }

  if (verificationStatus) {
    list[index].verificationStatus = verificationStatus;
    if (!verificationReason) {
      if (verificationStatus === 'approved') {
        list[index].verificationReason = 'Disetujui secara manual oleh Admin Program Studi Politeknik Dewantara.';
      } else if (verificationStatus === 'rejected') {
        list[index].verificationReason = 'Ditolak secara manual. Harap melapor ke admin prodi untuk detail berkas pendukung.';
      } else {
        list[index].verificationReason = 'Menunggu peninjauan ulang oleh admin.';
      }
    }
  }

  if (paymentStatus) {
    list[index].paymentStatus = paymentStatus;
  }

  if (verificationReason !== undefined) {
    list[index].verificationReason = verificationReason;
  }

  saveRegistrants(list);
  res.json({ success: true, registrant: list[index] });
});

// 7. API ADMIN: Hapus pendaftar
router.delete('/api/registrants/:id', async (req, res) => {
  const { id } = req.params;
  let list = getRegistrants();
  const index = list.findIndex(r => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Pendaftar tidak ditemukan.' });
  }

  const registrant = list[index];
  if (registrant.ktmFileId) {
    try {
      await drive.files.delete({ fileId: registrant.ktmFileId });
      console.log(`File KTM ${registrant.ktmFileId} berhasil dihapus dari Drive.`);
    } catch (err) {
      console.error('Gagal hapus file dari Drive:', err.message);
    }
  }

  const newList = list.filter(r => r.id !== id);
  newList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  newList.forEach((r, idx) => {
    r.registrationNo = idx + 1;
    r.fee = r.registrationNo <= 80 ? 0 : 700000;
    if (r.fee === 0) {
      r.paymentStatus = 'not_applicable';
    } else if (r.fee > 0 && r.paymentStatus === 'not_applicable') {
      r.paymentStatus = 'pending';
    }
  });

  saveRegistrants(newList);
  res.json({ success: true, message: 'Pendaftar berhasil dihapus.' });
});

// 8. API ADMIN: Reset database
router.post('/api/registrants/reset', (req, res) => {
  const resetData = initialRegistrants.map((r, idx) => ({
    ...r,
    id: 'reg-' + (idx + 1),
    registrationNo: idx + 1,
    fee: idx < 80 ? 0 : 700000,
    paymentStatus: idx < 80 ? 'not_applicable' : 'pending',
    ktmFileId: null,
    ktmFileUrl: null,
  }));
  saveRegistrants(resetData);
  res.json({ success: true, message: 'Database berhasil direset ke data contoh.' });
});

module.exports = router;