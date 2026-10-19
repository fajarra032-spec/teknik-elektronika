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
    const { status } = req.query;
    let query = db.collection('permohonanMagang').orderBy('createdAt', 'desc');
    if (status) query = query.where('status', '==', status);
    const snapshot = await query.get();

    const seminarList = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const mahasiswa = await getMahasiswa(data.userId);
      seminarList.push({
        id: doc.id,
        ...data,
        mahasiswa
      });
    }

    res.render('admin/seminar_list', {
      title: 'Manajemen Seminar Magang',
      seminarList,
      filterStatus: status || ''
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
      mahasiswa
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
    if (!tanggal || !waktu || !tempat) {
      return res.status(400).send('Tanggal, waktu, dan tempat wajib diisi');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return res.status(400).send('Format tanggal tidak valid');
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
      return res.status(400).send('Pengajuan ini sudah dibatalkan oleh mahasiswa');
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

    res.redirect(`/admin/seminar/${req.params.id}`);
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
      return res.status(400).send('Alasan penolakan wajib diisi');
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

    res.redirect(`/admin/seminar/${req.params.id}`);
  } catch (error) {
    console.error('Error reject seminar:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal menolak seminar'
    });
  }
});

module.exports = router;