/**
 * routes/admin/suratArsip.js
 * Arsip Surat Prodi: menyimpan surat/dokumen prodi (mis. pengajuan dana, surat keluar,
 * proposal, LPJ) yang TIDAK dikirim ke siapa pun di sistem - hanya diarsipkan dan bisa
 * dicari kembali. Koleksi Firestore: 'surat_arsip'. File disimpan di Google Drive:
 *   Data WEB / Arsip Surat Prodi / <tahun> /
 * Dipasang di routes/admin/index.js pada '/surat-arsip'.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { Readable } = require('stream');
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { normalisasiNomorSurat } = require('../../helpers/nomorSuratHelper');

const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';
const COL = 'surat_arsip';
const KATEGORI = [
  'Pengajuan Dana', 'Proposal Kegiatan', 'LPJ / Laporan', 'Surat Keluar Prodi', 'Surat Masuk',
  'Berita Acara', 'Notulen / Undangan Rapat', 'SK / Keputusan', 'Lainnya'
];
const TIPE_DIIZINKAN = [
  'application/pdf', 'image/jpeg', 'image/png',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => TIPE_DIIZINKAN.includes(file.mimetype) ? cb(null, true) : cb(new Error('Tipe file tidak didukung (PDF, JPG, PNG, Word, Excel).'), false)
});
// Tangkap error multer (tipe/ukuran) agar tampil sebagai pesan, bukan halaman error.
const unggah = (balikKe) => (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  const pesan = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file maksimal 10 MB.' : err.message;
  res.redirect(`${balikKe(req)}?err=${encodeURIComponent(pesan)}`);
});

router.use(verifyToken);
router.use(isAdmin);

async function getOrCreateSubFolder(parentId, name) {
  const q = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)'
  });
  if (q.data.files.length > 0) return q.data.files[0].id;
  const f = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id'
  });
  return f.data.id;
}
async function simpanKeDrive(file, tahun) {
  const induk = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Arsip Surat Prodi');
  const folderId = await getOrCreateSubFolder(induk, String(tahun));
  const namaAman = file.originalname.replace(/[^\w.\- ]+/g, '_');
  const r = await drive.files.create({
    resource: { name: `${Date.now()}_${namaAman}`, parents: [folderId] },
    media: { mimeType: file.mimetype, body: Readable.from(file.buffer) }, fields: 'id'
  });
  await drive.permissions.create({ fileId: r.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  return { fileId: r.data.id, fileUrl: `https://drive.google.com/uc?export=view&id=${r.data.id}`, fileNama: file.originalname, fileTipe: file.mimetype };
}
async function buangFileLama(fileId) {
  if (!fileId) return;
  try { await drive.files.update({ fileId, requestBody: { trashed: true } }); }
  catch (e) { console.error('[arsip surat] gagal memindahkan file lama ke sampah:', e.message); }
}
function bacaForm(b) {
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(b.tanggalSurat || '') ? b.tanggalSurat : '';
  return {
    perihal: String(b.perihal || '').trim().slice(0, 250),
    nomorSurat: normalisasiNomorSurat(b.nomorSurat, tanggal).slice(0, 120),
    kategori: KATEGORI.includes(b.kategori) ? b.kategori : 'Lainnya',
    tanggalSurat: tanggal,
    tahun: tanggal ? tanggal.slice(0, 4) : String(new Date().getFullYear()),
    tujuan: String(b.tujuan || '').trim().slice(0, 200),     // tujuan / asal surat (hanya catatan, tidak dikirim)
    keterangan: String(b.keterangan || '').trim().slice(0, 1000)
  };
}

// ---------------------------------------------------------------------------
// DAFTAR ARSIP
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { q = '', kategori = '', tahun = '' } = req.query;
    const snap = await db.collection(COL).get();
    let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const daftarTahun = Array.from(new Set(list.map(x => x.tahun).filter(Boolean))).sort().reverse();
    if (kategori) list = list.filter(x => x.kategori === kategori);
    if (tahun) list = list.filter(x => x.tahun === tahun);
    if (q) {
      const k = q.toLowerCase();
      list = list.filter(x => [x.perihal, x.nomorSurat, x.tujuan, x.keterangan, x.fileNama].some(v => String(v || '').toLowerCase().includes(k)));
    }
    list.sort((a, b) => String(b.tanggalSurat || b.createdAt).localeCompare(String(a.tanggalSurat || a.createdAt)));
    res.render('admin/surat/arsip_index', {
      title: 'Arsip Surat Prodi', list, KATEGORI, daftarTahun,
      filters: { q, kategori, tahun }, ok: req.query.ok || '', err: req.query.err || ''
    });
  } catch (e) {
    console.error('Error daftar arsip surat:', e);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat arsip surat' });
  }
});

// ---------------------------------------------------------------------------
// ARSIPKAN SURAT BARU
// ---------------------------------------------------------------------------
router.get('/baru', (req, res) => {
  res.render('admin/surat/arsip_form', {
    title: 'Arsipkan Surat Prodi', KATEGORI, arsip: null, err: req.query.err || ''
  });
});

router.post('/', unggah(() => '/admin/surat-arsip/baru'), async (req, res) => {
  try {
    const f = bacaForm(req.body);
    if (!f.perihal) return res.redirect('/admin/surat-arsip/baru?err=' + encodeURIComponent('Perihal wajib diisi.'));
    if (!req.file) return res.redirect('/admin/surat-arsip/baru?err=' + encodeURIComponent('File surat wajib diunggah.'));
    const berkas = await simpanKeDrive(req.file, f.tahun);
    const now = new Date().toISOString();
    await db.collection(COL).add({
      ...f, ...berkas,
      dibuatOleh: req.user.id, dibuatOlehNama: req.user.nama || 'Admin',
      createdAt: now, updatedAt: now
    });
    res.redirect('/admin/surat-arsip?ok=' + encodeURIComponent('Surat berhasil diarsipkan.'));
  } catch (e) {
    console.error('Error arsipkan surat:', e);
    res.redirect('/admin/surat-arsip/baru?err=' + encodeURIComponent('Gagal menyimpan arsip: ' + e.message));
  }
});

// ---------------------------------------------------------------------------
// EDIT (nomor, data, atau ganti file)
// ---------------------------------------------------------------------------
router.get('/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection(COL).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Arsip tidak ditemukan');
    res.render('admin/surat/arsip_form', {
      title: 'Edit Arsip Surat', KATEGORI, arsip: { id: doc.id, ...doc.data() }, err: req.query.err || ''
    });
  } catch (e) {
    console.error(e); res.status(500).send('Gagal memuat arsip');
  }
});

router.post('/:id', unggah(req => `/admin/surat-arsip/${req.params.id}/edit`), async (req, res) => {
  try {
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Arsip tidak ditemukan');
    const lama = doc.data();
    const f = bacaForm(req.body);
    if (!f.perihal) return res.redirect(`/admin/surat-arsip/${req.params.id}/edit?err=` + encodeURIComponent('Perihal wajib diisi.'));
    const patch = { ...f, updatedAt: new Date().toISOString(), diubahOleh: req.user.nama || 'Admin' };
    if (req.file) Object.assign(patch, await simpanKeDrive(req.file, f.tahun));
    await ref.update(patch);
    if (req.file && lama.fileId) await buangFileLama(lama.fileId);
    res.redirect('/admin/surat-arsip?ok=' + encodeURIComponent('Arsip diperbarui.'));
  } catch (e) {
    console.error('Error edit arsip surat:', e);
    res.redirect(`/admin/surat-arsip/${req.params.id}/edit?err=` + encodeURIComponent('Gagal menyimpan: ' + e.message));
  }
});

// ---------------------------------------------------------------------------
// HAPUS (file dipindah ke Sampah Drive, bisa dipulihkan)
// ---------------------------------------------------------------------------
router.post('/:id/hapus', async (req, res) => {
  try {
    const ref = db.collection(COL).doc(req.params.id);
    const doc = await ref.get();
    if (doc.exists) {
      await ref.delete();
      await buangFileLama(doc.data().fileId);
    }
    res.redirect('/admin/surat-arsip?ok=' + encodeURIComponent('Arsip dihapus.'));
  } catch (e) {
    console.error('Error hapus arsip surat:', e);
    res.redirect('/admin/surat-arsip?err=' + encodeURIComponent('Gagal menghapus: ' + e.message));
  }
});

module.exports = router;
