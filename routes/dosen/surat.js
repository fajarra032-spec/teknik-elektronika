const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');

router.use(verifyToken);
router.use(isDosen);

// Helper untuk generate kode validasi
function generateKodeValidasi() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ELK${timestamp}${random}`;
}

// ============================================================================
// DAFTAR SURAT (gabungan dari surat_dosen dan surat_tugas)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    // 1. Ambil dari koleksi surat_dosen (surat umum + izin)
    const snapshotDosen = await db.collection('surat_dosen')
      .where('dosenId', '==', req.dosen.id)
      .orderBy('createdAt', 'desc')
      .get();
    const suratDosenList = snapshotDosen.docs.map(doc => ({ 
      id: doc.id, 
      role: 'dosen',   // menandakan dari koleksi surat_dosen
      ...doc.data() 
    }));

    // 2. Ambil dari koleksi surat_tugas (surat tugas)
    const snapshotTugas = await db.collection('surat_tugas')
      .where('dosenId', '==', req.dosen.id)
      .orderBy('createdAt', 'desc')
      .get();
    const suratTugasList = snapshotTugas.docs.map(doc => ({ 
      id: doc.id, 
      role: 'tugas',   // menandakan dari koleksi surat_tugas
      ...doc.data() 
    }));

    // 3. Gabungkan dan urutkan berdasarkan createdAt
    const suratList = [...suratDosenList, ...suratTugasList].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.render('dosen/persuratan/index', {
      title: 'Daftar Pengajuan Surat',
      suratList,
      dosen: req.dosen
    });
  } catch (error) {
    console.error('Error ambil surat dosen:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data surat' });
  }
});

// ============================================================================
// FORM PENGAJUAN SURAT UMUM
// ============================================================================
router.get('/ajukan', (req, res) => {
  const currentSemester = getCurrentAcademicSemester();
  res.render('dosen/persuratan/ajukan', {
    title: 'Ajukan Surat',
    dosen: req.dosen,
    semester: currentSemester.label,
    tahunAkademik: currentSemester.tahunAkademik
  });
});

// ============================================================================
// PROSES PENGAJUAN SURAT UMUM
// ============================================================================
router.post('/ajukan', async (req, res) => {
  try {
    const { jenisSurat, tujuan, keperluan, isiLain } = req.body;
    if (!jenisSurat || !keperluan) {
      return res.status(400).send('Jenis surat dan keperluan harus diisi');
    }
    const current = getCurrentAcademicSemester();
    const kodeValidasi = generateKodeValidasi();
    await db.collection('surat_dosen').add({
      dosenId: req.dosen.id,
      dosenNama: req.dosen.nama,
      nip: req.dosen.nip,
      email: req.dosen.email,
      jenisSurat,
      tujuan: tujuan || '',
      keperluan,
      isiLain: isiLain || '',
      kodeValidasi,
      status: 'pending',
      semester: current.label,
      tahunAkademik: current.tahunAkademik,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ status: 'pending', timestamp: new Date().toISOString(), catatan: 'Pengajuan surat diterima' }]
    });
    res.redirect('/dosen/surat');
  } catch (error) {
    console.error('Error ajukan surat:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengajukan surat' });
  }
});
// ============================================================================
// FORM PENGAJUAN SURAT TUGAS
// ============================================================================
router.get('/ajukan-tugas', (req, res) => {
  res.render('dosen/persuratan/ajukan_tugas', {
    title: 'Ajukan Surat Tugas',
    dosen: req.dosen
  });
});

// ============================================================================
// PROSES PENGAJUAN SURAT TUGAS
// ============================================================================
router.post('/ajukan-tugas', async (req, res) => {
  try {
    const { namaKegiatan, penyelenggara, tanggalPelaksanaan, jabatan } = req.body;
    if (!namaKegiatan || !penyelenggara || !tanggalPelaksanaan) {
      return res.status(400).send('Nama kegiatan, penyelenggara, dan tanggal pelaksanaan harus diisi');
    }
    const kodeValidasi = generateKodeValidasi();
    const current = getCurrentAcademicSemester();
    await db.collection('surat_tugas').add({
      dosenId: req.dosen.id,
      dosenNama: req.dosen.nama,
      nip: req.dosen.nip,
      email: req.dosen.email,
      jabatan: jabatan || 'Dosen Teknik Elektronika',
      namaKegiatan,
      penyelenggara,
      tanggalPelaksanaan,
      nomorSurat: `TUGAS/${kodeValidasi}`, // sementara, nanti admin bisa ubah
      kodeValidasi,
      status: 'pending',
      semester: current.label,
      tahunAkademik: current.tahunAkademik,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ status: 'pending', timestamp: new Date().toISOString(), catatan: 'Pengajuan surat tugas diterima' }]
    });
    res.redirect('/dosen/surat');
  } catch (error) {
    console.error('Error ajukan tugas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengajukan surat tugas' });
  }
});
// ============================================================================
// FORM PENGAJUAN IZIN DOSEN
// ============================================================================
router.get('/ajukan-izin', (req, res) => {
  res.render('dosen/persuratan/ajukan_izin', {
    title: 'Ajukan Izin',
    dosen: req.dosen,
    user: req.dosen   // untuk kompatibilitas template yang menggunakan user
  });
});

// ============================================================================
// PROSES PENGAJUAN IZIN DOSEN
// ============================================================================
router.post('/ajukan-izin', async (req, res) => {
  try {
    const {
      noHp,
      jenisIzin,
      tanggalMulai,
      tanggalSelesai,
      jumlahHari,
      namaPengganti,
      tugasPengganti,
      bentukPengalihan,
      catatanTambahan
    } = req.body;

    // Validasi wajib
    if (!jenisIzin || !tanggalMulai || !tanggalSelesai || !jumlahHari) {
      return res.status(400).send('Jenis izin, tanggal mulai, tanggal selesai, dan jumlah hari harus diisi');
    }

    // Pastikan jenisIzin berupa array (checkbox multiple)
    const jenisIzinArray = Array.isArray(jenisIzin) ? jenisIzin : (jenisIzin ? [jenisIzin] : []);
    const bentukPengalihanArray = Array.isArray(bentukPengalihan) ? bentukPengalihan : (bentukPengalihan ? [bentukPengalihan] : []);

    const kodeValidasi = generateKodeValidasi();
    const current = getCurrentAcademicSemester();

    const suratData = {
      // Data identitas
      dosenId: req.dosen.id,
      dosenNama: req.dosen.nama,
      nip: req.dosen.nip,
      email: req.dosen.email,
      noHp: noHp || '',
      
      // Data khusus izin
      jenisIzin: jenisIzinArray,
      tanggalMulai,
      tanggalSelesai,
      jumlahHari: parseInt(jumlahHari),
      namaPengganti: namaPengganti || '',
      tugasPengganti: tugasPengganti || '',
      bentukPengalihan: bentukPengalihanArray,
      catatanTambahan: catatanTambahan || '',
      
      // Default persetujuan (admin yang akan menentukan nanti)
      persetujuan: 'Disetujui',
      catatanPersetujuan: '',
      
      // Metadata
      kodeValidasi,
      status: 'pending',
      semester: current.label,
      tahunAkademik: current.tahunAkademik,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ status: 'pending', timestamp: new Date().toISOString(), catatan: 'Pengajuan izin diterima' }]
    };

    await db.collection('surat_dosen').add(suratData);
    res.redirect('/dosen/surat');
  } catch (error) {
    console.error('Error ajukan izin:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengajukan izin' });
  }
});

// ============================================================================
// DETAIL SURAT (mendukung surat_dosen dan surat_tugas)
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let surat = null;
    let dariKoleksi = null;

    // Cek di koleksi surat_dosen
    const docDosen = await db.collection('surat_dosen').doc(id).get();
    if (docDosen.exists) {
      surat = { id: docDosen.id, ...docDosen.data() };
      dariKoleksi = 'surat_dosen';
      if (surat.dosenId !== req.dosen.id) {
        return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke surat ini' });
      }
    } else {
      // Cek di koleksi surat_tugas
      const docTugas = await db.collection('surat_tugas').doc(id).get();
      if (docTugas.exists) {
        surat = { id: docTugas.id, ...docTugas.data() };
        dariKoleksi = 'surat_tugas';
        if (surat.dosenId !== req.dosen.id) {
          return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke surat ini' });
        }
      } else {
        return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Surat tidak ditemukan' });
      }
    }

    // Untuk surat tugas, pastikan ada field yang diperlukan oleh template detail
    // Template detail.ejs mungkin membutuhkan 'jenisSurat', 'keperluan', dll.
    // Surat tugas memiliki field: namaKegiatan, penyelenggara, tanggalPelaksanaan, nomorSurat, dll.
    // Agar template detail bisa menampilkan, kita bisa mapping atau menambahkan field tiruan.
    // Namun karena template detail.ejs sudah kita buat fleksibel (cek field jenisIzin dll),
    // maka untuk surat tugas kita bisa menambahkan field 'jenisSurat = "Surat Tugas"' jika belum ada.
    if (dariKoleksi === 'surat_tugas' && !surat.jenisSurat) {
      surat.jenisSurat = 'Surat Tugas';
    }

    res.render('dosen/persuratan/detail', {
      title: 'Detail Surat',
      surat,
      dosen: req.dosen
    });
  } catch (error) {
    console.error('Error detail surat:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail surat' });
  }
});

// ============================================================================
// BATALKAN PENGAJUAN (hanya untuk surat_dosen dengan status pending)
// ============================================================================
router.post('/:id/batal', async (req, res) => {
  try {
    const { id } = req.params;
    // Cek di surat_dosen dulu
    const docRef = db.collection('surat_dosen').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      // Mungkin surat tugas? Surat tugas tidak bisa dibatalkan oleh dosen karena dibuat admin
      return res.status(404).send('Surat tidak ditemukan atau tidak dapat dibatalkan');
    }
    const surat = doc.data();
    if (surat.dosenId !== req.dosen.id) return res.status(403).send('Akses ditolak');
    if (surat.status !== 'pending') return res.status(400).send('Hanya surat pending yang dapat dibatalkan');
    await docRef.update({
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      history: [...(surat.history || []), { status: 'cancelled', timestamp: new Date().toISOString(), catatan: 'Dibatalkan oleh dosen' }]
    });
    res.redirect('/dosen/surat');
  } catch (error) {
    console.error('Error batalkan surat:', error);
    res.status(500).send('Gagal membatalkan surat');
  }
});

// ============================================================================
// DOWNLOAD SURAT (jika sudah diupload/generate oleh admin)
// ============================================================================
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    let surat = null;

    // Cek di surat_dosen
    const docDosen = await db.collection('surat_dosen').doc(id).get();
    if (docDosen.exists) {
      surat = docDosen.data();
      if (surat.dosenId !== req.dosen.id) return res.status(403).send('Akses ditolak');
    } else {
      // Cek di surat_tugas
      const docTugas = await db.collection('surat_tugas').doc(id).get();
      if (docTugas.exists) {
        surat = docTugas.data();
        if (surat.dosenId !== req.dosen.id) return res.status(403).send('Akses ditolak');
      } else {
        return res.status(404).send('Surat tidak ditemukan');
      }
    }

    if (surat.status !== 'completed' || !surat.fileUrl) {
      return res.status(400).send('Surat belum tersedia');
    }
    res.redirect(surat.fileUrl);
  } catch (error) {
    console.error('Error download surat:', error);
    res.status(500).send('Gagal mengunduh surat');
  }
});

module.exports = router;