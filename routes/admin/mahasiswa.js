/**
 * routes/admin/mahasiswa.js
 * Kelola data mahasiswa dengan progres semester (1-12), status magang, dan status mahasiswa terpisah
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db, auth } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const { KONSENTRASI_OPTIONS, AGAMA_OPTIONS, DEFAULT_AGAMA, parseSemesterNumber, aktifkanPaketKrs, SEMESTER_MULAI_KONSENTRASI } = require('../../helpers/paketKurikulumHelper');
const { isBiodataLengkap, getBiodataKosong, BIODATA_FIELDS, GROUP_LABELS } = require('../../helpers/biodataHelper');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

async function getMahasiswaFotoFolderId() {
  const folderName = 'Foto_Mahasiswa';
  const query = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) return query.data.files[0].id;
  const folder = await drive.files.create({
    resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  return folder.data.id;
}

function getAngkatanFromNim(nim) {
  if (nim && nim.length >= 2) return '20' + nim.substring(0, 2);
  return new Date().getFullYear().toString();
}

const SEMESTER_OPTIONS = Array.from({ length: 12 }, (_, i) => `Semester ${i + 1}`);
const MAGANG_OPTIONS = ['Magang 1', 'Magang 2', 'Magang 3', 'Selesai Magang'];
const STATUS_MAHASISWA_OPTIONS = ['Aktif', 'Lulus', 'Cuti', 'Keluar'];

// "Kelas" di sini murni label pengelompokan administratif (rombel) untuk
// jadwal/presensi, mis. "ELK1A", "ELK1B", "ELK3A", "ELK1ON" - TIDAK
// mengubah/membatasi mata kuliah yang bisa diambil mahasiswa. Tidak ada
// daftar baku (bebas diisi admin), jadi tidak ada KELAS_OPTIONS di sini -
// nilai unik yang sudah dipakai dikumpulkan dinamis dari data mahasiswa
// yang ada (lihat kelasSet di GET '/').
//
// "Konsentrasi" (KONSENTRASI_OPTIONS, dari paketKurikulumHelper) BEDA -
// ini menentukan PAKET KRS mana yang otomatis diaktifkan mulai semester 3
// (lihat helpers/paketKurikulumHelper.js), jadi nilainya baku/tetap.

// ============================================================================
// DAFTAR MAHASISWA (dengan filter lengkap)
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const { angkatan, semester, statusMagang, statusMahasiswa, kelas, search } = req.query;

    let importResult = null, importError = null;
    if (req.query.import === 'done' && req.session.importResult) {
      importResult = req.session.importResult;
      delete req.session.importResult;
    }
    if (req.session.importError) {
      importError = req.session.importError;
      delete req.session.importError;
    }

    const snapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .orderBy('nim')
      .get();

    const mahasiswaList = [];
    const angkatanSet = new Set();
    const kelasSet = new Set();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const m = { id: doc.id, ...data };
      // Status kelengkapan biodata (NIK, TTL, alamat, data ortu, data
      // sekolah, dst - lihat helpers/biodataHelper.js), ditampilkan sebagai
      // badge di daftar supaya admin bisa lihat sekilas mana yang belum
      // lengkap tanpa buka detail satu-satu.
      m.biodataLengkap = isBiodataLengkap(m);
      const angkatanMhs = getAngkatanFromNim(m.nim);
      angkatanSet.add(angkatanMhs);
      if (m.kelas) kelasSet.add(m.kelas);

      if (angkatan && angkatanMhs !== angkatan) continue;
      if (semester && m.semester !== semester) continue;
      if (statusMagang && m.statusMagang !== statusMagang) continue;
      if (statusMahasiswa && m.statusMahasiswa !== statusMahasiswa) continue;
      if (kelas && m.kelas !== kelas) continue;
      if (search) {
        const lower = search.toLowerCase();
        const matchNama = m.nama && m.nama.toLowerCase().includes(lower);
        const matchNim = m.nim && m.nim.includes(search);
        if (!matchNama && !matchNim) continue;
      }
      mahasiswaList.push(m);
    }

    const angkatanList = Array.from(angkatanSet).sort().reverse();
    const kelasList = Array.from(kelasSet).sort();

    res.render('admin/mahasiswa_list', {
      title: 'Kelola Mahasiswa',
      mahasiswa: mahasiswaList,
      angkatanList,
      kelasList,
      filterAngkatan: angkatan || '',
      filterSemester: semester || '',
      filterStatusMagang: statusMagang || '',
      filterStatusMahasiswa: statusMahasiswa || '',
      filterKelas: kelas || '',
      search: search || '',
      importResult,
      importError,
    });
  } catch (error) {
    console.error('Error mengambil data mahasiswa:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal mengambil data mahasiswa'
    });
  }
});

// ============================================================================
// TAMBAH MAHASISWA
// ============================================================================

router.get('/create', (req, res) => {
  res.render('admin/mahasiswa_form', {
    title: 'Tambah Mahasiswa',
    mahasiswa: null,
    semesterOptions: SEMESTER_OPTIONS,
    magangOptions: MAGANG_OPTIONS,
    statusMahasiswaOptions: STATUS_MAHASISWA_OPTIONS,
    konsentrasiOptions: KONSENTRASI_OPTIONS,
    agamaOptions: AGAMA_OPTIONS,
    defaultAgama: DEFAULT_AGAMA
  });
});

router.post('/', upload.single('foto'), async (req, res) => {
  try {
    const { nim, nama, email, password, semester, statusMagang, statusMahasiswa, kelas, konsentrasi, agama } = req.body;
    const file = req.file;

    if (!nim || !nama || !email || !password) {
      return res.status(400).send('NIM, Nama, Email, dan Password wajib diisi');
    }

    let userRecord;
    try {
      userRecord = await auth.createUser({ email, password, displayName: nama });
    } catch (authError) {
      console.error('Gagal membuat user di Auth:', authError);
      return res.status(400).send('Email sudah terdaftar atau password tidak valid');
    }

    let fotoUrl = null, fotoFileId = null;
    if (file) {
      const folderId = await getMahasiswaFotoFolderId();
      const ext = file.originalname.split('.').pop();
      const fileName = `${nim}_${Date.now()}.${ext}`;
      const fileMetadata = { name: fileName, parents: [folderId] };
      const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
      const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, webViewLink',
      });
      fotoUrl = response.data.webViewLink;
      fotoFileId = response.data.id;
    }

    const finalSemester = SEMESTER_OPTIONS.includes(semester) ? semester : null;
    const finalMagang = MAGANG_OPTIONS.includes(statusMagang) ? statusMagang : null;
    const finalStatus = STATUS_MAHASISWA_OPTIONS.includes(statusMahasiswa) ? statusMahasiswa : 'Aktif';

    await db.collection('users').doc(userRecord.uid).set({
      nim,
      nama,
      email,
      foto: fotoUrl,
      fotoFileId,
      role: 'mahasiswa',
      semester: finalSemester,
      statusMagang: finalMagang,
      statusMahasiswa: finalStatus,
      kelas: kelas ? kelas.trim().toUpperCase() : null,
      konsentrasi: KONSENTRASI_OPTIONS.includes(konsentrasi) ? konsentrasi : null,
      // Agama: kalau tidak dipilih/tidak valid, default ke Islam (bisa
      // diubah admin kapan saja lewat form edit).
      agama: AGAMA_OPTIONS.includes(agama) ? agama : DEFAULT_AGAMA,
      createdAt: new Date().toISOString(),
    });

    await db.collection('tagihan').doc(userRecord.uid).set({
      mahasiswaId: userRecord.uid,
      semester: [],
    });

    res.redirect('/admin/mahasiswa');
  } catch (error) {
    console.error('Error menambah mahasiswa:', error);
    res.status(500).send('Gagal menambah mahasiswa: ' + error.message);
  }
});

// ============================================================================
// DETAIL MAHASISWA
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const mahasiswaDoc = await db.collection('users').doc(req.params.id).get();
    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const mahasiswa = { id: mahasiswaDoc.id, ...mahasiswaDoc.data() };

    const tagihanDoc = await db.collection('tagihan').doc(req.params.id).get();
    const tagihan = tagihanDoc.exists ? tagihanDoc.data() : { semester: [] };

    res.render('admin/mahasiswa_detail', {
      title: 'Detail Mahasiswa',
      mahasiswa,
      tagihan,
      biodataFields: BIODATA_FIELDS,
      groupLabels: GROUP_LABELS,
      biodataKosong: getBiodataKosong(mahasiswa),
      krsSuccess: req.query.krsSuccess || null,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Error mengambil detail mahasiswa:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat detail mahasiswa'
    });
  }
});

// ============================================================================
// EDIT MAHASISWA
// ============================================================================

router.get('/:id/edit', async (req, res) => {
  try {
    const mahasiswaDoc = await db.collection('users').doc(req.params.id).get();
    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const mahasiswa = { id: mahasiswaDoc.id, ...mahasiswaDoc.data() };
    res.render('admin/mahasiswa_form', {
      title: 'Edit Mahasiswa',
      mahasiswa,
      semesterOptions: SEMESTER_OPTIONS,
      magangOptions: MAGANG_OPTIONS,
      statusMahasiswaOptions: STATUS_MAHASISWA_OPTIONS,
      konsentrasiOptions: KONSENTRASI_OPTIONS,
      agamaOptions: AGAMA_OPTIONS,
      defaultAgama: DEFAULT_AGAMA
    });
  } catch (error) {
    console.error('Error memuat form edit mahasiswa:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat form edit'
    });
  }
});

router.post('/:id/update', upload.single('foto'), async (req, res) => {
  try {
    const { nim, nama, email, semester, statusMagang, statusMahasiswa, kelas, konsentrasi, agama } = req.body;
    const file = req.file;
    const mahasiswaRef = db.collection('users').doc(req.params.id);
    const mahasiswaDoc = await mahasiswaRef.get();

    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const oldData = mahasiswaDoc.data();

    const updateData = {
      nim,
      nama,
      email,
      semester: SEMESTER_OPTIONS.includes(semester) ? semester : (oldData.semester || null),
      statusMagang: MAGANG_OPTIONS.includes(statusMagang) ? statusMagang : (oldData.statusMagang || null),
      statusMahasiswa: STATUS_MAHASISWA_OPTIONS.includes(statusMahasiswa) ? statusMahasiswa : (oldData.statusMahasiswa || 'Aktif'),
      kelas: kelas !== undefined ? (kelas ? kelas.trim().toUpperCase() : null) : (oldData.kelas || null),
      konsentrasi: konsentrasi !== undefined ? (KONSENTRASI_OPTIONS.includes(konsentrasi) ? konsentrasi : null) : (oldData.konsentrasi || null),
      // Agama: admin bisa ubah kapan saja lewat form ini. Kalau field tidak
      // dikirim/tidak valid, pertahankan nilai lama - kalau belum pernah
      // diisi sama sekali, jatuh ke default (Islam).
      agama: agama !== undefined
        ? (AGAMA_OPTIONS.includes(agama) ? agama : (oldData.agama || DEFAULT_AGAMA))
        : (oldData.agama || DEFAULT_AGAMA),
      updatedAt: new Date().toISOString(),
    };

    if (file) {
      const folderId = await getMahasiswaFotoFolderId();
      const ext = file.originalname.split('.').pop();
      const fileName = `${nim}_${Date.now()}.${ext}`;
      const fileMetadata = { name: fileName, parents: [folderId] };
      const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
      const response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, webViewLink',
      });
      updateData.foto = response.data.webViewLink;
      updateData.fotoFileId = response.data.id;

      if (oldData.fotoFileId) {
        try {
          await drive.files.delete({ fileId: oldData.fotoFileId });
        } catch (err) {
          console.error('Gagal hapus foto lama:', err);
        }
      }
    }

    if (email !== oldData.email) {
      try {
        await auth.updateUser(req.params.id, { email });
      } catch (authError) {
        console.error('Gagal update email di Auth:', authError);
      }
    }

    await mahasiswaRef.update(updateData);

    // ========================================================================
    // AUTO-AKTIFKAN PAKET KRS: begitu progres semester mahasiswa berubah
    // (atau status berubah jadi Aktif) DAN hasil akhirnya adalah semester
    // tertentu + status Aktif, otomatis aktifkan paket KRS semester itu -
    // lihat helpers/paketKurikulumHelper.js. Hanya jalan kalau semester
    // atau statusMahasiswa BENAR-BENAR berubah (bukan tiap kali admin
    // simpan form), supaya tidak membuat KRS duplikat tiap edit data lain.
    // ========================================================================
    let krsAutoMessage = null;
    let krsAutoOk = true;
    const semesterBerubah = oldData.semester !== updateData.semester;
    const statusBerubah = oldData.statusMahasiswa !== updateData.statusMahasiswa;
    if ((semesterBerubah || statusBerubah) && updateData.statusMahasiswa === 'Aktif') {
      const semesterNumber = parseSemesterNumber(updateData.semester);
      if (semesterNumber) {
        try {
          const hasil = await aktifkanPaketKrs(
            db, req.params.id, semesterNumber, updateData.konsentrasi,
            getCurrentAcademicSemester().label, req.user.id
          );
          krsAutoMessage = hasil.message;
          krsAutoOk = hasil.ok;
        } catch (krsError) {
          console.error('Gagal auto-aktifkan paket KRS:', krsError);
          krsAutoMessage = 'Gagal mengaktifkan paket KRS otomatis: ' + krsError.message;
          krsAutoOk = false;
        }
      }
    }

    if (krsAutoMessage) {
      const param = krsAutoOk ? 'krsSuccess' : 'error';
      return res.redirect(`/admin/mahasiswa/${req.params.id}?${param}=` + encodeURIComponent(krsAutoMessage));
    }
    res.redirect('/admin/mahasiswa');
  } catch (error) {
    console.error('Error update mahasiswa:', error);
    res.status(500).send('Gagal update mahasiswa: ' + error.message);
  }
});

// ============================================================================
// RESET PASSWORD
// ============================================================================

router.post('/:id/reset-password', async (req, res) => {
  try {
    const mahasiswaDoc = await db.collection('users').doc(req.params.id).get();
    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const email = mahasiswaDoc.data().email;
    await auth.generatePasswordResetLink(email);
    res.redirect(`/admin/mahasiswa/${req.params.id}?reset=email_sent`);
  } catch (error) {
    console.error('Error reset password:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal reset password'
    });
  }
});

// ============================================================================
// KELOLA TAGIHAN SPP
// ============================================================================

router.get('/:id/tagihan/tambah', async (req, res) => {
  try {
    const mahasiswaDoc = await db.collection('users').doc(req.params.id).get();
    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const mahasiswa = mahasiswaDoc.data();
    res.render('admin/tagihan_form', {
      title: 'Tambah Tagihan',
      mahasiswaId: req.params.id,
      mahasiswa,
      tagihan: null
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat form'
    });
  }
});

router.post('/:id/tagihan', async (req, res) => {
  try {
    const { semester, jumlah, jatuhTempo, status } = req.body;
    const mahasiswaId = req.params.id;

    if (!semester || !jumlah) {
      return res.status(400).send('Semester dan jumlah wajib diisi');
    }

    const tagihanRef = db.collection('tagihan').doc(mahasiswaId);
    const tagihanDoc = await tagihanRef.get();
    const existing = tagihanDoc.exists ? tagihanDoc.data() : { semester: [] };

    existing.semester.push({
      id: Date.now().toString(),
      semester,
      jumlah: parseInt(jumlah),
      jatuhTempo: jatuhTempo || null,
      status: status || 'belum lunas',
      createdAt: new Date().toISOString()
    });

    await tagihanRef.set(existing);
    res.redirect(`/admin/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error tambah tagihan:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal menambah tagihan'
    });
  }
});

router.get('/:id/tagihan/:tagihanId/edit', async (req, res) => {
  try {
    const mahasiswaDoc = await db.collection('users').doc(req.params.id).get();
    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const mahasiswa = mahasiswaDoc.data();

    const tagihanDoc = await db.collection('tagihan').doc(req.params.id).get();
    if (!tagihanDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Tagihan tidak ditemukan'
      });
    }

    const tagihanList = tagihanDoc.data().semester || [];
    const tagihan = tagihanList.find(t => t.id === req.params.tagihanId);
    if (!tagihan) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Tagihan tidak ditemukan'
      });
    }

    res.render('admin/tagihan_form', {
      title: 'Edit Tagihan',
      mahasiswaId: req.params.id,
      mahasiswa,
      tagihan,
      tagihanId: req.params.tagihanId
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat form edit'
    });
  }
});

router.post('/:id/tagihan/:tagihanId/update', async (req, res) => {
  try {
    const { semester, jumlah, jatuhTempo, status } = req.body;
    const tagihanRef = db.collection('tagihan').doc(req.params.id);
    const tagihanDoc = await tagihanRef.get();
    if (!tagihanDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Data tagihan tidak ditemukan'
      });
    }

    const data = tagihanDoc.data();
    const index = data.semester.findIndex(t => t.id === req.params.tagihanId);
    if (index === -1) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Tagihan tidak ditemukan'
      });
    }

    data.semester[index] = {
      ...data.semester[index],
      semester,
      jumlah: parseInt(jumlah),
      jatuhTempo: jatuhTempo || data.semester[index].jatuhTempo,
      status,
      updatedAt: new Date().toISOString()
    };

    await tagihanRef.set(data);
    res.redirect(`/admin/mahasiswa/${req.params.id}`);
  } catch (error) {
    console.error('Error update tagihan:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal update tagihan'
    });
  }
});

router.post('/:id/tagihan/:tagihanId/delete', async (req, res) => {
  try {
    const tagihanRef = db.collection('tagihan').doc(req.params.id);
    const tagihanDoc = await tagihanRef.get();
    if (!tagihanDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Data tagihan tidak ditemukan'
      });
    }

    const data = tagihanDoc.data();
    data.semester = data.semester.filter(t => t.id !== req.params.tagihanId);
    await tagihanRef.set(data);

    res.redirect(`/admin/mahasiswa/${req.params.id}`);
  } catch (error) {
    console.error('Error hapus tagihan:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal hapus tagihan'
    });
  }
});

// ============================================================================
// HAPUS MAHASISWA
// ============================================================================

router.post('/:id/delete', async (req, res) => {
  try {
    const mahasiswaRef = db.collection('users').doc(req.params.id);
    const mahasiswaDoc = await mahasiswaRef.get();
    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const data = mahasiswaDoc.data();

    if (data.fotoFileId) {
      try {
        await drive.files.delete({ fileId: data.fotoFileId });
      } catch (err) {
        console.error('Gagal hapus foto mahasiswa:', err);
      }
    }

    try {
      await auth.deleteUser(req.params.id);
    } catch (authError) {
      console.error('Gagal hapus dari Auth:', authError);
    }

    await db.collection('tagihan').doc(req.params.id).delete();
    await mahasiswaRef.delete();

    res.redirect('/admin/mahasiswa');
  } catch (error) {
    console.error('Error hapus mahasiswa:', error);
    res.status(500).send('Gagal hapus mahasiswa: ' + error.message);
  }
});


// ============================================================================
// IMPORT & EXPORT CSV (dengan kolom nama)
// ============================================================================

/**
 * GET /admin/mahasiswa/template
 * Download template CSV untuk update data mahasiswa
 */
// ============================================================================
// ASSIGN KELAS MASSAL (pilih beberapa mahasiswa via checkbox di daftar,
// lalu set field `kelas` mereka sekaligus - pelengkap import CSV untuk
// penugasan cepat tanpa perlu bikin file)
// ============================================================================

router.post('/bulk-kelas', async (req, res) => {
  try {
    let { mahasiswaIds, kelas } = req.body;
    if (!mahasiswaIds) {
      req.session.importError = 'Tidak ada mahasiswa yang dipilih';
      return res.redirect('/admin/mahasiswa');
    }
    if (!Array.isArray(mahasiswaIds)) mahasiswaIds = [mahasiswaIds];

    const kelasFinal = kelas ? kelas.trim().toUpperCase() : null;

    // Firestore batch max 500 operasi - chunking untuk jaga-jaga kalau
    // suatu saat dipakai untuk angkatan besar sekaligus.
    const chunkSize = 450;
    for (let i = 0; i < mahasiswaIds.length; i += chunkSize) {
      const chunk = mahasiswaIds.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach(id => {
        batch.update(db.collection('users').doc(id), {
          kelas: kelasFinal,
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
    }

    req.session.importResult = {
      success: mahasiswaIds.length,
      failed: 0,
      errors: [],
      pesan: kelasFinal
        ? `${mahasiswaIds.length} mahasiswa berhasil dimasukkan ke kelas ${kelasFinal}`
        : `Kelas berhasil dikosongkan untuk ${mahasiswaIds.length} mahasiswa`
    };
    res.redirect('/admin/mahasiswa?import=done');
  } catch (error) {
    console.error('Error bulk assign kelas:', error);
    req.session.importError = 'Gagal mengubah kelas mahasiswa: ' + error.message;
    res.redirect('/admin/mahasiswa');
  }
});

router.get('/template', (req, res) => {
  const headers = ['nim', 'nama', 'noHp', 'semester', 'statusMagang', 'statusMahasiswa', 'kelas', 'konsentrasi', 'agama'];
  const example = ['20230101', 'Budi Santoso', '08123456789', 'Semester 1', 'Magang 1', 'Aktif', 'ELK1A', 'Instrumentasi', 'Islam'];
  const csvContent = [headers, example].map(row => row.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=template_update_mahasiswa.csv');
  res.send('\uFEFF' + csvContent);
});

/**
 * POST /admin/mahasiswa/import
 * Upload CSV untuk update data mahasiswa (nim sebagai identifier)
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file || file.mimetype !== 'text/csv') {
      req.session.importError = 'File harus berformat CSV';
      return res.redirect('/admin/mahasiswa');
    }

    let csvContent = file.buffer.toString('utf8');
    if (csvContent.charCodeAt(0) === 0xFEFF) csvContent = csvContent.substring(1);
    const lines = csvContent.split(/\r?\n/);
    if (lines.length < 2) {
      req.session.importError = 'File CSV kosong';
      return res.redirect('/admin/mahasiswa');
    }

    // Normalisasi header
    const normalizeHeader = (h) => {
      let header = h.trim().toLowerCase().replace(/\s/g, '');
      if (header === 'nohp') return 'noHp';
      if (header === 'statusmagang') return 'statusMagang';
      if (header === 'statusmahasiswa') return 'statusMahasiswa';
      if (header === 'kelas') return 'kelas';
      if (header === 'konsentrasi') return 'konsentrasi';
      if (header === 'agama') return 'agama';
      if (header === 'nim') return 'nim';
      if (header === 'nama') return 'nama';
      if (header === 'semester') return 'semester';
      return null;
    };

    const rawHeaders = lines[0].split(',').map(h => normalizeHeader(h)).filter(h => h !== null);
    const required = ['nim']; // minimal nim untuk identifikasi
    const missing = required.filter(r => !rawHeaders.includes(r));
    if (missing.length) {
      req.session.importError = `Header tidak lengkap: ${missing.join(', ')}. Header terbaca: ${rawHeaders.join(', ')}. Pastikan file CSV memiliki kolom: nim, dan minimal satu kolom update (nama, noHp, semester, statusMagang, statusMahasiswa, kelas)`;
      return res.redirect('/admin/mahasiswa');
    }

    let success = 0, failed = 0, errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      const values = line.split(',').map(v => v.trim());
      if (values.length < rawHeaders.length) {
        failed++;
        errors.push(`Baris ${i}: Jumlah kolom tidak sesuai (${values.length} kolom, seharusnya ${rawHeaders.length})`);
        continue;
      }
      const row = {};
      rawHeaders.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const nim = row.nim;
      if (!nim) {
        failed++;
        errors.push(`Baris ${i}: NIM tidak boleh kosong`);
        continue;
      }

      // Cari mahasiswa berdasarkan NIM
      const userSnapshot = await db.collection('users')
        .where('nim', '==', nim)
        .where('role', '==', 'mahasiswa')
        .limit(1)
        .get();
      if (userSnapshot.empty) {
        failed++;
        errors.push(`Baris ${i}: NIM ${nim} tidak ditemukan`);
        continue;
      }
      const userDoc = userSnapshot.docs[0];
      const updateData = {};

      // Update nama jika ada dan tidak kosong
      if (rawHeaders.includes('nama') && row.nama && row.nama.trim() !== '') {
        updateData.nama = row.nama.trim();
      }
      // Update noHp jika ada (boleh kosong)
      if (rawHeaders.includes('noHp')) {
        updateData.noHp = row.noHp || '';
      }
      // Update semester
      if (rawHeaders.includes('semester')) {
        let semester = row.semester?.trim();
        if (semester) {
          const match = semester.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            if (num >= 1 && num <= 12) updateData.semester = `Semester ${num}`;
            else updateData.semester = null;
          } else if (SEMESTER_OPTIONS.includes(semester)) {
            updateData.semester = semester;
          } else {
            updateData.semester = null;
          }
        } else {
          updateData.semester = null;
        }
      }
      // Update statusMagang
      if (rawHeaders.includes('statusMagang')) {
        let magang = row.statusMagang?.trim();
        if (magang) {
          const lower = magang.toLowerCase();
          if (lower.includes('magang 1') || lower === 'magang1') updateData.statusMagang = 'Magang 1';
          else if (lower.includes('magang 2') || lower === 'magang2') updateData.statusMagang = 'Magang 2';
          else if (lower.includes('magang 3') || lower === 'magang3') updateData.statusMagang = 'Magang 3';
          else if (lower.includes('selesai')) updateData.statusMagang = 'Selesai Magang';
          else if (MAGANG_OPTIONS.includes(magang)) updateData.statusMagang = magang;
          else updateData.statusMagang = null;
        } else {
          updateData.statusMagang = null;
        }
      }
      // Update statusMahasiswa
      if (rawHeaders.includes('statusMahasiswa')) {
        let status = row.statusMahasiswa?.trim();
        if (status) {
          const lower = status.toLowerCase();
          if (lower === 'aktif') updateData.statusMahasiswa = 'Aktif';
          else if (lower === 'lulus') updateData.statusMahasiswa = 'Lulus';
          else if (lower === 'cuti') updateData.statusMahasiswa = 'Cuti';
          else if (lower === 'keluar') updateData.statusMahasiswa = 'Keluar';
          else if (STATUS_MAHASISWA_OPTIONS.includes(status)) updateData.statusMahasiswa = status;
          else updateData.statusMahasiswa = null;
        } else {
          updateData.statusMahasiswa = null;
        }
      }

      // Update kelas (rombel, mis. "ELK1A") - boleh dikosongkan utk hapus
      if (rawHeaders.includes('kelas')) {
        const kelas = row.kelas?.trim();
        updateData.kelas = kelas ? kelas.toUpperCase() : null;
      }

      // Update konsentrasi (hanya diterima kalau sesuai KONSENTRASI_OPTIONS,
      // dipakai untuk menentukan paket KRS semester 3 ke atas)
      if (rawHeaders.includes('konsentrasi')) {
        const konsentrasi = row.konsentrasi?.trim();
        updateData.konsentrasi = KONSENTRASI_OPTIONS.includes(konsentrasi) ? konsentrasi : null;
      }

      // Update agama (hanya diterima kalau sesuai AGAMA_OPTIONS, dipakai
      // untuk memilih otomatis mata kuliah Pendidikan Agama semester 1).
      // Kosong/tidak valid -> dibiarkan (tidak menimpa dengan null, karena
      // agama tidak boleh "dikosongkan" seperti kelas/konsentrasi).
      if (rawHeaders.includes('agama')) {
        const agama = row.agama?.trim();
        if (AGAMA_OPTIONS.includes(agama)) updateData.agama = agama;
      }

      if (Object.keys(updateData).length === 0) {
        failed++;
        errors.push(`Baris ${i}: Tidak ada data yang akan diupdate (semua kolom kosong)`);
        continue;
      }

      try {
        await userDoc.ref.update(updateData);
        success++;
      } catch (err) {
        failed++;
        errors.push(`Baris ${i}: ${err.message}`);
      }
    }

    req.session.importResult = { success, failed, errors };
    res.redirect('/admin/mahasiswa?import=done');
  } catch (error) {
    console.error('Import error:', error);
    req.session.importError = 'Gagal memproses file: ' + error.message;
    res.redirect('/admin/mahasiswa');
  }
});

/**
 * GET /admin/mahasiswa/export/csv
 * Ekspor data mahasiswa sesuai filter ke CSV (kolom: nim, nama, noHp, semester, statusMagang, statusMahasiswa)
 */
router.get('/export/csv', async (req, res) => {
  try {
    const { angkatan, search, semester, statusMagang, statusMahasiswa, kelas } = req.query;
    const snapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .orderBy('nim')
      .get();

    const mahasiswaList = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const m = { id: doc.id, ...data };
      const angkatanMhs = getAngkatanFromNim(m.nim);
      if (angkatan && angkatanMhs !== angkatan) continue;
      if (semester && m.semester !== semester) continue;
      if (statusMagang && m.statusMagang !== statusMagang) continue;
      if (statusMahasiswa && m.statusMahasiswa !== statusMahasiswa) continue;
      if (kelas && m.kelas !== kelas) continue;
      if (search) {
        const lower = search.toLowerCase();
        if (!(m.nama && m.nama.toLowerCase().includes(lower)) &&
            !(m.nim && m.nim.includes(search))) continue;
      }
      mahasiswaList.push(m);
    }

    const rows = [
      ['nim', 'nama', 'noHp', 'semester', 'statusMagang', 'statusMahasiswa', 'kelas', 'konsentrasi', 'agama']
    ];
    for (const m of mahasiswaList) {
      rows.push([
        m.nim || '',
        m.nama || '',
        m.noHp || '',
        m.semester || '',
        m.statusMagang || '',
        m.statusMahasiswa || '',
        m.kelas || '',
        m.konsentrasi || '',
        m.agama || ''
      ]);
    }

    const csvContent = rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=mahasiswa_export.csv');
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('Error export CSV:', error);
    res.status(500).send('Gagal export CSV');
  }
});

module.exports = router;