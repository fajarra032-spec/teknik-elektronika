const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { generatePeriodeOptions, getActivePeriodeId } = require('../../helpers/academicHelper');

router.use(verifyToken);
router.use(isAdmin);

/**
 * GET /admin/rps
 * Menampilkan daftar semua mata kuliah yang memiliki RPS (rpsUrl tidak null)
 * Atau semua mata kuliah dengan informasi apakah sudah upload RPS
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const periodeOptions = generatePeriodeOptions(8, 0);
    const aktifId = await getActivePeriodeId();
    const periodeId = periodeOptions.some(o => o.id === req.query.periode) ? req.query.periode : aktifId;
    const isAktif = periodeId === aktifId;
    const opsi = periodeOptions.find(o => o.id === periodeId);
    const labelPeriode = opsi ? opsi.label : periodeId;

    const [mkSnapshot, dosenSnap] = await Promise.all([
      db.collection('mataKuliah').get(),
      db.collection('dosen').get()
    ]);
    const namaDosen = {};
    dosenSnap.docs.forEach(d => { namaDosen[d.id] = d.data().nama; });

    // Per MK: pengampu & RPS khusus periode terpilih (bukan field rpsUrl lama, agar semester tidak bercampur)
    const mkList = (await Promise.all(mkSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      const [pSnap, rSnap] = await Promise.all([
        doc.ref.collection('pengampuPeriode').doc(periodeId).get(),
        doc.ref.collection('rpsPeriode').doc(periodeId).get()
      ]);
      let ids = pSnap.exists ? (pSnap.data().dosenIds || []) : [];
      if (!pSnap.exists && isAktif && data.periodeAktifId === periodeId) ids = data.dosenIds || [];
      const rpsUrl = rSnap.exists ? (rSnap.data().fileUrl || null) : null;
      if (!ids.length && !pSnap.exists && !rpsUrl) return null; // MK tidak diampu pada periode ini
      return {
        id: doc.id,
        kode: data.kode || '',
        nama: data.nama || '',
        semester: data.semester,
        sks: data.sks,
        rpsUrl,
        dosen: ids.map(i => namaDosen[i]).filter(Boolean).join(', ') || '-',
        updatedAt: rSnap.exists ? (rSnap.data().uploadedAt || null) : null
      };
    }))).filter(Boolean);

    let filteredList = mkList;
    if (search) {
      const q = search.toLowerCase();
      filteredList = mkList.filter(mk =>
        mk.kode.toLowerCase().includes(q) || mk.nama.toLowerCase().includes(q) || mk.dosen.toLowerCase().includes(q));
    }
    filteredList.sort((a, b) => {
      if (a.rpsUrl && !b.rpsUrl) return -1;
      if (!a.rpsUrl && b.rpsUrl) return 1;
      return a.kode.localeCompare(b.kode);
    });

    res.render('admin/rps/index', {
      title: 'Daftar RPS Mata Kuliah',
      mkList: filteredList,
      search: search || '',
      periodeOptions, periodeId, labelPeriode, isAktif
    });
  } catch (error) {
    console.error('Error loading admin RPS list:', error);
    res.status(500).render('error', { message: 'Gagal memuat data RPS' });
  }
});

// Optional: route untuk melihat detail RPS (hanya preview PDF via link yang sudah ada)
// Tidak perlu route khusus karena rpsUrl langsung diarahkan ke Google Drive.

module.exports = router;