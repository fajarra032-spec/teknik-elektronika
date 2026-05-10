const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');

// Semua route memerlukan auth dan admin
router.use(verifyToken);
router.use(isAdmin);

// Helper untuk menyimpan pesan ke session
function setMessage(req, type, text) {
  req.session.message = { type, text };
}

// Helper untuk mengambil dan menghapus pesan dari session
function getMessage(req) {
  const msg = req.session.message;
  delete req.session.message;
  return msg || null;
}

// ==================== HALAMAN UTAMA ====================
router.get('/', (req, res) => {
  const message = getMessage(req);
  res.render('admin/edom/index', { title: 'EDOM - Admin', message });
});

// ==================== PERIODE ====================
router.get('/periods', async (req, res) => {
  try {
    const snapshot = await db.collection('edom_periode').orderBy('tanggalMulai', 'desc').get();
    const periods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const message = getMessage(req);
    res.render('admin/edom/periods', { title: 'Kelola Periode EDOM', periods, message });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat data periode');
    res.redirect('/admin/edom');
  }
});

router.get('/periods/create', (req, res) => {
  const defaultSemester = getCurrentAcademicSemester().label;
  const message = getMessage(req);
  res.render('admin/edom/period_form', { title: 'Tambah Periode', period: null, defaultSemester, message });
});

router.post('/periods', async (req, res) => {
  try {
    const { nama, tanggalMulai, tanggalSelesai, semester, status } = req.body;
    if (!nama || !tanggalMulai || !tanggalSelesai || !semester) {
      setMessage(req, 'error', 'Semua field wajib diisi');
      return res.redirect('/admin/edom/periods');
    }
    if (new Date(tanggalMulai) > new Date(tanggalSelesai)) {
      setMessage(req, 'error', 'Tanggal mulai tidak boleh setelah tanggal selesai');
      return res.redirect('/admin/edom/periods');
    }
    let finalStatus = status || 'active';
    if (finalStatus === 'active') {
      const activeSnapshot = await db.collection('edom_periode').where('status', '==', 'active').get();
      const batch = db.batch();
      activeSnapshot.forEach(doc => {
        batch.update(doc.ref, { status: 'closed', updatedAt: new Date().toISOString() });
      });
      await batch.commit();
    }
    await db.collection('edom_periode').add({
      nama, tanggalMulai, tanggalSelesai, semester,
      status: finalStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setMessage(req, 'success', 'Periode berhasil ditambahkan');
    res.redirect('/admin/edom/periods');
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal menambah periode');
    res.redirect('/admin/edom/periods');
  }
});

router.get('/periods/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('edom_periode').doc(req.params.id).get();
    if (!doc.exists) {
      setMessage(req, 'error', 'Periode tidak ditemukan');
      return res.redirect('/admin/edom/periods');
    }
    const message = getMessage(req);
    res.render('admin/edom/period_form', { title: 'Edit Periode', period: { id: doc.id, ...doc.data() }, defaultSemester: null, message });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat data periode');
    res.redirect('/admin/edom/periods');
  }
});

router.post('/periods/:id/edit', async (req, res) => {
  try {
    const { nama, tanggalMulai, tanggalSelesai, semester, status } = req.body;
    if (!nama || !tanggalMulai || !tanggalSelesai || !semester) {
      setMessage(req, 'error', 'Semua field wajib diisi');
      return res.redirect(`/admin/edom/periods/${req.params.id}/edit`);
    }
    if (new Date(tanggalMulai) > new Date(tanggalSelesai)) {
      setMessage(req, 'error', 'Tanggal mulai tidak boleh setelah tanggal selesai');
      return res.redirect(`/admin/edom/periods/${req.params.id}/edit`);
    }
    if (status === 'active') {
      const activeSnapshot = await db.collection('edom_periode').where('status', '==', 'active').get();
      const batch = db.batch();
      activeSnapshot.forEach(doc => {
        if (doc.id !== req.params.id) {
          batch.update(doc.ref, { status: 'closed', updatedAt: new Date().toISOString() });
        }
      });
      await batch.commit();
    }
    await db.collection('edom_periode').doc(req.params.id).update({
      nama, tanggalMulai, tanggalSelesai, semester, status,
      updatedAt: new Date().toISOString()
    });
    setMessage(req, 'success', 'Periode berhasil diupdate');
    res.redirect('/admin/edom/periods');
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal mengupdate periode');
    res.redirect(`/admin/edom/periods/${req.params.id}/edit`);
  }
});

router.post('/periods/:id/delete', async (req, res) => {
  try {
    const periodeId = req.params.id;
    const responSnapshot = await db.collection('edom_respon').where('periodeId', '==', periodeId).get();
    const batch = db.batch();
    responSnapshot.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('edom_periode').doc(periodeId));
    await batch.commit();
    setMessage(req, 'success', 'Periode dan semua data respon berhasil dihapus');
    res.redirect('/admin/edom/periods');
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal menghapus periode');
    res.redirect('/admin/edom/periods');
  }
});

// ==================== KUISIONER ====================
router.get('/questions', async (req, res) => {
  try {
    const snapshot = await db.collection('edom_kuisioner').orderBy('urutan', 'asc').get();
    const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const message = getMessage(req);
    res.render('admin/edom/questions', { title: 'Kelola Kuisioner EDOM', questions, message });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat pertanyaan');
    res.redirect('/admin/edom');
  }
});

router.get('/questions/create', (req, res) => {
  const message = getMessage(req);
  res.render('admin/edom/question_form', { title: 'Tambah Pertanyaan', question: null, message });
});

router.post('/questions', async (req, res) => {
  try {
    let { pertanyaan, tipe, skala, bobot, urutan, aktif } = req.body;
    if (!pertanyaan) {
      setMessage(req, 'error', 'Pertanyaan wajib diisi');
      return res.redirect('/admin/edom/questions/create');
    }
    if (tipe === 'rating') {
      skala = parseInt(skala) || 5;
      bobot = parseFloat(bobot) || 1;
      if (skala < 1 || skala > 10) skala = 5;
      if (bobot < 0) bobot = 1;
    } else {
      skala = null;
      bobot = null;
    }
    await db.collection('edom_kuisioner').add({
      pertanyaan,
      tipe: tipe || 'rating',
      skala,
      bobot,
      urutan: parseInt(urutan) || 0,
      aktif: aktif === 'on',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setMessage(req, 'success', 'Pertanyaan berhasil ditambahkan');
    res.redirect('/admin/edom/questions');
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal menambah pertanyaan');
    res.redirect('/admin/edom/questions/create');
  }
});

router.get('/questions/:id/edit', async (req, res) => {
  try {
    const doc = await db.collection('edom_kuisioner').doc(req.params.id).get();
    if (!doc.exists) {
      setMessage(req, 'error', 'Pertanyaan tidak ditemukan');
      return res.redirect('/admin/edom/questions');
    }
    const message = getMessage(req);
    res.render('admin/edom/question_form', { title: 'Edit Pertanyaan', question: { id: doc.id, ...doc.data() }, message });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat pertanyaan');
    res.redirect('/admin/edom/questions');
  }
});

router.post('/questions/:id/edit', async (req, res) => {
  try {
    let { pertanyaan, tipe, skala, bobot, urutan, aktif } = req.body;
    if (!pertanyaan) {
      setMessage(req, 'error', 'Pertanyaan wajib diisi');
      return res.redirect(`/admin/edom/questions/${req.params.id}/edit`);
    }
    if (tipe === 'rating') {
      skala = parseInt(skala) || 5;
      bobot = parseFloat(bobot) || 1;
      if (skala < 1 || skala > 10) skala = 5;
      if (bobot < 0) bobot = 1;
    } else {
      skala = null;
      bobot = null;
    }
    await db.collection('edom_kuisioner').doc(req.params.id).update({
      pertanyaan, tipe, skala, bobot,
      urutan: parseInt(urutan) || 0,
      aktif: aktif === 'on',
      updatedAt: new Date().toISOString()
    });
    setMessage(req, 'success', 'Pertanyaan berhasil diupdate');
    res.redirect('/admin/edom/questions');
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal mengupdate pertanyaan');
    res.redirect(`/admin/edom/questions/${req.params.id}/edit`);
  }
});

router.post('/questions/:id/delete', async (req, res) => {
  try {
    await db.collection('edom_kuisioner').doc(req.params.id).delete();
    setMessage(req, 'success', 'Pertanyaan berhasil dihapus');
    res.redirect('/admin/edom/questions');
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal menghapus pertanyaan');
    res.redirect('/admin/edom/questions');
  }
});

// ==================== REKAP HASIL ====================
router.get('/rekap', async (req, res) => {
  try {
    const { periodeId } = req.query;
    const periodsSnap = await db.collection('edom_periode').orderBy('tanggalMulai', 'desc').get();
    const periods = periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    let results = [];
    if (periodeId) {
      const responSnap = await db.collection('edom_respon').where('periodeId', '==', periodeId).get();
      const dosenMap = new Map();
      for (const doc of responSnap.docs) {
        const data = doc.data();
        if (!dosenMap.has(data.dosenId)) {
          dosenMap.set(data.dosenId, {
            dosenId: data.dosenId,
            dosenNama: data.dosenNama,
            totalNilai: 0,
            count: 0,
            mkSet: new Set()
          });
        }
        const entry = dosenMap.get(data.dosenId);
        entry.totalNilai += data.nilaiRata;
        entry.count++;
        entry.mkSet.add(data.mkId);
      }
      results = Array.from(dosenMap.values()).map(r => ({
        ...r,
        average: r.count ? (r.totalNilai / r.count).toFixed(2) : 0,
        jumlahMk: r.mkSet.size
      }));
    }
    const message = getMessage(req);
    res.render('admin/edom/rekap', { title: 'Rekap EDOM', periods, selectedPeriod: periodeId, results, message });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat rekap');
    res.redirect('/admin/edom');
  }
});

router.post('/rekap/:periodeId/delete-all', async (req, res) => {
  try {
    const periodeId = req.params.periodeId;
    const snapshot = await db.collection('edom_respon').where('periodeId', '==', periodeId).get();
    if (snapshot.empty) {
      setMessage(req, 'info', 'Tidak ada respon untuk periode ini');
      return res.redirect(`/admin/edom/rekap?periodeId=${periodeId}`);
    }
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    setMessage(req, 'success', `Semua respon periode berhasil dihapus (${snapshot.size} dokumen)`);
    res.redirect(`/admin/edom/rekap?periodeId=${periodeId}`);
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal menghapus respon periode');
    res.redirect(`/admin/edom/rekap?periodeId=${req.params.periodeId}`);
  }
});

router.post('/rekap/:periodeId/delete-dosen/:dosenId', async (req, res) => {
  try {
    const { periodeId, dosenId } = req.params;
    const snapshot = await db.collection('edom_respon')
      .where('periodeId', '==', periodeId)
      .where('dosenId', '==', dosenId)
      .get();
    if (snapshot.empty) {
      setMessage(req, 'info', 'Tidak ada respon untuk dosen ini pada periode tersebut');
      return res.redirect(`/admin/edom/rekap?periodeId=${periodeId}`);
    }
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    setMessage(req, 'success', `Respon untuk dosen berhasil dihapus (${snapshot.size} dokumen)`);
    res.redirect(`/admin/edom/rekap?periodeId=${periodeId}`);
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal menghapus respon dosen');
    res.redirect(`/admin/edom/rekap?periodeId=${req.params.periodeId}`);
  }
});

module.exports = router;