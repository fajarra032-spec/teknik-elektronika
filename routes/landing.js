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

    // 2. Berita terbaru
    const beritaSnapshot = await db.collection('berita')
      .orderBy('tanggal', 'desc')
      .limit(6)
      .get();
    const berita = beritaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Jadwal penting (event mendatang)
    const today = new Date().toISOString().split('T')[0];
    const jadwalSnapshot = await db.collection('jadwalPenting')
      .where('tanggal', '>=', today)
      .orderBy('tanggal', 'asc')
      .limit(5)
      .get();
    const jadwal = jadwalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
router.get('/berita/:id', async (req, res) => {
  try {
    const berita = await db.collection('berita').doc(req.params.id).get();
    if (!berita.exists) return res.status(404).send('Berita tidak ditemukan');
    res.render('berita_detail', { berita: berita.data() });
  } catch (error) {
    res.status(500).send('Error');
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
// ============================================================================

// Normalisasi status pekerjaan ke satu set nilai baku, karena kedua koleksi
// sumber memakai istilah yang berbeda-beda.
function normalisasiStatus(rawStatus) {
  const map = {
    'kuliah': 'melanjutkan_studi',
    'melanjutkan_studi': 'melanjutkan_studi',
    'belum bekerja': 'belum_bekerja',
    'belum_bekerja': 'belum_bekerja',
    'bekerja': 'bekerja',
    'wirausaha': 'wirausaha'
  };
  return map[rawStatus] || rawStatus || 'belum_bekerja';
}

async function getGabunganLulusan() {
  const [tracerSnap, lulusanSnap] = await Promise.all([
    db.collection('tracerStudy').where('isPublic', '==', true).get(),
    db.collection('lulusan').get()
  ]);

  const dariSurvei = tracerSnap.docs.map(doc => {
    const d = doc.data();
    return {
      id: `survei_${doc.id}`,
      sumber: 'survei',
      nama: d.nama || '-',
      nim: d.nim || '-',
      tahunLulus: d.tahunLulus || null,
      status: normalisasiStatus(d.statusPekerjaan),
      pekerjaan: d.pekerjaan || '',
      tempatKerja: d.namaPerusahaan || d.tempatKerja || '',
      alamatKerja: d.alamatKerja || '',
      gaji: d.gaji || '',
      email: '',
      noHp: '',
      foto: d.fotoUrl || null
    };
  });

  const dariAdmin = lulusanSnap.docs.map(doc => {
    const d = doc.data();
    return {
      id: `manual_${doc.id}`,
      sumber: 'manual',
      nama: d.nama || '-',
      nim: d.nim || '-',
      tahunLulus: d.tahunLulus || null,
      status: normalisasiStatus(d.status),
      pekerjaan: d.pekerjaan || '',
      tempatKerja: d.tempatKerja || '',
      alamatKerja: d.alamatKerja || '',
      gaji: d.gaji || '',
      email: d.email || '',
      noHp: d.noHp || '',
      foto: d.foto || null
    };
  });

  return [...dariSurvei, ...dariAdmin];
}

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
// EKSPOR ROUTER
// ============================================================================
module.exports = router;