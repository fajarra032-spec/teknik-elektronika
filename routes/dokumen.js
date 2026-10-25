/**
 * routes/dokumen.js
 * Halaman-halaman dokumen publik di landing page: kurikulum, RPS, notulensi,
 * SOP/alur pengajuan seminar, pengajuan magang, pengajuan cuti, pengajuan
 * kunjungan industri, dan kerjasama perusahaan.
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
 * GET /dokumen/rps
 * RPS (Rencana Pembelajaran Semester) - sebelumnya link ini ada di menu nav
 * ("Layanan" > "RPS") tapi TIDAK PERNAH di-routing (views/landing/dokumen/rps.ejs
 * sudah ada tapi menganggur), jadi selalu 404. Sekarang disambungkan, memakai
 * data mataKuliah yang sama dengan /dokumen/kurikulum supaya field rpsUrl
 * selalu sinkron dengan yang dikelola admin (lihat routes/admin/rps.js).
 */
router.get('/rps', async (req, res) => {
  try {
    const snapshot = await db.collection('mataKuliah').orderBy('semester', 'asc').orderBy('kode', 'asc').get();
    const mkList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const perSemester = {};
    mkList.forEach(mk => {
      const sem = mk.semester || 0;
      if (!perSemester[sem]) perSemester[sem] = [];
      perSemester[sem].push({
        kode: mk.kode,
        nama: mk.nama,
        jenis: mk.isPDK ? 'Praktik Dunia Kerja' : 'Reguler',
        url: mk.rpsUrl || null
      });
    });

    const rpsSemester = Object.keys(perSemester)
      .sort((a, b) => a - b)
      .map(sem => ({ semester: sem, matkul: perSemester[sem] }));

    res.render('landing/dokumen/rps', {
      title: 'RPS',
      description: 'Rencana Pembelajaran Semester (RPS) tiap mata kuliah Program Studi Teknik Elektronika.',
      rpsSemester,
      tahunKurikulum: new Date().getFullYear(),
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat RPS:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data RPS', user: req.user || null });
  }
});

/**
 * GET /dokumen/notulensi
 * Agenda & Hasil Rapat - sama seperti /dokumen/rps, link ini sebelumnya
 * TIDAK di-routing sama sekali sehingga 404 (views/landing/dokumen/notulensi.ejs
 * sudah ada tapi menganggur). Disambungkan ke koleksi Firestore 'notulensi'.
 * CATATAN: belum ada CRUD admin untuk mengisi koleksi ini - untuk sementara
 * halaman akan tampil dengan status "belum ada data" sampai fitur kelola
 * notulensi rapat dibuat di sisi admin.
 */
router.get('/notulensi', async (req, res) => {
  try {
    const snapshot = await db.collection('notulensi').orderBy('tanggal', 'desc').limit(50).get();
    const notulensi = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        tanggalTampil: data.tanggal
          ? new Date(data.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
          : '-',
        agenda: Array.isArray(data.agenda) ? data.agenda : [],
        hasil: Array.isArray(data.hasil) ? data.hasil : [],
        daftarHadir: Array.isArray(data.daftarHadir) ? data.daftarHadir : []
      };
    });

    res.render('landing/dokumen/notulensi', {
      title: 'Agenda & Hasil Rapat',
      description: 'Dokumentasi agenda dan hasil rapat Program Studi Teknik Elektronika.',
      notulensi,
      user: req.user || null
    });
  } catch (error) {
    console.error('Error memuat notulensi:', error);
    // Koleksi 'notulensi' mungkin belum pernah dibuat sama sekali di Firestore -
    // tampilkan halaman kosong yang rapi, bukan error 500.
    res.render('landing/dokumen/notulensi', {
      title: 'Agenda & Hasil Rapat',
      description: 'Dokumentasi agenda dan hasil rapat Program Studi Teknik Elektronika.',
      notulensi: [],
      user: req.user || null
    });
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

// ============================================================================
// KUNJUNGAN INDUSTRI
// Publik mengisi formulir -> masuk ke admin (/admin/kunjungan-industri) ->
// setelah admin mengisi nomor surat, surat permohonan terbit otomatis dan
// tampil di bagian "Pengajuan yang Disetujui" (cetak / unduh PDF).
// ============================================================================
const KI = require('../helpers/kunjunganIndustriHelper');
const { getAllMataKuliah } = require('../helpers/cache');
const { notifikasiAdmin } = require('../helpers/peminjamanAlatHelper');

async function daftarMkPublik() {
  const semua = await getAllMataKuliah(db);
  return semua
    .filter(m => m.nama)
    .map(m => ({ id: m.id, kode: m.kode || '', nama: m.nama, semester: m.semester || 0, sks: m.sks || '' }))
    .sort((a, b) => (a.semester - b.semester) || a.nama.localeCompare(b.nama));
}

async function renderKunjungan(req, res, extra = {}, status = 200) {
  const [mkList, disetujui] = await Promise.all([daftarMkPublik(), KI.getDisetujuiPublik(db)]);

  // Cek status pengajuan memakai kode pengajuan (publik tidak punya akun)
  let cekStatus = null;
  const kode = String(req.query.kode || '').trim().toUpperCase().slice(0, 40);
  if (kode) {
    const snap = await db.collection(KI.KOLEKSI).where('kode', '==', kode).limit(1).get();
    if (snap.empty) cekStatus = { kode, tidakDitemukan: true };
    else {
      const d = snap.docs[0].data();
      cekStatus = {
        kode, status: d.status, label: KI.STATUS_LABEL[d.status] || d.status,
        namaPerusahaan: d.namaPerusahaan, tanggalKunjungan: d.tanggalKunjungan,
        nomorSurat: d.status === KI.STATUS.DISETUJUI ? d.nomorSurat : '',
        suratId: d.status === KI.STATUS.DISETUJUI ? snap.docs[0].id : '',
        alasanPenolakan: d.status === KI.STATUS.DITOLAK ? (d.alasanPenolakan || '') : ''
      };
    }
  }

  res.status(status).render('dokumen/kunjungan_industri', {
    title: 'Pengajuan Kunjungan Industri',
    description: 'Formulir pengajuan kunjungan industri Program Studi Teknik Elektronika Politeknik Dewantara dan daftar pengajuan yang disetujui.',
    user: req.user || null,
    mkList, disetujui, cekStatus,
    terkirim: String(req.query.terkirim || '').slice(0, 40),
    hariIni: KI.hariIni(),
    tanggalPanjang: KI.tanggalPanjang, rentangHari: KI.rentangHari,
    form: {}, err: '', ts: Date.now(),
    ...extra
  });
}

router.get('/kunjungan-industri', async (req, res) => {
  try {
    await renderKunjungan(req, res);
  } catch (error) {
    console.error('Error halaman kunjungan industri:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat halaman kunjungan industri' });
  }
});

router.post('/kunjungan-industri', async (req, res) => {
  try {
    const b = req.body || {};
    // Honeypot: kolom "website" disembunyikan dari manusia; bot biasanya mengisinya.
    if (b.website) return res.redirect('/dokumen/kunjungan-industri');

    const gagal = (pesan) => renderKunjungan(req, res, { form: b, err: pesan }, 400);
    const waktuIsi = Date.now() - parseInt(b.ts, 10);
    if (!Number.isFinite(waktuIsi) || waktuIsi < 3000) return gagal('Formulir terkirim terlalu cepat. Silakan periksa isian lalu kirim ulang.');
    if (!KI.lolosBatasKiriman(req.ip || 'x')) return gagal('Terlalu banyak pengajuan dari perangkat ini. Coba lagi dalam satu jam.');

    const mkMap = new Map((await daftarMkPublik()).map(m => [m.id, m]));
    const hasil = KI.validasiPengajuan(b, mkMap);
    if (hasil.error) return gagal(hasil.error);

    KI.catatKiriman(req.ip || 'x');
    const kode = KI.generateKodePengajuan();
    const now = new Date().toISOString();
    const ref = await db.collection(KI.KOLEKSI).add({
      ...hasil.data,
      kode, status: KI.STATUS.DIAJUKAN,
      nomorSurat: '', tanggalSurat: '', kodeValidasi: '', pdfUrl: '', pdfFileId: '',
      riwayat: [{ status: KI.STATUS.DIAJUKAN, oleh: hasil.data.namaPengaju, catatan: 'Pengajuan dibuat', waktu: now }],
      ip: req.ip || '', createdAt: now, updatedAt: now
    });

    await notifikasiAdmin(db, {
      type: 'kunjungan_industri', title: 'Pengajuan kunjungan industri baru',
      message: `${hasil.data.namaPengaju} mengajukan kunjungan ke ${hasil.data.namaPerusahaan} (${kode})`,
      link: `/admin/kunjungan-industri/${ref.id}`
    });
    res.redirect(`/dokumen/kunjungan-industri?terkirim=${encodeURIComponent(kode)}#form`);
  } catch (error) {
    console.error('Error submit kunjungan industri:', error);
    res.status(500).render('error', { title: 'Error', message: 'Terjadi kesalahan saat mengirim pengajuan. Silakan coba lagi.' });
  }
});

// Surat permohonan yang sudah terbit (hanya pengajuan berstatus disetujui)
async function ambilSuratTerbit(id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const doc = await db.collection(KI.KOLEKSI).doc(id).get();
  if (!doc.exists) return null;
  const p = { id: doc.id, ...doc.data() };
  return p.status === KI.STATUS.DISETUJUI && p.nomorSurat ? p : null;
}

router.get('/kunjungan-industri/surat/:id', async (req, res) => {
  try {
    const p = await ambilSuratTerbit(req.params.id);
    if (!p) return res.status(404).render('404', { title: 'Surat tidak ditemukan', user: req.user || null });
    res.render('dokumen/surat_kunjungan_industri', { ...KI.dataSurat(p), pdfUrl: p.pdfUrl || '', mode: 'preview' });
  } catch (error) {
    console.error('Error tampil surat kunjungan industri:', error);
    res.status(500).send('Gagal memuat surat');
  }
});

router.get('/kunjungan-industri/surat/:id/pdf', async (req, res) => {
  try {
    const p = await ambilSuratTerbit(req.params.id);
    if (!p) return res.status(404).render('404', { title: 'Surat tidak ditemukan', user: req.user || null });
    if (!p.pdfUrl) return res.redirect(`/dokumen/kunjungan-industri/surat/${p.id}`); // PDF belum ada -> buka versi cetak
    res.redirect(p.pdfUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal mengunduh surat');
  }
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
