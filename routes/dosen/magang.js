/**
 * routes/dosen/magang.js
 * Monitoring magang untuk dosen (hanya lihat logbook mahasiswa bimbingan)
 * 
 * OPTIMASI: Gunakan Promise.all untuk paralelisasi query, tanpa mengubah logika bisnis.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { invalidateProgressMagangHarian } = require('../../helpers/magangHelper');
const {
  getNilaiMagang,
  kunciLogbookMagang,
  bukaKunciLogbookMagang,
  saveNilaiLogbook
} = require('../../helpers/nilaiMagangHelper');

router.use(verifyToken);
router.use(isDosen);

// ============================================================================
// FUNGSI BANTU (SAMA PERSIS DENGAN ASLINYA)
// ============================================================================

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Cache sederhana untuk getMahasiswa (per request) - akan di-reset di setiap route utama
let mahasiswaCache = new Map();

async function getMahasiswa(userId) {
  if (mahasiswaCache.has(userId)) return mahasiswaCache.get(userId);
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const result = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : { id: userId, nama: 'Unknown', nim: '-' };
    mahasiswaCache.set(userId, result);
    return result;
  } catch (error) {
    console.error('Error getMahasiswa:', error);
    return { id: userId, nama: 'Error', nim: '-' };
  }
}

async function getMahasiswaBimbingan(dosenId) {
  try {
    // Query paralel untuk pembimbing1 dan pembimbing2
    const [snap1, snap2] = await Promise.all([
      db.collection('bimbingan').where('pembimbing1Id', '==', dosenId).where('status', '==', 'active').get(),
      db.collection('bimbingan').where('pembimbing2Id', '==', dosenId).where('status', '==', 'active').get()
    ]);

    const bimbinganMap = new Map();
    for (const doc of snap1.docs) {
      const data = doc.data();
      bimbinganMap.set(data.mahasiswaId, { ...data, bimbinganId: doc.id, role: 'pembimbing1' });
    }
    for (const doc of snap2.docs) {
      const data = doc.data();
      const mahasiswaId = data.mahasiswaId;
      if (bimbinganMap.has(mahasiswaId)) {
        const existing = bimbinganMap.get(mahasiswaId);
        existing.role = 'pembimbing1_dan_2';
        existing.pembimbing2Id = data.pembimbing2Id;
        existing.pembimbing2Nama = data.pembimbing2Nama;
      } else {
        bimbinganMap.set(mahasiswaId, { ...data, bimbinganId: doc.id, role: 'pembimbing2' });
      }
    }

    if (bimbinganMap.size === 0) return [];

    // Ambil semua data mahasiswa secara paralel
    const mahasiswaIds = Array.from(bimbinganMap.keys());
    const mahasiswaResults = await Promise.all(mahasiswaIds.map(id => getMahasiswa(id)));

    // Ambil periode magang aktif untuk semua mahasiswa secara paralel
    const periodSnapshots = await Promise.all(
      mahasiswaIds.map(id => db.collection('magangPeriod').where('mahasiswaId', '==', id).where('status', '==', 'active').get())
    );

    const result = [];
    for (let i = 0; i < mahasiswaIds.length; i++) {
      const mahasiswaId = mahasiswaIds[i];
      const bimbingan = bimbinganMap.get(mahasiswaId);
      const mahasiswa = mahasiswaResults[i];
      const periodSnapshot = periodSnapshots[i];

      if (mahasiswa && mahasiswa.nama !== 'Unknown') {
        const activePeriods = periodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        result.push({
          ...mahasiswa,
          bimbinganId: bimbingan.bimbinganId,
          semester: bimbingan.semester,
          tahunAjaran: bimbingan.tahunAjaran || '-',
          role: bimbingan.role,
          pembimbing1Id: bimbingan.pembimbing1Id,
          pembimbing1Nama: bimbingan.pembimbing1Nama,
          pembimbing2Id: bimbingan.pembimbing2Id,
          pembimbing2Nama: bimbingan.pembimbing2Nama,
          activePeriods
        });
      }
    }
    return result;
  } catch (error) {
    console.error('Error getMahasiswaBimbingan:', error);
    return [];
  }
}

/**
 * ✅ OPTIMISASI KUOTA: fungsi ini dipanggil SATU KALI PER MAHASISWA BIMBINGAN
 * (lihat statistikPromises di bawah) - sebelumnya, setiap panggilan membaca
 * ULANG SELURUH logbook mahasiswa itu SAMPAI 4 KALI (total, pending,
 * approved, rejected - overlap besar antara query-query ini). Untuk dosen
 * dengan 10 mahasiswa bimbingan x 50 entri logbook, itu bisa >1000 pembacaan
 * dokumen HANYA untuk menampilkan angka statistik. Sekarang pakai Firestore
 * count() aggregation - tidak mengunduh isi dokumen logbook sama sekali,
 * cuma angkanya. Ada fallback ke cara lama kalau versi firebase-admin belum
 * mendukung count().
 */
async function getLogbookStatistik(mahasiswaId, pdkId = null) {
  try {
    let baseQuery = db.collection('logbookMagang').where('userId', '==', mahasiswaId);
    if (pdkId) baseQuery = baseQuery.where('pdkId', '==', pdkId);

    const hitung = async (query) => {
      try {
        const snap = await query.count().get();
        return snap.data().count;
      } catch (err) {
        const snap = await query.get();
        return snap.size;
      }
    };

    const [totalLogbook, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      hitung(baseQuery),
      hitung(baseQuery.where('status', '==', 'pending')),
      hitung(baseQuery.where('status', '==', 'approved')),
      hitung(baseQuery.where('status', '==', 'rejected'))
    ]);

    return { totalLogbook, pendingCount, approvedCount, rejectedCount };
  } catch (error) {
    console.error('Error getLogbookStatistik:', error);
    return { totalLogbook: 0, pendingCount: 0, approvedCount: 0, rejectedCount: 0 };
  }
}

async function isMahasiswaBimbingan(dosenId, mahasiswaId) {
  try {
    const snapshot = await db.collection('bimbingan')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (snapshot.empty) return { isBimbingan: false, role: null };
    const bimbingan = snapshot.docs[0].data();
    if (bimbingan.pembimbing1Id === dosenId) return { isBimbingan: true, role: 'pembimbing1' };
    if (bimbingan.pembimbing2Id === dosenId) return { isBimbingan: true, role: 'pembimbing2' };
    return { isBimbingan: false, role: null };
  } catch (error) {
    console.error('Error isMahasiswaBimbingan:', error);
    return { isBimbingan: false, role: null };
  }
}

async function canApprove(dosenId, mahasiswaId) {
  const { role } = await isMahasiswaBimbingan(dosenId, mahasiswaId);
  return role === 'pembimbing2';
}

async function isMagangPeriodActive(mahasiswaId, pdkId) {
  try {
    const snapshot = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('pdkId', '==', pdkId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    return !snapshot.empty;
  } catch (error) {
    console.error('Error isMagangPeriodActive:', error);
    return false;
  }
}

async function getActiveMagangPeriods(mahasiswaId) {
  try {
    const snapshot = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('status', '==', 'active')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getActiveMagangPeriods:', error);
    return [];
  }
}

// ============================================================================
// ROUTE DAFTAR MAHASISWA BIMBINGAN
// ============================================================================
router.get('/', async (req, res) => {
  try {
    mahasiswaCache.clear(); // Reset cache per request
    let mahasiswaList = await getMahasiswaBimbingan(req.dosen.id);
    
    if (mahasiswaList.length === 0) {
      return res.render('dosen/magang_list', {
        title: 'Monitoring Magang',
        mahasiswaList: [],
        message: 'Anda belum memiliki mahasiswa bimbingan. Silakan hubungi admin.'
      });
    }
    
    // ✅ OPTIMISASI KUOTA: sebelumnya ada 2 masalah di sini:
    //  (a) enrollment & periode aktif di-query TERPISAH UNTUK SETIAP mahasiswa
    //      (N query utk N mahasiswa bimbingan, masing-masing).
    //  (b) untuk SETIAP enrollment dari SETIAP mahasiswa, dokumen mataKuliah
    //      diambil SATU PER SATU secara SERIAL (bukan paralel) - kalau 10
    //      mahasiswa x 5 enrollment, itu 50 pembacaan dokumen satu-satu.
    // Sekarang: enrollment & periode aktif di-batch pakai 'in' (per 10
    // mahasiswaId sekaligus), dan SEMUA dokumen mataKuliah yang dibutuhkan
    // dikumpulkan ID-nya dulu lalu diambil SEKALIGUS lewat db.getAll().
    function chunkArray(arr, size) {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    }

    const mahasiswaIdList = mahasiswaList.map(m => m.id);
    const enrollmentByMhs = new Map(); // mahasiswaId -> [enrollment docs]
    const periodAktifSet = new Set(); // mahasiswaId yang punya periode aktif

    for (const chunk of chunkArray(mahasiswaIdList, 10)) {
      if (chunk.length === 0) continue;
      const [enrollSnap, periodSnap] = await Promise.all([
        db.collection('enrollment').where('userId', 'in', chunk).where('status', '==', 'active').get(),
        db.collection('magangPeriod').where('mahasiswaId', 'in', chunk).where('status', '==', 'active').get()
      ]);
      enrollSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!enrollmentByMhs.has(data.userId)) enrollmentByMhs.set(data.userId, []);
        enrollmentByMhs.get(data.userId).push(data);
      });
      periodSnap.docs.forEach(doc => periodAktifSet.add(doc.data().mahasiswaId));
    }

    // Kumpulkan semua mkId unik dari SELURUH mahasiswa, lalu ambil sekaligus
    const mkIdSet = new Set();
    enrollmentByMhs.forEach(list => list.forEach(e => mkIdSet.add(e.mkId)));
    const mkIdArr = Array.from(mkIdSet);
    const mkDocsMap = new Map();
    if (mkIdArr.length > 0) {
      const mkRefs = mkIdArr.map(id => db.collection('mataKuliah').doc(id));
      const mkDocs = await db.getAll(...mkRefs);
      mkDocs.forEach((doc, i) => { if (doc.exists) mkDocsMap.set(mkIdArr[i], doc.data()); });
    }

    const statsResults = await Promise.all(mahasiswaList.map(mhs => getLogbookStatistik(mhs.id)));

    for (let i = 0; i < mahasiswaList.length; i++) {
      const mhs = mahasiswaList[i];
      const stats = statsResults[i];

      const enrolledPdks = [];
      (enrollmentByMhs.get(mhs.id) || []).forEach(enrollment => {
        const mkData = mkDocsMap.get(enrollment.mkId);
        if (mkData && mkData.isPDK === true) {
          enrolledPdks.push({
            id: enrollment.mkId,
            kode: mkData.kode,
            nama: mkData.nama,
            urutan: mkData.urutanPDK
          });
        }
      });
      mhs.enrolledPdks = enrolledPdks;
      mhs.hasActivePeriod = periodAktifSet.has(mhs.id);
      mhs.totalLogbook = stats.totalLogbook;
      mhs.pendingCount = stats.pendingCount;
      mhs.approvedCount = stats.approvedCount;
      mhs.rejectedCount = stats.rejectedCount;
    }
    
    mahasiswaList.sort((a, b) => a.nama.localeCompare(b.nama));
    res.render('dosen/magang_list', {
      title: 'Monitoring Magang',
      mahasiswaList,
      message: null
    });
  } catch (error) {
    console.error('Error ambil daftar mahasiswa bimbingan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data mahasiswa bimbingan' });
  }
});

// ============================================================================
// ROUTE DETAIL LOGBOOK MAHASISWA
// ============================================================================
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId, semester } = req.query;
    
    const { isBimbingan, role } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki akses ke logbook mahasiswa ini.'
      });
    }
    
    const mahasiswa = await getMahasiswa(userId);
    if (mahasiswa.nama === 'Unknown') {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mahasiswa tidak ditemukan.' });
    }
    
    const allPeriods = await getActiveMagangPeriods(userId);
    let selectedPeriod = null;
    if (periodId) selectedPeriod = allPeriods.find(p => p.id === periodId);
    else if (allPeriods.length > 0) selectedPeriod = allPeriods[0];
    
    // Query logbook utama (pakai orderBy)
    let logbookQuery = db.collection('logbookMagang')
      .where('userId', '==', userId)
      .orderBy('tanggal', 'desc');
    if (selectedPeriod) logbookQuery = logbookQuery.where('pdkId', '==', selectedPeriod.pdkId);
    if (semester) logbookQuery = logbookQuery.where('semester', '==', semester);
    
    // Ambil juga semua logbook untuk semester list
    const allLogbookQuery = db.collection('logbookMagang').where('userId', '==', userId);
    
    const [logbookSnapshot, allLogbookSnapshot] = await Promise.all([
      logbookQuery.get(),
      allLogbookQuery.get()
    ]);
    
    const logbookList = logbookSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        tanggalFormatted: formatDate(data.tanggal),
        tanggalWaktuFormatted: formatDateTime(data.tanggal),
        canApprove: role === 'pembimbing2' && data.status === 'pending'
      };
    });
    
    // Semester list
    const semesterSet = new Set();
    allLogbookSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.semester) semesterSet.add(data.semester);
    });
    const semesterList = Array.from(semesterSet).sort();
    
    // Statistik per PDK
    const pdkStats = [];
    for (const period of allPeriods) {
      const stats = await getLogbookStatistik(userId, period.pdkId);
      pdkStats.push({ ...period, ...stats });
    }
    
    // Nilai Magang (3 komponen: laporan/logbook/lapangan) - hanya relevan
    // kalau ada periode magang yang dipilih.
    const nilaiMagang = selectedPeriod ? await getNilaiMagang(userId, selectedPeriod.pdkId) : null;

    res.render('dosen/magang_detail', {
      title: `Logbook - ${mahasiswa.nama}`,
      mahasiswa,
      logbookList,
      semesterList,
      selectedSemester: semester || '',
      allPeriods,
      selectedPeriod,
      pdkStats,
      role,
      canApprove: role === 'pembimbing2',
      isPembimbing1: role === 'pembimbing1',
      isPembimbing2: role === 'pembimbing2',
      pembimbing1Nama: mahasiswa.pembimbing1Nama,
      pembimbing2Nama: mahasiswa.pembimbing2Nama,
      nilaiMagang,
      user: req.user
    });
  } catch (error) {
    console.error('Error ambil logbook mahasiswa:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat logbook mahasiswa' });
  }
});

// ============================================================================
// KUNCI LOGBOOK (Pembimbing 2) - kunci KESELURUHAN logbook periode magang
// ini, menandai "sudah selesai ditinjau". Setelah dikunci, baru bisa isi
// Nilai Logbook. Beda dari "Setujui 1 Minggu" yang cuma menyetujui entri
// harian - ini kunci final utk satu periode magang penuh.
// ============================================================================
router.post('/:userId/kunci-logbook', async (req, res) => {
  try {
    const { userId } = req.params;
    const { pdkId } = req.body;
    if (!pdkId) return res.status(400).send('Periode magang (PDK) tidak diketahui');

    const { role } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (role !== 'pembimbing2') {
      return res.status(403).send('Hanya Pembimbing 2 yang dapat mengunci logbook');
    }

    await kunciLogbookMagang(userId, pdkId, req.dosen.id);
    req.session.success = 'Logbook berhasil dikunci. Nilai Logbook sekarang bisa diisi.';
    res.redirect(`/dosen/magang/${userId}?periodId=${req.body.periodId || ''}`);
  } catch (error) {
    console.error('Error kunci logbook magang:', error);
    req.session.error = 'Gagal mengunci logbook: ' + error.message;
    res.redirect('back');
  }
});

// Buka kunci lagi (kalau Pembimbing 2 perlu koreksi setelah terlanjur kunci)
router.post('/:userId/buka-kunci-logbook', async (req, res) => {
  try {
    const { userId } = req.params;
    const { pdkId } = req.body;
    if (!pdkId) return res.status(400).send('Periode magang (PDK) tidak diketahui');

    const { role } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (role !== 'pembimbing2') {
      return res.status(403).send('Hanya Pembimbing 2 yang dapat membuka kunci logbook');
    }

    await bukaKunciLogbookMagang(userId, pdkId);
    req.session.success = 'Kunci logbook dibuka kembali.';
    res.redirect(`/dosen/magang/${userId}?periodId=${req.body.periodId || ''}`);
  } catch (error) {
    console.error('Error buka kunci logbook magang:', error);
    req.session.error = 'Gagal membuka kunci logbook: ' + error.message;
    res.redirect('back');
  }
});

// ============================================================================
// SIMPAN NILAI LOGBOOK (Pembimbing 2) - hanya boleh kalau sudah dikunci
// ============================================================================
router.post('/:userId/nilai-logbook', async (req, res) => {
  try {
    const { userId } = req.params;
    const { pdkId, nilai } = req.body;
    if (!pdkId) return res.status(400).send('Periode magang (PDK) tidak diketahui');

    const { role } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (role !== 'pembimbing2') {
      return res.status(403).send('Hanya Pembimbing 2 yang dapat mengisi Nilai Logbook');
    }

    const nilaiMagang = await getNilaiMagang(userId, pdkId);
    if (!nilaiMagang.logbookDikunci) {
      return res.status(400).send('Kunci logbook dulu sebelum mengisi nilainya');
    }

    const nilaiAngka = parseFloat(nilai);
    if (isNaN(nilaiAngka) || nilaiAngka < 0 || nilaiAngka > 100) {
      return res.status(400).send('Nilai harus angka 0-100');
    }

    await saveNilaiLogbook(userId, pdkId, nilaiAngka, req.dosen.id);
    req.session.success = 'Nilai Logbook berhasil disimpan.';
    res.redirect(`/dosen/magang/${userId}?periodId=${req.body.periodId || ''}`);
  } catch (error) {
    console.error('Error simpan nilai logbook:', error);
    req.session.error = 'Gagal menyimpan nilai logbook: ' + error.message;
    res.redirect('back');
  }
});

// ============================================================================
// ROUTE DETAIL SATU LOGBOOK
// ============================================================================
router.get('/logbook/:id', async (req, res) => {
  try {
    const logbookId = req.params.id;
    const logbookDoc = await db.collection('logbookMagang').doc(logbookId).get();
    if (!logbookDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Logbook tidak ditemukan' });
    }
    const logbook = logbookDoc.data();
    const mahasiswa = await getMahasiswa(logbook.userId);
    const { isBimbingan, role } = await isMahasiswaBimbingan(req.dosen.id, logbook.userId);
    if (!isBimbingan) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke logbook ini.' });
    }
    res.render('dosen/magang_logbook_detail', {
      title: 'Detail Logbook',
      logbook,
      mahasiswa,
      tanggalFormatted: formatDate(logbook.tanggal),
      tanggalWaktuFormatted: formatDateTime(logbook.tanggal),
      role,
      canApprove: role === 'pembimbing2' && logbook.status === 'pending',
      user: req.user
    });
  } catch (error) {
    console.error('Error detail logbook:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail logbook' });
  }
});

// ============================================================================
// APPROVE LOGBOOK
// ============================================================================
router.post('/logbook/:id/approve', async (req, res) => {
  try {
    const logbookId = req.params.id;
    const logbookDoc = await db.collection('logbookMagang').doc(logbookId).get();
    if (!logbookDoc.exists) {
      req.session.error = 'Logbook tidak ditemukan';
      return res.redirect('back');
    }
    const logbook = logbookDoc.data();
    const mahasiswaId = logbook.userId;
    const pdkId = logbook.pdkId;
    
    const canApproveFlag = await canApprove(req.dosen.id, mahasiswaId);
    if (!canApproveFlag) {
      req.session.error = 'Hanya Pembimbing 2 yang dapat menyetujui logbook';
      return res.redirect('back');
    }
    const isActive = await isMagangPeriodActive(mahasiswaId, pdkId);
    if (!isActive) {
      req.session.error = 'Periode magang sudah berakhir, tidak dapat menyetujui logbook';
      return res.redirect('back');
    }
    await logbookDoc.ref.update({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: req.dosen.id,
      approvedByNama: req.dosen.nama,
      approvedByRole: 'Pembimbing 2'
    });
    invalidateProgressMagangHarian(mahasiswaId, pdkId);
    req.session.success = 'Logbook berhasil disetujui';
    res.redirect(`/dosen/magang/${mahasiswaId}`);
  } catch (error) {
    console.error('Error approve logbook:', error);
    req.session.error = 'Gagal menyetujui logbook';
    res.redirect('back');
  }
});

// ============================================================================
// REJECT LOGBOOK
// ============================================================================
router.post('/logbook/:id/reject', async (req, res) => {
  try {
    const logbookId = req.params.id;
    const { alasan } = req.body;
    const logbookDoc = await db.collection('logbookMagang').doc(logbookId).get();
    if (!logbookDoc.exists) {
      req.session.error = 'Logbook tidak ditemukan';
      return res.redirect('back');
    }
    const logbook = logbookDoc.data();
    const mahasiswaId = logbook.userId;
    const pdkId = logbook.pdkId;
    
    const canApproveFlag = await canApprove(req.dosen.id, mahasiswaId);
    if (!canApproveFlag) {
      req.session.error = 'Hanya Pembimbing 2 yang dapat menolak logbook';
      return res.redirect('back');
    }
    const isActive = await isMagangPeriodActive(mahasiswaId, pdkId);
    if (!isActive) {
      req.session.error = 'Periode magang sudah berakhir, tidak dapat menolak logbook';
      return res.redirect('back');
    }
    await logbookDoc.ref.update({
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.dosen.id,
      rejectedByNama: req.dosen.nama,
      rejectedByRole: 'Pembimbing 2',
      rejectionReason: alasan || 'Tidak ada alasan'
    });
    invalidateProgressMagangHarian(mahasiswaId, pdkId);
    req.session.success = 'Logbook berhasil ditolak';
    res.redirect(`/dosen/magang/${mahasiswaId}`);
  } catch (error) {
    console.error('Error reject logbook:', error);
    req.session.error = 'Gagal menolak logbook';
    res.redirect('back');
  }
});

// ============================================================================
// SETUJUI LOGBOOK 1 MINGGU SEKALIGUS (Pembimbing 2)
// ============================================================================
// Menyetujui semua logbook berstatus 'pending' milik mahasiswa ini dalam
// 7 hari terakhir sekaligus (bukan satu per satu), supaya dosen pembimbing 2
// tidak perlu klik "Setujui" berulang kali untuk tiap entri logbook harian.
// Kalau ada periode magang dipilih (periodId), hanya logbook periode itu yang
// ikut disetujui.
router.post('/:userId/setujui-minggu', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId } = req.body;

    const canApproveFlag = await canApprove(req.dosen.id, userId);
    if (!canApproveFlag) {
      req.session.error = 'Hanya Pembimbing 2 yang dapat menyetujui logbook';
      return res.redirect(`/dosen/magang/${userId}`);
    }

    let pdkId = null;
    if (periodId) {
      const periods = await getActiveMagangPeriods(userId);
      const period = periods.find(p => p.id === periodId);
      if (!period) {
        req.session.error = 'Periode magang tidak ditemukan';
        return res.redirect(`/dosen/magang/${userId}`);
      }
      pdkId = period.pdkId;
      const isActive = await isMagangPeriodActive(userId, pdkId);
      if (!isActive) {
        req.session.error = 'Periode magang sudah berakhir, tidak dapat menyetujui logbook';
        return res.redirect(`/dosen/magang/${userId}?periodId=${periodId}`);
      }
    }

    // Rentang 7 hari terakhir (hari ini mundur 6 hari), format YYYY-MM-DD
    // supaya bisa dibandingkan langsung dengan field `tanggal` (string ISO).
    const hariIni = new Date();
    const tujuhHariLalu = new Date(hariIni);
    tujuhHariLalu.setDate(hariIni.getDate() - 6);
    const tanggalAkhir = hariIni.toISOString().split('T')[0];
    const tanggalAwal = tujuhHariLalu.toISOString().split('T')[0];

    let query = db.collection('logbookMagang')
      .where('userId', '==', userId)
      .where('status', '==', 'pending');
    if (pdkId) query = query.where('pdkId', '==', pdkId);
    const pendingSnapshot = await query.get();

    // Saring ke rentang 7 hari terakhir di JS (field tanggal disimpan string,
    // aman dibandingkan leksikografis krn format ISO YYYY-MM-DD).
    const docsMingguIni = pendingSnapshot.docs.filter(doc => {
      const tgl = doc.data().tanggal;
      return tgl && tgl >= tanggalAwal && tgl <= tanggalAkhir;
    });

    if (docsMingguIni.length === 0) {
      req.session.error = 'Tidak ada logbook pending dalam 7 hari terakhir untuk disetujui';
      return res.redirect(`/dosen/magang/${userId}${periodId ? `?periodId=${periodId}` : ''}`);
    }

    // Kalau tidak difilter per-periode, logbook 7 hari terakhir bisa saja
    // berasal dari lebih dari satu periode magang - pastikan SEMUA periode
    // yang terlibat masih aktif sebelum menyetujui.
    if (!pdkId) {
      const pdkIdTerlibat = [...new Set(docsMingguIni.map(doc => doc.data().pdkId).filter(Boolean))];
      for (const pid of pdkIdTerlibat) {
        const isActive = await isMagangPeriodActive(userId, pid);
        if (!isActive) {
          req.session.error = 'Ada periode magang yang sudah berakhir dalam rentang minggu ini - pilih periode secara spesifik untuk menyetujui yang masih aktif saja';
          return res.redirect(`/dosen/magang/${userId}`);
        }
      }
    }

    const now = new Date().toISOString();
    const catatan = 'Mahasiswa telah konsultasi dan logbook disetujui';
    const batch = db.batch();
    docsMingguIni.forEach(doc => {
      batch.update(doc.ref, {
        status: 'approved',
        approvedAt: now,
        approvedBy: req.dosen.id,
        approvedByNama: req.dosen.nama,
        approvedByRole: 'Pembimbing 2',
        catatan
      });
    });
    await batch.commit();

    // Invalidasi cache progress harian untuk semua PDK yang ikut disetujui
    // di batch ini, supaya progress mahasiswa langsung akurat.
    const pdkIdUntukInvalidasi = pdkId
      ? [pdkId]
      : [...new Set(docsMingguIni.map(doc => doc.data().pdkId).filter(Boolean))];
    pdkIdUntukInvalidasi.forEach(pid => invalidateProgressMagangHarian(userId, pid));

    req.session.success = `${docsMingguIni.length} logbook (7 hari terakhir) berhasil disetujui sekaligus`;
    res.redirect(`/dosen/magang/${userId}${periodId ? `?periodId=${periodId}` : ''}`);
  } catch (error) {
    console.error('Error setujui logbook per minggu:', error);
    req.session.error = 'Gagal menyetujui logbook per minggu';
    res.redirect('back');
  }
});

// ============================================================================
// CETAK LOGBOOK
// ============================================================================
router.get('/print/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId, semester } = req.query;
    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) {
      return res.status(403).send('Anda tidak memiliki akses ke logbook mahasiswa ini.');
    }
    const mahasiswa = await getMahasiswa(userId);
    let query = db.collection('logbookMagang').where('userId', '==', userId).orderBy('tanggal', 'asc');
    if (periodId) {
      const periodDoc = await db.collection('magangPeriod').doc(periodId).get();
      if (periodDoc.exists) {
        const period = periodDoc.data();
        query = query.where('pdkId', '==', period.pdkId);
      }
    }
    if (semester) query = query.where('semester', '==', semester);
    const snapshot = await query.get();
    const logbookList = snapshot.docs.map(doc => ({ ...doc.data(), tanggalFormatted: formatDate(doc.data().tanggal) }));
    const totalDurasi = logbookList.reduce((sum, item) => sum + (parseFloat(item.durasi) || 0), 0);
    const filterInfo = [];
    if (periodId) filterInfo.push(`Periode: ${periodId}`);
    if (semester) filterInfo.push(`Semester: ${semester}`);
    const filterText = filterInfo.length > 0 ? filterInfo.join(' | ') : 'Semua Data';
    let pdkInfo = null;
    if (periodId) {
      const periodDoc = await db.collection('magangPeriod').doc(periodId).get();
      if (periodDoc.exists) pdkInfo = periodDoc.data();
    }
    res.render('dosen/magang_print', {
      title: `Cetak Logbook - ${mahasiswa.nama}`,
      mahasiswa,
      logbookList,
      totalDurasi,
      totalEntries: logbookList.length,
      filterInfo: filterText,
      pdkInfo,
      selectedSemester: semester || '',
      generatedAt: formatDateTime(new Date().toISOString()),
      user: req.user
    });
  } catch (error) {
    console.error('Error print logbook dosen:', error);
    res.status(500).send('Gagal mencetak logbook');
  }
});

// ============================================================================
// API ENDPOINTS
// ============================================================================
router.get('/api/bimbingan', async (req, res) => {
  try {
    const mahasiswaList = await getMahasiswaBimbingan(req.dosen.id);
    res.json({ success: true, data: mahasiswaList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/logbook/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId } = req.query;
    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) return res.status(403).json({ success: false, error: 'Akses ditolak' });
    let query = db.collection('logbookMagang').where('userId', '==', userId).orderBy('tanggal', 'desc');
    if (periodId) query = query.where('pdkId', '==', periodId);
    const snapshot = await query.get();
    const logbookList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), tanggalFormatted: formatDate(doc.data().tanggal) }));
    res.json({ success: true, data: logbookList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/periods/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) return res.status(403).json({ success: false, error: 'Akses ditolak' });
    const periods = await getActiveMagangPeriods(userId);
    res.json({ success: true, data: periods });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;