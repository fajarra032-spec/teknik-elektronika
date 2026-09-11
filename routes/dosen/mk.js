/**
 * routes/dosen/mk.js
 * Daftar dan detail mata kuliah yang diampu oleh dosen
 * Dilengkapi dengan upload materi per pertemuan ke Google Drive
 * dan daftar mahasiswa per mata kuliah
 * Terintegrasi dengan folder Data WEB (ID: 17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0)
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { getPeriodeAktif, saveKomponenRubrik } = require('../../helpers/nilaiHelper');
const { detectJenisPraktikum, getModulPraktikumList } = require('../../helpers/modulPraktikumHelper');

console.log('mk.js loaded');

router.use(verifyToken);
router.use(isDosen);

// ============================================================================
// KONSTANTA FOLDER UTAMA (Data WEB)
// ============================================================================
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

// ============================================================================
// FUNGSI BANTU (HELPER)
// ============================================================================

/**
 * Membuat atau mendapatkan subfolder di dalam folder induk
 * @param {string} parentId - ID folder induk
 * @param {string} name - Nama folder yang akan dibuat/dicari
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
 * Mendapatkan folder untuk materi mata kuliah:
 * Data WEB / Dosen / Materi MK / [KodeMK] /
 */
async function getMateriMkFolder(kodeMK) {
  const parentDosen = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Dosen');
  const parentMateri = await getOrCreateSubFolder(parentDosen, 'Materi MK');
  const mkFolder = await getOrCreateSubFolder(parentMateri, kodeMK);
  return mkFolder;
}

/**
 * Menghapus properti dengan nilai undefined dari objek (untuk Firestore)
 */
function removeUndefined(obj) {
  Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
  return obj;
}

// ============================================================================
// DAFTAR MATA KULIAH YANG DIAMPU
// ============================================================================

/**
 * GET /dosen/mk
 * Menampilkan daftar mata kuliah yang diampu
 */
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('mataKuliah')
      .where('dosenIds', 'array-contains', req.dosen.id)
      .orderBy('semester', 'desc')
      .orderBy('kode')
      .get();

    const mkList = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Hitung jumlah mahasiswa terdaftar aktif di MK ini
      let jumlahMahasiswa = 0;
      try {
        // PENTING: filter juga by `semester` (periode aktif) - kalau cuma
        // mkId+status, mahasiswa yang PERNAH ikut MK ini di periode lalu
        // (enrollment lama yang status-nya tidak pernah diubah dari
        // 'active') ikut kehitung terus selamanya, walau sekarang sudah
        // beda semester / sudah lanjut ke MK lain.
        const enrollmentSnapshot = await db.collection('enrollment')
          .where('mkId', '==', doc.id)
          .where('semester', '==', getPeriodeAktif())
          .where('status', '==', 'active')
          .count()
          .get();
        jumlahMahasiswa = enrollmentSnapshot.data().count;
      } catch (err) {
        console.error(`Gagal hitung enrollment untuk MK ${doc.id}:`, err);
      }

      // Hitung progress perkuliahan (dari materi)
      const materi = data.materi || [];
      const terlaksana = materi.filter(m => m.status === 'selesai').length;
      const progress = Math.round((terlaksana / 16) * 100) || 0;

      mkList.push({
        id: doc.id,
        kode: data.kode,
        nama: data.nama,
        semester: data.semester,
        sks: data.sks,
        kelas: data.kelas || null,
        jumlahMahasiswa,
        progress
      });
    }

    res.render('dosen/mk_list', {
      title: 'Mata Kuliah Saya',
      mkList
    });
  } catch (error) {
    console.error('Error ambil mk:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal mengambil data MK'
    });
  }
});

// ============================================================================
// DAFTAR MAHASISWA PER MATA KULIAH
// ============================================================================

/**
 * GET /dosen/mk/:id/mahasiswa
 * Menampilkan daftar mahasiswa yang mengambil mata kuliah tertentu
 */
router.get('/:id/mahasiswa', async (req, res) => {
  try {
    const mkId = req.params.id;
    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    if (!mkDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mata kuliah tidak ditemukan'
      });
    }
    const mk = { id: mkId, ...mkDoc.data() };

    // Cek apakah dosen ini mengampu MK tersebut
    if (!mk.dosenIds || !mk.dosenIds.includes(req.dosen.id)) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki akses ke mata kuliah ini'
      });
    }

    // Ambil enrollment aktif untuk MK ini, DI PERIODE BERJALAN SAJA -
    // lihat catatan di GET '/' di atas soal kenapa filter semester wajib.
    const periodeAktif = getPeriodeAktif();
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkId)
      .where('semester', '==', periodeAktif)
      .where('status', '==', 'active')
      .get();

    const mahasiswaIds = enrollmentSnapshot.docs
      .map(doc => doc.data().userId)
      .filter(uid => uid && typeof uid === 'string' && uid.trim() !== '');

    // ✅ OPTIMISASI KUOTA: ambil semua dokumen users SEKALIGUS lewat
    // db.getAll(), bukan satu per satu di dalam loop serial.
    const mahasiswaList = [];
    if (mahasiswaIds.length > 0) {
      const userDocs = await db.getAll(...mahasiswaIds.map(uid => db.collection('users').doc(uid)));
      userDocs.forEach((userDoc, i) => {
        if (userDoc.exists) {
          mahasiswaList.push({
            id: mahasiswaIds[i],
            nama: userDoc.data().nama,
            nim: userDoc.data().nim,
            foto: userDoc.data().foto,
            kelas: userDoc.data().kelas || null
          });
        }
      });
    }

    // Urutkan berdasarkan NIM
    mahasiswaList.sort((a, b) => a.nim.localeCompare(b.nim));

    res.render('dosen/mk_mahasiswa', {
      title: `Mahasiswa - ${mk.kode} ${mk.nama}`,
      mk,
      mahasiswaList
    });
  } catch (error) {
    console.error('Error ambil mahasiswa per MK:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat daftar mahasiswa'
    });
  }
});

// ============================================================================
// UPDATE PERTEMUAN (dengan upload file)
// ============================================================================

/**
 * POST /dosen/mk/:id/pertemuan/:pertemuan
 * Update data satu pertemuan, termasuk upload materi ke Google Drive
 */
router.post('/:id/pertemuan/:pertemuan', upload.single('file'), async (req, res) => {
  try {
    const { topik, tanggal, catatan, status } = req.body;
    const file = req.file;
    const mkRef = db.collection('mataKuliah').doc(req.params.id);
    const mkDoc = await mkRef.get();

    if (!mkDoc.exists) {
      return res.status(404).send('MK tidak ditemukan');
    }

    // Cek apakah dosen ini berhak mengedit MK tersebut
    const mkData = mkDoc.data();
    if (!mkData.dosenIds || !mkData.dosenIds.includes(req.dosen.id)) {
      return res.status(403).send('Anda tidak berhak mengedit MK ini');
    }

    let materi = mkData.materi || [];
    const idx = materi.findIndex(m => m.pertemuan == req.params.pertemuan);

    // Ambil data lama jika ada
    const old = idx !== -1 ? materi[idx] : {};

    // Siapkan data update, pastikan tidak ada undefined
    const updated = {
      pertemuan: parseInt(req.params.pertemuan),
      updatedAt: new Date().toISOString()
    };

    // Hanya set field jika ada nilai baru (atau gunakan nilai lama)
    if (topik !== undefined) updated.topik = topik;
    else if (old.topik) updated.topik = old.topik;
    else updated.topik = `Pertemuan ${req.params.pertemuan}`;

    if (tanggal !== undefined) updated.tanggal = tanggal;
    else if (old.tanggal) updated.tanggal = old.tanggal;
    else updated.tanggal = null;

    if (status !== undefined) updated.status = status;
    else if (old.status) updated.status = old.status;
    else updated.status = (tanggal ? 'selesai' : 'belum');

    if (catatan !== undefined) updated.catatan = catatan;
    else if (old.catatan) updated.catatan = old.catatan;
    else updated.catatan = '';

    // Proses file jika ada
    if (file) {
      try {
        // Dapatkan folder untuk MK ini berdasarkan kode
        const folderId = await getMateriMkFolder(mkData.kode);
        const fileName = `Pertemuan_${req.params.pertemuan}_${Date.now()}.pdf`;
        const fileMetadata = { name: fileName, parents: [folderId] };
        const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
        const response = await drive.files.create({
          resource: fileMetadata,
          media,
          fields: 'id'
        });
        // Set permission publik
        await drive.permissions.create({
          fileId: response.data.id,
          requestBody: { role: 'reader', type: 'anyone' }
        });
        updated.fileUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      } catch (uploadError) {
        console.error('Gagal upload file ke Drive:', uploadError);
        return res.status(500).send('Gagal mengupload file. Pastikan konfigurasi Drive benar.');
      }
    } else {
      // Jika tidak ada file baru, pertahankan file lama
      if (old.fileUrl) updated.fileUrl = old.fileUrl;
    }

    // Hapus properti undefined (jaga-jaga)
    removeUndefined(updated);

    // Update atau tambahkan ke array materi
    if (idx !== -1) {
      materi[idx] = { ...materi[idx], ...updated };
    } else {
      materi.push(updated);
    }

    // Urutkan berdasarkan pertemuan
    materi.sort((a, b) => a.pertemuan - b.pertemuan);

    // Simpan ke Firestore
    await mkRef.update({
      materi,
      updatedAt: new Date().toISOString()
    });

    res.redirect(`/dosen/mk/${req.params.id}`);
  } catch (error) {
    console.error('Error update pertemuan:', error);
    res.status(500).send('Gagal update pertemuan');
  }
});

// ============================================================================
// ABSENSI PER PERTEMUAN - terintegrasi langsung ke komponen Kehadiran di
// Rubrik Penilaian. Setiap kali absensi satu pertemuan disimpan, jumlah
// hadir & total pertemuan SEMUA mahasiswa di MK ini otomatis dihitung ulang
// dari seluruh riwayat absensi (bukan diketik manual lagi oleh dosen).
// Disimpan di subcollection mataKuliah/{id}/absensi/{pertemuan}.
// ============================================================================

const STATUS_ABSENSI = ['Hadir', 'Izin', 'Sakit', 'Alpa'];

/**
 * Hitung ulang & simpan KEHADIRAN_JUMLAH/KEHADIRAN_TOTAL ke rubrik untuk
 * semua mahasiswa di satu MK, berdasarkan SELURUH riwayat absensi yang
 * pernah diambil (bukan cuma pertemuan yang baru saja diisi).
 */
async function syncAbsensiKeRubrik(mkId, mahasiswaIds, periode) {
  const absensiSnapshot = await db.collection('mataKuliah').doc(mkId).collection('absensi').get();
  const totalPertemuan = absensiSnapshot.size; // jumlah pertemuan yang SUDAH diambil absensinya

  await Promise.all(mahasiswaIds.map(async (uid) => {
    let jumlahHadir = 0;
    absensiSnapshot.docs.forEach(doc => {
      const kehadiran = doc.data().kehadiran || {};
      if (kehadiran[uid] === 'Hadir') jumlahHadir++;
    });
    await saveKomponenRubrik(uid, mkId, 'KEHADIRAN_JUMLAH', jumlahHadir, periode);
    await saveKomponenRubrik(uid, mkId, 'KEHADIRAN_TOTAL', totalPertemuan, periode);
  }));
}

/**
 * GET /dosen/mk/:id/pertemuan/:pertemuan/absensi
 * Form ambil/absensi kehadiran mahasiswa untuk satu pertemuan tertentu.
 */
router.get('/:id/pertemuan/:pertemuan/absensi', async (req, res) => {
  try {
    const mkId = req.params.id;
    const pertemuan = parseInt(req.params.pertemuan);
    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    if (!mkDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    }
    const mk = { id: mkId, ...mkDoc.data() };
    if (!mk.dosenIds || !mk.dosenIds.includes(req.dosen.id)) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke mata kuliah ini' });
    }

    const periodeAktif = getPeriodeAktif();
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkId)
      .where('semester', '==', periodeAktif)
      .where('status', '==', 'active')
      .get();
    const mahasiswaIds = enrollmentSnapshot.docs
      .map(doc => doc.data().userId)
      .filter(uid => uid && typeof uid === 'string' && uid.trim() !== '');

    const mahasiswaList = [];
    if (mahasiswaIds.length > 0) {
      const userDocs = await db.getAll(...mahasiswaIds.map(uid => db.collection('users').doc(uid)));
      userDocs.forEach((userDoc, i) => {
        if (userDoc.exists) {
          mahasiswaList.push({ id: mahasiswaIds[i], nama: userDoc.data().nama, nim: userDoc.data().nim });
        }
      });
    }
    mahasiswaList.sort((a, b) => String(a.nim).localeCompare(String(b.nim)));

    // Ambil data absensi yang sudah pernah diisi (kalau ada), untuk prefill
    const absensiDoc = await db.collection('mataKuliah').doc(mkId).collection('absensi').doc(String(pertemuan)).get();
    const absensiData = absensiDoc.exists ? absensiDoc.data() : null;
    const kehadiranSekarang = absensiData ? (absensiData.kehadiran || {}) : {};

    const topikPertemuan = (mk.materi || []).find(m => m.pertemuan === pertemuan);

    res.render('dosen/absensi_form', {
      title: `Absensi Pertemuan ${pertemuan} - ${mk.kode}`,
      mk,
      pertemuan,
      topik: topikPertemuan ? topikPertemuan.topik : `Pertemuan ${pertemuan}`,
      tanggal: absensiData ? absensiData.tanggal : (topikPertemuan ? topikPertemuan.tanggal : null),
      mahasiswaList,
      kehadiranSekarang,
      statusList: STATUS_ABSENSI
    });
  } catch (error) {
    console.error('Error form absensi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat form absensi' });
  }
});

/**
 * POST /dosen/mk/:id/pertemuan/:pertemuan/absensi
 * Simpan absensi satu pertemuan, lalu sinkronkan otomatis ke komponen
 * Kehadiran di Rubrik Penilaian untuk semua mahasiswa MK ini.
 */
router.post('/:id/pertemuan/:pertemuan/absensi', async (req, res) => {
  try {
    const mkId = req.params.id;
    const pertemuan = parseInt(req.params.pertemuan);
    const { tanggal, mahasiswaIds } = req.body;

    const daftarId = mahasiswaIds ? (Array.isArray(mahasiswaIds) ? mahasiswaIds : [mahasiswaIds]) : [];
    const kehadiran = {};
    daftarId.forEach(uid => {
      const status = req.body[`status_${uid}`];
      kehadiran[uid] = STATUS_ABSENSI.includes(status) ? status : 'Alpa';
    });

    await db.collection('mataKuliah').doc(mkId).collection('absensi').doc(String(pertemuan)).set({
      pertemuan,
      tanggal: tanggal || null,
      kehadiran,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Sinkronkan ke rubrik Kehadiran untuk semua mahasiswa yang absen hari ini
    await syncAbsensiKeRubrik(mkId, daftarId, getPeriodeAktif());

    res.redirect(`/dosen/mk/${mkId}?absensiTersimpan=${pertemuan}`);
  } catch (error) {
    console.error('Error simpan absensi:', error);
    res.status(500).send('Gagal menyimpan absensi: ' + error.message);
  }
});

// ============================================================================
// DETAIL MATA KULIAH
// ============================================================================

/**
 * GET /dosen/mk/:id
 * Detail mata kuliah (RPS, pertemuan, daftar mahasiswa)
 */
router.get('/:id', async (req, res) => {
  try {
    const mkDoc = await db.collection('mataKuliah').doc(req.params.id).get();
    if (!mkDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mata kuliah tidak ditemukan'
      });
    }
    const mk = { id: mkDoc.id, ...mkDoc.data() };

    // Cek apakah dosen ini benar mengampu MK tersebut
    if (!mk.dosenIds || !mk.dosenIds.includes(req.dosen.id)) {
      return res.status(403).render('error', {
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki akses ke mata kuliah ini'
      });
    }

    // ===== AMBIL DAFTAR MAHASISWA DARI ENROLLMENT =====
    // Filter `semester === periodeAktif` juga - lihat catatan di GET '/'
    // paling atas file ini soal kenapa ini wajib (kalau tidak, mahasiswa
    // dari periode lampau ikut nongol terus).
    const periodeAktifDetail = getPeriodeAktif();
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('mkId', '==', req.params.id)
      .where('semester', '==', periodeAktifDetail)
      .where('status', '==', 'active')
      .get();

    const mahasiswaIds = enrollmentSnapshot.docs
      .map(doc => doc.data().userId)
      .filter(uid => uid && typeof uid === 'string' && uid.trim() !== '');

    // ✅ OPTIMISASI KUOTA: ambil semua dokumen users SEKALIGUS, bukan satu
    // per satu di dalam loop serial.
    const mahasiswaList = [];
    if (mahasiswaIds.length > 0) {
      const userDocs = await db.getAll(...mahasiswaIds.map(uid => db.collection('users').doc(uid)));
      userDocs.forEach((userDoc, i) => {
        if (userDoc.exists) {
          mahasiswaList.push({
            id: mahasiswaIds[i],
            nama: userDoc.data().nama,
            nim: userDoc.data().nim,
            foto: userDoc.data().foto,
            kelas: userDoc.data().kelas || null
          });
        }
      });
    }

    // ===== PERTEMUAN (dari materi MK) =====
    const materi = mk.materi || [];
    const pertemuanList = [];
    for (let i = 1; i <= 16; i++) {
      const existing = materi.find(m => m.pertemuan === i) || {};
      pertemuanList.push({
        pertemuan: i,
        topik: existing.topik || `Pertemuan ${i}`,
        tanggal: existing.tanggal || null,
        status: existing.status || 'belum',
        catatan: existing.catatan || '',
        fileUrl: existing.fileUrl || null
      });
    }

    // Hitung progress perkuliahan
    const terlaksana = pertemuanList.filter(p => p.status === 'selesai').length;
    const persentase = Math.round((terlaksana / 16) * 100);

    // ===== DOSEN PENGAMPU =====
    // ✅ OPTIMISASI KUOTA: batch juga, bukan satu per satu.
    const dosenList = [];
    if (mk.dosenIds && mk.dosenIds.length > 0) {
      const dosenDocs = await db.getAll(...mk.dosenIds.map(dId => db.collection('dosen').doc(dId)));
      dosenDocs.forEach(dDoc => {
        if (dDoc.exists) dosenList.push(dDoc.data().nama);
      });
    }

    // ===== TUGAS (opsional) =====
    let tugasList = [];
    try {
      const periodeAktif = getPeriodeAktif();
      let tugasSnapshot;
      try {
        tugasSnapshot = await db.collection('tugas')
          .where('mkId', '==', req.params.id)
          .where('periode', '==', periodeAktif)
          .orderBy('deadline', 'asc')
          .get();
      } catch (indexError) {
        console.error('Index tugas belum siap, fallback:', indexError.message);
        tugasSnapshot = await db.collection('tugas').where('mkId', '==', req.params.id).get();
      }

      if (tugasSnapshot.empty) {
        const semuaSnapshot = await db.collection('tugas').where('mkId', '==', req.params.id).get();
        const perluDitandai = semuaSnapshot.docs.filter(doc => !doc.data().periode);
        if (perluDitandai.length > 0) {
          await Promise.all(perluDitandai.map(doc => doc.ref.update({ periode: periodeAktif }).catch(() => {})));
        }
        tugasSnapshot = semuaSnapshot;
      }

      tugasList = tugasSnapshot.docs
        .filter(doc => (doc.data().periode || periodeAktif) === periodeAktif) // data lama tanpa periode dianggap periode aktif
        .sort((a, b) => (a.data().deadline || '').localeCompare(b.data().deadline || ''))
        .map(doc => ({
        id: doc.id,
        judul: doc.data().judul,
        deadline: doc.data().deadline,
        tipe: doc.data().tipe
      }));
    } catch (err) {
      console.error('Gagal mengambil tugas (mungkin perlu indeks):', err.message);
      // biarkan tugasList kosong
    }

    const jenisPraktikum = detectJenisPraktikum(mk);
    const jumlahModulAktif = jenisPraktikum
      ? getModulPraktikumList(mk).modulList.filter(m => m.aktif).length
      : 0;

    res.render('dosen/mk_detail', {
      title: `${mk.kode} - ${mk.nama}`,
      mk,
      mahasiswaList,
      pertemuanList,
      dosenList,
      terlaksana,
      persentase,
      tugasList,
      jenisPraktikum,
      jumlahModulAktif
    });
  } catch (error) {
    console.error('Error detail mk:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat detail MK'
    });
  }
});

// ============================================================================
// TUGAS (khusus satu MK) - "Buat Tugas" dan "Daftar Tugas" digabung jadi
// satu tampilan di dalam workspace MK, supaya dosen tidak perlu pindah menu.
// Form create di sini POST ke endpoint global /dosen/tugas yang sudah ada
// (lihat routes/dosen/index.js) dengan mkId dikunci + redirectTo balik ke
// halaman ini.
// ============================================================================
router.get('/:id/tugas', async (req, res) => {
  try {
    const mkId = req.params.id;
    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    if (!mkDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    }
    const mk = { id: mkId, ...mkDoc.data() };
    if (!mk.dosenIds || !mk.dosenIds.includes(req.dosen.id)) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke mata kuliah ini' });
    }

    const periodeAktif = getPeriodeAktif();
    const tugasSnapshot = await db.collection('tugas').where('mkId', '==', mkId).get();
    const tugasList = tugasSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(t => (t.periode || periodeAktif) === periodeAktif)
      .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));

    res.render('dosen/mk_tugas', {
      title: `Tugas - ${mk.kode} ${mk.nama}`,
      mk,
      tugasList
    });
  } catch (error) {
    console.error('Error daftar tugas per MK:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat daftar tugas' });
  }
});

// ============================================================================
// MODUL PRAKTIKUM (khusus MK laboratorium: Elektronika Digital, Mikrokontroler, PLC)
// Konsep: setiap MK yang cocok dengan jenis praktikum (lihat
// helpers/modulPraktikumHelper.js) mendapat set job sheet default. Dosen
// bebas memilih modul mana yang dipublikasikan ke ELK-Learning mahasiswa
// (toggle "aktif" per modul), menambahkan catatan/tanggal pelaksanaan,
// serta (opsional) mengunggah job sheet versi sendiri yang menggantikan
// tampilan default.
// ============================================================================

async function getMkUntukPraktikum(req, res) {
  const mkId = req.params.id;
  const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
  if (!mkDoc.exists) {
    res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    return null;
  }
  const mk = { id: mkId, ...mkDoc.data() };
  if (!mk.dosenIds || !mk.dosenIds.includes(req.dosen.id)) {
    res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda tidak memiliki akses ke mata kuliah ini' });
    return null;
  }
  return mk;
}

/**
 * GET /dosen/mk/:id/praktikum
 * Halaman kelola Modul Praktikum untuk satu MK.
 */
router.get('/:id/praktikum', async (req, res) => {
  try {
    const mk = await getMkUntukPraktikum(req, res);
    if (!mk) return;

    const jenis = detectJenisPraktikum(mk);
    if (!jenis) {
      return res.status(404).render('error', {
        title: 'Tidak Tersedia',
        message: 'Modul Praktikum belum disediakan untuk mata kuliah ini. Fitur ini saat ini hanya tersedia untuk mata kuliah Elektronika Digital, Mikrokontroler, dan PLC.'
      });
    }

    const { jenisLabel, modulList } = getModulPraktikumList(mk);
    const jumlahAktif = modulList.filter(m => m.aktif).length;

    res.render('dosen/mk_praktikum', {
      title: `Modul Praktikum - ${mk.kode} ${mk.nama}`,
      mk,
      jenisLabel,
      modulList,
      jumlahAktif,
      praktikumPublished: mk.praktikumPublished === true
    });
  } catch (error) {
    console.error('Error memuat Modul Praktikum:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat Modul Praktikum' });
  }
});

/**
 * POST /dosen/mk/:id/praktikum/publish
 * Saklar utama per-MK: dosen memutuskan apakah bagian "Modul Praktikum"
 * boleh muncul sama sekali di ELK-Learning mahasiswa untuk MK ini.
 * (Modul individual tetap harus diaktifkan satu-satu lewat toggle di bawah.)
 */
router.post('/:id/praktikum/publish', async (req, res) => {
  try {
    const mk = await getMkUntukPraktikum(req, res);
    if (!mk) return;

    const publishedBaru = !(mk.praktikumPublished === true);
    await db.collection('mataKuliah').doc(mk.id).update({
      praktikumPublished: publishedBaru,
      updatedAt: new Date().toISOString()
    });
    res.redirect(`/dosen/mk/${mk.id}/praktikum`);
  } catch (error) {
    console.error('Error toggle publish Modul Praktikum:', error);
    res.status(500).send('Gagal mengubah status publikasi Modul Praktikum');
  }
});

/**
 * POST /dosen/mk/:id/praktikum/:modulId/toggle
 * Aktif/nonaktifkan satu modul praktikum tertentu (tampil/tidak di ELK-Learning).
 */
router.post('/:id/praktikum/:modulId/toggle', async (req, res) => {
  try {
    const mk = await getMkUntukPraktikum(req, res);
    if (!mk) return;

    const modulId = req.params.modulId;
    let modulPraktikum = mk.modulPraktikum || [];
    const idx = modulPraktikum.findIndex(m => m.id === modulId);
    const old = idx !== -1 ? modulPraktikum[idx] : { id: modulId };
    const updated = { ...old, id: modulId, aktif: !(old.aktif === true), updatedAt: new Date().toISOString() };

    if (idx !== -1) modulPraktikum[idx] = updated;
    else modulPraktikum.push(updated);

    await db.collection('mataKuliah').doc(mk.id).update({
      modulPraktikum,
      updatedAt: new Date().toISOString()
    });
    res.redirect(`/dosen/mk/${mk.id}/praktikum`);
  } catch (error) {
    console.error('Error toggle modul praktikum:', error);
    res.status(500).send('Gagal mengubah status modul praktikum');
  }
});

/**
 * POST /dosen/mk/:id/praktikum/:modulId/catatan
 * Simpan catatan/tanggal pelaksanaan + (opsional) upload job sheet versi
 * dosen sendiri untuk satu modul (menggantikan tampilan default di
 * ELK-Learning bila diisi).
 */
router.post('/:id/praktikum/:modulId/catatan', upload.single('file'), async (req, res) => {
  try {
    const mk = await getMkUntukPraktikum(req, res);
    if (!mk) return;

    const modulId = req.params.modulId;
    const { tanggal, catatanDosen } = req.body;

    let modulPraktikum = mk.modulPraktikum || [];
    const idx = modulPraktikum.findIndex(m => m.id === modulId);
    const old = idx !== -1 ? modulPraktikum[idx] : { id: modulId };

    const updated = {
      ...old,
      id: modulId,
      tanggal: tanggal !== undefined ? tanggal : (old.tanggal || null),
      catatanDosen: catatanDosen !== undefined ? catatanDosen : (old.catatanDosen || ''),
      updatedAt: new Date().toISOString()
    };

    if (req.file) {
      const folderId = await getMateriMkFolder(mk.kode);
      const fileName = `Praktikum_${modulId}_${Date.now()}.pdf`;
      const fileMetadata = { name: fileName, parents: [folderId] };
      const media = { mimeType: req.file.mimetype, body: Readable.from(req.file.buffer) };
      const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
      await drive.permissions.create({ fileId: response.data.id, requestBody: { role: 'reader', type: 'anyone' } });
      updated.fileUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      updated.fileNama = req.file.originalname || fileName;
    }

    removeUndefined(updated);
    if (idx !== -1) modulPraktikum[idx] = updated;
    else modulPraktikum.push(updated);

    await db.collection('mataKuliah').doc(mk.id).update({
      modulPraktikum,
      updatedAt: new Date().toISOString()
    });
    res.redirect(`/dosen/mk/${mk.id}/praktikum`);
  } catch (error) {
    console.error('Error simpan catatan modul praktikum:', error);
    res.status(500).send('Gagal menyimpan catatan modul praktikum');
  }
});

module.exports = router;