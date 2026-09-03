/**
 * routes/dosen/mahasiswa.js
 * Daftar mahasiswa bimbingan (mahasiswa yang mengambil mata kuliah yang diampu)
 * Dapat difilter berdasarkan mata kuliah tertentu (mkId)
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getPeriodeAktif } = require('../../helpers/nilaiHelper');

router.use(verifyToken);
router.use(isDosen);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/**
 * Mendapatkan semua mata kuliah yang diampu oleh dosen ini
 */
async function getMataKuliahDosen(dosenId) {
  const snapshot = await db.collection('mataKuliah')
    .where('dosenIds', 'array-contains', dosenId)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============================================================================
// DAFTAR MAHASISWA
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const { angkatan, mkId, search } = req.query;
    const dosenId = req.dosen.id;

    let mkList = [];
    let mkIds = [];

    // Jika ada filter mkId, pastikan dosen mengampu MK tersebut
    if (mkId) {
      const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
      if (!mkDoc.exists) {
        return res.status(404).render('error', {
          title: 'Error',
          message: 'Mata kuliah tidak ditemukan'
        });
      }
      if (!mkDoc.data().dosenIds || !mkDoc.data().dosenIds.includes(dosenId)) {
        return res.status(403).render('error', {
          title: 'Akses Ditolak',
          message: 'Anda tidak mengampu mata kuliah ini'
        });
      }
      mkList = [{ id: mkDoc.id, ...mkDoc.data() }];
      mkIds = [mkId];
    } else {
      // Ambil semua MK yang diampu
      mkList = await getMataKuliahDosen(dosenId);
      mkIds = mkList.map(mk => mk.id);
    }

    if (mkIds.length === 0) {
      return res.render('dosen/mahasiswa_list', {
        title: 'Mahasiswa Bimbingan',
        mahasiswaList: [],
        mkList: [],
        filterMk: mkId || '',
        filterAngkatan: angkatan || '',
        search: search || '',
        angkatanList: []
      });
    }

    // Ambil semua enrollment untuk MK tersebut (hanya active, semester
    // berjalan) dengan chunking karena batas 'in' 10
    let allEnrollments = [];
    const chunkSize = 10;
    const periodeSaatIni = getPeriodeAktif();
    for (let i = 0; i < mkIds.length; i += chunkSize) {
      const chunk = mkIds.slice(i, i + chunkSize);
      const snapshot = await db.collection('enrollment')
        .where('mkId', 'in', chunk)
        .where('status', '==', 'active')
        .where('semester', '==', periodeSaatIni)
        .get();
      allEnrollments = allEnrollments.concat(snapshot.docs);
    }

    // Kumpulkan userId unik
    const mahasiswaIdsSet = new Set();
    allEnrollments.forEach(doc => mahasiswaIdsSet.add(doc.data().userId));
    const mahasiswaIds = Array.from(mahasiswaIdsSet);

    // Ambil data mahasiswa
    // ✅ OPTIMISASI KUOTA: ambil semua dokumen users SEKALIGUS lewat
    // db.getAll(), bukan satu per satu di dalam loop serial.
    const mahasiswaList = [];
    if (mahasiswaIds.length > 0) {
      const userDocs = await db.getAll(...mahasiswaIds.map(uid => db.collection('users').doc(uid)));
      userDocs.forEach((userDoc, idx) => {
        const uid = mahasiswaIds[idx];
        if (!userDoc.exists) return;
        const m = { id: uid, ...userDoc.data() };

        // Hitung angkatan dari NIM
        let angkatanMhs = '';
        if (m.nim && m.nim.length >= 2) {
          angkatanMhs = '20' + m.nim.substring(0, 2);
        }

        // Filter berdasarkan angkatan
        if (angkatan && angkatanMhs !== angkatan) return;

        // Filter berdasarkan search (nama/NIM)
        if (search) {
          const lowerSearch = search.toLowerCase();
          const matchNama = m.nama && m.nama.toLowerCase().includes(lowerSearch);
          const matchNim = m.nim && m.nim.includes(search);
          if (!matchNama && !matchNim) return;
        }

        // Ambil MK yang diambil mahasiswa ini (hanya dari MK yang diampu dosen)
        const mkDiambil = allEnrollments
          .filter(doc => doc.data().userId === uid)
          .map(doc => {
            const mk = mkList.find(mk => mk.id === doc.data().mkId);
            return mk ? mk.kode : doc.data().mkId;
          });

        mahasiswaList.push({
          ...m,
          angkatan: angkatanMhs,
          mkDiambil
        });
      });
    }

    // Urutkan berdasarkan NIM
    mahasiswaList.sort((a, b) => a.nim.localeCompare(b.nim));

    // Ambil daftar angkatan unik untuk filter
    const angkatanSet = new Set();
    mahasiswaList.forEach(m => {
      if (m.angkatan) angkatanSet.add(m.angkatan);
    });
    const angkatanList = Array.from(angkatanSet).sort().reverse();

    res.render('dosen/mahasiswa_list', {
      title: 'Mahasiswa Bimbingan',
      mahasiswaList,
      mkList,
      filterMk: mkId || '',
      filterAngkatan: angkatan || '',
      search: search || '',
      angkatanList
    });

  } catch (error) {
    console.error('Error mengambil mahasiswa bimbingan:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal mengambil data mahasiswa' 
    });
  }
});

// ============================================================================
// DETAIL MAHASISWA
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const mahasiswaId = req.params.id;
    const dosenId = req.dosen.id;

    // Ambil data mahasiswa
    const userDoc = await db.collection('users').doc(mahasiswaId).get();
    if (!userDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Mahasiswa tidak ditemukan'
      });
    }
    const mahasiswa = { id: mahasiswaId, ...userDoc.data() };

    // Ambil MK yang diampu dosen ini
    const mkDosen = await getMataKuliahDosen(dosenId);
    const mkDosenIds = mkDosen.map(m => m.id);

    // Ambil MK yang diambil mahasiswa (hanya dari MK yang diampu dosen,
    // status active, semester berjalan)
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', mahasiswaId)
      .where('mkId', 'in', mkDosenIds)
      .where('status', '==', 'active')
      .where('semester', '==', getPeriodeAktif())
      .get();
    const mkDiambil = [];
    for (const doc of enrollmentSnapshot.docs) {
      const mkId = doc.data().mkId;
      const mk = mkDosen.find(m => m.id === mkId);
      if (mk) {
        mkDiambil.push(mk);
      }
    }

    // ✅ OPTIMISASI KUOTA: sebelumnya query 'nilai' dijalankan TERPISAH utk
    // SETIAP MK yang diambil mahasiswa ini (bisa sampai 2x per MK karena ada
    // fallback self-heal) - sekarang cukup SATU query batch pakai
    // `where('mkId','in',...)` utk semua MK sekaligus (mkDiambil biasanya
    // sedikit, jauh di bawah batas 30 utk 'in').
    const periodeAktif = getPeriodeAktif();
    const mkIdsDiambil = mkDiambil.map(mk => mk.id);
    const nilaiMapPerMk = {}; // mkId -> { tipe: nilai }

    if (mkIdsDiambil.length > 0) {
      let nilaiSnapshot = await db.collection('nilai')
        .where('mahasiswaId', '==', mahasiswaId)
        .where('mkId', 'in', mkIdsDiambil)
        .where('periode', '==', periodeAktif)
        .get();

      if (nilaiSnapshot.empty) {
        const semuaSnapshot = await db.collection('nilai')
          .where('mahasiswaId', '==', mahasiswaId)
          .where('mkId', 'in', mkIdsDiambil)
          .get();
        const perluDitandai = semuaSnapshot.docs.filter(doc => !doc.data().periode);
        if (perluDitandai.length > 0) {
          await Promise.all(perluDitandai.map(doc => doc.ref.update({ periode: periodeAktif }).catch(() => {})));
        }
        nilaiSnapshot = semuaSnapshot;
      }

      nilaiSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if ((data.periode || periodeAktif) !== periodeAktif) return;
        if (!nilaiMapPerMk[data.mkId]) nilaiMapPerMk[data.mkId] = {};
        nilaiMapPerMk[data.mkId][data.tipe] = data.nilai;
      });
    }

    const nilaiList = mkDiambil.map(mk => ({
      mk,
      nilai: nilaiMapPerMk[mk.id] || {}
    }));

    res.render('dosen/mahasiswa_detail', {
      title: `Detail Mahasiswa - ${mahasiswa.nama}`,
      mahasiswa,
      mkDiambil,
      nilaiList
    });

  } catch (error) {
    console.error('Error detail mahasiswa:', error);
    res.status(500).render('error', { 
      title: 'Error', 
      message: 'Gagal memuat detail mahasiswa' 
    });
  }
});

module.exports = router;