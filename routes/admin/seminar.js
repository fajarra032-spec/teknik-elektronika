/**
 * routes/admin/seminar.js
 * Manajemen seminar magang oleh admin
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { createNotification } = require('../../helpers/notificationHelper');
const { pecahTanggal, tanggalPanjang } = require('../../helpers/penyelesaianStudiHelper');
const { redirectPesan, pesanDariQuery, hariIni } = require('../../helpers/peminjamanAlatHelper');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

async function getMahasiswa(userId) {
  const doc = await db.collection('users').doc(userId).get();
  return doc.exists ? doc.data() : { nama: '-', nim: '-' };
}

/**
 * Sinkronkan jadwal seminar ke koleksi `jadwalPenting` (agenda sistem: dashboard,
 * kalender akademik, dan beranda publik untuk kategori 'seminar'). Kalau seminar
 * ini sudah punya agenda (jadwal diubah), agenda yang sama diperbarui - bukan
 * dibuat ganda. Judul memakai nama saja (tanpa NIM) karena kategori 'seminar'
 * juga tampil di beranda publik.
 * @returns {Promise<string>} ID dokumen jadwalPenting
 */
async function sinkronJadwalPenting(seminarId, data, jadwal) {
  const now = new Date().toISOString();
  const isi = {
    judul: `Seminar Magang - ${data.nama}`,
    deskripsi: ['Presentasi hasil kegiatan magang.',
      data.pembimbing ? `Pembimbing: ${data.pembimbing}.` : '',
      jadwal.penguji ? `Penguji: ${jadwal.penguji}.` : ''].filter(Boolean).join(' '),
    tanggal: jadwal.tanggal,
    waktu: jadwal.waktu,
    tempat: jadwal.tempat,
    kategori: 'seminar',
    permohonanMagangId: seminarId,
    updatedAt: now
  };
  if (data.jadwalPentingId) {
    const ref = db.collection('jadwalPenting').doc(data.jadwalPentingId);
    if ((await ref.get()).exists) {
      await ref.update(isi);
      return data.jadwalPentingId;
    }
  }
  const baru = await db.collection('jadwalPenting').add({ ...isi, createdAt: now });
  return baru.id;
}

async function kabari(userId, data) {
  try { await createNotification(db, userId, data); } catch (e) { console.error('Gagal kirim notifikasi seminar:', e.message); }
}

// ============================================================================
// DAFTAR SEMINAR
// ============================================================================

router.get('/', async (req, res) => {
  try {
    // Ambil semua permohonan sekali lalu saring di memori: tab status bisa
    // menampilkan jumlah, dan tidak perlu composite index (where + orderBy).
    const snapshot = await db.collection('permohonanMagang').orderBy('createdAt', 'desc').get();

    // Data mahasiswa diambil sekaligus (bukan satu per satu per baris)
    const idMhs = [...new Set(snapshot.docs.map(d => d.data().userId).filter(Boolean))];
    const profil = {};
    if (idMhs.length) {
      const docs = await db.getAll(...idMhs.map(id => db.collection('users').doc(id)));
      docs.forEach(d => { if (d.exists) profil[d.id] = d.data(); });
    }

    const semua = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, mahasiswa: profil[data.userId] || { nama: '-', nim: '-' } };
    });

    const hari = hariIni();
    const batas = new Date(Date.now() + 7 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    const hitung = {
      pending: semua.filter(x => x.status === 'pending').length,
      approved: semua.filter(x => x.status === 'approved').length,
      rejected: semua.filter(x => x.status === 'rejected').length,
      dibatalkan: semua.filter(x => x.status === 'dibatalkan').length,
      semua: semua.length,
      pekanIni: semua.filter(x => x.status === 'approved' && x.jadwal && x.jadwal.tanggal >= hari && x.jadwal.tanggal <= batas).length
    };

    // Tanpa ?status= : fokus ke yang perlu tindakan (pending) bila ada, selain itu semua
    const valid = ['pending', 'approved', 'rejected', 'dibatalkan', 'semua'];
    let filter = valid.includes(req.query.status) ? req.query.status : (hitung.pending > 0 ? 'pending' : 'semua');
    let seminarList = filter === 'semua' ? semua : semua.filter(x => x.status === filter);
    if (filter === 'approved') {
      // Yang dijadwalkan: urut dari seminar terdekat
      seminarList = seminarList.slice().sort((x, y) => String((x.jadwal || {}).tanggal || '9999').localeCompare(String((y.jadwal || {}).tanggal || '9999')));
    }

    res.render('admin/seminar_list', {
      title: 'Manajemen Seminar Magang',
      seminarList, hitung, filterStatus: filter, hariIni: hari,
      ...pesanDariQuery(req)
    });
  } catch (error) {
    console.error('Error ambil seminar:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat data seminar'
    });
  }
});

// ============================================================================
// DETAIL SEMINAR
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('permohonanMagang').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Seminar tidak ditemukan'
      });
    }
    const seminar = { id: doc.id, ...doc.data() };
    const mahasiswa = await getMahasiswa(seminar.userId);
    res.render('admin/seminar_detail', {
      title: 'Detail Seminar',
      seminar,
      mahasiswa,
      ...pesanDariQuery(req)
    });
  } catch (error) {
    console.error('Error detail seminar:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat detail'
    });
  }
});

// ============================================================================
// SETUJUI SEMINAR (dengan jadwal)
// ============================================================================

router.post('/:id/approve', async (req, res) => {
  try {
    const { tanggal, waktu, tempat, penguji, catatan } = req.body;
    const balik = `/admin/seminar/${req.params.id}`;
    if (!tanggal || !waktu || !tempat) {
      return redirectPesan(res, balik, 'err', 'Tanggal, waktu, dan tempat wajib diisi.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return redirectPesan(res, balik, 'err', 'Format tanggal tidak valid.');
    }

    const seminarRef = db.collection('permohonanMagang').doc(req.params.id);
    const doc = await seminarRef.get();
    if (!doc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Seminar tidak ditemukan'
      });
    }
    const data = doc.data();
    if (data.status === 'dibatalkan') {
      return redirectPesan(res, balik, 'err', 'Pengajuan ini sudah dibatalkan oleh mahasiswa.');
    }
    const ubahJadwal = data.status === 'approved';

    const jadwal = {
      tanggal,
      waktu: waktu.trim(),
      tempat: tempat.trim(),
      penguji: (penguji || '').trim(),
      catatan: (catatan || '').trim()
    };

    // Agenda otomatis di Jadwal Penting (dibuat saat pertama disetujui, diperbarui saat jadwal diubah)
    const jadwalPentingId = await sinkronJadwalPenting(req.params.id, data, jadwal);

    await seminarRef.update({
      status: 'approved',
      jadwal,
      jadwalPentingId,
      alasanPenolakan: null,
      updatedAt: new Date().toISOString(),
      history: [
        ...(data.history || []),
        { status: 'approved', timestamp: new Date().toISOString(),
          catatan: ubahJadwal ? 'Jadwal seminar diubah oleh admin' : 'Disetujui oleh admin dengan jadwal' }
      ]
    });

    const p = pecahTanggal(tanggal);
    await kabari(data.userId, {
      type: 'seminar',
      title: ubahJadwal ? 'Jadwal seminar magang diubah' : 'Jadwal seminar magang ditetapkan',
      message: `${p.hari}, ${tanggalPanjang(tanggal)} pukul ${jadwal.waktu} di ${jadwal.tempat}. Berkas ujian kini bisa diunduh.`,
      link: '/mahasiswa/penyelesaian-studi'
    });

    redirectPesan(res, balik, 'ok', ubahJadwal ? 'Jadwal seminar diperbarui dan mahasiswa sudah diberi tahu.' : 'Seminar disetujui, jadwal masuk ke Jadwal Penting, dan mahasiswa sudah diberi tahu.');
  } catch (error) {
    console.error('Error approve seminar:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal menyetujui seminar'
    });
  }
});

// ============================================================================
// TOLAK SEMINAR
// ============================================================================

router.post('/:id/reject', async (req, res) => {
  try {
    const { alasan } = req.body;
    if (!alasan) {
      return redirectPesan(res, `/admin/seminar/${req.params.id}`, 'err', 'Alasan penolakan wajib diisi.');
    }

    const seminarRef = db.collection('permohonanMagang').doc(req.params.id);
    const doc = await seminarRef.get();
    if (!doc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'Seminar tidak ditemukan'
      });
    }
    const data = doc.data();

    // Kalau sebelumnya sudah disetujui (punya agenda), agendanya ikut dicabut
    if (data.jadwalPentingId) {
      try { await db.collection('jadwalPenting').doc(data.jadwalPentingId).delete(); }
      catch (e) { console.error('Gagal hapus jadwalPenting seminar:', e.message); }
    }

    await seminarRef.update({
      status: 'rejected',
      jadwal: null,
      jadwalPentingId: null,
      alasanPenolakan: alasan,
      updatedAt: new Date().toISOString(),
      history: [
        ...(data.history || []),
        { status: 'rejected', timestamp: new Date().toISOString(), catatan: `Ditolak: ${alasan}` }
      ]
    });

    await kabari(data.userId, {
      type: 'seminar',
      title: 'Pengajuan seminar magang ditolak',
      message: `Alasan: ${alasan}. Perbaiki lalu ajukan kembali.`,
      link: '/mahasiswa/penyelesaian-studi'
    });

    redirectPesan(res, `/admin/seminar/${req.params.id}`, 'ok', 'Seminar ditolak dan mahasiswa sudah diberi tahu.');
  } catch (error) {
    console.error('Error reject seminar:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal menolak seminar'
    });
  }
});

module.exports = router;