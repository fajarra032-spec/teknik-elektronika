/**
 * routes/mahasiswa/surat.js
 * Modul Persuratan Mahasiswa: pengajuan surat aktif kuliah dan surat lainnya
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');

// ============================================================================
// KONSTANTA FOLDER UTAMA (Data WEB) – untuk digunakan admin nanti
// ============================================================================
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

// Fungsi ini akan digunakan oleh admin untuk menyimpan file surat
async function getOrCreateSubFolder(parentId, name) {
  const drive = require('../../config/googleDrive'); // di-include di sini karena hanya untuk admin
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

router.use(verifyToken);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/**
 * Generate kode validasi (untuk keaslian surat)
 */
function generateKodeValidasi() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ELK${timestamp}${random}`;
}

// ============================================================================
// DAFTAR SURAT
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('surat')
      .where('userId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    const suratList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('mahasiswa/persuratan/index', {
      title: 'Daftar Surat',
      user: req.user,
      suratList
    });
  } catch (error) {
    console.error('Error memuat daftar surat:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal memuat daftar surat' 
    });
  }
});

// ============================================================================
// PENGAJUAN SURAT AKTIF KULIAH
// ============================================================================

router.get('/aktif-kuliah', (req, res) => {
  const currentSemester = getCurrentAcademicSemester(); // helper
  const semesterSekarang = currentSemester.label;
  const tahunAkademik = currentSemester.tahunAkademik;
  res.render('mahasiswa/persuratan/aktif_form', {
    title: 'Ajukan Surat Aktif Kuliah',
    user: req.user,
    semesterSekarang,
    tahunAkademik   // <- pastikan ini ada
  });
});

router.post('/aktif-kuliah', async (req, res) => {
  try {
    const { keperluan, tempatLahir, tanggalLahir } = req.body;
    if (!keperluan || !tempatLahir || !tanggalLahir) {
      return res.status(400).send('Keperluan, tempat lahir, dan tanggal lahir harus diisi');
    }

    const current = getCurrentAcademicSemester();
    const semester = current.label;
    const tahunAkademik = current.tahunAkademik;
    const kodeValidasi = generateKodeValidasi();

    const suratData = {
      userId: req.user.id,
      nim: req.user.nim,
      nama: req.user.nama,
      jenis: 'Aktif Kuliah',
      kodeValidasi,
      keperluan,
      tempatLahir,
      tanggalLahir,
      semester,
      tahunAkademik,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{
        status: 'pending',
        timestamp: new Date().toISOString(),
        catatan: 'Pengajuan surat diterima'
      }]
    };

    await db.collection('surat').add(suratData);
    res.redirect('/mahasiswa/persuratan');
  } catch (error) {
    console.error('Error mengajukan surat:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal mengajukan surat' 
    });
  }
});

// ============================================================================
// PENGAJUAN SURAT PERMOHONAN KEBIJAKAN SPP
// ============================================================================

router.get('/kebijakan-spp', (req, res) => {
  const currentSemester = getCurrentAcademicSemester();
  res.render('mahasiswa/persuratan/kebijakan_spp_form', {
    title: 'Ajukan Surat Permohonan Kebijakan SPP',
    user: req.user,
    semesterSekarang: currentSemester.label,
    tahunAkademik: currentSemester.tahunAkademik
  });
});

router.post('/kebijakan-spp', async (req, res) => {
  try {
    const { noHp, alasan, batasWaktu } = req.body;
    // Rincian pembayaran dikirim sebagai array (name="jenisPembayaran[]" dst)
    let { jenisPembayaran, jumlahBiaya, waktuPembayaran, keteranganItem } = req.body;

    // Normalisasi: kalau cuma 1 baris, express tidak membungkusnya jadi array
    const toArray = (v) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]));
    jenisPembayaran = toArray(jenisPembayaran);
    jumlahBiaya = toArray(jumlahBiaya);
    waktuPembayaran = toArray(waktuPembayaran);
    keteranganItem = toArray(keteranganItem);

    if (!alasan || !batasWaktu) {
      return res.status(400).send('Alasan dan batas waktu pembayaran harus diisi');
    }
    if (jenisPembayaran.length === 0 || jenisPembayaran.every(v => !v)) {
      return res.status(400).send('Minimal 1 rincian pembayaran harus diisi');
    }

    // Susun rincian pembayaran + hitung total (angka polos, tanpa "Rp"/titik)
    const rincianPembayaran = [];
    let totalBiaya = 0;
    for (let i = 0; i < jenisPembayaran.length; i++) {
      if (!jenisPembayaran[i]) continue;
      const angka = parseInt(String(jumlahBiaya[i] || '0').replace(/[^0-9]/g, ''), 10) || 0;
      totalBiaya += angka;
      rincianPembayaran.push({
        jenis: jenisPembayaran[i],
        jumlah: angka,
        waktu: waktuPembayaran[i] || '',
        keterangan: keteranganItem[i] || ''
      });
    }

    const current = getCurrentAcademicSemester();
    const semester = current.label;
    const tahunAkademik = current.tahunAkademik;
    const kodeValidasi = generateKodeValidasi();

    const suratData = {
      userId: req.user.id,
      nim: req.user.nim,
      nama: req.user.nama,
      jenis: 'Permohonan Kebijakan SPP',
      kodeValidasi,
      keperluan: 'Permohonan kebijakan penyelesaian pembayaran SPP',
      noHp: noHp || req.user.noHp || '',
      alasan,
      batasWaktu,
      rincianPembayaran,
      totalBiaya,
      semester,
      tahunAkademik,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{
        status: 'pending',
        timestamp: new Date().toISOString(),
        catatan: 'Pengajuan surat diterima'
      }]
    };

    await db.collection('surat').add(suratData);
    res.redirect('/mahasiswa/persuratan');
  } catch (error) {
    console.error('Error mengajukan surat kebijakan SPP:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal mengajukan surat'
    });
  }
});

// ============================================================================
// PENGAJUAN SURAT LAINNYA
// ============================================================================

router.get('/lainnya', (req, res) => {
  res.render('mahasiswa/persuratan/lainnya_form', {
    title: 'Ajukan Surat Lainnya',
    user: req.user
  });
});

router.post('/lainnya', async (req, res) => {
  try {
    const { jenisSurat, keperluan, keterangan } = req.body;
    if (!jenisSurat || !keperluan) {
      return res.status(400).send('Jenis surat dan keperluan harus diisi');
    }

    const kodeValidasi = generateKodeValidasi();

    const suratData = {
      userId: req.user.id,
      nim: req.user.nim,
      nama: req.user.nama,
      jenis: jenisSurat,
      kodeValidasi,
      keperluan,
      keterangan: keterangan || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{
        status: 'pending',
        timestamp: new Date().toISOString(),
        catatan: 'Pengajuan surat diterima'
      }]
    };

    await db.collection('surat').add(suratData);
    res.redirect('/mahasiswa/persuratan');
  } catch (error) {
    console.error('Error mengajukan surat:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal mengajukan surat' 
    });
  }
});

// ============================================================================
// DETAIL SURAT
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('surat').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).send('Surat tidak ditemukan');
    }
    const surat = { id: doc.id, ...doc.data() };
    if (surat.userId !== req.user.id) {
      return res.status(403).send('Akses ditolak');
    }
    res.render('mahasiswa/persuratan/detail', {
      title: 'Detail Surat',
      user: req.user,
      surat
    });
  } catch (error) {
    console.error('Error detail surat:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal memuat detail surat' 
    });
  }
});

// ============================================================================
// DOWNLOAD SURAT (PDF) - setelah admin upload file
// ============================================================================

router.get('/:id/download', async (req, res) => {
  try {
    const doc = await db.collection('surat').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Surat tidak ditemukan');
    const surat = doc.data();
    if (surat.userId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (surat.status !== 'completed') {
      return res.status(400).send('Surat belum tersedia');
    }
    if (!surat.fileUrl) {
      return res.status(400).send('File surat belum diupload');
    }
    // Redirect ke URL file (bisa juga download langsung)
    res.redirect(surat.fileUrl);
  } catch (error) {
    console.error('Error download surat:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal mengunduh surat' 
    });
  }
});

// ============================================================================
// BATALKAN PENGAJUAN (hanya jika status pending)
// ============================================================================

router.post('/:id/batal', async (req, res) => {
  try {
    const docRef = db.collection('surat').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Surat tidak ditemukan');
    const surat = doc.data();
    if (surat.userId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (surat.status !== 'pending') {
      return res.status(400).send('Hanya surat dengan status pending yang dapat dibatalkan');
    }

    await docRef.update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      history: [
        ...(surat.history || []),
        {
          status: 'cancelled',
          timestamp: new Date().toISOString(),
          catatan: 'Dibatalkan oleh mahasiswa'
        }
      ]
    });
    res.redirect('/mahasiswa/persuratan');
  } catch (error) {
    console.error('Error membatalkan surat:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal membatalkan surat' 
    });
  }
});

module.exports = router;