/**
 * routes/dosen/magang.js
 * Monitoring magang untuk dosen PEMBIMBING (= Dosen PA mahasiswa).
 *
 * REVISI: Pembimbing 1 & 2 ditiadakan. Hanya ada SATU pembimbing, yaitu Dosen
 * PA (users.dosenPaId). Dosen PA menyetujui/menolak/mengunci logbook, meninjau
 * laporan, dan mengisi FORM PENILAIAN DOSEN PEMBIMBING (18 indikator - format
 * baru, menggantikan Nilai Laporan + Nilai Logbook yang dulu terpisah).
 * 
 * OPTIMASI: Gunakan Promise.all untuk paralelisasi query, tanpa mengubah logika bisnis.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db, admin } = require('../../config/firebaseAdmin');
const { invalidateProgressMagangHarian } = require('../../helpers/magangHelper');
const { paginate } = require('../../helpers/pagination');
const { getSemesterListLogbook } = require('../../helpers/cache');
const LOGBOOK_PAGE_SIZE = 10;
const {
  ITEM_NILAI_DOSEN,
  daftarKategori,
  hitungRincian,
  getNilaiMagang,
  getNilaiDosenEfektif,
  kunciLogbookMagang,
  bukaKunciLogbookMagang,
  savePenilaianDosen
} = require('../../helpers/nilaiMagangHelper');
const { buildFormPenilaianData } = require('../../helpers/formPenilaianMagangHelper');
const { buildKartuKontrolData } = require('../../helpers/kartuKontrolMagangHelper');
const { buildLogbookPrintData } = require('../../helpers/logbookPrintHelper');
const {
  ROLE_PEMBIMBING,
  isPembimbingMahasiswa,
  getMahasiswaBimbinganPa
} = require('../../helpers/pembimbingHelper');

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
    // Mahasiswa bimbingan = mahasiswa aktif yang Dosen PA-nya dosen ini.
    const daftarMahasiswa = await getMahasiswaBimbinganPa(dosenId);
    if (daftarMahasiswa.length === 0) return [];

    // Cache per-request supaya route detail tidak baca ulang dokumen yang sama
    daftarMahasiswa.forEach(m => mahasiswaCache.set(m.id, m));
    const mahasiswaIds = daftarMahasiswa.map(m => m.id);

    // Periode magang aktif untuk semua mahasiswa secara paralel
    const periodSnapshots = await Promise.all(
      mahasiswaIds.map(id => db.collection('magangPeriod').where('mahasiswaId', '==', id).where('status', '==', 'active').get())
    );

    return daftarMahasiswa.map((mahasiswa, i) => ({
      ...mahasiswa,
      role: ROLE_PEMBIMBING,
      pembimbingId: dosenId,
      pembimbingNama: mahasiswa.dosenPaNama || '-',
      activePeriods: periodSnapshots[i].docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }));
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

// Pembimbing = Dosen PA mahasiswa (lihat helpers/pembimbingHelper.js)
const isMahasiswaBimbingan = isPembimbingMahasiswa;

async function canApprove(dosenId, mahasiswaId) {
  const { isBimbingan } = await isPembimbingMahasiswa(dosenId, mahasiswaId);
  return isBimbingan;
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
        message: 'Anda belum memiliki mahasiswa bimbingan. Mahasiswa bimbingan magang adalah mahasiswa yang Dosen PA-nya Anda - silakan hubungi admin untuk penetapan Dosen PA.'
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
    // Dosen PA = satu-satunya pembimbing: boleh logbook DAN laporan sekaligus
    const isPembimbing = true;
    
    const mahasiswa = await getMahasiswa(userId);
    if (mahasiswa.nama === 'Unknown') {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mahasiswa tidak ditemukan.' });
    }
    
    const allPeriods = await getActiveMagangPeriods(userId);
    let selectedPeriod = null;
    if (periodId) selectedPeriod = allPeriods.find(p => p.id === periodId);
    else if (allPeriods.length > 0) selectedPeriod = allPeriods[0];
    
    // Query logbook utama (pakai orderBy) + tie-breaker documentId supaya
    // urutan stabil antar-request (dipakai untuk cursor paginasi).
    let logbookBaseQuery = db.collection('logbookMagang')
      .where('userId', '==', userId)
      .orderBy('tanggal', 'desc')
      .orderBy(admin.firestore.FieldPath.documentId(), 'desc');
    if (selectedPeriod) logbookBaseQuery = logbookBaseQuery.where('pdkId', '==', selectedPeriod.pdkId);
    if (semester) logbookBaseQuery = logbookBaseQuery.where('semester', '==', semester);

    // Semester list - dulu ini didapat dari baca SEMUA dokumen logbook
    // mahasiswa (allLogbookQuery.get() di bawah, sudah dihapus). Sekarang
    // pakai cache 2 menit (helpers/cache.js) supaya kunjungan berulang ke
    // halaman yang sama (mis. saat dosen bolak-balik menilai logbook)
    // tidak baca ulang seluruh koleksi tiap kali.
    // (allLogbookQuery dihapus - lihat getSemesterListLogbook di import)

    // Laporan magang - ditinjau oleh pembimbing (Dosen PA) yang sama
    const laporanQuery = db.collection('laporanMagang').where('userId', '==', userId).orderBy('laporanKe', 'asc').get();

    // ✅ OPTIMISASI KUOTA: paginasi berbasis cursor (startAfter), BUKAN
    // ambil semua logbook mahasiswa sekaligus. Default 10 entri/halaman,
    // dosen bisa klik "Tampilkan Semua" (?all=1) kalau memang perlu
    // (misal sebelum menilai/mengunci logbook).
    const showAll = req.query.all === '1';
    let logbookDocs = [];
    let pageInfo = null;
    let totalLogbookFiltered = 0;

    const [countSnap, semesterList, laporanSnapshot] = await Promise.all([
      logbookBaseQuery.count().get().catch(() => null),
      getSemesterListLogbook(db, userId),
      laporanQuery
    ]);
    totalLogbookFiltered = countSnap ? countSnap.data().count : null;

    if (showAll) {
      const snap = await logbookBaseQuery.get();
      logbookDocs = snap.docs;
      if (totalLogbookFiltered === null) totalLogbookFiltered = snap.size;
    } else {
      const result = await paginate(logbookBaseQuery, {
        pageSize: LOGBOOK_PAGE_SIZE,
        afterParam: req.query.after || '',
        trailParam: req.query.trail || '',
        cursorFromDoc: (doc) => [doc.get('tanggal'), doc.id]
      });
      logbookDocs = result.docs;

      const buildUrl = (params) => {
        const usp = new URLSearchParams({
          ...(selectedPeriod ? { periodId: selectedPeriod.id } : {}),
          ...(semester ? { semester } : {}),
          ...params
        });
        return `/dosen/magang/${userId}?${usp.toString()}`;
      };
      pageInfo = {
        hasPrev: result.hasPrev,
        hasNext: result.hasNext,
        prevUrl: result.hasPrev ? buildUrl(result.prevAfter ? { after: result.prevAfter, trail: result.prevTrail } : { trail: result.prevTrail }) : null,
        nextUrl: result.hasNext ? buildUrl({ after: result.nextAfter, trail: result.nextTrail }) : null,
        allUrl: buildUrl({ all: '1' }),
        count: logbookDocs.length,
        total: totalLogbookFiltered
      };
    }

    const logbookList = logbookDocs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        tanggalFormatted: formatDate(data.tanggal),
        tanggalWaktuFormatted: formatDateTime(data.tanggal),
        canApprove: isPembimbing && data.status === 'pending'
      };
    });

    const laporanList = laporanSnapshot ? laporanSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) : [];
    const adaLaporanYangAcc = laporanList.some(l => l.status === 'approved');
    // semesterList sudah didapat dari getSemesterListLogbook() di atas (cached)
    
    // Statistik per PDK
    const pdkStats = [];
    for (const period of allPeriods) {
      const stats = await getLogbookStatistik(userId, period.pdkId);
      pdkStats.push({ ...period, ...stats });
    }
    
    // Nilai Magang (2 komponen: Dosen Pembimbing + Pendamping Lapangan) - hanya
    // relevan kalau ada periode magang yang dipilih.
    const nilaiMagang = selectedPeriod ? await getNilaiMagang(userId, selectedPeriod.pdkId) : null;

    res.render('dosen/magang_detail', {
      title: `ELK Magang - ${mahasiswa.nama}`,
      mahasiswa,
      logbookList,
      semesterList,
      selectedSemester: semester || '',
      allPeriods,
      selectedPeriod,
      pdkStats,
      role,
      canApprove: isPembimbing,
      isPembimbing,
      pembimbingNama: req.dosen.nama,
      nilaiMagang,
      nilaiDosenEfektif: getNilaiDosenEfektif(nilaiMagang),
      rincianDosen: nilaiMagang ? hitungRincian(nilaiMagang.nilaiDosenItems, ITEM_NILAI_DOSEN) : null,
      ITEM_NILAI_DOSEN,
      KATEGORI_NILAI_DOSEN: daftarKategori(ITEM_NILAI_DOSEN),
      laporanList,
      adaLaporanYangAcc,
      user: req.user,
      pageInfo,
      showAll,
      pageListUrl: `/dosen/magang/${userId}${selectedPeriod ? `?periodId=${selectedPeriod.id}` : ''}${semester ? `${selectedPeriod ? '&' : '?'}semester=${encodeURIComponent(semester)}` : ''}`
    });
  } catch (error) {
    console.error('Error ambil logbook mahasiswa:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat logbook mahasiswa' });
  }
});

// ============================================================================
// KUNCI LOGBOOK (Pembimbing/Dosen PA) - kunci KESELURUHAN logbook periode magang
// ini, menandai "sudah selesai ditinjau". Setelah dikunci (dan laporan di-ACC),
// baru bisa isi Form Penilaian Dosen Pembimbing. Beda dari "Setujui 1 Minggu" yang cuma menyetujui entri
// harian - ini kunci final utk satu periode magang penuh.
// ============================================================================
router.post('/:userId/kunci-logbook', async (req, res) => {
  try {
    const { userId } = req.params;
    const { pdkId } = req.body;
    if (!pdkId) return res.status(400).send('Periode magang (PDK) tidak diketahui');

    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) {
      return res.status(403).send('Hanya Dosen Pembimbing (Dosen PA) mahasiswa ini yang dapat mengunci logbook');
    }

    await kunciLogbookMagang(userId, pdkId, req.dosen.id);
    req.session.success = 'Logbook berhasil dikunci. Form Penilaian Dosen Pembimbing bisa diisi setelah laporan di-ACC.';
    res.redirect(`/dosen/magang/${userId}?periodId=${req.body.periodId || ''}`);
  } catch (error) {
    console.error('Error kunci logbook magang:', error);
    req.session.error = 'Gagal mengunci logbook: ' + error.message;
    res.redirect('back');
  }
});

// Buka kunci lagi (kalau Pembimbing perlu koreksi setelah terlanjur kunci)
router.post('/:userId/buka-kunci-logbook', async (req, res) => {
  try {
    const { userId } = req.params;
    const { pdkId } = req.body;
    if (!pdkId) return res.status(400).send('Periode magang (PDK) tidak diketahui');

    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) {
      return res.status(403).send('Hanya Dosen Pembimbing (Dosen PA) mahasiswa ini yang dapat membuka kunci logbook');
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
// SIMPAN PENILAIAN DOSEN PEMBIMBING (Dosen PA) - 18 indikator (format baru).
// Prasyarat: minimal satu laporan di-ACC DAN logbook sudah dikunci.
// ============================================================================
router.post('/:userId/nilai-dosen', async (req, res) => {
  const { userId } = req.params;
  const kembali = `/dosen/magang/${userId}?periodId=${encodeURIComponent(req.body.periodId || '')}`;
  try {
    const { pdkId } = req.body;
    if (!pdkId) return res.status(400).send('Periode magang (PDK) tidak diketahui');

    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) {
      return res.status(403).send('Hanya Dosen Pembimbing (Dosen PA) mahasiswa ini yang dapat mengisi penilaian');
    }

    const nilaiMagang = await getNilaiMagang(userId, pdkId);
    if (!nilaiMagang.logbookDikunci) {
      req.session.error = 'Kunci logbook dulu sebelum mengisi penilaian.';
      return res.redirect(kembali);
    }
    const laporanAcc = await db.collection('laporanMagang')
      .where('userId', '==', userId).get();
    if (!laporanAcc.docs.some(d => d.data().status === 'approved')) {
      req.session.error = 'Laporan mahasiswa ini belum di-ACC - ACC dulu sebelum memberi penilaian.';
      return res.redirect(kembali);
    }

    // Kumpulkan skor 18 indikator (lihat ITEM_NILAI_DOSEN) dari body form.
    const itemScores = {};
    for (const it of ITEM_NILAI_DOSEN) {
      const v = req.body.item ? req.body.item[it.key] : undefined;
      const angka = parseFloat(v);
      if (v === undefined || v === '' || isNaN(angka) || angka < 0 || angka > 100) {
        req.session.error = `Isi semua ${ITEM_NILAI_DOSEN.length} indikator dengan angka 0-100 (indikator "${it.label}" belum valid).`;
        return res.redirect(kembali);
      }
      itemScores[it.key] = angka;
    }

    await savePenilaianDosen(userId, pdkId, itemScores, req.dosen.id, req.body.catatan);

    req.session.success = 'Penilaian Dosen Pembimbing berhasil disimpan.';
    res.redirect(kembali);
  } catch (error) {
    console.error('Error simpan penilaian dosen pembimbing:', error);
    req.session.error = 'Gagal menyimpan penilaian: ' + error.message;
    res.redirect(kembali);
  }
});

// Rute lama (form terpisah Nilai Logbook) - diarahkan ke form baru
router.post('/:userId/nilai-logbook', (req, res) => {
  req.session.error = 'Form Nilai Logbook sudah digantikan Form Penilaian Dosen Pembimbing (format baru).';
  res.redirect(`/dosen/magang/${req.params.userId}?periodId=${encodeURIComponent(req.body.periodId || '')}`);
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
      canApprove: isBimbingan && logbook.status === 'pending',
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
      req.session.error = 'Hanya Dosen Pembimbing (Dosen PA) mahasiswa ini yang dapat menyetujui logbook';
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
      approvedByRole: 'Dosen Pembimbing (PA)'
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
      req.session.error = 'Hanya Dosen Pembimbing (Dosen PA) mahasiswa ini yang dapat menolak logbook';
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
      rejectedByRole: 'Dosen Pembimbing (PA)',
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
// SETUJUI LOGBOOK 1 MINGGU SEKALIGUS (Pembimbing/Dosen PA)
// ============================================================================
// Menyetujui semua logbook berstatus 'pending' milik mahasiswa ini dalam
// 7 hari terakhir sekaligus (bukan satu per satu), supaya dosen pembimbing
// tidak perlu klik "Setujui" berulang kali untuk tiap entri logbook harian.
// Kalau ada periode magang dipilih (periodId), hanya logbook periode itu yang
// ikut disetujui.
router.post('/:userId/setujui-minggu', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId } = req.body;

    const canApproveFlag = await canApprove(req.dosen.id, userId);
    if (!canApproveFlag) {
      req.session.error = 'Hanya Dosen Pembimbing (Dosen PA) mahasiswa ini yang dapat menyetujui logbook';
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
        approvedByRole: 'Dosen Pembimbing (PA)',
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
// Cetak memakai template & data yang SAMA dengan cetak mahasiswa
// (helpers/logbookPrintHelper.js -> views/mahasiswa/magang/print.ejs).
// Dosen hanya boleh mencetak logbook mahasiswa yang Dosen PA-nya dia.
router.get('/print/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId } = req.query;
    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) {
      return res.status(403).send('Anda tidak memiliki akses ke logbook mahasiswa ini.');
    }
    const data = await buildLogbookPrintData(userId, periodId);
    if (!data) return res.status(404).send('Data mahasiswa tidak ditemukan');
    res.render('mahasiswa/magang/print', { ...data, title: `Cetak Logbook - ${data.mahasiswa.nama}`, user: req.user });
  } catch (error) {
    console.error('Error print logbook dosen:', error);
    res.status(500).send('Gagal mencetak logbook');
  }
});

// ============================================================================
// CETAK FORMAT RESMI (PDF baru): Form Penilaian Dosen Pembimbing, Kartu Kontrol
// Bimbingan, dan Lembar Isian Hasil Konsultasi. Hanya Dosen PA mahasiswa.
// ============================================================================
router.get('/print-penilaian/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) return res.status(403).send('Anda tidak memiliki akses ke mahasiswa ini.');
    const data = await buildFormPenilaianData(userId, req.query.periodId, 'dosen');
    if (!data) return res.status(404).send('Data mahasiswa tidak ditemukan');
    res.render('magang/form_penilaian_print', data);
  } catch (error) {
    console.error('Error cetak form penilaian dosen:', error);
    res.status(500).send('Gagal mencetak form penilaian');
  }
});

router.get('/print-kartu-kontrol/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBimbingan } = await isMahasiswaBimbingan(req.dosen.id, userId);
    if (!isBimbingan) return res.status(403).send('Anda tidak memiliki akses ke mahasiswa ini.');
    const lembarBase = `/dosen/magang/print-kartu-kontrol/${userId}?periodId=${encodeURIComponent(req.query.periodId || '')}&kid=`;
    const data = await buildKartuKontrolData(userId, req.query.periodId, req.query.kid || null, lembarBase);
    if (!data) return res.status(404).send('Data mahasiswa tidak ditemukan');
    res.render(req.query.kid ? 'magang/lembar_konsultasi_print' : 'magang/kartu_kontrol_print', data);
  } catch (error) {
    console.error('Error cetak kartu kontrol magang:', error);
    res.status(500).send('Gagal mencetak kartu kontrol');
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