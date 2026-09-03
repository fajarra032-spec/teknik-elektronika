// routes/dosen/magangPeriod.js
const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const {
  lockMagangPeriod,
  unlockMagangPeriod,
  extendMagangPeriod,
  updatePerusahaanMagangPeriod
} = require('../../models/magangPeriodModel');

router.use(verifyToken);
router.use(isDosen);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/**
 * Ambil data mahasiswa
 */
async function getActivePdkListForMahasiswa(mahasiswaId) {
  try {
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', mahasiswaId)
      .where('status', '==', 'active')
      .get();

    // ✅ OPTIMISASI KUOTA: ambil semua dokumen mataKuliah SEKALIGUS lewat
    // db.getAll(), bukan satu per satu di dalam loop serial (await di dalam
    // for-loop menunggu satu per satu, padahal bisa sekaligus).
    const enrollments = enrollmentSnapshot.docs.map(doc => doc.data());
    const mkIds = enrollments.map(e => e.mkId);
    const pdkList = [];
    if (mkIds.length > 0) {
      const mkDocs = await db.getAll(...mkIds.map(id => db.collection('mataKuliah').doc(id)));
      mkDocs.forEach(mkDoc => {
        if (mkDoc.exists && mkDoc.data().isPDK === true) {
          pdkList.push({
            id: mkDoc.id,
            kode: mkDoc.data().kode,
            nama: mkDoc.data().nama,
            urutan: mkDoc.data().urutanPDK
          });
        }
      });
    }
    return pdkList;
  } catch (error) {
    console.error('Error getActivePdkListForMahasiswa:', error);
    return [];
  }
}
async function getMahasiswa(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
}

/**
 * Cek apakah dosen ini adalah pembimbing mahasiswa
 */
async function isPembimbing(dosenId, mahasiswaId) {
  const snapshot = await db.collection('bimbingan')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (snapshot.empty) return false;
  const bimbingan = snapshot.docs[0].data();
  return bimbingan.pembimbing1Id === dosenId || bimbingan.pembimbing2Id === dosenId;
}

/**
 * Ambil data bimbingan mahasiswa
 */
async function getBimbingan(mahasiswaId) {
  const snapshot = await db.collection('bimbingan')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Mendapatkan semua periode magang mahasiswa
 */
async function getMagangPeriods(mahasiswaId) {
  const snapshot = await db.collection('magangPeriod')
    .where('mahasiswaId', '==', mahasiswaId)
    .orderBy('pdkKode', 'asc')
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// HALAMAN UTAMA KELOLA PERIODE MAGANG
// ============================================================================

router.get('/:mahasiswaId', async (req, res) => {
  try {
    const { mahasiswaId } = req.params;
    
    const isPembimbingDosen = await isPembimbing(req.dosen.id, mahasiswaId);
    if (!isPembimbingDosen) {
      return res.status(403).send('Anda tidak memiliki akses ke mahasiswa ini');
    }
    
    const mahasiswa = await getMahasiswa(mahasiswaId);
    if (!mahasiswa) {
      return res.status(404).send('Mahasiswa tidak ditemukan');
    }
    
    const bimbingan = await getBimbingan(mahasiswaId);
    const periods = await getMagangPeriods(mahasiswaId);
    
    // Ambil daftar PDK yang tersedia
    const pdkSnapshot = await db.collection('mataKuliah')
      .where('isPDK', '==', true)
      .orderBy('urutanPDK', 'asc')
      .get();
    const activePdks = await getActivePdkListForMahasiswa(mahasiswaId);
    const hasActivePdk = activePdks.length > 0;
    const pdkList = pdkSnapshot.docs.map(doc => ({ 
      id: doc.id, 
      kode: doc.data().kode, 
      nama: doc.data().nama,
      urutan: doc.data().urutanPDK
    }));
    
    res.render('dosen/magang_period', {
      title: `Kelola Magang - ${mahasiswa.nama}`,
      mahasiswa,
      bimbingan,
      periods,
      pdkList,
      activePdks,   // PDK yang sudah diambil mahasiswa
      hasActivePdk, // flag apakah ada PDK aktif
      user: req.user
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memuat data');
  }
});

// ============================================================================
// MULAI PERIODE MAGANG
// ============================================================================

router.post('/start', async (req, res) => {
  try {
    const { 
      mahasiswaId, 
      pdkId, 
      tanggalMulai, 
      tanggalSelesai,
      namaPerusahaan, 
      alamatPerusahaan,
      kontakPerusahaan,
      kontakHpPerusahaan,
      emailPerusahaan,
      websitePerusahaan,
      pembimbingLapangan,
      jabatanPembimbingLapangan
    } = req.body;
    
    if (!mahasiswaId || !pdkId || !tanggalMulai || !namaPerusahaan) {
      return res.status(400).send('Data tidak lengkap. Nama perusahaan wajib diisi.');
    }
    
    // 1. Validasi PDK aktif (harus sudah diambil di KRS)
    const activePdks = await getActivePdkListForMahasiswa(mahasiswaId);
    if (activePdks.length === 0) {
      return res.status(400).send('Mahasiswa belum mengambil mata kuliah PDK. Arahkan mahasiswa untuk membuat KRS PDK terlebih dahulu.');
    }
    const isValidPdk = activePdks.some(p => p.id === pdkId);
    if (!isValidPdk) {
      return res.status(400).send('PDK yang dipilih tidak aktif atau tidak diambil mahasiswa.');
    }
    
    // 2. Validasi akses dosen sebagai pembimbing
    const isPembimbingDosen = await isPembimbing(req.dosen.id, mahasiswaId);
    if (!isPembimbingDosen) {
      return res.status(403).send('Anda tidak memiliki akses');
    }
    
    // 3. Ambil data PDK dari mataKuliah
    const pdkDoc = await db.collection('mataKuliah').doc(pdkId).get();
    if (!pdkDoc.exists) {
      return res.status(404).send('Mata kuliah PDK tidak ditemukan');
    }
    const pdk = pdkDoc.data();
    
    // 4. Cek bimbingan mahasiswa
    const bimbingan = await getBimbingan(mahasiswaId);
    if (!bimbingan) {
      return res.status(400).send('Mahasiswa belum memiliki dosen pembimbing');
    }
    
    // 5. Cek apakah sudah ada periode aktif/locked untuk PDK ini
    const existing = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('pdkId', '==', pdkId)
      .where('status', 'in', ['active', 'locked'])
      .get();
    
    if (!existing.empty) {
      return res.status(400).send(`Mahasiswa sudah memiliki periode magang aktif untuk ${pdk.nama}`);
    }
    
    const now = new Date().toISOString();
    
    await db.collection('magangPeriod').add({
      mahasiswaId,
      pdkId,
      pdkKode: pdk.kode,
      pdkNama: pdk.nama,
      tanggalMulai,
      tanggalSelesai: tanggalSelesai || null,
      status: 'active',
      pembimbing1Id: bimbingan.pembimbing1Id,
      pembimbing1Nama: bimbingan.pembimbing1Nama,
      pembimbing2Id: bimbingan.pembimbing2Id || null,
      pembimbing2Nama: bimbingan.pembimbing2Nama || null,
      perusahaan: {
        nama: namaPerusahaan,
        alamat: alamatPerusahaan || '',
        kontak: kontakPerusahaan || '',
        kontakHp: kontakHpPerusahaan || '',
        email: emailPerusahaan || '',
        website: websitePerusahaan || '',
        pembimbingLapangan: pembimbingLapangan || '',
        jabatanPembimbingLapangan: jabatanPembimbingLapangan || '',
        diisiOleh: req.dosen.id,
        diisiPada: now
      },
      nilai: {
        angka: null,
        huruf: null,
        komentar: null,
        dinilaiOleh: null,
        dinilaiPada: null,
        komponenNilai: {}
      },
      ulasan: { isFilled: false },
      lockHistory: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      history: [{
        action: 'started',
        tanggal: new Date().toISOString().split('T')[0],
        catatan: `Periode magang ${pdk.nama} di ${namaPerusahaan} dimulai oleh ${req.dosen.nama}`
      }]
    });
    
    res.redirect(`/dosen/magang-period/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memulai periode magang: ' + error.message);
  }
});

// ============================================================================
// UPDATE PERUSAHAAN
// ============================================================================

router.post('/:periodId/update-perusahaan', async (req, res) => {
  try {
    const { periodId } = req.params;
    const {
      namaPerusahaan,
      alamatPerusahaan,
      kontakPerusahaan,
      kontakHpPerusahaan,
      emailPerusahaan,
      websitePerusahaan,
      pembimbingLapangan,
      jabatanPembimbingLapangan
    } = req.body;
    
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    
    if (!periodDoc.exists) {
      return res.status(404).send('Periode magang tidak ditemukan');
    }
    
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    
    const isPembimbingDosen = await isPembimbing(req.dosen.id, mahasiswaId);
    if (!isPembimbingDosen) {
      return res.status(403).send('Anda tidak memiliki akses');
    }
    
    await updatePerusahaanMagangPeriod(periodId, {
      nama: namaPerusahaan,
      alamat: alamatPerusahaan,
      kontak: kontakPerusahaan,
      kontakHp: kontakHpPerusahaan,
      email: emailPerusahaan,
      website: websitePerusahaan,
      pembimbingLapangan,
      jabatanPembimbingLapangan
    }, { id: req.dosen.id, nama: req.dosen.nama });
    
    res.redirect(`/dosen/magang-period/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal update perusahaan');
  }
});

// ============================================================================
// LOCK PERIODE MAGANG
// ============================================================================

router.post('/:periodId/lock', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { reason } = req.body;
    
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    
    if (!periodDoc.exists) {
      return res.status(404).send('Periode magang tidak ditemukan');
    }
    
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    
    const isPembimbingDosen = await isPembimbing(req.dosen.id, mahasiswaId);
    if (!isPembimbingDosen) {
      return res.status(403).send('Anda tidak memiliki akses');
    }
    
    await lockMagangPeriod(periodId, reason, { id: req.dosen.id, nama: req.dosen.nama });
    
    res.redirect(`/dosen/magang-period/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal mengunci periode magang: ' + error.message);
  }
});

// ============================================================================
// UNLOCK PERIODE MAGANG
// ============================================================================

router.post('/:periodId/unlock', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { reason } = req.body;
    
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    
    if (!periodDoc.exists) {
      return res.status(404).send('Periode magang tidak ditemukan');
    }
    
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    
    const isPembimbingDosen = await isPembimbing(req.dosen.id, mahasiswaId);
    if (!isPembimbingDosen) {
      return res.status(403).send('Anda tidak memiliki akses');
    }
    
    await unlockMagangPeriod(periodId, reason, { id: req.dosen.id, nama: req.dosen.nama });
    
    res.redirect(`/dosen/magang-period/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal membuka kunci periode magang: ' + error.message);
  }
});

// ============================================================================
// PERPANJANG PERIODE MAGANG
// ============================================================================

router.post('/:periodId/extend', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { tanggalSelesaiBaru, catatan } = req.body;
    
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    
    if (!periodDoc.exists) {
      return res.status(404).send('Periode magang tidak ditemukan');
    }
    
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    
    const isPembimbingDosen = await isPembimbing(req.dosen.id, mahasiswaId);
    if (!isPembimbingDosen) {
      return res.status(403).send('Anda tidak memiliki akses');
    }
    
    await extendMagangPeriod(periodId, tanggalSelesaiBaru, catatan, { id: req.dosen.id, nama: req.dosen.nama });
    
    res.redirect(`/dosen/magang-period/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memperpanjang periode magang');
  }
});

// ============================================================================
// CATATAN: Route lama "BERI NILAI & SELESAIKAN MAGANG" (POST
// /:periodId/complete, input satu nilaiAngka manual) SUDAH DIHAPUS.
// Sistem ini digantikan sepenuhnya oleh alur 3-pihak di
// helpers/nilaiMagangHelper.js (Nilai Laporan oleh Pembimbing 1, Nilai
// Logbook oleh Pembimbing 2 setelah kunci logbook, Nilai Pendamping
// Lapangan oleh Admin), yang dikunci ke grades/KHS lewat
// kunciNilaiMagangKeGrades() di routes/admin/emagang.js. Route lama
// tidak mengecek ACC laporan maupun kunci logbook, dan menimpa nilai
// akhir tanpa melalui rata-rata 3 pihak - berisiko menimpa nilai yang
// sudah dikunci lewat alur baru. Jangan tambahkan lagi.
// ============================================================================

module.exports = router;