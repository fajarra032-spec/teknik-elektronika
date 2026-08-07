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

    const mahasiswaSnapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .orderBy('nim')
      .get();

    const khsList = [];
    const semesterSet = new Set();

    for (const doc of mahasiswaSnapshot.docs) {
      const mahasiswa = { id: doc.id, ...doc.data() };
      const angkatanMhs = getAngkatanFromNim(mahasiswa.nim);
      if (angkatan && angkatanMhs !== angkatan) continue;

      const { perSemester } = await getTranskripMahasiswa(mahasiswa.id);
      perSemester.forEach(s => {
        semesterSet.add(s.semester);
        if (semester && s.semester !== semester) return;
        khsList.push({
          userId: mahasiswa.id,
          semester: s.semester,
          ips: s.ips,
          totalSKS: s.totalSKS,
          jumlahMatkul: s.matkul.length,
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
      String(a.semester).localeCompare(String(b.semester))
    );

    const semesterList = Array.from(semesterSet).sort();
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
