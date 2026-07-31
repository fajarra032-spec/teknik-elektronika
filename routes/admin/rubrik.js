// routes/admin/rubrik.js
// Rekap Rubrik Penilaian SELURUH Mata Kuliah (Admin/Kaprodi).
// Admin bisa melihat hasil rubrik (kehadiran, sikap, keaktifan, tugas, kuis,
// UTS, UAS, nilai akhir, huruf) untuk setiap MK dari semua dosen, mencetaknya,
// dan mengunci nilai akhir seorang mahasiswa ke koleksi 'grades' resmi
// (dipakai transkrip/KHS) memakai saveGradeFinal yang sudah ada.

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const {
  getPeriodeAktif,
  getBobotRubrik,
  getKomponenRubrikByMkId,
  getRataTugasByMkId,
  hitungRubrik,
  saveGradeFinal
} = require('../../helpers/nilaiHelper');

router.use(verifyToken);
router.use(isAdmin);

async function getMahasiswaById(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) return { id: uid, ...userDoc.data() };
    return { id: uid, nama: 'Unknown', nim: '-' };
  } catch (error) {
    console.error('Error getMahasiswaById:', error);
    return { id: uid, nama: 'Error', nim: '-' };
  }
}

async function getDosenNamaByIds(dosenIds = []) {
  const nama = [];
  for (const id of dosenIds) {
    try {
      const doc = await db.collection('users').doc(id).get();
      nama.push(doc.exists ? (doc.data().nama || id) : id);
    } catch {
      nama.push(id);
    }
  }
  return nama.join(', ');
}

async function ambilDataRubrik(mkId, periode) {
  const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
  if (!mkDoc.exists) return null;
  const mk = { id: mkId, ...mkDoc.data() };

  const enrollmentSnapshot = await db.collection('enrollment')
    .where('mkId', '==', mkId)
    .where('status', '==', 'active')
    .get();
  const mahasiswaIds = enrollmentSnapshot.docs.map(d => d.data().userId);

  const bobot = await getBobotRubrik(mkId, periode);
  const komponenMap = await getKomponenRubrikByMkId(mkId, periode);
  const rataTugasMap = await getRataTugasByMkId(mkId, periode);

  const data = [];
  for (const uid of mahasiswaIds) {
    const mahasiswa = await getMahasiswaById(uid);
    const komponen = komponenMap[uid] || {};
    const rataTugas = rataTugasMap[uid] ?? null;
    const hasil = hitungRubrik(komponen, rataTugas, bobot);
    data.push({ mahasiswa, komponen, hasil });
  }
  data.sort((a, b) => String(a.mahasiswa.nim).localeCompare(String(b.mahasiswa.nim)));

  return { mk, bobot, data };
}

// ============================================================================
// DAFTAR SEMUA MATA KULIAH (lintas dosen)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const mkSnapshot = await db.collection('mataKuliah').orderBy('kode').get();

    const mkList = [];
    for (const doc of mkSnapshot.docs) {
      const mk = { id: doc.id, ...doc.data() };
      const enrollmentSnapshot = await db.collection('enrollment')
        .where('mkId', '==', doc.id)
        .where('status', '==', 'active')
        .get();
      mk.jumlahMahasiswa = enrollmentSnapshot.size;
      mk.namaDosen = await getDosenNamaByIds(mk.dosenIds || []);

      // Hitung berapa mahasiswa yang rubriknya sudah lengkap (nilai akhir terisi)
      const komponenMap = await getKomponenRubrikByMkId(doc.id, periode);
      const rataTugasMap = await getRataTugasByMkId(doc.id, periode);
      const bobot = await getBobotRubrik(doc.id, periode);
      let lengkap = 0;
      const mahasiswaIds = enrollmentSnapshot.docs.map(d => d.data().userId);
      mahasiswaIds.forEach(uid => {
        const hasil = hitungRubrik(komponenMap[uid] || {}, rataTugasMap[uid] ?? null, bobot);
        if (hasil.nilaiAkhir !== null) lengkap++;
      });
      mk.rubrikLengkap = lengkap;

      mkList.push(mk);
    }

    res.render('admin/rubrik_list', {
      title: 'Rekap Rubrik Penilaian - Semua Mata Kuliah',
      mkList,
      periode
    });
  } catch (error) {
    console.error('Error daftar rubrik admin:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat daftar rubrik: ' + error.message });
  }
});

// ============================================================================
// DETAIL RUBRIK SATU MK (READ-ONLY REKAP, semua komponen + nilai akhir)
// ============================================================================
router.get('/:mkId', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const hasil = await ambilDataRubrik(req.params.mkId, periode);
    if (!hasil) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    }
    hasil.mk.namaDosen = await getDosenNamaByIds(hasil.mk.dosenIds || []);

    res.render('admin/rubrik_detail', {
      title: `Rubrik Penilaian - ${hasil.mk.kode} ${hasil.mk.nama}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode
    });
  } catch (error) {
    console.error('Error detail rubrik admin:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail rubrik: ' + error.message });
  }
});

// ============================================================================
// KUNCI NILAI AKHIR -> koleksi 'grades' resmi (dipakai transkrip/KHS/IPK)
// ============================================================================
router.post('/:mkId/kunci/:mahasiswaId', async (req, res) => {
  try {
    const { mkId, mahasiswaId } = req.params;
    const periode = req.body.periode || getPeriodeAktif();

    const hasil = await ambilDataRubrik(mkId, periode);
    if (!hasil) return res.status(404).json({ success: false, message: 'MK tidak ditemukan' });

    const item = hasil.data.find(d => d.mahasiswa.id === mahasiswaId);
    if (!item || item.hasil.nilaiAkhir === null) {
      return res.status(400).json({ success: false, message: 'Komponen rubrik mahasiswa ini belum lengkap' });
    }

    await saveGradeFinal({
      userId: mahasiswaId,
      kodeMk: hasil.mk.kode,
      namaMk: hasil.mk.nama,
      sks: hasil.mk.sks,
      nilai: item.hasil.nilaiAkhir,
      semester: periode
    });

    res.json({ success: true, nilaiAkhir: item.hasil.nilaiAkhir, huruf: item.hasil.huruf });
  } catch (error) {
    console.error('Error kunci nilai akhir dari rubrik:', error);
    res.status(500).json({ success: false, message: 'Gagal mengunci nilai: ' + error.message });
  }
});

// ============================================================================
// CETAK RUBRIK (dipakai juga oleh admin, view sama dengan dosen)
// ============================================================================
router.get('/:mkId/cetak', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const hasil = await ambilDataRubrik(req.params.mkId, periode);
    if (!hasil) return res.status(404).send('Mata kuliah tidak ditemukan');
    hasil.mk.namaDosen = await getDosenNamaByIds(hasil.mk.dosenIds || []);

    res.render('rubrik_print', {
      title: `Cetak Rubrik Penilaian - ${hasil.mk.kode}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode,
      namaDosen: hasil.mk.namaDosen
    });
  } catch (error) {
    console.error('Error cetak rubrik admin:', error);
    res.status(500).send('Gagal memuat halaman cetak: ' + error.message);
  }
});

module.exports = router;
