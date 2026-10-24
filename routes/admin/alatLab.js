/**
 * routes/admin/alatLab.js
 * Inventaris alat lab: semua alat harus terdata di sini sebelum bisa dipinjam.
 * Dipasang di /admin/alat-lab (lihat routes/admin/index.js).
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const H = require('../../helpers/peminjamanAlatHelper');
const { simpanFoto, hapusFoto } = require('../../helpers/fotoAlatHelper');
const { invalidateAlatPublik } = require('../../helpers/alatPublikHelper');

// Setiap perubahan inventaris membuang cache etalase publik di landing
router.use((req, res, next) => {
  if (req.method === 'POST') res.on('finish', invalidateAlatPublik);
  next();
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Upload foto alat (opsional, 1 file, gambar saja, maks 8 MB). Error upload
// ditampilkan sebagai pesan di form, bukan halaman error.
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype))
}).single('foto');
const terimaFoto = (urlBalik) => (req, res, next) => uploadFoto(req, res, (err) => {
  if (!err) return next();
  const pesan = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran foto maksimal 8 MB.' : 'Foto gagal diproses: ' + err.message;
  H.redirectPesan(res, typeof urlBalik === 'function' ? urlBalik(req) : urlBalik, 'err', pesan);
});

router.use(verifyToken);
router.use(isAdmin);

const col = () => db.collection(H.KOLEKSI_ALAT);

const toInt = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};

/** Jumlah alat yang sedang dipinjam = total - tersedia - rusak. */
const sedangDipinjam = (a) => Math.max(0, (a.jumlahTotal || 0) - (a.jumlahTersedia || 0) - (a.jumlahRusak || 0));

/** Buat kode otomatis LAB-0001, LAB-0002, ... yang belum dipakai. */
function kodeBerikutnya(kodeTerpakai) {
  let n = 0;
  kodeTerpakai.forEach(k => {
    const m = /^LAB-(\d+)$/i.exec(k || '');
    if (m) n = Math.max(n, parseInt(m[1], 10));
  });
  return () => `LAB-${String(++n).padStart(4, '0')}`;
}

async function semuaKode() {
  const snap = await col().select('kode').get();
  return new Set(snap.docs.map(d => (d.data().kode || '').toUpperCase()));
}

// ============================================================================
// DAFTAR INVENTARIS
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const snap = await col().orderBy('nama').get();
    const data = snap.docs.map(d => {
      const a = { id: d.id, ...d.data() };
      a.jumlahDipinjam = sedangDipinjam(a);
      return a;
    });
    const stat = data.reduce((s, a) => {
      s.jenis += 1;
      s.total += a.jumlahTotal || 0;
      s.tersedia += a.jumlahTersedia || 0;
      s.dipinjam += a.jumlahDipinjam;
      s.rusak += a.jumlahRusak || 0;
      return s;
    }, { jenis: 0, total: 0, tersedia: 0, dipinjam: 0, rusak: 0 });

    res.render('admin/alatlab/index', {
      title: 'Inventaris Alat Lab', user: req.user, data, stat,
      kategori: H.KATEGORI_ALAT, ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error('Gagal memuat inventaris alat lab:', err);
    res.status(500).send('Gagal memuat inventaris alat lab');
  }
});

// ============================================================================
// IMPORT MASSAL (Excel / CSV) - dipasang SEBELUM '/:id' agar tidak tertangkap
// ============================================================================
router.get('/import', (req, res) => {
  res.render('admin/alatlab/import', { title: 'Import Alat Lab', user: req.user, hasil: null, ...H.pesanDariQuery(req) });
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return H.redirectPesan(res, '/admin/alat-lab/import', 'err', 'Pilih file Excel/CSV terlebih dahulu.');

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) return H.redirectPesan(res, '/admin/alat-lab/import', 'err', 'File kosong atau tidak terbaca.');
    if (rows.length > 1000) return H.redirectPesan(res, '/admin/alat-lab/import', 'err', 'Maksimal 1000 baris per file.');

    const kodeTerpakai = await semuaKode();
    const buatKode = kodeBerikutnya(kodeTerpakai);
    const hasil = { berhasil: 0, dilewati: [], gagal: [] };
    let batch = db.batch();
    let isiBatch = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < rows.length; i++) {
      // Normalisasi nama kolom: huruf kecil & tanpa spasi/underscore
      const r = {};
      Object.keys(rows[i]).forEach(k => { r[String(k).toLowerCase().replace(/[\s_]+/g, '')] = String(rows[i][k]).trim(); });
      const baris = i + 2; // +1 header, +1 indeks mulai dari 1

      const nama = r.nama || r.namaalat;
      if (!nama) { hasil.gagal.push(`Baris ${baris}: nama alat kosong`); continue; }
      const total = toInt(r.jumlah || r.jumlahtotal || r.total, 1);
      if (total < 1) { hasil.gagal.push(`Baris ${baris} (${nama}): jumlah harus minimal 1`); continue; }
      const rusak = Math.min(toInt(r.rusak || r.jumlahrusak, 0), total);

      let kode = (r.kode || r.kodealat || '').toUpperCase();
      if (kode && kodeTerpakai.has(kode)) { hasil.dilewati.push(`Baris ${baris}: kode ${kode} sudah ada (${nama})`); continue; }
      if (!kode) kode = buatKode();
      kodeTerpakai.add(kode);

      batch.set(col().doc(), {
        kode, nama,
        kategori: r.kategori || 'Lainnya',
        merk: r.merk || r.merkmodel || '',
        lokasi: r.lokasi || '',
        keterangan: r.keterangan || '',
        jumlahTotal: total,
        jumlahRusak: rusak,
        jumlahTersedia: total - rusak,
        aktif: true,
        createdAt: now, updatedAt: now
      });
      hasil.berhasil++;
      if (++isiBatch >= 400) { await batch.commit(); batch = db.batch(); isiBatch = 0; }
    }
    if (isiBatch > 0) await batch.commit();

    res.render('admin/alatlab/import', { title: 'Import Alat Lab', user: req.user, hasil, ok: '', err: '' });
  } catch (err) {
    console.error('Gagal import alat lab:', err);
    H.redirectPesan(res, '/admin/alat-lab/import', 'err', 'Gagal memproses file: ' + err.message);
  }
});

// ============================================================================
// TAMBAH
// ============================================================================
router.get('/tambah', (req, res) => {
  res.render('admin/alatlab/form', {
    title: 'Tambah Alat Lab', user: req.user, alat: null, dipinjam: 0,
    kategori: H.KATEGORI_ALAT, ...H.pesanDariQuery(req)
  });
});

router.post('/', terimaFoto('/admin/alat-lab/tambah'), async (req, res) => {
  try {
    const b = req.body;
    const nama = (b.nama || '').trim();
    if (!nama) return H.redirectPesan(res, '/admin/alat-lab/tambah', 'err', 'Nama alat wajib diisi.');
    const total = toInt(b.jumlahTotal, 0);
    if (total < 1) return H.redirectPesan(res, '/admin/alat-lab/tambah', 'err', 'Jumlah total minimal 1.');
    const rusak = toInt(b.jumlahRusak, 0);
    if (rusak > total) return H.redirectPesan(res, '/admin/alat-lab/tambah', 'err', 'Jumlah rusak tidak boleh melebihi jumlah total.');

    const kodeTerpakai = await semuaKode();
    let kode = (b.kode || '').trim().toUpperCase();
    if (kode && kodeTerpakai.has(kode)) return H.redirectPesan(res, '/admin/alat-lab/tambah', 'err', `Kode ${kode} sudah dipakai alat lain.`);
    if (!kode) kode = kodeBerikutnya(kodeTerpakai)();

    // Unggah foto (jika ada) setelah semua validasi lolos
    let foto = { fotoUrl: '', fotoFileId: '' };
    if (req.file) {
      try { foto = await simpanFoto(req.file.buffer, kode); }
      catch (e) { console.error('Upload foto gagal:', e); return H.redirectPesan(res, '/admin/alat-lab/tambah', 'err', 'Gagal mengunggah foto: ' + e.message); }
    }

    const now = new Date().toISOString();
    await col().add({
      ...foto,
      kode, nama,
      kategori: b.kategori || 'Lainnya',
      merk: (b.merk || '').trim(),
      lokasi: (b.lokasi || '').trim(),
      keterangan: (b.keterangan || '').trim(),
      jumlahTotal: total, jumlahRusak: rusak, jumlahTersedia: total - rusak,
      aktif: b.aktif === 'on',
      createdAt: now, updatedAt: now
    });
    H.redirectPesan(res, '/admin/alat-lab', 'ok', `Alat "${nama}" (${kode}) berhasil ditambahkan.`);
  } catch (err) {
    console.error('Gagal menambah alat lab:', err);
    res.status(500).send('Gagal menyimpan alat: ' + err.message);
  }
});

// ============================================================================
// EDIT
// ============================================================================
router.get('/edit/:id', async (req, res) => {
  try {
    const doc = await col().doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Alat tidak ditemukan');
    const alat = { id: doc.id, ...doc.data() };
    res.render('admin/alatlab/form', {
      title: 'Edit Alat Lab', user: req.user, alat, dipinjam: sedangDipinjam(alat),
      kategori: H.KATEGORI_ALAT, ...H.pesanDariQuery(req)
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat data alat');
  }
});

router.post('/update/:id', terimaFoto((req) => `/admin/alat-lab/edit/${req.params.id}`), async (req, res) => {
  const id = req.params.id;
  const balik = `/admin/alat-lab/edit/${id}`;
  let fotoBaru = null;   // foto yang baru diunggah (dibersihkan bila transaksi gagal)
  let fotoLamaId = '';   // foto lama yang perlu dihapus setelah transaksi sukses
  try {
    const b = req.body;
    const nama = (b.nama || '').trim();
    if (!nama) return H.redirectPesan(res, balik, 'err', 'Nama alat wajib diisi.');
    const total = toInt(b.jumlahTotal, 0);
    const rusak = toInt(b.jumlahRusak, 0);
    const kodeBaru = (b.kode || '').trim().toUpperCase();
    if (!kodeBaru) return H.redirectPesan(res, balik, 'err', 'Kode alat wajib diisi.');
    if (total < 1) return H.redirectPesan(res, balik, 'err', 'Jumlah total minimal 1.');

    // Pastikan kode tidak bentrok dengan alat lain
    const dup = await col().where('kode', '==', kodeBaru).get();
    if (dup.docs.some(d => d.id !== id)) return H.redirectPesan(res, balik, 'err', `Kode ${kodeBaru} sudah dipakai alat lain.`);

    if (req.file) {
      try { fotoBaru = await simpanFoto(req.file.buffer, kodeBaru); }
      catch (e) { console.error('Upload foto gagal:', e); return H.redirectPesan(res, balik, 'err', 'Gagal mengunggah foto: ' + e.message); }
    }

    // Transaksi: stok tersedia dihitung ulang dari data terbaru supaya tidak
    // bentrok dengan peminjaman yang sedang disetujui admin lain.
    await db.runTransaction(async (tx) => {
      const ref = col().doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Alat tidak ditemukan.');
      const lama = snap.data();
      const dipinjam = sedangDipinjam(lama);
      const tersedia = total - rusak - dipinjam;
      if (tersedia < 0) {
        throw new H.AturanError(`Jumlah total (${total}) dikurangi rusak (${rusak}) tidak cukup menutup ${dipinjam} unit yang sedang dipinjam.`);
      }
      const fotoUpdate = {};
      if (fotoBaru) {
        Object.assign(fotoUpdate, fotoBaru);
        fotoLamaId = lama.fotoFileId || '';
      } else if (b.hapusFoto === 'on' && lama.fotoFileId) {
        Object.assign(fotoUpdate, { fotoUrl: '', fotoFileId: '' });
        fotoLamaId = lama.fotoFileId;
      }
      tx.update(ref, {
        ...fotoUpdate,
        kode: kodeBaru, nama,
        kategori: b.kategori || 'Lainnya',
        merk: (b.merk || '').trim(),
        lokasi: (b.lokasi || '').trim(),
        keterangan: (b.keterangan || '').trim(),
        jumlahTotal: total, jumlahRusak: rusak, jumlahTersedia: tersedia,
        aktif: b.aktif === 'on',
        updatedAt: new Date().toISOString()
      });
    });
    await hapusFoto(fotoLamaId);
    H.redirectPesan(res, '/admin/alat-lab', 'ok', `Data alat "${nama}" diperbarui.`);
  } catch (err) {
    if (fotoBaru) await hapusFoto(fotoBaru.fotoFileId);
    if (err instanceof H.AturanError) return H.redirectPesan(res, balik, 'err', err.message);
    console.error('Gagal update alat lab:', err);
    res.status(500).send('Gagal memperbarui alat: ' + err.message);
  }
});

// ============================================================================
// PERBAIKAN SELESAI: pindahkan unit rusak kembali menjadi tersedia
// ============================================================================
router.post('/perbaikan/:id', async (req, res) => {
  try {
    const jumlah = toInt(req.body.jumlah, 0);
    if (jumlah < 1) return H.redirectPesan(res, '/admin/alat-lab', 'err', 'Jumlah unit yang selesai diperbaiki minimal 1.');
    await db.runTransaction(async (tx) => {
      const ref = col().doc(req.params.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Alat tidak ditemukan.');
      const a = snap.data();
      if (jumlah > (a.jumlahRusak || 0)) throw new H.AturanError(`Unit rusak hanya ${a.jumlahRusak || 0}.`);
      tx.update(ref, {
        jumlahRusak: (a.jumlahRusak || 0) - jumlah,
        jumlahTersedia: (a.jumlahTersedia || 0) + jumlah,
        updatedAt: new Date().toISOString()
      });
    });
    H.redirectPesan(res, '/admin/alat-lab', 'ok', `${jumlah} unit ditandai selesai diperbaiki dan kembali tersedia.`);
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, '/admin/alat-lab', 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal memproses perbaikan');
  }
});

// ============================================================================
// HAPUS (hanya jika tidak ada unit yang sedang dipinjam)
// ============================================================================
router.post('/hapus/:id', async (req, res) => {
  let fotoId = '';
  try {
    await db.runTransaction(async (tx) => {
      const ref = col().doc(req.params.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new H.AturanError('Alat tidak ditemukan.');
      const dipinjam = sedangDipinjam(snap.data());
      if (dipinjam > 0) throw new H.AturanError(`Alat tidak bisa dihapus: masih ada ${dipinjam} unit yang sedang dipinjam. Nonaktifkan saja jika tidak ingin dipinjam lagi.`);
      fotoId = snap.data().fotoFileId || '';
      tx.delete(ref);
    });
    await hapusFoto(fotoId);
    H.redirectPesan(res, '/admin/alat-lab', 'ok', 'Alat dihapus dari inventaris.');
  } catch (err) {
    if (err instanceof H.AturanError) return H.redirectPesan(res, '/admin/alat-lab', 'err', err.message);
    console.error(err);
    res.status(500).send('Gagal menghapus alat');
  }
});

module.exports = router;
