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
  getBobotRubrik,
  saveBobotRubrik,
  saveKomponenRubrik,
  getKomponenRubrikByMkId,
  getRataTugasByMkId,
  hitungRubrik
} = require('../../helpers/nilaiHelper');

router.use(verifyToken);
router.use(isDosen);

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
// PILIH MATA KULIAH
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const mkSnapshot = await db.collection('mataKuliah')
      .where('dosenIds', 'array-contains', req.dosen.id)
      .orderBy('semester', 'desc')
      .orderBy('kode')
      .get();

    const mkList = [];
    for (const doc of mkSnapshot.docs) {
      const mk = { id: doc.id, ...doc.data() };
      const enrollmentSnapshot = await db.collection('enrollment')
        .where('mkId', '==', doc.id)
        .where('status', '==', 'active')
        .get();
      mk.jumlahMahasiswa = enrollmentSnapshot.size;
      mkList.push(mk);
    }

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
// HALAMAN INPUT RUBRIK PER MK
// ============================================================================
router.get('/:mkId', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const hasil = await ambilDataRubrik(req.params.mkId, periode);
    if (!hasil) return res.status(404).send('Mata kuliah tidak ditemukan');

    res.render('dosen/rubrik_input', {
      title: `Rubrik Penilaian - ${hasil.mk.kode} ${hasil.mk.nama}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode
    });
  } catch (error) {
    console.error('Error rubrik input:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat rubrik: ' + error.message });
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
    await saveKomponenRubrik(mahasiswaId, mkId, tipe, nilai, periode || getPeriodeAktif());
    res.json({ success: true });
  } catch (error) {
    console.error('Error input komponen rubrik:', error);
    res.status(500).json({ success: false, message: 'Gagal menyimpan nilai: ' + error.message });
  }
});

// ============================================================================
// CETAK RUBRIK (PDF via print dialog browser)
// ============================================================================
router.get('/:mkId/cetak', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const hasil = await ambilDataRubrik(req.params.mkId, periode);
    if (!hasil) return res.status(404).send('Mata kuliah tidak ditemukan');

    const namaDosen = req.dosen.nama || req.user.nama || '-';

    res.render('rubrik_print', {
      title: `Cetak Rubrik Penilaian - ${hasil.mk.kode}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode,
      namaDosen
    });
  } catch (error) {
    console.error('Error cetak rubrik:', error);
    res.status(500).send('Gagal memuat halaman cetak: ' + error.message);
  }
});

module.exports = router;
