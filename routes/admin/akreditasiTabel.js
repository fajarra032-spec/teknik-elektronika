// routes/admin/akreditasiTabel.js
//
// CRUD generik untuk 7 "Tabel" data pendukung LKPS LAM Teknik (Tabel 1-7),
// mengikuti kolom asli dari file Excel LKPS yang diberikan pengguna (lihat
// helpers/lkpsTabelConfig.js). Satu router generik dipakai untuk Tabel 1-6
// (semuanya berupa daftar baris yang bisa ditambah/diedit/dihapus bebas);
// Tabel 7 (Masa Studi Lulusan) ditangani terpisah karena strukturnya tetap
// 2 baris (kohort TS-1 dan TS), bukan daftar bebas.

const express = require('express');
const router = express.Router();

const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getTabelConfig, getSemuaTabelConfig, TABEL7_CONFIG } = require('../../helpers/lkpsTabelConfig');

router.use(verifyToken);
router.use(isAdmin);

/** Ubah body form mentah jadi objek data sesuai tipe kolom di konfigurasi. */
function parseBodySesuaiKolom(kolomList, body) {
  const data = {};
  kolomList.forEach(k => {
    const raw = body[k.key];
    if (k.type === 'checkbox') {
      data[k.key] = raw === 'on' || raw === 'true' || raw === true;
    } else if (k.type === 'number') {
      data[k.key] = raw === undefined || raw === '' ? null : Number(raw);
    } else {
      data[k.key] = (raw || '').toString().trim();
    }
  });
  return data;
}

// ==========================================================================
// HALAMAN INDEKS - daftar 7 tabel + jumlah baris masing-masing per periode
// ==========================================================================
router.get('/', async (req, res) => {
  try {
    const periodeSnapshot = await db.collection('akreditasi_periode').orderBy('createdAt', 'desc').get();
    const periodeList = periodeSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    const periodeId = req.query.periodeId || (periodeList[0] && periodeList[0].id) || null;

    const semuaTabel = getSemuaTabelConfig();
    const tabelDenganJumlah = [];
    if (periodeId) {
      for (const t of semuaTabel) {
        const snap = await db.collection(t.collection).where('periodeId', '==', periodeId).get();
        tabelDenganJumlah.push({ ...t, jumlahBaris: snap.size });
      }
      const tabel7Doc = await db.collection(TABEL7_CONFIG.collection).where('periodeId', '==', periodeId).get();
      tabelDenganJumlah.push({ ...TABEL7_CONFIG, jumlahBaris: tabel7Doc.size });
    }

    res.render('admin/akreditasi/tabel_index', {
      title: 'Tabel Data Pendukung LKPS',
      periodeList,
      periodeId,
      tabelList: tabelDenganJumlah
    });
  } catch (error) {
    console.error('Error memuat indeks tabel LKPS:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data tabel LKPS' });
  }
});

// ==========================================================================
// TABEL 7 - Masa Studi Lulusan (fixed 2 baris: TS-1, TS)
// ==========================================================================
router.get('/tabel7', async (req, res) => {
  try {
    const periodeId = req.query.periodeId;
    if (!periodeId) return res.redirect('/admin/akreditasi/tabel');

    const dataPerBaris = {};
    for (const namaBaris of TABEL7_CONFIG.baris) {
      const docId = `${periodeId}_${namaBaris}`;
      const doc = await db.collection(TABEL7_CONFIG.collection).doc(docId).get();
      dataPerBaris[namaBaris] = doc.exists ? doc.data() : {};
    }

    res.render('admin/akreditasi/tabel7', {
      title: TABEL7_CONFIG.judul,
      config: TABEL7_CONFIG,
      periodeId,
      dataPerBaris
    });
  } catch (error) {
    console.error('Error memuat Tabel 7:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat Tabel 7' });
  }
});

router.post('/tabel7', async (req, res) => {
  try {
    const { periodeId } = req.body;
    if (!periodeId) return res.status(400).send('periodeId wajib diisi');

    const batch = db.batch();
    TABEL7_CONFIG.baris.forEach(namaBaris => {
      const nested = req.body[namaBaris] || {};
      const data = parseBodySesuaiKolom(TABEL7_CONFIG.kolom, nested);
      const docId = `${periodeId}_${namaBaris}`;
      const ref = db.collection(TABEL7_CONFIG.collection).doc(docId);
      batch.set(ref, { periodeId, tahunMasuk: namaBaris, ...data, updatedAt: new Date().toISOString() }, { merge: true });
    });
    await batch.commit();

    res.redirect(`/admin/akreditasi/tabel/tabel7?periodeId=${periodeId}`);
  } catch (error) {
    console.error('Error menyimpan Tabel 7:', error);
    res.status(500).send('Gagal menyimpan Tabel 7');
  }
});

// ==========================================================================
// TABEL 1-6 - daftar baris bebas (tambah/edit/hapus)
// ==========================================================================
router.get('/:tableKey', async (req, res) => {
  try {
    const config = getTabelConfig(req.params.tableKey);
    if (!config) return res.status(404).send('Tabel tidak dikenal');

    const periodeId = req.query.periodeId;
    let baris = [];
    if (periodeId) {
      const snap = await db.collection(config.collection).where('periodeId', '==', periodeId).get();
      baris = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    }

    let editRow = null;
    if (req.query.editId) {
      const found = baris.find(b => b.id === req.query.editId);
      if (found) editRow = found;
    }

    res.render('admin/akreditasi/tabel', {
      title: config.judul,
      config,
      periodeId: periodeId || '',
      baris,
      editRow
    });
  } catch (error) {
    console.error('Error memuat tabel LKPS:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat tabel' });
  }
});

router.post('/:tableKey', async (req, res) => {
  try {
    const config = getTabelConfig(req.params.tableKey);
    if (!config) return res.status(404).send('Tabel tidak dikenal');

    const { periodeId } = req.body;
    if (!periodeId) return res.status(400).send('periodeId wajib diisi');

    const data = parseBodySesuaiKolom(config.kolom, req.body);
    await db.collection(config.collection).add({
      periodeId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    res.redirect(`/admin/akreditasi/tabel/${config.key}?periodeId=${periodeId}`);
  } catch (error) {
    console.error('Error menambah baris tabel LKPS:', error);
    res.status(500).send('Gagal menambah baris');
  }
});

router.post('/:tableKey/:rowId/edit', async (req, res) => {
  try {
    const config = getTabelConfig(req.params.tableKey);
    if (!config) return res.status(404).send('Tabel tidak dikenal');

    const { periodeId } = req.body;
    const data = parseBodySesuaiKolom(config.kolom, req.body);
    await db.collection(config.collection).doc(req.params.rowId).update({
      ...data,
      updatedAt: new Date().toISOString()
    });

    res.redirect(`/admin/akreditasi/tabel/${config.key}?periodeId=${periodeId}`);
  } catch (error) {
    console.error('Error mengubah baris tabel LKPS:', error);
    res.status(500).send('Gagal mengubah baris');
  }
});

router.post('/:tableKey/:rowId/delete', async (req, res) => {
  try {
    const config = getTabelConfig(req.params.tableKey);
    if (!config) return res.status(404).send('Tabel tidak dikenal');

    const { periodeId } = req.body;
    await db.collection(config.collection).doc(req.params.rowId).delete();

    res.redirect(`/admin/akreditasi/tabel/${config.key}?periodeId=${periodeId}`);
  } catch (error) {
    console.error('Error menghapus baris tabel LKPS:', error);
    res.status(500).send('Gagal menghapus baris');
  }
});

module.exports = router;
