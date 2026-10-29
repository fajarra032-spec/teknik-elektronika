/**
 * routes/admin/pengajaran.js
 * Admin memantau progres perkuliahan setiap mata kuliah
 * Melihat materi yang telah diupload dosen dan progress pertemuan
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getRencanaPertemuan, getInfoRencana } = require('../../data/rencanaPertemuanData');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/**
 * Menghitung progress pertemuan suatu MK dari array materi
 */
function hitungProgress(materi) {
  if (!materi || !Array.isArray(materi)) {
    return { total: 16, terlaksana: 0, persentase: 0 };
  }
  const total = 16; // standar 16 pertemuan
  const terlaksana = materi.filter(m => m.status === 'selesai').length;
  const persentase = Math.round((terlaksana / total) * 100);
  return { total, terlaksana, persentase };
}

// ----------------------------------------------------------------------------
// FILTER SEMESTER (aktif / semua / angka)
// ----------------------------------------------------------------------------
/**
 * Nilai query ?semester=
 *   (tidak ada) atau 'aktif' -> semester aktif: Ganjil = semester 1,3,5 ; Genap = 2,4,6
 *   '' atau 'semua'          -> semua semester
 *   angka                    -> satu semester tertentu
 * Periode Ganjil/Genap mengikuti aturan aplikasi (getCurrentAcademicSemester):
 * September-Februari = Ganjil, Maret-Agustus = Genap.
 */
function parseFilterSemester(raw) {
  const periode = getCurrentAcademicSemester();
  const paritas = periode.semester === 'Ganjil' ? 1 : 0;
  const angka = parseInt(raw, 10);
  let mode = 'aktif';
  if (raw === '' || raw === 'semua') mode = 'semua';
  else if (raw !== undefined && raw !== 'aktif' && Number.isInteger(angka) && angka > 0) mode = 'angka';
  const lolos = (sem) => {
    const n = Number(sem);
    if (mode === 'semua') return true;
    if (mode === 'angka') return n === angka;
    return Number.isInteger(n) && n > 0 && n % 2 === paritas;
  };
  return {
    mode,
    nilai: mode === 'angka' ? angka : null,
    selected: mode === 'angka' ? String(angka) : mode,
    jenis: periode.semester,
    label: periode.label,
    paritas,
    lolos
  };
}

// ----------------------------------------------------------------------------
// PEMANTAUAN KELENGKAPAN & REKOMENDASI RPS
// ----------------------------------------------------------------------------
const PLACEHOLDER_TOPIK = /^pertemuan\s*\d+$/i;
function topikKosong(t) { return !t || PLACEHOLDER_TOPIK.test(String(t).trim()); }

/**
 * Analisis pemantauan satu MK.
 * @param {object} mk            data MK (kode, materi, dosenIds)
 * @param {Array}  absensiDocs   dokumen subcollection mataKuliah/{id}/absensi
 */
function analisisPantau(mk, absensiDocs) {
  const materi = Array.isArray(mk.materi) ? mk.materi : [];
  const rencana = getRencanaPertemuan(mk.kode) || [];
  const info = getInfoRencana(mk.kode);
  const absensiSet = new Set((absensiDocs || []).map(d => Number(d.data().pertemuan)));
  const byNo = {};
  materi.forEach(m => { byNo[m.pertemuan] = m; });
  const hariIni = new Date(); hariIni.setHours(0, 0, 0, 0);

  let topikTerisi = 0, terlambat = 0, selesaiTanpaAbsensi = 0, selesaiTanpaMateri = 0;
  let rekomIni = null, ketemuIni = false;
  for (let i = 1; i <= 16; i++) {
    const m = byNo[i] || {};
    if (!topikKosong(m.topik)) topikTerisi++;
    if (m.status === 'selesai') {
      if (!absensiSet.has(i)) selesaiTanpaAbsensi++;
      if (!m.fileUrl) selesaiTanpaMateri++;
    } else {
      if (m.tanggal && new Date(m.tanggal) < hariIni) terlambat++;
      if (!ketemuIni) {
        ketemuIni = true;
        const r = rencana.find(x => x.pertemuan === i);
        rekomIni = r ? { pertemuan: i, topik: r.topik, jenis: r.jenis } : null;
      }
    }
  }
  return {
    adaRencana: !!info,
    sumberRencana: info ? info.sumber : null,
    rekomIni,
    topikTerisi,
    terlambat,                 // sudah lewat tanggal tapi belum ditandai selesai
    selesaiTanpaAbsensi,       // ditandai selesai tapi absensi belum diambil
    selesaiTanpaMateri,        // informasi saja (materi pendukung bersifat opsional)
    tanpaDosen: !(mk.dosenIds && mk.dosenIds.length),
    perluPerhatian: terlambat > 0 || selesaiTanpaAbsensi > 0
  };
}

/**
 * Mengisi topik yang masih kosong / berisi "Pertemuan N" dengan topik dari RPS.
 * Topik yang sudah diisi TIDAK ditimpa. MK draft (RPS belum disinkronkan) dilewati.
 * @returns {{status:string, diisi:number, materi?:Array}}
 */
function isiTopikKosongDariRps(mk) {
  const info = getInfoRencana(mk.kode);
  const rencana = getRencanaPertemuan(mk.kode);
  if (!info || !rencana) return { status: 'tanpa-rencana', diisi: 0 };
  if (info.sumber !== 'rps') return { status: 'draft', diisi: 0 };
  const materi = Array.isArray(mk.materi) ? mk.materi.map(m => ({ ...m })) : [];
  let diisi = 0;
  for (const r of rencana) {
    const idx = materi.findIndex(m => m.pertemuan === r.pertemuan);
    if (idx === -1) {
      materi.push({ pertemuan: r.pertemuan, topik: r.topik, tanggal: null, catatan: '', status: 'belum' });
      diisi++;
    } else if (topikKosong(materi[idx].topik)) {
      materi[idx].topik = r.topik;
      diisi++;
    }
  }
  materi.sort((a, b) => a.pertemuan - b.pertemuan);
  return { status: diisi > 0 ? 'diisi' : 'lengkap', diisi, materi };
}

/**
 * Mendapatkan nama dosen dari array ID
 */
async function getDosenNames(dosenIds) {
  if (!dosenIds || !Array.isArray(dosenIds) || dosenIds.length === 0) return [];
  const names = [];
  for (const id of dosenIds) {
    const doc = await db.collection('dosen').doc(id).get();
    if (doc.exists) {
      names.push(doc.data().nama);
    } else {
      names.push('Unknown');
    }
  }
  return names;
}

// ============================================================================
// HALAMAN UTAMA - DAFTAR MATA KULIAH
// ============================================================================

/**
 * GET /admin/pengajaran
 * Menampilkan daftar semua mata kuliah dengan progress
 * Bisa difilter berdasarkan semester
 */
router.get('/', async (req, res) => {
  try {
    const filter = parseFilterSemester(req.query.semester);

    // Ambil semua MK lalu saring di memori (jumlah MK kecil; tidak butuh indeks Firestore baru)
    const query = db.collection('mataKuliah').orderBy('semester', 'desc').orderBy('kode');
    const snapshot = await query.get();
    const docsTerfilter = snapshot.docs.filter(d => filter.lolos(d.data().semester));

    const mkList = [];
    for (const doc of docsTerfilter) {
      const data = doc.data();
      const progress = hitungProgress(data.materi);
      const dosenNames = await getDosenNames(data.dosenIds);
      let absensiDocs = [];
      try {
        absensiDocs = (await db.collection('mataKuliah').doc(doc.id).collection('absensi').get()).docs;
      } catch (e) { console.error('Gagal baca absensi MK', doc.id, e.message); }
      const pantau = analisisPantau(data, absensiDocs);
      mkList.push({
        id: doc.id,
        kode: data.kode,
        nama: data.nama,
        sks: data.sks,
        semester: data.semester,
        dosen: dosenNames.join(', '),
        totalPertemuan: progress.total,
        terlaksana: progress.terlaksana,
        persentase: progress.persentase,
        pantau
      });
    }
    const ringkasPantau = {
      perluPerhatian: mkList.filter(m => m.pantau.perluPerhatian).length,
      topikBelumLengkap: mkList.filter(m => m.pantau.sumberRencana === 'rps' && m.pantau.topikTerisi < 16).length,
      tanpaDosen: mkList.filter(m => m.pantau.tanpaDosen).length
    };

    // Ambil daftar semester unik untuk dropdown filter
    const semesterSnapshot = await db.collection('mataKuliah').get();
    const semesterSet = new Set();
    semesterSnapshot.docs.forEach(doc => {
      if (doc.data().semester) semesterSet.add(doc.data().semester);
    });
    const semesterList = Array.from(semesterSet).sort((a, b) => a - b);
    const semesterAktifInfo = {
      jenis: filter.jenis,
      label: filter.label,
      daftar: semesterList.filter(n => Number(n) % 2 === filter.paritas)
    };

    res.render('admin/pengajaran_list', {
      title: 'Monitoring Pengajaran',
      mkList,
      ringkasPantau,
      semesterList,
      selectedSemester: filter.selected,
      semesterAktifInfo
    });
  } catch (error) {
    console.error('Error mengambil data pengajaran:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat data pengajaran' });
  }
});

// ============================================================================
// DETAIL MATA KULIAH
// ============================================================================

/**
 * POST /admin/pengajaran/sinkron-topik   body: { dryRun: true|false }
 * Mengisi topik kosong SEMUA MK dari RPS (hardcoded di data/rencanaPertemuanData.js).
 * Topik yang sudah diisi tidak ditimpa; MK draft dilewati. dryRun=true hanya menghitung.
 */
router.post('/sinkron-topik', async (req, res) => {
  try {
    const dryRun = !!(req.body && req.body.dryRun);
    const snapshot = await db.collection('mataKuliah').get();
    const ringkas = { mkDiperbarui: 0, topikDiisi: 0, mkSudahLengkap: 0, mkDraftDilewati: 0, mkTanpaRencana: 0, dryRun };
    const updates = [];
    snapshot.docs.forEach(doc => {
      const h = isiTopikKosongDariRps({ id: doc.id, ...doc.data() });
      if (h.status === 'diisi') {
        ringkas.mkDiperbarui++;
        ringkas.topikDiisi += h.diisi;
        updates.push({ ref: doc.ref, materi: h.materi });
      } else if (h.status === 'lengkap') ringkas.mkSudahLengkap++;
      else if (h.status === 'draft') ringkas.mkDraftDilewati++;
      else ringkas.mkTanpaRencana++;
    });
    if (!dryRun) {
      const stamp = new Date().toISOString();
      for (let i = 0; i < updates.length; i += 400) {
        const batch = db.batch();
        updates.slice(i, i + 400).forEach(u => batch.update(u.ref, { materi: u.materi, updatedAt: stamp }));
        await batch.commit();
      }
    }
    res.json({ ok: true, ...ringkas });
  } catch (error) {
    console.error('Error sinkron topik RPS:', error);
    res.status(500).json({ ok: false, message: 'Gagal menyinkronkan topik dari RPS' });
  }
});

/**
 * POST /admin/pengajaran/:id/topik-rps
 * Mengisi topik kosong satu MK dari RPS.
 */
router.post('/:id/topik-rps', async (req, res) => {
  try {
    const mkRef = db.collection('mataKuliah').doc(req.params.id);
    const mkDoc = await mkRef.get();
    if (!mkDoc.exists) return res.status(404).json({ ok: false, message: 'Mata kuliah tidak ditemukan' });
    const h = isiTopikKosongDariRps({ id: mkDoc.id, ...mkDoc.data() });
    if (h.status === 'diisi') await mkRef.update({ materi: h.materi, updatedAt: new Date().toISOString() });
    res.json({ ok: true, status: h.status, diisi: h.diisi });
  } catch (error) {
    console.error('Error isi topik RPS:', error);
    res.status(500).json({ ok: false, message: 'Gagal mengisi topik dari RPS' });
  }
});

/**
 * GET /admin/pengajaran/:id
 * Menampilkan detail pertemuan dan progress MK
 */
router.get('/:id', async (req, res, next) => {
  // '/export' satu segmen sehingga ikut cocok dengan '/:id'; teruskan ke rute export di bawah
  if (req.params.id === 'export') return next();
  try {
    const mkDoc = await db.collection('mataKuliah').doc(req.params.id).get();
    if (!mkDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    }
    const mk = { id: mkDoc.id, ...mkDoc.data() };

    // Siapkan daftar pertemuan 1-16
    const materi = mk.materi || [];
    const rencanaRps = getRencanaPertemuan(mk.kode) || [];
    const infoRencana = getInfoRencana(mk.kode);
    let absensiNomor = new Set();
    try {
      const absSnap = await db.collection('mataKuliah').doc(req.params.id).collection('absensi').get();
      absensiNomor = new Set(absSnap.docs.map(d => Number(d.data().pertemuan)));
    } catch (e) { console.error('Gagal baca absensi:', e.message); }
    const pertemuanList = [];
    for (let i = 1; i <= 16; i++) {
      const existing = materi.find(m => m.pertemuan === i) || {};
      pertemuanList.push({
        pertemuan: i,
        topik: existing.topik || `Pertemuan ${i}`,
        tanggal: existing.tanggal || null,
        status: existing.status || 'belum',
        catatan: existing.catatan || '',
        materiUrl: existing.fileUrl || null,
        absensiDiambil: absensiNomor.has(i),
        rekom: (() => { const r = rencanaRps.find(x => x.pertemuan === i); return r ? { topik: r.topik, kemampuan: r.kemampuan, jenis: r.jenis, sumber: r.sumber } : null; })()
      });
    }

    // Progress
    const terlaksana = pertemuanList.filter(p => p.status === 'selesai').length;
    const persentase = Math.round((terlaksana / 16) * 100);

    // Dosen pengampu
    const dosenList = [];
    if (mk.dosenIds && mk.dosenIds.length > 0) {
      for (const dId of mk.dosenIds) {
        const dDoc = await db.collection('dosen').doc(dId).get();
        if (dDoc.exists) {
          dosenList.push({ id: dId, nama: dDoc.data().nama });
        }
      }
    }

    // Tugas terkait (opsional)
    let tugasList = [];
    try {
      const tugasSnapshot = await db.collection('tugas')
        .where('mkId', '==', req.params.id)
        .orderBy('deadline', 'asc')
        .get();
      tugasList = tugasSnapshot.docs.map(doc => ({
        id: doc.id,
        judul: doc.data().judul,
        deadline: doc.data().deadline,
        tipe: doc.data().tipe
      }));
    } catch (err) {
      console.error('Gagal ambil tugas:', err.message);
    }

    res.render('admin/pengajaran_detail', {
      title: `${mk.kode} - ${mk.nama}`,
      mk,
      pertemuanList,
      dosenList,
      terlaksana,
      persentase,
      tugasList,
      infoRencana,
      jumlahTopikKosong: infoRencana && infoRencana.sumber === 'rps'
        ? pertemuanList.filter(p => p.rekom && topikKosong(p.topik)).length : 0
    });
  } catch (error) {
    console.error('Error detail MK:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail MK' });
  }
});

// ============================================================================
// BULK UPDATE PERTEMUAN
// ============================================================================

/**
 * POST /admin/pengajaran/:id/pertemuan/bulk-update
 * Bulk update status pertemuan (centang yang sudah selesai)
 */
router.post('/:id/pertemuan/bulk-update', async (req, res) => {
  try {
    const { completed } = req.body; // array nomor pertemuan
    console.log('Bulk update received for MK:', req.params.id, 'completed:', completed);

    const mkRef = db.collection('mataKuliah').doc(req.params.id);
    const mkDoc = await mkRef.get();
    if (!mkDoc.exists) {
      console.log('MK tidak ditemukan');
      return res.status(404).json({ success: false, message: 'MK tidak ditemukan' });
    }

    const mk = mkDoc.data();
    let materi = mk.materi || [];
    const completedSet = new Set((Array.isArray(completed) ? completed : []).map(Number));
    console.log('Completed set:', completedSet);

    // Proses 16 pertemuan
    for (let i = 1; i <= 16; i++) {
      const idx = materi.findIndex(m => m.pertemuan === i);
      const isCompleted = completedSet.has(i);

      if (idx !== -1) {
        // Update status
        materi[idx].status = isCompleted ? 'selesai' : 'belum';
        if (isCompleted && !materi[idx].tanggal) {
          materi[idx].tanggal = new Date().toISOString().split('T')[0];
        }
      } else {
        // Buat baru
        materi.push({
          pertemuan: i,
          topik: `Pertemuan ${i}`,
          status: isCompleted ? 'selesai' : 'belum',
          tanggal: isCompleted ? new Date().toISOString().split('T')[0] : null,
        });
      }
    }

    // Urutkan dan simpan
    materi.sort((a, b) => a.pertemuan - b.pertemuan);
    await mkRef.update({ materi, updatedAt: new Date().toISOString() });
    console.log('Bulk update sukses');
    res.json({ success: true });
  } catch (error) {
    console.error('Error bulk update:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /admin/pengajaran/:id/pertemuan/bulk-update
 * Bulk update status pertemuan (centang yang sudah selesai)
 */
router.post('/:id/pertemuan/bulk-update', async (req, res) => {
  try {
    const { completed } = req.body; // array nomor pertemuan
    const mkRef = db.collection('mataKuliah').doc(req.params.id);
    const mkDoc = await mkRef.get();
    if (!mkDoc.exists) return res.status(404).send('MK tidak ditemukan');

    const mk = mkDoc.data();
    let materi = mk.materi || [];
    const completedSet = new Set((Array.isArray(completed) ? completed : []).map(Number));

    for (let i = 1; i <= 16; i++) {
      const idx = materi.findIndex(m => m.pertemuan === i);
      const isCompleted = completedSet.has(i);
      if (idx !== -1) {
        materi[idx].status = isCompleted ? 'selesai' : 'belum';
        if (isCompleted && !materi[idx].tanggal) {
          materi[idx].tanggal = new Date().toISOString().split('T')[0];
        }
      } else {
        materi.push({
          pertemuan: i,
          topik: `Pertemuan ${i}`,
          status: isCompleted ? 'selesai' : 'belum',
          tanggal: isCompleted ? new Date().toISOString().split('T')[0] : null,
        });
      }
    }
    materi.sort((a, b) => a.pertemuan - b.pertemuan);
    await mkRef.update({ materi, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error) {
    console.error('Error bulk update:', error);
    res.status(500).json({ success: false, message: 'Gagal bulk update' });
  }
});

/**
 * POST /admin/pengajaran/:id/pertemuan/:pertemuan
 * Simpan perubahan satu pertemuan (topik, tanggal, catatan) dari halaman detail.
 * Status dan file materi yang sudah ada TIDAK diubah. Harus didaftarkan SETELAH
 * 'bulk-update' supaya "bulk-update" tidak dianggap nomor pertemuan.
 */
router.post('/:id/pertemuan/:pertemuan', async (req, res, next) => {
  try {
    const nomor = parseInt(req.params.pertemuan, 10);
    if (!Number.isInteger(nomor) || nomor < 1 || nomor > 16) return next();

    const mkRef = db.collection('mataKuliah').doc(req.params.id);
    const mkDoc = await mkRef.get();
    if (!mkDoc.exists) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    }

    const topik = String(req.body.topik || '').trim() || `Pertemuan ${nomor}`;
    const tanggal = String(req.body.tanggal || '').trim() || null;
    const catatan = String(req.body.catatan || '').trim();

    const materi = Array.isArray(mkDoc.data().materi) ? mkDoc.data().materi.slice() : [];
    const idx = materi.findIndex(m => m.pertemuan === nomor);
    if (idx !== -1) {
      materi[idx] = { ...materi[idx], topik, tanggal, catatan };
    } else {
      materi.push({ pertemuan: nomor, topik, tanggal, catatan, status: 'belum' });
    }
    materi.sort((a, b) => a.pertemuan - b.pertemuan);

    await mkRef.update({ materi, updatedAt: new Date().toISOString() });
    res.redirect(`/admin/pengajaran/${req.params.id}`);
  } catch (error) {
    console.error('Error simpan pertemuan:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menyimpan pertemuan' });
  }
});

// ============================================================================
// REKAP PER SEMESTER
// ============================================================================

/**
 * GET /admin/pengajaran/rekap/semester
 * Menampilkan rekap progress per semester
 */
router.get('/rekap/semester', async (req, res) => {
  try {
    const snapshot = await db.collection('mataKuliah').orderBy('semester').get();
    const rekapMap = new Map();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const semester = data.semester;
      if (!semester) return;

      const progress = hitungProgress(data.materi);
      if (!rekapMap.has(semester)) {
        rekapMap.set(semester, {
          semester,
          totalMk: 0,
          totalPertemuan: 0,
          totalTerlaksana: 0,
          totalPersen: 0
        });
      }
      const rekap = rekapMap.get(semester);
      rekap.totalMk += 1;
      rekap.totalPertemuan += progress.total;
      rekap.totalTerlaksana += progress.terlaksana;
      rekap.totalPersen += progress.persentase;
    });

    const rekapList = [];
    for (let [semester, data] of rekapMap.entries()) {
      rekapList.push({
        semester: `Semester ${semester}`,
        totalMk: data.totalMk,
        totalPertemuan: data.totalPertemuan,
        totalTerlaksana: data.totalTerlaksana,
        rataPersentase: Math.round(data.totalPersen / data.totalMk)
      });
    }

    rekapList.sort((a, b) => a.semester.localeCompare(b.semester, undefined, { numeric: true }));

    res.render('admin/pengajaran_rekap_semester', {
      title: 'Rekap Pengajaran per Semester',
      rekapList
    });
  } catch (error) {
    console.error('Error rekap semester:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat rekap' });
  }
});

// ============================================================================
// REKAP PER DOSEN
// ============================================================================

/**
 * GET /admin/pengajaran/rekap/dosen
 * Menampilkan rekap progress per dosen
 */
router.get('/rekap/dosen', async (req, res) => {
  try {
    const mkSnapshot = await db.collection('mataKuliah').get();
    const dosenMap = new Map();

    for (const doc of mkSnapshot.docs) {
      const data = doc.data();
      const progress = hitungProgress(data.materi);
      const dosenIds = data.dosenIds || [];

      for (const dId of dosenIds) {
        if (!dId) continue;
        const dDoc = await db.collection('dosen').doc(dId).get();
        const nama = dDoc.exists ? dDoc.data().nama : 'Unknown';
        if (!dosenMap.has(dId)) {
          dosenMap.set(dId, {
            id: dId,
            nama,
            totalMk: 0,
            totalPertemuan: 0,
            totalTerlaksana: 0,
            totalPersen: 0
          });
        }
        const d = dosenMap.get(dId);
        d.totalMk += 1;
        d.totalPertemuan += progress.total;
        d.totalTerlaksana += progress.terlaksana;
        d.totalPersen += progress.persentase;
      }
    }

    const rekapList = [];
    for (let [id, data] of dosenMap.entries()) {
      rekapList.push({
        nama: data.nama,
        totalMk: data.totalMk,
        totalPertemuan: data.totalPertemuan,
        totalTerlaksana: data.totalTerlaksana,
        rataPersentase: Math.round(data.totalPersen / data.totalMk)
      });
    }

    rekapList.sort((a, b) => a.nama.localeCompare(b.nama));

    res.render('admin/pengajaran_rekap_dosen', {
      title: 'Rekap Pengajaran per Dosen',
      rekapList
    });
  } catch (error) {
    console.error('Error rekap dosen:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat rekap dosen' });
  }
});

// ============================================================================
// EXPORT (ke halaman print)
// ============================================================================

/**
 * GET /admin/pengajaran/export
 * Mengekspor data pengajaran ke tampilan print
 */
router.get('/export', async (req, res) => {
  try {
    const filter = parseFilterSemester(req.query.semester);
    const snapshot = await db.collection('mataKuliah').orderBy('semester').orderBy('kode').get();
    const docsTerfilter = snapshot.docs.filter(d => filter.lolos(d.data().semester));

    const exportData = [];
    for (const doc of docsTerfilter) {
      const data = doc.data();
      const progress = hitungProgress(data.materi);
      const dosenNames = await getDosenNames(data.dosenIds);
      exportData.push({
        kode: data.kode,
        nama: data.nama,
        sks: data.sks,
        semester: data.semester,
        jadwal: data.jadwal || '',
        dosen: dosenNames.join(', '),
        totalPertemuan: progress.total,
        terlaksana: progress.terlaksana,
        persentase: progress.persentase
      });
    }

    const filterInfo = filter.mode === 'aktif' ? `Semester Aktif (${filter.label})`
      : filter.mode === 'angka' ? `Semester ${filter.nilai}` : 'Semua Semester';

    res.render('admin/pengajaran_export', {
      title: 'Export Data Pengajaran',
      data: exportData,
      filterInfo,
      generatedAt: new Date().toLocaleString('id-ID')
    });
  } catch (error) {
    console.error('Error export:', error);
    res.status(500).send('Gagal export data');
  }
});

module.exports = router;