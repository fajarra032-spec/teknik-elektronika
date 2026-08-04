/**
 * routes/mahasiswa/magang.js
 * Modul ELK‑Magang: logbook, permohonan seminar, upload laporan akhir (3 laporan)
 * Terintegrasi dengan folder Data WEB (ID: 17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0)
 * Dilengkapi kompresi gambar (sharp) dan penyimpanan fileId.
 *
 * REVISI:
 * - Pembimbing ditetapkan oleh admin (2 pembimbing: Pembimbing 1 dan Pembimbing 2)
 * - Mahasiswa tidak bisa memilih pembimbing sendiri
 * - Logbook & laporan menyimpan kedua pembimbing
 * - FITUR: PDK 1,2,3 dengan periode magang fleksibel
 * - FITUR: Arsip logbook untuk PDK yang sudah selesai
 * - FITUR: Ulasan perusahaan setelah magang selesai
 *
 * REVISI TAMBAHAN (penyesuaian cetak logbook dengan Panduan Magang Polidewa 2026):
 * - Cetak logbook kini menampilkan Prodi & Semester
 * - Entri logbook dikelompokkan per "Minggu Ke" & "Bulan Ke" sesuai format resmi (Lampiran 2)
 * - Menambahkan pengambilan data "Masukan/Saran Pendamping Lapangan" & "Masukan/Saran Dosen Pembimbing"
 *   dari koleksi baru `masukanLogbook` (diisi via web oleh dosen pembimbing / pendamping lapangan,
 *   lihat routes/pembimbing/logbookMasukan.js dan routes/public/pendampingMasukan.js)
 * - Menambahkan kode validasi unik pada cetakan logbook
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto'); // <-- Tambahkan ini
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');

const upload = multer({ storage: multer.memoryStorage() });

// ============================================================================
// KONSTANTA FOLDER UTAMA (Data WEB)
// ============================================================================
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

router.use(verifyToken);

// ============================================================================
// FUNGSI BANTU PROGRES
// ============================================================================

function calculateProgress(totalLogbook, startDate, endDate, defaultDays = 120) {
  let totalDays = defaultDays;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  } else if (startDate) {
    totalDays = defaultDays;
  }

  const percentage = Math.min(100, Math.round((totalLogbook / totalDays) * 100));

  return {
    totalLogbook,
    totalDays,
    percentage
  };
}

// ============================================================================
// FUNGSI BANTU PENGELOMPOKAN LOGBOOK PER MINGGU / BULAN (Lampiran 2 Panduan)
// ============================================================================

/**
 * Menghitung "Minggu Ke" dan "Bulan Ke" suatu tanggal entri berdasarkan
 * tanggal mulai periode magang (mengikuti format resmi Lampiran 2).
 */
function getMingguBulanKe(tanggalMulai, tanggalEntry) {
  if (!tanggalMulai || !tanggalEntry) return { mingguKe: 1, bulanKe: 1 };

  const start = new Date(tanggalMulai);
  const entry = new Date(tanggalEntry);
  const diffDays = Math.floor((entry - start) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { mingguKe: 1, bulanKe: 1 };

  const mingguKe = Math.floor(diffDays / 7) + 1;
  const bulanKe = Math.floor(diffDays / 30) + 1;

  return { mingguKe, bulanKe };
}

/**
 * Mengelompokkan daftar logbook menjadi array grup per minggu,
 * masing-masing berisi entries, rentang tanggal, total durasi, dan mingguKe/bulanKe.
 * @param {Array} logbook - daftar logbook (sudah terurut ascending berdasarkan tanggal disarankan)
 * @param {string} tanggalMulai - tanggal mulai periode magang
 * @returns {Array} groups terurut berdasarkan mingguKe
 */
function groupLogbookByMinggu(logbook, tanggalMulai) {
  const groups = {};

  logbook.forEach((item) => {
    const { mingguKe, bulanKe } = getMingguBulanKe(tanggalMulai, item.tanggal);
    const key = mingguKe;

    if (!groups[key]) {
      groups[key] = {
        mingguKe,
        bulanKe,
        entries: [],
        tanggalAwal: item.tanggal,
        tanggalAkhir: item.tanggal,
        totalDurasi: 0
      };
    }

    groups[key].entries.push(item);
    groups[key].totalDurasi += parseFloat(item.durasi) || 0;

    if (new Date(item.tanggal) < new Date(groups[key].tanggalAwal)) {
      groups[key].tanggalAwal = item.tanggal;
    }
    if (new Date(item.tanggal) > new Date(groups[key].tanggalAkhir)) {
      groups[key].tanggalAkhir = item.tanggal;
    }
  });

  return Object.values(groups).sort((a, b) => a.mingguKe - b.mingguKe);
}

// ============================================================================
// FUNGSI BANTU DAFTAR HADIR MAGANG (Lampiran Formulir Daftar Hadir Magang)
// ============================================================================

const JAM_MASUK_DEFAULT = '09.00';

/**
 * Menambahkan durasi jam (bisa desimal, misal 5 atau 4.5) ke jam mulai
 * berformat "HH.MM", mengembalikan jam selesai dengan format yang sama.
 * Contoh: addDurationToTime('09.00', 5) => '14.00'
 */
function addDurationToTime(jamMulai, durasiJam) {
  const jam = (jamMulai || JAM_MASUK_DEFAULT).replace(',', '.');
  const [hStr, mStr] = jam.split('.');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;

  const totalMenit = (h * 60 + m) + Math.round((parseFloat(durasiJam) || 0) * 60);
  const newH = Math.floor(totalMenit / 60) % 24;
  const newM = totalMenit % 60;

  return `${String(newH).padStart(2, '0')}.${String(newM).padStart(2, '0')}`;
}

function getNamaHariId(dateStr) {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
  return hari[new Date(dateStr).getDay()];
}

/**
 * Mengelompokkan logbook menjadi rekap Daftar Hadir per bulan kalender,
 * masing-masing berisi seluruh tanggal 1..akhir bulan (mengikuti format
 * resmi formulir Daftar Hadir Magang Mahasiswa). Tanggal yang punya entri
 * logbook otomatis diisi Jam Datang (default 09.00), Jam Pulang (dihitung
 * dari durasi logbook hari itu), dan Keterangan "Hadir". Tanggal tanpa
 * entri logbook dibiarkan kosong untuk diisi/ditandatangani manual.
 * @param {Array} logbook
 * @param {string} jamMasuk - jam datang standar, format 'HH.MM', default '09.00'
 * @returns {Array} groups terurut berdasarkan tahun & bulan
 */
function groupKehadiranByBulan(logbook, jamMasuk = JAM_MASUK_DEFAULT) {
  const map = {};

  logbook.forEach((item) => {
    const d = new Date(item.tanggal);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    if (!map[key]) {
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      map[key] = {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        monthLabel: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        daysInMonth,
        entriesByTanggal: {}
      };
    }

    const tanggalNum = d.getDate();
    const jamPulang = addDurationToTime(jamMasuk, item.durasi);

    const existing = map[key].entriesByTanggal[tanggalNum];
    if (!existing) {
      map[key].entriesByTanggal[tanggalNum] = {
        tanggal: item.tanggal,
        jamDatang: jamMasuk,
        jamPulang,
        totalDurasi: parseFloat(item.durasi) || 0,
        keterangan: 'Hadir'
      };
    } else {
      existing.totalDurasi += parseFloat(item.durasi) || 0;
      existing.jamPulang = addDurationToTime(jamMasuk, existing.totalDurasi);
    }
  });

  return Object.values(map).sort((a, b) => (a.year - b.year) || (a.month - b.month));
}

/**
 * Mengambil seluruh data masukan/saran (dosen pembimbing & pendamping lapangan)
 * untuk satu periode magang, dari koleksi `masukanLogbook`.
 * Struktur dokumen: { periodId, mingguKe, tipe: 'pendamping'|'pembimbing1'|'pembimbing2', isi, penulis, updatedAt }
 * Key pada map yang dikembalikan: `${mingguKe}_${tipe}`
 */
async function getMasukanByPeriod(periodId) {
  try {
    const snapshot = await db.collection('masukanLogbook')
      .where('periodId', '==', periodId)
      .get();

    const map = {};
    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      map[`${d.mingguKe}_${d.tipe}`] = d;
    });
    return map;
  } catch (error) {
    console.error('Error getMasukanByPeriod:', error);
    return {};
  }
}

// ============================================================================
// FUNGSI BANTU UMUM
// ============================================================================

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

function getAngkatanFromNim(nim) {
  if (!nim || nim.length < 2) return new Date().getFullYear().toString();
  if (nim.length >= 4 && !isNaN(parseInt(nim.substring(0,4)))) {
    return nim.substring(0,4);
  }
  return '20' + nim.substring(0,2);
}

function extractTahunAjaran(semesterLabel) {
  const match = semesterLabel.match(/\d{4}\/\d{4}/);
  return match ? match[0] : new Date().getFullYear() + '/' + (new Date().getFullYear() + 1);
}

// ============================================================================
// FUNGSI BANTU KODE VALIDASI
// ============================================================================

/**
 * Generate kode validasi unik untuk setiap cetakan logbook.
 * Menggunakan hash SHA-256 dari userId + timestamp + secret key.
 * @param {string} userId - ID mahasiswa
 * @returns {string} Kode validasi 12 karakter (huruf besar & angka)
 */
function generateKodeValidasi(userId) {
  const raw = `${userId}_${Date.now()}_${process.env.SECRET_KEY || 'polidewa'}`;
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 12).toUpperCase();
}

// ============================================================================
// FUNGSI BANTU PEMBIMBING
// ============================================================================

async function getPembimbingMahasiswa(mahasiswaId) {
  try {
    const snapshot = await db.collection('bimbingan')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const bimbingan = snapshot.docs[0].data();

    let pembimbing1 = null;
    if (bimbingan.pembimbing1Id) {
      const dosenDoc = await db.collection('dosen').doc(bimbingan.pembimbing1Id).get();
      const dosenData = dosenDoc.exists ? dosenDoc.data() : {}; // <-- DEFINISIKAN DI SINI
      pembimbing1 = {
        id: bimbingan.pembimbing1Id,
        nama: dosenData.nama || bimbingan.pembimbing1Nama || '-',
        nuptk: dosenData.nuptk || dosenData.nip || dosenData.nidn || '-'
      };
    }

    let pembimbing2 = null;
    if (bimbingan.pembimbing2Id) {
      const dosenDoc = await db.collection('dosen').doc(bimbingan.pembimbing2Id).get();
      const dosenData = dosenDoc.exists ? dosenDoc.data() : {}; // <-- DEFINISIKAN DI SINI
      pembimbing2 = {
        id: bimbingan.pembimbing2Id,
        nama: dosenData.nama || bimbingan.pembimbing2Nama || '-',
        nuptk: dosenData.nuptk || dosenData.nip || dosenData.nidn || '-'
      };
    }

    return {
      pembimbing1,
      pembimbing2,
      bimbinganId: snapshot.docs[0].id,
      semester: bimbingan.semester,
      tahunAjaran: bimbingan.tahunAjaran
    };
  } catch (error) {
    console.error('Error getPembimbingMahasiswa:', error);
    return null;
  }
}

// ============================================================================
// FUNGSI BANTU KHUSUS LOGBOOK
// ============================================================================

async function getDokumentasiMagangFolder(nim, nama, semesterLabel) {
  const tahunAjaran = extractTahunAjaran(semesterLabel);
  const angkatan = getAngkatanFromNim(nim);
  const sanitizedNama = nama.replace(/[^a-zA-Z0-9]/g, '_');
  const folderMahasiswa = `${nim}_${sanitizedNama}`;

  const parent = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Dokumentasi Magang Mahasiswa');
  const tahunFolder = await getOrCreateSubFolder(parent, tahunAjaran);
  const angkatanFolder = await getOrCreateSubFolder(tahunFolder, angkatan);
  const mahasiswaFolder = await getOrCreateSubFolder(angkatanFolder, folderMahasiswa);
  return mahasiswaFolder;
}

async function getLaporanMagangFolder(nim, nama, semesterLabel) {
  const tahunAjaran = extractTahunAjaran(semesterLabel);
  const angkatan = getAngkatanFromNim(nim);
  const sanitizedNama = nama.replace(/[^a-zA-Z0-9]/g, '_');
  const folderMahasiswa = `${nim}_${sanitizedNama}`;

  const parent = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Laporan Magang');
  const tahunFolder = await getOrCreateSubFolder(parent, tahunAjaran);
  const angkatanFolder = await getOrCreateSubFolder(tahunFolder, angkatan);
  const mahasiswaFolder = await getOrCreateSubFolder(angkatanFolder, folderMahasiswa);
  return mahasiswaFolder;
}

// ============================================================================
// FUNGSI BANTU PDK (KRS)
// ============================================================================

async function getActivePdkList(userId) {
  try {
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    // ✅ OPTIMISASI KUOTA: ambil semua dokumen mataKuliah SEKALIGUS lewat
    // db.getAll(), bukan satu per satu di dalam loop.
    const enrollments = enrollmentSnapshot.docs.map(doc => doc.data());
    const pdkList = [];
    if (enrollments.length > 0) {
      const mkDocs = await db.getAll(...enrollments.map(e => db.collection('mataKuliah').doc(e.mkId)));
      mkDocs.forEach((mkDoc, i) => {
        if (mkDoc.exists && mkDoc.data().isPDK === true) {
          pdkList.push({
            id: mkDoc.id,
            kodeMK: mkDoc.data().kode,
            namaMK: mkDoc.data().nama,
            semester: enrollments[i].semester,
            tahunAjaran: enrollments[i].tahunAjaran
          });
        }
      });
    }

    pdkList.sort((a, b) => a.kodeMK.localeCompare(b.kodeMK));
    return pdkList;

  } catch (error) {
    console.error('Error getActivePdkList:', error);
    return [];
  }
}

async function getActivePdkWithPeriod(userId) {
  try {
    const snapshot = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const activePeriods = [];
    const today = new Date().toISOString().split('T')[0];

    for (const doc of snapshot.docs) {
      const period = doc.data();
      let isInPeriod = true;
      if (period.tanggalMulai && today < period.tanggalMulai) isInPeriod = false;
      if (period.tanggalSelesai && today > period.tanggalSelesai) isInPeriod = false;

      if (isInPeriod) {
        activePeriods.push({ id: doc.id, ...period });
      }
    }

    return activePeriods;
  } catch (error) {
    console.error('Error getActivePdkWithPeriod:', error);
    return [];
  }
}

async function canSubmitLogbook(mahasiswaId, pdkId) {
  try {
    const snapshot = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('pdkId', '==', pdkId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { can: false, reason: 'Periode magang belum dimulai', period: null };
    }

    const period = snapshot.docs[0].data();
    const today = new Date().toISOString().split('T')[0];

    if (period.tanggalMulai && today < period.tanggalMulai) {
      return { can: false, reason: `Periode magang dimulai pada ${period.tanggalMulai}`, period };
    }

    if (period.tanggalSelesai && today > period.tanggalSelesai) {
      return { can: false, reason: `Periode magang telah berakhir pada ${period.tanggalSelesai}`, period };
    }

    return { can: true, reason: '', period };
  } catch (error) {
    return { can: false, reason: 'Terjadi kesalahan', period: null };
  }
}

async function getMagangProgress(userId, pdkId) {
  try {
    const snapshot = await db.collection('logbookMagang')
      .where('userId', '==', userId)
      .where('pdkId', '==', pdkId)
      .get();

    const total = snapshot.size;
    const approved = snapshot.docs.filter(d => d.data().status === 'approved').length;

    return {
      total,
      approved,
      percentage: total > 0 ? Math.round((approved / total) * 100) : 0
    };
  } catch (error) {
    return { total: 0, approved: 0, percentage: 0 };
  }
}

async function getMagangPeriodsByMahasiswa(mahasiswaId) {
  try {
    const snapshot = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .orderBy('pdkKode', 'asc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    return [];
  }
}

async function getCompletedMagangPeriods(mahasiswaId) {
  try {
    const snapshot = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('status', '==', 'completed')
      .orderBy('completedAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    return [];
  }
}

async function getMagangPeriodById(periodId) {
  try {
    const doc = await db.collection('magangPeriod').doc(periodId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    return null;
  }
}

// ============================================================================
// HALAMAN UTAMA MAGANG
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const pembimbing = await getPembimbingMahasiswa(userId);

    const allPeriods = await getMagangPeriodsByMahasiswa(userId);

    let activePeriod = null;
    const completedPeriods = [];
    const upcomingPeriods = [];

    for (const period of allPeriods) {
      if (period.status === 'active') {
        // ✅ OPTIMISASI KUOTA: cuma butuh JUMLAH-nya, bukan isi dokumennya -
        // pakai count() aggregation, bukan .get().size (yang membaca semua
        // dokumen logbook periode ini).
        let totalLogbook;
        try {
          const countSnap = await db.collection('logbookMagang')
            .where('userId', '==', userId)
            .where('pdkId', '==', period.pdkId)
            .count().get();
          totalLogbook = countSnap.data().count;
        } catch (err) {
          const logbookSnapshot = await db.collection('logbookMagang')
            .where('userId', '==', userId)
            .where('pdkId', '==', period.pdkId)
            .get();
          totalLogbook = logbookSnapshot.size;
        }

        const progress = calculateProgress(
          totalLogbook,
          period.tanggalMulai,
          period.tanggalSelesai,
          120
        );

        activePeriod = { ...period, progress };
      } else if (period.status === 'completed') {
        completedPeriods.push(period);
      } else if (period.status === 'locked') {
        upcomingPeriods.push(period);
      }
    }

    let availablePdks = [];
    if (!activePeriod) {
      availablePdks = await getActivePdkList(userId);
    }

    res.render('mahasiswa/magang/index', {
      title: 'ELK-Magang',
      user: req.user,
      pembimbing,
      activePeriod,
      completedPeriods,
      upcomingPeriods,
      availablePdks
    });
  } catch (error) {
    console.error('Error:', error);
    res.render('mahasiswa/magang/index', {
      title: 'ELK-Magang',
      user: req.user,
      pembimbing: null,
      activePeriod: null,
      completedPeriods: [],
      upcomingPeriods: [],
      availablePdks: []
    });
  }
});

// ============================================================================
// LOGBOOK
// ============================================================================

router.get('/logbook', async (req, res) => {
  try {
    const userId = req.user.id;
    const { periodId } = req.query;

    const pembimbing = await getPembimbingMahasiswa(userId);

    const allPeriods = await getMagangPeriodsByMahasiswa(userId);

    let selectedPeriod = null;
    let canSubmit = false;
    let submitReason = '';

    if (periodId) {
      selectedPeriod = allPeriods.find(p => p.id === periodId);
      if (selectedPeriod) {
        const submitStatus = await canSubmitLogbook(userId, selectedPeriod.pdkId);
        canSubmit = submitStatus.can;
        submitReason = submitStatus.reason;
      }
    } else if (allPeriods.length > 0) {
      selectedPeriod = allPeriods.find(p => p.status === 'active') || allPeriods[0];
      if (selectedPeriod && selectedPeriod.status === 'active') {
        const submitStatus = await canSubmitLogbook(userId, selectedPeriod.pdkId);
        canSubmit = submitStatus.can;
        submitReason = submitStatus.reason;
      }
    }

    let logbook = [];
    if (selectedPeriod) {
      const logbookSnapshot = await db.collection('logbookMagang')
        .where('userId', '==', userId)
        .where('pdkId', '==', selectedPeriod.pdkId)
        .orderBy('tanggal', 'desc')
        .get();

      logbook = logbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    let progress = null;
    if (selectedPeriod) {
      // ✅ OPTIMISASI KUOTA: sama seperti di atas - cuma butuh jumlahnya.
      let totalLogbook;
      try {
        const countSnap = await db.collection('logbookMagang')
          .where('userId', '==', userId)
          .where('pdkId', '==', selectedPeriod.pdkId)
          .count().get();
        totalLogbook = countSnap.data().count;
      } catch (err) {
        const logbookSnapshot = await db.collection('logbookMagang')
          .where('userId', '==', userId)
          .where('pdkId', '==', selectedPeriod.pdkId)
          .get();
        totalLogbook = logbookSnapshot.size;
      }
      progress = calculateProgress(
        totalLogbook,
        selectedPeriod.tanggalMulai,
        selectedPeriod.tanggalSelesai,
        120
      );
    }

    res.render('mahasiswa/magang/logbook', {
      title: 'Logbook Magang',
      user: req.user,
      pembimbing,
      pdkList: allPeriods,
      selectedPeriod,
      selectedPeriodId: selectedPeriod ? selectedPeriod.id : null,
      logbook,
      canSubmit,
      submitReason,
      progress
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat logbook' });
  }
});

// ============================================================================
// TAMBAH LOGBOOK
// ============================================================================

router.post('/logbook', upload.array('images', 5), async (req, res) => {
  try {
    const { tanggal, kegiatan, lokasi, durasi, semester, periodId } = req.body;
    const files = req.files || [];

    if (!tanggal || !kegiatan || !semester || !periodId) {
      return res.status(400).send('Data tidak lengkap. Periode magang wajib dipilih.');
    }

    const period = await getMagangPeriodById(periodId);
    if (!period) {
      return res.status(404).send('Periode magang tidak ditemukan');
    }
    if (period.mahasiswaId !== req.user.id) {
      return res.status(403).send('Akses ditolak');
    }
    if (period.status !== 'active') {
      return res.status(400).send('Periode magang tidak aktif');
    }

    const submitStatus = await canSubmitLogbook(req.user.id, period.pdkId);
    if (!submitStatus.can) {
      return res.status(400).send(submitStatus.reason);
    }

    const pembimbing = await getPembimbingMahasiswa(req.user.id);
    if (!pembimbing || !pembimbing.pembimbing1) {
      return res.status(400).send('Anda belum memiliki dosen pembimbing');
    }

    const nim = req.user.nim;
    const nama = req.user.nama;
    const folderId = await getDokumentasiMagangFolder(nim, nama, semester);

    const imageUrls = [];
    const imageFileIds = [];

    for (const file of files) {
      const compressedBuffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const fileName = `${nim}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
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

    await db.collection('logbookMagang').add({
      userId: req.user.id,
      tanggal,
      kegiatan,
      lokasi: lokasi || '',
      durasi: durasi || '',
      pdkId: period.pdkId,
      pdkKode: period.pdkKode,
      pdkNama: period.pdkNama,
      semester,
      imageUrls,
      imageFileIds,
      status: 'pending',
      createdAt: new Date().toISOString(),
      pembimbing1Id: pembimbing.pembimbing1.id,
      pembimbing1Nama: pembimbing.pembimbing1.nama,
      pembimbing2Id: pembimbing.pembimbing2 ? pembimbing.pembimbing2.id : null,
      pembimbing2Nama: pembimbing.pembimbing2 ? pembimbing.pembimbing2.nama : null
    });

    res.redirect(`/mahasiswa/magang/logbook?periodId=${periodId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal menambah logbook: ' + error.message);
  }
});

// ============================================================================
// EDIT LOGBOOK
// ============================================================================

router.get('/logbook/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('logbookMagang').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Logbook tidak ditemukan');
    if (doc.data().userId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (doc.data().status !== 'pending') {
      return res.status(400).send('Logbook sudah disetujui/ditolak, tidak dapat diedit.');
    }

    res.render('mahasiswa/magang/logbook_edit', {
      title: 'Edit Logbook',
      user: req.user,
      logbook: { id: doc.id, ...doc.data() }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal memuat data');
  }
});

router.post('/logbook/:id/edit', upload.array('images', 5), async (req, res) => {
  try {
    const { tanggal, kegiatan, lokasi, durasi } = req.body;
    const files = req.files || [];

    const docRef = db.collection('logbookMagang').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Logbook tidak ditemukan');
    if (doc.data().userId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (doc.data().status !== 'pending') {
      return res.status(400).send('Logbook sudah disetujui/ditolak, tidak dapat diedit.');
    }

    const existingData = doc.data();
    const imageUrls = [...(existingData.imageUrls || [])];
    const imageFileIds = [...(existingData.imageFileIds || [])];

    for (const file of files) {
      const compressedBuffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const fileName = `${req.user.nim}_${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const fileMetadata = { name: fileName, parents: [existingData.folderId] };
      const media = { mimeType: 'image/jpeg', body: Readable.from(compressedBuffer) };
      const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });

      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      });

      imageUrls.push(`https://drive.google.com/uc?export=view&id=${response.data.id}`);
      imageFileIds.push(response.data.id);
    }

    await docRef.update({
      tanggal,
      kegiatan,
      lokasi: lokasi || '',
      durasi: durasi || '',
      imageUrls,
      imageFileIds,
      updatedAt: new Date().toISOString()
    });

    res.redirect(`/mahasiswa/magang/logbook?periodId=${existingData.pdkId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal update logbook');
  }
});

// ============================================================================
// HAPUS LOGBOOK
// ============================================================================

router.post('/logbook/:id/delete', async (req, res) => {
  try {
    const docRef = db.collection('logbookMagang').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Logbook tidak ditemukan');
    if (doc.data().userId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (doc.data().status !== 'pending') {
      return res.status(400).send('Logbook sudah disetujui/ditolak, tidak dapat dihapus.');
    }

    const data = doc.data();
    if (data.imageFileIds && data.imageFileIds.length > 0) {
      for (const fileId of data.imageFileIds) {
        try {
          await drive.files.delete({ fileId });
        } catch (err) {
          console.error('Gagal hapus gambar:', err.message);
        }
      }
    }
    await docRef.delete();
    res.redirect(`/mahasiswa/magang/logbook?periodId=${data.pdkId}`);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal hapus logbook');
  }
});

// ============================================================================
// ARSIP LOGBOOK
// ============================================================================

router.get('/arsip/:periodId', async (req, res) => {
  try {
    const { periodId } = req.params;
    const period = await getMagangPeriodById(periodId);

    if (!period) return res.status(404).send('Periode magang tidak ditemukan');
    if (period.mahasiswaId !== req.user.id) return res.status(403).send('Akses ditolak');

    const logbookSnapshot = await db.collection('logbookMagang')
      .where('userId', '==', req.user.id)
      .where('pdkId', '==', period.pdkId)
      .orderBy('tanggal', 'asc')
      .get();

    const logbookList = logbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const pembimbing = await getPembimbingMahasiswa(req.user.id);

    res.render('mahasiswa/magang/arsip_detail', {
      title: `Arsip Magang - ${period.pdkNama}`,
      user: req.user,
      period,
      logbookList,
      pembimbing
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memuat arsip');
  }
});

// ============================================================================
// CETAK LOGBOOK
// ============================================================================

router.get('/logbook-print', async (req, res) => {
  try {
    const { periodId } = req.query;

    let period = null;
    let logbook = [];

    if (periodId) {
      period = await getMagangPeriodById(periodId);
      if (period && period.mahasiswaId === req.user.id) {
        const snapshot = await db.collection('logbookMagang')
          .where('userId', '==', req.user.id)
          .where('pdkId', '==', period.pdkId)
          .orderBy('tanggal', 'asc')
          .get();
        logbook = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    }

    // Generate kode validasi untuk cetakan ini
    const kodeValidasi = generateKodeValidasi(req.user.id);

    const mahasiswaDoc = await db.collection('users').doc(req.user.id).get();
    const mahasiswa = mahasiswaDoc.exists ? mahasiswaDoc.data() : { nama: req.user.nama, nim: req.user.nim };
    const pembimbing = await getPembimbingMahasiswa(req.user.id);
    const totalDurasi = logbook.reduce((sum, item) => sum + (parseFloat(item.durasi) || 0), 0);

    // === Prodi & Semester (Panduan Lampiran 2) ===
    const prodi = 'Teknik Elektronika';
    const semester = (period && period.semester) || (pembimbing && pembimbing.semester) || '-';

    // === Pengelompokan per Minggu Ke / Bulan Ke (Panduan Lampiran 2) ===
    const mingguGroups = period ? groupLogbookByMinggu(logbook, period.tanggalMulai) : [];

    // === Masukan/Saran Pendamping Lapangan & Dosen Pembimbing per minggu ===
    const masukanMap = period ? await getMasukanByPeriod(period.id) : {};

    // === Daftar Hadir Magang (otomatis dari logbook: jam datang default,
    //     jam pulang = jam datang + durasi logbook hari itu) ===
    const jamMasuk = (period && period.jamMasuk) || JAM_MASUK_DEFAULT;
    const kehadiranGroups = groupKehadiranByBulan(logbook, jamMasuk);
    const tahunAjaran = period ? extractTahunAjaran(period.semester || semester || '') : '-';

    // Hitung progress
    let progress = null;
    if (period) {
      const totalLogbook = logbook.length;
      progress = calculateProgress(
        totalLogbook,
        period.tanggalMulai,
        period.tanggalSelesai,
        120 // default durasi magang dalam hari
      );
    }


    res.render('mahasiswa/magang/print', {
      title: 'Cetak Logbook',
      mahasiswa,
      prodi,
      semester,
      logbook,
      mingguGroups,
      masukanMap,
      kehadiranGroups,
      jamMasuk,
      tahunAjaran,
      totalDurasi,
      totalEntries: logbook.length,
      generatedAt: new Date().toLocaleString('id-ID'),
      pembimbing,
      kodeValidasi, 
      pdkInfo: period,
      progress, // <--
      user: req.user
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal mencetak logbook');
  }
});

// ============================================================================
// ULASAN PERUSAHAAN
// ============================================================================

router.get('/ulasan', async (req, res) => {
  try {
    const completedPeriods = await getCompletedMagangPeriods(req.user.id);

    // ✅ OPTIMISASI KUOTA: sebelumnya query 'reviewPerusahaan' dijalankan
    // TERPISAH untuk setiap periode magang yang sudah selesai (N query utk N
    // periode). Sekarang cukup SATU query batch (`where('magangPeriodId','in',...)`)
    // utk semua periode sekaligus (periode magang biasanya sedikit, jadi ini
    // hampir selalu cukup 1 query saja, bukan N).
    const periodIds = completedPeriods.map(p => p.id);
    const reviewByPeriodId = new Map(); // periodId -> reviewDoc id
    if (periodIds.length > 0) {
      const chunks = [];
      for (let i = 0; i < periodIds.length; i += 10) chunks.push(periodIds.slice(i, i + 10));
      for (const chunk of chunks) {
        const snap = await db.collection('reviewPerusahaan').where('magangPeriodId', 'in', chunk).get();
        snap.docs.forEach(doc => {
          const pid = doc.data().magangPeriodId;
          if (!reviewByPeriodId.has(pid)) reviewByPeriodId.set(pid, doc.id); // simpan yang pertama ditemukan
        });
      }
    }

    const periodsWithUlasan = completedPeriods.map(period => ({
      ...period,
      hasUlasan: reviewByPeriodId.has(period.id),
      ulasanId: reviewByPeriodId.get(period.id) || null
    }));

    res.render('mahasiswa/magang/ulasan_list', {
      title: 'Ulasan Perusahaan Magang',
      user: req.user,
      periods: periodsWithUlasan
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memuat halaman ulasan');
  }
});

router.get('/ulasan/:periodId', async (req, res) => {
  try {
    const { periodId } = req.params;
    const period = await getMagangPeriodById(periodId);

    if (!period) return res.status(404).send('Periode magang tidak ditemukan');
    if (period.mahasiswaId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (period.status !== 'completed') {
      return res.status(400).send('Magang belum selesai, belum bisa memberi ulasan');
    }

    const existingReview = await db.collection('reviewPerusahaan')
      .where('magangPeriodId', '==', periodId)
      .get();

    res.render('mahasiswa/magang/ulasan_form', {
      title: `Ulasan - ${period.perusahaan?.nama || period.pdkNama}`,
      user: req.user,
      period,
      review: existingReview.empty ? null : existingReview.docs[0].data(),
      isEdit: !existingReview.empty
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memuat form ulasan');
  }
});

router.post('/ulasan/:periodId', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { deskripsiPerusahaan, fasilitasMagang, kontakHpPerusahaan, saranUntukJunior, pengalamanKerja, rating } = req.body;

    if (!deskripsiPerusahaan || !fasilitasMagang || !rating) {
      return res.status(400).send('Deskripsi perusahaan, fasilitas, dan rating wajib diisi');
    }

    const period = await getMagangPeriodById(periodId);
    if (!period) return res.status(404).send('Periode magang tidak ditemukan');
    if (period.mahasiswaId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (period.status !== 'completed') return res.status(400).send('Magang belum selesai');

    const existingReview = await db.collection('reviewPerusahaan')
      .where('magangPeriodId', '==', periodId)
      .get();

    const now = new Date().toISOString();

    if (!existingReview.empty) {
      await existingReview.docs[0].ref.update({
        deskripsiPerusahaan,
        fasilitasMagang,
        kontakHpPerusahaan: kontakHpPerusahaan || '',
        saranUntukJunior: saranUntukJunior || '',
        pengalamanKerja: pengalamanKerja || '',
        rating: parseInt(rating),
        updatedAt: now
      });
    } else {
      await db.collection('reviewPerusahaan').add({
        magangPeriodId: periodId,
        mahasiswaId: req.user.id,
        mahasiswaNama: req.user.nama,
        mahasiswaNim: req.user.nim,
        pdkKode: period.pdkKode,
        pdkNama: period.pdkNama,
        namaPerusahaan: period.perusahaan?.nama || '',
        alamatPerusahaan: period.perusahaan?.alamat || '',
        kontakPerusahaan: period.perusahaan?.kontak || '',
        kontakHpPerusahaan: kontakHpPerusahaan || '',
        pembimbingLapangan: period.perusahaan?.pembimbingLapangan || '',
        deskripsiPerusahaan,
        fasilitasMagang,
        saranUntukJunior: saranUntukJunior || '',
        pengalamanKerja: pengalamanKerja || '',
        rating: parseInt(rating),
        status: 'pending',
        createdAt: now,
        updatedAt: now
      });
    }

    res.redirect('/mahasiswa/magang/ulasan?success=Ulasan berhasil disimpan');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal menyimpan ulasan: ' + error.message);
  }
});

// ============================================================================
// LAPORAN MAGANG
// ============================================================================

router.get('/laporan', async (req, res) => {
  try {
    const userId = req.user.id;
    const pembimbing = await getPembimbingMahasiswa(userId);

    // ✅ OPTIMISASI KUOTA: 3 dokumen tetap (laporan 1, 2, 3) diambil
    // SEKALIGUS lewat db.getAll(), bukan 3 kali .get() terpisah berurutan.
    const docIds = [1, 2, 3].map(i => `${userId}_${i}`);
    const docs = await db.getAll(...docIds.map(id => db.collection('laporanMagang').doc(id)));
    const laporanList = docs.map((doc, idx) => ({
      ke: idx + 1,
      exists: doc.exists,
      data: doc.exists ? doc.data() : null
    }));

    res.render('mahasiswa/magang/laporan', {
      title: 'Laporan Magang',
      user: req.user,
      laporanList,
      pembimbing
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memuat halaman');
  }
});

router.post('/laporan/upload', upload.single('file'), async (req, res) => {
  try {
    const { laporanKe } = req.body;
    const file = req.file;

    if (!laporanKe || !file) return res.status(400).send('Laporan ke dan file wajib diisi');
    if (file.mimetype !== 'application/pdf') return res.status(400).send('Laporan magang harus dalam format PDF');

    const pembimbing = await getPembimbingMahasiswa(req.user.id);
    if (!pembimbing || !pembimbing.pembimbing1) {
      return res.status(400).send('Anda belum memiliki dosen pembimbing');
    }

    const userId = req.user.id;
    const nim = req.user.nim;
    const nama = req.user.nama;
    const currentSemester = getCurrentAcademicSemester().label;
    const folderId = await getLaporanMagangFolder(nim, nama, currentSemester);

    const fileName = `Laporan_${laporanKe}_${Date.now()}.pdf`;
    const fileMetadata = { name: fileName, parents: [folderId] };
    const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
    const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });

    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    const fileUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
    const docId = `${userId}_${laporanKe}`;

    await db.collection('laporanMagang').doc(docId).set({
      userId,
      nim,
      nama: req.user.nama,
      laporanKe: parseInt(laporanKe),
      fileUrl,
      fileId: response.data.id,
      fileName,
      semester: currentSemester,
      uploadedAt: new Date().toISOString(),
      status: 'submitted',
      komentar: [],
      pembimbing1Id: pembimbing.pembimbing1.id,
      pembimbing1Nama: pembimbing.pembimbing1.nama,
      pembimbing2Id: pembimbing.pembimbing2 ? pembimbing.pembimbing2.id : null,
      pembimbing2Nama: pembimbing.pembimbing2 ? pembimbing.pembimbing2.nama : null
    });

    res.redirect('/mahasiswa/magang/laporan');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal upload laporan: ' + error.message);
  }
});

router.post('/laporan/hapus/:laporanKe', async (req, res) => {
  try {
    const laporanKe = parseInt(req.params.laporanKe);
    if (isNaN(laporanKe) || laporanKe < 1 || laporanKe > 3) {
      return res.status(400).send('Nomor laporan tidak valid');
    }

    const userId = req.user.id;
    const docId = `${userId}_${laporanKe}`;
    const laporanRef = db.collection('laporanMagang').doc(docId);
    const doc = await laporanRef.get();
    if (!doc.exists) return res.status(404).send('Laporan tidak ditemukan');
    const data = doc.data();

    if (data.status !== 'submitted') {
      return res.status(400).send('Hanya laporan dengan status submitted yang dapat dihapus');
    }

    if (data.fileId) {
      try {
        await drive.files.delete({ fileId: data.fileId });
      } catch (err) {
        console.error('Gagal hapus file Drive:', err);
      }
    }

    await laporanRef.delete();
    res.redirect('/mahasiswa/magang/laporan');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal hapus laporan');
  }
});

// ============================================================================
// PERMOHONAN SEMINAR
// ============================================================================

router.get('/seminar', async (req, res) => {
  try {
    const snapshot = await db.collection('permohonanMagang')
      .where('userId', '==', req.user.id)
      .orderBy('createdAt', 'desc')
      .get();
    const permohonan = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const pembimbing = await getPembimbingMahasiswa(req.user.id);

    res.render('mahasiswa/magang/seminar_list', {
      title: 'Permohonan Seminar Magang',
      user: req.user,
      permohonan,
      pembimbing
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat permohonan' });
  }
});

router.get('/seminar/baru', async (req, res) => {
  const pembimbing = await getPembimbingMahasiswa(req.user.id);
  res.render('mahasiswa/magang/seminar_form', {
    title: 'Ajukan Seminar Magang',
    user: req.user,
    seminar: null,
    pembimbing
  });
});

router.post('/seminar', async (req, res) => {
  try {
    const { judul, tanggal, waktu, tempat, pembimbing1, pembimbing2, penguji } = req.body;
    if (!judul || !tanggal || !waktu || !tempat) {
      return res.status(400).send('Judul, tanggal, waktu, dan tempat wajib diisi');
    }

    const pembimbing = await getPembimbingMahasiswa(req.user.id);
    const defaultPembimbing1 = pembimbing?.pembimbing1?.nama || '';
    const defaultPembimbing2 = pembimbing?.pembimbing2?.nama || pembimbing2 || '';

    await db.collection('permohonanMagang').add({
      userId: req.user.id,
      nim: req.user.nim,
      nama: req.user.nama,
      judul,
      tanggal: new Date(tanggal).toISOString(),
      waktu,
      tempat,
      pembimbing1: pembimbing1 || defaultPembimbing1,
      pembimbing2: defaultPembimbing2,
      penguji: penguji || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [{ status: 'pending', timestamp: new Date().toISOString(), catatan: 'Pengajuan seminar diterima' }]
    });

    res.redirect('/mahasiswa/magang/seminar');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal menyimpan pengajuan');
  }
});

router.get('/seminar/:id', async (req, res) => {
  try {
    const doc = await db.collection('permohonanMagang').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const seminar = { id: doc.id, ...doc.data() };
    if (seminar.userId !== req.user.id) return res.status(403).send('Akses ditolak');

    const pembimbing = await getPembimbingMahasiswa(req.user.id);
    res.render('mahasiswa/magang/seminar_detail', {
      title: 'Detail Seminar',
      user: req.user,
      seminar,
      pembimbing
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal memuat detail');
  }
});

router.post('/seminar/:id/batal', async (req, res) => {
  try {
    const docRef = db.collection('permohonanMagang').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Data tidak ditemukan');
    const data = doc.data();
    if (data.userId !== req.user.id) return res.status(403).send('Akses ditolak');
    if (data.status !== 'pending') {
      return res.status(400).send('Hanya pengajuan pending yang dapat dibatalkan');
    }

    await docRef.update({
      status: 'dibatalkan',
      updatedAt: new Date().toISOString(),
      history: [...(data.history || []), { status: 'dibatalkan', timestamp: new Date().toISOString(), catatan: 'Dibatalkan mahasiswa' }]
    });
    res.redirect('/mahasiswa/magang/seminar');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal membatalkan');
  }
});

module.exports = router;