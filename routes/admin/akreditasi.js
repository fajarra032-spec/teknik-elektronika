// routes/admin/akreditasi.js
//
// Fitur Akreditasi Program Studi untuk ADMIN:
// - Kelola periode akreditasi (mis. "Akreditasi LAM Teknik 2026")
// - Setiap periode otomatis diisi 9 kriteria (lihat helpers/akreditasiHelper.js)
// - Admin menetapkan dosen PIC per kriteria & status pengerjaan
// - Workspace per kriteria: tempat diskusi (pembahasan) + pengumpulan dokumen

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const {
  seedKriteriaUntukPeriode,
  seedChecklistUntukKriteria,
  getIndikatorKriteria,
  getKriteriaDenganProgress,
  hitungProgresKeseluruhan,
  uploadDokumenKriteria,
  hapusFileDrive,
  isKriteriaTerlambat,
  kriteriaListToCsv
} = require('../../helpers/akreditasiHelper');

router.use(verifyToken);
router.use(isAdmin);

// ==========================================================================
// DASHBOARD - daftar periode & progres kriteria periode terpilih
// ==========================================================================
router.get('/', async (req, res) => {
  try {
    const periodeSnapshot = await db.collection('akreditasi_periode').orderBy('createdAt', 'desc').get();
    const periodeList = periodeSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const periodeId = req.query.periodeId || (periodeList[0] && periodeList[0].id) || null;
    let kriteriaList = [];
    let progresKeseluruhan = 0;
    let periodeAktif = null;

    if (periodeId) {
      periodeAktif = periodeList.find(p => p.id === periodeId) || null;
      kriteriaList = await getKriteriaDenganProgress(periodeId);
      kriteriaList = kriteriaList.map(k => ({ ...k, terlambat: isKriteriaTerlambat(k) }));
      progresKeseluruhan = hitungProgresKeseluruhan(kriteriaList);
    }

    res.render('admin/akreditasi/dashboard', {
      title: 'Akreditasi Program Studi',
      periodeList,
      periodeAktif,
      periodeId,
      kriteriaList,
      progresKeseluruhan
    });
  } catch (error) {
    console.error('Error memuat dashboard akreditasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data akreditasi' });
  }
});

// ==========================================================================
// PERIODE AKREDITASI
// ==========================================================================
router.get('/periode/baru', (req, res) => {
  res.render('admin/akreditasi/periode_form', { title: 'Tambah Periode Akreditasi', periode: null });
});

router.post('/periode', async (req, res) => {
  try {
    const { nama, jenjang, lembaga, tanggalTarget, status } = req.body;
    if (!nama) return res.status(400).send('Nama periode wajib diisi');

    const ref = await db.collection('akreditasi_periode').add({
      nama,
      jenjang: jenjang || 'D3 Vokasi',
      lembaga: lembaga || 'LAM Teknik',
      tanggalTarget: tanggalTarget || null,
      status: status || 'berjalan', // berjalan | selesai | draft
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Otomatis siapkan 9 kriteria standar sebagai titik awal
    await seedKriteriaUntukPeriode(ref.id);

    res.redirect(`/admin/akreditasi?periodeId=${ref.id}`);
  } catch (error) {
    console.error('Error membuat periode akreditasi:', error);
    res.status(500).send('Gagal membuat periode akreditasi');
  }
});

router.get('/periode/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('akreditasi_periode').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Periode tidak ditemukan');
    res.render('admin/akreditasi/periode_form', { title: 'Edit Periode Akreditasi', periode: { id: doc.id, ...doc.data() } });
  } catch (error) {
    console.error('Error memuat form edit periode:', error);
    res.status(500).send('Gagal memuat form');
  }
});

router.post('/periode/:id/edit', async (req, res) => {
  try {
    const { nama, jenjang, lembaga, tanggalTarget, status } = req.body;
    await db.collection('akreditasi_periode').doc(req.params.id).update({
      nama, jenjang, lembaga, tanggalTarget: tanggalTarget || null, status,
      updatedAt: new Date().toISOString()
    });
    res.redirect(`/admin/akreditasi?periodeId=${req.params.id}`);
  } catch (error) {
    console.error('Error mengupdate periode:', error);
    res.status(500).send('Gagal mengupdate periode');
  }
});

router.post('/periode/:id/delete', async (req, res) => {
  try {
    const periodeId = req.params.id;
    // Hapus kriteria, dokumen & diskusi terkait supaya tidak jadi data yatim
    const koleksiTerkait = ['akreditasi_kriteria', 'akreditasi_dokumen', 'akreditasi_diskusi', 'akreditasi_checklist'];
    for (const koleksi of koleksiTerkait) {
      const snap = await db.collection(koleksi).where('periodeId', '==', periodeId).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    }
    await db.collection('akreditasi_periode').doc(periodeId).delete();
    res.redirect('/admin/akreditasi');
  } catch (error) {
    console.error('Error menghapus periode:', error);
    res.status(500).send('Gagal menghapus periode akreditasi');
  }
});

// ==========================================================================
// KELOLA KRITERIA (tambah / edit / hapus) - 9 kriteria default bisa
// disesuaikan sepenuhnya di sini (nama, deskripsi, urutan, kode), termasuk
// menambah/menghapus kriteria kalau instrumen LAM Teknik yang dipakai
// berbeda jumlah/urutannya dari template awal.
// ==========================================================================
router.get('/periode/:periodeId/kriteria/baru', async (req, res) => {
  try {
    const periodeDoc = await db.collection('akreditasi_periode').doc(req.params.periodeId).get();
    if (!periodeDoc.exists) return res.status(404).send('Periode tidak ditemukan');
    res.render('admin/akreditasi/kriteria_form', {
      title: 'Tambah Kriteria',
      periode: { id: periodeDoc.id, ...periodeDoc.data() },
      kriteria: null
    });
  } catch (error) {
    console.error('Error memuat form tambah kriteria:', error);
    res.status(500).send('Gagal memuat form');
  }
});

router.post('/periode/:periodeId/kriteria', async (req, res) => {
  try {
    const { kode, nama, deskripsi, urutan, targetTanggal } = req.body;
    if (!kode || !nama) return res.status(400).send('Kode dan nama kriteria wajib diisi');

    const ref = await db.collection('akreditasi_kriteria').add({
      periodeId: req.params.periodeId,
      kode,
      nama,
      deskripsi: deskripsi || '',
      urutan: parseInt(urutan) || 999,
      status: 'belum',
      picDosenIds: [],
      targetTanggal: targetTanggal || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await seedChecklistUntukKriteria(req.params.periodeId, ref.id);

    res.redirect(`/admin/akreditasi?periodeId=${req.params.periodeId}`);
  } catch (error) {
    console.error('Error menambah kriteria:', error);
    res.status(500).send('Gagal menambah kriteria');
  }
});

router.get('/kriteria/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).send('Kriteria tidak ditemukan');
    const kriteria = { id: doc.id, ...doc.data() };
    const periodeDoc = await db.collection('akreditasi_periode').doc(kriteria.periodeId).get();
    res.render('admin/akreditasi/kriteria_form', {
      title: 'Edit Kriteria',
      periode: periodeDoc.exists ? { id: periodeDoc.id, ...periodeDoc.data() } : null,
      kriteria
    });
  } catch (error) {
    console.error('Error memuat form edit kriteria:', error);
    res.status(500).send('Gagal memuat form');
  }
});

router.post('/kriteria/:id/edit', async (req, res) => {
  try {
    const { kode, nama, deskripsi, urutan, targetTanggal } = req.body;
    await db.collection('akreditasi_kriteria').doc(req.params.id).update({
      kode, nama, deskripsi: deskripsi || '', urutan: parseInt(urutan) || 999,
      targetTanggal: targetTanggal || null,
      updatedAt: new Date().toISOString()
    });
    const doc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    res.redirect(`/admin/akreditasi?periodeId=${doc.data().periodeId}`);
  } catch (error) {
    console.error('Error mengubah kriteria:', error);
    res.status(500).send('Gagal mengubah kriteria');
  }
});

router.post('/kriteria/:id/delete', async (req, res) => {
  try {
    const ref = db.collection('akreditasi_kriteria').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Kriteria tidak ditemukan');
    const { periodeId } = doc.data();

    // Ikut hapus dokumen & diskusi yang menempel di kriteria ini supaya
    // tidak jadi data yatim yang tidak bisa diakses lagi dari UI manapun.
    for (const koleksi of ['akreditasi_dokumen', 'akreditasi_diskusi', 'akreditasi_checklist']) {
      const snap = await db.collection(koleksi).where('kriteriaId', '==', req.params.id).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    }
    await ref.delete();

    res.redirect(`/admin/akreditasi?periodeId=${periodeId}`);
  } catch (error) {
    console.error('Error menghapus kriteria:', error);
    res.status(500).send('Gagal menghapus kriteria');
  }
});

// ==========================================================================
// WORKSPACE PER KRITERIA (tempat pembahasan + pengumpulan dokumen)
// ==========================================================================
router.get('/kriteria/:id', async (req, res) => {
  try {
    const kriteriaDoc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    if (!kriteriaDoc.exists) return res.status(404).send('Kriteria tidak ditemukan');
    const kriteria = { id: kriteriaDoc.id, ...kriteriaDoc.data() };
    kriteria.terlambat = isKriteriaTerlambat(kriteria);

    const dosenSnapshot = await db.collection('dosen').orderBy('nama').get();
    const dosenList = dosenSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const dokSnapshot = await db.collection('akreditasi_dokumen')
      .where('kriteriaId', '==', kriteria.id).get();
    const dokumenList = dokSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const diskusiSnapshot = await db.collection('akreditasi_diskusi')
      .where('kriteriaId', '==', kriteria.id).get();
    const diskusiList = diskusiSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    const checklistSnapshot = await db.collection('akreditasi_checklist')
      .where('kriteriaId', '==', kriteria.id).get();
    const checklistList = checklistSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

    const indikatorList = await getIndikatorKriteria(kriteria.id);

    res.render('admin/akreditasi/workspace', {
      title: `Kriteria ${kriteria.kode} - ${kriteria.nama}`,
      kriteria,
      dosenList,
      dokumenList,
      diskusiList,
      checklistList,
      indikatorList,
      backUrl: `/admin/akreditasi?periodeId=${kriteria.periodeId}`
    });
  } catch (error) {
    console.error('Error memuat workspace kriteria:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat workspace kriteria' });
  }
});

router.post('/kriteria/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await db.collection('akreditasi_kriteria').doc(req.params.id).update({
      status, updatedAt: new Date().toISOString()
    });
    res.redirect(`/admin/akreditasi/kriteria/${req.params.id}`);
  } catch (error) {
    console.error('Error mengubah status kriteria:', error);
    res.status(500).send('Gagal mengubah status kriteria');
  }
});

router.post('/kriteria/:id/pic', async (req, res) => {
  try {
    let { picDosenIds } = req.body;
    if (!picDosenIds) picDosenIds = [];
    if (!Array.isArray(picDosenIds)) picDosenIds = [picDosenIds];
    await db.collection('akreditasi_kriteria').doc(req.params.id).update({
      picDosenIds, updatedAt: new Date().toISOString()
    });
    res.redirect(`/admin/akreditasi/kriteria/${req.params.id}`);
  } catch (error) {
    console.error('Error menetapkan PIC kriteria:', error);
    res.status(500).send('Gagal menetapkan dosen penanggung jawab');
  }
});

// -------- Dokumen --------
router.post('/kriteria/:id/dokumen', upload.single('file'), async (req, res) => {
  try {
    const kriteriaDoc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    if (!kriteriaDoc.exists) return res.status(404).send('Kriteria tidak ditemukan');
    const kriteria = kriteriaDoc.data();

    const { judul } = req.body;
    const file = req.file;
    if (!judul || !file) return res.status(400).send('Judul dokumen dan file wajib diisi');

    const uploaded = await uploadDokumenKriteria({
      periodeId: kriteria.periodeId,
      kodeKriteria: kriteria.kode,
      file
    });

    await db.collection('akreditasi_dokumen').add({
      periodeId: kriteria.periodeId,
      kriteriaId: req.params.id,
      judul,
      ...uploaded,
      uploadedBy: req.user.nama || req.user.email,
      uploadedByRole: 'admin',
      createdAt: new Date().toISOString()
    });

    res.redirect(`/admin/akreditasi/kriteria/${req.params.id}`);
  } catch (error) {
    console.error('Error mengunggah dokumen akreditasi:', error);
    res.status(500).send('Gagal mengunggah dokumen');
  }
});

router.post('/dokumen/:id/delete', async (req, res) => {
  try {
    const docRef = db.collection('akreditasi_dokumen').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).send('Dokumen tidak ditemukan');
    const { fileId, kriteriaId } = doc.data();
    await hapusFileDrive(fileId);
    await docRef.delete();
    res.redirect(`/admin/akreditasi/kriteria/${kriteriaId}`);
  } catch (error) {
    console.error('Error menghapus dokumen akreditasi:', error);
    res.status(500).send('Gagal menghapus dokumen');
  }
});

// -------- Diskusi (tempat pembahasan) --------
router.post('/kriteria/:id/diskusi', async (req, res) => {
  try {
    const { pesan } = req.body;
    if (!pesan || !pesan.trim()) return res.redirect(`/admin/akreditasi/kriteria/${req.params.id}`);

    const kriteriaDoc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    if (!kriteriaDoc.exists) return res.status(404).send('Kriteria tidak ditemukan');

    await db.collection('akreditasi_diskusi').add({
      periodeId: kriteriaDoc.data().periodeId,
      kriteriaId: req.params.id,
      userNama: req.user.nama || req.user.email,
      role: 'admin',
      pesan: pesan.trim(),
      createdAt: new Date().toISOString()
    });

    res.redirect(`/admin/akreditasi/kriteria/${req.params.id}#diskusi`);
  } catch (error) {
    console.error('Error mengirim diskusi akreditasi:', error);
    res.status(500).send('Gagal mengirim pembahasan');
  }
});

// -------- Checklist proses (kelengkapan penyusunan borang) --------
router.post('/kriteria/:id/checklist', async (req, res) => {
  try {
    const { item } = req.body;
    if (!item || !item.trim()) return res.redirect(`/admin/akreditasi/kriteria/${req.params.id}#checklist`);

    const kriteriaDoc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    if (!kriteriaDoc.exists) return res.status(404).send('Kriteria tidak ditemukan');

    const countSnap = await db.collection('akreditasi_checklist').where('kriteriaId', '==', req.params.id).get();

    await db.collection('akreditasi_checklist').add({
      periodeId: kriteriaDoc.data().periodeId,
      kriteriaId: req.params.id,
      item: item.trim(),
      urutan: countSnap.size + 1,
      selesai: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.redirect(`/admin/akreditasi/kriteria/${req.params.id}#checklist`);
  } catch (error) {
    console.error('Error menambah item checklist:', error);
    res.status(500).send('Gagal menambah item checklist');
  }
});

router.post('/checklist/:id/toggle', async (req, res) => {
  try {
    const ref = db.collection('akreditasi_checklist').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Item checklist tidak ditemukan');
    await ref.update({ selesai: !doc.data().selesai, updatedAt: new Date().toISOString() });
    res.redirect(`/admin/akreditasi/kriteria/${doc.data().kriteriaId}#checklist`);
  } catch (error) {
    console.error('Error mengubah status checklist:', error);
    res.status(500).send('Gagal mengubah status checklist');
  }
});

router.post('/checklist/:id/delete', async (req, res) => {
  try {
    const ref = db.collection('akreditasi_checklist').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Item checklist tidak ditemukan');
    const { kriteriaId } = doc.data();
    await ref.delete();
    res.redirect(`/admin/akreditasi/kriteria/${kriteriaId}#checklist`);
  } catch (error) {
    console.error('Error menghapus item checklist:', error);
    res.status(500).send('Gagal menghapus item checklist');
  }
});

// -------- Indikator LKPS (isian narasi sesuai instrumen resmi LAM Teknik) --------
router.post('/indikator/:id/jawaban', async (req, res) => {
  try {
    const { uraianJawaban, buktiSahihUrl } = req.body;
    const ref = db.collection('akreditasi_indikator').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Indikator tidak ditemukan');

    const isiJawaban = (uraianJawaban || '').trim();
    await ref.update({
      uraianJawaban: isiJawaban,
      buktiSahihUrl: (buktiSahihUrl || '').trim(),
      status: isiJawaban ? 'terisi' : 'belum',
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.nama || req.user.email
    });

    res.redirect(`/admin/akreditasi/kriteria/${doc.data().kriteriaId}#indikator-${req.params.id}`);
  } catch (error) {
    console.error('Error menyimpan jawaban indikator:', error);
    res.status(500).send('Gagal menyimpan jawaban indikator');
  }
});

// ==========================================================================
// REKAP / LAPORAN & EKSPOR
// ==========================================================================
router.get('/rekap', async (req, res) => {
  try {
    const periodeSnapshot = await db.collection('akreditasi_periode').orderBy('createdAt', 'desc').get();
    const periodeList = periodeSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const periodeId = req.query.periodeId || (periodeList[0] && periodeList[0].id) || null;

    let periodeAktif = null;
    let kriteriaList = [];
    let progresKeseluruhan = 0;

    if (periodeId) {
      periodeAktif = periodeList.find(p => p.id === periodeId) || null;
      kriteriaList = await getKriteriaDenganProgress(periodeId);
      kriteriaList = kriteriaList.map(k => ({ ...k, terlambat: isKriteriaTerlambat(k) }));
      progresKeseluruhan = hitungProgresKeseluruhan(kriteriaList);
    }

    res.render('admin/akreditasi/rekap', {
      title: 'Rekap & Laporan Akreditasi',
      periodeList,
      periodeAktif,
      periodeId,
      kriteriaList,
      progresKeseluruhan,
      tanggalCetak: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    });
  } catch (error) {
    console.error('Error memuat rekap akreditasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat rekap akreditasi' });
  }
});

router.get('/rekap/export', async (req, res) => {
  try {
    const periodeId = req.query.periodeId;
    if (!periodeId) return res.status(400).send('periodeId wajib diisi');

    const periodeDoc = await db.collection('akreditasi_periode').doc(periodeId).get();
    if (!periodeDoc.exists) return res.status(404).send('Periode tidak ditemukan');

    const kriteriaList = await getKriteriaDenganProgress(periodeId);
    const csv = kriteriaListToCsv(kriteriaList, periodeDoc.data().nama);

    const namaFile = `rekap-akreditasi-${periodeDoc.data().nama}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}.csv"`);
    // BOM supaya karakter & dibuka dengan benar di Excel
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Error mengekspor rekap akreditasi:', error);
    res.status(500).send('Gagal mengekspor rekap akreditasi');
  }
});

module.exports = router;
