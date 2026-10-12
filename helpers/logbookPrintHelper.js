// helpers/logbookPrintHelper.js
// ============================================================================
// CETAK LOGBOOK MAGANG - SATU SUMBER UNTUK MAHASISWA, DOSEN PA, DAN ADMIN
//
// Semua cetak logbook memakai template yang sama: views/mahasiswa/magang/print.ejs
// (rekap per minggu, masukan pendamping & dosen pembimbing, daftar hadir,
// tanda tangan, kode validasi). Rute mahasiswa, dosen, dan admin hanya
// berbeda di PENGECEKAN HAK AKSES; data cetak dibangun oleh
// buildLogbookPrintData() di bawah, jadi hasil cetaknya seragam.
// ============================================================================

const crypto = require('crypto');
const { db } = require('../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('./academicHelper');
const { getPembimbingMahasiswa: getPembimbingDosenPa } = require('./pembimbingHelper');
const { getMagangPeriodById, getMagangPeriodsByMahasiswa } = require('../models/magangPeriodModel');

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
 * Struktur dokumen: { periodId, mingguKe, tipe: 'pendamping'|'pembimbing' (data lama: 'pembimbing1'|'pembimbing2'), isi, penulis, updatedAt }
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
// BANGUN DATA CETAK
// ============================================================================

/**
 * Membangun seluruh data untuk template mahasiswa/magang/print.ejs.
 * Hak akses TIDAK dicek di sini - pemanggil (rute) wajib memastikannya.
 *
 * @param {string} mahasiswaId
 * @param {string} [periodId] - kalau kosong dipakai periode pertama mahasiswa
 *   (supaya link cetak dosen/admin tanpa periodId tetap menghasilkan cetakan)
 * @returns {Promise<Object|null>} variabel untuk res.render, atau null kalau
 *   mahasiswa tidak ditemukan
 */
async function buildLogbookPrintData(mahasiswaId, periodId) {
  const mahasiswaDoc = await db.collection('users').doc(mahasiswaId).get();
  if (!mahasiswaDoc.exists) return null;
  const mahasiswa = mahasiswaDoc.data();

  let period = null;
  if (periodId) {
    const p = await getMagangPeriodById(periodId);
    // periode harus milik mahasiswa ini (cegah cetak silang)
    if (p && p.mahasiswaId === mahasiswaId) period = p;
  } else {
    const semua = await getMagangPeriodsByMahasiswa(mahasiswaId).catch(() => []);
    if (semua.length > 0) period = semua[0]; // sama dengan default halaman detail dosen/admin
  }

  let logbook = [];
  if (period) {
    const snapshot = await db.collection('logbookMagang')
      .where('userId', '==', mahasiswaId)
      .where('pdkId', '==', period.pdkId)
      .orderBy('tanggal', 'asc')
      .get();
    logbook = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  const pembimbingDosenPa = await getPembimbingDosenPa(mahasiswa.dosenPaId ? mahasiswa : mahasiswaId);
  const pembimbing = pembimbingDosenPa ? { pembimbing: pembimbingDosenPa } : null;

  const totalDurasi = logbook.reduce((sum, item) => sum + (parseFloat(item.durasi) || 0), 0);
  const semester = (period && period.semester) || getCurrentAcademicSemester().label || '-';
  const mingguGroups = period ? groupLogbookByMinggu(logbook, period.tanggalMulai) : [];
  const masukanMap = period ? await getMasukanByPeriod(period.id) : {};
  const jamMasuk = (period && period.jamMasuk) || JAM_MASUK_DEFAULT;
  const kehadiranGroups = groupKehadiranByBulan(logbook, jamMasuk);
  const tahunAjaran = period ? extractTahunAjaran(period.semester || semester || '') : '-';
  const progress = period
    ? calculateProgress(logbook.length, period.tanggalMulai, period.tanggalSelesai, 120)
    : null;

  return {
    title: 'Cetak Logbook',
    mahasiswa,
    prodi: 'Teknik Elektronika',
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
    kodeValidasi: generateKodeValidasi(mahasiswaId),
    pdkInfo: period,
    progress
  };
}

module.exports = {
  buildLogbookPrintData,
  calculateProgress,
  groupLogbookByMinggu,
  groupKehadiranByBulan,
  getMasukanByPeriod,
  extractTahunAjaran,
  generateKodeValidasi,
  JAM_MASUK_DEFAULT
};
