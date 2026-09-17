/**
 * routes/admin/khs.js
 * KHS (Kartu Hasil Studi) — dihitung LIVE dari koleksi 'grades', bukan lagi
 * upload file PDF manual. Nilai bersumber dari nilai akhir yang sudah
 * dikunci admin (lihat routes/admin/nilai.js -> saveGradeFinal /
 * saveGradeFinalBulk), lalu dikonversi ke huruf/indeks/IPS/IPK memakai
 * skala resmi yang sama dengan file KHS/Transkrip Excel prodi
 * (lihat helpers/nilaiHelper.js -> nilaiKeHuruf).
 *
 * Perubahan dari versi lama:
 * - TIDAK ADA LAGI upload/hapus file ke Google Drive untuk KHS (folder
 *   'KHS_Mahasiswa' & koleksi 'khs' tidak dipakai lagi oleh modul ini).
 * - Daftar KHS sekarang = daftar (mahasiswa x semester) yang punya nilai
 *   di 'grades', dengan IPS dihitung otomatis, bukan diinput manual.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getTranskripMahasiswa } = require('../../helpers/nilaiHelper');
const { bandingkanLabelPeriode } = require('../../helpers/academicHelper');
const { getAllMahasiswa } = require('../../helpers/cache');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/**
 * Mendapatkan angkatan dari NIM (2 digit pertama)
 */
function getAngkatanFromNim(nim) {
  if (!nim || nim.length < 2) return 'Unknown';
  return '20' + nim.substring(0, 2);
}

/**
 * Jalankan `fn(item)` untuk setiap item di `items`, maksimal `limit` item
 * berjalan BERSAMAAN (bukan satu-satu berurutan, dan bukan juga semuanya
 * sekaligus tanpa batas). Dipakai supaya panggilan getTranskripMahasiswa()
 * per mahasiswa di bawah tidak menembak Firestore satu-satu (lambat) atau
 * ratusan sekaligus dalam sekali hentakan (berisiko kena rate limit) -
 * lihat komentar di router.get('/list').
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workerCount = Math.min(limit, items.length) || 0;
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

// ============================================================================
// DAFTAR KHS (semua mahasiswa x semester yang punya nilai)
// ============================================================================

/**
 * GET /admin/khs/list
 * Menampilkan daftar KHS (per mahasiswa per semester), dihitung live.
 * Filter opsional: ?semester=...&angkatan=...
 */
router.get('/list', async (req, res) => {
  try {
    const { semester, angkatan } = req.query;

    // ✅ CACHE: sebelumnya koleksi 'users' (role=mahasiswa) dibaca ulang
    // penuh dari Firestore setiap kali halaman ini dibuka. Sekarang pakai
    // getAllMahasiswa() (cache bersama 10 menit, lihat helpers/cache.js) -
    // yang juga dipakai /admin/mahasiswa, jadi kunjungan ke dua halaman itu
    // bergantian bisa saling numpang cache tanpa baca ulang Firestore.
    const semuaMahasiswa = await getAllMahasiswa(db);
    const mahasiswaList = [...semuaMahasiswa].sort((a, b) => String(a.nim || '').localeCompare(String(b.nim || '')));

    // Filter angkatan DULU (sebelum panggilan mahal getTranskripMahasiswa
    // di bawah), supaya kalau admin sudah memfilter per angkatan, jumlah
    // mahasiswa yang benar-benar perlu dihitung transkripnya jauh lebih
    // sedikit dari seluruh mahasiswa.
    const mahasiswaTerfilter = mahasiswaList
      .map(m => ({ mahasiswa: m, angkatanMhs: getAngkatanFromNim(m.nim) }))
      .filter(({ angkatanMhs }) => !angkatan || angkatanMhs === angkatan);

    // ✅ OPTIMISASI TERBESAR DI HALAMAN INI: sebelumnya getTranskripMahasiswa()
    // dipanggil satu-satu di dalam `for` loop dengan `await` - kalau ada
    // 300 mahasiswa, itu 300 "putaran" tunggu-jawab BERURUTAN ke Firestore
    // (masing-masing ~2-3 query), padahal tidak ada satupun yang butuh hasil
    // mahasiswa lain. Sekarang dijalankan PARALEL lewat mapWithConcurrency
    // (maks 20 mahasiswa diproses bersamaan) - jauh lebih cepat, dan tetap
    // tidak menembak Firestore semuanya sekaligus dalam satu hentakan.
    const hasilPerMahasiswa = await mapWithConcurrency(
      mahasiswaTerfilter,
      20,
      async ({ mahasiswa, angkatanMhs }) => {
        const { perSemester } = await getTranskripMahasiswa(mahasiswa.id);
        return { mahasiswa, angkatanMhs, perSemester };
      }
    );

    const khsList = [];
    const semesterSet = new Set();

    for (const { mahasiswa, angkatanMhs, perSemester } of hasilPerMahasiswa) {
      perSemester.forEach(s => {
        semesterSet.add(s.semester);
        if (semester && s.semester !== semester) return;
        khsList.push({
          userId: mahasiswa.id,
          semester: s.semester,
          ips: s.ips,
          totalSKS: s.totalSKS,
          jumlahMatkul: s.matkul.length,
          jumlahBelumNilai: s.jumlahBelumNilai,
          mahasiswa: {
            nama: mahasiswa.nama,
            nim: mahasiswa.nim,
            foto: mahasiswa.foto,
            angkatan: angkatanMhs
          }
        });
      });
    }

    khsList.sort((a, b) =>
      String(a.mahasiswa.nim).localeCompare(String(b.mahasiswa.nim)) ||
      bandingkanLabelPeriode(a.semester, b.semester)
    );

    const semesterList = Array.from(semesterSet).sort(bandingkanLabelPeriode);
    const angkatanList = Array.from(new Set(khsList.map(k => k.mahasiswa.angkatan))).sort().reverse();

    res.render('admin/khs_list', {
      title: 'Daftar KHS',
      khsList,
      semesterList,
      angkatanList,
      filters: { semester, angkatan }
    });
  } catch (error) {
    console.error('Error mengambil KHS:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat daftar KHS'
    });
  }
});

// ============================================================================
// DETAIL / CETAK KHS SATU MAHASISWA UNTUK SATU SEMESTER
// ============================================================================

/**
 * GET /admin/khs/:userId/:semester
 * Menampilkan KHS lengkap (tabel matkul, nilai, huruf, indeks, SKS indeks,
 * IPS) untuk satu mahasiswa pada satu semester — layout mengikuti sheet
 * "Semester N" pada file Excel KHS resmi, siap dicetak (tombol Cetak).
 * Catatan: :semester ada di URL sehingga harus di-encodeURIComponent oleh
 * pemanggil (label semester mengandung spasi/slash, mis. "Ganjil 2025/2026").
 */
router.get('/:userId/:semester', async (req, res) => {
  try {
    const { userId, semester } = req.params;
    const semesterLabel = decodeURIComponent(semester);

    const mahasiswaDoc = await db.collection('users').doc(userId).get();
    if (!mahasiswaDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mahasiswa tidak ditemukan' });
    }
    const mahasiswa = { id: userId, ...mahasiswaDoc.data() };

    const { perSemester, ipk, totalSKS } = await getTranskripMahasiswa(userId);
    const khs = perSemester.find(s => s.semester === semesterLabel);

    if (!khs) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: `Belum ada nilai terkunci untuk ${mahasiswa.nama} pada semester "${semesterLabel}"`
      });
    }

    // SKS & IPK kumulatif "s.d. semester ini" (sesuai posisi semester di urutan perSemester)
    const idx = perSemester.findIndex(s => s.semester === semesterLabel);
    const sampaiSemesterIni = perSemester.slice(0, idx + 1);
    let sksKum = 0, bobotKum = 0;
    sampaiSemesterIni.forEach(s => { sksKum += s.totalSKS; bobotKum += s.totalSksIndeks; });
    const ipkSampaiSemesterIni = sksKum > 0 ? (bobotKum / sksKum).toFixed(2) : '0.00';

    res.render('admin/khs_detail', {
      title: `KHS - ${mahasiswa.nama} - ${semesterLabel}`,
      mahasiswa,
      khs,
      ipkSampaiSemesterIni,
      sksKumulatif: sksKum,
      ipkAkhir: ipk,
      totalSKSAkhir: totalSKS
    });
  } catch (error) {
    console.error('Error detail KHS:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat detail KHS'
    });
  }
});

module.exports = router;
