/**
 * routes/landing.js
 * Halaman utama publik (landing page) dan halaman publik lainnya
 */

const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getProgressMagangHarian } = require('../helpers/magangHelper');
const { getGabunganLulusan, normalisasiStatus } = require('../helpers/lulusanHelper');
const { getAllMahasiswa } = require('../helpers/cache');

// ============================================================================
// FUNGSI BANTU
// ============================================================================
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Mendapatkan angkatan (tahun masuk) dari NIM, mengikuti pola yang sama
// dipakai di routes/admin (mahasiswa_list.js, khs.js, berkas.js, dst):
// 2 digit pertama NIM = 2 digit terakhir tahun masuk, contoh "23..." -> "2023".
function getAngkatanFromNim(nim) {
  if (!nim || String(nim).length < 2) return null;
  return '20' + String(nim).substring(0, 2);
}

// ============================================================================
// HALAMAN UTAMA (LANDING PAGE)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    // 1. Statistik prodi
    const statistikDoc = await db.collection('statistik').doc('data').get();
    const statistik = statistikDoc.exists ? statistikDoc.data() : {
      mahasiswaAktif: 0,
      mahasiswaMagang: 0,
      angkatan: []
    };

    const mahasiswaList = await getAllMahasiswa(db);
    let aktifCount = 0;
    let magangCount = 0;
    // Hitung sebaran angkatan LANGSUNG dari data mahasiswa asli (via NIM),
    // supaya grafik "Sebaran Mahasiswa per Angkatan" selalu akurat dan tidak
    // bergantung pada input manual admin di dokumen statistik/data.
    const angkatanCount = {};
    mahasiswaList.forEach(data => {
      if (data.statusMahasiswa === 'Aktif' || data.status === 'aktif') aktifCount++;
      if (data.statusMagang && (data.statusMagang.includes('Magang') || data.statusMagang === 'Selesai Magang')) magangCount++;

      const angkatanMhs = getAngkatanFromNim(data.nim);
      if (angkatanMhs) {
        angkatanCount[angkatanMhs] = (angkatanCount[angkatanMhs] || 0) + 1;
      }
    });
    statistik.mahasiswaAktif = aktifCount;
    // Timpa data angkatan manual (jika ada) dengan hasil hitung otomatis dari
    // data mahasiswa yang sebenarnya, diurutkan dari angkatan terlama.
    statistik.angkatan = Object.keys(angkatanCount)
      .sort()
      .map(tahun => ({ tahun, jumlah: angkatanCount[tahun] }));
    statistik.mahasiswaMagang = magangCount;
    // Sama seperti logbookMagang - cuma butuh jumlahnya, jadi pakai count()
    // (agregasi Firestore) alih-alih .get() yang membaca semua dokumen dosen.
    const dosenCountSnap = await db.collection('dosen').count().get();
    const jumlahDosen = dosenCountSnap.data().count;

    // 2. Berita terbaru (dibatasi 4 untuk landing page; semua berita bisa
    // dilihat di halaman khusus /berita)
    const beritaSnapshot = await db.collection('berita')
      .orderBy('tanggal', 'desc')
      .limit(4)
      .get();
    const berita = beritaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Jadwal penting - HANYA kategori yang boleh tampil ke publik (rapat &
    // seminar). Kategori lain (libur, pendaftaran, umum, dll) tetap dikelola
    // di /admin/jadwalpenting dan tetap muncul di kalender akademik internal
    // dosen/mahasiswa, tapi tidak untuk publik.
    //
    // Catatan: sengaja TIDAK difilter berdasarkan tanggal (beda dengan widget
    // "agenda mendatang" di dashboard dosen/mahasiswa yang hanya menampilkan
    // yang akan datang). Di landing page, jadwal yang sudah lewat tetap
    // ditampilkan sebagai arsip sampai admin menghapusnya sendiri.
    let jadwal;
    try {
      const jadwalSnapshot = await db.collection('jadwalPenting')
        .where('kategori', 'in', ['rapat', 'seminar'])
        .orderBy('tanggal', 'desc')
        .limit(20)
        .get();
      jadwal = jadwalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (indexError) {
      // Index composite (kategori, tanggal) belum siap di Firestore - mundur
      // ke query aman lalu saring kategori di JS, supaya beranda publik tidak crash.
      console.error('Index jadwalPenting(kategori,tanggal) belum siap, fallback:', indexError.message);
      const semuaSnapshot = await db.collection('jadwalPenting')
        .orderBy('tanggal', 'desc')
        .get();
      jadwal = semuaSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.kategori === 'rapat' || item.kategori === 'seminar')
        .slice(0, 20);
    }

    // 4. Jadwal seminar - HANYA yang mendatang (tanggal >= hari ini), sesuai
    // label "Seminar Mendatang" di card statistik. Ditampilkan maksimal 5 di
    // landing page, tapi angka pada card statistik memakai jumlah total yang
    // sebenarnya (seminarMendatangCount), bukan cuma yang ke-limit 5.
    const today = new Date().toISOString().split('T')[0];
    const seminarSnapshot = await db.collection('seminar')
      .where('tanggal', '>=', today)
      .orderBy('tanggal', 'asc')
      .get();
    const seminarMendatang = seminarSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const seminarMendatangCount = seminarMendatang.length;
    const seminar = seminarMendatang.slice(0, 5);

    // 5. Lulusan (tracer study yang disetujui)
    let lulusan = [];
    try {
      const lulusanSnapshot = await db.collection('tracerStudy')
        .where('isPublic', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(6)
        .get();
      lulusan = lulusanSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('TracerStudy tidak dapat diambil:', err.message);
    }

    // 6. Aktivitas prodi
    let aktivitas = [];
    try {
      const aktivitasSnapshot = await db.collection('aktivitas')
        .orderBy('tanggal', 'desc')
        .limit(4)
        .get();
      aktivitas = aktivitasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Aktivitas tidak dapat diambil:', err.message);
    }

    // 7. Dosen pengajar (4 dosen)
    let dosenList = [];
    try {
      const dosenSnapshot = await db.collection('dosen').limit(4).get();
      dosenList = dosenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Gagal mengambil data dosen:', err.message);
    }

    // 8. Lulusan yang bekerja
    let lulusanKerja = [];
    try {
      const kerjaSnapshot = await db.collection('tracerStudy')
        .where('statusPekerjaan', '==', 'bekerja')
        .limit(4)
        .get();
      lulusanKerja = kerjaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Gagal mengambil data lulusan bekerja:', err.message);
      try {
        const kerjaSnapshot = await db.collection('tracerStudy')
          .where('pekerjaan', '!=', null)
          .limit(4)
          .get();
        lulusanKerja = kerjaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.warn('Alternatif gagal:', e.message);
      }
    }

    // 8b. Testimoni Alumni - dikelola admin di /admin/testimoni (sebelumnya
    // hardcode 3 testimoni tetap di index.ejs). Hanya yang aktif=true yang
    // ditampilkan di landing, diurutkan sesuai field "urutan".
    let testimoniAlumni = [];
    try {
      const testimoniSnapshot = await db.collection('testimoniAlumni')
        .where('aktif', '==', true)
        .orderBy('urutan', 'asc')
        .limit(6)
        .get();
      testimoniAlumni = testimoniSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Gagal mengambil testimoni alumni:', err.message);
    }

    // 8c. Video Konten - dikelola admin di /admin/video-konten (sebelumnya
    // 4 video hardcode di index.ejs, mengarah ke file lokal /videos/*.mp4).
    let videoKonten = [];
    try {
      const videoSnapshot = await db.collection('videoKonten')
        .where('aktif', '==', true)
        .orderBy('urutan', 'asc')
        .limit(8)
        .get();
      videoKonten = videoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn('Gagal mengambil video konten:', err.message);
    }

    // ============ 9. DOKUMENTASI MAGANG UNTUK CAROUSEL ============
    let magangSlides = [];
    try {
      const logbookSnapshot = await db.collection('logbookMagang')
        .where('status', '==', 'approved')
        .orderBy('tanggal', 'desc')
        .limit(20)
        .get();

      const logs = logbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const mahasiswaCache = new Map();
      const perusahaanCache = new Map();
      const progressCache = new Map();

      for (const log of logs) {
        const imageUrls = log.imageUrls || [];
        if (imageUrls.length === 0) continue;

        let mahasiswaInfo = mahasiswaCache.get(log.userId);
        if (!mahasiswaInfo) {
          const userDoc = await db.collection('users').doc(log.userId).get();
          mahasiswaInfo = {
            nama: userDoc.exists ? userDoc.data().nama : 'Mahasiswa',
            nim: userDoc.exists ? userDoc.data().nim : '-'
          };
          mahasiswaCache.set(log.userId, mahasiswaInfo);
        }

        let perusahaan = log.perusahaan?.nama || '-';
        if (perusahaan === '-' && log.perusahaanId) {
          if (perusahaanCache.has(log.perusahaanId)) {
            perusahaan = perusahaanCache.get(log.perusahaanId);
          } else {
            try {
              const perusahaanDoc = await db.collection('perusahaan').doc(log.perusahaanId).get();
              perusahaan = perusahaanDoc.exists ? perusahaanDoc.data().nama : '-';
              perusahaanCache.set(log.perusahaanId, perusahaan);
            } catch (e) { perusahaan = '-'; }
          }
        }

        const progressKey = `${log.userId}_${log.pdkId}`;
        let progress = progressCache.get(progressKey);
        if (!progress) {
          progress = await getProgressMagangHarian(log.userId, log.pdkId);
          progressCache.set(progressKey, progress);
        }

        for (const rawUrl of imageUrls) {
          let imageUrl = rawUrl;
          if (imageUrl.includes('drive.google.com')) {
            const match = imageUrl.match(/id=([^&]+)/);
            if (match) imageUrl = `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
          }
          magangSlides.push({
            imageUrl,
            caption: log.kegiatan || 'Aktivitas magang',
            mahasiswa: mahasiswaInfo.nama,
            nim: mahasiswaInfo.nim,
            tanggal: log.tanggal ? new Date(log.tanggal).toLocaleDateString('id-ID') : '-',
            perusahaan: perusahaan,
            progressUploaded: progress.uploadedDays,
            progressTotal: progress.totalDays,
            progressPercent: progress.percentage
          });
          if (magangSlides.length >= 12) break;
        }
        if (magangSlides.length >= 12) break;
      }

      if (magangSlides.length === 0) {
        magangSlides.push({
          imageUrl: 'https://via.placeholder.com/1200x600?text=Belum+Ada+Dokumentasi+Magang',
          caption: 'Belum ada foto magang yang disetujui',
          mahasiswa: '-',
          nim: '-',
          tanggal: '-',
          perusahaan: '-',
          progressUploaded: 0,
          progressTotal: 0,
          progressPercent: 0
        });
      }
    } catch (err) {
      console.warn('Gagal mengambil dokumentasi magang:', err.message);
      magangSlides = [{
        imageUrl: 'https://via.placeholder.com/1200x600?text=Error+Load+Data',
        caption: 'Gagal memuat data magang',
        mahasiswa: '-',
        nim: '-',
        tanggal: '-',
        perusahaan: '-',
        progressUploaded: 0,
        progressTotal: 0,
        progressPercent: 0
      }];
    }

    // ============ RENDER VIEW ============
    res.render('landing/index', {
      title: 'Teknik Elektronika - Politeknik Dewantara',
      user: req.user || null,
      statistik,
      jumlahDosen,
      berita,
      jadwalPenting: jadwal,
      seminar,
      seminarMendatangCount,
      lulusan,
      aktivitas,
      dosenList,
      lulusanKerja,
      magangSlides,
      testimoniAlumni,
      videoKonten,
      formatDate
    });
  } catch (error) {
    console.error('Error landing page:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Terjadi kesalahan server'
    });
  }
});

// ============================================================================
// CEK MAHASISWA & DOSEN (GABUNGAN DENGAN TAB)
// ============================================================================
router.get('/cekmahasiswa', async (req, res) => {
  try {
    const { searchMahasiswa, searchDosen } = req.query;

    // Data Mahasiswa (disalin dgn slice() supaya .sort() di bawah tidak
    // mengubah array asli yang tersimpan di cache bersama)
    let mahasiswa = (await getAllMahasiswa(db)).slice();
    if (searchMahasiswa) {
      const keyword = searchMahasiswa.toLowerCase();
      mahasiswa = mahasiswa.filter(m =>
        (m.nim && m.nim.includes(keyword)) ||
        (m.nama && m.nama.toLowerCase().includes(keyword))
      );
    }
    mahasiswa.sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));

    // Data Dosen - pastikan field nuptk ada (ambil dari nip jika tidak ada)
    let dosen = [];
    const dosenSnapshot = await db.collection('dosen').get();
    dosen = dosenSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        nuptk: data.nuptk || data.nip || '-',   // <-- mapping nip ke nuptk
        nama: data.nama || '-',
        bidang: data.bidang || data.keahlian || '-',
        email: data.email || '-',
        ...data   // jika ada field lain, tetap disertakan
      };
    });
    if (searchDosen) {
      const keyword = searchDosen.toLowerCase();
      dosen = dosen.filter(d =>
        (d.nuptk && d.nuptk.includes(keyword)) ||
        (d.nama && d.nama.toLowerCase().includes(keyword))
      );
    }
    dosen.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));

    res.render('landing/cek_mahasiswa', {
      title: 'Data Mahasiswa & Dosen',
      mahasiswa,
      dosen,
      searchMahasiswa: searchMahasiswa || '',
      searchDosen: searchDosen || ''
    });
  } catch (error) {
    console.error('Error di /cekmahasiswa:', error);
    res.status(500).send('Terjadi kesalahan saat memuat data');
  }
});

// ============================================================================
// DETAIL MAHASISWA (PUBLIK)
// ============================================================================
router.get('/cekmahasiswa/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const userDoc = await db.collection('users').doc(id).get();
    if (!userDoc.exists || userDoc.data().role !== 'mahasiswa') {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data mahasiswa tidak ditemukan' });
    }
    const mahasiswa = { id: userDoc.id, ...userDoc.data() };

    // 5 logbook terbaru
    const logbookSnapshot = await db.collection('logbookMagang')
      .where('userId', '==', id)
      .orderBy('tanggal', 'desc')
      .limit(5)
      .get();
    const logbook = logbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Statistik semua logbook
    const allLogbook = await db.collection('logbookMagang')
      .where('userId', '==', id)
      .get();
    const stats = {
      total: allLogbook.size,
      approved: allLogbook.docs.filter(d => d.data().status === 'approved').length,
      pending: allLogbook.docs.filter(d => d.data().status === 'pending').length,
      rejected: allLogbook.docs.filter(d => d.data().status === 'rejected').length
    };
    // Ambil data tagihan mahasiswa dari koleksi 'tagihan'
let totalTagihanBelumLunas = 0;
const tagihanDoc = await db.collection('tagihan').doc(id).get();
if (tagihanDoc.exists) {
  const tagihanList = tagihanDoc.data().semester || [];
  totalTagihanBelumLunas = tagihanList
    .filter(t => t.status !== 'lunas')
    .reduce((sum, t) => sum + (t.jumlah || 0), 0);
}
    // Periode magang aktif
    const activePeriodSnap = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', id)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    const activePeriod = activePeriodSnap.empty ? null : { id: activePeriodSnap.docs[0].id, ...activePeriodSnap.docs[0].data() };

    // Mata kuliah yang diprogram (semester akademik berjalan)
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', id)
      .where('status', '==', 'active')
      .where('semester', '==', getCurrentAcademicSemester().label)
      .get();
    const mkList = [];
    for (const enrollDoc of enrollmentSnapshot.docs) {
      const enrollData = enrollDoc.data();
      const mkDoc = await db.collection('mataKuliah').doc(enrollData.mkId).get();
      if (mkDoc.exists && !mkDoc.data().isPDK) {
        mkList.push({
          id: mkDoc.id,
          kode: mkDoc.data().kode,
          nama: mkDoc.data().nama,
          sks: mkDoc.data().sks,
          semester: enrollData.semester
        });
      }
    }

res.render('landing/cek_mahasiswa_detail', {
  title: `Detail Mahasiswa - ${mahasiswa.nama}`,
  mahasiswa,
  logbook,
  stats,
  activePeriod,
  mkList,
  totalTagihanBelumLunas: totalTagihanBelumLunas  
});
  } catch (error) {
    console.error('Error detail mahasiswa:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail mahasiswa' });
  }
});

// ============================================================================
// DETAIL DOSEN (PUBLIK)
// ============================================================================
router.get('/cekdosen/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const dosenDoc = await db.collection('dosen').doc(id).get();
    if (!dosenDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data dosen tidak ditemukan' });
    }
    const data = dosenDoc.data();
    const dosen = {
      id: dosenDoc.id,
      nuptk: data.nuptk || data.nip || '-',
      nama: data.nama || '-',
      bidang: data.bidang || data.keahlian || '-',
      email: data.email || '-',
      foto: data.foto || null,
      pendidikan: data.pendidikan || '-',
      ...data
    };

    // Ambil mata kuliah yang diampu (jika ada field dosenIds di mataKuliah)
    let mkList = [];
    try {
      const mkSnapshot = await db.collection('mataKuliah')
        .where('dosenIds', 'array-contains', id)
        .get();
      mkList = mkSnapshot.docs.map(doc => ({ id: doc.id, kode: doc.data().kode, nama: doc.data().nama }));
    } catch (err) {
      console.warn('Gagal ambil mata kuliah yang diampu:', err.message);
    }

    res.render('landing/cek_dosen_detail', {
      title: `Detail Dosen - ${dosen.nama}`,
      dosen,
      mkList
    });
  } catch (error) {
    console.error('Error detail dosen:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail dosen' });
  }
});

// ============================================================================
// AKTIVITAS PRODI
// ============================================================================
router.get('/aktivitas', async (req, res) => {
  try {
    const { kategori } = req.query;
    let query = db.collection('aktivitas').orderBy('tanggal', 'desc');
    if (kategori && kategori !== 'semua') {
      query = query.where('kategori', '==', kategori);
    }
    const snapshot = await query.get();
    const aktivitas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.render('landing/aktivitas/aktivitas', {
      title: 'Aktivitas Prodi',
      aktivitas,
      kategoriAktif: kategori || 'semua',
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat aktivitas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat aktivitas' });
  }
});

router.get('/aktivitas/:id', async (req, res) => {
  try {
    const doc = await db.collection('aktivitas').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Aktivitas tidak ditemukan' });
    const aktivitas = { id: doc.id, ...doc.data() };
    res.render('landing/aktivitas/detail', { title: aktivitas.judul, aktivitas, user: req.user || null });
  } catch (error) {
    console.error('Error detail aktivitas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail aktivitas' });
  }
});

// ============================================================================
// BERITA
// ============================================================================
// GET /berita - halaman khusus menampilkan SEMUA berita (landing page hanya
// menampilkan 4 berita terbaru; di sini pengunjung bisa lihat semuanya)
router.get('/berita', async (req, res) => {
  try {
    const { search, page = 1 } = req.query;
    const currentPage = parseInt(page) || 1;
    const PER_PAGE = 9;

    const snapshot = await db.collection('berita').orderBy('tanggal', 'desc').get();
    let allBerita = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (search && search.trim() !== '') {
      const lowerSearch = search.toLowerCase();
      allBerita = allBerita.filter(item =>
        (item.judul || '').toLowerCase().includes(lowerSearch) ||
        (item.isi || '').toLowerCase().includes(lowerSearch)
      );
    }

    const totalBerita = allBerita.length;
    const totalPages = Math.max(1, Math.ceil(totalBerita / PER_PAGE));
    const startIndex = (currentPage - 1) * PER_PAGE;
    const items = allBerita.slice(startIndex, startIndex + PER_PAGE);

    res.render('berita_list', {
      title: 'Semua Berita',
      description: `Kumpulan berita dan kegiatan Program Studi Teknik Elektronika Politeknik Dewantara (${totalBerita} berita tersedia).`,
      items,
      search: search || '',
      currentPage,
      totalPages,
      totalBerita
    });
  } catch (error) {
    console.error('Error memuat daftar berita:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat daftar berita' });
  }
});

router.get('/berita/:id', async (req, res) => {
  try {
    const docRef = db.collection('berita').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).render('404', { title: 'Berita Tidak Ditemukan', user: req.user || null });
    }
    const berita = doc.data();
    const isiPolos = (berita.isi || '').replace(/<[^>]*>?/gm, '').trim();
    const description = isiPolos.length > 160 ? isiPolos.substring(0, 157) + '...' : (isiPolos || 'Berita Program Studi Teknik Elektronika Politeknik Dewantara.');

    // Tambah jumlah "dilihat" +1 setiap kali halaman diakses.
    // Dijalankan tanpa "await" (fire-and-forget) supaya tidak memperlambat
    // render halaman, dan tidak menggagalkan request jika update-nya gagal.
    // Bot/crawler (Googlebot, WhatsApp preview, dll) sengaja tidak dihitung
    // supaya angka "dilihat" mencerminkan pembaca asli.
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview/i.test(userAgent);
    if (!isBot) {
      docRef.update({ dilihat: admin.firestore.FieldValue.increment(1) })
        .catch(err => console.error('Gagal update jumlah dilihat berita:', err.message));
      berita.dilihat = (berita.dilihat || 0) + 1; // langsung tampilkan angka terbaru di request ini
    }

    res.render('berita_detail', {
      title: berita.judul || 'Detail Berita',
      description,
      ogImage: berita.gambar || null,
      ogType: 'article',
      berita,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat detail berita:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat berita', user: req.user || null });
  }
});

// ============================================================================
// VALIDASI SURAT
// ============================================================================
router.get('/validasi', async (req, res) => {
  const { kode } = req.query;
  let hasil = null;
  let sudahDicari = false;

  if (kode && kode.trim() !== '') {
    sudahDicari = true;
    try {
      const kodeTrim = kode.trim();

      const suratSnap = await db.collection('surat').where('kodeValidasi', '==', kodeTrim).limit(1).get();
      if (!suratSnap.empty) {
        const d = suratSnap.docs[0].data();
        hasil = { jenis: 'Surat Mahasiswa', nama: d.nama || d.dosenNama || '-', jenisSurat: d.jenisSurat || '-', tanggal: d.createdAt, status: d.status };
      }

      if (!hasil) {
        const suratDosenSnap = await db.collection('surat_dosen').where('kodeValidasi', '==', kodeTrim).limit(1).get();
        if (!suratDosenSnap.empty) {
          const d = suratDosenSnap.docs[0].data();
          hasil = { jenis: 'Surat Izin Dosen', nama: d.dosenNama || '-', jenisSurat: 'Izin Dosen', tanggal: d.createdAt, status: d.status };
        }
      }

      if (!hasil) {
        const suratTugasSnap = await db.collection('surat_tugas').where('kodeValidasi', '==', kodeTrim).limit(1).get();
        if (!suratTugasSnap.empty) {
          const d = suratTugasSnap.docs[0].data();
          hasil = { jenis: 'Surat Tugas Dosen', nama: d.dosenNama || '-', jenisSurat: 'Surat Tugas', tanggal: d.createdAt, status: d.status };
        }
      }
    } catch (error) {
      console.error('Error validasi surat:', error);
    }
  }

  res.render('validasi', { title: 'Validasi Surat', kode: kode || '', hasil, sudahDicari, user: req.user || null });
});

// ============================================================================
// LULUSAN (TRACER STUDY) - gabungan dari 2 sumber:
//   1) tracerStudy: isian mandiri mahasiswa/lulusan yang sudah disetujui admin (isPublic=true)
//   2) lulusan: data yang diinput/dikurasi langsung oleh admin (selalu dianggap publik)
// Logika gabungannya sekarang di helpers/lulusanHelper.js (dipakai bersama
// dengan panel admin Track Lulusan supaya kedua sisi selalu sinkron).
// ============================================================================

router.get('/lulusan', async (req, res) => {
  try {
    const { angkatan, status } = req.query;
    let gabungan = await getGabunganLulusan();

    if (angkatan) gabungan = gabungan.filter(l => String(l.tahunLulus) === String(angkatan));
    if (status && status !== 'semua') gabungan = gabungan.filter(l => l.status === status);

    gabungan.sort((a, b) => {
      const tahunDiff = (b.tahunLulus || 0) - (a.tahunLulus || 0);
      if (tahunDiff !== 0) return tahunDiff;
      return String(a.nama).localeCompare(String(b.nama));
    });

    // Statistik dihitung dari keseluruhan data gabungan (sebelum difilter tahun/status)
    const semuaGabungan = await getGabunganLulusan();
    const total = semuaGabungan.length;
    const bekerja = semuaGabungan.filter(l => l.status === 'bekerja').length;
    const wirausaha = semuaGabungan.filter(l => l.status === 'wirausaha').length;
    const kuliah = semuaGabungan.filter(l => l.status === 'melanjutkan_studi').length;
    const stats = { total, bekerja, wirausaha, kuliah };

    const angkatanSet = new Set();
    semuaGabungan.forEach(l => { if (l.tahunLulus) angkatanSet.add(l.tahunLulus); });
    const angkatanList = Array.from(angkatanSet).sort((a, b) => b - a);

    res.render('landing/lulusan/index', {
      title: 'Lulusan',
      lulusan: gabungan,
      stats,
      angkatanList,
      filterAngkatan: angkatan || '',
      filterStatus: status || 'semua',
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat halaman lulusan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data lulusan' });
  }
});

router.get('/lulusan/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    let doc, lulusan;

    if (rawId.startsWith('survei_')) {
      doc = await db.collection('tracerStudy').doc(rawId.replace('survei_', '')).get();
      if (!doc.exists || doc.data().isPublic !== true) {
        return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data tidak ditemukan' });
      }
      const d = doc.data();
      lulusan = {
        id: rawId, nama: d.nama, nim: d.nim, tahunLulus: d.tahunLulus,
        status: normalisasiStatus(d.statusPekerjaan), pekerjaan: d.pekerjaan,
        tempatKerja: d.namaPerusahaan || d.tempatKerja, alamatKerja: d.alamatKerja,
        gaji: d.gaji, email: '', noHp: '', foto: d.fotoUrl || null
      };
    } else if (rawId.startsWith('manual_')) {
      doc = await db.collection('lulusan').doc(rawId.replace('manual_', '')).get();
      if (!doc.exists) {
        return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data tidak ditemukan' });
      }
      const d = doc.data();
      lulusan = {
        id: rawId, nama: d.nama, nim: d.nim, tahunLulus: d.tahunLulus,
        status: normalisasiStatus(d.status), pekerjaan: d.pekerjaan,
        tempatKerja: d.tempatKerja, alamatKerja: d.alamatKerja,
        gaji: d.gaji, email: d.email || '', noHp: d.noHp || '', foto: d.foto || null
      };
    } else {
      // Kompatibilitas mundur: tautan lama tanpa prefix, coba tracerStudy dulu
      doc = await db.collection('tracerStudy').doc(rawId).get();
      if (!doc.exists || doc.data().isPublic !== true) {
        return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data tidak ditemukan' });
      }
      const d = doc.data();
      lulusan = {
        id: rawId, nama: d.nama, nim: d.nim, tahunLulus: d.tahunLulus,
        status: normalisasiStatus(d.statusPekerjaan), pekerjaan: d.pekerjaan,
        tempatKerja: d.namaPerusahaan || d.tempatKerja, alamatKerja: d.alamatKerja,
        gaji: d.gaji, email: '', noHp: '', foto: d.fotoUrl || null
      };
    }

    res.render('landing/lulusan/detail', { title: lulusan.nama, lulusan, user: req.user || null });
  } catch (error) {
    console.error('Error detail lulusan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail lulusan' });
  }
});

// ============================================================================
// PMB (PENERIMAAN MAHASISWA BARU)
// ============================================================================
const uploadDir = path.join(__dirname, '../public/uploads/pmb');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `pmb-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  return (ext && mime) ? cb(null, true) : cb(new Error('Hanya gambar (JPG, PNG) atau PDF'));
};
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter });

router.get('/pmb', (req, res) => {
  res.render('landing/pmb', { title: 'Pendaftaran Mahasiswa Baru - Polidewa', user: req.user || null });
});

router.post('/pmb/submit', upload.single('bukti_pembayaran'), async (req, res) => {
  try {
    const { nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur } = req.body;
    const buktiPembayaran = req.file ? `/uploads/pmb/${req.file.filename}` : null;

    if (!nama || !jenis_kelamin || !nis || !asal_sekolah || !wa || !jurusan || !jalur || !buktiPembayaran) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).send('Semua field wajib diisi, termasuk bukti pembayaran.');
    }

    await db.collection('pmb_pendaftaran').add({
      nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur,
      bukti_pembayaran: buktiPembayaran,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.render('landing/pmb_success', {
      title: 'Pendaftaran Berhasil - Politeknik Dewantara',
      user: req.user || null,
      nama, jenis_kelamin, nis, asal_sekolah, wa, jurusan, jalur
    });
  } catch (error) {
    console.error('Error submit PMB:', error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).send('Terjadi kesalahan server. Silakan coba lagi nanti.');
  }
});

// ============================================================================
// DOKUMEN - KURIKULUM
// ============================================================================
// Data di bawah ini diambil dari dokumen resmi "Kurikulum Program Studi D3
// Teknik Elektronika Politeknik Dewantara" (cover: Tahun 2023, isi disusun
// tahun 2026). PENTING: dokumen sumber masih berstatus DRAFT - mencantumkan
// catatan eksplisit "Dokumen ini belum disahkan, direvisi dan belum berlaku".
// Jika dokumen final/SK penetapan sudah terbit, perbarui field
// `dokumenInfo.status` di bawah dan (opsional) pindahkan ke Firestore.
router.get('/dokumen/kurikulum', (req, res) => {
  const identitas = {
    unitPengelola: 'Politeknik Dewantara',
    jenisProdi: 'Diploma III (D3)',
    namaProdi: 'Teknik Elektronika',
    gelar: 'A.Md.T. (Ahli Madya Teknik)',
    alamat: 'Jl. K.H. Ahmad Razak Lr. 2 No. 7, Kel. Binturu, Kec. Wara Selatan, Kota Palopo, Sulawesi Selatan 91911',
    telepon: '081239108105',
    email: 'elektronika@polidewa.ac.id',
    website: 'polidewa.ac.id',
    noSkPendirian: '334/D/OT/2023',
    tglSkPendirian: '30 November 2023',
    akreditasi: 'Baik'
  };

  const visiMisi = {
    visi: 'Menjadi program studi yang unggul dan inovatif dalam bidang teknik elektronika terapan yang adaptif terhadap perkembangan teknologi, kebutuhan industri, dan kearifan lokal pada tahun 2030.',
    misi: [
      'Menyelenggarakan pendidikan vokasi dalam bidang teknik elektronika yang efektif, inovatif, dan kolaboratif dengan dunia industri dan dunia kerja.',
      'Melaksanakan penelitian terapan dan pengabdian kepada masyarakat dalam bidang elektronika, instrumentasi, otomasi, dan energi terbarukan.',
      'Menjalin kerja sama berkelanjutan dengan dunia usaha dan dunia industri dalam pengembangan kurikulum, praktik kerja, dan penempatan lulusan.',
      'Menghasilkan lulusan yang kompeten di bidang teknik elektronika, beretika, profesional, dan berjiwa wirausaha.'
    ],
    tujuan: [
      'Terwujudnya proses pembelajaran yang berkualitas dengan keseimbangan antara penguasaan teori dan keterampilan praktik dalam bidang teknik elektronika.',
      'Terciptanya lulusan yang mampu mengoperasikan, merawat, dan memperbaiki perangkat elektronika serta sistem kendali dan otomasi sederhana.',
      'Terciptanya lulusan yang memiliki pemahaman dasar sistem tenaga listrik dan PLC sesuai kebutuhan industri di wilayah Sulawesi dan sekitarnya.',
      'Terciptanya lulusan yang adaptif terhadap perkembangan teknologi, mampu berwirausaha di bidang elektronika, dan memiliki kesadaran tinggi terhadap K3.',
      'Terwujudnya lulusan yang mampu berkomunikasi efektif, bekerja sama dalam tim lintas disiplin, dan memiliki etika profesi yang kuat.'
    ],
    strategi: [
      'Peningkatan mutu proses pembelajaran dengan Student Centered Learning, Project-Based Learning, dan magang industri.',
      'Peningkatan kompetensi dosen melalui pelatihan, sertifikasi profesi, dan penelitian terapan.',
      'Pemutakhiran peralatan laboratorium elektronika, instrumentasi, dan otomasi.',
      'Pengembangan kerja sama dengan industri manufaktur, energi, maritim, dan telekomunikasi untuk magang dan penyerapan lulusan.',
      'Penguatan jiwa kewirausahaan melalui inkubasi bisnis dan magang kewirausahaan.'
    ]
  };

  const profilLulusan = [
    { no: 1, judul: 'Teknisi Elektronika-Listrik Terpadu', deskripsi: 'Lulusan mampu berperan sebagai teknisi lapangan yang mampu mengoperasikan, merawat, dan memperbaiki perangkat elektronika, alat ukur, sistem kendali, perangkat telekomunikasi, dan peralatan listrik industri dasar. Lulusan mampu membaca nilai komponen, skema elektronika, diagram kelistrikan, gambar teknik, serta melakukan identifikasi kerusakan dan troubleshooting dengan memperhatikan prosedur K3.' },
    { no: 2, judul: 'Praktisi Instrumentasi dan Kendali Industri', deskripsi: 'Lulusan mampu berperan sebagai teknisi instrumentasi dan otomasi yang mampu mengoperasikan, memprogram, dan merawat sistem kendali berbasis PLC, mikrokontroler, sensor, transduser, dan aktuator; membaca diagram blok sistem kendali, ladder diagram, dan diagram pengawatan; serta melakukan kalibrasi dan pengujian peralatan instrumentasi sesuai standar prosedur.' },
    { no: 3, judul: 'Teknisi Pemeliharaan Perangkat Elektronik', deskripsi: 'Lulusan mampu melaksanakan perawatan preventif dan korektif pada peralatan elektronik di laboratorium, industri, dan fasilitas umum; membaca dokumentasi teknis, manual peralatan, dan SOP; serta menerapkan K3 dan penggunaan alat pelindung diri dalam setiap pekerjaan.' },
    { no: 4, judul: 'Wirausaha Bidang Elektronika', deskripsi: 'Lulusan mampu merintis dan mengelola usaha jasa perbaikan, instalasi, atau produksi perangkat elektronika; memahami peluang pasar, pemasaran, dan manajemen usaha kecil; serta bekerja mandiri maupun dalam tim dengan menerapkan etika profesi dan kewirausahaan.' }
  ];

  const cpl = [
    { kode: 'CPL-1', deskripsi: 'Mampu menerapkan konsep matematika teknik, fisika terapan, dan prinsip dasar teknik elektro-elektronika untuk mengidentifikasi, merumuskan, dan menganalisis permasalahan teknis sederhana pada perangkat elektronika, sistem instrumentasi, dan instalasi listrik dengan sikap bertanggung jawab, jujur, dan disiplin.' },
    { kode: 'CPL-2', deskripsi: 'Mampu membaca, memahami, dan mendokumentasikan nilai komponen, skema elektronika, diagram kelistrikan, gambar teknik, serta dokumentasi teknis lainnya; mampu menggunakan perangkat lunak teknik modern dan peralatan laboratorium dalam praktik pekerjaan dengan teliti, cermat, dan bertanggung jawab.' },
    { kode: 'CPL-3', deskripsi: 'Mampu mengidentifikasi, menganalisis, dan memperbaiki kerusakan pada perangkat elektronika, sistem instrumentasi, dan sistem kelistrikan/otomasi industri, termasuk PLC, dengan pendekatan sistematis, pengukuran, pengujian sesuai prosedur, serta penerapan K3 secara konsisten.' },
    { kode: 'CPL-4', deskripsi: 'Mampu merancang dan mengimplementasikan sistem elektronika sederhana berbasis mikrokontroler, PLC, atau rangkaian diskrit untuk memenuhi kebutuhan spesifik dengan mempertimbangkan aspek teknis, ekonomi, efisiensi, dan keselamatan kerja, serta mampu melakukan pengujian dan evaluasi kinerja sistem.' },
    { kode: 'CPL-5', deskripsi: 'Mampu berkomunikasi secara efektif secara lisan dan tulisan, menyusun laporan teknis dan dokumentasi pekerjaan, bekerja sama dalam tim lintas fungsi dan budaya, serta merencanakan, melaksanakan, dan mengevaluasi tugas sesuai target, jadwal, dan prosedur dengan menjunjung etika profesi, norma, dan peraturan yang berlaku.' },
    { kode: 'CPL-6', deskripsi: 'Mampu mengakses, memahami, dan memanfaatkan sumber belajar seperti manual, dokumentasi teknis, literatur, dan tutorial daring untuk pengembangan diri secara mandiri dan berkelanjutan serta menunjukkan tanggung jawab, kejujuran, disiplin, integritas, dan adaptasi terhadap perkembangan teknologi dan kebutuhan industri.' }
  ];

  const standarKompetensi = [
    'Menguasai konsep dasar matematika, fisika, dan teknik elektro-elektronika yang mendukung pemahaman komponen, rangkaian, dan sistem elektronika.',
    'Mampu menggunakan alat ukur dan peralatan laboratorium seperti multimeter, osiloskop, function generator, power supply, solder, dan peralatan uji lainnya secara benar dan akurat.',
    'Mampu membaca, memahami, dan menggambar skema elektronika, diagram kelistrikan, gambar teknik, dan layout PCB.',
    'Mampu melakukan pengukuran besaran listrik dan elektronika serta menginterpretasikan data hasil pengukuran untuk kebutuhan analisis dan perbaikan.',
    'Mampu memprogram mikrokontroler dan PLC dasar untuk aplikasi kendali sederhana, termasuk integrasi sensor dan aktuator.',
    'Mampu melakukan perawatan preventif dan korektif pada perangkat elektronika dan sistem kendali/otomasi.',
    'Mampu mendiagnosis kerusakan pada perangkat elektronika dan sistem kelistrikan, serta melakukan perbaikan dasar.',
    'Mampu menerapkan prinsip Keselamatan dan Kesehatan Kerja (K3) dan prosedur tanggap darurat di laboratorium dan tempat kerja.',
    'Mampu menyusun laporan teknis dan dokumentasi pekerjaan secara sistematis serta mempresentasikan hasil kerja secara komunikatif.',
    'Mampu merintis usaha di bidang elektronika seperti jasa perbaikan, instalasi, atau produksi perangkat dengan menerapkan prinsip kewirausahaan dan etika profesi.'
  ];

  const jumlahSks = [
    { jenis: 'Wajib Umum (WUD)', sks: 12, keterangan: 'Agama (2) + Bahasa Indonesia (3) + Bahasa Inggris (3) + Kewarganegaraan (2) + Pancasila (2)' },
    { jenis: 'Penciri Dewantara (PD)', sks: 30, keterangan: '10 mata kuliah x 3 SKS' },
    { jenis: 'Inti Keahlian (PEK)', sks: 18, keterangan: '6 mata kuliah x 3 SKS, salah satu konsentrasi' },
    { jenis: 'Wajib Polidewa (WP - Magang)', sks: 60, keterangan: 'Praktik Dunia Kerja I, II, dan III x 20 SKS' }
  ];
  const totalSks = jumlahSks.reduce((a, s) => a + s.sks, 0); // 120

  // Struktur mata kuliah per semester. Semester III memiliki 2 varian
  // konsentrasi (Instrumentasi / Telekomunikasi) sesuai dokumen sumber.
  const strukturSemester = [
    {
      semester: 1,
      matkul: [
        { kode: 'WUD2201-5', nama: 'Pendidikan Agama', teori: 1, praktik: 1, sks: 2, jenis: 'Wajib Umum' },
        { kode: 'WUD3208', nama: 'Bahasa Indonesia', teori: 1, praktik: 2, sks: 3, jenis: 'Wajib Umum' },
        { kode: 'WUD3209', nama: 'Bahasa Inggris', teori: 1, praktik: 2, sks: 3, jenis: 'Wajib Umum' },
        { kode: 'PD3201', nama: 'Etika Kerja', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3202', nama: 'Standardisasi', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3203', nama: 'Matematika Teknik', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3204', nama: 'Perangkat Lunak Aplikasi', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' }
      ]
    },
    {
      semester: 2,
      matkul: [
        { kode: 'WUD2206', nama: 'Pendidikan Kewarganegaraan', teori: 2, praktik: 0, sks: 2, jenis: 'Wajib Umum' },
        { kode: 'PD3205', nama: 'Keselamatan dan Kesehatan Kerja (K3)', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3206', nama: 'Aplikasi Komputer', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3207', nama: 'Teknik Pengukuran', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3208', nama: 'Peralatan Teknik', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3209', nama: 'Menggambar Teknik', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' },
        { kode: 'PD3210', nama: 'Data dan Sistem Informasi', teori: 1, praktik: 2, sks: 3, jenis: 'Penciri Dewantara' }
      ]
    },
    {
      semester: 3,
      varian: [
        {
          nama: 'Instrumentasi',
          matkul: [
            { kode: 'WUD2207', nama: 'Pendidikan Pancasila', teori: 2, praktik: 0, sks: 2, jenis: 'Wajib Umum' },
            { kode: 'PEK3201', nama: 'Dasar Sistem Tenaga Listrik', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3202', nama: 'Elektronika Digital', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3203', nama: 'Mikrokontroler', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3204', nama: 'Rangkaian Elektronika', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' }
          ]
        },
        {
          nama: 'Telekomunikasi',
          matkul: [
            { kode: 'WUD2207', nama: 'Pendidikan Pancasila', teori: 2, praktik: 0, sks: 2, jenis: 'Wajib Umum' },
            { kode: 'PEK3207', nama: 'Komunikasi Data dan Jaringan', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3208', nama: 'Elektronika Digital', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3209', nama: 'Antena dan Propagasi', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3210', nama: 'Keamanan Siber', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' },
            { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', teori: 1, praktik: 2, sks: 3, jenis: 'Inti Keahlian' }
          ]
        }
      ]
    },
    { semester: 4, matkul: [ { kode: 'WP2021', nama: 'Praktik Dunia Kerja I', teori: 0, praktik: 20, sks: 20, jenis: 'Wajib Polidewa' } ] },
    { semester: 5, matkul: [ { kode: 'WP2022', nama: 'Praktik Dunia Kerja II', teori: 0, praktik: 20, sks: 20, jenis: 'Wajib Polidewa' } ] },
    { semester: 6, matkul: [ { kode: 'WP2023', nama: 'Praktik Dunia Kerja III', teori: 0, praktik: 20, sks: 20, jenis: 'Wajib Polidewa' } ] }
  ];

  const rekognisiMagang = [
    { kegiatan: 'Magang I', semester: 'IV', sks: 20, fokus: 'Observasi lingkungan kerja dan proses operasional' },
    { kegiatan: 'Magang II', semester: 'V', sks: 20, fokus: 'Keterlibatan aktif, diagnosis, dan perbaikan sederhana' },
    { kegiatan: 'Magang III', semester: 'VI', sks: 20, fokus: 'Proyek mandiri, laporan akhir, dan seminar magang' }
  ];

  const deskripsiMatkul = [
    { kode: 'WUD2201-5', nama: 'Pendidikan Agama', deskripsi: 'Mahasiswa mampu menginternalisasi nilai keagamaan, beriman dan bertakwa kepada Tuhan Yang Maha Esa, serta menerapkan ajaran agama dalam kehidupan bermasyarakat, berbangsa, dan bernegara.' },
    { kode: 'WUD2206', nama: 'Pendidikan Kewarganegaraan', deskripsi: 'Mahasiswa memahami hubungan warga negara dengan negara dan pendidikan pendahuluan bela negara agar menjadi warga negara yang dapat diandalkan oleh bangsa dan NKRI.' },
    { kode: 'WUD2207', nama: 'Pendidikan Pancasila', deskripsi: 'Mahasiswa memahami tindakan cerdas dan bertanggung jawab dalam kehidupan bermasyarakat, berbangsa, dan bernegara berdasarkan nilai-nilai Pancasila.' },
    { kode: 'WUD3208', nama: 'Bahasa Indonesia', deskripsi: 'Mahasiswa terampil menggunakan Bahasa Indonesia Keilmuan dan menyusun karya ilmiah sesuai kaidah akademik.' },
    { kode: 'WUD3209', nama: 'Bahasa Inggris', deskripsi: 'Mahasiswa mampu menerapkan komunikasi dasar bahasa Inggris, memahami bacaan sesuai bidang keahlian, dan menguasai kosakata teknis secara mandiri.' },
    { kode: 'PD3201', nama: 'Etika Kerja', deskripsi: 'Mahasiswa memahami etika, moral, dan tanggung jawab profesi teknik serta mampu menerapkannya dalam perilaku kerja profesional.' },
    { kode: 'PD3202', nama: 'Standardisasi', deskripsi: 'Mahasiswa memahami tujuan standar, organisasi standardisasi, SNI, akreditasi, sertifikasi, serta standardisasi komponen dan jasa teknik elektronika.' },
    { kode: 'PD3203', nama: 'Matematika Teknik', deskripsi: 'Mahasiswa memahami dan menerapkan konsep integral serta persamaan diferensial dasar pada bidang teknik elektronika.' },
    { kode: 'PD3204', nama: 'Perangkat Lunak Aplikasi', deskripsi: 'Mahasiswa memahami penggunaan perangkat lunak teknik, simulasi, desain, pengolahan data, dan aplikasi pendukung pekerjaan elektronika.' },
    { kode: 'PD3205', nama: 'Keselamatan dan Kesehatan Kerja (K3)', deskripsi: 'Mahasiswa memahami filosofi, prinsip, dan penerapan K3 di laboratorium dan lingkungan kerja teknik elektronika.' },
    { kode: 'PD3206', nama: 'Aplikasi Komputer', deskripsi: 'Mahasiswa mampu menggunakan aplikasi perkantoran, pengolahan data, grafik, presentasi, dan aplikasi komputer dasar untuk kebutuhan akademik dan teknis.' },
    { kode: 'PD3207', nama: 'Teknik Pengukuran', deskripsi: 'Mahasiswa mampu menggunakan alat ukur elektronika dan melakukan pengukuran besaran listrik maupun nonlistrik secara benar.' },
    { kode: 'PD3208', nama: 'Peralatan Teknik', deskripsi: 'Mahasiswa memahami penggunaan alat-alat dasar teknik elektronika dan mengembangkan keterampilan psikomotorik dengan perangkat teknik.' },
    { kode: 'PD3209', nama: 'Menggambar Teknik', deskripsi: 'Mahasiswa terampil menggambar skema rangkaian, diagram kelistrikan, dan layout PCB secara manual maupun menggunakan perangkat lunak.' },
    { kode: 'PD3210', nama: 'Data dan Sistem Informasi', deskripsi: 'Mahasiswa memahami konsep sistem informasi, tahapan pengolahan data, serta penggunaan perangkat lunak pengolah data.' },
    { kode: 'PEK3201', nama: 'Dasar Sistem Tenaga Listrik', deskripsi: 'Mahasiswa memahami sistem tenaga listrik, komponen pembangkit, transmisi, distribusi, panel distribusi, serta instalasi dan pengukuran sistem 1 fasa dan 3 fasa dengan K3.' },
    { kode: 'PEK3202 / PEK3208', nama: 'Elektronika Digital', deskripsi: 'Mahasiswa mampu mengaplikasikan sistem bilangan, gerbang logika, flip-flop, counter, register, dan rangkaian digital sederhana.' },
    { kode: 'PEK3203', nama: 'Mikrokontroler', deskripsi: 'Mahasiswa memahami arsitektur mikrokontroler, pemrograman C/C++, integrasi sensor-aktuator, serta komunikasi data sederhana.' },
    { kode: 'PEK3204', nama: 'Rangkaian Elektronika', deskripsi: 'Mahasiswa memahami rangkaian analog, dioda, transistor, op-amp, catu daya, penguat sederhana, pengukuran, dan troubleshooting rangkaian.' },
    { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', deskripsi: 'Mahasiswa memahami perawatan perangkat elektronika, diagnosis kerusakan, perbaikan dasar, dan efisiensi waktu perawatan.' },
    { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', deskripsi: 'Mahasiswa memahami otomasi industri, arsitektur PLC, pemrograman ladder diagram, timer, counter, sequencer, dan sistem kendali sederhana.' },
    { kode: 'PEK3207', nama: 'Komunikasi Data dan Jaringan', deskripsi: 'Mahasiswa memahami komunikasi data, OSI, TCP/IP, media transmisi, encoding, modulasi, jaringan komputer, dan protokol komunikasi.' },
    { kode: 'PEK3209', nama: 'Antena dan Propagasi', deskripsi: 'Mahasiswa memahami prinsip kerja antena, parameter antena, jenis antena, serta propagasi gelombang elektromagnetik.' },
    { kode: 'PEK3210', nama: 'Keamanan Siber', deskripsi: 'Mahasiswa memahami konsep keamanan siber, ancaman sistem informasi dan IoT, celah keamanan, serta perlindungan dasar.' },
    { kode: 'WP2021', nama: 'Praktik Dunia Kerja I', deskripsi: 'Mahasiswa melakukan praktik kerja profesional terkait pengenalan lingkungan kerja, budaya perusahaan, dan pengamatan proses operasional.' },
    { kode: 'WP2022', nama: 'Praktik Dunia Kerja II', deskripsi: 'Mahasiswa terlibat aktif dalam pekerjaan teknis, diagnosis kerusakan, dan perbaikan sederhana di industri.' },
    { kode: 'WP2023', nama: 'Praktik Dunia Kerja III', deskripsi: 'Mahasiswa menyelesaikan proyek teknis mandiri, menyusun laporan akhir, dan mempresentasikan hasil magang.' }
  ];

  const penilaian = {
    prinsip: [
      'Valid: sesuai dengan tujuan pembelajaran dan mengukur capaian yang tepat.',
      'Reliabel: konsisten dan dapat diandalkan.',
      'Transparan: prosedur dan hasil penilaian dapat diakses mahasiswa.',
      'Akuntabel: dilaksanakan sesuai prosedur yang jelas dan disepakati.',
      'Berkeadilan: semua mahasiswa memperoleh kesempatan yang sama.',
      'Objektif: bebas dari subjektivitas penilai.',
      'Edukatif: memotivasi mahasiswa untuk belajar dan memperbaiki diri.'
    ],
    komponen: [
      { komponen: 'Sikap, kehadiran, dan keaktifan', bobot: '10-20%' },
      { komponen: 'Tugas dan praktikum (formatif)', bobot: '20-30%' },
      { komponen: 'Ujian Tengah Semester (UTS)', bobot: '20-25%' },
      { komponen: 'Ujian Akhir Semester (UAS) / Proyek Akhir', bobot: '25-35%' }
    ],
    magang: [
      { komponen: 'Laporan Harian', bobot: '15%', indikator: 'Ketepatan waktu, kelengkapan catatan kegiatan, dan kualitas observasi' },
      { komponen: 'Laporan Akhir Magang', bobot: '25%', indikator: 'Sistematika penulisan, kelengkapan data, analisis, kesimpulan, dan kerapian' },
      { komponen: 'Penilaian Pembimbing Industri', bobot: '30%', indikator: 'Kedisiplinan, tanggung jawab, keterampilan teknis, etika kerja, dan kerja sama' },
      { komponen: 'Presentasi Seminar Magang', bobot: '30%', indikator: 'Kualitas presentasi, penguasaan materi, kemampuan menjawab pertanyaan, dan sikap' }
    ]
  };

  const referensi = [
    'Undang-Undang Republik Indonesia Nomor 12 Tahun 2012 tentang Pendidikan Tinggi.',
    'Peraturan Presiden Republik Indonesia Nomor 8 Tahun 2012 tentang Kerangka Kualifikasi Nasional Indonesia (KKNI).',
    'Peraturan Menteri Pendidikan, Kebudayaan, Riset, dan Teknologi Nomor 53 Tahun 2023 tentang Penjaminan Mutu Pendidikan Tinggi.',
    'Panduan Penyusunan Kurikulum Pendidikan Tinggi Tahun 2024.',
    'Statuta Politeknik Dewantara Tahun 2023.',
    'Buku Panduan Merdeka Belajar-Kampus Merdeka.',
    'Modul Praktikum Peralatan Teknik Elektronika, Politeknik Dewantara.',
    'Standar Nasional Indonesia (SNI) terkait gambar teknik dan elektronika.'
  ];

  const dokumenInfo = {
    tahunKurikulum: '2023',
    tanggalPenetapan: '8 April 2026',
    direktur: 'Dr. Suaedi, M.Si.',
    kaprodi: 'Fajar Ramadhan, S.Pd., M.T.',
    // Sesuai dokumen sumber: masih berstatus draft, belum ditandatangani/berlaku resmi.
    status: 'Draft - Belum Disahkan',
    catatanStatus: 'Dokumen ini belum disahkan, direvisi, dan belum berlaku.'
  };

  res.render('landing/dokumen/kurikulum', {
    title: 'Kurikulum - Teknik Elektronika',
    user: req.user || null,
    identitas,
    visiMisi,
    profilLulusan,
    cpl,
    standarKompetensi,
    jumlahSks,
    totalSks,
    strukturSemester,
    rekognisiMagang,
    deskripsiMatkul,
    penilaian,
    referensi,
    dokumenInfo,
    fileKurikulum: '#'
  });
});

// ============================================================================
// DOKUMEN - RPS (RENCANA PEMBELAJARAN SEMESTER)
// ============================================================================
// Daftar mata kuliah di bawah ini mengikuti struktur kurikulum resmi (lihat
// route '/dokumen/kurikulum'). Field `url` masih placeholder '#' - silakan
// diarahkan ke file RPS masing-masing mata kuliah (mis. hasil upload dosen
// pengampu / link Google Drive / file di folder public) setelah tersedia.
router.get('/dokumen/rps', (req, res) => {
  // Berkas RPS gabungan (25 mata kuliah semester I-III) disimpan di
  // public/dokumen/rps/RPS_Semester_1-3.pdf. Setiap mata kuliah diarahkan
  // langsung ke halaman awal RPS-nya lewat anchor "#page=N" (didukung oleh
  // browser PDF viewer bawaan Chrome/Edge/Firefox).
  const RPS_FILE = '/dokumen/rps/RPS_Semester_1-3.pdf';
  const rpsUrl = (page) => `${RPS_FILE}#page=${page}`;

  const rpsSemester = [
    {
      semester: 1,
      matkul: [
        { kode: 'WUD2201-5', nama: 'Pendidikan Agama', jenis: 'Wajib Umum', url: rpsUrl(1) },
        { kode: 'WUD3208', nama: 'Bahasa Indonesia', jenis: 'Wajib Umum', url: rpsUrl(10) },
        { kode: 'WUD3209', nama: 'Bahasa Inggris', jenis: 'Wajib Umum', url: rpsUrl(13) },
        { kode: 'PD3201', nama: 'Etika Kerja', jenis: 'Penciri Dewantara', url: rpsUrl(17) },
        { kode: 'PD3202', nama: 'Standardisasi', jenis: 'Penciri Dewantara', url: rpsUrl(20) },
        { kode: 'PD3203', nama: 'Matematika Teknik', jenis: 'Penciri Dewantara', url: rpsUrl(23) },
        { kode: 'PD3204', nama: 'Perangkat Lunak Aplikasi', jenis: 'Penciri Dewantara', url: rpsUrl(26) }
      ]
    },
    {
      semester: 2,
      matkul: [
        { kode: 'WUD2206', nama: 'Pendidikan Kewarganegaraan', jenis: 'Wajib Umum', url: rpsUrl(4) },
        { kode: 'PD3205', nama: 'Keselamatan dan Kesehatan Kerja (K3)', jenis: 'Penciri Dewantara', url: rpsUrl(29) },
        { kode: 'PD3206', nama: 'Aplikasi Komputer', jenis: 'Penciri Dewantara', url: rpsUrl(32) },
        { kode: 'PD3207', nama: 'Teknik Pengukuran', jenis: 'Penciri Dewantara', url: rpsUrl(35) },
        { kode: 'PD3208', nama: 'Peralatan Teknik', jenis: 'Penciri Dewantara', url: rpsUrl(38) },
        { kode: 'PD3209', nama: 'Menggambar Teknik', jenis: 'Penciri Dewantara', url: rpsUrl(41) },
        { kode: 'PD3210', nama: 'Data dan Sistem Informasi', jenis: 'Penciri Dewantara', url: rpsUrl(44) }
      ]
    },
    {
      semester: 3,
      varian: [
        {
          nama: 'Instrumentasi',
          matkul: [
            { kode: 'WUD2207', nama: 'Pendidikan Pancasila', jenis: 'Wajib Umum', url: rpsUrl(7) },
            { kode: 'PEK3201', nama: 'Dasar Sistem Tenaga Listrik', jenis: 'Inti Keahlian', url: rpsUrl(48) },
            { kode: 'PEK3202', nama: 'Elektronika Digital', jenis: 'Inti Keahlian', url: rpsUrl(51) },
            { kode: 'PEK3203', nama: 'Mikrokontroler', jenis: 'Inti Keahlian', url: rpsUrl(54) },
            { kode: 'PEK3204', nama: 'Rangkaian Elektronika', jenis: 'Inti Keahlian', url: rpsUrl(58) },
            { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', jenis: 'Inti Keahlian', url: rpsUrl(61) },
            { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', jenis: 'Inti Keahlian', url: rpsUrl(64) }
          ]
        },
        {
          nama: 'Telekomunikasi',
          matkul: [
            { kode: 'WUD2207', nama: 'Pendidikan Pancasila', jenis: 'Wajib Umum', url: rpsUrl(7) },
            { kode: 'PEK3207', nama: 'Komunikasi Data dan Jaringan', jenis: 'Inti Keahlian', url: rpsUrl(68) },
            { kode: 'PEK3208', nama: 'Elektronika Digital', jenis: 'Inti Keahlian', url: rpsUrl(71) },
            { kode: 'PEK3209', nama: 'Antena dan Propagasi', jenis: 'Inti Keahlian', url: rpsUrl(74) },
            { kode: 'PEK3210', nama: 'Keamanan Siber', jenis: 'Inti Keahlian', url: rpsUrl(77) },
            { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', jenis: 'Inti Keahlian', url: rpsUrl(61) },
            { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', jenis: 'Inti Keahlian', url: rpsUrl(64) }
          ]
        }
      ]
    },
    // Semester 4-6 (Praktik Dunia Kerja/magang) belum memiliki dokumen RPS
    // tersendiri - tombol tetap nonaktif ('#') sampai berkasnya disiapkan.
    { semester: 4, matkul: [ { kode: 'WP2021', nama: 'Praktik Dunia Kerja I', jenis: 'Wajib Polidewa', url: '#' } ] },
    { semester: 5, matkul: [ { kode: 'WP2022', nama: 'Praktik Dunia Kerja II', jenis: 'Wajib Polidewa', url: '#' } ] },
    { semester: 6, matkul: [ { kode: 'WP2023', nama: 'Praktik Dunia Kerja III', jenis: 'Wajib Polidewa', url: '#' } ] }
  ];

  res.render('landing/dokumen/rps', {
    title: 'RPS - Rencana Pembelajaran Semester',
    user: req.user || null,
    rpsSemester,
    tahunKurikulum: '2026'
  });
});

// ============================================================================
// DOKUMEN - AGENDA & HASIL RAPAT (NOTULENSI)
// ============================================================================
// Data notulensi di bawah ini masih CONTOH/PLACEHOLDER, silakan diisi oleh
// admin prodi setiap kali ada rapat baru. Field `daftarHadir` (daftar nama
// dosen yang hadir) juga masih placeholder ("Nama Dosen 1", dst) - wajib
// diganti dengan nama dosen yang benar-benar hadir pada rapat terkait.
// Jika suatu saat ingin dikelola dinamis (mis. lewat halaman admin +
// Firestore), cukup ganti bagian ini dengan query
// db.collection('notulensiRapat').orderBy('tanggal','desc').
router.get('/dokumen/notulensi', (req, res) => {
  const notulensi = [
    {
      id: 1,
      tanggal: '2026-04-08',
      tanggalTampil: '8 April 2026',
      judul: 'Rapat Penetapan Kurikulum Program Studi D3 Teknik Elektronika',
      jenis: 'Rapat Program Studi',
      pimpinan: 'Dr. Suaedi, M.Si. (Direktur)',
      peserta: 'Direktur, Ketua Program Studi, Tim Dosen Teknik Elektronika',
      agenda: [
        'Pemaparan draf Kurikulum Program Studi D3 Teknik Elektronika Tahun 2026',
        'Pembahasan struktur mata kuliah dan pembagian konsentrasi (Instrumentasi & Telekomunikasi)',
        'Pembahasan capaian pembelajaran lulusan (CPL) dan standar kompetensi lulusan'
      ],
      hasil: [
        'Draf kurikulum disetujui untuk dilanjutkan ke proses penetapan resmi',
        'Struktur 120 SKS dalam 6 semester dengan 2 konsentrasi disepakati',
        'Kurikulum akan dievaluasi dan ditinjau ulang secara berkala'
      ],
      daftarHadir: [
        'Dr. Suaedi, M.Si. (Direktur)',
        'Fajar Ramadhan, S.Pd., M.T. (Ketua Program Studi)',
        'Nama Dosen 1, S.T., M.T.',
        'Nama Dosen 2, S.T., M.T.',
        'Nama Dosen 3, S.Pd., M.T.'
      ],
      dokumenUrl: '#'
    },
    {
      id: 2,
      tanggal: '2026-02-10',
      tanggalTampil: '10 Februari 2026',
      judul: 'Rapat Koordinasi Persiapan Praktik Dunia Kerja (Magang) Semester Genap',
      jenis: 'Rapat Koordinasi Magang',
      pimpinan: 'Fajar Ramadhan, S.Pd., M.T. (Ketua Program Studi)',
      peserta: 'Ketua Program Studi, Dosen Pembimbing Akademik, Koordinator Magang',
      agenda: [
        'Evaluasi pelaksanaan magang periode sebelumnya',
        'Pemetaan mitra industri untuk penempatan mahasiswa',
        'Penetapan jadwal pembekalan dan pelepasan mahasiswa magang'
      ],
      hasil: [
        'Disepakati jadwal pembekalan magang dilaksanakan 2 minggu sebelum penempatan',
        'Setiap mahasiswa wajib memiliki dosen pembimbing lapangan yang ditunjuk',
        'Dibentuk tim monitoring magang untuk kunjungan berkala ke lokasi mitra'
      ],
      daftarHadir: [
        'Fajar Ramadhan, S.Pd., M.T. (Ketua Program Studi)',
        'Nama Dosen 1, S.T., M.T. (Dosen Pembimbing Akademik)',
        'Nama Dosen 2, S.T., M.T. (Koordinator Magang)',
        'Nama Dosen 4, S.Pd., M.T.'
      ],
      dokumenUrl: '#'
    },
    {
      id: 3,
      tanggal: '2025-12-15',
      tanggalTampil: '15 Desember 2025',
      judul: 'Rapat Evaluasi Pembelajaran Semester Ganjil 2025/2026',
      jenis: 'Rapat Evaluasi Akademik',
      pimpinan: 'Fajar Ramadhan, S.Pd., M.T. (Ketua Program Studi)',
      peserta: 'Ketua Program Studi, seluruh Dosen Pengampu Mata Kuliah',
      agenda: [
        'Evaluasi capaian pembelajaran per mata kuliah semester ganjil',
        'Tindak lanjut hasil kuesioner kepuasan mahasiswa',
        'Rencana perbaikan metode pembelajaran semester berikutnya'
      ],
      hasil: [
        'Beberapa mata kuliah praktik perlu penambahan jam pendampingan laboratorium',
        'Disepakati penerapan Project-Based Learning diperluas ke mata kuliah inti keahlian',
        'Dosen diminta menyerahkan RPS terbaru sebelum semester berikutnya dimulai'
      ],
      daftarHadir: [
        'Fajar Ramadhan, S.Pd., M.T. (Ketua Program Studi)',
        'Nama Dosen 1, S.T., M.T.',
        'Nama Dosen 2, S.T., M.T.',
        'Nama Dosen 3, S.Pd., M.T.',
        'Nama Dosen 4, S.Pd., M.T.',
        'Nama Dosen 5, S.T., M.T.'
      ],
      dokumenUrl: '#'
    }
  ];

  res.render('landing/dokumen/notulensi', {
    title: 'Agenda & Hasil Rapat',
    user: req.user || null,
    notulensi
  });
});

// ============================================================================
// PENGAJUAN - SEMINAR MAGANG
// ============================================================================
router.get('/pengajuan/seminar', (req, res) => {
  res.render('landing/pengajuan/seminar', {
    title: 'Pengajuan Seminar Magang',
    user: req.user || null,
    estimasiWaktu: '3-5 hari kerja',
    alur: [
      { icon: 'bi-clipboard-check', judul: 'Selesaikan Magang', deskripsi: 'Mahasiswa menyelesaikan seluruh periode magang dan logbook harian disetujui pembimbing.' },
      { icon: 'bi-file-earmark-text', judul: 'Susun Laporan', deskripsi: 'Mahasiswa menyusun laporan hasil magang sesuai format yang ditentukan.' },
      { icon: 'bi-send-check', judul: 'Ajukan Seminar', deskripsi: 'Mahasiswa login dan mengisi formulir pengajuan seminar secara daring.' },
      { icon: 'bi-person-check', judul: 'Verifikasi Kaprodi', deskripsi: 'Kaprodi/Admin memeriksa kelengkapan berkas dan menentukan dosen penguji.' },
      { icon: 'bi-calendar-event', judul: 'Jadwal Terbit', deskripsi: 'Jadwal dan tempat seminar diterbitkan dan diinformasikan ke mahasiswa.' },
      { icon: 'bi-easel', judul: 'Pelaksanaan Seminar', deskripsi: 'Mahasiswa memaparkan hasil magang di hadapan dosen penguji.' }
    ],
    syarat: [
      'Telah menyelesaikan minimal 90% total hari magang yang diwajibkan',
      'Logbook harian magang telah disetujui (approved) oleh pembimbing',
      'Laporan hasil magang telah selesai disusun dan ditandatangani pembimbing lapangan',
      'Tidak memiliki tunggakan administrasi/keuangan',
      'Surat keterangan selesai magang dari perusahaan/instansi'
    ],
    dokumen: [
      { nama: 'Format Laporan Magang', keterangan: 'Template resmi (.docx)', url: '#' },
      { nama: 'Formulir Pengajuan Seminar', keterangan: 'Diisi melalui akun mahasiswa', url: '#' },
      { nama: 'SOP Seminar Magang', keterangan: 'Dokumen prosedur lengkap (.pdf)', url: '#' }
    ]
  });
});

// ============================================================================
// PENGAJUAN - MAGANG
// ============================================================================
router.get('/pengajuan/magang', (req, res) => {
  res.render('landing/pengajuan/magang', {
    title: 'Pengajuan Magang',
    user: req.user || null,
    estimasiWaktu: '5-7 hari kerja',
    alur: [
      { icon: 'bi-search', judul: 'Cari Perusahaan', deskripsi: 'Mahasiswa mencari dan menghubungi perusahaan/instansi tujuan magang.' },
      { icon: 'bi-person-lines-fill', judul: 'Konsultasi Dosen PA', deskripsi: 'Mahasiswa berkonsultasi dengan dosen Pembimbing Akademik terkait tempat magang.' },
      { icon: 'bi-send-check', judul: 'Ajukan Permohonan', deskripsi: 'Mahasiswa login dan mengisi formulir pengajuan surat pengantar magang.' },
      { icon: 'bi-person-check', judul: 'Verifikasi Admin', deskripsi: 'Admin/Kaprodi memverifikasi data dan menerbitkan surat pengantar.' },
      { icon: 'bi-building-check', judul: 'Konfirmasi Perusahaan', deskripsi: 'Mahasiswa menyerahkan surat pengantar ke perusahaan dan menunggu konfirmasi diterima.' },
      { icon: 'bi-briefcase', judul: 'Pelaksanaan Magang', deskripsi: 'Mahasiswa melaksanakan magang dan mengisi logbook harian melalui sistem.' }
    ],
    syarat: [
      'Terdaftar aktif sebagai mahasiswa minimal semester 4',
      'Telah menempuh mata kuliah prasyarat sesuai ketentuan kurikulum',
      'Tidak memiliki tunggakan administrasi/keuangan',
      'Mengisi formulir pengajuan magang secara daring melalui akun mahasiswa',
      'Melampirkan surat balasan/penerimaan dari perusahaan (jika sudah ada)'
    ],
    dokumen: [
      { nama: 'Formulir Pengajuan Magang', keterangan: 'Diisi melalui akun mahasiswa', url: '#' },
      { nama: 'Template Surat Pengantar', keterangan: 'Contoh format (.docx)', url: '#' },
      { nama: 'SOP Pelaksanaan Magang', keterangan: 'Dokumen prosedur lengkap (.pdf)', url: '#' }
    ]
  });
});

// ============================================================================
// PENGAJUAN - CUTI / IZIN
// ============================================================================
router.get('/pengajuan/cuti', (req, res) => {
  res.render('landing/pengajuan/cuti', {
    title: 'Pengajuan Cuti Akademik',
    user: req.user || null,
    estimasiWaktu: '2-4 hari kerja',
    alur: [
      { icon: 'bi-file-earmark-plus', judul: 'Siapkan Alasan & Bukti', deskripsi: 'Pemohon menyiapkan alasan pengajuan beserta dokumen pendukung (jika ada).' },
      { icon: 'bi-send-check', judul: 'Ajukan Permohonan', deskripsi: 'Pemohon login dan mengisi formulir pengajuan cuti/izin secara daring.' },
      { icon: 'bi-person-check', judul: 'Verifikasi Admin', deskripsi: 'Admin/Kaprodi memeriksa kelengkapan dan kelayakan permohonan.' },
      { icon: 'bi-envelope-check', judul: 'Terbit Surat', deskripsi: 'Surat persetujuan cuti/izin diterbitkan dan dapat diunduh oleh pemohon.' }
    ],
    jenisCuti: [
      { icon: 'bi-mortarboard', judul: 'Cuti Akademik Mahasiswa', deskripsi: 'Penundaan studi sementara dengan alasan tertentu (kesehatan, ekonomi, dll).' },
      { icon: 'bi-person-badge', judul: 'Izin Dosen', deskripsi: 'Permohonan izin tidak hadir mengajar/bertugas bagi dosen.' },
      { icon: 'bi-heart-pulse', judul: 'Izin Sakit', deskripsi: 'Permohonan izin dengan disertai surat keterangan dokter.' }
    ],
    syarat: [
      'Mengisi formulir pengajuan secara daring melalui akun mahasiswa/dosen',
      'Melampirkan surat/bukti pendukung sesuai jenis pengajuan (jika diperlukan)',
      'Tidak memiliki tunggakan administrasi/keuangan (khusus mahasiswa)',
      'Diajukan sebelum atau selambat-lambatnya sesuai batas waktu akademik yang berlaku'
    ],
    dokumen: [
      { nama: 'Formulir Pengajuan Cuti/Izin', keterangan: 'Diisi melalui akun pengguna', url: '#' },
      { nama: 'SOP Cuti Akademik', keterangan: 'Dokumen prosedur lengkap (.pdf)', url: '#' }
    ]
  });
});

// ============================================================================
// PENGAJUAN - KUNJUNGAN INDUSTRI
// ============================================================================
router.get('/pengajuan/kunjungan-industri', (req, res) => {
  res.render('landing/pengajuan/kunjungan_industri', {
    title: 'Pengajuan Kunjungan Industri',
    user: req.user || null,
    estimasiWaktu: '2 minggu',
    alur: [
      { icon: 'bi-building', judul: 'Tentukan Perusahaan Tujuan', deskripsi: 'Panitia/prodi menentukan perusahaan atau instansi tujuan kunjungan industri.' },
      { icon: 'bi-send-check', judul: 'Ajukan Permohonan', deskripsi: 'Pengaju login dan mengisi formulir pengajuan kunjungan industri secara daring.' },
      { icon: 'bi-envelope-paper', judul: 'Surat Permohonan', deskripsi: 'Prodi menerbitkan surat permohonan izin kunjungan ke perusahaan tujuan.' },
      { icon: 'bi-person-check', judul: 'Konfirmasi Perusahaan', deskripsi: 'Menunggu konfirmasi jadwal dan kesediaan dari pihak perusahaan.' },
      { icon: 'bi-bus-front', judul: 'Persiapan Teknis', deskripsi: 'Koordinasi transportasi, akomodasi, dan peserta kunjungan.' },
      { icon: 'bi-camera', judul: 'Pelaksanaan Kunjungan', deskripsi: 'Kunjungan industri dilaksanakan sesuai jadwal yang disepakati.' }
    ],
    syarat: [
      'Diajukan oleh panitia/perwakilan kelas atau program studi',
      'Mengisi formulir pengajuan kunjungan industri secara daring',
      'Melampirkan daftar nama peserta dan dosen pendamping',
      'Diajukan minimal 2 minggu sebelum tanggal rencana pelaksanaan'
    ],
    dokumen: [
      { nama: 'Formulir Pengajuan Kunjungan Industri', keterangan: 'Diisi melalui akun pengguna', url: '#' },
      { nama: 'Template Surat Permohonan', keterangan: 'Contoh format (.docx)', url: '#' },
      { nama: 'SOP Kunjungan Industri', keterangan: 'Dokumen prosedur lengkap (.pdf)', url: '#' }
    ]
  });
});

// ============================================================================
// KERJASAMA PERUSAHAAN
// ============================================================================
router.get('/kerjasama', (req, res) => {
  res.render('landing/kerjasama', {
    title: 'Kerjasama Perusahaan',
    user: req.user || null,
    emailKontak: 'teknikelektronika@polidewa.ac.id',
    bentukKerjasama: [
      { icon: 'bi-briefcase-fill', judul: 'Penempatan Magang', deskripsi: 'Kerjasama penerimaan mahasiswa untuk Praktik Kerja Industri (magang).' },
      { icon: 'bi-mortarboard-fill', judul: 'Kurikulum & Kompetensi', deskripsi: 'Penyelarasan kurikulum dan pelatihan kompetensi sesuai kebutuhan industri.' },
      { icon: 'bi-person-workspace', judul: 'Dosen/Praktisi Tamu', deskripsi: 'Kolaborasi berbagi keahlian melalui kuliah tamu dan pelatihan bersama.' },
      { icon: 'bi-building-fill-gear', judul: 'Kunjungan Industri', deskripsi: 'Kerjasama penyelenggaraan kunjungan/studi lapangan bagi mahasiswa.' },
      { icon: 'bi-person-check-fill', judul: 'Rekrutmen Lulusan', deskripsi: 'Kerjasama penyerapan lulusan Program Studi Teknik Elektronika.' }
    ],
    alur: [
      { icon: 'bi-envelope-paper', judul: 'Penjajakan Awal', deskripsi: 'Perusahaan/instansi menghubungi prodi melalui email atau surat resmi.' },
      { icon: 'bi-people', judul: 'Pertemuan & Diskusi', deskripsi: 'Diskusi bentuk kerjasama yang akan dijalankan kedua belah pihak.' },
      { icon: 'bi-file-earmark-check', judul: 'Penyusunan MoU/PKS', deskripsi: 'Penyusunan naskah kesepahaman (MoU) atau perjanjian kerjasama (PKS).' },
      { icon: 'bi-pen', judul: 'Penandatanganan', deskripsi: 'Penandatanganan dokumen kerjasama oleh pihak berwenang kedua institusi.' },
      { icon: 'bi-arrow-repeat', judul: 'Implementasi & Evaluasi', deskripsi: 'Pelaksanaan program kerjasama serta evaluasi berkala.' }
    ],
    // CATATAN: daftar di bawah ini masih placeholder. Ganti dengan nama
    // perusahaan/instansi mitra yang benar-benar telah menjalin kerjasama
    // resmi (MoU/PKS) dengan program studi.
    mitra: [
      'Mitra Industri 1',
      'Mitra Industri 2',
      'Mitra Industri 3',
      'Mitra Instansi Pemerintah'
    ]
  });
});

// ============================================================================
// EKSPOR ROUTER
// ============================================================================
module.exports = router;