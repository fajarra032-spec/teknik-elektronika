// routes/dosen/akreditasiRoute.js
//
// Fitur Akreditasi Program Studi untuk DOSEN:
// - Melihat daftar kriteria akreditasi periode berjalan (dengan penanda
//   kriteria yang dirinya jadi penanggung jawab/PIC)
// - Masuk ke workspace tiap kriteria: ikut diskusi/pembahasan & mengunggah
//   dokumen pendukung (tidak bisa mengubah status/menetapkan PIC - itu
//   kewenangan admin)
//
// Catatan nama file: memakai "akreditasiRoute.js" (bukan "akreditasi.js")
// supaya tidak bentrok dengan folder views/dosen/akreditasi/.

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const {
  getKriteriaDenganProgress,
  hitungProgresKeseluruhan,
  uploadDokumenKriteria,
  isKriteriaTerlambat,
  getIndikatorKriteria
} = require('../../helpers/akreditasiHelper');

router.use(verifyToken);
router.use(isDosen);

async function getPeriodeBerjalanTerbaru() {
  const snapshot = await db.collection('akreditasi_periode')
    .where('status', '==', 'berjalan')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

// ==========================================================================
// DAFTAR KRITERIA (dashboard dosen)
// ==========================================================================
router.get('/', async (req, res) => {
  try {
    const periode = await getPeriodeBerjalanTerbaru();
    let kriteriaList = [];
    let progresKeseluruhan = 0;

    if (periode) {
      kriteriaList = await getKriteriaDenganProgress(periode.id);
      progresKeseluruhan = hitungProgresKeseluruhan(kriteriaList);
      kriteriaList = kriteriaList.map(k => ({
        ...k,
        sayaPic: Array.isArray(k.picDosenIds) && k.picDosenIds.includes(req.dosen.id),
        terlambat: isKriteriaTerlambat(k)
      }));
    }

    res.render('dosen/akreditasi/list', {
      title: 'Akreditasi Program Studi',
      periode,
      kriteriaList,
      progresKeseluruhan
    });
  } catch (error) {
    console.error('Error memuat daftar kriteria akreditasi (dosen):', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data akreditasi' });
  }
});

// ==========================================================================
// WORKSPACE PER KRITERIA
// ==========================================================================
router.get('/kriteria/:id', async (req, res) => {
  try {
    const kriteriaDoc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    if (!kriteriaDoc.exists) return res.status(404).send('Kriteria tidak ditemukan');
    const kriteria = { id: kriteriaDoc.id, ...kriteriaDoc.data() };
    kriteria.terlambat = isKriteriaTerlambat(kriteria);

    let picNamaList = [];
    if (Array.isArray(kriteria.picDosenIds) && kriteria.picDosenIds.length) {
      const picDocs = await Promise.all(kriteria.picDosenIds.map(id => db.collection('dosen').doc(id).get()));
      picNamaList = picDocs.filter(d => d.exists).map(d => d.data().nama);
    }

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

    res.render('dosen/akreditasi/workspace', {
      title: `Kriteria ${kriteria.kode} - ${kriteria.nama}`,
      kriteria,
      picNamaList,
      dokumenList,
      diskusiList,
      checklistList,
      indikatorList
    });
  } catch (error) {
    console.error('Error memuat workspace kriteria (dosen):', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat workspace kriteria' });
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
      uploadedBy: req.dosen.nama,
      uploadedByRole: 'dosen',
      createdAt: new Date().toISOString()
    });

    res.redirect(`/dosen/akreditasi/kriteria/${req.params.id}`);
  } catch (error) {
    console.error('Error mengunggah dokumen akreditasi (dosen):', error);
    res.status(500).send('Gagal mengunggah dokumen');
  }
});

// -------- Diskusi (tempat pembahasan) --------
router.post('/kriteria/:id/diskusi', async (req, res) => {
  try {
    const { pesan } = req.body;
    if (!pesan || !pesan.trim()) return res.redirect(`/dosen/akreditasi/kriteria/${req.params.id}`);

    const kriteriaDoc = await db.collection('akreditasi_kriteria').doc(req.params.id).get();
    if (!kriteriaDoc.exists) return res.status(404).send('Kriteria tidak ditemukan');

    await db.collection('akreditasi_diskusi').add({
      periodeId: kriteriaDoc.data().periodeId,
      kriteriaId: req.params.id,
      userNama: req.dosen.nama,
      role: 'dosen',
      pesan: pesan.trim(),
      createdAt: new Date().toISOString()
    });

    res.redirect(`/dosen/akreditasi/kriteria/${req.params.id}#diskusi`);
  } catch (error) {
    console.error('Error mengirim diskusi akreditasi (dosen):', error);
    res.status(500).send('Gagal mengirim pembahasan');
  }
});

// -------- Indikator LKPS (dosen ikut menulis narasi jawaban) --------
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
      updatedBy: req.dosen.nama
    });

    res.redirect(`/dosen/akreditasi/kriteria/${doc.data().kriteriaId}#indikator-${req.params.id}`);
  } catch (error) {
    console.error('Error menyimpan jawaban indikator (dosen):', error);
    res.status(500).send('Gagal menyimpan jawaban indikator');
  }
});

// -------- Checklist proses (dosen bisa centang selesai/belum) --------
router.post('/checklist/:id/toggle', async (req, res) => {
  try {
    const ref = db.collection('akreditasi_checklist').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).send('Item checklist tidak ditemukan');
    await ref.update({ selesai: !doc.data().selesai, updatedAt: new Date().toISOString() });
    res.redirect(`/dosen/akreditasi/kriteria/${doc.data().kriteriaId}#checklist`);
  } catch (error) {
    console.error('Error mengubah status checklist (dosen):', error);
    res.status(500).send('Gagal mengubah status checklist');
  }
});

module.exports = router;
