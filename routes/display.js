const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { getProgressMagangHarian } = require('../helpers/magangHelper');
const { getAllMahasiswa, dosenCache, mataKuliahCache } = require('../helpers/cache');
const { HARI_LIST, parseJadwalText } = require('../helpers/jadwalHelper');

// Angkatan dari 2 digit awal NIM, konsisten dengan routes/admin/mahasiswa.js
function getAngkatanFromNim(nim) {
  if (nim && nim.length >= 2) return '20' + nim.substring(0, 2);
  return null;
}

// Cache dengan TTL (50 menit)
const cache = {
  mahasiswa: new Map(),
  pembimbing: new Map(),
  stats: null,
  statsExpiry: 0
};
const TTL = 50 * 60 * 1000; // 50 menit

function setCache(map, key, value) {
  map.set(key, value);
  setTimeout(() => map.delete(key), TTL);
}

async function getMahasiswaInfo(userId) {
  if (cache.mahasiswa.has(userId)) return cache.mahasiswa.get(userId);
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const info = {
      nama: userDoc.exists ? userDoc.data().nama : 'Mahasiswa',
      nim: userDoc.exists ? userDoc.data().nim : '-'
    };
    setCache(cache.mahasiswa, userId, info);
    return info;
  } catch {
    return { nama: 'Mahasiswa', nim: '-' };
  }
}

// Pembimbing magang = Dosen PA mahasiswa (users.dosenPaNama) - Pembimbing 1 & 2 ditiadakan.
async function getPembimbingMahasiswa(mahasiswaId) {
  if (cache.pembimbing.has(mahasiswaId)) return cache.pembimbing.get(mahasiswaId);
  try {
    const doc = await db.collection('users').doc(mahasiswaId).get();
    const pembimbing = (doc.exists && doc.data().dosenPaNama) || '-';
    const result = { pembimbing };
    setCache(cache.pembimbing, mahasiswaId, result);
    return result;
  } catch {
    return { pembimbing: '-' };
  }
}

// Progress magang sekarang dihitung lewat helpers/magangHelper.js
// (getProgressMagangHarian, sudah punya cache sendiri) supaya tidak ada
// logika yang terduplikasi/berpotensi drift dari versi di routes/landing.js.

async function getStatistikProdi() {
  const now = Date.now();
  if (cache.stats && now < cache.statsExpiry) return cache.stats;
  try {
    // Sebelumnya pakai .get() untuk kedua query ini padahal cuma butuh
    // .size (jumlahnya saja) - itu artinya SETIAP dokumen di collection
    // logbookMagang ikut TERBACA (kena biaya 1 read per dokumen), padahal
    // isinya tidak pernah dipakai. .count() adalah query agregasi Firestore
    // yang dihitung di server tanpa mengunduh isi dokumen - jauh lebih murah
    // (total collection sekalipun jutaan dokumen, tetap sangat ringan).
    const [allLogbookCount, pendingLogbookCount, activePeriods, tugasSnapshot] = await Promise.all([
      db.collection('logbookMagang').count().get(),
      db.collection('logbookMagang').where('status', '==', 'pending').count().get(),
      db.collection('magangPeriod').where('status', '==', 'active').get(),
      db.collection('tugas').where('deadline', '>=', new Date().toISOString().split('T')[0]).get()
    ]);
    const activeMahasiswaIds = new Set();
    activePeriods.docs.forEach(doc => activeMahasiswaIds.add(doc.data().mahasiswaId));
    const stats = {
      totalLogbook: allLogbookCount.data().count,
      logbookPending: pendingLogbookCount.data().count,
      totalMahasiswaMagangAktif: activeMahasiswaIds.size,
      tugasAktif: tugasSnapshot.size
    };
    cache.stats = stats;
    cache.statsExpiry = now + TTL;
    return stats;
  } catch (error) {
    console.error('Error getStatistikProdi:', error);
    return { totalLogbook: 0, logbookPending: 0, totalMahasiswaMagangAktif: 0, tugasAktif: 0 };
  }
}

// ============================================================================
// ANTRIAN TINDAKAN ADMIN - jumlah pekerjaan yang menunggu diproses admin.
// Hanya ANGKA (count() agregasi, tanpa membaca dokumen & tanpa data pribadi),
// di-cache 60 detik. Nilai null = query gagal (ditampilkan "-" di layar).
// ============================================================================
async function hitungAman(query) {
  try {
    return (await query.count().get()).data().count;
  } catch (e) {
    console.error('Display: count gagal:', e.message);
    return null;
  }
}

async function getAntrianAdmin() {
  const now = Date.now();
  if (cache.antrian && now < cache.antrianExpiry) return cache.antrian;
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
  cache.antrian = data;
  cache.antrianExpiry = now + 60 * 1000;
  return data;
}

// Dipanggil layar TV tiap 1 menit supaya angka antrian selalu terbaru tanpa reload halaman
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
    // ========== DATA LOGBOOK MAGANG ==========
    // Aturan: foto dari logbook approved TERBARU (urut tanggal desc langsung di query,
    // bukan limit sembarang lalu di-sort), satu mahasiswa dulu satu foto terbarunya,
    // urutan mahasiswa diacak tiap halaman dimuat. Sisa slide diisi foto lain.
    const MAX_SLIDES = 15;
    const POOL_LOGBOOK = 300;

    const logbookSnapshot = await db.collection('logbookMagang')
      .where('status', '==', 'approved')
      .orderBy('tanggal', 'desc')
      .limit(POOL_LOGBOOK)
      .get();

    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // userId -> [{data, url}] (terbaru dulu)
    const fotoPerMahasiswa = new Map();
    for (const doc of logbookSnapshot.docs) {
      const data = { id: doc.id, ...doc.data() };
      if (!data.userId) continue;
      for (const url of (data.imageUrls || []).filter(Boolean)) {
        if (!fotoPerMahasiswa.has(data.userId)) fotoPerMahasiswa.set(data.userId, []);
        fotoPerMahasiswa.get(data.userId).push({ data, url });
      }
    }

    // Tahap 1: foto terbaru tiap mahasiswa, mahasiswa diacak
    const daftarMhs = shuffle(Array.from(fotoPerMahasiswa.values()));
    const terpilih = daftarMhs.slice(0, MAX_SLIDES).map(list => list[0]);

    // Tahap 2: kalau belum penuh, isi foto lain (terbaru dulu), lalu acak lagi
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

    const progressCache = new Map();
    const slides = await Promise.all(terpilih.map(async ({ data, url }) => {
      const [{ nama, nim }, { pembimbing }] = await Promise.all([
        getMahasiswaInfo(data.userId),
        getPembimbingMahasiswa(data.userId)
      ]);

      const progressKey = `${data.userId}_${data.pdkId}`;
      if (!progressCache.has(progressKey)) {
        progressCache.set(progressKey, (async () => {
          try { return await getProgressMagangHarian(data.userId, data.pdkId); }
          catch (e) { return { uploadedDays: 0, totalDays: 0, percentage: 0 }; }
        })());
      }
      const progress = await progressCache.get(progressKey);

      let imageUrl = url;
      if (imageUrl.includes('drive.google.com')) {
        const match = imageUrl.match(/id=([^&]+)/);
        if (match) imageUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
      }
      return {
        imageUrl,
        caption: data.kegiatan || 'Kegiatan magang',
        mahasiswa: nama,
        nim: nim,
        tanggal: data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID') : '-',
        lokasi: data.lokasi || '',
        perusahaan: data.perusahaan?.nama || '-',
        pembimbing,
        progressUploaded: progress.uploadedDays,
        progressTotal: progress.totalDays,
        progressPercent: progress.percentage
      };
    }));

    if (slides.length === 0) {
      slides.push({
        imageUrl: 'https://via.placeholder.com/800x600?text=Belum+Ada+Foto+Magang',
        caption: 'Belum ada foto magang yang disetujui',
        mahasiswa: '-',
        nim: '-',
        tanggal: '-',
        lokasi: '-',
        perusahaan: '-',
        pembimbing: '-',
        progressUploaded: 0,
        progressTotal: 0,
        progressPercent: 0
      });
    }

    const stats = await getStatistikProdi();

    // ========== DATA TAMBAHAN UNTUK TV ==========
    // Berita terbaru
    const beritaSnapshot = await db.collection('berita').orderBy('tanggal', 'desc').limit(5).get();
    const beritaTerbaru = beritaSnapshot.docs.map(doc => ({
      id: doc.id,
      judul: doc.data().judul,
      tanggal: doc.data().tanggal
    }));

    // Jadwal penting mendatang
    const today = new Date().toISOString().split('T')[0];
    const jadwalSnapshot = await db.collection('jadwalPenting')
      .where('tanggal', '>=', today)
      .orderBy('tanggal', 'asc')
      .limit(5)
      .get();
    const jadwalPenting = jadwalSnapshot.docs.map(doc => ({
      id: doc.id,
      judul: doc.data().judul,
      tanggal: doc.data().tanggal,
      kategori: doc.data().kategori || 'umum'
    }));

    // Statistik umum prodi
    const mahasiswaList = await getAllMahasiswa(db);
    const jumlahMahasiswa = mahasiswaList.length;
    // Peta userId -> NIM, dipakai untuk menghitung angkatan tanpa query berulang
    const nimMap = {};
    mahasiswaList.forEach(data => { nimMap[data.id] = data.nim || ''; });

    // Ambil semua dosen sekali saja, dipakai untuk hitung jumlah & memetakan nama dosen pengampu
    // (di-cache 10 menit - dosenCache sudah dipakai di tempat lain untuk lookup
    // per-id, di sini kita tambah key 'all' untuk daftar lengkapnya)
    const dosenList = await dosenCache.getOrFetch('all', async () => {
      const snap = await db.collection('dosen').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    const jumlahDosen = dosenList.length;
    const dosenMap = {};
    dosenList.forEach(data => { dosenMap[data.id] = data.nama || 'Dosen'; });

    // Ambil semua mata kuliah sekali saja, dipakai untuk jumlah MK & jadwal perkuliahan
    const mkAllList = await mataKuliahCache.getOrFetch('all', async () => {
      const snap = await db.collection('mataKuliah').orderBy('kode').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
    const jumlahMK = mkAllList.length;

    // Jadwal perkuliahan dosen - daftar lengkap (diisi lewat menu Kelola Mata Kuliah > field "Jadwal")
    const jadwalKuliah = mkAllList
      .filter(mk => mk.jadwal && mk.jadwal.trim() !== '')
      .map(mk => ({
        kode: mk.kode,
        nama: mk.nama,
        jadwal: mk.jadwal,
        dosen: (mk.dosenIds || []).map(id => dosenMap[id] || 'Unknown').join(', ') || '-'
      }))
      .slice(0, 8);

    // Jadwal HARI INI - filter MK yang jadwalnya jatuh pada hari ini, lengkap dengan
    // angkatan mahasiswa pengontrak (dihitung dari NIM lewat data enrollment aktif)
    const now = new Date();
    const hariIniNama = HARI_LIST[now.getDay()];
    const tanggalHariIniText = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const mkHariIni = mkAllList
      .map(mk => ({ mk, jadwalParsed: parseJadwalText(mk.jadwal) }))
      .filter(x => x.jadwalParsed && x.jadwalParsed.hari === hariIniNama);

    const jadwalHariIni = [];
    for (const { mk, jadwalParsed } of mkHariIni) {
      let angkatanText = '-';
      try {
        const enrollSnapshot = await db.collection('enrollment')
          .where('mkId', '==', mk.id)
          .where('status', '==', 'active')
          .limit(60)
          .get();
        const angkatanSet = new Set();
        enrollSnapshot.docs.forEach(e => {
          const angkatan = getAngkatanFromNim(nimMap[e.data().userId]);
          if (angkatan) angkatanSet.add(angkatan);
        });
        if (angkatanSet.size > 0) angkatanText = Array.from(angkatanSet).sort().join(', ');
      } catch (err) {
        console.error('Gagal menghitung angkatan untuk MK', mk.id, err);
      }

      jadwalHariIni.push({
        jamMulai: jadwalParsed.jamMulai,
        jamSelesai: jadwalParsed.jamSelesai,
        ruangan: jadwalParsed.ruangan,
        kode: mk.kode,
        nama: mk.nama,
        dosen: (mk.dosenIds || []).map(id => dosenMap[id] || 'Unknown').join(', ') || '-',
        angkatan: angkatanText
      });
    }
    jadwalHariIni.sort((a, b) => a.jamMulai.localeCompare(b.jamMulai));

    // Progress perkuliahan (5 MK dengan progress terbaru)
    const mkSnapshot = await db.collection('mataKuliah')
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();
    const mkProgress = mkSnapshot.docs.map(doc => {
      const data = doc.data();
      const materi = data.materi || [];
      const terlaksana = materi.filter(m => m.status === 'selesai').length;
      const persen = Math.round((terlaksana / 16) * 100);
      return {
        kode: data.kode,
        nama: data.nama,
        persen
      };
    });

    // ========== ANTRIAN TINDAKAN & DISTRIBUSI MAHASISWA (untuk display admin) ==========
    const antrian = await getAntrianAdmin();

    const statusCount = { Aktif: 0, Cuti: 0, Keluar: 0, Lulus: 0 };
    const perAngkatanMap = {};
    const tahunIni = new Date().getFullYear();
    let lulusTahunIni = 0;
    mahasiswaList.forEach(m => {
      const st = String(m.statusMahasiswa || 'Aktif').trim().toLowerCase();
      const key = ['Cuti', 'Keluar', 'Lulus'].find(k => k.toLowerCase() === st) || 'Aktif';
      statusCount[key] += 1;
      if (key === 'Aktif') {
        const ang = getAngkatanFromNim(m.nim);
        if (ang) perAngkatanMap[ang] = (perAngkatanMap[ang] || 0) + 1;
      }
      if (key === 'Lulus' && Number(m.tahunYudisium) === tahunIni) lulusTahunIni += 1;
    });
    const perAngkatan = Object.entries(perAngkatanMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .map(([angkatan, jumlah]) => ({ angkatan, jumlah }));

    res.render('display/display', {
      title: 'Display Admin - Teknik Elektronika',
      slides,
      stats,
      antrian,
      statusCount,
      perAngkatan,
      lulusTahunIni,
      tahunIni,
      beritaTerbaru,
      jadwalPenting,
      jumlahMahasiswa,
      jumlahDosen,
      jumlahMK,
      jadwalKuliah,
      hariIniNama,
      tanggalHariIniText,
      jadwalHariIni,
      mkProgress
    });
  } catch (error) {
    console.error('Error display TV:', error);
    res.status(500).send('Gagal memuat tampilan TV');
  }
});

module.exports = router;