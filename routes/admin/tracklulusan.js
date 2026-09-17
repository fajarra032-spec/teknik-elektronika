/**
 * routes/admin/tracklulusan.js
 * Track Lulusan - Kelola data lulusan dan survey tracer study
 * Terintegrasi dengan Data WEB, kompresi gambar, dan fileId
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const sharp = require('sharp'); // untuk kompresi gambar
const upload = multer({ storage: multer.memoryStorage() });
const { getGabunganLulusan } = require('../../helpers/lulusanHelper');

// ============================================================================
// KONSTANTA FOLDER UTAMA (Data WEB)
// ============================================================================
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// FUNGSI BANTU UMUM
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
 * Mendapatkan folder foto lulusan dengan struktur:
 * Data WEB / Lulusan / Foto / [tahunLulus] / [nim] /
 * @param {number} tahunLulus - Tahun lulus
 * @param {string} nim - NIM lulusan
 * @returns {Promise<string>} ID folder
 */
async function getLulusanFotoFolder(tahunLulus, nim) {
  const parentLulusan = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Lulusan');
  const parentFoto = await getOrCreateSubFolder(parentLulusan, 'Foto');
  const tahunFolder = await getOrCreateSubFolder(parentFoto, tahunLulus.toString());
  const nimFolder = await getOrCreateSubFolder(tahunFolder, nim);
  return nimFolder;
}

// ============================================================================
// TINJAU SURVEI MANDIRI (tracerStudy - diisi sendiri oleh mahasiswa/lulusan)
// ============================================================================

/**
 * GET /admin/tracklulusan/survey
 * Menampilkan daftar isian tracer study mandiri dari mahasiswa/lulusan,
 * untuk ditinjau dan ditentukan tampil publik atau tidak.
 */
router.get('/survey', async (req, res) => {
  try {
    const { status } = req.query; // 'public' | 'pending' | undefined (semua)
    let query = db.collection('tracerStudy').orderBy('updatedAt', 'desc');
    const snapshot = await query.get();
    let survei = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (status === 'public') survei = survei.filter(s => s.isPublic === true);
    if (status === 'pending') survei = survei.filter(s => s.isPublic !== true);

    // ✅ PAGINASI: 10/halaman + "Tampilkan Semua" (in-memory, data sudah
    // di tangan dari snapshot di atas - tidak nambah baca Firestore).
    const SURVEI_PAGE_SIZE = 10;
    const showAll = req.query.all === '1';
    const totalSurvei = survei.length;
    const buildUrl = (params) => {
      const usp = new URLSearchParams();
      if (status) usp.set('status', status);
      Object.entries(params).forEach(([k, v]) => usp.set(k, v));
      return `/admin/tracklulusan/survey?${usp.toString()}`;
    };
    let pageInfo = null;
    if (!showAll) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const start = (page - 1) * SURVEI_PAGE_SIZE;
      const paged = survei.slice(start, start + SURVEI_PAGE_SIZE);
      const hasPrev = page > 1;
      const hasNext = start + SURVEI_PAGE_SIZE < totalSurvei;
      pageInfo = {
        hasPrev,
        hasNext,
        prevUrl: hasPrev ? buildUrl({ page: page - 1 }) : null,
        nextUrl: hasNext ? buildUrl({ page: page + 1 }) : null,
        allUrl: buildUrl({ all: '1' }),
        count: paged.length,
        total: totalSurvei
      };
      survei = paged;
    }

    res.render('admin/tracklulusan_survey_list', {
      title: 'Tinjau Survei Tracer Study',
      survei,
      filterStatus: status || '',
      pageInfo,
      showAll,
      pageListUrl: buildUrl({ page: 1 })
    });
  } catch (error) {
    console.error('Error mengambil survei tracer study:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengambil data survei tracer study' });
  }
});

/**
 * POST /admin/tracklulusan/survey/:userId/toggle
 * Menyalakan/mematikan status tampil publik untuk satu isian survei
 */
router.post('/survey/:userId/toggle', async (req, res) => {
  try {
    const docRef = db.collection('tracerStudy').doc(req.params.userId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send('Data survei tidak ditemukan');
    }
    const isPublicSekarang = doc.data().isPublic === true;
    await docRef.update({ isPublic: !isPublicSekarang, updatedAt: new Date().toISOString() });
    res.redirect('/admin/tracklulusan/survey');
  } catch (error) {
    console.error('Error mengubah status publik survei:', error);
    res.status(500).send('Gagal mengubah status publik');
  }
});

// ============================================================================
// DAFTAR LULUSAN
// ============================================================================

/**
 * GET /admin/tracklulusan
 * Menampilkan daftar lulusan dengan filter (opsional)
 */
router.get('/', async (req, res) => {
  try {
    const { tahun, status, sumber } = req.query;

    // Gabungan dari kedua sumber (manual admin + survei mandiri mahasiswa),
    // termasuk yang masih menunggu tinjauan, supaya admin melihat SATU daftar
    // lengkap - bukan dua daftar terpisah yang terasa tidak nyambung.
    //
    // ✅ OPTIMISASI KUOTA: sebelumnya getGabunganLulusan() dipanggil DUA KALI
    // di sini - sekali untuk daftar lulusan (yang difilter), sekali lagi
    // HANYA untuk mengambil daftar tahun unik (tahunList) - padahal
    // sumbernya persis sama. Sekarang cukup panggil sekali; tahunList
    // diturunkan dari gabungan LENGKAP (sebelum difilter tahun/status/
    // sumber) yang sudah kita punya.
    const semuaGabungan = await getGabunganLulusan({ hanyaPublik: false });

    let lulusan = semuaGabungan;
    if (tahun) lulusan = lulusan.filter(l => String(l.tahunLulus) === String(tahun));
    if (status) lulusan = lulusan.filter(l => l.status === status);
    if (sumber) lulusan = lulusan.filter(l => l.sumber === sumber);

    lulusan.sort((a, b) => {
      const tahunDiff = (b.tahunLulus || 0) - (a.tahunLulus || 0);
      if (tahunDiff !== 0) return tahunDiff;
      return String(a.nama).localeCompare(String(b.nama));
    });

    const tahunSet = new Set();
    semuaGabungan.forEach(l => { if (l.tahunLulus) tahunSet.add(l.tahunLulus); });
    const tahunList = Array.from(tahunSet).sort().reverse();

    // ✅ PAGINASI: jangan render SEMUA lulusan terfilter sekaligus - default
    // 10/halaman + "Tampilkan Semua". Ini paginasi di memori (data sudah
    // di tangan dari getGabunganLulusan di atas), tidak nambah baca Firestore.
    const TRACKLULUSAN_PAGE_SIZE = 10;
    const showAll = req.query.all === '1';
    const totalLulusan = lulusan.length;
    const buildUrl = (params) => {
      const usp = new URLSearchParams();
      if (tahun) usp.set('tahun', tahun);
      if (status) usp.set('status', status);
      if (sumber) usp.set('sumber', sumber);
      Object.entries(params).forEach(([k, v]) => usp.set(k, v));
      return `/admin/tracklulusan?${usp.toString()}`;
    };
    let pageInfo = null;
    if (!showAll) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const start = (page - 1) * TRACKLULUSAN_PAGE_SIZE;
      const paged = lulusan.slice(start, start + TRACKLULUSAN_PAGE_SIZE);
      const hasPrev = page > 1;
      const hasNext = start + TRACKLULUSAN_PAGE_SIZE < totalLulusan;
      pageInfo = {
        hasPrev,
        hasNext,
        prevUrl: hasPrev ? buildUrl({ page: page - 1 }) : null,
        nextUrl: hasNext ? buildUrl({ page: page + 1 }) : null,
        allUrl: buildUrl({ all: '1' }),
        count: paged.length,
        total: totalLulusan
      };
      lulusan = paged;
    }

    res.render('admin/tracklulusan_list', {
      title: 'Track Lulusan',
      lulusan,
      tahunList,
      filterTahun: tahun || '',
      filterStatus: status || '',
      filterSumber: sumber || '',
      pageInfo,
      showAll,
      pageListUrl: buildUrl({ page: 1 })
    });
  } catch (error) {
    console.error('Error mengambil data lulusan:', error);
    res.status(500).render('error', { message: 'Gagal mengambil data lulusan' });
  }
});

// ============================================================================
// TAMBAH LULUSAN
// ============================================================================

/**
 * GET /admin/tracklulusan/create
 * Form tambah lulusan
 */
router.get('/create', (req, res) => {
  res.render('admin/tracklulusan_form', { title: 'Tambah Data Lulusan', lulusan: null });
});

/**
 * POST /admin/tracklulusan
 * Simpan lulusan baru (dengan upload foto + kompresi)
 */
router.post('/', upload.single('foto'), async (req, res) => {
  try {
    const {
      nama, nim, tahunLulus, pekerjaan, tempatKerja, alamatKerja,
      gaji, status, email, noHp
    } = req.body;
    const file = req.file;

    if (!nama || !nim || !tahunLulus) {
      return res.status(400).send('Nama, NIM, dan tahun lulus wajib diisi');
    }

    let fotoUrl = null, fotoFileId = null;
    if (file) {
      // Kompres gambar
      const compressedBuffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Dapatkan folder
      const folderId = await getLulusanFotoFolder(parseInt(tahunLulus), nim);
      const fileName = `${nim}_${Date.now()}.jpg`;
      const fileMetadata = { name: fileName, parents: [folderId] };
      const media = { mimeType: 'image/jpeg', body: Readable.from(compressedBuffer) };
      const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id',
      });

      // Set akses publik
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      });

      fotoUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      fotoFileId = response.data.id;
    }

    await db.collection('lulusan').add({
      nama,
      nim,
      tahunLulus: parseInt(tahunLulus),
      pekerjaan: pekerjaan || '',
      tempatKerja: tempatKerja || '',
      alamatKerja: alamatKerja || '',
      gaji: gaji || '',
      status: status || 'bekerja',
      email: email || '',
      noHp: noHp || '',
      foto: fotoUrl,
      fotoFileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.redirect('/admin/tracklulusan');
  } catch (error) {
    console.error('Error tambah lulusan:', error);
    res.status(500).send('Gagal menambah data lulusan');
  }
});

// ============================================================================
// DETAIL LULUSAN
// ============================================================================

/**
 * GET /admin/tracklulusan/:id
 * Menampilkan detail lulusan
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('lulusan').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).send('Data lulusan tidak ditemukan');
    }
    const lulusan = { id: doc.id, ...doc.data() };
    res.render('admin/tracklulusan_detail', { title: 'Detail Lulusan', lulusan });
  } catch (error) {
    console.error('Error mengambil detail lulusan:', error);
    res.status(500).render('error', { message: 'Gagal mengambil data lulusan' });
  }
});

// ============================================================================
// EDIT LULUSAN
// ============================================================================

/**
 * GET /admin/tracklulusan/:id/edit
 * Form edit lulusan
 */
router.get('/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('lulusan').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).send('Data lulusan tidak ditemukan');
    }
    const lulusan = { id: doc.id, ...doc.data() };
    res.render('admin/tracklulusan_form', { title: 'Edit Data Lulusan', lulusan });
  } catch (error) {
    console.error('Error ambil lulusan:', error);
    res.status(500).render('error', { message: 'Gagal mengambil data lulusan' });
  }
});

/**
 * POST /admin/tracklulusan/:id/update
 * Update lulusan (dengan upload foto baru opsional + kompresi)
 */
router.post('/:id/update', upload.single('foto'), async (req, res) => {
  try {
    const {
      nama, nim, tahunLulus, pekerjaan, tempatKerja, alamatKerja,
      gaji, status, email, noHp
    } = req.body;
    const file = req.file;
    const docRef = db.collection('lulusan').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send('Data lulusan tidak ditemukan');
    }
    const oldData = doc.data();

    const updateData = {
      nama,
      nim,
      tahunLulus: parseInt(tahunLulus),
      pekerjaan: pekerjaan || '',
      tempatKerja: tempatKerja || '',
      alamatKerja: alamatKerja || '',
      gaji: gaji || '',
      status: status || 'bekerja',
      email: email || '',
      noHp: noHp || '',
      updatedAt: new Date().toISOString()
    };

    if (file) {
      // Hapus foto lama jika ada
      if (oldData.fotoFileId) {
        try {
          await drive.files.delete({ fileId: oldData.fotoFileId });
        } catch (err) {
          console.error('Gagal hapus foto lama:', err);
        }
      }

      // Kompres gambar
      const compressedBuffer = await sharp(file.buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      // Dapatkan folder
      const folderId = await getLulusanFotoFolder(parseInt(tahunLulus), nim);
      const fileName = `${nim}_${Date.now()}.jpg`;
      const fileMetadata = { name: fileName, parents: [folderId] };
      const media = { mimeType: 'image/jpeg', body: Readable.from(compressedBuffer) };
      const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id',
      });

      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      });

      updateData.foto = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
      updateData.fotoFileId = response.data.id;
    }

    await docRef.update(updateData);
    res.redirect('/admin/tracklulusan');
  } catch (error) {
    console.error('Error update lulusan:', error);
    res.status(500).send('Gagal update data lulusan');
  }
});

// ============================================================================
// HAPUS LULUSAN
// ============================================================================

/**
 * POST /admin/tracklulusan/:id/delete
 * Hapus lulusan beserta foto di Drive
 */
router.post('/:id/delete', async (req, res) => {
  try {
    const docRef = db.collection('lulusan').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).send('Data lulusan tidak ditemukan');
    }
    const data = doc.data();

    if (data.fotoFileId) {
      try {
        await drive.files.delete({ fileId: data.fotoFileId });
      } catch (err) {
        console.error('Gagal hapus foto lulusan:', err);
      }
    }

    await docRef.delete();
    res.redirect('/admin/tracklulusan');
  } catch (error) {
    console.error('Error hapus lulusan:', error);
    res.status(500).send('Gagal hapus data lulusan');
  }
});

module.exports = router;