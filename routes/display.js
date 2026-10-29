const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { HARI_LIST, parseJadwalText } = require('../helpers/jadwalHelper');

// ============================================================================
// DISPLAY TV - MODE SUPER HEMAT KUOTA FIRESTORE (target < 1.000 read/hari)
// ----------------------------------------------------------------------------
// Prinsip: halaman ini publik & dibuka terus-menerus, jadi JANGAN query
// Firestore per kunjungan. Semua data diolah sekali, lalu disimpan di:
//   1) memori server (0 read), dan
//   2) dokumen Firestore `displayCache/{nama}` (1 read saat server baru
//      menyala/deploy, supaya restart tidak memicu bangun-ulang mahal).
//
// Tier & perkiraan biaya sekali bangun-ulang:
//   mahasiswa : 7 hari   ~300 read   (daftar mhs: nama/NIM/Dosen PA/status)
//   slides    : 8 jam    ~80  read   (50 logbook + 15x2 progress via count())
//   info      : per hari ~170 read   (statistik, MK berjadwal, dosen, jadwal
//                                      hari ini + angkatan, progres MK)
//   news      : 6 jam    ~10  read   (berita & jadwal penting)
//   antrian   : 20 menit 9 read      (count(); hanya 07.00-17.00 WITA)
// Total kira-kira 700-900 read/hari (lihat penjelasan di chat).
//
// Kalau ingin paksa data segar: hapus dokumen terkait di collection
// `displayCache` lewat Firebase Console, lalu restart/tunggu kunjungan berikut.
// ============================================================================

const TZ = 'Asia/Makassar'; // WITA - server sering jalan di UTC
const MENIT = 60 * 1000;
const JAM = 60 * MENIT;

const TTL_MAHASISWA = 7 * 24 * JAM;
const TTL_SLIDES = 8 * JAM;
const TTL_INFO = 24 * JAM; // + otomatis ganti saat lewat tengah malam WITA
const TTL_NEWS = 6 * JAM;
const TTL_ANTRIAN = 20 * MENIT;

const JAM_KERJA_MULAI = 7;  // antrian hanya di-refresh jam 07.00 - 17.00 WITA
const JAM_KERJA_SELESAI = 17;

const MAX_SLIDES = 15;
const POOL_LOGBOOK = 50;
const LIMIT_ENROLLMENT_PER_MK = 25;

function waktuLokal() {
  const now = new Date();
  const lokal = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  return {
    now,
    jam: lokal.getHours(),
    hariIndex: lokal.getDay(),
    tahun: lokal.getFullYear(),
    tanggalISO: now.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
  };
}
const hariKey = () => waktuLokal().tanggalISO;
const jamKerja = () => {
  const { jam } = waktuLokal();
  return jam >= JAM_KERJA_MULAI && jam < JAM_KERJA_SELESAI;
};

// ----------------------------------------------------------------------------
// Cache memori + dedupe proses berjalan + stale-on-error.
// hold(): kalau true dan sudah ada data, data lama dipakai tanpa refresh.
// ----------------------------------------------------------------------------
function cachedMemory(ttlMs, loader, hold) {
  let data, hasData = false, expires = 0, inflight = null;
  return function get() {
    if (hasData && (Date.now() < expires || (hold && hold()))) return Promise.resolve(data);
    if (!inflight) {
      inflight = loader()
        .then(v => { data = v; hasData = true; expires = Date.now() + ttlMs; return v; })
        .catch(err => {
          if (!hasData) throw err;
          console.error('Display: refresh gagal, pakai data lama:', err.message);
          expires = Date.now() + 2 * MENIT;
          return data;
        })
        .finally(() => { inflight = null; });
    }
    return inflight;
  };
}

// ----------------------------------------------------------------------------
// Cache memori + snapshot di Firestore (displayCache/{name}).
// Urutan: memori -> dokumen snapshot (1 read) -> loader() (bangun ulang).
// ----------------------------------------------------------------------------
function cachedPersistent(name, ttlMs, loader, keyFn = () => '') {
  let mem = null; // { builtAt, key, payload }
  let inflight = null;
  const fresh = (s, k) => s && s.key === k && Date.now() - s.builtAt < ttlMs;

  async function load(k) {
    try {
      const doc = await db.collection('displayCache').doc(name).get();
      if (doc.exists) {
        const d = doc.data();
        const s = { builtAt: d.builtAt, key: d.key, payload: JSON.parse(d.payload) };
        mem = s; // simpan walau basi: dipakai sebagai cadangan kalau bangun-ulang gagal
        if (fresh(s, k)) return s.payload;
      }
    } catch (e) {
      console.error(`Display: gagal baca snapshot ${name}:`, e.message);
    }
    const payload = await loader();
    mem = { builtAt: Date.now(), key: k, payload };
    try {
      await db.collection('displayCache').doc(name).set({
        builtAt: mem.builtAt, key: k, payload: JSON.stringify(payload)
      });
    } catch (e) {
      console.error(`Display: gagal simpan snapshot ${name}:`, e.message);
    }
    return payload;
  }

  return function get() {
    const k = keyFn();
    if (fresh(mem, k)) return Promise.resolve(mem.payload);
    if (!inflight) {
      inflight = load(k)
        .catch(err => {
          if (!mem) throw err;
          console.error(`Display: bangun ulang ${name} gagal, pakai data lama:`, err.message);
          mem = { ...mem, key: k, builtAt: Date.now() - ttlMs + 2 * MENIT };
          return mem.payload;
        })
        .finally(() => { inflight = null; });
    }
    return inflight;
  };
}

// Angkatan dari 2 digit awal NIM, konsisten dengan routes/admin/mahasiswa.js
function getAngkatanFromNim(nim) {
  if (nim && nim.length >= 2) return '20' + nim.substring(0, 2);
  return null;
}

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const hitung = async (query) => (await query.count().get()).data().count;

// ============================================================================
// TIER 1: DAFTAR MAHASISWA (seminggu sekali, ~300 read)
// Sumber nama/NIM/Dosen PA untuk slide & statistik distribusi mahasiswa.
// ============================================================================
const getMahasiswa = cachedPersistent('mahasiswa', TTL_MAHASISWA, async () => {
  const snap = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .select('nama', 'nim', 'dosenPaNama', 'statusMahasiswa', 'tahunYudisium')
    .get();
  return snap.docs.map(d => {
    const x = d.data();
    return {
      id: d.id, nama: x.nama || '', nim: x.nim || '', dosenPaNama: x.dosenPaNama || '',
      statusMahasiswa: x.statusMahasiswa || '', tahunYudisium: x.tahunYudisium || ''
    };
  });
});

// ============================================================================
// TIER 2: SLIDE FOTO MAGANG (8 jam, ~80 read)
// ============================================================================

// Progres magang versi hemat: 1 read (periode) + 1 count() - dulu membaca
// SEMUA logbook approved mahasiswa itu (puluhan dokumen). Catatan: ini
// menghitung jumlah logbook approved (bukan hari unik); dibatasi totalDays.
async function progressMagangRingan(userId, pdkId) {
  const nol = { uploadedDays: 0, totalDays: 0, percentage: 0 };
  try {
    const periodSnap = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', userId)
      .where('pdkId', '==', pdkId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (periodSnap.empty) return nol;
    const period = periodSnap.docs[0].data();
    const start = new Date(period.tanggalMulai);
    const end = period.tanggalSelesai ? new Date(period.tanggalSelesai) : new Date();
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const jumlah = await hitung(db.collection('logbookMagang')
      .where('userId', '==', userId)
      .where('pdkId', '==', pdkId)
      .where('status', '==', 'approved'));
    const uploadedDays = Math.min(jumlah, Math.max(totalDays, 0));
    const percentage = totalDays > 0 ? Math.min(100, Math.round((uploadedDays / totalDays) * 100)) : 0;
    return { uploadedDays, totalDays, percentage };
  } catch (e) {
    console.error('Display: progress magang gagal:', e.message);
    return nol;
  }
}

const getSlides = cachedPersistent('slides', TTL_SLIDES, async () => {
  const mahasiswaList = await getMahasiswa();
  const mhsMap = new Map(mahasiswaList.map(m => [m.id, m]));

  // Foto dari logbook approved TERBARU; satu mahasiswa dulu satu foto
  // terbarunya (mahasiswa diacak), sisa slide diisi foto lain.
  const logbookSnapshot = await db.collection('logbookMagang')
    .where('status', '==', 'approved')
    .orderBy('tanggal', 'desc')
    .limit(POOL_LOGBOOK)
    .select('userId', 'pdkId', 'imageUrls', 'kegiatan', 'tanggal', 'lokasi', 'perusahaan')
    .get();

  const fotoPerMahasiswa = new Map(); // userId -> [{data, url}] (terbaru dulu)
  for (const doc of logbookSnapshot.docs) {
    const data = { id: doc.id, ...doc.data() };
    if (!data.userId) continue;
    for (const url of (data.imageUrls || []).filter(Boolean)) {
      if (!fotoPerMahasiswa.has(data.userId)) fotoPerMahasiswa.set(data.userId, []);
      fotoPerMahasiswa.get(data.userId).push({ data, url });
    }
  }

  const daftarMhs = shuffle(Array.from(fotoPerMahasiswa.values()));
  const terpilih = daftarMhs.slice(0, MAX_SLIDES).map(list => list[0]);
  if (terpilih.length < MAX_SLIDES) {
    const sisa = [];
    for (const list of daftarMhs) sisa.push(...list.slice(1));
    sisa.sort((a, b) => String(b.data.tanggal || '').localeCompare(String(a.data.tanggal || '')));
    for (const item of sisa) {
      if (terpilih.length >= MAX_SLIDES) break;
      terpilih.push(item);
    }
    shuffle(terpilih);
  }

  // Mahasiswa baru yang belum ada di daftar mingguan: baca langsung (jarang terjadi)
  const hilang = [...new Set(terpilih.map(t => t.data.userId))].filter(id => !mhsMap.has(id));
  if (hilang.length > 0) {
    try {
      const snaps = await db.getAll(...hilang.map(id => db.collection('users').doc(id)),
        { fieldMask: ['nama', 'nim', 'dosenPaNama'] });
      snaps.forEach(s => { if (s.exists) mhsMap.set(s.id, { id: s.id, ...s.data() }); });
    } catch (e) { console.error('Display: gagal baca mahasiswa baru:', e.message); }
  }

  const progressPromises = new Map();
  const getProgress = (userId, pdkId) => {
    const k = `${userId}_${pdkId}`;
    if (!progressPromises.has(k)) progressPromises.set(k, progressMagangRingan(userId, pdkId));
    return progressPromises.get(k);
  };

  const slides = await Promise.all(terpilih.map(async ({ data, url }) => {
    const mhs = mhsMap.get(data.userId) || {};
    const progress = await getProgress(data.userId, data.pdkId);
    let imageUrl = url;
    if (imageUrl.includes('drive.google.com')) {
      const match = imageUrl.match(/id=([^&]+)/);
      if (match) imageUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
    return {
      imageUrl,
      caption: data.kegiatan || 'Kegiatan magang',
      mahasiswa: mhs.nama || 'Mahasiswa',
      nim: mhs.nim || '-',
      tanggal: data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID') : '-',
      lokasi: data.lokasi || '',
      perusahaan: data.perusahaan?.nama || '-',
      pembimbing: mhs.dosenPaNama || '-', // pembimbing magang = Dosen PA
      progressUploaded: progress.uploadedDays,
      progressTotal: progress.totalDays,
      progressPercent: progress.percentage
    };
  }));

  if (slides.length === 0) {
    slides.push({
      imageUrl: 'https://via.placeholder.com/800x600?text=Belum+Ada+Foto+Magang',
      caption: 'Belum ada foto magang yang disetujui',
      mahasiswa: '-', nim: '-', tanggal: '-', lokasi: '-', perusahaan: '-', pembimbing: '-',
      progressUploaded: 0, progressTotal: 0, progressPercent: 0
    });
  }
  return slides;
});

// ============================================================================
// TIER 3: INFO HARIAN (sekali per hari WITA, ~170 read)
// ============================================================================
const getInfo = cachedPersistent('info', TTL_INFO, async () => {
  const { now, hariIndex, tahun, tanggalISO } = waktuLokal();
  const mahasiswaList = await getMahasiswa();

  const [totalLogbook, tugasAktif, periodeAktif, jumlahMK, jumlahDosen, mkJadwalSnap, mkProgSnap] = await Promise.all([
    hitung(db.collection('logbookMagang')),
    hitung(db.collection('tugas').where('deadline', '>=', tanggalISO)),
    // Hitung periode aktif (bukan membaca ~puluhan dokumen untuk dedupe mahasiswa)
    hitung(db.collection('magangPeriod').where('status', '==', 'active')),
    hitung(db.collection('mataKuliah')),
    hitung(db.collection('dosen')),
    // Hanya MK yang punya jadwal (bukan seluruh koleksi)
    db.collection('mataKuliah').where('jadwal', '>', '').select('kode', 'nama', 'jadwal', 'dosenIds').get(),
    db.collection('mataKuliah').orderBy('updatedAt', 'desc').limit(5).get()
  ]);

  const mkJadwal = mkJadwalSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(mk => mk.jadwal && mk.jadwal.trim() !== '')
    .sort((a, b) => String(a.kode || '').localeCompare(String(b.kode || '')));

  // Nama dosen: hanya dosen yang mengampu MK berjadwal
  const dosenIds = [...new Set(mkJadwal.flatMap(mk => mk.dosenIds || []))];
  const dosenMap = {};
  if (dosenIds.length > 0) {
    const snaps = await db.getAll(...dosenIds.map(id => db.collection('dosen').doc(id)), { fieldMask: ['nama'] });
    snaps.forEach(s => { dosenMap[s.id] = (s.exists && s.data().nama) || 'Dosen'; });
  }
  const namaDosen = (mk) => (mk.dosenIds || []).map(id => dosenMap[id] || 'Unknown').join(', ') || '-';

  const jadwalKuliah = mkJadwal
    .map(mk => ({ kode: mk.kode, nama: mk.nama, jadwal: mk.jadwal, dosen: namaDosen(mk) }))
    .slice(0, 8);

  // Jadwal HARI INI (hari WITA) + angkatan dari enrollment (NIM dari daftar mingguan)
  const hariIniNama = HARI_LIST[hariIndex];
  const tanggalHariIniText = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ
  });
  const nimMap = {};
  mahasiswaList.forEach(m => { nimMap[m.id] = m.nim || ''; });

  const mkHariIni = mkJadwal
    .map(mk => ({ mk, jadwalParsed: parseJadwalText(mk.jadwal) }))
    .filter(x => x.jadwalParsed && x.jadwalParsed.hari === hariIniNama);

  const jadwalHariIni = await Promise.all(mkHariIni.map(async ({ mk, jadwalParsed }) => {
    let angkatanText = '-';
    try {
      const enrollSnapshot = await db.collection('enrollment')
        .where('mkId', '==', mk.id)
        .where('status', '==', 'active')
        .limit(LIMIT_ENROLLMENT_PER_MK)
        .select('userId')
        .get();
      const angkatanSet = new Set();
      enrollSnapshot.docs.forEach(e => {
        const angkatan = getAngkatanFromNim(nimMap[e.data().userId]);
        if (angkatan) angkatanSet.add(angkatan);
      });
      if (angkatanSet.size > 0) angkatanText = Array.from(angkatanSet).sort().join(', ');
    } catch (err) {
      console.error('Gagal menghitung angkatan untuk MK', mk.id, err.message);
    }
    return {
      jamMulai: jadwalParsed.jamMulai, jamSelesai: jadwalParsed.jamSelesai,
      ruangan: jadwalParsed.ruangan, kode: mk.kode, nama: mk.nama,
      dosen: namaDosen(mk), angkatan: angkatanText
    };
  }));
  jadwalHariIni.sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

  const mkProgress = mkProgSnap.docs.map(doc => {
    const data = doc.data();
    const terlaksana = (data.materi || []).filter(m => m.status === 'selesai').length;
    return { kode: data.kode, nama: data.nama, persen: Math.round((terlaksana / 16) * 100) };
  });

  // Distribusi mahasiswa dari daftar mingguan (0 read tambahan)
  const statusCount = { Aktif: 0, Cuti: 0, Keluar: 0, Lulus: 0 };
  const perAngkatanMap = {};
  let lulusTahunIni = 0;
  mahasiswaList.forEach(m => {
    const st = String(m.statusMahasiswa || 'Aktif').trim().toLowerCase();
    const key = ['Cuti', 'Keluar', 'Lulus'].find(k => k.toLowerCase() === st) || 'Aktif';
    statusCount[key] += 1;
    if (key === 'Aktif') {
      const ang = getAngkatanFromNim(m.nim);
      if (ang) perAngkatanMap[ang] = (perAngkatanMap[ang] || 0) + 1;
    }
    if (key === 'Lulus' && Number(m.tahunYudisium) === tahun) lulusTahunIni += 1;
  });
  const perAngkatan = Object.entries(perAngkatanMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(([angkatan, jumlah]) => ({ angkatan, jumlah }));

  return {
    stats: { totalLogbook, logbookPending: 0, totalMahasiswaMagangAktif: periodeAktif, tugasAktif },
    jumlahMahasiswa: mahasiswaList.length, jumlahDosen, jumlahMK,
    jadwalKuliah, hariIniNama, tanggalHariIniText, jadwalHariIni, mkProgress,
    statusCount, perAngkatan, lulusTahunIni, tahunIni: tahun
  };
}, hariKey);

// ============================================================================
// TIER 4: BERITA & JADWAL PENTING (6 jam, ~10 read)
// ============================================================================
const getNews = cachedPersistent('news', TTL_NEWS, async () => {
  const { tanggalISO } = waktuLokal();
  const [beritaSnapshot, jadwalSnapshot] = await Promise.all([
    db.collection('berita').orderBy('tanggal', 'desc').limit(5).select('judul', 'tanggal').get(),
    db.collection('jadwalPenting').where('tanggal', '>=', tanggalISO).orderBy('tanggal', 'asc').limit(5).get()
  ]);
  return {
    beritaTerbaru: beritaSnapshot.docs.map(doc => ({
      id: doc.id, judul: doc.data().judul, tanggal: doc.data().tanggal
    })),
    jadwalPenting: jadwalSnapshot.docs.map(doc => ({
      id: doc.id, judul: doc.data().judul, tanggal: doc.data().tanggal,
      kategori: doc.data().kategori || 'umum'
    }))
  };
}, hariKey);

// ============================================================================
// TIER 5: ANTRIAN TINDAKAN ADMIN (20 menit, 9 read/refresh, hanya jam kerja)
// Hanya memori (tanpa snapshot): tiap restart paling banyak 9 read.
// Di luar jam kerja, angka terakhir dipertahankan tanpa query baru.
// ============================================================================
async function hitungAman(query) {
  try { return await hitung(query); }
  catch (e) { console.error('Display: count gagal:', e.message); return null; }
}

const getAntrianAdmin = cachedMemory(TTL_ANTRIAN, async () => {
  const [krs, surat, suratDosen, logbook, laporan, seminar, kunjungan, peminjaman, pmb] = await Promise.all([
    hitungAman(db.collection('krs').where('status', '==', 'pending')),
    hitungAman(db.collection('surat').where('status', '==', 'pending')),
    hitungAman(db.collection('surat_dosen').where('status', '==', 'pending')),
    hitungAman(db.collection('logbookMagang').where('status', '==', 'pending')),
    hitungAman(db.collection('laporanMagang').where('status', '==', 'submitted')),
    hitungAman(db.collection('permohonanMagang').where('status', '==', 'pending')),
    hitungAman(db.collection('kunjunganIndustri').where('status', '==', 'diajukan')),
    hitungAman(db.collection('peminjamanAlat').where('status', 'in', ['diajukan', 'menunggu_verifikasi_kembali'])),
    hitungAman(db.collection('pmb_pendaftaran').where('status', '==', 'pending'))
  ]);
  const data = { krs, surat, suratDosen, logbook, laporan, seminar, kunjungan, peminjaman, pmb };
  data.total = Object.values(data).reduce((a, v) => a + (v || 0), 0);
  data.diperbaruiPada = new Date().toISOString();
  return data;
}, () => !jamKerja());

// Dipanggil layar TV berkala (jam kerja) supaya angka antrian terbaru tanpa reload
router.get('/antrian.json', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getAntrianAdmin());
  } catch (e) {
    res.status(500).json({ error: 'gagal' });
  }
});

router.get('/', async (req, res) => {
  try {
    const [slides, info, news, antrian] = await Promise.all([
      getSlides(), getInfo(), getNews(), getAntrianAdmin()
    ]);
    res.render('display/display', {
      title: 'Display Admin - Teknik Elektronika',
      slides,
      antrian,
      ...info,
      ...news,
      // logbook pending diambil dari antrian (sudah dihitung, tanpa query ekstra)
      stats: { ...info.stats, logbookPending: antrian.logbook || 0 }
    });
  } catch (error) {
    console.error('Error display TV:', error);
    res.status(500).send('Gagal memuat tampilan TV');
  }
});

module.exports = router;
