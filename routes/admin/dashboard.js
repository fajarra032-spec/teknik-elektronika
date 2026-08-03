// routes/admin/dashboard.js
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');

router.use(verifyToken);
router.use(isAdmin);

/**
 * Hitung jumlah dokumen yang cocok dengan sebuah query TANPA membaca isi
 * dokumennya (pakai Firestore count() aggregation - jauh lebih hemat kuota
 * daripada .get() biasa, apalagi untuk koleksi besar seperti `users`).
 * Ada fallback ke .get().size kalau versi firebase-admin di server ternyata
 * belum mendukung count() (SDK lama), supaya dashboard tetap jalan normal -
 * cuma tidak sehemat itu sampai firebase-admin di-update.
 */
async function hitungJumlah(query) {
  try {
    const snap = await query.count().get();
    return snap.data().count;
  } catch (err) {
    console.error('count() tidak tersedia, fallback ke get().size (pertimbangkan update firebase-admin):', err.message);
    const snap = await query.get();
    return snap.size;
  }
}

router.get('/', async (req, res) => {
  try {
    // ✅ OPTIMISASI KUOTA: semua yang di bawah ini cuma butuh JUMLAH dokumen,
    // bukan isinya - jadi pakai hitungJumlah() (Firestore count() aggregation)
    // alih-alih .get() biasa. .get() biasa MEMBACA SETIAP dokumen yang cocok
    // (kena biaya 1 read per dokumen), padahal kita cuma perlu angkanya saja.
    // count() jauh lebih murah karena tidak mengunduh isi dokumennya sama
    // sekali - penghematan sangat besar kalau koleksinya (mis. `users`) berisi
    // ratusan/ribuan dokumen. Dijalankan paralel (Promise.all) sekalian
    // supaya dashboard tetap cepat.
    const [
      mahasiswaCount,
      dosenCount,
      mkCount,
      krsPending,
      logbookPending,
      laporanPending,
      suratMahasiswaPending,
      suratDosenPending,
      eventsSnapshot
    ] = await Promise.all([
      hitungJumlah(db.collection('users').where('role', '==', 'mahasiswa')),
      hitungJumlah(db.collection('dosen')),
      hitungJumlah(db.collection('mataKuliah')),
      hitungJumlah(db.collection('krs').where('status', '==', 'pending')),
      hitungJumlah(db.collection('logbookMagang').where('status', '==', 'pending')),
      hitungJumlah(db.collection('laporanMagang').where('status', '==', 'submitted')),
      hitungJumlah(db.collection('surat').where('status', '==', 'pending')),
      hitungJumlah(db.collection('surat_dosen').where('status', '==', 'pending')),
      db.collection('jadwalPenting')
        .where('tanggal', '>=', new Date().toISOString().split('T')[0])
        .orderBy('tanggal', 'asc')
        .limit(5)
        .get() // ini tetap .get() biasa karena kita memang butuh ISI 5 event-nya utk ditampilkan
    ]);

    const suratPending = suratMahasiswaPending + suratDosenPending;
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const stats = {
      mahasiswaCount,
      dosenCount,
      mkCount,
      krsPending,
      logbookPending,
      laporanPending,
      suratPending,
      // Opsional: kirim juga detail per role jika diperlukan di view
      suratMahasiswaPending,
      suratDosenPending
    };

    res.render('admin/dashboard', {
      title: 'Dashboard Admin',
      user: req.user,
      stats,
      events
    });

  } catch (error) {
    console.error('Error loading admin dashboard:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat dashboard admin'
    });
  }
});

module.exports = router;