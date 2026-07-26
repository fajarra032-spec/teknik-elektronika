/**
 * routes/dokumen.js
 * Halaman-halaman dokumen publik di landing page: kurikulum, SOP/alur
 * pengajuan seminar, pengajuan magang, pengajuan cuti, pengajuan kunjungan
 * industri, dan kerjasama perusahaan.
 */

const express = require('express');
const router = express.Router();
const { db } = require('../config/firebaseAdmin');

/**
 * GET /dokumen/kurikulum
 * Kurikulum diambil langsung dari koleksi mataKuliah (data yang sama dipakai
 * di admin/dosen/mahasiswa), dikelompokkan per semester, supaya selalu
 * sinkron dengan data akademik yang sebenarnya - bukan konten statis terpisah
 * yang bisa basi/tidak sesuai lagi.
 */
router.get('/kurikulum', async (req, res) => {
  try {
    const snapshot = await db.collection('mataKuliah').orderBy('semester', 'asc').get();
    const mkList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const perSemester = {};
    mkList.forEach(mk => {
      const sem = mk.semester || 0;
      if (!perSemester[sem]) perSemester[sem] = [];
      perSemester[sem].push(mk);
    });

    const semesterList = Object.keys(perSemester).sort((a, b) => a - b);
    const totalSks = mkList.reduce((sum, mk) => sum + (parseInt(mk.sks) || 0), 0);

    res.render('dokumen/kurikulum', {
      title: 'Kurikulum',
      description: 'Struktur kurikulum Program Studi Teknik Elektronika Politeknik Dewantara per semester.',
      semesterList,
      perSemester,
      totalMk: mkList.length,
      totalSks,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat kurikulum:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data kurikulum', user: req.user || null });
  }
});

/**
 * GET /dokumen/pengajuan-seminar
 * SOP / alur proses pengajuan seminar (proposal/hasil) magang - halaman statis
 */
router.get('/pengajuan-seminar', (req, res) => {
  res.render('dokumen/pengajuan_seminar', {
    title: 'Alur Pengajuan Seminar',
    description: 'SOP dan alur proses pengajuan seminar magang mahasiswa Teknik Elektronika Politeknik Dewantara.',
    user: req.user || null
  });
});

/**
 * GET /dokumen/pengajuan-magang
 * SOP / alur proses pengajuan magang - halaman statis
 */
router.get('/pengajuan-magang', (req, res) => {
  res.render('dokumen/pengajuan_magang', {
    title: 'Alur Pengajuan Magang',
    description: 'SOP dan alur proses pengajuan magang (PKL) mahasiswa Teknik Elektronika Politeknik Dewantara.',
    user: req.user || null
  });
});

/**
 * GET /dokumen/pengajuan-cuti
 * SOP / alur proses pengajuan cuti akademik - halaman statis
 */
router.get('/pengajuan-cuti', (req, res) => {
  res.render('dokumen/pengajuan_cuti', {
    title: 'Alur Pengajuan Cuti Akademik',
    description: 'SOP dan alur proses pengajuan cuti akademik mahasiswa Teknik Elektronika Politeknik Dewantara.',
    user: req.user || null
  });
});

/**
 * GET /dokumen/kunjungan-industri
 * SOP / alur proses pengajuan kunjungan industri - halaman statis
 */
router.get('/kunjungan-industri', (req, res) => {
  res.render('dokumen/kunjungan_industri', {
    title: 'Pengajuan Kunjungan Industri',
    description: 'SOP dan alur pengajuan kunjungan industri ke Program Studi Teknik Elektronika Politeknik Dewantara.',
    user: req.user || null
  });
});

/**
 * GET /dokumen/kerjasama-perusahaan
 * Info kerjasama perusahaan, dilengkapi daftar perusahaan mitra yang sudah
 * pernah bekerja sama (diambil dari riwayat penempatan magang / magangPeriod)
 * sebagai bukti sosial (social proof), bukan sekadar teks statis.
 */
router.get('/kerjasama-perusahaan', async (req, res) => {
  try {
    const snapshot = await db.collection('magangPeriod').get();
    const perusahaanMap = new Map();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const per = data.perusahaan;
      if (!per || !per.nama) return;
      const key = per.nama.trim().toLowerCase();
      if (!perusahaanMap.has(key)) {
        perusahaanMap.set(key, { nama: per.nama, alamat: per.alamat || '' });
      }
    });
    const perusahaanList = Array.from(perusahaanMap.values()).sort((a, b) => a.nama.localeCompare(b.nama));

    res.render('dokumen/kerjasama_perusahaan', {
      title: 'Kerjasama Perusahaan',
      description: 'Informasi kerjasama industri dan mitra perusahaan Program Studi Teknik Elektronika Politeknik Dewantara.',
      perusahaanList,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat kerjasama perusahaan:', error);
    // Tetap tampilkan halaman meski daftar mitra gagal dimuat
    res.render('dokumen/kerjasama_perusahaan', {
      title: 'Kerjasama Perusahaan',
      description: 'Informasi kerjasama industri dan mitra perusahaan Program Studi Teknik Elektronika Politeknik Dewantara.',
      perusahaanList: [],
      user: req.user || null
    });
  }
});

/**
 * GET /dokumen/kontrak-kuliah
 * Halaman info + unduh template Kontrak Kuliah (dipakai dosen pengampu untuk
 * menyusun kontrak kuliah tiap mata kuliah semester berjalan). Berkas .docx
 * ada di public/dokumen/kontrak-kuliah/Kontrak_Kuliah_Template.docx
 */
router.get('/kontrak-kuliah', (req, res) => {
  res.render('dokumen/kontrak_kuliah', {
    title: 'Kontrak Kuliah',
    description: 'Template Kontrak Kuliah Program Studi Teknik Elektronika Politeknik Dewantara.',
    fileUrl: '/dokumen/kontrak-kuliah/Kontrak_Kuliah_Template.docx',
    user: req.user || null
  });
});

/**
 * GET /dokumen/sop-pelaporan-nilai
 * Halaman info + unduh SOP Pelaporan Nilai Mahasiswa (dokumen mutu tingkat
 * program studi). Berkas .docx ada di
 * public/dokumen/sop/SOP_Pelaporan_Nilai_Mahasiswa.docx
 */
router.get('/sop-pelaporan-nilai', (req, res) => {
  res.render('dokumen/sop_pelaporan_nilai', {
    title: 'SOP Pelaporan Nilai Mahasiswa',
    description: 'Standar Operasional Prosedur (SOP) Pelaporan Nilai Mahasiswa Program Studi Teknik Elektronika Politeknik Dewantara.',
    fileUrl: '/dokumen/sop/SOP_Pelaporan_Nilai_Mahasiswa.docx',
    user: req.user || null
  });
});

module.exports = router;
