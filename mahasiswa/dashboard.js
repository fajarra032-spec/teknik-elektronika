/**
 * routes/mahasiswa/dashboard.js
 * Dashboard utama mahasiswa
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');
const semesterSekarang = getCurrentAcademicSemester().label;
router.use(verifyToken);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

async function getTagihan(userId) {
  try {
    const tagihanDoc = await db.collection('tagihan').doc(userId).get();
    return tagihanDoc.exists ? tagihanDoc.data().semester || [] : [];
  } catch (error) {
    console.error('Error getTagihan:', error);
    return [];
  }
}

async function getMataKuliahDiambil(userId) {
  try {
    // Filter juga by semester akademik SAAT INI ("Ganjil 2026/2027" dst),
    // bukan cuma status=='active' - soalnya begitu KRS di-approve,
    // enrollment.status TETAP 'active' selamanya (tidak ada proses yang
    // menutup/mengubah status saat semester berganti). Tanpa filter ini,
    // begitu semester berpindah (mis. Genap -> Ganjil), mata kuliah dari
    // semester SEBELUMNYA tetap muncul di sini selama-lamanya.
    const semesterSaatIni = getCurrentAcademicSemester().label;
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .where('semester', '==', semesterSaatIni)
      .get();

    // ✅ OPTIMISASI KUOTA: ambil semua dokumen mataKuliah SEKALIGUS lewat
    // db.getAll(), bukan satu per satu di dalam loop serial. Halaman ini
    // dibuka SETIAP mahasiswa SETIAP login, jadi kecil pun penghematannya
    // dikali jumlah mahasiswa jadi besar.
    const enrollments = enrollmentSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    if (enrollments.length === 0) return [];

    const mkDocs = await db.getAll(...enrollments.map(e => db.collection('mataKuliah').doc(e.data.mkId)));
    const mkList = [];
    mkDocs.forEach((mkDoc, i) => {
      if (mkDoc.exists) {
        mkList.push({
          id: enrollments[i].data.mkId,
          ...mkDoc.data(),
          enrollmentId: enrollments[i].id,
          semesterEnrollment: enrollments[i].data.semester,
          tahunAjaran: enrollments[i].data.tahunAjaran
        });
      }
    });
    return mkList;
  } catch (error) {
    console.error('Error getMataKuliahDiambil:', error);
    return [];
  }
}

function getPertemuanTerkini(mk) {
  if (!mk.materi || !Array.isArray(mk.materi)) return 0;
  return mk.materi.filter(m => m.status === 'selesai').length;
}

async function getTugasAktif(mkIds) {
  try {
    if (mkIds.length === 0) return [];
    const now = new Date().toISOString();

    // ✅ OPTIMISASI KUOTA: sebelumnya query 'tugas' dijalankan TERPISAH utk
    // SETIAP mata kuliah (N query utk N MK yang diambil mahasiswa - mahasiswa
    // dg 8 MK = 8 query serial). Sekarang di-batch pakai `where(...,'in',...)`
    // per 10 mkId sekaligus, jadi maksimal N/10 query, dijalankan paralel.
    function chunkArray(arr, size) {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    }
    const chunks = chunkArray(mkIds, 10);
    const snapshots = await Promise.all(chunks.map(chunk =>
      db.collection('tugas')
        .where('mkId', 'in', chunk)
        .where('deadline', '>', now)
        .get()
    ));

    const tugasList = [];
    snapshots.forEach(snapshot => {
      snapshot.docs.forEach(doc => tugasList.push({ id: doc.id, ...doc.data() }));
    });
    tugasList.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
    return tugasList;
  } catch (error) {
    console.error('Error getTugasAktif:', error);
    return [];
  }
}

// Fungsi baru untuk mengambil upcoming events
async function getUpcomingEvents(limit = 3) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await db.collection('jadwalPenting')
      .where('tanggal', '>=', today)
      .orderBy('tanggal', 'asc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getUpcomingEvents:', error);
    return [];
  }
}

// ============================================================================
// RUTE UTAMA DASHBOARD
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const user = req.user;
    const userId = user.id;

    // ⚡ OPTIMISASI KECEPATAN: tagihan, daftar MK, dan event terdekat SAMA
    // SEKALI TIDAK SALING BERGANTUNG - dijalankan bersamaan lewat Promise.all
    // alih-alih menunggu satu-satu berurutan. Hanya getTugasAktif yang harus
    // menunggu (butuh mkIds dari mkList dulu).
    const [tagihan, mkList, upcomingEvents] = await Promise.all([
      getTagihan(userId),
      getMataKuliahDiambil(userId),
      getUpcomingEvents(3)
    ]);
    const mkIds = mkList.map(mk => mk.id);
    const totalSks = mkList.reduce((acc, mk) => acc + (mk.sks || 0), 0);
    const tugasAktif = await getTugasAktif(mkIds);

    const currentSemester = getCurrentAcademicSemester();
    const semesterSekarang = currentSemester.label;

    let pertemuanRata = 0;
    if (mkList.length > 0) {
      const totalPertemuan = mkList.reduce((acc, mk) => acc + getPertemuanTerkini(mk), 0);
      pertemuanRata = Math.round(totalPertemuan / mkList.length);
    }

    // Hitung total tagihan
    let totalTagihan = 0;
    let totalLunas = 0;
    tagihan.forEach(t => {
      if (t.status === 'lunas') {
        totalLunas += t.jumlah;
      } else {
        totalTagihan += t.jumlah;
      }
    });
    const sisaTagihan = totalTagihan; // total yang belum lunas

    res.render('mahasiswa/dashboard', {
      user,
      uploadSuccess: req.query.upload === 'success',
      tagihan,
      totalTagihan,
      totalLunas,
      sisaTagihan,
      totalSks,
      semesterSekarang,
      pertemuanRata,
      tugasAktif,
      upcomingEvents  // <-- ditambahkan
    });

  } catch (error) {
    console.error('Error loading mahasiswa dashboard:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat dashboard mahasiswa'
    });
  }
});

module.exports = router;