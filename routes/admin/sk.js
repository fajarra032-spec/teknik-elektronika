const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const { Readable } = require('stream');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { generatePeriodeOptions, getActivePeriodeId, normalizeKelas } = require('../../helpers/academicHelper');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// IDENTITAS PENANDATANGAN (Kaprodi) - SATU SUMBER, dipakai otomatis di semua
// SK Mengajar yang dirilis dari sini, konsisten dengan kop & ttd yang sudah
// dipakai pada surat-surat lain di web ini (/images/logo.png, /images/ttd.png).
// ============================================================================
const KAPRODI = {
  nama: 'Fajar Ramadhan, S.Pd., M.T',
  nuptk: '8559777678130153',
  jabatan: 'Ketua Program Studi Teknik Elektronika'
};

const BULAN_ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function generateKodeValidasiMengajar() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ELK${timestamp}${random}`;
}

/**
 * PENTING: dokumen `mataKuliah` TIDAK punya field `periodeId` langsung.
 * Riwayat pengampu per periode disimpan di subcollection
 * `mataKuliah/{id}/pengampuPeriode/{periodeId}` (lihat routes/admin/matakuliah.js
 * - savePengampuPeriode/getPengampuUntukPeriode). Field `mataKuliah.dosenIds`
 * cuma "cermin" pengampu periode AKTIF saat ini.
 *
 * Fungsi ini mengambil mata kuliah yang RELEVAN untuk periode yang diminta,
 * lalu melengkapi tiap dokumen dengan `dosenIdsPeriode`: pengampu yang
 * berlaku untuk periode tsb - dari subcollection kalau sudah pernah diisi,
 * atau fallback ke mk.dosenIds kalau periode yang diminta adalah periode
 * aktif (data lama sebelum fitur per-periode ada).
 *
 * Dua proteksi tambahan (sumber bug "genap ikut kelist" & "MK ganda"):
 * 1) FILTER PARITAS SEMESTER - PERSIS logika filter "Semester Aktif" di
 *    halaman Kelola Mata Kuliah: MK semester ganjil (1,3,5,...) hanya
 *    relevan untuk periode Ganjil, semester genap (2,4,6,...) hanya untuk
 *    periode Genap. Tanpa ini, MK genap yang `dosenIds`-nya belum
 *    dikosongkan sejak semester lalu ikut nyangkut ke SK periode ganjil
 *    (dan sebaliknya) lewat jalur fallback di atas. MK Praktik Dunia Kerja
 *    (isPDK) & MK yang field semesternya belum keisi tetap lolos (tidak
 *    disembunyikan) - sama seperti aslinya.
 * 2) DEDUPLIKASI - buang ID dosen dobel dalam satu MK, dan buang dokumen
 *    MK yang kode+kelas-nya identik (proteksi kalau ada data ganda di
 *    database), supaya satu mata kuliah tidak muncul dua kali di lampiran.
 */
async function getMataKuliahDenganPengampuPeriode(periodeId, periodeSemesterType) {
  const activePeriodeId = getActivePeriodeId();
  const mkSnapshot = await db.collection('mataKuliah').get();

  const hasil = await Promise.all(mkSnapshot.docs.map(async (doc) => {
    const d = doc.data();

    // (1) Filter paritas semester - lewati MK yang semesternya tidak
    // relevan dengan periode yang dipilih (PDK & semester kosong lolos).
    if (!d.isPDK && d.semester) {
      const parity = d.semester % 2 === 1 ? 'Ganjil' : 'Genap';
      if (periodeSemesterType && parity !== periodeSemesterType) return null;
    }

    let dosenIdsPeriode;
    const periodeDoc = await doc.ref.collection('pengampuPeriode').doc(periodeId).get();
    if (periodeDoc.exists) {
      dosenIdsPeriode = periodeDoc.data().dosenIds || [];
    } else if (periodeId === activePeriodeId) {
      dosenIdsPeriode = d.dosenIds || [];
    } else {
      dosenIdsPeriode = [];
    }
    // Buang ID dosen dobel dalam satu MK yang sama
    dosenIdsPeriode = [...new Set((dosenIdsPeriode || []).filter(Boolean))];

    return { id: doc.id, ...d, dosenIdsPeriode };
  }));

  // (2) Buang dokumen MK yang kode+kelas-nya identik (data ganda)
  const sudahDilihat = new Set();
  return hasil.filter(mk => {
    if (!mk) return false;
    const kunci = `${(mk.kode || mk.nama || mk.id || '').toLowerCase()}::${normalizeKelas(mk.kelas) || '-'}`;
    if (sudahDilihat.has(kunci)) return false;
    sudahDilihat.add(kunci);
    return true;
  });
}

// Konstanta folder Drive
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0'; // Ganti dengan ID folder Data WEB Anda

async function getOrCreateSubFolder(parentId, name) {
  const query = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) return query.data.files[0].id;
  const folder = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return folder.data.id;
}

async function getSkFolder() {
  const parentDosen = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Dosen');
  const skFolder = await getOrCreateSubFolder(parentDosen, 'SK Dosen');
  return skFolder;
}

// Halaman daftar SK (admin)
router.get('/', async (req, res) => {
  try {
    const skSnapshot = await db.collection('sk_dosen').orderBy('tanggalUpload', 'desc').get();
    const skList = [];
    for (const doc of skSnapshot.docs) {
      const data = doc.data();
      // Ambil nama dosen
      let namaDosen = 'Tidak diketahui';
      if (data.dosenId) {
        const dosenDoc = await db.collection('dosen').doc(data.dosenId).get();
        if (dosenDoc.exists) namaDosen = dosenDoc.data().nama;
      }
      skList.push({
        id: doc.id,
        ...data,
        namaDosen,
        tanggalUpload: data.tanggalUpload ? data.tanggalUpload.toDate() : null,
      });
    }
    // Ambil daftar dosen untuk dropdown
    const dosenSnapshot = await db.collection('dosen').get();
    const dosenList = dosenSnapshot.docs.map(doc => ({ id: doc.id, nama: doc.data().nama }));
    res.render('admin/sk/index', {
      title: 'Kelola SK Dosen', skList, dosenList,
      terkirim: req.query.terkirim ? parseInt(req.query.terkirim, 10) || 0 : 0,
      terkirimNomor: req.query.nomor || '',
      terkirimJenis: req.query.jenis === 'mengajar' ? 'Mengajar' : 'Pembimbing Akademik',
      terkirimDilewati: parseInt(req.query.dilewati, 10) || 0,
      terkirimGagal: req.query.gagal || ''
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: 'Gagal memuat data SK' });
  }
});

// Jalur dari menu SK ke Rilis SK Pembimbing Akademik (Dosen PA)
router.get('/pembimbing', (req, res) => res.redirect('/admin/bimbingan/sk'));

// Proses upload SK
router.post('/', upload.single('fileSk'), async (req, res) => {
  try {
    const { dosenId, kategori, judul } = req.body;
    if (!req.file) return res.status(400).send('File SK harus diupload');
    if (!dosenId || !kategori) return res.status(400).send('Dosen dan kategori wajib diisi');

    // Upload ke Drive
    const skFolderId = await getSkFolder();
    const originalName = req.file.originalname;
    const fileMetadata = { name: originalName, parents: [skFolderId] };
    const media = { mimeType: req.file.mimetype, body: Readable.from(req.file.buffer) };
    const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    });
    const fileUrl = `https://drive.google.com/uc?export=view&id=${response.data.id}`;

    // Simpan ke Firestore
    await db.collection('sk_dosen').add({
      dosenId,
      kategori,
      judul: judul || `SK ${kategori} - ${new Date().toLocaleDateString()}`,
      fileUrl,
      fileId: response.data.id,
      tanggalUpload: new Date(),
      createdBy: req.user.id,
    });

    res.redirect('/admin/sk');
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal upload SK');
  }
});

// Hapus SK (opsional)
router.post('/:id/delete', async (req, res) => {
  try {
    const skId = req.params.id;
    const skDoc = await db.collection('sk_dosen').doc(skId).get();
    if (!skDoc.exists) return res.status(404).send('SK tidak ditemukan');
    const { fileId } = skDoc.data();
    // Hapus dari Firestore dulu
    await db.collection('sk_dosen').doc(skId).delete();
    // Hapus dari Drive HANYA bila tidak dipakai SK dosen lain
    // (SK PA yang dirilis ke banyak dosen memakai satu file PDF yang sama)
    if (fileId) {
      try {
        const masihDipakai = await db.collection('sk_dosen').where('fileId', '==', fileId).limit(1).get();
        if (masihDipakai.empty) await drive.files.delete({ fileId });
      } catch (err) { console.error('Gagal hapus file dari Drive:', err.message); }
    }
    res.redirect('/admin/sk');
  } catch (error) {
    console.error(error);
    res.status(500).send('Gagal hapus SK');
  }
});

// ============================================================================
// RILIS SK MENGAJAR (OTOMATIS)
// Nomor/isi/lampiran dibuat otomatis dari data Mata Kuliah & Dosen yang
// SUNGGUHAN ada di database untuk periode yang dipilih (sinkron dengan
// fitur dropdown periode di Kelola Mata Kuliah) - admin tinggal isi Nomor SK
// & tanggal, kop dan ttd Kaprodi otomatis dipakai dari aset yang sama
// dengan Surat Keterangan Aktif Kuliah.
// ============================================================================

/**
 * SKS efektif untuk SEORANG dosen pada satu MK: kalau MK itu diampu lebih
 * dari satu dosen (tim teaching), beban SKS dibagi rata sesuai jumlah
 * pengampu (paling umum: 2 dosen -> masing-masing setengah). Kalau cuma
 * satu pengampu, SKS-nya utuh seperti biasa.
 */
function hitungSksEfektif(sksAsli, jumlahPengampu) {
  const sks = Number(sksAsli) || 0;
  const jumlah = jumlahPengampu > 0 ? jumlahPengampu : 1;
  return jumlah > 1 ? sks / jumlah : sks;
}

/**
 * GET /admin/sk/mengajar
 * Form pemilihan periode -> menampilkan daftar dosen beserta mata kuliah
 * yang diampu pada periode tsb, siap dirilis SK-nya satu per satu.
 */
router.get('/mengajar', async (req, res) => {
  try {
    const periodeList = generatePeriodeOptions(8, 2);
    const activePeriodeId = getActivePeriodeId();
    const periodeId = req.query.periodeId || activePeriodeId;
    const selectedPeriode = periodeList.find(p => p.id === periodeId)
      || periodeList.find(p => p.isActive)
      || periodeList[0];

    const mkList = await getMataKuliahDenganPengampuPeriode(selectedPeriode.id, selectedPeriode.semester);

    // Kelompokkan mata kuliah per dosen (pengampu KHUSUS periode terpilih)
    const dosenMap = new Map(); // dosenId -> { matkul: [...], totalSks }
    mkList.forEach(d => {
      const dosenIds = Array.isArray(d.dosenIdsPeriode) ? d.dosenIdsPeriode : [];
      const timTeaching = dosenIds.length > 1;
      const sksEfektif = hitungSksEfektif(d.sks, dosenIds.length);
      dosenIds.forEach(dId => {
        if (!dId) return;
        if (!dosenMap.has(dId)) dosenMap.set(dId, { matkul: [], totalSks: 0 });
        const entry = dosenMap.get(dId);
        entry.matkul.push({
          nama: d.nama || d.kode || '-',
          sks: sksEfektif,
          timTeaching,
          kelas: normalizeKelas(d.kelas) || '-'
        });
        entry.totalSks += sksEfektif;
      });
    });

    // Lengkapi dengan identitas dosen (nama & NIP)
    const dosenRilis = [];
    for (const [dosenId, entry] of dosenMap.entries()) {
      const dosenDoc = await db.collection('dosen').doc(dosenId).get();
      const dosenData = dosenDoc.exists ? dosenDoc.data() : {};
      dosenRilis.push({
        id: dosenId,
        nama: dosenData.nama || 'Tidak diketahui',
        nip: dosenData.nip || '-',
        jumlahMk: entry.matkul.length,
        totalSks: Math.round(entry.totalSks * 100) / 100,
        matkul: entry.matkul
      });
    }
    dosenRilis.sort((a, b) => a.nama.localeCompare(b.nama));

    // Dosen yang SK Mengajar-nya sudah dirilis & dikirim lewat fitur ini untuk periode terpilih
    const sudahKirim = {};
    const kirimSnap = await db.collection('sk_dosen')
      .where('kategori', '==', 'mengajar').where('periodeId', '==', selectedPeriode.id).get();
    kirimSnap.docs.forEach(d => { const v = d.data(); if (v.dosenId) sudahKirim[v.dosenId] = { nomorSk: v.nomorSk || '' }; });

    res.render('admin/sk/mengajar_form', {
      title: 'Rilis SK Mengajar',
      periodeList,
      selectedPeriode,
      dosenRilis,
      sudahKirim,
      today: new Date().toISOString().substring(0, 10)
    });
  } catch (error) {
    console.error('Error memuat form SK Mengajar:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat form Rilis SK Mengajar' });
  }
});

const skDistribusi = require('../../helpers/skDistribusiHelper');

const fmtTanggal = (v) => (v ? new Date(v) : new Date())
  .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Nomor SK per dosen. Mode 'berurutan': angka pertama pada nomor dinaikkan
 * satu per dosen (598/ELK/... -> 599/ELK/...), nol di depan dipertahankan.
 * Mode 'sama' (atau nomor tanpa angka): semua dosen memakai nomor yang sama.
 */
function nomorUntuk(nomorAwal, urutan, mode) {
  if (mode === 'sama' || urutan === 0) return nomorAwal;
  const m = nomorAwal.match(/\d+/);
  if (!m) return nomorAwal;
  const baru = String(parseInt(m[0], 10) + urutan).padStart(m[0].length, '0');
  return nomorAwal.slice(0, m.index) + baru + nomorAwal.slice(m.index + m[0].length);
}

/** Susun data satu SK Mengajar (untuk template mengajar_cetak). null bila dosen tidak mengampu MK pada periode. */
function bangunSkMengajar({ dosenId, dosen, periode, mkList, nomorSurat, tanggalTampil, tanggalRapatTampil, kota }) {
  const daftarMk = mkList
    .filter(d => Array.isArray(d.dosenIdsPeriode) && d.dosenIdsPeriode.includes(dosenId))
    .map(d => ({
      nama: d.nama || d.kode || '-',
      sks: hitungSksEfektif(d.sks, d.dosenIdsPeriode.length),
      timTeaching: d.dosenIdsPeriode.length > 1,
      kelas: normalizeKelas(d.kelas) || '-'
    }))
    .sort((a, b) => a.nama.localeCompare(b.nama));
  if (daftarMk.length === 0) return null;
  return {
    dosenId,
    nomorSurat,
    semester: periode.semester,
    tahunAkademik: `${periode.tahunAwal}/${periode.tahunAkhir}`,
    namaDosen: dosen.nama || '-',
    nipDosen: dosen.nip || '-',
    daftarMk,
    jumlahMk: daftarMk.length,
    totalSks: Math.round(daftarMk.reduce((n, m) => n + (Number(m.sks) || 0), 0) * 100) / 100,
    tanggalTampil, tanggalRapatTampil,
    kota: kota || 'Palopo',
    kaprodi: KAPRODI,
    kodeValidasi: generateKodeValidasiMengajar()
  };
}

/**
 * Validasi isian + susun SK untuk BANYAK dosen sekaligus (cetak banyak / rilis & kirim).
 * @returns {Promise<{error?: string, periode?: object, daftar?: object[], dilewati?: string[], nomorAwal?: string}>}
 */
async function siapkanSkMengajarBanyak(body) {
  const periodeId = String(body.periodeId || '');
  const nomorAwal = String(body.nomorSk || '').trim();
  if (!periodeId) return { error: 'Periode wajib dipilih.' };
  if (!nomorAwal) return { error: 'Nomor SK wajib diisi.' };

  let ids = body.dosenId || [];
  if (!Array.isArray(ids)) ids = [ids];
  ids = [...new Set(ids.filter(Boolean))];
  if (ids.length === 0) return { error: 'Centang minimal satu dosen.' };

  const periode = generatePeriodeOptions(15, 2).find(p => p.id === periodeId);
  if (!periode) return { error: 'Periode tidak dikenali.' };

  const mode = body.nomorMode === 'sama' ? 'sama' : 'berurutan';
  const tanggalTampil = fmtTanggal(body.tanggal);
  const tanggalRapatTampil = body.tanggalRapat ? fmtTanggal(body.tanggalRapat) : tanggalTampil;
  const kota = String(body.kota || '').trim() || 'Palopo';

  const [mkList, dosenSnap] = await Promise.all([
    getMataKuliahDenganPengampuPeriode(periodeId, periode.semester),
    db.collection('dosen').get()
  ]);
  const dosenMap = {};
  dosenSnap.docs.forEach(d => { dosenMap[d.id] = d.data(); });

  // Urut nama dosen (A-Z) supaya nomor berurutan mudah ditebak
  const terurut = ids.filter(id => dosenMap[id])
    .sort((a, b) => (dosenMap[a].nama || '').localeCompare(dosenMap[b].nama || ''));

  const daftar = [];
  const dilewati = [];
  terurut.forEach(id => {
    const sk = bangunSkMengajar({
      dosenId: id, dosen: dosenMap[id], periode, mkList,
      nomorSurat: nomorUntuk(nomorAwal, daftar.length, mode),
      tanggalTampil, tanggalRapatTampil, kota
    });
    if (sk) daftar.push(sk); else dilewati.push(dosenMap[id].nama || id);
  });
  if (daftar.length === 0) {
    return { error: 'Dosen terpilih tidak mengampu mata kuliah pada periode tersebut - tidak ada SK yang bisa dibuat.' };
  }
  return { periode, daftar, dilewati, nomorAwal };
}

/**
 * GET /admin/sk/mengajar/cetak  (satu dosen, tetap dipertahankan)
 */
router.get('/mengajar/cetak', async (req, res) => {
  try {
    const { dosenId, periodeId, nomorSk, tanggal, kota, tanggalRapat } = req.query;
    if (!dosenId || !periodeId) {
      return res.status(400).render('error', { title: 'Error', message: 'Dosen dan periode wajib dipilih.' });
    }
    if (!nomorSk) {
      return res.status(400).render('error', { title: 'Error', message: 'Nomor SK wajib diisi sebelum mencetak.' });
    }
    const periode = generatePeriodeOptions(15, 2).find(p => p.id === periodeId);
    if (!periode) {
      return res.status(400).render('error', { title: 'Error', message: 'Periode tidak dikenali.' });
    }
    const dosenDoc = await db.collection('dosen').doc(dosenId).get();
    if (!dosenDoc.exists) {
      return res.status(404).render('error', { title: 'Error', message: 'Dosen tidak ditemukan.' });
    }
    const mkList = await getMataKuliahDenganPengampuPeriode(periodeId, periode.semester);
    const tanggalTampil = fmtTanggal(tanggal);
    const sk = bangunSkMengajar({
      dosenId, dosen: dosenDoc.data(), periode, mkList, nomorSurat: nomorSk,
      tanggalTampil, tanggalRapatTampil: tanggalRapat ? fmtTanggal(tanggalRapat) : tanggalTampil, kota
    });
    if (!sk) {
      return res.status(400).render('error', { title: 'Error', message: 'Dosen ini tidak mengampu mata kuliah pada periode tersebut - tidak ada yang bisa dicetak di lampiran.' });
    }
    res.render('admin/sk/mengajar_cetak', { daftarSk: [sk] });
  } catch (error) {
    console.error('Error mencetak SK Mengajar:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal membuat SK Mengajar: ' + error.message });
  }
});

/**
 * POST /admin/sk/mengajar/cetak-banyak
 * Cetak SK Mengajar untuk dosen yang dicentang, dalam satu dokumen (tiap dosen = 2 halaman).
 */
router.post('/mengajar/cetak-banyak', async (req, res) => {
  try {
    const { error, daftar, periode } = await siapkanSkMengajarBanyak(req.body);
    if (error) return res.status(400).send(error);
    res.render('admin/sk/mengajar_cetak', {
      daftarSk: daftar,
      judulHalaman: `SK Mengajar ${periode.semester} ${periode.tahunAwal}/${periode.tahunAkhir} (${daftar.length} dosen)`
    });
  } catch (error) {
    console.error('Error cetak banyak SK Mengajar:', error);
    res.status(500).send('Gagal membuat SK Mengajar: ' + error.message);
  }
});

/**
 * POST /admin/sk/mengajar/kirim
 * Rilis & kirim: tiap dosen terpilih dibuatkan PDF SK-nya sendiri -> Drive (folder
 * SK Dosen) -> entri sk_dosen kategori 'mengajar' (muncul di "SK Saya") -> notifikasi.
 * Kirim ulang untuk dosen + periode yang sama MENGGANTI SK lama (tidak dobel).
 */
router.post('/mengajar/kirim', async (req, res) => {
  let browser;
  try {
    const { error, daftar, periode, dilewati, nomorAwal } = await siapkanSkMengajarBanyak(req.body);
    if (error) return res.status(400).send(error);

    const { createNotification } = require('../../helpers/notificationHelper');
    const folderId = await getSkFolder();
    const userPerDosen = await skDistribusi.petaUserPerDosen(db);
    browser = await skDistribusi.bukaBrowser();

    let terkirim = 0;
    const gagal = [];
    for (const sk of daftar) {
      try {
        const html = await new Promise((resolve, reject) => {
          res.render('admin/sk/mengajar_cetak', { daftarSk: [sk], judulHalaman: `SK Mengajar - ${sk.namaDosen}` }, (err, out) => (err ? reject(err) : resolve(out)));
        });
        const pdf = await skDistribusi.htmlKePdf(browser, html);
        const namaFile = `SK_Mengajar_${skDistribusi.amanNama(sk.semester)}_${skDistribusi.amanNama(sk.tahunAkademik)}_${skDistribusi.amanNama(sk.namaDosen)}.pdf`;
        const { fileId, fileUrl } = await skDistribusi.unggahPdf(drive, folderId, namaFile, pdf);

        const judul = `SK Mengajar ${sk.semester} ${sk.tahunAkademik} (No. ${sk.nomorSurat})`;
        const isi = {
          dosenId: sk.dosenId, kategori: 'mengajar', judul, fileUrl, fileId,
          nomorSk: sk.nomorSurat, periodeId: req.body.periodeId, semester: sk.semester, tahunAjaran: sk.tahunAkademik,
          jumlahMk: sk.jumlahMk, totalSks: sk.totalSks, sumber: 'rilis-otomatis-sk-mengajar',
          tanggalUpload: new Date(), createdBy: req.user.id
        };
        const lama = await db.collection('sk_dosen').where('dosenId', '==', sk.dosenId)
          .where('kategori', '==', 'mengajar').where('periodeId', '==', req.body.periodeId).get();
        let diperbarui = false;
        if (!lama.empty) {
          diperbarui = true;
          const fileLama = lama.docs[0].data().fileId;
          await lama.docs[0].ref.update(isi);
          if (fileLama && fileLama !== fileId) await skDistribusi.hapusFileBilaYatim(db, drive, fileLama);
        } else {
          await db.collection('sk_dosen').add(isi);
        }

        const uid = userPerDosen[sk.dosenId];
        if (uid) {
          try {
            await createNotification(db, uid, {
              type: 'sk',
              title: diperbarui ? 'SK Mengajar diperbarui' : 'SK Mengajar baru',
              message: `${judul}: Anda ditetapkan mengampu ${sk.jumlahMk} mata kuliah (${sk.totalSks} SKS).`,
              link: '/dosen/sk'
            });
          } catch (e) { console.error('SK terkirim, tetapi notifikasi gagal dibuat:', e.message); }
        }
        terkirim++;
      } catch (e) {
        console.error('Gagal merilis SK Mengajar untuk', sk.namaDosen, e);
        gagal.push(sk.namaDosen);
      }
    }
    await browser.close(); browser = null;

    const q = new URLSearchParams({ terkirim: String(terkirim), jenis: 'mengajar', nomor: nomorAwal });
    if (dilewati.length) q.set('dilewati', String(dilewati.length));
    if (gagal.length) q.set('gagal', gagal.join(', '));
    res.redirect('/admin/sk?' + q.toString());
  } catch (error) {
    console.error('Error rilis & kirim SK Mengajar:', error);
    if (browser) { try { await browser.close(); } catch (_) {} }
    res.status(500).send('Gagal merilis & mengirim SK Mengajar: ' + error.message);
  }
});

router.getSkFolder = getSkFolder; // dipakai routes/admin/bimbingan.js (rilis & kirim SK PA)
module.exports = router;