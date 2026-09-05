/**
 * routes/admin/matakuliah.js
 * Kelola mata kuliah (CRUD + dosen pengampu + jadwal + materi per pertemuan)
 * Dilengkapi route seeding untuk menambah PDK 1,2,3
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { mataKuliahCache } = require('../../helpers/cache');
const academicHelper = require('../../helpers/academicHelper');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// HELPER: mendapatkan daftar dosen untuk dropdown
// ============================================================================
async function getDosenList() {
  const dosenSnapshot = await db.collection('dosen').orderBy('nama').get();
  return dosenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// HELPER: PENGAMPU PER PERIODE (Ganjil/Genap tahun ajaran)
// ============================================================================
// Setiap MK bisa punya dosen pengampu berbeda tiap periode. Riwayatnya
// disimpan di subcollection mataKuliah/{id}/pengampuPeriode/{periodeId}.
// Field mataKuliah.dosenIds tetap dipertahankan sebagai "cermin" pengampu
// periode AKTIF saat ini, supaya fitur lain (dashboard dosen, elearning,
// nilai, rubrik, kurikulum, dll) yang selama ini membaca mk.dosenIds tidak
// perlu diubah sama sekali.

/**
 * Simpan/perbarui pengampu untuk satu periode tertentu.
 * Jika periode tsb adalah periode aktif saat ini, mk.dosenIds ikut disinkronkan.
 */
async function savePengampuPeriode(mkId, periodeId, dosenArray) {
  const semuaPeriode = academicHelper.generatePeriodeOptions(50, 5);
  const info = semuaPeriode.find(p => p.id === periodeId);

  const label = info ? info.label : periodeId;
  const semester = info ? info.semester : null;
  const tahunAwal = info ? info.tahunAwal : null;
  const tahunAkhir = info ? info.tahunAkhir : null;
  const urutan = info ? info.urutan : 0;

  await db.collection('mataKuliah').doc(mkId)
    .collection('pengampuPeriode').doc(periodeId)
    .set({
      periodeId,
      label,
      semester,
      tahunAwal,
      tahunAkhir,
      urutan,
      dosenIds: dosenArray,
      updatedAt: new Date().toISOString()
    }, { merge: true });

  // Sinkronkan ke field utama jika ini periode yang sedang berjalan
  const activePeriodeId = academicHelper.getActivePeriodeId();
  if (periodeId === activePeriodeId) {
    await db.collection('mataKuliah').doc(mkId).update({
      dosenIds: dosenArray,
      periodeAktifId: periodeId,
      periodeAktifLabel: label
    });
  }

  mataKuliahCache.delete('all');
}

/**
 * Ambil dosenIds yang tersimpan untuk satu periode tertentu.
 * Kalau periode itu belum pernah disimpan tapi kebetulan periode aktif,
 * fallback ke mk.dosenIds (data lama sebelum fitur per-periode ada).
 */
async function getPengampuUntukPeriode(mkId, periodeId, fallbackDosenIds) {
  const doc = await db.collection('mataKuliah').doc(mkId)
    .collection('pengampuPeriode').doc(periodeId).get();
  if (doc.exists) return doc.data().dosenIds || [];

  const activePeriodeId = academicHelper.getActivePeriodeId();
  if (periodeId === activePeriodeId && fallbackDosenIds) return fallbackDosenIds;
  return [];
}

/**
 * Ambil seluruh riwayat pengampu (semua periode) untuk ditampilkan di form/detail.
 */
async function getRiwayatPengampu(mkId, dosenMap) {
  const snap = await db.collection('mataKuliah').doc(mkId)
    .collection('pengampuPeriode').orderBy('urutan', 'desc').get();
  return snap.docs.map(doc => {
    const data = doc.data();
    const dosenNames = (data.dosenIds || []).map(id => dosenMap[id] || 'Unknown');
    return { ...data, dosenNames };
  });
}

// ============================================================================
// DAFTAR MATA KULIAH
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { semester, search } = req.query;

    // Bangun query dasar
    let query = db.collection('mataKuliah').orderBy('kode');

    // Filter berdasarkan semester jika ada
    if (semester) {
      query = query.where('semester', '==', parseInt(semester));
    }

    const mkSnapshot = await query.get();
    let matakuliah = mkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter berdasarkan search (manual karena Firestore tidak mendukung partial text search)
    if (search) {
      const lowerSearch = search.toLowerCase();
      matakuliah = matakuliah.filter(mk => 
        mk.kode.toLowerCase().includes(lowerSearch) || 
        mk.nama.toLowerCase().includes(lowerSearch)
      );
    }

    // Ambil data dosen untuk ditampilkan
    const dosenMap = {};
    const dosenSnapshot = await db.collection('dosen').get();
    dosenSnapshot.docs.forEach(doc => {
      dosenMap[doc.id] = doc.data().nama;
    });

    // Untuk setiap matakuliah, tambahkan field dosenNames (array nama dosen)
    const matakuliahWithDosen = matakuliah.map(mk => {
      const dosenNames = (mk.dosenIds || []).map(id => dosenMap[id] || 'Unknown').filter(Boolean);
      return { ...mk, dosenNames };
    });

    res.render('admin/matakuliah_list', {
      title: 'Daftar Mata Kuliah',
      matakuliah: matakuliahWithDosen,
      filterSemester: semester || '',
      search: search || ''
    });
  } catch (error) {
    console.error('Error mengambil MK:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data MK' });
  }
});

// ============================================================================
// TAMBAH MATA KULIAH
// ============================================================================
router.get('/create', async (req, res) => {
  try {
    const dosenList = await getDosenList();
    const periodeOptions = academicHelper.generatePeriodeOptions();
    const activePeriodeId = academicHelper.getActivePeriodeId();
    const selectedPeriodeId = req.query.periode || activePeriodeId;

    res.render('admin/matakuliah_form', {
      title: 'Tambah Mata Kuliah',
      mk: null,
      dosenList,
      periodeOptions,
      activePeriodeId,
      selectedPeriodeId,
      selectedDosenIds: [],
      pengampuHistori: []
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat form' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { kode, nama, sks, semester, periodeId, dosenIds, jadwal, isPDK } = req.body;

    // Validasi
    if (!kode || !nama || !sks || !semester) {
      return res.status(400).send('Kode, Nama, SKS, dan Semester wajib diisi');
    }

    // Cek duplikasi kode
    const existing = await db.collection('mataKuliah').where('kode', '==', kode).get();
    if (!existing.empty) {
      return res.status(400).send('Kode MK sudah digunakan');
    }

    // Proses isPDK (checkbox)
    const isPDKFlag = isPDK === '1' || isPDK === true; // karena dari form berupa string '1'

    // Buat array materi default
    const materi = Array.from({ length: 16 }, (_, i) => ({
      pertemuan: i + 1,
      topik: ''
    }));

    const docRef = await db.collection('mataKuliah').add({
      kode,
      nama,
      sks: parseInt(sks),
      semester: parseInt(semester),
      dosenIds: [], // akan diisi lewat savePengampuPeriode di bawah kalau ada
      jadwal: jadwal || '',
      isPDK: isPDKFlag,
      materi,
      createdAt: new Date().toISOString()
    });

    // Simpan pengampu untuk periode yang dipilih di form (kalau diisi)
    if (periodeId) {
      let dosenArray = [];
      if (dosenIds) {
        dosenArray = Array.isArray(dosenIds) ? dosenIds : [dosenIds];
      }
      await savePengampuPeriode(docRef.id, periodeId, dosenArray);
    }

    mataKuliahCache.delete('all');
    res.redirect('/admin/matakuliah');
  } catch (error) {
    console.error('Error tambah MK:', error);
    res.status(500).send('Gagal menambah MK: ' + error.message);
  }
});

// ============================================================================
// DETAIL MATA KULIAH (untuk melihat & mengedit materi)
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const mkDoc = await db.collection('mataKuliah').doc(req.params.id).get();
    if (!mkDoc.exists) {
      return res.status(404).send('Mata kuliah tidak ditemukan');
    }
    const mk = { id: mkDoc.id, ...mkDoc.data() };

    // Ambil nama dosen untuk ditampilkan
    const dosenMap = {};
    const dosenSnapshot = await db.collection('dosen').get();
    dosenSnapshot.docs.forEach(doc => {
      dosenMap[doc.id] = doc.data().nama;
    });

    const pengampuHistori = await getRiwayatPengampu(mk.id, dosenMap);

    res.render('admin/matakuliah_detail', {
      title: `Detail MK: ${mk.kode}`,
      mk,
      dosenMap,
      pengampuHistori
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail MK' });
  }
});

// ============================================================================
// EDIT MATA KULIAH (metadata)
// ============================================================================
router.get('/:id/edit', async (req, res) => {
  try {
    const mkDoc = await db.collection('mataKuliah').doc(req.params.id).get();
    if (!mkDoc.exists) {
      return res.status(404).send('Mata kuliah tidak ditemukan');
    }
    const mk = { id: mkDoc.id, ...mkDoc.data() };
    const dosenList = await getDosenList();

    const periodeOptions = academicHelper.generatePeriodeOptions();
    const activePeriodeId = academicHelper.getActivePeriodeId();
    const selectedPeriodeId = req.query.periode || activePeriodeId;

    const selectedDosenIds = await getPengampuUntukPeriode(mk.id, selectedPeriodeId, mk.dosenIds);

    const dosenMap = {};
    dosenList.forEach(d => { dosenMap[d.id] = d.nama; });
    const pengampuHistori = await getRiwayatPengampu(mk.id, dosenMap);

    res.render('admin/matakuliah_form', {
      title: 'Edit Mata Kuliah',
      mk,
      dosenList,
      periodeOptions,
      activePeriodeId,
      selectedPeriodeId,
      selectedDosenIds,
      pengampuHistori
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat form edit' });
  }
});

router.post('/:id/update', async (req, res) => {
  try {
    const { kode, nama, sks, semester, periodeId, dosenIds, jadwal, isPDK } = req.body;
    const mkRef = db.collection('mataKuliah').doc(req.params.id);

    // Validasi kode unik
    const mkDoc = await mkRef.get();
    const oldData = mkDoc.data();
    if (kode !== oldData.kode) {
      const existing = await db.collection('mataKuliah').where('kode', '==', kode).get();
      if (!existing.empty) {
        return res.status(400).send('Kode MK sudah digunakan');
      }
    }

    const isPDKFlag = isPDK === '1' || isPDK === true;

    await mkRef.update({
      kode,
      nama,
      sks: parseInt(sks),
      semester: parseInt(semester),
      jadwal: jadwal || '',
      isPDK: isPDKFlag,
      updatedAt: new Date().toISOString()
    });

    // Simpan pengampu untuk periode yang sedang dipilih di form
    if (periodeId) {
      let dosenArray = [];
      if (dosenIds) {
        dosenArray = Array.isArray(dosenIds) ? dosenIds : [dosenIds];
      }
      await savePengampuPeriode(req.params.id, periodeId, dosenArray);
    }

    mataKuliahCache.delete('all');
    res.redirect(`/admin/matakuliah/${req.params.id}/edit?periode=${periodeId || ''}`);
  } catch (error) {
    console.error('Error update MK:', error);
    res.status(500).send('Gagal update MK: ' + error.message);
  }
});

// ============================================================================
// UPDATE MATERI PER PERTEMUAN
// ============================================================================
router.post('/:id/materi', async (req, res) => {
  try {
    const { pertemuan, topik } = req.body;
    if (!pertemuan || !topik) {
      return res.status(400).send('Pertemuan dan topik harus diisi');
    }

    const mkRef = db.collection('mataKuliah').doc(req.params.id);
    const mkDoc = await mkRef.get();
    if (!mkDoc.exists) return res.status(404).send('MK tidak ditemukan');

    const mkData = mkDoc.data();
    const materi = mkData.materi || [];

    // Pastikan pertemuan dalam range 1-16
    const idx = parseInt(pertemuan) - 1;
    if (idx < 0 || idx >= 16) {
      return res.status(400).send('Pertemuan harus antara 1-16');
    }

    materi[idx] = { pertemuan: parseInt(pertemuan), topik };

    await mkRef.update({ materi });

    mataKuliahCache.delete('all');
    res.redirect(`/admin/matakuliah/${req.params.id}`);
  } catch (error) {
    console.error('Error update materi:', error);
    res.status(500).send('Gagal update materi');
  }
});

// ============================================================================
// HAPUS MATA KULIAH
// ============================================================================
router.post('/:id/delete', async (req, res) => {
  try {
    const mkRef = db.collection('mataKuliah').doc(req.params.id);
    // Periksa apakah MK digunakan di dokumen lain? (tugas, enrollment, dll) – opsional
    // Bisa juga hapus data terkait, tapi untuk sederhana hapus saja
    await mkRef.delete();
    mataKuliahCache.delete('all');
    res.redirect('/admin/matakuliah');
  } catch (error) {
    console.error('Error hapus MK:', error);
    res.status(500).send('Gagal hapus MK: ' + error.message);
  }
});

// ============================================================================
// SEED DATA PDK (Praktik Dunia Kerja) 1, 2, 3
// ============================================================================
/**
 * GET /admin/matakuliah/seed-pdk
 * Menambahkan 3 mata kuliah PDK jika belum ada.
 * Hanya untuk admin, berguna untuk inisialisasi data.
 */
router.get('/seed-pdk', async (req, res) => {
  try {
    // Cek apakah sudah ada mata kuliah dengan kode berawalan "PDK"
    const existing = await db.collection('mataKuliah')
      .where('kode', '>=', 'PDK')
      .where('kode', '<=', 'PDK\uf8ff')
      .get();

    if (!existing.empty) {
      return res.send('Data PDK sudah ada. Tidak perlu ditambahkan lagi.');
    }

    // Data PDK 1,2,3
    const pdkData = [
      { kode: 'PDK101', nama: 'Praktik Dunia Kerja 1', sks: 3, semester: 4 },
      { kode: 'PDK102', nama: 'Praktik Dunia Kerja 2', sks: 3, semester: 5 },
      { kode: 'PDK103', nama: 'Praktik Dunia Kerja 3', sks: 3, semester: 6 }
    ];

    for (const data of pdkData) {
      await db.collection('mataKuliah').add({
        ...data,
        dosenIds: [],
        jadwal: '',
        materi: Array.from({ length: 16 }, (_, i) => ({
          pertemuan: i + 1,
          topik: ''
        })),
        createdAt: new Date().toISOString()
      });
    }

    res.send('Data PDK 1,2,3 berhasil ditambahkan!');
  } catch (error) {
    console.error('Error seeding PDK:', error);
    res.status(500).send('Gagal menambahkan data PDK');
  }
});

module.exports = router;