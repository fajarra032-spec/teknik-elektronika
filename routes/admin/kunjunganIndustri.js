/**
 * routes/admin/kunjunganIndustri.js
 * Admin memverifikasi pengajuan kunjungan industri dari publik. Begitu admin
 * mengisi nomor permohonan, surat terbit otomatis (halaman cetak + PDF) dan
 * tampil di bagian "Pengajuan yang Disetujui" pada /dokumen/kunjungan-industri.
 * Dipasang di /admin/kunjungan-industri (lihat routes/admin/index.js).
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { Readable } = require('stream');
const drive = require('../../config/googleDrive');
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
      kategoriLampiran: KATEGORI_LAMPIRAN,
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
    if (snap.exists) {
      await ref.delete();
      await KI.hapusFileDrive(snap.data().pdfFileId);
      for (const l of (snap.data().lampiran || [])) await KI.hapusFileDrive(l.fileId);
    }
    H.redirectPesan(res, '/admin/kunjungan-industri?status=semua', 'ok', 'Pengajuan dihapus.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menghapus pengajuan');
  }
});

// ============================================================================
// LAMPIRAN ARSIP PRODI: daftar hadir, dokumentasi, ulasan mahasiswa
// File disimpan di Drive: Data WEB / Arsip Kunjungan Industri / <tahun> / <kode>
// ============================================================================
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';
const KATEGORI_LAMPIRAN = {
  'daftar-hadir': 'Daftar Hadir Peserta',
  'dokumentasi': 'Dokumentasi Kegiatan',
  'ulasan': 'Ulasan / Laporan Mahasiswa'
};
const TIPE_LAMPIRAN = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];
const uploadLampiran = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 15 },
  fileFilter: (req, file, cb) => TIPE_LAMPIRAN.includes(file.mimetype) ? cb(null, true) : cb(new Error('Tipe file tidak didukung (PDF, foto JPG/PNG/WebP, Word, Excel).'), false)
});

async function subFolder(parentId, name) {
  const aman = String(name).replace(/'/g, '');
  const q = await drive.files.list({ q: `'${parentId}' in parents and name='${aman}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
  if (q.data.files.length) return q.data.files[0].id;
  const f = await drive.files.create({ resource: { name: aman, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' });
  return f.data.id;
}

router.post('/:id/lampiran', (req, res, next) => uploadLampiran.array('files', 15)(req, res, (err) => {
  if (!err) return next();
  const pesan = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran tiap file maksimal 10 MB.' : (err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Maksimal 15 file sekali unggah.' : err.message);
  H.redirectPesan(res, urlDetail(req.params.id) + '#arsip', 'err', pesan);
}), async (req, res) => {
  const id = req.params.id;
  const balik = urlDetail(id) + '#arsip';
  try {
    const kategori = String(req.body.kategori || '');
    if (!KATEGORI_LAMPIRAN[kategori]) return H.redirectPesan(res, balik, 'err', 'Jenis lampiran tidak valid.');
    const files = req.files || [];
    if (!files.length) return H.redirectPesan(res, balik, 'err', 'Pilih minimal satu file.');
    const ref = col().doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).send('Pengajuan tidak ditemukan');
    const p = snap.data();
    if (p.status !== STATUS.DISETUJUI) return H.redirectPesan(res, balik, 'err', 'Lampiran hanya untuk kunjungan yang suratnya sudah terbit.');

    const tahun = String(p.tanggalKunjungan || new Date().toISOString()).slice(0, 4);
    const induk = await subFolder(DATA_WEB_FOLDER_ID, 'Arsip Kunjungan Industri');
    const fTahun = await subFolder(induk, tahun);
    const fKode = await subFolder(fTahun, `${p.kode || id}_${String(p.namaPerusahaan || '').replace(/[^\w\- ]+/g, '').trim().slice(0, 40)}`);

    const baru = [];
    for (const f of files) {
      const namaAman = f.originalname.replace(/[^\w.\- ]+/g, '_');
      const r = await drive.files.create({
        resource: { name: `${kategori}_${Date.now()}_${namaAman}`, parents: [fKode] },
        media: { mimeType: f.mimetype, body: Readable.from(f.buffer) }, fields: 'id'
      });
      await drive.permissions.create({ fileId: r.data.id, requestBody: { role: 'reader', type: 'anyone' } });
      baru.push({
        id: crypto.randomBytes(6).toString('hex'), kategori, nama: f.originalname, tipe: f.mimetype, ukuran: f.size,
        fileId: r.data.id, url: `https://drive.google.com/uc?export=view&id=${r.data.id}`,
        diunggahOleh: namaAdmin(req), diunggahAt: new Date().toISOString()
      });
    }
    await ref.update({
      lampiran: [...(p.lampiran || []), ...baru],
      riwayat: H.tambahRiwayat(p, p.status, namaAdmin(req), `Lampiran ${KATEGORI_LAMPIRAN[kategori]} ditambahkan (${baru.length} file)`),
      updatedAt: new Date().toISOString()
    });
    H.redirectPesan(res, balik, 'ok', `${baru.length} file ${KATEGORI_LAMPIRAN[kategori].toLowerCase()} berhasil diunggah.`);
  } catch (err) {
    console.error('Gagal mengunggah lampiran kunjungan industri:', err);
    H.redirectPesan(res, balik, 'err', 'Gagal mengunggah lampiran: ' + err.message);
  }
});

router.post('/:id/lampiran/:lid/hapus', async (req, res) => {
  const id = req.params.id;
  const balik = urlDetail(id) + '#arsip';
  try {
    const ref = col().doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).send('Pengajuan tidak ditemukan');
    const p = snap.data();
    const target = (p.lampiran || []).find(l => l.id === req.params.lid);
    if (!target) return H.redirectPesan(res, balik, 'err', 'Lampiran tidak ditemukan.');
    await ref.update({
      lampiran: (p.lampiran || []).filter(l => l.id !== req.params.lid),
      riwayat: H.tambahRiwayat(p, p.status, namaAdmin(req), `Lampiran dihapus: ${target.nama}`),
      updatedAt: new Date().toISOString()
    });
    await KI.hapusFileDrive(target.fileId);
    H.redirectPesan(res, balik, 'ok', 'Lampiran dihapus.');
  } catch (err) {
    console.error(err);
    H.redirectPesan(res, balik, 'err', 'Gagal menghapus lampiran.');
  }
});

// Ulasan kunjungan (teks) + tautan dokumentasi eksternal (Google Photos/Drive, dll.)
router.post('/:id/ulasan', express.urlencoded({ extended: true }), async (req, res) => {
  const id = req.params.id;
  const balik = urlDetail(id) + '#arsip';
  try {
    const ref = col().doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).send('Pengajuan tidak ditemukan');
    const p = snap.data();
    const tautan = String(req.body.tautanDokumentasi || '').trim().slice(0, 500);
    if (tautan && !/^https?:\/\//i.test(tautan)) return H.redirectPesan(res, balik, 'err', 'Tautan dokumentasi harus diawali http:// atau https://');
    await ref.update({
      ulasanKunjungan: String(req.body.ulasanKunjungan || '').trim().slice(0, 5000),
      tautanDokumentasi: tautan,
      ulasanDiperbaruiAt: new Date().toISOString(),
      riwayat: H.tambahRiwayat(p, p.status, namaAdmin(req), 'Ulasan/tautan dokumentasi kunjungan diperbarui'),
      updatedAt: new Date().toISOString()
    });
    H.redirectPesan(res, balik, 'ok', 'Ulasan kunjungan disimpan.');
  } catch (err) {
    console.error(err);
    H.redirectPesan(res, balik, 'err', 'Gagal menyimpan ulasan.');
  }
});

module.exports = router;
