const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper'); // <-- IMPORT HELPER

router.use(verifyToken);
router.use(isDosen);

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Pecah array jadi potongan kecil (Firestore 'in' query maksimal ~30 nilai
 * per query - dipakai 10 di sini biar aman untuk versi SDK yang lebih lama). */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

/** Hitung jumlah dokumen cocok TANPA membaca isinya (count() aggregation),
 * dengan fallback ke .get().size kalau SDK belum mendukung count(). */
async function hitungJumlah(query) {
  try {
    const snap = await query.count().get();
    return snap.data().count;
  } catch (err) {
    console.error('count() tidak tersedia, fallback ke get().size:', err.message);
    const snap = await query.get();
    return snap.size;
  }
}

router.get('/', async (req, res) => {
  try {
    const dosen = req.dosen;

    // ========================================================================
    // 0. Semester saat ini (untuk ditampilkan di dashboard)
    // ========================================================================
    const currentSemester = getCurrentAcademicSemester(); // dapatkan semester saat ini

    // ========================================================================
    // 1. Mata Kuliah yang diampu dan progress pertemuan
    // ========================================================================
    const mkSnapshot = await db.collection('mataKuliah')
      .where('dosenIds', 'array-contains', req.dosen.id)
      .get();
    const mkList = mkSnapshot.docs.map(doc => ({
      id: doc.id,
      kode: doc.data().kode,
      nama: doc.data().nama,
      semester: doc.data().semester,
      sks: doc.data().sks,
      materi: doc.data().materi || []
    }));
    const mkCount = mkList.length;

    const PERTEMUAN_PER_MK = 16;
    let totalPertemuanTerlaksana = 0;
    for (const mk of mkList) {
      const terlaksana = mk.materi.filter(m => m.status === 'selesai').length;
      totalPertemuanTerlaksana += terlaksana;
    }
    const totalPertemuanMax = mkCount * PERTEMUAN_PER_MK;
    const persentasePengajaran = totalPertemuanMax > 0 
      ? Math.round((totalPertemuanTerlaksana / totalPertemuanMax) * 100) 
      : 0;

    // ========================================================================
    // 2. Total mahasiswa bimbingan
    // ========================================================================
    const bimbingan1 = await db.collection('bimbingan')
      .where('pembimbing1Id', '==', req.dosen.id)
      .where('status', '==', 'active')
      .get();
    const bimbingan2 = await db.collection('bimbingan')
      .where('pembimbing2Id', '==', req.dosen.id)
      .where('status', '==', 'active')
      .get();
    const mahasiswaBimbinganIds = new Set();
    bimbingan1.docs.forEach(doc => mahasiswaBimbinganIds.add(doc.data().mahasiswaId));
    bimbingan2.docs.forEach(doc => mahasiswaBimbinganIds.add(doc.data().mahasiswaId));
    const totalMahasiswa = mahasiswaBimbinganIds.size;

    // ========================================================================
    // 3 & 4. Tugas aktif + Pengumpulan belum dinilai
    // ========================================================================
    // ✅ OPTIMISASI KUOTA: sebelumnya ada 2 masalah di sini:
    //  (a) tugasAktif dihitung lewat query TERPISAH dari tugasSemua, padahal
    //      datanya bisa dihitung dari HASIL YANG SAMA (satu query 'tugas'
    //      cukup, filter deadline > now cukup di JS).
    //  (b) pengumpulanBelumDinilai dihitung dengan query 'pengumpulan'
    //      TERPISAH UNTUK SETIAP TUGAS (N query utk N tugas) - kalau dosen
    //      punya 20 tugas, itu 20 pembacaan minimum SETIAP KALI dashboard
    //      dibuka. Sekarang digabung jadi query batch (`where('tugasId','in',...)`)
    //      per 10 tugasId sekaligus, jadi maksimal N/10 query saja.
    const tugasSemua = await db.collection('tugas')
      .where('dosenId', '==', req.dosen.id)
      .get();

    const now = new Date().toISOString();
    let tugasAktif = 0;
    const tugasIds = [];
    tugasSemua.docs.forEach(doc => {
      tugasIds.push(doc.id);
      if ((doc.data().deadline || '') > now) tugasAktif++;
    });

    let pengumpulanBelumDinilai = 0;
    for (const chunk of chunkArray(tugasIds, 10)) {
      if (chunk.length === 0) continue;
      pengumpulanBelumDinilai += await hitungJumlah(
        db.collection('pengumpulan')
          .where('tugasId', 'in', chunk)
          .where('status', '==', 'dikumpulkan')
      );
    }

    // ========================================================================
    // 5. Event terdekat
    // ========================================================================
    const today = new Date().toISOString().split('T')[0];
    const eventsSnapshot = await db.collection('jadwalPenting')
      .where('tanggal', '>=', today)
      .orderBy('tanggal', 'asc')
      .limit(5)
      .get();
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ========================================================================
    // 6. Logbook: daftar pending + statistik approved/total
    // ========================================================================
    // ✅ OPTIMISASI KUOTA: sebelumnya query 'logbookMagang' dijalankan SATU
    // PER SATU untuk setiap mahasiswa bimbingan (N query utk N mahasiswa),
    // dan untuk tiap entri pending, dokumen 'users' juga diambil SATU PER
    // SATU. Sekarang: logbook diambil per-batch (10 mahasiswaId sekaligus
    // lewat 'in'), dan semua dokumen 'users' yang dibutuhkan diambil
    // SEKALIGUS lewat db.getAll(...) - bukan satu per satu dalam loop.
    let totalLogbookAll = 0;
    let totalLogbookApproved = 0;
    const pendingRaw = []; // { id, mahasiswaId, data }

    const mahasiswaIdsArr = Array.from(mahasiswaBimbinganIds);
    for (const chunk of chunkArray(mahasiswaIdsArr, 10)) {
      if (chunk.length === 0) continue;
      const logbookSnap = await db.collection('logbookMagang')
        .where('userId', 'in', chunk)
        .get();

      logbookSnap.docs.forEach(logbookDoc => {
        const data = logbookDoc.data();
        totalLogbookAll++;
        if (data.status === 'approved') totalLogbookApproved++;
        if (data.status === 'pending') {
          pendingRaw.push({ id: logbookDoc.id, mahasiswaId: data.userId, data });
        }
      });
    }

    // Ambil semua dokumen 'users' yang dibutuhkan utk entri pending SEKALIGUS
    // (satu round-trip), bukan satu per satu di dalam loop.
    const userIdsUnik = [...new Set(pendingRaw.map(p => p.mahasiswaId))];
    const userDocsMap = new Map();
    if (userIdsUnik.length > 0) {
      const userRefs = userIdsUnik.map(uid => db.collection('users').doc(uid));
      const userDocs = await db.getAll(...userRefs);
      userDocs.forEach(doc => {
        if (doc.exists) userDocsMap.set(doc.id, doc.data());
      });
    }

    // pdkInfo per entri pending tetap query kecil per-item (biasanya jumlah
    // pending jauh lebih sedikit daripada total logbook, jadi dampaknya
    // kecil) - tapi hanya dijalankan untuk yang benar-benar pending.
    const logbookPendingList = [];
    for (const item of pendingRaw) {
      const userData = userDocsMap.get(item.mahasiswaId);
      const mahasiswaNama = userData ? userData.nama : 'Unknown';
      const mahasiswaNim = userData ? userData.nim : '-';
      let pdkInfo = '';
      if (item.data.pdkId) {
        const periodSnap = await db.collection('magangPeriod')
          .where('pdkId', '==', item.data.pdkId)
          .where('mahasiswaId', '==', item.mahasiswaId)
          .limit(1)
          .get();
        if (!periodSnap.empty) {
          const period = periodSnap.docs[0].data();
          pdkInfo = `${period.pdkKode} - ${period.pdkNama}`;
        }
      }
      logbookPendingList.push({
        id: item.id,
        mahasiswaId: item.mahasiswaId,
        mahasiswaNama,
        mahasiswaNim,
        tanggal: item.data.tanggal,
        tanggalFormatted: formatDate(item.data.tanggal),
        kegiatan: item.data.kegiatan && item.data.kegiatan.length > 60 ? item.data.kegiatan.substring(0, 60) + '...' : (item.data.kegiatan || '-'),
        durasi: item.data.durasi,
        pdkInfo,
        imageCount: item.data.imageUrls ? item.data.imageUrls.length : 0
      });
    }

    logbookPendingList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    const recentLogbookPending = logbookPendingList.slice(0, 10);
    const logbookPendingCount = logbookPendingList.length;
    const logbookPersentase = totalLogbookAll > 0 ? Math.round((totalLogbookApproved / totalLogbookAll) * 100) : 0;

    // ========================================================================
    // 7. Render view
    // ========================================================================
    res.render('dosen/dashboard', {
      title: 'Dashboard Dosen',
      dosen,
      currentSemester,                     // <-- DITAMBAHKAN
      mkCount,
      totalPertemuanTerlaksana,
      totalPertemuanMax,
      persentasePengajaran,
      totalMahasiswa,
      tugasAktif,
      pengumpulanBelumDinilai,
      events,
      mkList: mkList.slice(0, 5),
      berita: [],
      logbookPendingList: recentLogbookPending,
      logbookPendingCount,
      totalLogbookApproved,
      totalLogbookAll,
      logbookPersentase
    });

  } catch (error) {
    console.error('Error loading dosen dashboard:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat dashboard dosen'
    });
  }
});

module.exports = router;