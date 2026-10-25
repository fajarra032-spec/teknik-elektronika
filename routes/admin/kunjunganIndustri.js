/**
 * routes/admin/kunjunganIndustri.js
 * Admin memverifikasi pengajuan kunjungan industri dari publik. Begitu admin
 * mengisi nomor permohonan, surat terbit otomatis (halaman cetak + PDF) dan
 * tampil di bagian "Pengajuan yang Disetujui" pada /dokumen/kunjungan-industri.
 * Dipasang di /admin/kunjungan-industri (lihat routes/admin/index.js).
 */
const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getAllMataKuliah } = require('../../helpers/cache');
const KI = require('../../helpers/kunjunganIndustriHelper');
const H = require('../../helpers/peminjamanAlatHelper'); // AturanError, redirectPesan, pesanDariQuery, tambahRiwayat
const { STATUS } = KI;

router.use(verifyToken);
router.use(isAdmin);

// Setiap perubahan membuang cache daftar publik "Pengajuan yang Disetujui"
router.use((req, res, next) => {
  if (req.method === 'POST') res.on('finish', KI.invalidateDisetujui);
  next();
});

const col = () => db.collection(KI.KOLEKSI);
const urlDetail = (id) => `/admin/kunjungan-industri/${id}`;
const namaAdmin = (req) => req.user.nama || req.user.email || 'Admin';
const pdfDeps = (req) => req.app.get('kiPdfDeps') || {};

async function mkMap() {
  const semua = await getAllMataKuliah(db);
  return new Map(semua.map(m => [m.id, { id: m.id, kode: m.kode || '', nama: m.nama || '', semester: m.semester || 0, sks: m.sks || '' }]));
}

/** Buat PDF + simpan di Drive + catat di dokumen. Mengembalikan true bila sukses. */
async function terbitkanPdf(req, id) {
  const snap = await col().doc(id).get();
  const p = { id, ...snap.data() };
  const lama = p.pdfFileId;
  try {
    const hasil = await KI.buatDanSimpanPdf(req.app, p, pdfDeps(req));
    await col().doc(id).update({ pdfUrl: hasil.pdfUrl, pdfFileId: hasil.pdfFileId, updatedAt: new Date().toISOString() });
    if (lama && lama !== hasil.pdfFileId) await KI.hapusFileDrive(lama);
    return true;
  } catch (err) {
    console.error('Gagal membuat PDF surat kunjungan industri:', err);
    return false;
  }
}

// ============================================================================
// DAFTAR
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const snap = await col().orderBy('createdAt', 'desc').limit(500).get();
    const semua = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const hitung = {
      diajukan: semua.filter(p => p.status === STATUS.DIAJUKAN).length,
      disetujui: semua.filter(p => p.status === STATUS.DISETUJUI).length,
      ditolak: semua.filter(p => p.status === STATUS.DITOLAK).length,
      semua: semua.length
    };
    const filter = ['diajukan', 'disetujui', 'ditolak', 'semua'].includes(req.query.status) ? req.query.status : 'diajukan';
    const data = filter === 'semua' ? semua : semua.filter(p => p.status === filter);
    res.render('admin/kunjungan/index', {
      title: 'Kunjungan Industri', user: req.user, data, hitung, filter,
      statusLabel: KI.STATUS_LABEL, tanggalPanjang: KI.tanggalPanjang, ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error('Gagal memuat kunjungan industri:', err);
    res.status(500).send('Gagal memuat data kunjungan industri');
  }
});

// ============================================================================
// DETAIL
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const doc = await col().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Pengajuan tidak ditemukan');
    const p = { id: doc.id, ...doc.data() };
    const mkList = [...(await mkMap()).values()].sort((a, b) => (a.semester - b.semester) || a.nama.localeCompare(b.nama));
    res.render('admin/kunjungan/detail', {
      title: 'Detail Kunjungan Industri', user: req.user, p, mkList,
      terpilih: new Set((p.mataKuliah || []).map(m => m.id)),
      statusLabel: KI.STATUS_LABEL, tanggalPanjang: KI.tanggalPanjang, rentangHari: KI.rentangHari, rentangWaktu: KI.rentangWaktu,
      hariIni: KI.hariIni(), ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat detail pengajuan');
  }
});

// ============================================================================
// EDIT DATA (admin boleh merapikan isian sebelum/sesudah surat terbit)
// ============================================================================
router.post('/:id/update', async (req, res) => {
  const id = req.params.id;
  try {
    const hasil = KI.validasiPengajuan(req.body, await mkMap(), { izinkanLampau: true });
    if (hasil.error) return H.redirectPesan(res, urlDetail(id), 'err', hasil.error);
    let terbit = false;
    await db.runTransaction(async (tx) => {
      const ref = col().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Pengajuan tidak ditemukan.');
      const p = snap.data();
      terbit = p.status === STATUS.DISETUJUI;
      tx.update(ref, {
        ...hasil.data,
        riwayat: H.tambahRiwayat(p, p.status, namaAdmin(req), 'Data diperbarui admin'),
        updatedAt: new Date().toISOString()
      });
    });
    // Surat sudah terbit -> PDF dibuat ulang agar isinya sama dengan data terbaru
    let pesan = 'Data pengajuan diperbarui.';
    if (terbit) pesan += (await terbitkanPdf(req, id)) ? ' PDF surat dibuat ulang.' : ' Namun PDF gagal dibuat ulang; coba tombol "Buat Ulang PDF".';
    H.redirectPesan(res, urlDetail(id), 'ok', pesan);
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal memperbarui data');
  }
});

// ============================================================================
// SETUJUI: admin mengisi nomor permohonan -> surat terbit otomatis
// ============================================================================
router.post('/:id/setujui', async (req, res) => {
  const id = req.params.id;
  try {
    const nomor = String(req.body.nomorSurat || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!nomor) return H.redirectPesan(res, urlDetail(id), 'err', 'Nomor permohonan kunjungan industri wajib diisi.');
    const tglSurat = KI.tanggalValid(req.body.tanggalSurat) ? req.body.tanggalSurat : KI.hariIni();

    const dup = await col().where('nomorSurat', '==', nomor).get();
    if (dup.docs.some(d => d.id !== id)) return H.redirectPesan(res, urlDetail(id), 'err', `Nomor "${nomor}" sudah dipakai pada surat lain.`);

    await db.runTransaction(async (tx) => {
      const ref = col().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Pengajuan tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DIAJUKAN) throw new H.AturanError('Pengajuan ini sudah diproses sebelumnya.');
      const now = new Date().toISOString();
      tx.update(ref, {
        status: STATUS.DISETUJUI, nomorSurat: nomor, tanggalSurat: tglSurat,
        kodeValidasi: KI.generateKodeValidasi(),
        disetujuiOleh: namaAdmin(req), disetujuiAt: now,
        riwayat: H.tambahRiwayat(p, STATUS.DISETUJUI, namaAdmin(req), `Disetujui, nomor surat ${nomor}`),
        updatedAt: now
      });
    });

    const pdfOk = await terbitkanPdf(req, id);
    H.redirectPesan(res, urlDetail(id), pdfOk ? 'ok' : 'err', pdfOk
      ? 'Pengajuan disetujui. Surat sudah terbit dan tampil di halaman publik.'
      : 'Pengajuan disetujui dan surat sudah bisa dicetak, tetapi PDF gagal dibuat. Gunakan tombol "Buat Ulang PDF".');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error('Gagal menyetujui kunjungan industri:', err);
    res.status(500).send('Gagal menyetujui pengajuan: ' + err.message);
  }
});

// ============================================================================
// TOLAK
// ============================================================================
router.post('/:id/tolak', async (req, res) => {
  const id = req.params.id;
  const alasan = String(req.body.alasan || '').trim().slice(0, 500);
  if (!alasan) return H.redirectPesan(res, urlDetail(id), 'err', 'Alasan penolakan wajib diisi.');
  try {
    await db.runTransaction(async (tx) => {
      const ref = col().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Pengajuan tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DIAJUKAN) throw new H.AturanError('Pengajuan ini sudah diproses sebelumnya.');
      tx.update(ref, {
        status: STATUS.DITOLAK, alasanPenolakan: alasan,
        riwayat: H.tambahRiwayat(p, STATUS.DITOLAK, namaAdmin(req), alasan),
        updatedAt: new Date().toISOString()
      });
    });
    H.redirectPesan(res, urlDetail(id), 'ok', 'Pengajuan ditolak. Alasan dapat dilihat pengaju lewat kode pengajuan.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal menolak pengajuan');
  }
});

// ============================================================================
// BUAT ULANG PDF
// ============================================================================
router.post('/:id/buat-ulang-pdf', async (req, res) => {
  const id = req.params.id;
  try {
    const snap = await col().doc(id).get();
    if (!snap.exists || snap.data().status !== STATUS.DISETUJUI) return H.redirectPesan(res, urlDetail(id), 'err', 'Hanya pengajuan yang disetujui yang memiliki surat.');
    const ok = await terbitkanPdf(req, id);
    H.redirectPesan(res, urlDetail(id), ok ? 'ok' : 'err', ok ? 'PDF surat berhasil dibuat ulang.' : 'PDF gagal dibuat. Periksa log server (Chromium/Google Drive).');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal membuat PDF');
  }
});

// ============================================================================
// TARIK SURAT: batalkan penerbitan -> kembali "diajukan" (nomor & PDF dihapus)
// ============================================================================
router.post('/:id/tarik', async (req, res) => {
  const id = req.params.id;
  let pdfId = '';
  try {
    await db.runTransaction(async (tx) => {
      const ref = col().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Pengajuan tidak ditemukan.');
      const p = snap.data();
      if (p.status !== STATUS.DISETUJUI) throw new H.AturanError('Surat belum terbit.');
      pdfId = p.pdfFileId || '';
      tx.update(ref, {
        status: STATUS.DIAJUKAN, nomorSurat: '', tanggalSurat: '', kodeValidasi: '', pdfUrl: '', pdfFileId: '',
        riwayat: H.tambahRiwayat(p, STATUS.DIAJUKAN, namaAdmin(req), `Penerbitan surat ${p.nomorSurat} ditarik`),
        updatedAt: new Date().toISOString()
      });
    });
    await KI.hapusFileDrive(pdfId);
    H.redirectPesan(res, urlDetail(id), 'ok', 'Surat ditarik dari halaman publik. Pengajuan kembali berstatus menunggu verifikasi.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, urlDetail(id), 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal menarik surat');
  }
});

// ============================================================================
// HAPUS (mis. pengajuan spam)
// ============================================================================
router.post('/:id/hapus', async (req, res) => {
  try {
    const ref = col().doc(req.params.id);
    const snap = await ref.get();
    if (snap.exists) { await ref.delete(); await KI.hapusFileDrive(snap.data().pdfFileId); }
    H.redirectPesan(res, '/admin/kunjungan-industri?status=semua', 'ok', 'Pengajuan dihapus.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus pengajuan');
  }
});

module.exports = router;
