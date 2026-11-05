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
const {
  ambilKuisionerMap, ambilResponPeriode, hitungRekapPeriode, hitungDetailDosen
} = require('../../helpers/edomRekapHelper');

async function ambilPeriode() {
  const snap = await db.collection('edom_periode').orderBy('tanggalMulai', 'desc').get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

router.get('/rekap', async (req, res) => {
  try {
    const { urut = 'nama' } = req.query;
    const periods = await ambilPeriode();
    // Saat pertama masuk: otomatis tampilkan periode aktif (atau periode terbaru)
    const periodeId = req.query.periodeId || ((periods.find(p => p.status === 'active') || periods[0] || {}).id);
    let rekap = null;
    if (periodeId) {
      const [responList, kuisMap] = await Promise.all([ambilResponPeriode(periodeId), ambilKuisionerMap()]);
      rekap = hitungRekapPeriode(responList, kuisMap);
      if (urut === 'tertinggi') rekap.dosen.sort((a, b) => b.rata - a.rata);
      else if (urut === 'terendah') rekap.dosen.sort((a, b) => a.rata - b.rata);
      else rekap.dosen.sort((a, b) => a.dosenNama.localeCompare(b.dosenNama));
    }
    const message = getMessage(req);
    res.render('admin/edom/rekap', {
      title: 'Rekap EDOM', periods, selectedPeriod: periodeId, selectedPeriodData: periods.find(p => p.id === periodeId) || null,
      rekap, urut, message
    });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat rekap');
    res.redirect('/admin/edom');
  }
});

// Detail hasil satu dosen (anonim: nama mahasiswa tidak ditampilkan)
router.get('/rekap/:periodeId/dosen/:dosenId', async (req, res) => {
  try {
    const { periodeId, dosenId } = req.params;
    const [responList, kuisMap, periodDoc] = await Promise.all([
      ambilResponPeriode(periodeId), ambilKuisionerMap(), db.collection('edom_periode').doc(periodeId).get()
    ]);
    const detail = hitungDetailDosen(responList, kuisMap, dosenId);
    if (!detail) {
      setMessage(req, 'error', 'Belum ada respon untuk dosen ini pada periode tersebut');
      return res.redirect(`/admin/edom/rekap?periodeId=${periodeId}`);
    }
    const message = getMessage(req);
    res.render('admin/edom/rekap_dosen', {
      title: `Hasil EDOM - ${detail.dosenNama}`, periodeId,
      periode: periodDoc.exists ? { id: periodDoc.id, ...periodDoc.data() } : { id: periodeId, nama: periodeId, semester: '' },
      detail, message
    });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat detail hasil dosen');
    res.redirect(`/admin/edom/rekap?periodeId=${req.params.periodeId}`);
  }
});

// Halaman cetak resmi (A4 landscape, tanpa navbar/footer web)
router.get('/rekap/:periodeId/cetak', async (req, res) => {
  try {
    const { periodeId } = req.params;
    const { urut = 'nama' } = req.query;
    const [responList, kuisMap, periodDoc] = await Promise.all([
      ambilResponPeriode(periodeId), ambilKuisionerMap(), db.collection('edom_periode').doc(periodeId).get()
    ]);
    if (!periodDoc.exists || responList.length === 0) {
      setMessage(req, 'error', 'Belum ada data untuk dicetak pada periode ini');
      return res.redirect(`/admin/edom/rekap?periodeId=${periodeId}`);
    }
    const rekap = hitungRekapPeriode(responList, kuisMap);
    if (urut === 'tertinggi') rekap.dosen.sort((a, b) => b.rata - a.rata);
    else if (urut === 'terendah') rekap.dosen.sort((a, b) => a.rata - b.rata);
    else rekap.dosen.sort((a, b) => a.dosenNama.localeCompare(b.dosenNama));
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    res.render('admin/edom/rekap_cetak', {
      title: 'Rekap EDOM - ' + (periodDoc.data().nama || periodeId),
      periode: { id: periodDoc.id, ...periodDoc.data() }, rekap, tanggalCetak,
      urlKembali: `/admin/edom/rekap?periodeId=${periodeId}&urut=${urut}`
    });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat halaman cetak');
    res.redirect(`/admin/edom/rekap?periodeId=${req.params.periodeId}`);
  }
});

// Ekspor CSV (dibuka di Excel): satu baris per dosen
router.get('/rekap/:periodeId/export.csv', async (req, res) => {
  try {
    const { periodeId } = req.params;
    const [responList, kuisMap] = await Promise.all([ambilResponPeriode(periodeId), ambilKuisionerMap()]);
    const rekap = hitungRekapPeriode(responList, kuisMap);
    rekap.dosen.sort((a, b) => a.dosenNama.localeCompare(b.dosenNama));
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const kolom = ['No', 'Dosen', 'Jumlah MK', 'Jumlah Respon', 'Rata-rata', 'Predikat', ...rekap.indikatorAda, ...rekap.pertanyaan.map(p => 'P' + p.no)];
    const baris = rekap.dosen.map((d, i) => [
      i + 1, d.dosenNama, d.jumlahMk, d.count, d.rataTeks.replace('.', ','), d.pred.label,
      ...rekap.indikatorAda.map(n => { const x = d.indikator.find(k => k.nama === n); return x ? x.rata.toFixed(2).replace('.', ',') : ''; }),
      ...d.nilai.map(v => v ? v.teks.replace('.', ',') : '')
    ]);
    const csv = '\uFEFF' + [kolom, ...baris].map(r => r.map(esc).join(';')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rekap_edom_${periodeId}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal mengekspor rekap');
    res.redirect(`/admin/edom/rekap?periodeId=${req.params.periodeId}`);
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