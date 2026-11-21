const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper'); // <-- IMPORT HELPER
const { getStatusRpsDosen } = require('../../helpers/rpsReminderHelper');
const { TTLCache } = require('../../helpers/cache');
const { ambilPeriodePerMahasiswa, periodeSudahBerakhir, hariIniWITA } = require('../../helpers/periodeMagangHelper');
const { getRencanaPertemuan } = require('../../data/rencanaPertemuanData');

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

// ============================================================================
// Badge angka pada menu dashboard (cache 5 menit per dosen, memakai count()
// agar murah). Gagal salah satu = angkanya 0, dashboard tetap tampil.
// ============================================================================
const badgeCache = new TTLCache(5 * 60 * 1000);
async function hitungDok(query) {
  try {
    const r = await query.count().get();
    return r.data().count || 0;
  } catch (e) {
    try { return (await query.get()).size; } catch (e2) { return 0; }
  }
}
function getBadgeMenu(dosenId) {
  return badgeCache.getOrFetch(dosenId, async () => {
    const q = (col) => db.collection(col).where('dosenId', '==', dosenId);
    const [penelitian, pengabdian, buku, sertifikat, sk, suratPending, tugasPending] = await Promise.all([
      hitungDok(q('penelitian')), hitungDok(q('pengabdian')), hitungDok(q('buku')),
      hitungDok(q('sertifikatDosen')), hitungDok(q('sk_dosen')),
      hitungDok(q('surat_dosen').where('status', '==', 'pending')),
      hitungDok(q('surat_tugas').where('status', '==', 'pending'))
    ]);
    return { penelitian, pengabdian, buku, sertifikat, sk, suratDiproses: suratPending + tugasPending };
  });
}

router.get('/', async (req, res) => {
  try {
    const dosen = req.dosen;
    const currentSemester = getCurrentAcademicSemester();
    const dosenId = req.dosen.id;
    // Tanggal menurut WITA (toISOString = UTC, salah hari antara 00.00-08.00 WITA)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const now = new Date().toISOString();

    // ⚡ OPTIMISASI KECEPATAN (bukan cuma kuota): 5 query di bawah ini SAMA
    // SEKALI TIDAK SALING BERGANTUNG - sebelumnya ditulis `await` satu per
    // satu berurutan, jadi total waktu tunggu = JUMLAH semua waktu round-trip
    // Firestore-nya (mis. 5 x 150ms = 750ms). Dijalankan bersamaan lewat
    // Promise.all, total waktu tunggu = waktu round-trip PALING LAMA saja
    // (mis. cuma ~150-200ms) - dashboard terasa jauh lebih cepat dibuka,
    // terlepas dari optimasi jumlah baca dokumen yang sudah dilakukan
    // sebelumnya.
    // REVISI: pembimbing magang = Dosen PA (Pembimbing 1 & 2 ditiadakan),
    // jadi mahasiswa bimbingan = mahasiswa aktif dengan dosenPaId = dosen ini.
    const [mkSnapshot, mahasiswaPaSnap, tugasSemua, eventsSnapshot] = await Promise.all([
      db.collection('mataKuliah').where('dosenIds', 'array-contains', dosenId).get(),
      db.collection('users').where('role', '==', 'mahasiswa').where('dosenPaId', '==', dosenId).get(),
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
      kelas: doc.data().kelas || null,
      jadwal: doc.data().jadwal || '',
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

    // Topik pertemuan berikutnya per MK (hanya MK periode aktif)
    let pertemuanBerikutnya = [];
    try {
      const aktif = await getStatusRpsDosen(db, dosenId);
      const idAktif = new Set(aktif.daftar.map(x => x.id));
      pertemuanBerikutnya = mkList.filter(mk => idAktif.has(mk.id)).map(mk => {
        const rencana = getRencanaPertemuan(mk.kode) || [];
        const selesaiSet = new Set(mk.materi.filter(m => m.status === 'selesai').map(m => m.pertemuan));
        let ke = null;
        for (let i = 1; i <= PERTEMUAN_PER_MK; i++) { if (!selesaiSet.has(i)) { ke = i; break; } }
        const rm = ke ? mk.materi.find(m => m.pertemuan === ke) : null;
        const rr = ke ? rencana.find(r => r.pertemuan === ke) : null;
        const generik = !rm || !rm.topik || /^Pertemuan \d+$/i.test(rm.topik);
        return {
          id: mk.id, kode: mk.kode, nama: mk.nama, kelas: mk.kelas, jadwal: mk.jadwal,
          ke, topik: ke ? (!generik ? rm.topik : (rr ? rr.topik : '')) : '',
          tanggal: rm && rm.tanggal ? rm.tanggal : null,
          jenis: rr ? rr.jenis : null,
          selesai: selesaiSet.size, total: PERTEMUAN_PER_MK
        };
      }).sort((a, b) => String(a.kode).localeCompare(String(b.kode)));
    } catch (e) {
      console.error('Gagal menyusun pertemuan berikutnya:', e.message);
    }

    // Badge menu (surat, SK, penelitian, dst.) + status RPS semester aktif
    let badgeMenu = { penelitian: 0, pengabdian: 0, buku: 0, sertifikat: 0, sk: 0, suratDiproses: 0 };
    try { badgeMenu = await getBadgeMenu(dosenId); } catch (e) { console.error('Gagal badge menu:', e.message); }
    badgeMenu = Object.assign({}, badgeMenu, { mk: pertemuanBerikutnya.length, rpsBelum: 0, rpsTotal: 0 });
    try {
      const rps = await getStatusRpsDosen(db, dosenId);
      badgeMenu.rpsBelum = rps.belum.length; badgeMenu.rpsTotal = rps.total;
    } catch (e) { /* abaikan */ }

    // ========================================================================
    // 2. Total mahasiswa bimbingan
    // ========================================================================
    const mahasiswaBimbinganIds = new Set();
    mahasiswaPaSnap.docs.forEach(doc => {
      const sm = doc.data().statusMahasiswa;
      if (!sm || sm === 'Aktif') mahasiswaBimbinganIds.add(doc.id);
    });
    const totalMahasiswa = mahasiswaBimbinganIds.size;

    // Mahasiswa bimbingan yang MAGANGNYA AKTIF: Dosen PA-nya Anda, status mahasiswa Aktif, dan punya
    // periode magang berstatus active/locked yang sudah mulai & belum berakhir. Tidak sama dengan Mahasiswa PA.
    let totalMagangAktif = 0;
    try {
      const hariIni = hariIniWITA();
      const petaPeriode = await ambilPeriodePerMahasiswa(db, Array.from(mahasiswaBimbinganIds));
      petaPeriode.forEach(periods => {
        const berjalan = periods.some(pr =>
          (pr.status === 'active' || pr.status === 'locked') &&
          !periodeSudahBerakhir(pr, hariIni) &&
          !(pr.tanggalMulai && String(pr.tanggalMulai).substring(0, 10) > hariIni));
        if (berjalan) totalMagangAktif++;
      });
    } catch (e) {
      console.error('Gagal menghitung mahasiswa magang aktif:', e.message);
    }

    // ========================================================================
    // 2b. Total mahasiswa PA (semua status, termasuk non-aktif) - field
    // dosenPaId di dokumen mahasiswa. Mahasiswa bimbingan magang di atas
    // adalah subset-nya (yang statusnya Aktif).
    // ========================================================================
    // Query-nya sama persis dengan mahasiswaPaSnap di atas: pakai .size, tidak perlu query ulang.
    const totalMahasiswaPa = mahasiswaPaSnap.size;

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
    // 4b. LKM Praktikum yang sudah dikumpulkan mahasiswa tapi belum diperiksa
    // dosen (status 'dikumpulkan', bukan 'diperiksa') - lintas semua MK yang
    // diampu dosen ini.
    // ========================================================================
    const mkIdsSemua = mkSnapshot.docs.map(doc => doc.id);
    const lkmChunkCounts = await Promise.all(
      chunkArray(mkIdsSemua, 10)
        .filter(chunk => chunk.length > 0)
        .map(chunk => hitungJumlah(
          db.collection('lkmPengumpulan').where('mkId', 'in', chunk).where('status', '==', 'dikumpulkan')
        ))
    );
    const lkmBelumDiperiksa = lkmChunkCounts.reduce((a, b) => a + b, 0);

    // ========================================================================
    // 5. Event terdekat (sudah diambil paralel di atas)
    // ========================================================================
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // ========================================================================
    // 6. Logbook: daftar pending + statistik approved/total
    // ========================================================================
    // ✅ OPTIMISASI KUOTA BESAR: sebelumnya baris ini membaca SEMUA dokumen
    // logbook (isi lengkap, termasuk foto/teks kegiatan) untuk SETIAP
    // mahasiswa bimbingan dosen ini, HANYA untuk menghitung total & approved
    // serta mencari yang pending - kalau 1 dosen bimbing 20 mahasiswa dengan
    // ~100 entri logbook masing-masing, itu bisa 2000 baca dokumen SETIAP
    // KALI dashboard dibuka (halaman paling sering dikunjungi dosen).
    //
    // Sekarang:
    // - total & approved dihitung lewat count() agregasi (biaya TETAP 1
    //   read-unit per query, tidak peduli berapa banyak dokumennya)
    // - yang benar-benar dibaca ISI-nya HANYA entri berstatus 'pending'
    //   (biasanya jauh lebih sedikit daripada total, karena sebagian besar
    //   logbook lama sudah di-approve)
    const mahasiswaIdsArr = Array.from(mahasiswaBimbinganIds);
    const logbookChunks = chunkArray(mahasiswaIdsArr, 10).filter(chunk => chunk.length > 0);

    const [totalCounts, approvedCounts, pendingChunkSnaps] = await Promise.all([
      Promise.all(logbookChunks.map(chunk =>
        hitungJumlah(db.collection('logbookMagang').where('userId', 'in', chunk))
      )),
      Promise.all(logbookChunks.map(chunk =>
        hitungJumlah(db.collection('logbookMagang').where('userId', 'in', chunk).where('status', '==', 'approved'))
      )),
      Promise.all(logbookChunks.map(chunk =>
        db.collection('logbookMagang').where('userId', 'in', chunk).where('status', '==', 'pending').get()
      ))
    ]);

    const totalLogbookAll = totalCounts.reduce((sum, n) => sum + n, 0);
    const totalLogbookApproved = approvedCounts.reduce((sum, n) => sum + n, 0);
    const pendingRaw = []; // { id, mahasiswaId, data }
    pendingChunkSnaps.forEach(snap => {
      snap.docs.forEach(logbookDoc => {
        const data = logbookDoc.data();
        pendingRaw.push({ id: logbookDoc.id, mahasiswaId: data.userId, data });
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
      pertemuanBerikutnya,
      badgeMenu,
      totalMahasiswa,
      totalMagangAktif,
      totalMahasiswaPa,
      tugasAktif,
      pengumpulanBelumDinilai,
      lkmBelumDiperiksa,
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