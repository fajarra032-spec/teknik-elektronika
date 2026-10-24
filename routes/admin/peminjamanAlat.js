/**
 * routes/admin/peminjamanAlat.js
 * Admin memverifikasi pengajuan peminjaman & pengembalian alat lab.
 * Dipasang di /admin/peminjaman-alat (lihat routes/admin/index.js).
 *
 * Semua perubahan status + stok dilakukan di dalam transaksi Firestore supaya
 * (a) dua admin tidak bisa menyetujui pengajuan yang sama dua kali, dan
 * (b) stok tidak pernah negatif / ganda.
 */
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const H = require('../../helpers/peminjamanAlatHelper');
const { STATUS } = H;

router.use(verifyToken);
router.use(isAdmin);

const pinjamCol = () => db.collection(H.KOLEKSI_PINJAM);
const alatCol = () => db.collection(H.KOLEKSI_ALAT);
const toInt = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : 0; };
const urlDetail = (id) => `/admin/peminjaman-alat/${id}`;

// ============================================================================
// DAFTAR (filter lewat ?status=perlu|diajukan|dipinjam|terlambat|dikembalikan|semua)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    // Filter dilakukan di memori (bukan where+orderBy) supaya tidak butuh
    // composite index baru di Firestore.
    const snap = await pinjamCol().orderBy('createdAt', 'desc').limit(500).get();
    const semua = snap.docs.map(d => {
      const p = { id: d.id, ...d.data() };
      p.terlambat = H.isTerlambat(p);
      return p;
    });

    const hitung = {
      perlu: semua.filter(p => p.status === STATUS.DIAJUKAN || p.status === STATUS.MENUNGGU_KEMBALI).length,
      diajukan: semua.filter(p => p.status === STATUS.DIAJUKAN).length,
      dipinjam: semua.filter(p => p.status === STATUS.DIPINJAM || p.status === STATUS.MENUNGGU_KEMBALI).length,
      terlambat: semua.filter(p => p.terlambat).length,
      dikembalikan: semua.filter(p => p.status === STATUS.DIKEMBALIKAN).length,
      semua: semua.length
    };

    const filter = ['perlu', 'diajukan', 'dipinjam', 'terlambat', 'dikembalikan', 'semua'].includes(req.query.status)
      ? req.query.status : 'perlu';
    let data = semua;
    if (filter === 'perlu') data = semua.filter(p => p.status === STATUS.DIAJUKAN || p.status === STATUS.MENUNGGU_KEMBALI);
    else if (filter === 'diajukan') data = semua.filter(p => p.status === STATUS.DIAJUKAN);
    else if (filter === 'dipinjam') data = semua.filter(p => p.status === STATUS.DIPINJAM || p.status === STATUS.MENUNGGU_KEMBALI);
    else if (filter === 'terlambat') data = semua.filter(p => p.terlambat);
    else if (filter === 'dikembalikan') data = semua.filter(p => p.status === STATUS.DIKEMBALIKAN);

    res.render('admin/peminjaman/index', {
      title: 'Peminjaman Alat Lab', user: req.user, data, hitung, filter,
      statusLabel: H.STATUS_LABEL, ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error('Gagal memuat peminjaman alat:', err);
    res.status(500).send('Gagal memuat data peminjaman alat');
  }
});

// ============================================================================
// DETAIL
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const doc = await pinjamCol().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Data peminjaman tidak ditemukan');
    const p = { id: doc.id, ...doc.data() };
    p.terlambat = H.isTerlambat(p);

    // Untuk pengajuan baru: tampilkan stok tersedia saat ini per alat
    // (null = alat sudah dihapus / nonaktif).
    let stok = {};
    if (p.status === STATUS.DIAJUKAN && p.items.length) {
      const snaps = await db.getAll(...p.items.map(it => alatCol().doc(it.alatId)));
      snaps.forEach(s => { stok[s.id] = (s.exists && s.data().aktif !== false) ? (s.data().jumlahTersedia || 0) : null; });
    }

    res.render('admin/peminjaman/detail', {
      title: 'Detail Peminjaman Alat', user: req.user, p, stok,
      statusLabel: H.STATUS_LABEL, hariIni: H.hariIni(), ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail peminjaman');
  }
});

// ============================================================================
// SETUJUI PENGAJUAN -> stok tersedia berkurang, status "dipinjam"
// ============================================================================
router.post('/:id/setujui', async (req, res) => {
  const id = req.params.id;
  let hasil = null;
  try {
    await db.runTransaction(async (tx) => {
      const ref = pinjamCol().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Data peminjaman tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DIAJUKAN) throw new H.AturanError('Pengajuan ini sudah diproses sebelumnya.');

      // Semua BACA dulu (aturan transaksi Firestore), baru TULIS
      const alatSnaps = await Promise.all(p.items.map(it => tx.get(alatCol().doc(it.alatId))));
      const kurang = [];
      alatSnaps.forEach((s, i) => {
        const it = p.items[i];
        if (!s.exists || s.data().aktif === false) kurang.push(`${it.nama} (alat tidak tersedia lagi)`);
        else if ((s.data().jumlahTersedia || 0) < it.jumlah) kurang.push(`${it.nama} (diminta ${it.jumlah}, tersedia ${s.data().jumlahTersedia || 0})`);
      });
      if (kurang.length) throw new H.AturanError('Stok tidak mencukupi: ' + kurang.join('; '));

      const now = new Date().toISOString();
      alatSnaps.forEach((s, i) => {
        tx.update(s.ref, { jumlahTersedia: (s.data().jumlahTersedia || 0) - p.items[i].jumlah, updatedAt: now });
      });
      const catatan = (req.body.catatan || '').trim();
      tx.update(ref, {
        status: STATUS.DIPINJAM,
        disetujuiOleh: req.user.nama || req.user.email || 'Admin',
        disetujuiAt: now,
        catatanAdmin: catatan,
        riwayat: H.tambahRiwayat(p, STATUS.DIPINJAM, req.user.nama, catatan || 'Pengajuan disetujui, alat diserahkan'),
        updatedAt: now
      });
      hasil = p;
    });

    await H.notifikasiUser(db, hasil.userId, {
      type: 'peminjaman_alat', title: 'Peminjaman alat disetujui',
      message: `Pengajuan ${hasil.kode} disetujui. Ambil alat di lab dan kembalikan paling lambat ${hasil.tanggalRencanaKembali}.`,
      link: `/mahasiswa/peminjaman-alat/${id}`
    });
    H.redirectPesan(res, urlDetail(id), 'ok', 'Pengajuan disetujui. Stok alat otomatis dikurangi.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error('Gagal menyetujui peminjaman:', err);
    res.status(500).send('Gagal menyetujui pengajuan: ' + err.message);
  }
});

// ============================================================================
// TOLAK PENGAJUAN
// ============================================================================
router.post('/:id/tolak', async (req, res) => {
  const id = req.params.id;
  const alasan = (req.body.alasan || '').trim();
  if (!alasan) return H.redirectPesan(res, urlDetail(id), 'err', 'Alasan penolakan wajib diisi.');
  let hasil = null;
  try {
    await db.runTransaction(async (tx) => {
      const ref = pinjamCol().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Data peminjaman tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DIAJUKAN) throw new H.AturanError('Pengajuan ini sudah diproses sebelumnya.');
      const now = new Date().toISOString();
      tx.update(ref, {
        status: STATUS.DITOLAK, alasanPenolakan: alasan,
        riwayat: H.tambahRiwayat(p, STATUS.DITOLAK, req.user.nama, alasan),
        updatedAt: now
      });
      hasil = p;
    });
    await H.notifikasiUser(db, hasil.userId, {
      type: 'peminjaman_alat', title: 'Peminjaman alat ditolak',
      message: `Pengajuan ${hasil.kode} ditolak: ${alasan}`,
      link: `/mahasiswa/peminjaman-alat/${id}`
    });
    H.redirectPesan(res, urlDetail(id), 'ok', 'Pengajuan ditolak.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal menolak pengajuan');
  }
});

// ============================================================================
// VERIFIKASI PENGEMBALIAN
// Admin memeriksa fisik alat lalu mengisi per item: berapa unit baik / rusak / hilang.
//   baik   -> kembali ke stok tersedia
//   rusak  -> masuk jumlahRusak (tidak tersedia sampai ditandai selesai diperbaiki)
//   hilang -> jumlahTotal berkurang
// ============================================================================
router.post('/:id/verifikasi-kembali', async (req, res) => {
  const id = req.params.id;
  let hasil = null;
  try {
    await db.runTransaction(async (tx) => {
      const ref = pinjamCol().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Data peminjaman tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DIPINJAM && p.status !== STATUS.MENUNGGU_KEMBALI) {
        throw new H.AturanError('Peminjaman ini tidak sedang menunggu pengembalian.');
      }

      // Validasi input per item: baik + rusak + hilang harus sama dengan jumlah dipinjam
      const itemsHasil = p.items.map((it, i) => {
        const hasBaikKosong = req.body[`baik_${i}`] === undefined && req.body[`rusak_${i}`] === undefined && req.body[`hilang_${i}`] === undefined;
        const baik = hasBaikKosong ? it.jumlah : toInt(req.body[`baik_${i}`]);
        const rusak = toInt(req.body[`rusak_${i}`]);
        const hilang = toInt(req.body[`hilang_${i}`]);
        if (baik + rusak + hilang !== it.jumlah) {
          throw new H.AturanError(`${it.nama}: baik + rusak + hilang harus berjumlah ${it.jumlah} (sekarang ${baik + rusak + hilang}).`);
        }
        return { ...it, jumlahBaik: baik, jumlahRusak: rusak, jumlahHilang: hilang };
      });

      const alatSnaps = await Promise.all(itemsHasil.map(it => tx.get(alatCol().doc(it.alatId))));
      const now = new Date().toISOString();
      alatSnaps.forEach((s, i) => {
        const it = itemsHasil[i];
        if (!s.exists) return; // alat sudah dihapus dari inventaris; riwayat tetap tercatat di peminjaman
        const a = s.data();
        tx.update(s.ref, {
          jumlahTersedia: (a.jumlahTersedia || 0) + it.jumlahBaik,
          jumlahRusak: (a.jumlahRusak || 0) + it.jumlahRusak,
          jumlahTotal: Math.max(0, (a.jumlahTotal || 0) - it.jumlahHilang),
          updatedAt: now
        });
      });

      const tglKembali = H.hariIni();
      const hariTerlambat = Math.max(0, H.selisihHari(p.tanggalRencanaKembali, tglKembali));
      const catatan = (req.body.catatan || '').trim();
      const adaMasalah = itemsHasil.some(it => it.jumlahRusak > 0 || it.jumlahHilang > 0);
      tx.update(ref, {
        status: STATUS.DIKEMBALIKAN,
        items: itemsHasil,
        tanggalKembali: tglKembali,
        hariTerlambat,
        adaMasalah,
        diverifikasiOleh: req.user.nama || req.user.email || 'Admin',
        diverifikasiAt: now,
        catatanVerifikasi: catatan,
        riwayat: H.tambahRiwayat(p, STATUS.DIKEMBALIKAN, req.user.nama, catatan || 'Pengembalian diverifikasi'),
        updatedAt: now
      });
      hasil = { ...p, adaMasalah, hariTerlambat };
    });

    await H.notifikasiUser(db, hasil.userId, {
      type: 'peminjaman_alat', title: 'Pengembalian alat terverifikasi',
      message: hasil.adaMasalah
        ? `Pengembalian ${hasil.kode} terverifikasi, ada catatan kondisi alat. Lihat detailnya.`
        : `Pengembalian ${hasil.kode} terverifikasi. Terima kasih!`,
      link: `/mahasiswa/peminjaman-alat/${id}`
    });
    H.redirectPesan(res, urlDetail(id), 'ok', 'Pengembalian diverifikasi dan stok alat sudah diperbarui.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error('Gagal verifikasi pengembalian:', err);
    res.status(500).send('Gagal memverifikasi pengembalian: ' + err.message);
  }
});

// ============================================================================
// TOLAK PENGAJUAN PENGEMBALIAN (mis. alat belum sampai ke lab) -> kembali "dipinjam"
// ============================================================================
router.post('/:id/tolak-kembali', async (req, res) => {
  const id = req.params.id;
  const alasan = (req.body.alasan || '').trim();
  if (!alasan) return H.redirectPesan(res, urlDetail(id), 'err', 'Alasan wajib diisi.');
  let hasil = null;
  try {
    await db.runTransaction(async (tx) => {
      const ref = pinjamCol().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Data peminjaman tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.MENUNGGU_KEMBALI) throw new H.AturanError('Tidak ada pengajuan pengembalian yang menunggu verifikasi.');
      tx.update(ref, {
        status: STATUS.DIPINJAM, catatanAdmin: alasan,
        riwayat: H.tambahRiwayat(p, STATUS.DIPINJAM, req.user.nama, 'Pengembalian ditolak: ' + alasan),
        updatedAt: new Date().toISOString()
      });
      hasil = p;
    });
    await H.notifikasiUser(db, hasil.userId, {
      type: 'peminjaman_alat', title: 'Pengembalian alat belum diterima',
      message: `Pengajuan pengembalian ${hasil.kode} belum bisa diverifikasi: ${alasan}`,
      link: `/mahasiswa/peminjaman-alat/${id}`
    });
    H.redirectPesan(res, urlDetail(id), 'ok', 'Pengajuan pengembalian dikembalikan ke status "Sedang Dipinjam".');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal memproses');
  }
});

module.exports = router;
