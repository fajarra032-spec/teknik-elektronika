/**
 * routes/mahasiswa/biodata.js
 * Biodata Mahasiswa – lihat dan edit profil, foto, nomor HP, ubah password
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db, auth } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const sharp = require('sharp'); // <-- tambahkan sharp untuk kompresi
const { BIODATA_FIELDS, GROUP_LABELS, isNikFormatValid, getBiodataKosong, isBiodataLengkap } = require('../../helpers/biodataHelper');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // Batas 10MB sebelum kompresi
});

// Semua route memerlukan autentikasi
router.use(verifyToken);

// ============================================================================
// FUNGSI BANTU UNTUK STRUKTUR FOLDER DI DRIVE
// ============================================================================

// ID folder root "Data WEB" (ganti dengan ID folder Anda)
const ROOT_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

/**
 * Mendapatkan atau membuat subfolder di Drive.
 * @param {string} parentId - ID folder induk.
 * @param {string} folderName - Nama folder yang dicari/dibuat.
 * @returns {Promise<string>} ID folder.
 */
async function getOrCreateFolder(parentId, folderName) {
  const query = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) {
    return query.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id',
    });
    return folder.data.id;
  }
}

/**
 * Mendapatkan angkatan dari NIM (2 digit pertama + 20).
 * Contoh: nim "24100200" -> "2024"
 */
function getAngkatanFromNim(nim) {
  if (!nim || nim.length < 2) return null;
  const duaDigit = nim.substring(0, 2);
  return `20${duaDigit}`;
}

// ============================================================================
// RUTE UTAMA – TAMPIL BIODATA
// ============================================================================

router.get('/', (req, res) => {
  try {
    const user = req.user;
    res.render('mahasiswa/biodata/index', {
      title: 'Biodata Saya',
      user,
      biodataFields: BIODATA_FIELDS,
      groupLabels: GROUP_LABELS,
      biodataKosong: getBiodataKosong(user),
      success: req.query.success,
      reset: req.query.reset
    });
  } catch (error) {
    console.error('Error memuat biodata:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat biodata'
    });
  }
});

// ============================================================================
// FORM EDIT BIODATA
// ============================================================================

router.get('/edit', (req, res) => {
  try {
    res.render('mahasiswa/biodata/edit', {
      title: 'Edit Biodata',
      user: req.user,
      biodataFields: BIODATA_FIELDS,
      groupLabels: GROUP_LABELS,
      biodataKosong: getBiodataKosong(req.user),
      // ?wajib=1 dikirim oleh gate (middleware/auth.js) saat biodata belum
      // lengkap - dipakai di view untuk menampilkan banner "wajib lengkapi"
      // dan menyembunyikan link "Kembali" (supaya tidak bisa lompat balik
      // sebelum benar-benar lengkap).
      wajib: req.query.wajib === '1'
    });
  } catch (error) {
    console.error('Error memuat form edit:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat form edit'
    });
  }
});

/**
 * POST /mahasiswa/biodata/edit
 * Memperbarui biodata mahasiswa (nama, email, noHp, foto, + seluruh field
 * biodata lengkap: NIK, TTL, jenis kelamin, agama, alamat, data ortu, data
 * asal sekolah - lihat helpers/biodataHelper.js untuk daftar lengkapnya)
 */
router.post('/edit', upload.single('foto'), async (req, res) => {
  try {
    console.log('🚀 Route POST /mahasiswa/biodata/edit dipanggil');
    const { nama, email } = req.body;
    const file = req.file;
    const userId = req.user.id;
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send('Data mahasiswa tidak ditemukan');
    }
    const oldData = userDoc.data();

    // Validasi input
    if (!nama || !email) {
      return res.status(400).send('Nama dan email wajib diisi');
    }

    // Validasi format NIK kalau diisi (harus 16 digit angka)
    if (req.body.nik && !isNikFormatValid(req.body.nik)) {
      return res.status(400).send('NIK tidak valid - harus 16 digit angka sesuai KTP');
    }

    const updateData = {
      nama,
      email,
      updatedAt: new Date().toISOString()
    };

    // Simpan seluruh field biodata (BIODATA_FIELDS) apa adanya dari form -
    // termasuk noHp & agama (menggantikan handling noHp lama di bawah ini,
    // dan mengizinkan mahasiswa mengoreksi agamanya sendiri kalau salah/
    // masih default). Field kosong disimpan string kosong (BUKAN dihapus),
    // supaya getBiodataKosong() tetap bisa mendeteksinya "belum diisi".
    BIODATA_FIELDS.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(req.body, field.key)) {
        updateData[field.key] = (req.body[field.key] || '').toString().trim();
      }
    });

    // Proses foto jika ada file baru
    if (file) {
      // Validasi tipe file (hanya gambar)
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).send('File harus berupa gambar');
      }

      // Validasi ukuran file awal
      if (file.size > 10 * 1024 * 1024) {
        return res.status(400).send('Ukuran file terlalu besar, maksimal 10MB sebelum kompresi');
      }

      // Pastikan NIM tersedia
      const nim = oldData.nim;
      if (!nim) {
        return res.status(400).send('NIM tidak ditemukan, hubungi admin');
      }

      // Dapatkan angkatan dari NIM
      const angkatan = getAngkatanFromNim(nim);
      if (!angkatan) {
        return res.status(400).send('NIM tidak valid');
      }

      // Sanitasi nama untuk folder
      const sanitizedNama = nama.replace(/[^a-zA-Z0-9]/g, '_');
      const mahasiswaFolderName = `${nim}_${sanitizedNama}`;

      // Buat struktur folder:
      // ROOT_FOLDER_ID (Data WEB) -> "Foto Mahasiswa" -> angkatan -> mahasiswaFolderName
      const fotoMahasiswaFolderId = await getOrCreateFolder(ROOT_FOLDER_ID, 'Foto Mahasiswa');
      const angkatanFolderId = await getOrCreateFolder(fotoMahasiswaFolderId, angkatan);
      const mahasiswaFolderId = await getOrCreateFolder(angkatanFolderId, mahasiswaFolderName);

      // Hapus foto lama jika ada
      if (oldData.fotoFileId) {
        try {
          await drive.files.delete({ fileId: oldData.fotoFileId });
          console.log('Foto lama dihapus:', oldData.fotoFileId);
        } catch (err) {
          console.error('Gagal hapus foto lama:', err.message);
        }
      }

      // ==================== KOMPRESI GAMBAR ====================
      let compressedBuffer;
      try {
        compressedBuffer = await sharp(file.buffer)
          .resize({ width: 800, withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
      } catch (sharpError) {
        console.error('Error kompresi gambar:', sharpError);
        return res.status(500).send('Gagal memproses gambar');
      }

      // Nama file: NIM_timestamp.jpg
      const fileName = `${nim}_${Date.now()}.jpg`;
      const fileMetadata = { name: fileName, parents: [mahasiswaFolderId] };
      const media = {
        mimeType: 'image/jpeg',
        body: Readable.from(compressedBuffer)
      };

      // Upload ke Google Drive
      const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id',
      });

      // Beri akses publik
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      });
      console.log('File diupload ke Drive, ID:', response.data.id);
      console.log('Ukuran asli:', file.size, 'bytes');
      console.log('Ukuran setelah kompresi:', compressedBuffer.length, 'bytes');

      // Simpan URL dan fileId
      updateData.foto = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      updateData.fotoFileId = response.data.id;
    }

    // Update email di Firebase Auth jika berubah
    if (email !== oldData.email) {
      try {
        await auth.updateUser(userId, { email });
        console.log('Email di Auth diperbarui');
      } catch (authError) {
        console.error('Gagal update email di Auth:', authError);
        return res.status(400).send('Email sudah digunakan atau tidak valid');
      }
    }

    // Simpan perubahan ke Firestore
    await userRef.update(updateData);
    console.log('Data Firestore berhasil diperbarui');

    // Kalau request ini datang dari gate "wajib lengkapi" (?wajib=1) dan
    // biodatanya SEKARANG sudah lengkap, langsung arahkan ke dashboard -
    // supaya mahasiswa tidak perlu klik lagi setelah selesai onboarding.
    const dataTerbaru = { ...oldData, ...updateData };
    if (req.query.wajib === '1' && isBiodataLengkap(dataTerbaru)) {
      return res.redirect('/mahasiswa/dashboard?biodataLengkap=1');
    }
    res.redirect('/mahasiswa/biodata?success=updated');
  } catch (error) {
    console.error('Error update biodata:', error);
    let message = 'Gagal update biodata';
    if (error.code === 403) {
      message = 'Izin akses Google Drive tidak mencukupi';
    } else if (error.code === 404) {
      message = 'Folder atau file tidak ditemukan di Drive';
    } else {
      message = error.message;
    }
    res.status(500).send('Gagal update biodata: ' + message);
  }
});

// ============================================================================
// HAPUS FOTO PROFIL
// ============================================================================

router.post('/foto/hapus', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send('Data mahasiswa tidak ditemukan');
    }
    const data = userDoc.data();

    if (data.fotoFileId) {
      try {
        await drive.files.delete({ fileId: data.fotoFileId });
        console.log('Foto dihapus dari Drive, ID:', data.fotoFileId);
      } catch (err) {
        console.error('Gagal hapus file dari Drive:', err.message);
      }
    }

    await userRef.update({
      foto: null,
      fotoFileId: null,
      updatedAt: new Date().toISOString()
    });

    res.redirect('/mahasiswa/biodata?success=foto_hapus');
  } catch (error) {
    console.error('Error hapus foto:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal hapus foto'
    });
  }
});

// ============================================================================
// UBAH PASSWORD (mengirim email reset)
// ============================================================================

router.post('/ubah-password', async (req, res) => {
  try {
    const email = req.user.email;
    if (!email) {
      return res.status(400).send('Email tidak ditemukan');
    }

    // Generate password reset link (tidak mengirim email secara otomatis)
    const link = await auth.generatePasswordResetLink(email);
    console.log('Password reset link:', link);

    res.redirect('/mahasiswa/biodata?reset=email_sent');
  } catch (error) {
    console.error('Error reset password:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal mengirim email reset password'
    });
  }
});

module.exports = router;