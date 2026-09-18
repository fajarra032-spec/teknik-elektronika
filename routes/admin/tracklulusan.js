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
const { getTranskripMahasiswa } = require('../../helpers/nilaiHelper');

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

/**
 * Mendapatkan folder foto YUDISIUM (momen prosesi wisuda/pengukuhan
 * kelulusan) dengan struktur terpisah dari foto profil perorangan:
 * Data WEB / Lulusan / Yudisium / [tahunLulus] / [nim] /
 * @param {number} tahunLulus - Tahun lulus
 * @param {string} nim - NIM lulusan
 * @returns {Promise<string>} ID folder
 */
async function getYudisiumFotoFolder(tahunLulus, nim) {
  const parentLulusan = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Lulusan');
  const parentYudisium = await getOrCreateSubFolder(parentLulusan, 'Yudisium');
  const tahunFolder = await getOrCreateSubFolder(parentYudisium, tahunLulus.toString());
  const nimFolder = await getOrCreateSubFolder(tahunFolder, nim);
  return nimFolder;
}

/**
 * Kompres & unggah satu file gambar ke folder Drive tertentu, lalu
 * kembalikan URL publik + fileId. Dipakai bersama utk foto profil maupun
 * foto yudisium supaya tidak ada logika kompresi/upload yang terduplikasi.
 * @param {Buffer} fileBuffer - buffer gambar asli (dari multer memoryStorage)
 * @param {string} folderId - ID folder tujuan di Drive
 * @param {string} namePrefix - awalan nama file (mis. NIM)
 * @returns {Promise<{url: string, fileId: string}>}
 */
async function kompresDanUnggahFoto(fileBuffer, folderId, namePrefix) {
  const compressedBuffer = await sharp(fileBuffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const fileName = `${namePrefix}_${Date.now()}.jpg`;
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

  return {
    url: `https://drive.google.com/uc?export=view&id=${response.data.id}`,
    fileId: response.data.id
  };
}

/**
 * Hapus satu file di Drive kalau fileId-nya ada, tanpa membuat request
 * gagal total kalau ternyata filenya sudah tidak ada / gagal dihapus.
 */
async function hapusFotoDriveJikaAda(fileId, label) {
  if (!fileId) return;
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    console.error(`Gagal hapus ${label || 'foto'} lama:`, err.message);
  }
}

/**
 * Mengambil daftar mahasiswa dengan statusMahasiswa = 'Lulus', lengkap
 * dengan IPK akhir yang dihitung otomatis dari transkrip (helper yang
 * sama dipakai halaman KHS/Transkrip mahasiswa) - supaya admin tinggal
 * PILIH dari dropdown saat menambah data lulusan baru, bukan mengetik
 * ulang nama/NIM/IPK secara manual dan rawan typo/tidak sinkron.
 *
 * IPK gagal dihitung (mis. data nilai lama tidak lengkap) tetap
 * ditampilkan di dropdown dengan ipk=null, supaya mahasiswa itu tetap
 * bisa dipilih - admin cukup isi IPK secara manual utk kasus begini.
 */
async function getMahasiswaLulusDenganIpk() {
  const snapshot = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .where('statusMahasiswa', '==', 'Lulus')
    .get();

  const daftar = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const denganIpk = await Promise.all(daftar.map(async (m) => {
    let ipk = null;
    try {
      const transkrip = await getTranskripMahasiswa(m.id);
      ipk = transkrip.ipk || null;
    } catch (err) {
      console.error(`Gagal hitung IPK utk ${m.nim}:`, err.message);
    }
    return {
      userId: m.id,
      nim: m.nim || '-',
      nama: m.nama || '-',
      foto: m.foto || null,
      ipk
    };
  }));

  denganIpk.sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  return denganIpk;
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

    res.render('admin/tracklulusan_survey_list', {
      title: 'Tinjau Survei Tracer Study',
      survei,
      filterStatus: status || ''
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
    let lulusan = await getGabunganLulusan({ hanyaPublik: false });

    if (tahun) lulusan = lulusan.filter(l => String(l.tahunLulus) === String(tahun));
    if (status) lulusan = lulusan.filter(l => l.status === status);
    if (sumber) lulusan = lulusan.filter(l => l.sumber === sumber);

    lulusan.sort((a, b) => {
      const tahunDiff = (b.tahunLulus || 0) - (a.tahunLulus || 0);
      if (tahunDiff !== 0) return tahunDiff;
      return String(a.nama).localeCompare(String(b.nama));
    });

    // Ambil daftar tahun unik untuk filter (dari gabungan, bukan cuma 'lulusan')
    const semuaGabungan = await getGabunganLulusan({ hanyaPublik: false });
    const tahunSet = new Set();
    semuaGabungan.forEach(l => { if (l.tahunLulus) tahunSet.add(l.tahunLulus); });
    const tahunList = Array.from(tahunSet).sort().reverse();

    res.render('admin/tracklulusan_list', {
      title: 'Track Lulusan',
      lulusan,
      tahunList,
      filterTahun: tahun || '',
      filterStatus: status || '',
      filterSumber: sumber || ''
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
router.get('/create', async (req, res) => {
  try {
    const mahasiswaLulusList = await getMahasiswaLulusDenganIpk();
    res.render('admin/tracklulusan_form', { title: 'Tambah Data Lulusan', lulusan: null, mahasiswaLulusList });
  } catch (error) {
    console.error('Error memuat form tambah lulusan:', error);
    res.status(500).render('error', { message: 'Gagal memuat form tambah lulusan' });
  }
});

/**
 * POST /admin/tracklulusan
 * Simpan lulusan baru (dengan upload foto profil + foto yudisium, kompresi)
 */
router.post('/', upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'fotoYudisium', maxCount: 1 }]), async (req, res) => {
  try {
    const {
      nama, nim, tahunLulus, pekerjaan, tempatKerja, alamatKerja,
      gaji, status, email, noHp, ipk, userId
    } = req.body;
    const fotoFile = req.files && req.files.foto ? req.files.foto[0] : null;
    const fotoYudisiumFile = req.files && req.files.fotoYudisium ? req.files.fotoYudisium[0] : null;

    if (!nama || !nim || !tahunLulus) {
      return res.status(400).send('Nama, NIM, dan tahun lulus wajib diisi');
    }

    let fotoUrl = null, fotoFileId = null;
    if (fotoFile) {
      const folderId = await getLulusanFotoFolder(parseInt(tahunLulus), nim);
      const hasil = await kompresDanUnggahFoto(fotoFile.buffer, folderId, nim);
      fotoUrl = hasil.url;
      fotoFileId = hasil.fileId;
    }

    let fotoYudisiumUrl = null, fotoYudisiumFileId = null;
    if (fotoYudisiumFile) {
      const folderYudisiumId = await getYudisiumFotoFolder(parseInt(tahunLulus), nim);
      const hasilYudisium = await kompresDanUnggahFoto(fotoYudisiumFile.buffer, folderYudisiumId, `${nim}_yudisium`);
      fotoYudisiumUrl = hasilYudisium.url;
      fotoYudisiumFileId = hasilYudisium.fileId;
    }

    await db.collection('lulusan').add({
      userId: userId || null, // tertaut ke akun mahasiswa kalau dipilih dari dropdown
      nama,
      nim,
      tahunLulus: parseInt(tahunLulus),
      ipk: ipk ? parseFloat(ipk) : null,
      pekerjaan: pekerjaan || '',
      tempatKerja: tempatKerja || '',
      alamatKerja: alamatKerja || '',
      gaji: gaji || '',
      status: status || 'bekerja',
      email: email || '',
      noHp: noHp || '',
      foto: fotoUrl,
      fotoFileId,
      fotoYudisium: fotoYudisiumUrl,
      fotoYudisiumFileId,
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
    const mahasiswaLulusList = await getMahasiswaLulusDenganIpk();
    res.render('admin/tracklulusan_form', { title: 'Edit Data Lulusan', lulusan, mahasiswaLulusList });
  } catch (error) {
    console.error('Error ambil lulusan:', error);
    res.status(500).render('error', { message: 'Gagal mengambil data lulusan' });
  }
});

/**
 * POST /admin/tracklulusan/:id/update
 * Update lulusan (dengan upload foto profil/yudisium baru opsional + kompresi)
 */
router.post('/:id/update', upload.fields([{ name: 'foto', maxCount: 1 }, { name: 'fotoYudisium', maxCount: 1 }]), async (req, res) => {
  try {
    const {
      nama, nim, tahunLulus, pekerjaan, tempatKerja, alamatKerja,
      gaji, status, email, noHp, ipk, userId
    } = req.body;
    const fotoFile = req.files && req.files.foto ? req.files.foto[0] : null;
    const fotoYudisiumFile = req.files && req.files.fotoYudisium ? req.files.fotoYudisium[0] : null;
    const docRef = db.collection('lulusan').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).send('Data lulusan tidak ditemukan');
    }
    const oldData = doc.data();

    const updateData = {
      userId: userId || oldData.userId || null,
      nama,
      nim,
      tahunLulus: parseInt(tahunLulus),
      ipk: ipk ? parseFloat(ipk) : null,
      pekerjaan: pekerjaan || '',
      tempatKerja: tempatKerja || '',
      alamatKerja: alamatKerja || '',
      gaji: gaji || '',
      status: status || 'bekerja',
      email: email || '',
      noHp: noHp || '',
      updatedAt: new Date().toISOString()
    };

    if (fotoFile) {
      await hapusFotoDriveJikaAda(oldData.fotoFileId, 'foto profil');
      const folderId = await getLulusanFotoFolder(parseInt(tahunLulus), nim);
      const hasil = await kompresDanUnggahFoto(fotoFile.buffer, folderId, nim);
      updateData.foto = hasil.url;
      updateData.fotoFileId = hasil.fileId;
    }

    if (fotoYudisiumFile) {
      await hapusFotoDriveJikaAda(oldData.fotoYudisiumFileId, 'foto yudisium');
      const folderYudisiumId = await getYudisiumFotoFolder(parseInt(tahunLulus), nim);
      const hasilYudisium = await kompresDanUnggahFoto(fotoYudisiumFile.buffer, folderYudisiumId, `${nim}_yudisium`);
      updateData.fotoYudisium = hasilYudisium.url;
      updateData.fotoYudisiumFileId = hasilYudisium.fileId;
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

    await hapusFotoDriveJikaAda(data.fotoFileId, 'foto profil');
    await hapusFotoDriveJikaAda(data.fotoYudisiumFileId, 'foto yudisium');

    await docRef.delete();
    res.redirect('/admin/tracklulusan');
  } catch (error) {
    console.error('Error hapus lulusan:', error);
    res.status(500).send('Gagal hapus data lulusan');
  }
});

module.exports = router;