/**
 * routes/landing.js
 * Halaman utama publik (landing page) dan halaman publik lainnya
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getProgressMagangHarian } = require('../helpers/magangHelper');
const { getGabunganLulusan, normalisasiStatus } = require('../helpers/lulusanHelper');

// ============================================================================
// FUNGSI BANTU
// ============================================================================
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
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

    const mahasiswaSnapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
    let aktifCount = 0;
    let magangCount = 0;
    mahasiswaSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.statusMahasiswa === 'Aktif' || data.status === 'aktif') aktifCount++;
      if (data.statusMagang && (data.statusMagang.includes('Magang') || data.statusMagang === 'Selesai Magang')) magangCount++;
    });
    statistik.mahasiswaAktif = aktifCount;
    statistik.mahasiswaMagang = magangCount;
    const dosenSnapshot = await db.collection('dosen').get();
    const jumlahDosen = dosenSnapshot.size;

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

    // 4. Jadwal seminar
    const seminarSnapshot = await db.collection('seminar')
      .orderBy('tanggal', 'asc')
      .limit(5)
      .get();
    const seminar = seminarSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
      lulusan,
      aktivitas,
      dosenList,
      lulusanKerja,
      magangSlides,
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

    // Data Mahasiswa
    let mahasiswa = [];
    const mhsSnapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
    mahasiswa = mhsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

    // Mata kuliah yang diprogram
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', id)
      .where('status', '==', 'active')
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
    const doc = await db.collection('berita').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).render('404', { title: 'Berita Tidak Ditemukan', user: req.user || null });
    }
    const berita = doc.data();
    const isiPolos = (berita.isi || '').replace(/<[^>]*>?/gm, '').trim();
    const description = isiPolos.length > 160 ? isiPolos.substring(0, 157) + '...' : (isiPolos || 'Berita Program Studi Teknik Elektronika Politeknik Dewantara.');

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
// Catatan: data kurikulum di bawah ini masih statis (custom), silakan
// disesuaikan oleh admin prodi sesuai kurikulum resmi yang berlaku.
// Jika suatu saat ingin dihubungkan ke Firestore (mis. koleksi
// 'kurikulumPublik'), cukup ganti bagian ini dengan query db.collection(...).
router.get('/dokumen/kurikulum', (req, res) => {
  const kurikulum = [
    {
      semester: 1,
      mataKuliah: [
        { kode: 'MK101', nama: 'Pendidikan Agama', sks: 2, sifat: 'Wajib' },
        { kode: 'MK102', nama: 'Pendidikan Pancasila', sks: 2, sifat: 'Wajib' },
        { kode: 'MK103', nama: 'Bahasa Indonesia', sks: 2, sifat: 'Wajib' },
        { kode: 'MK104', nama: 'Matematika Teknik I', sks: 3, sifat: 'Wajib' },
        { kode: 'MK105', nama: 'Rangkaian Listrik', sks: 3, sifat: 'Wajib' },
        { kode: 'MK106', nama: 'Dasar Elektronika', sks: 3, sifat: 'Wajib' },
        { kode: 'MK107', nama: 'Praktik Bengkel & K3', sks: 2, sifat: 'Wajib' }
      ]
    },
    {
      semester: 2,
      mataKuliah: [
        { kode: 'MK201', nama: 'Bahasa Inggris Teknik', sks: 2, sifat: 'Wajib' },
        { kode: 'MK202', nama: 'Matematika Teknik II', sks: 3, sifat: 'Wajib' },
        { kode: 'MK203', nama: 'Elektronika Digital', sks: 3, sifat: 'Wajib' },
        { kode: 'MK204', nama: 'Pemrograman Dasar', sks: 3, sifat: 'Wajib' },
        { kode: 'MK205', nama: 'Praktik Elektronika Dasar', sks: 3, sifat: 'Wajib' },
        { kode: 'MK206', nama: 'Gambar Teknik', sks: 2, sifat: 'Wajib' }
      ]
    },
    {
      semester: 3,
      mataKuliah: [
        { kode: 'MK301', nama: 'Mikrokontroler', sks: 3, sifat: 'Wajib' },
        { kode: 'MK302', nama: 'Sistem Kendali', sks: 3, sifat: 'Wajib' },
        { kode: 'MK303', nama: 'Instrumentasi Industri', sks: 3, sifat: 'Wajib' },
        { kode: 'MK304', nama: 'Jaringan Komputer', sks: 3, sifat: 'Wajib' },
        { kode: 'MK305', nama: 'Praktik Mikrokontroler', sks: 3, sifat: 'Wajib' },
        { kode: 'MK306', nama: 'Kewirausahaan', sks: 2, sifat: 'Wajib' }
      ]
    },
    {
      semester: 4,
      mataKuliah: [
        { kode: 'MK401', nama: 'PLC & Otomasi Industri', sks: 3, sifat: 'Wajib' },
        { kode: 'MK402', nama: 'Internet of Things (IoT)', sks: 3, sifat: 'Wajib' },
        { kode: 'MK403', nama: 'Sistem Tertanam', sks: 3, sifat: 'Wajib' },
        { kode: 'MK404', nama: 'Praktik PLC', sks: 3, sifat: 'Wajib' },
        { kode: 'MK405', nama: 'Metodologi Penelitian', sks: 2, sifat: 'Wajib' },
        { kode: 'MK406', nama: 'Elektronika Daya', sks: 3, sifat: 'Wajib' }
      ]
    },
    {
      semester: 5,
      mataKuliah: [
        { kode: 'MK501', nama: 'Praktik Kerja Industri (Magang)', sks: 8, sifat: 'Wajib' },
        { kode: 'MK502', nama: 'Pembimbingan Magang', sks: 2, sifat: 'Wajib' }
      ]
    },
    {
      semester: 6,
      mataKuliah: [
        { kode: 'MK601', nama: 'Seminar Hasil Magang', sks: 2, sifat: 'Wajib' },
        { kode: 'MK602', nama: 'Tugas Akhir', sks: 4, sifat: 'Wajib' },
        { kode: 'MK603', nama: 'Etika Profesi', sks: 2, sifat: 'Wajib' },
        { kode: 'MK604', nama: 'Mata Kuliah Pilihan', sks: 3, sifat: 'Pilihan' }
      ]
    }
  ];

  const totalSemester = kurikulum.length;
  const totalMk = kurikulum.reduce((a, s) => a + s.mataKuliah.length, 0);
  const totalSks = kurikulum.reduce((a, s) => a + s.mataKuliah.reduce((x, mk) => x + mk.sks, 0), 0);

  res.render('landing/dokumen/kurikulum', {
    title: 'Kurikulum - Teknik Elektronika',
    user: req.user || null,
    kurikulum,
    totalSemester,
    totalMk,
    totalSks,
    tahunKurikulum: '2023',
    profilLulusan: 'Lulusan Program Studi Teknik Elektronika disiapkan menjadi tenaga ahli madya yang kompeten di bidang instrumentasi, otomasi industri, dan sistem elektronika tertanam, serta mampu beradaptasi dengan perkembangan teknologi industri 4.0.',
    cpl: [
      'Mampu merancang, membangun, dan menguji rangkaian elektronika dan sistem kendali sederhana.',
      'Mampu mengoperasikan dan memelihara peralatan instrumentasi dan otomasi industri.',
      'Mampu bekerja secara profesional, bertanggung jawab, dan menjunjung etika kerja di dunia industri.',
      'Mampu berkomunikasi dan bekerja sama dalam tim lintas disiplin.'
    ],
    fileKurikulum: '#'
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