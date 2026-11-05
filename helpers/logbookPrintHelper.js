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

// Urutan baris pada lembar logbook mingguan (format Politeknik Dewantara):
// Senin s.d. Ahad. Angka = hasil getUTCDay() (0 = Minggu/Ahad).
const HARI_LEMBAR = [
  { nama: 'Senin', dow: 1 },
  { nama: 'Selasa', dow: 2 },
  { nama: 'Rabu', dow: 3 },
  { nama: 'Kamis', dow: 4 },
  { nama: 'Jumat', dow: 5 },
  { nama: 'Sabtu', dow: 6 },
  { nama: 'Ahad', dow: 0 }
];

// Tanggal 'YYYY-MM-DD' <-> Date UTC (menghindari pergeseran zona waktu).
function parseTanggalUTC(str) {
  const d = new Date(String(str).substring(0, 10) + 'T00:00:00Z');
  return isNaN(d) ? null : d;
}
function formatTanggalISO(d) {
  return d.toISOString().substring(0, 10);
}
function addDaysUTC(d, n) {
  return new Date(d.getTime() + n * 86400000);
}

/**
 * Membangun 7 baris (Senin..Ahad) untuk satu lembar logbook mingguan.
 * Tiap baris: { hari, tanggal (YYYY-MM-DD | null), entries[], durasi }.
 * Tanggal baris kosong diisi dari jendela 7 hari minggu tsb bila
 * tanggal mulai periode diketahui.
 */
function buildBarisMingguan(entries, windowStart) {
  const rows = HARI_LEMBAR.map((h) => ({ hari: h.nama, dow: h.dow, tanggal: null, entries: [], durasi: 0 }));

  if (windowStart) {
    for (let i = 0; i < 7; i++) {
      const d = addDaysUTC(windowStart, i);
      const row = rows.find((r) => r.dow === d.getUTCDay());
      if (row) row.tanggal = formatTanggalISO(d);
    }
  }

  entries.forEach((item) => {
    const d = parseTanggalUTC(item.tanggal);
    if (!d) return;
    const row = rows.find((r) => r.dow === d.getUTCDay());
    if (!row) return;
    if (!row.tanggal) row.tanggal = formatTanggalISO(d);
    row.entries.push(item);
    row.durasi += parseFloat(item.durasi) || 0;
  });

  return rows.map(({ dow, ...rest }) => rest);
}

// ============================================================================
// DOKUMENTASI MINGGUAN (halaman foto setelah lembar logbook tiap minggu)
// ============================================================================

const FOTO_PER_HALAMAN = 6; // 2 kolom x 3 baris per halaman A4
const HARI_NAMA = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/** ID berkas Google Drive dari URL (uc?export=view&id=... atau /d/ID/...). */
function getDriveFileId(url) {
  if (!url) return null;
  let m = String(url).match(/[?&]id=([^&]+)/);
  if (m) return m[1];
  m = String(url).match(/\/d\/([^\/]+)/);
  return m ? m[1] : null;
}

/**
 * Mengumpulkan semua foto entri logbook dalam satu minggu, berurutan menurut
 * tanggal. Caption = caption yang diisi mahasiswa (imageCaptions[i]); bila
 * kosong dipakai uraian kegiatan pada entri tsb.
 */
function kumpulkanFoto(entries, sudahTampil) {
  const fotos = [];
  const seen = sudahTampil || new Set(); // dipakai bersama antar minggu: foto sama hanya tampil sekali
  entries.forEach((e) => {
    const urls = Array.isArray(e.imageUrls) ? e.imageUrls : [];
    const caps = Array.isArray(e.imageCaptions) ? e.imageCaptions : [];
    const d = parseTanggalUTC(e.tanggal);
    urls.forEach((url, i) => {
      if (!url) return;
      const id = getDriveFileId(url);
      // Kunci kesamaan: sidik foto (imageHashes) bila ada, cadangan ID berkas Drive
      const hashes = Array.isArray(e.imageHashes) ? e.imageHashes : [];
      const kunci = hashes[i] || id || url;
      if (seen.has(kunci)) return;
      seen.add(kunci);
      fotos.push({
        url: id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : url,
        urlCadangan: url,
        caption: (caps[i] && String(caps[i]).trim()) || String(e.kegiatan || '').trim(),
        tanggal: d ? formatTanggalISO(d) : '',
        hari: d ? HARI_NAMA[d.getUTCDay()] : ''
      });
    });
  });
  return fotos;
}

function bagiHalaman(arr, ukuran) {
  const out = [];
  for (let i = 0; i < arr.length; i += ukuran) out.push(arr.slice(i, i + ukuran));
  return out;
}

/**
 * Tanggal hari ini (YYYY-MM-DD) menurut WITA (Asia/Makassar), bukan UTC server,
 * supaya "pekan ini" tidak bergeser sehari saat mahasiswa mengisi pagi hari.
 */
function todayWITA() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
}

/**
 * Menentukan rentang 7 hari (minggu ke-N) untuk tampilan "pekan ini" di halaman
 * logbook mahasiswa. Pembagian minggu SAMA dengan cetak logbook (dihitung dari
 * tanggal mulai periode), sehingga lembar cetak dan tampilan web selalu searah.
 *
 * @param {Object} opt - { tanggalMulai, tanggalSelesai, mingguKe (opsional, dari ?minggu=) }
 * @param {string} [today] - YYYY-MM-DD (default: hari ini WITA)
 * @returns {{mingguKe:number|null, awal:string, akhir:string, mingguSekarang:number|null,
 *            totalMinggu:number|null, adalahPekanIni:boolean, adaSebelumnya:boolean, adaBerikutnya:boolean}}
 */
function getRentangMinggu(opt, today) {
  today = today || todayWITA();
  const t = parseTanggalUTC(today);
  const mulai = opt && opt.tanggalMulai ? parseTanggalUTC(opt.tanggalMulai) : null;

  // Periode tanpa tanggal mulai: pakai 7 hari terakhir (tanpa navigasi minggu)
  if (!mulai) {
    return {
      mingguKe: null, awal: formatTanggalISO(addDaysUTC(t, -6)), akhir: today,
      mingguSekarang: null, totalMinggu: null,
      adalahPekanIni: true, adaSebelumnya: false, adaBerikutnya: false
    };
  }

  const selesai = opt.tanggalSelesai ? parseTanggalUTC(opt.tanggalSelesai) : null;
  const diff = Math.floor((t - mulai) / 86400000);
  let sekarang = diff < 0 ? 1 : Math.floor(diff / 7) + 1;
  let totalMinggu = null;
  if (selesai && selesai >= mulai) {
    const hari = Math.floor((selesai - mulai) / 86400000) + 1;
    totalMinggu = Math.ceil(hari / 7);
    if (sekarang > totalMinggu) sekarang = totalMinggu; // periode sudah lewat -> minggu terakhir
  }

  let n = parseInt(opt.mingguKe, 10);
  if (isNaN(n) || n < 1) n = sekarang;
  if (n > sekarang) n = sekarang; // tidak ada minggu di masa depan

  const awal = addDaysUTC(mulai, (n - 1) * 7);
  return {
    mingguKe: n,
    awal: formatTanggalISO(awal),
    akhir: formatTanggalISO(addDaysUTC(awal, 6)),
    mingguSekarang: sekarang,
    totalMinggu,
    adalahPekanIni: n === sekarang,
    adaSebelumnya: n > 1,
    adaBerikutnya: n < sekarang
  };
}

/**
 * Mengelompokkan daftar logbook menjadi array grup per minggu,
 * masing-masing berisi entries, rentang tanggal, total durasi, mingguKe/bulanKe,
 * dan `rows` (7 baris Senin..Ahad) untuk lembar logbook mingguan.
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

  const mulai = tanggalMulai ? parseTanggalUTC(tanggalMulai) : null;
  const fotoSudahTampil = new Set();

  return Object.values(groups)
    .sort((a, b) => a.mingguKe - b.mingguKe)
    .map((g) => {
      // Jendela 7 hari minggu ini (mingguKe dihitung dari tanggal mulai periode)
      const windowStart = mulai ? addDaysUTC(mulai, (g.mingguKe - 1) * 7) : null;
      if (windowStart) {
        g.periodeAwal = formatTanggalISO(windowStart);
        g.periodeAkhir = formatTanggalISO(addDaysUTC(windowStart, 6));
      } else {
        g.periodeAwal = g.tanggalAwal;
        g.periodeAkhir = g.tanggalAkhir;
      }
      g.rows = buildBarisMingguan(g.entries, windowStart);
      g.fotos = kumpulkanFoto(g.entries, fotoSudahTampil);
      g.halamanFoto = bagiHalaman(g.fotos, FOTO_PER_HALAMAN);
      return g;
    });
}

// ============================================================================
// LEMBAR PENGESAHAN: DURASI MAGANG & RINGKASAN ANALITIK
// ============================================================================

/** Tambah n bulan kalender ke tanggal UTC (hari dipotong ke akhir bulan bila perlu). */
function addMonthsUTC(d, n) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
}

/**
 * Lama magang dalam bulan + hari kalender (kedua tanggal dihitung penuh).
 * Contoh: 05 Okt s.d. 14 Des => { bulan: 2, hari: 10, totalHari: 71 }.
 */
function hitungDurasiPeriode(mulaiStr, selesaiStr) {
  const a = mulaiStr ? parseTanggalUTC(mulaiStr) : null;
  const b = selesaiStr ? parseTanggalUTC(selesaiStr) : null;
  if (!a || !b || b < a) return null;
  const batas = addDaysUTC(b, 1); // tanggal selesai ikut dihitung
  let bulan = (batas.getUTCFullYear() - a.getUTCFullYear()) * 12 + (batas.getUTCMonth() - a.getUTCMonth());
  while (bulan > 0 && addMonthsUTC(a, bulan) > batas) bulan--;
  const hari = Math.round((batas - addMonthsUTC(a, bulan)) / 86400000);
  const totalHari = Math.round((batas - a) / 86400000);
  let teks = [];
  if (bulan) teks.push(`${bulan} bulan`);
  if (hari || !bulan) teks.push(`${hari} hari`);
  return { bulan, hari, totalHari, teks: teks.join(' '), awal: formatTanggalISO(a), akhir: formatTanggalISO(b) };
}

function hitungHariKerja(awal, akhir) { // Senin-Jumat
  let n = 0;
  for (let d = awal; d <= akhir; d = addDaysUTC(d, 1)) {
    const w = d.getUTCDay();
    if (w >= 1 && w <= 5) n++;
  }
  return n;
}

/**
 * Ringkasan analitik untuk Lembar Pengesahan Logbook.
 * Lama magang = tanggal mulai s.d. selesai periode; bila tidak ada, dipakai
 * entri logbook pertama s.d. terakhir.
 */
function buildRingkasanAnalitik(logbook, period, mingguGroups, kehadiranGroups, masukanMap) {
  const tanggalUnik = Array.from(new Set(logbook.map((l) => String(l.tanggal).substring(0, 10)))).sort();
  const hariHadir = tanggalUnik.length;
  const totalJam = logbook.reduce((n, l) => n + (parseFloat(l.durasi) || 0), 0);
  const rataJamHari = hariHadir ? totalJam / hariHadir : 0;

  const mulai = (period && period.tanggalMulai) || tanggalUnik[0] || null;
  const selesai = (period && period.tanggalSelesai) || tanggalUnik[tanggalUnik.length - 1] || null;
  const durasi = hitungDurasiPeriode(mulai, selesai);

  // tingkat kehadiran terhadap hari kerja (Sen-Jum) sampai hari ini / akhir periode
  let hariKerja = 0, persenHadir = null;
  if (durasi) {
    const hariIni = parseTanggalUTC(todayWITA());
    const akhirHitung = parseTanggalUTC(durasi.akhir) < hariIni ? parseTanggalUTC(durasi.akhir) : hariIni;
    const awal = parseTanggalUTC(durasi.awal);
    if (akhirHitung >= awal) hariKerja = hitungHariKerja(awal, akhirHitung);
    if (hariKerja > 0) persenHadir = Math.min(100, Math.round((hariHadir / hariKerja) * 100));
  }

  // jam per minggu (termasuk minggu kosong sampai akhir periode)
  const jamMap = {};
  const hariMap = {};
  (mingguGroups || []).forEach((g) => {
    jamMap[g.mingguKe] = g.totalDurasi;
    hariMap[g.mingguKe] = new Set(g.entries.map((e) => String(e.tanggal).substring(0, 10))).size;
  });
  let totalMinggu = 0;
  if (durasi) totalMinggu = Math.ceil(durasi.totalHari / 7);
  const maksMingguData = Object.keys(jamMap).reduce((m, k) => Math.max(m, parseInt(k, 10)), 0);
  totalMinggu = Math.max(totalMinggu, maksMingguData);
  const perMinggu = [];
  for (let i = 1; i <= totalMinggu; i++) perMinggu.push({ minggu: i, jam: jamMap[i] || 0, hari: hariMap[i] || 0 });
  const mingguTerisi = perMinggu.filter((m) => m.jam > 0 || m.hari > 0).length;
  const mingguTersibuk = perMinggu.reduce((b, m) => (m.jam > (b ? b.jam : 0) ? m : b), null);

  const perBulan = (kehadiranGroups || []).map((b) => ({
    label: b.monthLabel,
    hari: Object.keys(b.entriesByTanggal).length,
    jam: Object.values(b.entriesByTanggal).reduce((n, e) => n + e.totalDurasi, 0)
  }));
  const bulanTerbanyak = perBulan.reduce((b, m) => (m.hari > (b ? b.hari : 0) ? m : b), null);

  // hadir beruntun terpanjang (hari kalender berturut-turut)
  let beruntun = 0, run = 0, prev = null;
  tanggalUnik.forEach((t) => {
    const d = parseTanggalUTC(t);
    run = prev && Math.round((d - prev) / 86400000) === 1 ? run + 1 : 1;
    beruntun = Math.max(beruntun, run);
    prev = d;
  });

  const jumlahFoto = logbook.reduce((n, l) => n + (Array.isArray(l.imageUrls) ? l.imageUrls.length : 0), 0);
  const disetujui = logbook.filter((l) => l.status === 'approved').length;
  const mingguCatatanPendamping = Object.keys(masukanMap || {}).filter((k) => /_pendamping$/.test(k) && masukanMap[k] && masukanMap[k].isi && String(masukanMap[k].isi).trim()).length;

  return {
    durasi, mulai, selesai, hariHadir, totalJam, rataJamHari, hariKerja, persenHadir,
    totalMinggu, mingguTerisi, perMinggu, mingguTersibuk, perBulan, bulanTerbanyak,
    beruntun, jumlahFoto, totalEntri: logbook.length, disetujui, mingguCatatanPendamping
  };
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
  const ringkasan = buildRingkasanAnalitik(logbook, period, mingguGroups, kehadiranGroups, masukanMap);

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
    progress,
    ringkasan
  };
}

module.exports = {
  buildLogbookPrintData,
  getRentangMinggu,
  getMingguBulanKe,
  todayWITA,
  calculateProgress,
  groupLogbookByMinggu,
  kumpulkanFoto,
  hitungDurasiPeriode,
  buildRingkasanAnalitik,
  groupKehadiranByBulan,
  getMasukanByPeriod,
  extractTahunAjaran,
  generateKodeValidasi,
  JAM_MASUK_DEFAULT
};
