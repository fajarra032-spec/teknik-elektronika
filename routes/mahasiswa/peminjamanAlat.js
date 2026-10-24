/**
 * routes/mahasiswa/peminjamanAlat.js
 * Mahasiswa mengajukan peminjaman alat lab, lalu mengajukan pengembalian.
 * Persetujuan & verifikasi dilakukan admin (routes/admin/peminjamanAlat.js).
 * Dipasang di /mahasiswa/peminjaman-alat (lihat routes/mahasiswa/index.js).
 */
const express = require('express');
const router = express.Router();
const { verifyToken, isMahasiswa } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const H = require('../../helpers/peminjamanAlatHelper');
const { STATUS } = H;

router.use(verifyToken);
router.use(isMahasiswa);

const pinjamCol = () => db.collection(H.KOLEKSI_PINJAM);
const alatCol = () => db.collection(H.KOLEKSI_ALAT);
const BASE = '/mahasiswa/peminjaman-alat';

/** Ambil dokumen peminjaman milik mahasiswa yang sedang login (null jika bukan miliknya). */
async function ambilMilikSaya(req) {
  const doc = await pinjamCol().doc(req.params.id).get();
  if (!doc.exists) return null;
  const p = { id: doc.id, ...doc.data() };
  return p.userId === req.user.id ? p : null;
}

// ============================================================================
// RIWAYAT PEMINJAMAN SAYA
// ============================================================================
router.get('/', async (req, res) => {
  try {
    // Hanya where(userId); urut di memori -> tidak butuh composite index
    const snap = await pinjamCol().where('userId', '==', req.user.id).get();
    const data = snap.docs.map(d => {
      const p = { id: d.id, ...d.data() };
      p.terlambat = H.isTerlambat(p);
      return p;
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const stat = {
      total: data.length,
      menunggu: data.filter(p => p.status === STATUS.DIAJUKAN).length,
      dipinjam: data.filter(p => p.status === STATUS.DIPINJAM || p.status === STATUS.MENUNGGU_KEMBALI).length,
      terlambat: data.filter(p => p.terlambat).length
    };
    res.render('mahasiswa/peminjaman/index', {
      title: 'Peminjaman Alat Lab', user: req.user, data, stat,
      statusLabel: H.STATUS_LABEL, ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error('Gagal memuat riwayat peminjaman:', err);
    res.status(500).send('Gagal memuat riwayat peminjaman');
  }
});

// ============================================================================
// FORM PENGAJUAN (katalog alat + jumlah)
// ============================================================================
router.get('/ajukan', async (req, res) => {
  try {
    const snap = await alatCol().orderBy('nama').get();
    const alat = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.aktif !== false);
    res.render('mahasiswa/peminjaman/form', {
      title: 'Ajukan Peminjaman Alat', user: req.user, alat,
      hariIni: H.hariIni(), ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat daftar alat');
  }
});

router.post('/ajukan', async (req, res) => {
  const balik = `${BASE}/ajukan`;
  try {
    const b = req.body;
    const keperluan = (b.keperluan || '').trim();
    if (!keperluan) return H.redirectPesan(res, balik, 'err', 'Keperluan peminjaman wajib diisi.');

    if (!H.tanggalValid(b.tanggalPinjam) || !H.tanggalValid(b.tanggalRencanaKembali)) {
      return H.redirectPesan(res, balik, 'err', 'Tanggal pinjam dan rencana kembali wajib diisi.');
    }
    if (b.tanggalPinjam < H.hariIni()) return H.redirectPesan(res, balik, 'err', 'Tanggal pinjam tidak boleh sebelum hari ini.');
    if (b.tanggalRencanaKembali < b.tanggalPinjam) return H.redirectPesan(res, balik, 'err', 'Tanggal kembali tidak boleh sebelum tanggal pinjam.');

    // Kumpulkan field jumlah_<alatId> yang > 0
    const diminta = {};
    Object.keys(b).forEach(k => {
      if (!k.startsWith('jumlah_')) return;
      const n = parseInt(b[k], 10);
      if (Number.isFinite(n) && n > 0) diminta[k.slice(7)] = n;
    });
    const ids = Object.keys(diminta);
    if (!ids.length) return H.redirectPesan(res, balik, 'err', 'Pilih minimal satu alat yang ingin dipinjam.');
    if (ids.length > 30) return H.redirectPesan(res, balik, 'err', 'Maksimal 30 jenis alat per pengajuan.');

    // Validasi awal terhadap stok (pengecekan final dilakukan lagi saat admin menyetujui)
    const snaps = await db.getAll(...ids.map(id => alatCol().doc(id)));
    const items = [];
    for (const s of snaps) {
      const n = diminta[s.id];
      if (!s.exists || s.data().aktif === false) return H.redirectPesan(res, balik, 'err', 'Ada alat yang sudah tidak tersedia. Muat ulang halaman lalu pilih lagi.');
      const a = s.data();
      if (n > (a.jumlahTersedia || 0)) {
        return H.redirectPesan(res, balik, 'err', `Stok ${a.nama} tidak cukup (diminta ${n}, tersedia ${a.jumlahTersedia || 0}).`);
      }
      items.push({ alatId: s.id, kode: a.kode || '', nama: a.nama, jumlah: n });
    }

    const now = new Date().toISOString();
    const dok = {
      kode: H.generateKodePinjam(),
      userId: req.user.id,
      nim: req.user.nim || '',
      namaMahasiswa: req.user.nama || '',
      items,
      keperluan,
      kegiatan: (b.kegiatan || '').trim(),
      tanggalPinjam: b.tanggalPinjam,
      tanggalRencanaKembali: b.tanggalRencanaKembali,
      status: STATUS.DIAJUKAN,
      riwayat: [{ status: STATUS.DIAJUKAN, oleh: req.user.nama || '-', catatan: 'Pengajuan dibuat', waktu: now }],
      createdAt: now, updatedAt: now
    };
    const ref = await pinjamCol().add(dok);

    await H.notifikasiAdmin(db, {
      type: 'peminjaman_alat', title: 'Pengajuan peminjaman alat baru',
      message: `${dok.namaMahasiswa} (${dok.nim}) mengajukan ${items.length} jenis alat - ${dok.kode}`,
      link: `/admin/peminjaman-alat/${ref.id}`
    });
    H.redirectPesan(res, `${BASE}/${ref.id}`, 'ok', 'Pengajuan terkirim. Tunggu persetujuan admin.');
  } catch (err) {
    console.error('Gagal membuat pengajuan peminjaman:', err);
    res.status(500).send('Gagal mengajukan peminjaman: ' + err.message);
  }
});

// ============================================================================
// DETAIL
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const p = await ambilMilikSaya(req);
    if (!p) return res.status(404).send('Data peminjaman tidak ditemukan');
    p.terlambat = H.isTerlambat(p);
    res.render('mahasiswa/peminjaman/detail', {
      title: 'Detail Peminjaman Alat', user: req.user, p,
      statusLabel: H.STATUS_LABEL, ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail peminjaman');
  }
});

// ============================================================================
// BATALKAN (hanya selagi masih "diajukan")
// ============================================================================
router.post('/:id/batal', async (req, res) => {
  const url = `${BASE}/${req.params.id}`;
  try {
    await db.runTransaction(async (tx) => {
      const ref = pinjamCol().doc(req.params.id);
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().userId !== req.user.id) throw new H.AturanError('Data peminjaman tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DIAJUKAN) throw new H.AturanError('Hanya pengajuan yang belum diproses yang bisa dibatalkan.');
      tx.update(ref, {
        status: STATUS.DIBATALKAN,
        riwayat: H.tambahRiwayat(p, STATUS.DIBATALKAN, req.user.nama, 'Dibatalkan oleh mahasiswa'),
        updatedAt: new Date().toISOString()
      });
    });
    H.redirectPesan(res, BASE, 'ok', 'Pengajuan dibatalkan.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, url, 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal membatalkan pengajuan');
  }
});

// ============================================================================
// AJUKAN PENGEMBALIAN (mahasiswa menyerahkan alat ke lab, admin memverifikasi)
// ============================================================================
router.post('/:id/kembalikan', async (req, res) => {
  const url = `${BASE}/${req.params.id}`;
  let hasil = null;
  try {
    await db.runTransaction(async (tx) => {
      const ref = pinjamCol().doc(req.params.id);
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data().userId !== req.user.id) throw new H.AturanError('Data peminjaman tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DIPINJAM) throw new H.AturanError('Hanya alat yang sedang dipinjam yang bisa diajukan pengembaliannya.');
      const catatan = (req.body.catatan || '').trim().slice(0, 500);
      const now = new Date().toISOString();
      tx.update(ref, {
        status: STATUS.MENUNGGU_KEMBALI,
        catatanPengembalian: catatan,
        tanggalAjukanKembali: now,
        riwayat: H.tambahRiwayat(p, STATUS.MENUNGGU_KEMBALI, req.user.nama, catatan || 'Mahasiswa mengajukan pengembalian'),
        updatedAt: now
      });
      hasil = p;
    });
    await H.notifikasiAdmin(db, {
      type: 'peminjaman_alat', title: 'Pengajuan pengembalian alat',
      message: `${hasil.namaMahasiswa} (${hasil.nim}) mengembalikan alat - ${hasil.kode}. Mohon diverifikasi.`,
      link: `/admin/peminjaman-alat/${req.params.id}`
    });
    H.redirectPesan(res, url, 'ok', 'Pengajuan pengembalian terkirim. Serahkan alat ke admin lab untuk diverifikasi.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, url, 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal mengajukan pengembalian');
  }
});

module.exports = router;
