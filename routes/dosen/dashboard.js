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
    const currentSemester = getCurrentAcademicSemester();
    const dosenId = req.dosen.id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // ⚡ OPTIMISASI KECEPATAN (bukan cuma kuota): 5 query di bawah ini SAMA
    // SEKALI TIDAK SALING BERGANTUNG - sebelumnya ditulis `await` satu per
    // satu berurutan, jadi total waktu tunggu = JUMLAH semua waktu round-trip
    // Firestore-nya (mis. 5 x 150ms = 750ms). Dijalankan bersamaan lewat
    // Promise.all, total waktu tunggu = waktu round-trip PALING LAMA saja
    // (mis. cuma ~150-200ms) - dashboard terasa jauh lebih cepat dibuka,
    // terlepas dari optimasi jumlah baca dokumen yang sudah dilakukan
    // sebelumnya.
    const [mkSnapshot, bimbingan1, bimbingan2, tugasSemua, eventsSnapshot] = await Promise.all([
      db.collection('mataKuliah').where('dosenIds', 'array-contains', dosenId).get(),
      db.collection('bimbingan').where('pembimbing1Id', '==', dosenId).where('status', '==', 'active').get(),
      db.collection('bimbingan').where('pembimbing2Id', '==', dosenId).where('status', '==', 'active').get(),
      db.collection('tugas').where('dosenId', '==', dosenId).get(),
      db.collection('jadwalPenting').where('tanggal', '>=', today).orderBy('tanggal', 'asc').limit(5).get()
    ]);

    // ========================================================================
    // 1. Mata Kuliah yang diampu dan progress pertemuan
    // ========================================================================
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
      totalPertemuanTerlaksana += mk.materi.filter(m => m.status === 'selesai').length;
    }
    const totalPertemuanMax = mkCount * PERTEMUAN_PER_MK;
    const persentasePengajaran = totalPertemuanMax > 0
      ? Math.round((totalPertemuanTerlaksana / totalPertemuanMax) * 100)
      : 0;

    // ========================================================================
    // 2. Total mahasiswa bimbingan
    // ========================================================================
    const mahasiswaBimbinganIds = new Set();
    bimbingan1.docs.forEach(doc => mahasiswaBimbinganIds.add(doc.data().mahasiswaId));
    bimbingan2.docs.forEach(doc => mahasiswaBimbinganIds.add(doc.data().mahasiswaId));
    const totalMahasiswa = mahasiswaBimbinganIds.size;

    // ========================================================================
    // 2b. Total mahasiswa PA (Pembimbing Akademik) - beda dari bimbingan
    // magang di atas, ini berdasarkan field dosenPaId di dokumen mahasiswa
    // ========================================================================
    const totalMahasiswaPa = await hitungJumlah(
      db.collection('users').where('role', '==', 'mahasiswa').where('dosenPaId', '==', dosen.id)
    );

    // ========================================================================
    // 3 & 4. Tugas aktif + Pengumpulan belum dinilai
    // ========================================================================
    let tugasAktif = 0;
    const tugasIds = [];
    tugasSemua.docs.forEach(doc => {
      tugasIds.push(doc.id);
      if ((doc.data().deadline || '') > now) tugasAktif++;
    });

    // ⚡ Chunk 'pengumpulan' dijalankan PARALEL (Promise.all), bukan for-loop
    // serial menunggu satu chunk selesai baru lanjut ke chunk berikutnya.
    const pengumpulanChunkCounts = await Promise.all(
      chunkArray(tugasIds, 10)
        .filter(chunk => chunk.length > 0)
        .map(chunk => hitungJumlah(
          db.collection('pengumpulan').where('tugasId', 'in', chunk).where('status', '==', 'dikumpulkan')
        ))
    );
    const pengumpulanBelumDinilai = pengumpulanChunkCounts.reduce((a, b) => a + b, 0);

    // ========================================================================
    // 5. Event terdekat (sudah diambil paralel di atas)
    // ========================================================================
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ========================================================================
    // 6. Logbook: daftar pending + statistik approved/total
    // ========================================================================
    // ⚡ Chunk 'logbookMagang' juga dijalankan PARALEL, bukan for-loop serial.
    const mahasiswaIdsArr = Array.from(mahasiswaBimbinganIds);
    const logbookChunkSnaps = await Promise.all(
      chunkArray(mahasiswaIdsArr, 10)
        .filter(chunk => chunk.length > 0)
        .map(chunk => db.collection('logbookMagang').where('userId', 'in', chunk).get())
    );

    let totalLogbookAll = 0;
    let totalLogbookApproved = 0;
    const pendingRaw = []; // { id, mahasiswaId, data }
    logbookChunkSnaps.forEach(logbookSnap => {
      logbookSnap.docs.forEach(logbookDoc => {
        const data = logbookDoc.data();
        totalLogbookAll++;
        if (data.status === 'approved') totalLogbookApproved++;
        if (data.status === 'pending') {
          pendingRaw.push({ id: logbookDoc.id, mahasiswaId: data.userId, data });
        }
      });
    });

    // Ambil semua dokumen 'users' yang dibutuhkan utk entri pending SEKALIGUS.
    const userIdsUnik = [...new Set(pendingRaw.map(p => p.mahasiswaId))];
    const userDocsMap = new Map();
    if (userIdsUnik.length > 0) {
      const userRefs = userIdsUnik.map(uid => db.collection('users').doc(uid));
      const userDocs = await db.getAll(...userRefs);
      userDocs.forEach(doc => {
        if (doc.exists) userDocsMap.set(doc.id, doc.data());
      });
    }

    // ⚡ INI YANG PALING BERDAMPAK KE KECEPATAN: pdkInfo per entri pending
    // SEBELUMNYA di-query satu per satu dalam for-loop serial - kalau ada
    // 15 logbook pending, itu 15 round-trip Firestore MENUNGGU BERURUTAN
    // (bisa nambah 1-3 detik sendiri ke waktu loading). Sekarang semuanya
    // dijalankan BERSAMAAN lewat Promise.all.
    const logbookPendingList = await Promise.all(pendingRaw.map(async item => {
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
      return {
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
      };
    }));

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
      currentSemester,
      mkCount,
      totalPertemuanTerlaksana,
      totalPertemuanMax,
      persentasePengajaran,
      totalMahasiswa,
      totalMahasiswaPa,
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