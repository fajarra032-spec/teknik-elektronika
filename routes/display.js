const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const { getProgressMagangHarian } = require('../helpers/magangHelper');
const { getAllMahasiswa, dosenCache, mataKuliahCache } = require('../helpers/cache');

// Nama hari, index harus sama dengan Date.getDay() (0=Minggu ... 6=Sabtu)
const HARI_LIST = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

// Angkatan dari 2 digit awal NIM, konsisten dengan routes/admin/mahasiswa.js
function getAngkatanFromNim(nim) {
  if (nim && nim.length >= 2) return '20' + nim.substring(0, 2);
  return null;
}

// Best-effort parse teks jadwal bebas isian admin, contoh: "Senin 08:00-10:30, Ruang A101"
function parseJadwalText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const hari = HARI_LIST.find(h => lower.includes(h.toLowerCase()));
  const jamMatch = text.match(/(\d{1,2}[.:]\d{2})\s*-\s*(\d{1,2}[.:]\d{2})/);
  if (!hari || !jamMatch) return null;
  const ruangMatch = text.match(/ruang\s*\S+/i);
  return {
    hari,
    jamMulai: jamMatch[1].replace('.', ':'),
    jamSelesai: jamMatch[2].replace('.', ':'),
    ruangan: ruangMatch ? ruangMatch[0] : ''
  };
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

async function getPembimbingMahasiswa(mahasiswaId) {
  if (cache.pembimbing.has(mahasiswaId)) return cache.pembimbing.get(mahasiswaId);
  try {
    const snapshot = await db.collection('bimbingan')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    let pembimbing1 = '-', pembimbing2 = '-';
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      pembimbing1 = data.pembimbing1Nama || '-';
      pembimbing2 = data.pembimbing2Nama || '-';
    }
    const result = { pembimbing1, pembimbing2 };
    setCache(cache.pembimbing, mahasiswaId, result);
    return result;
  } catch {
    return { pembimbing1: '-', pembimbing2: '-' };
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

router.get('/', async (req, res) => {
  try {
    // ========== DATA LOGBOOK MAGANG ==========
    const logbookSnapshot = await db.collection('logbookMagang')
      .where('status', '==', 'approved')
      .limit(30)
      .get();

    let logs = logbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logs.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

    const slides = [];
    for (const data of logs) {
      const imageUrls = data.imageUrls || [];
      if (imageUrls.length === 0) continue;
      const { nama, nim } = await getMahasiswaInfo(data.userId);
      const { pembimbing1, pembimbing2 } = await getPembimbingMahasiswa(data.userId);
      const progress = await getProgressMagangHarian(data.userId, data.pdkId);
      for (const rawUrl of imageUrls) {
        let imageUrl = rawUrl;
        if (imageUrl.includes('drive.google.com')) {
          const match = imageUrl.match(/id=([^&]+)/);
          if (match) imageUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
        }
        slides.push({
          imageUrl,
          caption: data.kegiatan || 'Kegiatan magang',
          mahasiswa: nama,
          nim: nim,
          tanggal: data.tanggal ? new Date(data.tanggal).toLocaleDateString('id-ID') : '-',
          lokasi: data.lokasi || '',
          perusahaan: data.perusahaan?.nama || '-',
          pembimbing1,
          pembimbing2,
          progressUploaded: progress.uploadedDays,
          progressTotal: progress.totalDays,
          progressPercent: progress.percentage
        });
      }
    }

    if (slides.length === 0) {
      slides.push({
        imageUrl: 'https://via.placeholder.com/800x600?text=Belum+Ada+Foto+Magang',
        caption: 'Belum ada foto magang yang disetujui',
        mahasiswa: '-',
        nim: '-',
        tanggal: '-',
        lokasi: '-',
        perusahaan: '-',
        pembimbing1: '-',
        pembimbing2: '-',
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

    res.render('display/display', {
      title: 'TV Prodi - Dashboard Informasi',
      slides,
      stats,
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