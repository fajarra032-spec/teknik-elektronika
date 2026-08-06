// routes/dosen/rubrik.js
// Rubrik Penilaian (Kehadiran, Sikap, Keaktifan, Tugas, Kuis, UTS, UAS)
// untuk diisi dosen per mata kuliah yang diampu. Nilai Tugas ditarik otomatis
// dari koleksi 'tugas'/'nilai' (modul e-learning yang sudah ada) supaya dosen
// tidak input dobel; komponen lain (Kehadiran/Sikap/Keaktifan/Kuis/UTS/UAS)
// diisi langsung di sini.

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const {
  getPeriodeAktif,
  saveBobotRubrik,
  saveKomponenRubrik,
  getRincianTugasByMkId,
  getHasilRubrikSatuMahasiswa,
  getHasilRubrikSemuaMahasiswa,
  tambahTugasManual,
  hapusTugasManual,
  saveNilaiTugasManual,
  getKontrakKuliah,
  saveKontrakKuliah,
  hitungRubrik
} = require('../../helpers/nilaiHelper');
const { getSemesterForDate } = require('../../helpers/academicHelper');

router.use(verifyToken);
router.use(isDosen);

/**
 * Ambil banyak dokumen `users` SEKALIGUS (satu round-trip via db.getAll),
 * bukan satu per satu dalam loop - jauh lebih hemat kuota utk kelas besar.
 */
async function getMahasiswaBanyak(uids) {
  if (uids.length === 0) return {};
  const refs = uids.map(uid => db.collection('users').doc(uid));
  const docs = await db.getAll(...refs);
  const map = {};
  docs.forEach((doc, i) => {
    map[uids[i]] = doc.exists ? { id: uids[i], ...doc.data() } : { id: uids[i], nama: 'Unknown', nim: '-' };
  });
  return map;
}

/**
 * Kumpulkan data rubrik lengkap (komponen + hitungan) untuk semua mahasiswa
 * aktif di satu MK. Dipakai bersama oleh halaman input & halaman cetak.
 */
async function ambilDataRubrik(mkId, periode) {
  const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
  if (!mkDoc.exists) return null;
  const mk = { id: mkId, ...mkDoc.data() };

  const enrollmentSnapshot = await db.collection('enrollment')
    .where('mkId', '==', mkId)
    .where('status', '==', 'active')
    .get();
  const mahasiswaIds = enrollmentSnapshot.docs.map(d => d.data().userId);

  const { bobot, komponenMap, hasilMap } = await getHasilRubrikSemuaMahasiswa(mkId, periode);
  const mahasiswaMap = await getMahasiswaBanyak(mahasiswaIds); // 1 round-trip, bukan N

  const data = [];
  for (const uid of mahasiswaIds) {
    const mahasiswa = mahasiswaMap[uid];
    const komponen = komponenMap[uid] || {};
    const hasil = hasilMap[uid] || hitungRubrik({}, null, bobot);
    data.push({ mahasiswa, komponen, hasil });
  }
  data.sort((a, b) => String(a.mahasiswa.nim).localeCompare(String(b.mahasiswa.nim)));

  return { mk, bobot, data };
}

/**
 * Susun rincian nilai per-tugas (WEB + MANUAL) untuk halaman cetak
 * "Penilaian" (rincian per tugas, beda dari halaman Rubrik yang cuma
 * menampilkan rata-ratanya). Pakai ulang `hasil.data` dari ambilDataRubrik
 * (tidak query enrollment lagi) dan getRincianTugasByMkId (satu sumber data
 * yang sama dengan halaman "Rincian Tugas", supaya angkanya selalu sinkron
 * dan Tugas Manual ikut tercetak juga).
 */
async function ambilDataPenilaian(mkId, periode, hasilRubrik) {
  const { tugasList, perMahasiswa } = await getRincianTugasByMkId(mkId, periode);
  const data = hasilRubrik.data.map(item => {
    const uid = item.mahasiswa.id;
    const nilaiMahasiswa = perMahasiswa[uid] || {};
    const nilaiPerTugas = tugasList.map(tugas => ({
      tugasId: tugas.id,
      nilai: nilaiMahasiswa[tugas.id] ?? null
    }));
    return { mahasiswa: item.mahasiswa, nilaiPerTugas };
  });
  return { tugasList, data };
}

/**
 * Susun daftar 16 pertemuan (topik/materi ada-tidak + catatan) dari field
 * `materi` pada dokumen mataKuliah, untuk halaman cetak "Berita Acara
 * Pengajaran". Logika sinkron dengan routes/dosen/mk.js (GET /:id). Fungsi
 * murni (tidak akses DB) - `mk` sudah punya field `materi` dari ambilDataRubrik.
 */
function ambilDataPertemuan(mk) {
  const materi = mk.materi || [];
  const pertemuanList = [];
  for (let i = 1; i <= 16; i++) {
    const existing = materi.find(m => m.pertemuan === i) || {};
    pertemuanList.push({
      pertemuan: i,
      topik: existing.topik || '',
      tanggal: existing.tanggal || null,
      adaMateri: !!(existing.fileUrl || existing.topik),
      catatan: existing.catatan || ''
    });
  }
  return pertemuanList;
}

// ============================================================================
// PILIH MATA KULIAH
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const mkSnapshot = await db.collection('mataKuliah')
      .where('dosenIds', 'array-contains', req.dosen.id)
      .orderBy('semester', 'desc')
      .orderBy('kode')
      .get();

    const mkList = await Promise.all(mkSnapshot.docs.map(async (doc) => {
      const mk = { id: doc.id, ...doc.data() };
      try {
        const countSnap = await db.collection('enrollment')
          .where('mkId', '==', doc.id)
          .where('status', '==', 'active')
          .count().get();
        mk.jumlahMahasiswa = countSnap.data().count;
      } catch (err) {
        // Fallback kalau versi firebase-admin belum dukung count()
        const enrollmentSnapshot = await db.collection('enrollment')
          .where('mkId', '==', doc.id)
          .where('status', '==', 'active')
          .get();
        mk.jumlahMahasiswa = enrollmentSnapshot.size;
      }
      return mk;
    }));

    res.render('dosen/rubrik_pilih_mk', {
      title: 'Rubrik Penilaian - Pilih Mata Kuliah',
      mkList
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengambil data mata kuliah' });
  }
});

// ============================================================================
// TUGAS MANUAL - untuk tugas yang diberikan TIDAK lewat web (kertas, lisan,
// praktikum tanpa upload, dll) tapi tetap ikut dihitung sebagai bagian dari
// rata-rata "Tugas" di Rubrik. Dikelola langsung dari halaman Rincian Tugas.
// ============================================================================
router.post('/:mkId/tugas-manual', async (req, res) => {
  try {
    const { mkId } = req.params;
    const { judul, periode } = req.body;
    if (!judul || !judul.trim()) {
      return res.status(400).send('Judul tugas manual wajib diisi');
    }
    await tambahTugasManual(mkId, req.dosen.id, judul.trim(), periode || getPeriodeAktif());
    res.redirect(`/dosen/rubrik/${mkId}/rincian-tugas?periode=${encodeURIComponent(periode || getPeriodeAktif())}`);
  } catch (error) {
    console.error('Error tambah tugas manual:', error);
    res.status(500).send('Gagal menambah tugas manual: ' + error.message);
  }
});

router.post('/:mkId/tugas-manual/:tugasManualId/hapus', async (req, res) => {
  try {
    const { mkId, tugasManualId } = req.params;
    const periode = req.body.periode || getPeriodeAktif();
    await hapusTugasManual(tugasManualId);
    res.redirect(`/dosen/rubrik/${mkId}/rincian-tugas?periode=${encodeURIComponent(periode)}`);
  } catch (error) {
    console.error('Error hapus tugas manual:', error);
    res.status(500).send('Gagal menghapus tugas manual: ' + error.message);
  }
});

// Simpan nilai satu mahasiswa untuk satu tugas manual (AJAX, dipanggil dari
// halaman Rincian Tugas) - lalu kembalikan rata-rata Tugas terbaru mahasiswa
// itu supaya frontend bisa update tanpa reload.
router.post('/tugas-manual/nilai', async (req, res) => {
  try {
    const { mkId, mahasiswaId, tugasManualId, nilai, periode } = req.body;
    if (!mkId || !mahasiswaId || !tugasManualId) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }
    const periodeDipakai = periode || getPeriodeAktif();
    await saveNilaiTugasManual(mahasiswaId, mkId, tugasManualId, nilai, periodeDipakai);

    // ✅ OPTIMISASI KUOTA: pakai versi khusus satu mahasiswa (lihat komentar
    // panjang di getHasilRubrikSatuMahasiswa, helpers/nilaiHelper.js) -
    // BUKAN getRataTugasByMkId yang membaca ulang seluruh kelas.
    const hasil = await getHasilRubrikSatuMahasiswa(mahasiswaId, mkId, periodeDipakai);

    res.json({ success: true, rataTugas: hasil.rataTugas });
  } catch (error) {
    console.error('Error simpan nilai tugas manual:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan nilai: ' + error.message });
  }
});

// ============================================================================
// RINCIAN TUGAS (akumulasi Tugas 1, 2, 3, dst per mahasiswa) - alat bantu
// dosen memverifikasi rata-rata Tugas di rubrik sudah sinkron dengan
// Daftar Tugas, sekaligus melihat rincian nilai tiap tugas per mahasiswa.
// ============================================================================
router.get('/:mkId/rincian-tugas', async (req, res) => {
  try {
    const { mkId } = req.params;
    const periode = req.query.periode || getPeriodeAktif();

    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    if (!mkDoc.exists) return res.status(404).send('Mata kuliah tidak ditemukan');
    const mk = { id: mkId, ...mkDoc.data() };

    const enrollmentSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkId)
      .where('status', '==', 'active')
      .get();
    const mahasiswaIds = enrollmentSnapshot.docs.map(d => d.data().userId);

    const { tugasList, perMahasiswa } = await getRincianTugasByMkId(mkId, periode);

    // --- Diagnostik: cari tugas milik dosen ini (periode sama) yang KODE
    // MK-nya sama persis dengan MK yang sedang dibuka, TAPI mkId-nya
    // BERBEDA. Ini kemungkinan besar penyebab tugas "tidak sinkron" yang
    // tidak bisa diperbaiki lewat logika query saja - biasanya karena ada
    // dokumen mataKuliah duplikat (mis. sisa dari semester sebelumnya) untuk
    // MK yang terlihat sama di UI tapi beda ID Firestore-nya.
    let tugasSalahMk = [];
    try {
      const semuaTugasDosenSnapshot = await db.collection('tugas')
        .where('dosenId', '==', req.dosen.id)
        .get();
      tugasSalahMk = semuaTugasDosenSnapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.mkKode === mk.kode && t.mkId !== mkId && (!t.periode || t.periode === periode));
    } catch (diagErr) {
      console.error('Diagnostik rincian tugas gagal (diabaikan):', diagErr);
    }

    const mahasiswaMap = await getMahasiswaBanyak(mahasiswaIds); // 1 round-trip, bukan N
    const data = mahasiswaIds.map(uid => ({ mahasiswa: mahasiswaMap[uid], nilai: perMahasiswa[uid] || null }));
    data.sort((a, b) => String(a.mahasiswa.nim).localeCompare(String(b.mahasiswa.nim)));

    res.render('dosen/rubrik_rincian_tugas', {
      title: `Rincian Tugas - ${mk.kode} ${mk.nama}`,
      mk,
      tugasList,
      data,
      periode,
      tugasSalahMk
    });
  } catch (error) {
    console.error('Error rincian tugas:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat rincian tugas: ' + error.message });
  }
});

// ============================================================================
// HALAMAN INPUT RUBRIK PER MK
// ============================================================================
router.get('/:mkId', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const [hasil, kontrakKuliah] = await Promise.all([
      ambilDataRubrik(req.params.mkId, periode),
      getKontrakKuliah(req.params.mkId, periode)
    ]);
    if (!hasil) return res.status(404).send('Mata kuliah tidak ditemukan');

    res.render('dosen/rubrik_input', {
      title: `Rubrik Penilaian - ${hasil.mk.kode} ${hasil.mk.nama}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode,
      kontrakKuliah
    });
  } catch (error) {
    console.error('Error rubrik input:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat rubrik: ' + error.message });
  }
});

// ============================================================================
// SIMPAN ISIAN KONTRAK KULIAH (beda tiap dosen/MK - dipakai di halaman cetak)
// ============================================================================
router.post('/:mkId/kontrak-kuliah', async (req, res) => {
  try {
    const { mkId } = req.params;
    const { periode, deskripsi, kriteriaKelulusan, tataTertib } = req.body;
    const periodeDipakai = periode || getPeriodeAktif();
    await saveKontrakKuliah(mkId, periodeDipakai, { deskripsi, kriteriaKelulusan, tataTertib });
    req.session.success = 'Isian Kontrak Kuliah berhasil disimpan';
    res.redirect(`/dosen/rubrik/${mkId}?periode=${encodeURIComponent(periodeDipakai)}`);
  } catch (error) {
    console.error('Error simpan kontrak kuliah:', error);
    res.status(500).send('Gagal menyimpan Kontrak Kuliah: ' + error.message);
  }
});

// ============================================================================
// SIMPAN BOBOT KOMPONEN RUBRIK UNTUK MK INI
// ============================================================================
router.post('/:mkId/bobot', async (req, res) => {
  try {
    const { mkId } = req.params;
    const periode = req.body.periode || getPeriodeAktif();
    const bobot = {
      kehadiran: parseFloat(req.body.kehadiran) || 0,
      tugas: parseFloat(req.body.tugas) || 0,
      kuis: parseFloat(req.body.kuis) || 0,
      uts: parseFloat(req.body.uts) || 0,
      uas: parseFloat(req.body.uas) || 0,
      persenHadir: parseFloat(req.body.persenHadir) || 0,
      sikap: parseFloat(req.body.sikap) || 0,
      keaktifan: parseFloat(req.body.keaktifan) || 0
    };
    await saveBobotRubrik(mkId, bobot, periode);
    res.redirect(`/dosen/rubrik/${mkId}?periode=${encodeURIComponent(periode)}`);
  } catch (error) {
    console.error('Error simpan bobot rubrik:', error);
    res.status(500).send('Gagal menyimpan bobot: ' + error.message);
  }
});

// ============================================================================
// SIMPAN SATU KOMPONEN NILAI (kehadiran/sikap/keaktifan/kuis/uts/uas) - AJAX
// ============================================================================
router.post('/input', async (req, res) => {
  try {
    const { mkId, mahasiswaId, tipe, nilai, periode } = req.body;
    if (!mkId || !mahasiswaId || !tipe) {
      return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }
    const periodeDipakai = periode || getPeriodeAktif();
    await saveKomponenRubrik(mahasiswaId, mkId, tipe, nilai, periodeDipakai);

    // ✅ OPTIMISASI KUOTA: sebelumnya bagian ini memanggil
    // getKomponenRubrikByMkId() + getRataTugasByMkId(), yang MASING-MASING
    // membaca ulang SELURUH koleksi 'nilai' untuk SEMUA mahasiswa di MK ini -
    // padahal cuma perlu hasil utk SATU mahasiswa yang baru diedit. Untuk
    // kelas 30 mahasiswa, tiap kali dosen mengetik satu nilai (auto-save)
    // ini bisa membaca ratusan dokumen yang tidak relevan. Sekarang pakai
    // getHasilRubrikSatuMahasiswa() yang query-nya sudah dipersempit
    // langsung ke satu mahasiswa ini saja.
    const hasil = await getHasilRubrikSatuMahasiswa(mahasiswaId, mkId, periodeDipakai);

    res.json({ success: true, hasil });
  } catch (error) {
    console.error('Error input komponen rubrik:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan nilai: ' + error.message });
  }
});

// ============================================================================
// CETAK DOKUMEN PERKULIAHAN (5 halaman: Penilaian, Rubrik, Kontrak Kuliah,
// Berita Acara Pengajaran, Berita Acara Serah Terima Nilai) - via print
// dialog browser.
// ============================================================================
router.get('/:mkId/cetak', async (req, res) => {
  try {
    const { mkId } = req.params;
    const periode = req.query.periode || getPeriodeAktif();
    const hasil = await ambilDataRubrik(mkId, periode);
    if (!hasil) return res.status(404).send('Mata kuliah tidak ditemukan');

    const namaDosen = req.dosen.nama || req.user.nama || '-';
    const nuptkDosen = req.dosen.nuptk || req.dosen.nidn || '-';

    const [penilaian, kontrakKuliah] = await Promise.all([
      ambilDataPenilaian(mkId, periode, hasil),
      getKontrakKuliah(mkId, periode)
    ]);
    const pertemuanList = ambilDataPertemuan(hasil.mk);
    const terlaksana = pertemuanList.filter(p => p.adaMateri).length;

    // Info semester Ganjil/Genap & tahun akademik untuk Berita Acara -
    // dihitung dari tanggal SEKARANG (kapan dokumen ini dicetak), bukan
    // dari periode MK yang mungkin sedang dipilih dosen di dropdown.
    const infoSemester = getSemesterForDate(new Date());

    res.render('rubrik_print', {
      title: `Cetak Dokumen Perkuliahan - ${hasil.mk.kode}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode,
      namaDosen,
      nuptkDosen,
      penilaian,
      pertemuanList,
      terlaksana,
      infoSemester,
      kontrakKuliah
    });
  } catch (error) {
    console.error('Error cetak rubrik:', error);
    res.status(500).send('Gagal memuat halaman cetak: ' + error.message);
  }
});

module.exports = router;
