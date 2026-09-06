/**
 * routes/mahasiswa/elearning.js
 * Modul ELK‑Learning Mahasiswa: jadwal kuliah, tugas, kumpul tugas
 * REVISI: Menambah cek duplikasi, validasi deadline, dan fitur revisi
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { getPeriodeAktif } = require('../../helpers/nilaiHelper');
const { periodeKeUrutan } = require('../../helpers/academicHelper');
const { mataKuliahCache, tugasAktifCache, dosenCache } = require('../../helpers/cache');

// ============================================================================
// KONSTANTA FOLDER UTAMA (Data WEB)
// ============================================================================
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

// Semua route memerlukan autentikasi
router.use(verifyToken);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/**
 * Sanitasi string untuk nama folder/file (hapus karakter khusus, spasi jadi underscore)
 * @param {string} str - String yang akan disanitasi
 * @returns {string} String yang sudah aman
 */
function sanitizeName(str) {
  if (!str) return '';
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Ubah label periode ("Ganjil 2026/2027") jadi angka urutan yang bisa
 * dibandingkan, supaya daftar periode di dropdown bisa diurutkan dari yang
 * terbaru. Label yang tidak dikenali formatnya ditaruh paling belakang.
 */
function parseLabelKeUrutan(label) {
  const match = (label || '').match(/^(Ganjil|Genap)\s+(\d{4})\/(\d{4})$/);
  if (!match) return -1;
  const [, semester, tahunAwal] = match;
  return periodeKeUrutan(parseInt(tahunAwal, 10), semester);
}

/**
 * Daftar SEMUA periode/tahun akademik yang pernah dipunyai mahasiswa ini
 * (dari field `semester` di dokumen enrollment - lihat aktifkanPaketKrs()
 * di helpers/paketKurikulumHelper.js, yang mengisi field ini dengan label
 * seperti "Ganjil 2025/2026"). Diurutkan terbaru dulu - dipakai untuk
 * mengisi dropdown "Tahun Akademik" di halaman ELK-Learning, supaya
 * mahasiswa semester 3 ke atas tidak melihat mata kuliah semester
 * lama-nya bercampur dengan yang sekarang.
 */
async function getDaftarPeriodeMahasiswa(userId) {
  const snapshot = await db.collection('enrollment').where('userId', '==', userId).get();
  const labelSet = new Set();
  snapshot.docs.forEach(doc => {
    if (doc.data().semester) labelSet.add(doc.data().semester);
  });
  return Array.from(labelSet).sort((a, b) => parseLabelKeUrutan(b) - parseLabelKeUrutan(a));
}

/**
 * Mendapatkan mata kuliah yang diambil mahasiswa (dari enrollment)
 * @param {string} userId - UID mahasiswa
 * @param {string} [periodeLabel] - kalau diisi, cuma ambil enrollment periode
 *   ini (mis. "Ganjil 2026/2027"). Kalau kosong, ambil SEMUA periode
 *   (perilaku lama, dipakai tempat lain yang belum butuh filter periode).
 * @returns {Promise<Array>} daftar mata kuliah dengan detail
 */
async function getMataKuliahDiambil(userId, periodeLabel) {
  try {
    let query = db.collection('enrollment')
      .where('userId', '==', userId)
      .where('status', '==', 'active');
    if (periodeLabel) query = query.where('semester', '==', periodeLabel);
    const enrollmentSnapshot = await query.get();

    // Ambil data mata kuliah lewat cache (mataKuliah jarang berubah, jadi
    // tidak perlu baca ulang ke Firestore di setiap kunjungan dashboard oleh
    // setiap mahasiswa). Dijalankan paralel, bukan satu-satu berurutan.
    const mkList = await Promise.all(enrollmentSnapshot.docs.map(async (doc) => {
      const mkId = doc.data().mkId;
      const mkData = await mataKuliahCache.getOrFetch(mkId, async () => {
        const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
        return mkDoc.exists ? mkDoc.data() : null;
      });
      if (!mkData) return null;
      return {
        id: mkId,
        ...mkData,
        enrollmentId: doc.id,
        semester: doc.data().semester,
        tahunAjaran: doc.data().tahunAjaran
      };
    }));

    return mkList.filter(Boolean);
  } catch (error) {
    console.error('Error getMataKuliahDiambil:', error);
    return [];
  }
}

/**
 * Mendapatkan materi pertemuan (dari field materi)
 * @param {Object} mk - data mata kuliah
 * @returns {Array} daftar pertemuan (1‑16)
 */
function getMateri(mk) {
  const materi = mk.materi || [];
  const pertemuanList = [];
  for (let i = 1; i <= 16; i++) {
    const existing = materi.find(m => m.pertemuan === i) || {};
    pertemuanList.push({
      pertemuan: i,
      topik: existing.topik || `Pertemuan ${i}`,
      tanggal: existing.tanggal || null,
      status: existing.status || 'belum',
      fileUrl: existing.fileUrl || null
    });
  }
  return pertemuanList;
}

/**
 * Mendapatkan status pengumpulan untuk setiap tugas
 * @param {string} tugasId - ID tugas
 * @param {string} mahasiswaId - UID mahasiswa
 * @returns {Promise<Object|null>} data pengumpulan atau null
 */
async function getPengumpulan(tugasId, mahasiswaId) {
  try {
    const snapshot = await db.collection('pengumpulan')
      .where('tugasId', '==', tugasId)
      .where('mahasiswaId', '==', mahasiswaId)
      .limit(1)
      .get();
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error('Error getPengumpulan:', error);
    return null;
  }
}

/**
 * Membuat atau mendapatkan subfolder di dalam folder induk
 * @param {string} parentId - ID folder induk
 * @param {string} name - Nama folder yang akan dibuat/dicari (sudah disanitasi)
 * @returns {Promise<string>} ID folder
 */
async function getOrCreateSubFolder(parentId, name) {
  const query = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) {
    return query.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
      fields: 'id',
    });
    return folder.data.id;
  }
}

/**
 * Membuat folder di Google Drive untuk jawaban mahasiswa dengan struktur:
 * Data WEB / Tugas / [TahunAjaran] / [NamaMK] / Jawaban / [NIM] /
 * @param {Object} mk - data mata kuliah (harus memiliki nama)
 * @param {string} nim - NIM mahasiswa
 * @param {string} tahunAjaran - Tahun ajaran (contoh: "2025/2026")
 * @returns {Promise<string>} ID folder tempat menyimpan jawaban
 */
async function getOrCreateJawabanFolder(mk, nim, tahunAjaran) {
  const tugasFolderId = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Tugas');
  const tahunFolder = await getOrCreateSubFolder(tugasFolderId, tahunAjaran);
  const sanitizedNamaMK = sanitizeName(mk.nama);
  const mkFolder = await getOrCreateSubFolder(tahunFolder, sanitizedNamaMK);
  const jawabanFolder = await getOrCreateSubFolder(mkFolder, 'Jawaban');
  const nimFolder = await getOrCreateSubFolder(jawabanFolder, nim);
  return nimFolder;
}

// ============================================================================
// HALAMAN UTAMA E‑LEARNING (TABEL)
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const daftarPeriode = await getDaftarPeriodeMahasiswa(req.user.id);
    const periodeAktif = getPeriodeAktif();

    // Tentukan periode yang ditampilkan: dari query ?periode=... kalau valid
    // (mahasiswa memang punya enrollment di periode itu), kalau tidak pakai
    // periode aktif (kalau mahasiswa punya enrollment di periode aktif), atau
    // periode PALING BARU yang dia punya (jaga-jaga kalau periode aktif belum
    // ada KRS-nya, mis. semester depan belum diaktifkan).
    let periodeDipilih = req.query.periode;
    if (!periodeDipilih || !daftarPeriode.includes(periodeDipilih)) {
      periodeDipilih = daftarPeriode.includes(periodeAktif) ? periodeAktif : (daftarPeriode[0] || periodeAktif);
    }

    let mkList = await getMataKuliahDiambil(req.user.id, periodeDipilih);
    
    // Filter: JANGAN tampilkan mata kuliah PDK (Praktik Dunia Kerja)
    mkList = mkList.filter(mk => !mk.isPDK);
    
    const now = new Date();

    await Promise.all(mkList.map(async (mk) => {
      // Hitung jumlah mahasiswa terdaftar di MK ini (query count() sudah murah,
      // dibilling sebagai 1 read terlepas dari jumlah dokumen yang cocok)
      const countSnapshot = await db.collection('enrollment')
        .where('mkId', '==', mk.id)
        .where('status', '==', 'active')
        .count()
        .get();
      mk.jumlahMahasiswa = countSnapshot.data().count;

      // Hitung progress perkuliahan (dari field materi)
      const materi = mk.materi || [];
      const terlaksana = materi.filter(m => m.status === 'selesai').length;
      mk.progressPertemuan = {
        total: 16,
        terlaksana: terlaksana,
        persen: Math.round((terlaksana / 16) * 100)
      };

      // Cek apakah ada tugas aktif (deadline > sekarang) - di-cache singkat (3
      // menit) karena hasil ini sama untuk semua mahasiswa di MK yang sama,
      // jadi tidak perlu query ulang setiap kali dashboard dibuka.
      mk.adaTugasAktif = await tugasAktifCache.getOrFetch(`ada-tugas-aktif:${mk.id}`, async () => {
        const tugasSnapshot = await db.collection('tugas')
          .where('mkId', '==', mk.id)
          .where('deadline', '>', now.toISOString())
          .limit(1)
          .get();
        return !tugasSnapshot.empty;
      });
    }));

    res.render('mahasiswa/elearning/index', {
      title: 'ELK‑Learning',
      mkList,
      daftarPeriode,
      periodeDipilih,
      periodeAktif
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal memuat halaman e‑learning');
  }
});

// ============================================================================
// DETAIL MATA KULIAH (JADWAL, MATERI, TUGAS)
// ============================================================================

router.get('/mk/:id', async (req, res) => {
  try {
    const mkId = req.params.id;
    const mkData = await mataKuliahCache.getOrFetch(mkId, async () => {
      const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
      return mkDoc.exists ? mkDoc.data() : null;
    });
    if (!mkData) return res.status(404).send('Mata kuliah tidak ditemukan');
    const mk = { id: mkId, ...mkData };

    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', req.user.id)
      .where('mkId', '==', mkId)
      .where('status', '==', 'active')
      .get();
    if (enrollmentSnapshot.empty) {
      return res.status(403).send('Anda tidak terdaftar di mata kuliah ini');
    }

    const jadwal = mk.jadwal || 'Jadwal belum diatur';
    const materi = mk.materi || [];
    const pertemuanList = [];
    for (let i = 1; i <= 16; i++) {
      const existing = materi.find(m => m.pertemuan === i) || {};
      pertemuanList.push({
        pertemuan: i,
        topik: existing.topik || `Pertemuan ${i}`,
        tanggal: existing.tanggal || null,
        status: existing.status || 'belum',
        fileUrl: existing.fileUrl || null
      });
    }

    const dosenList = (await Promise.all((mk.dosenIds || []).map(async (dId) => {
      const dData = await dosenCache.getOrFetch(dId, async () => {
        const dDoc = await db.collection('dosen').doc(dId).get();
        return dDoc.exists ? dDoc.data() : null;
      });
      return dData ? { id: dId, nama: dData.nama } : null;
    }))).filter(Boolean);

    const countSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkId)
      .where('status', '==', 'active')
      .count()
      .get();
    const jumlahMahasiswa = countSnapshot.data().count;

    const periodeAktif = getPeriodeAktif();
    let tugasSnapshot;
    try {
      tugasSnapshot = await db.collection('tugas')
        .where('mkId', '==', mkId)
        .where('periode', '==', periodeAktif)
        .orderBy('deadline', 'asc')
        .get();
    } catch (indexError) {
      // Index composite belum siap di Firestore - mundur ke query aman
      console.error('Index tugas(mkId,periode,deadline) belum siap, fallback:', indexError.message);
      tugasSnapshot = await db.collection('tugas').where('mkId', '==', mkId).get();
    }

    if (tugasSnapshot.empty) {
      // Fallback + self-heal: data lama mungkin belum ditandai periode
      const semuaSnapshot = await db.collection('tugas').where('mkId', '==', mkId).get();
      const perluDitandai = semuaSnapshot.docs.filter(doc => !doc.data().periode);
      if (perluDitandai.length > 0) {
        await Promise.all(perluDitandai.map(doc => doc.ref.update({ periode: periodeAktif }).catch(() => {})));
      }
      tugasSnapshot = semuaSnapshot;
    }

    const tugasList = [];
    for (const doc of tugasSnapshot.docs) {
      const tugas = { id: doc.id, ...doc.data() };
      if ((tugas.periode || periodeAktif) !== periodeAktif) continue; // data lama tanpa periode dianggap periode aktif
      const pengumpulan = await getPengumpulan(tugas.id, req.user.id);
      tugas.pengumpulan = pengumpulan;
      tugasList.push(tugas);
    }
    tugasList.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

    res.render('mahasiswa/elearning/mk_detail', {
      title: `${mk.kode} - ${mk.nama}`,
      mk,
      jadwal,
      materi: pertemuanList,
      dosenList,
      jumlahMahasiswa,
      tugasList
    });
  } catch (error) {
    console.error('Error detail MK:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal memuat detail mata kuliah' 
    });
  }
});

// ============================================================================
// TUGAS AKTIF
// ============================================================================

router.get('/tugas-aktif', async (req, res) => {
  try {
    const userId = req.user.id;
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    const mkIds = enrollmentSnapshot.docs.map(doc => doc.data().mkId);
    const now = new Date().toISOString();

    // ✅ OPTIMISASI KUOTA: sebelumnya query 'tugas' dijalankan TERPISAH utk
    // SETIAP MK yang diambil mahasiswa (N query serial utk N MK). Sekarang
    // di-batch pakai `where(...,'in',...)` per 10 mkId sekaligus, dijalankan
    // paralel (bukan for-loop serial).
    function chunkArray(arr, size) {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    }

    let tugasRaw = [];
    if (mkIds.length > 0) {
      const chunks = chunkArray(mkIds, 10);
      const snapshots = await Promise.all(chunks.map(chunk =>
        db.collection('tugas').where('mkId', 'in', chunk).where('deadline', '>', now).get()
      ));
      snapshots.forEach(snap => {
        snap.docs.forEach(doc => tugasRaw.push({ id: doc.id, ...doc.data() }));
      });
    }

    // Ambil data MK (pakai cache yang sudah ada, dijalankan paralel per mkId unik)
    const mkIdUnik = [...new Set(tugasRaw.map(t => t.mkId))];
    const mkDataMap = new Map();
    await Promise.all(mkIdUnik.map(async mkId => {
      const mkData = await mataKuliahCache.getOrFetch(mkId, async () => {
        const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
        return mkDoc.exists ? mkDoc.data() : null;
      });
      mkDataMap.set(mkId, mkData);
    }));

    // ✅ OPTIMISASI KUOTA: pengumpulan tadinya di-cek SATU PER SATU per tugas
    // (N query serial utk N tugas aktif). Sekarang di-batch pakai
    // `where('tugasId','in',...)` per 10 tugasId sekaligus (mahasiswaId
    // tetap sama - userId - jadi cukup 1 filter equality + 1 filter 'in').
    const tugasIds = tugasRaw.map(t => t.id);
    const pengumpulanMap = new Map(); // tugasId -> pengumpulan
    if (tugasIds.length > 0) {
      const chunks = chunkArray(tugasIds, 10);
      const snapshots = await Promise.all(chunks.map(chunk =>
        db.collection('pengumpulan')
          .where('tugasId', 'in', chunk)
          .where('mahasiswaId', '==', userId)
          .get()
      ));
      snapshots.forEach(snap => {
        snap.docs.forEach(doc => {
          const data = doc.data();
          pengumpulanMap.set(data.tugasId, { id: doc.id, ...data });
        });
      });
    }

    const tugasList = tugasRaw.map(tugas => {
      const mkData = mkDataMap.get(tugas.mkId);
      return {
        ...tugas,
        mkKode: mkData ? mkData.kode : '-',
        mkNama: mkData ? mkData.nama : '-',
        pengumpulan: pengumpulanMap.get(tugas.id) || null
      };
    });

    tugasList.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    res.render('mahasiswa/elearning/tugas_aktif', {
      title: 'Tugas Aktif',
      user: req.user,
      tugasList
    });
  } catch (error) {
    console.error('Error mengambil tugas aktif:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat tugas aktif'
    });
  }
});

// ============================================================================
// DETAIL TUGAS
// ============================================================================

router.get('/tugas/:id', async (req, res) => {
  try {
    const tugasId = req.params.id;
    const tugasDoc = await db.collection('tugas').doc(tugasId).get();
    if (!tugasDoc.exists) return res.status(404).send('Tugas tidak ditemukan');
    const tugas = { id: tugasId, ...tugasDoc.data() };

    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', req.user.id)
      .where('mkId', '==', tugas.mkId)
      .where('status', '==', 'active')
      .get();
    if (enrollmentSnapshot.empty) {
      return res.status(403).send('Anda tidak terdaftar di mata kuliah tugas ini');
    }

    const mkData = await mataKuliahCache.getOrFetch(tugas.mkId, async () => {
      const mkDoc = await db.collection('mataKuliah').doc(tugas.mkId).get();
      return mkDoc.exists ? mkDoc.data() : null;
    });
    const mk = mkData ? { id: tugas.mkId, ...mkData } : { kode: '-', nama: '-' };

    const pengumpulan = await getPengumpulan(tugasId, req.user.id);
    const deadline = new Date(tugas.deadline);
    const sekarang = new Date();
    const deadlineLewat = deadline < sekarang;

    res.render('mahasiswa/elearning/tugas_detail', {
      title: tugas.judul,
      tugas,
      mk,
      pengumpulan,
      deadlineLewat,
      sekarang: sekarang.toISOString()
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal memuat detail tugas');
  }
});

// ============================================================================
// KUMPUL TUGAS (DENGAN CEK DUPLIKAT & DEADLINE)
// ============================================================================

router.post('/tugas/:id/kumpul', upload.single('file'), async (req, res) => {
  try {
    const tugasId = req.params.id;
    const mahasiswaId = req.user.id;
    const file = req.file;
    
    if (!file) return res.status(400).send('Pilih file terlebih dahulu');

    // ========== VALIDASI 1: CEK TUGAS ==========
    const tugasDoc = await db.collection('tugas').doc(tugasId).get();
    if (!tugasDoc.exists) return res.status(404).send('Tugas tidak ditemukan');
    const tugas = tugasDoc.data();

    // ========== VALIDASI 2: CEK DEADLINE ==========
    const deadline = new Date(tugas.deadline);
    if (deadline < new Date()) {
      return res.status(400).send('Deadline sudah lewat, tidak dapat mengumpulkan tugas.');
    }

    // ========== VALIDASI 3: CEK MAHASISWA TERDAFTAR ==========
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', mahasiswaId)
      .where('mkId', '==', tugas.mkId)
      .where('status', '==', 'active')
      .get();
    
    if (enrollmentSnapshot.empty) {
      return res.status(403).send('Anda tidak terdaftar di mata kuliah ini');
    }

    // ========== VALIDASI 4: CEK DUPLIKAT (PENTING!) ==========
    const existing = await getPengumpulan(tugasId, mahasiswaId);
    if (existing) {
      // Jika sudah pernah mengumpul dan sudah dinilai, TOLAK
      if (existing.nilai) {
        return res.status(400).send('Tugas sudah dinilai, tidak dapat mengubah jawaban.');
      }
      // Jika belum dinilai, beri pesan untuk menggunakan fitur revisi
      return res.status(400).send('Anda sudah mengumpulkan tugas ini. Gunakan fitur "Revisi Jawaban" jika ingin mengganti file.');
    }

    // ========== PROSES UPLOAD ==========
    const mk = await mataKuliahCache.getOrFetch(tugas.mkId, async () => {
      const mkDoc = await db.collection('mataKuliah').doc(tugas.mkId).get();
      return mkDoc.exists ? mkDoc.data() : null;
    });
    const enrollment = enrollmentSnapshot.docs[0].data();
    const tahunAjaran = enrollment.tahunAjaran || '2025/2026';
    const nim = req.user.nim;
    const nama = req.user.nama;

    const folderId = await getOrCreateJawabanFolder({ nama: mk.nama }, nim, tahunAjaran);

    const sanitizedNama = sanitizeName(nama);
    const sanitizedJudul = sanitizeName(tugas.judul);
    const ext = file.originalname.split('.').pop();
    const fileName = `${sanitizedNama}_${nim}_${sanitizedJudul}_${Date.now()}.${ext}`;
    
    const fileMetadata = { name: fileName, parents: [folderId] };
    const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
    const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id, webViewLink' });

    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    await db.collection('pengumpulan').add({
      tugasId,
      mahasiswaId: req.user.id,
      fileUrl: response.data.webViewLink,
      fileId: response.data.id,
      submittedAt: new Date().toISOString(),
      status: 'dikumpulkan',
      nilai: null,
      komentar: null,
      revisionCount: 0
    });

    res.redirect(`/mahasiswa/elearning/tugas/${tugasId}`);
    
  } catch (error) {
    console.error('Gagal upload tugas:', error);
    res.status(500).send('Upload gagal: ' + error.message);
  }
});

// ============================================================================
// REVISI TUGAS (UPDATE, BUKAN CREATE BARU)
// ============================================================================

router.post('/tugas/:id/revisi', upload.single('file'), async (req, res) => {
  try {
    const tugasId = req.params.id;
    const mahasiswaId = req.user.id;
    const file = req.file;
    
    if (!file) return res.status(400).send('Pilih file terlebih dahulu');

    // ========== VALIDASI 1: CEK TUGAS ==========
    const tugasDoc = await db.collection('tugas').doc(tugasId).get();
    if (!tugasDoc.exists) return res.status(404).send('Tugas tidak ditemukan');
    const tugas = tugasDoc.data();

    // ========== VALIDASI 2: CEK DEADLINE ==========
    const deadline = new Date(tugas.deadline);
    if (deadline < new Date()) {
      return res.status(400).send('Deadline sudah lewat, tidak dapat merevisi tugas.');
    }

    // ========== VALIDASI 3: CEK MAHASISWA TERDAFTAR ==========
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', mahasiswaId)
      .where('mkId', '==', tugas.mkId)
      .where('status', '==', 'active')
      .get();
    
    if (enrollmentSnapshot.empty) {
      return res.status(403).send('Anda tidak terdaftar di mata kuliah ini');
    }

    // ========== VALIDASI 4: CEK APAKAH SUDAH PERNAH MENGUMPUL ==========
    const existingSnapshot = await db.collection('pengumpulan')
      .where('tugasId', '==', tugasId)
      .where('mahasiswaId', '==', mahasiswaId)
      .get();
    
    if (existingSnapshot.empty) {
      return res.status(400).send('Belum ada pengumpulan. Gunakan tombol "Kumpul Tugas".');
    }

    const existingDoc = existingSnapshot.docs[0];
    const existingData = existingDoc.data();

    // ========== VALIDASI 5: CEK APAKAH SUDAH DINILAI ==========
    if (existingData.nilai) {
      return res.status(400).send('Tugas sudah dinilai, tidak dapat direvisi.');
    }

    // ========== HAPUS FILE LAMA ==========
    if (existingData.fileId) {
      try {
        await drive.files.delete({ fileId: existingData.fileId });
        console.log('File lama dihapus:', existingData.fileId);
      } catch (err) {
        console.error('Gagal hapus file lama:', err.message);
      }
    }

    // ========== UPLOAD FILE BARU ==========
    const mk = await mataKuliahCache.getOrFetch(tugas.mkId, async () => {
      const mkDoc = await db.collection('mataKuliah').doc(tugas.mkId).get();
      return mkDoc.exists ? mkDoc.data() : null;
    });
    const enrollment = enrollmentSnapshot.docs[0].data();
    const tahunAjaran = enrollment.tahunAjaran || '2025/2026';
    const nim = req.user.nim;
    const nama = req.user.nama;

    const folderId = await getOrCreateJawabanFolder({ nama: mk.nama }, nim, tahunAjaran);

    const sanitizedNama = sanitizeName(nama);
    const sanitizedJudul = sanitizeName(tugas.judul);
    const ext = file.originalname.split('.').pop();
    const fileName = `Revisi_${sanitizedNama}_${nim}_${sanitizedJudul}_${Date.now()}.${ext}`;
    
    const fileMetadata = { name: fileName, parents: [folderId] };
    const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
    const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id, webViewLink' });

    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });

    // ========== UPDATE (BUKAN CREATE BARU) ==========
    await existingDoc.ref.update({
      fileUrl: response.data.webViewLink,
      fileId: response.data.id,
      revisedAt: new Date().toISOString(),
      revisionCount: (existingData.revisionCount || 0) + 1,
      status: 'dikumpulkan'
    });

    res.redirect(`/mahasiswa/elearning/tugas/${tugasId}`);
    
  } catch (error) {
    console.error('Revisi gagal:', error);
    res.status(500).send('Revisi gagal: ' + error.message);
  }
});

// ============================================================================
// HAPUS PENGUMPULAN
// ============================================================================

router.post('/tugas/:id/hapus', async (req, res) => {
  try {
    const tugasId = req.params.id;
    const pengumpulan = await getPengumpulan(tugasId, req.user.id);
    if (!pengumpulan) return res.status(404).send('Tidak ada pengumpulan untuk dihapus');

    const tugasDoc = await db.collection('tugas').doc(tugasId).get();
    const deadline = new Date(tugasDoc.data().deadline);
    if (deadline < new Date()) {
      return res.status(400).send('Tidak dapat menghapus karena deadline telah lewat');
    }

    if (pengumpulan.nilai) {
      return res.status(400).send('Tugas sudah dinilai, tidak dapat dihapus');
    }

    if (pengumpulan.fileId) {
      try {
        await drive.files.delete({ fileId: pengumpulan.fileId });
      } catch (err) {
        console.error('Gagal hapus file Drive:', err);
      }
    }

    await db.collection('pengumpulan').doc(pengumpulan.id).delete();
    res.redirect(`/mahasiswa/elearning/tugas/${tugasId}`);
  } catch (error) {
    console.error('Gagal hapus pengumpulan:', error);
    res.status(500).send('Gagal menghapus pengumpulan');
  }
});

module.exports = router;