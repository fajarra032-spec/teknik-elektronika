// routes/dosen/laporanReview.js
// ============================================================================
// REVIEW LAPORAN MAGANG - oleh Dosen Pembimbing = DOSEN PA mahasiswa.
// REVISI: Pembimbing 1 & 2 ditiadakan; Dosen PA yang meninjau laporan DAN
// mengurus logbook (lihat helpers/pembimbingHelper.js).
// Alurnya: mahasiswa submit laporan -> Dosen PA tinjau & ACC -> setelah
// ACC, muncul form Nilai Laporan -> nilai ini jadi salah satu dari 3
// komponen Nilai Akhir Magang (lihat helpers/nilaiMagangHelper.js).
// ============================================================================

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getActivePdkWithPeriod } = require('../../helpers/magangHelper');
const {
  getNilaiMagang,
  getNilaiDosenEfektif
} = require('../../helpers/nilaiMagangHelper');
const {
  isPembimbingMahasiswa,
  getMahasiswaBimbinganPa
} = require('../../helpers/pembimbingHelper');

router.use(verifyToken);
router.use(isDosen);

async function getMahasiswa(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) return { id: userDoc.id, ...userDoc.data() };
    return { id: userId, nama: 'Unknown', nim: '-' };
  } catch (error) {
    console.error('Error getMahasiswa:', error);
    return { id: userId, nama: 'Error', nim: '-' };
  }
}

/** Daftar mahasiswa aktif yang Dosen PA-nya adalah dosen ini. */
async function getMahasiswaBimbingan1(dosenId) {
  return getMahasiswaBimbinganPa(dosenId);
}

// ============================================================================
// DAFTAR MAHASISWA BIMBINGAN (Dosen PA) + status laporan & nilai
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const mahasiswaList = await getMahasiswaBimbingan1(req.dosen.id);

    const hasil = await Promise.all(mahasiswaList.map(async mhs => {
      const laporanSnapshot = await db.collection('laporanMagang')
        .where('userId', '==', mhs.id)
        .get();
      const laporanList = laporanSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const adaYangAcc = laporanList.some(l => l.status === 'approved');
      const adaYangBelumDitinjau = laporanList.some(l => l.status === 'submitted' || !l.status);

      const pdkList = await getActivePdkWithPeriod(mhs.id);
      let statusNilai = '-';
      if (pdkList.length > 0) {
        const nm = await getNilaiMagang(mhs.id, pdkList[0].pdkId);
        const nilaiDosen = getNilaiDosenEfektif(nm).nilai;
        statusNilai = nilaiDosen !== null ? `Sudah dinilai (${nilaiDosen})` : (adaYangAcc ? 'Siap dinilai' : 'Menunggu ACC');
      }

      return {
        mahasiswa: mhs,
        jumlahLaporan: laporanList.length,
        adaYangAcc,
        adaYangBelumDitinjau,
        statusNilai
      };
    }));

    hasil.sort((a, b) => String(a.mahasiswa.nim).localeCompare(String(b.mahasiswa.nim)));

    res.render('dosen/laporan_review_list', {
      title: 'Review Laporan Magang',
      daftar: hasil
    });
  } catch (error) {
    console.error('Error daftar review laporan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat daftar laporan: ' + error.message });
  }
});

// ============================================================================
// DETAIL LAPORAN SATU MAHASISWA - tinjau, ACC, dan form nilai
// ============================================================================
router.get('/mahasiswa/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Pastikan dosen ini Dosen PA (pembimbing) mahasiswa tsb
    const { isBimbingan } = await isPembimbingMahasiswa(req.dosen.id, userId);
    if (!isBimbingan) {
      return res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda bukan Dosen Pembimbing (Dosen PA) mahasiswa ini.' });
    }

    const mahasiswa = await getMahasiswa(userId);

    const laporanSnapshot = await db.collection('laporanMagang')
      .where('userId', '==', userId)
      .orderBy('laporanKe', 'asc')
      .get();
    const laporanList = laporanSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const adaYangAcc = laporanList.some(l => l.status === 'approved');

    const pdkList = await getActivePdkWithPeriod(userId);
    const pdkIdDipilih = req.query.pdkId || (pdkList[0] && pdkList[0].pdkId) || null;
    const nilaiMagang = pdkIdDipilih ? await getNilaiMagang(userId, pdkIdDipilih) : null;

    res.render('dosen/laporan_review_detail', {
      title: `Review Laporan - ${mahasiswa.nama}`,
      mahasiswa,
      laporanList,
      adaYangAcc,
      pdkList,
      pdkIdDipilih,
      nilaiMagang,
      nilaiDosenEfektif: getNilaiDosenEfektif(nilaiMagang),
      success: req.query.success
    });
  } catch (error) {
    console.error('Error detail review laporan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail laporan: ' + error.message });
  }
});

// ============================================================================
// ACC / TOLAK LAPORAN (per submission, laporanKe 1/2/3)
// ============================================================================
router.post('/:laporanId/status', async (req, res) => {
  try {
    const { status, catatan } = req.body;
    const docRef = db.collection('laporanMagang').doc(req.params.laporanId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Laporan tidak ditemukan');
    const userId = doc.data().userId;

    // Pastikan dosen ini Dosen PA (pembimbing) mahasiswa tsb
    const { isBimbingan } = await isPembimbingMahasiswa(req.dosen.id, userId);
    if (!isBimbingan) return res.status(403).send('Anda bukan Dosen Pembimbing (Dosen PA) mahasiswa ini.');

    const updateData = {
      status,
      catatanPembimbing: catatan || '',
      updatedAt: new Date().toISOString()
    };
    if (status === 'approved') {
      updateData.approvedAt = new Date().toISOString();
      updateData.approvedBy = req.dosen.id;
    } else {
      updateData.approvedAt = null;
    }

    await docRef.update(updateData);
    req.session.success = status === 'approved' ? 'Laporan berhasil di-ACC.' : 'Laporan ditolak, menunggu revisi mahasiswa.';
    res.redirect(`/dosen/magang/${userId}`);
  } catch (error) {
    console.error('Error update status laporan:', error);
    res.status(500).send('Gagal memperbarui status laporan: ' + error.message);
  }
});

// ============================================================================
// SIMPAN NILAI LAPORAN - RUTE LAMA. Penilaian sekarang satu form tunggal
// (Form Penilaian Dosen Pembimbing, 18 indikator) di halaman detail magang
// mahasiswa: POST /dosen/magang/:userId/nilai-dosen
// ============================================================================
router.post('/mahasiswa/:userId/nilai', (req, res) => {
  req.session.error = 'Nilai Laporan sudah digabung ke Form Penilaian Dosen Pembimbing (format baru). Isi di halaman Logbook/Magang mahasiswa.';
  res.redirect(`/dosen/magang/${req.params.userId}`);
});

module.exports = router;
