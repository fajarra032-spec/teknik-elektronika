/**
 * routes/admin/krs.js
 * Kelola KRS: lihat daftar, detail, setujui, tolak, dan hapus
 * Dilengkapi pencegahan duplikat enrollment dan penolakan otomatis KRS lain untuk semester yang sama
 * OPTIMASI: cache per request + Promise.all + batch paralel
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const drive = require('../../config/googleDrive');
const {
  getCurrentAcademicSemester,
  getAngkatanFromNim,
  getStudentCurrentSemester
} = require('../../helpers/academicHelper');
const { syncKrsDanEnrollment } = require('../../helpers/paketKurikulumHelper');

router.use(verifyToken);
router.use(isAdmin);

// Cache per-request (dibuat baru di setiap request via req._krsCache di
// bawah, BUKAN variabel level-modul lagi). Sebelumnya cache ini level-modul
// (dibagi semua request bersamaan) - kalau 2 admin buka halaman KRS di
// waktu yang sama, clearCache() salah satu request bisa menghapus cache
// yang sedang dipakai request lain (race condition). Sekarang tiap request
// bikin Map sendiri lewat middleware di bawah, jadi tidak mungkin
// bertabrakan antar-request.
router.use((req, res, next) => {
  req._mahasiswaCache = new Map();
  req._mkCache = new Map();
  next();
});

async function getMahasiswa(req, userId) {
  if (req._mahasiswaCache.has(userId)) return req._mahasiswaCache.get(userId);
  try {
    const doc = await db.collection('users').doc(userId).get();
    const data = doc.exists ? doc.data() : { nama: 'Unknown', nim: '-' };
    req._mahasiswaCache.set(userId, data);
    return data;
  } catch {
    return { nama: 'Unknown', nim: '-' };
  }
}

async function getMataKuliah(req, mkId) {
  if (req._mkCache.has(mkId)) return req._mkCache.get(mkId);
  try {
    const doc = await db.collection('mataKuliah').doc(mkId).get();
    const data = doc.exists ? doc.data() : null;
    req._mkCache.set(mkId, data);
    return data;
  } catch {
    return null;
  }
}

// ============================================================================
// DAFTAR KRS (dengan filter status & semester)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const { status, semester } = req.query;

    let query = db.collection('krs');
    if (status) query = query.where('status', '==', status);
    if (semester) query = query.where('semester', '==', semester);
    query = query.orderBy('createdAt', 'desc');

    const krsSnapshot = await query.get();
    const krsDocs = krsSnapshot.docs;

    if (krsDocs.length === 0) {
      return res.render('admin/krs_list', {
        title: 'Daftar KRS',
        krsList: [],
        filters: { status, semester },
        success: req.query.success
      });
    }

    // Kumpulkan semua userId dan mkIds unik
    const userIds = new Set();
    const allMkIds = new Set();
    for (const doc of krsDocs) {
      const data = doc.data();
      userIds.add(data.userId);
      const mkIds = data.mataKuliah || [];
      mkIds.forEach(id => allMkIds.add(id));
    }

    // Ambil semua data mahasiswa dan mata kuliah secara paralel
    const [mahasiswaMap, mkMap] = await Promise.all([
      Promise.all(Array.from(userIds).map(async uid => {
        const m = await getMahasiswa(req, uid);
        return [uid, m];
      })),
      Promise.all(Array.from(allMkIds).map(async mid => {
        const mk = await getMataKuliah(req, mid);
        return [mid, mk];
      }))
    ]);

    const userMap = new Map(mahasiswaMap);
    const mkFullMap = new Map(mkMap);

    // Bangun list KRS
    const krsList = [];
    for (const doc of krsDocs) {
      const data = doc.data();
      const mahasiswa = userMap.get(data.userId) || { nama: 'Unknown', nim: '-' };
      const mkIds = data.mataKuliah || [];
      const courses = [];
      for (const mkId of mkIds.slice(0, 3)) {
        const mk = mkFullMap.get(mkId);
        if (mk) {
          courses.push({
            kode: mk.kode,
            nama: mk.nama,
            sks: mk.sks
          });
        }
      }
      krsList.push({
        id: doc.id,
        ...data,
        mahasiswa,
        courses,
        courseCount: mkIds.length
      });
    }

    res.render('admin/krs_list', {
      title: 'Daftar KRS',
      krsList,
      filters: { status, semester },
      success: req.query.success
    });
  } catch (error) {
    console.error('Error mengambil KRS:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat daftar KRS'
    });
  }
});

// ============================================================================
// BUAT KRS UNTUK MAHASISWA (input oleh admin, langsung approved)
// KRS mahasiswa sekarang diinput oleh admin, bukan diajukan sendiri oleh
// mahasiswa - jadi begitu admin submit form ini, KRS + enrollment langsung
// aktif (skip status 'pending' & tombol approve terpisah).
// ============================================================================

router.get('/buat/:mahasiswaId', async (req, res) => {
  try {
    const mahasiswaDoc = await db.collection('users').doc(req.params.mahasiswaId).get();
    if (!mahasiswaDoc.exists || mahasiswaDoc.data().role !== 'mahasiswa') {
      return res.redirect('/admin/mahasiswa?error=' + encodeURIComponent('Mahasiswa tidak ditemukan'));
    }
    const mahasiswa = { id: mahasiswaDoc.id, ...mahasiswaDoc.data() };

    const angkatan = getAngkatanFromNim(mahasiswa.nim);
    const currentSemesterNumber = angkatan ? getStudentCurrentSemester(angkatan) : null;
    const academicLabel = getCurrentAcademicSemester().label;

    const coursesSnapshot = await db.collection('mataKuliah').orderBy('kode').get();
    const courses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    courses.forEach(c => { c.isRecommended = (c.semester === currentSemesterNumber); });

    // Mata kuliah yang SUDAH aktif untuk mahasiswa ini di semester berjalan
    // (supaya admin tidak double-input / bisa lihat apa yang sudah diambil)
    const existingEnrollSnapshot = await db.collection('enrollment')
      .where('userId', '==', mahasiswa.id)
      .where('status', '==', 'active')
      .where('semester', '==', academicLabel)
      .get();
    const existingMkIds = existingEnrollSnapshot.docs.map(d => d.data().mkId);

    res.render('admin/krs_buat', {
      title: `Buat KRS - ${mahasiswa.nama}`,
      mahasiswa,
      courses,
      currentSemester: currentSemesterNumber,
      academicLabel,
      existingMkIds,
      error: req.query.error || null
    });
  } catch (error) {
    console.error('Error memuat form buat KRS:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat form buat KRS' });
  }
});

router.post('/buat/:mahasiswaId', async (req, res) => {
  try {
    const { mahasiswaId } = req.params;
    const { courses } = req.body;
    if (!courses) {
      return res.redirect(`/admin/krs/buat/${mahasiswaId}?error=` + encodeURIComponent('Pilih minimal satu mata kuliah'));
    }
    const mkIds = JSON.parse(courses);
    if (!Array.isArray(mkIds) || mkIds.length === 0) {
      return res.redirect(`/admin/krs/buat/${mahasiswaId}?error=` + encodeURIComponent('Pilih minimal satu mata kuliah'));
    }

    const mahasiswaDoc = await db.collection('users').doc(mahasiswaId).get();
    if (!mahasiswaDoc.exists) {
      return res.redirect('/admin/mahasiswa?error=' + encodeURIComponent('Mahasiswa tidak ditemukan'));
    }

    const academicLabel = getCurrentAcademicSemester().label;
    const { jumlahBaru, jumlahDibatalkan } = await syncKrsDanEnrollment(db, mahasiswaId, mkIds, academicLabel, req.user.id);

    let pesanSukses = `KRS berhasil disimpan untuk ${mahasiswaDoc.data().nama} (${academicLabel}): ${jumlahBaru} mata kuliah baru ditambahkan`;
    if (jumlahDibatalkan > 0) {
      pesanSukses += `, ${jumlahDibatalkan} mata kuliah dibatalkan karena dihapus centangnya`;
    }
    pesanSukses += '.';
    res.redirect(`/admin/mahasiswa/${mahasiswaId}?krsSuccess=` + encodeURIComponent(pesanSukses));
  } catch (error) {
    console.error('Error membuat KRS:', error);
    res.redirect(`/admin/krs/buat/${req.params.mahasiswaId}?error=` + encodeURIComponent('Gagal membuat KRS: ' + error.message));
  }
});

// ============================================================================
// DETAIL KRS
// ============================================================================
router.get('/:id', async (req, res) => {
  try {
    const krsDoc = await db.collection('krs').doc(req.params.id).get();
    if (!krsDoc.exists) {
      return res.status(404).render('error', {
        title: 'Tidak Ditemukan',
        message: 'KRS tidak ditemukan'
      });
    }
    const krs = { id: krsDoc.id, ...krsDoc.data() };

    const mahasiswa = await getMahasiswa(req, krs.userId);

    const mkIds = krs.mataKuliah || [];
    const mkList = await Promise.all(mkIds.map(async mkId => {
      const mk = await getMataKuliah(req, mkId);
      if (mk) {
        return {
          id: mkId,
          kode: mk.kode,
          nama: mk.nama,
          sks: mk.sks
        };
      }
      return null;
    }));
    const filteredMkList = mkList.filter(m => m !== null);

    res.render('admin/krs_detail', {
      title: `Detail KRS - ${mahasiswa.nama}`,
      krs,
      mahasiswa,
      mkList: filteredMkList
    });
  } catch (error) {
    console.error('Error detail KRS:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat detail KRS'
    });
  }
});

// ============================================================================
// APPROVE KRS (dengan pencegahan duplikat enrollment)
// ============================================================================
router.post('/:id/approve', async (req, res) => {
  try {
    const krsRef = db.collection('krs').doc(req.params.id);
    const krsDoc = await krsRef.get();
    if (!krsDoc.exists) return res.status(404).send('KRS tidak ditemukan');
    const krs = krsDoc.data();
    const mkIds = krs.mataKuliah || [];
    const semester = krs.semester;
    const userId = krs.userId;

    const batch = db.batch();

    // Update status KRS yang diapprove
    batch.update(krsRef, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: req.user.id
    });

    // Cek duplikat enrollment untuk semua mk sekaligus
    const enrollmentChecks = await Promise.all(mkIds.map(mkId =>
      db.collection('enrollment')
        .where('userId', '==', userId)
        .where('mkId', '==', mkId)
        .where('semester', '==', semester)
        .where('status', '==', 'active')
        .limit(1)
        .get()
    ));

    for (let i = 0; i < mkIds.length; i++) {
      const mkId = mkIds[i];
      const existingSnapshot = enrollmentChecks[i];
      if (existingSnapshot.empty) {
        const enrollmentRef = db.collection('enrollment').doc();
        batch.set(enrollmentRef, {
          userId,
          mkId,
          semester,
          status: 'active',
          createdAt: new Date().toISOString(),
          approvedBy: req.user.id,
          krsId: req.params.id
        });
      } else {
        console.log(`Enrollment untuk user ${userId} dan mk ${mkId} sudah ada, dilewati.`);
      }
    }

    // Batalkan KRS lain yang masih pending untuk mahasiswa dan semester yang sama
    const otherKrsSnapshot = await db.collection('krs')
      .where('userId', '==', userId)
      .where('semester', '==', semester)
      .where('status', '==', 'pending')
      .get();

    for (const doc of otherKrsSnapshot.docs) {
      if (doc.id !== req.params.id) {
        batch.update(doc.ref, {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
          rejectedBy: req.user.id,
          alasanPenolakan: 'KRS lain disetujui untuk semester yang sama'
        });
      }
    }

    await batch.commit();
    res.redirect('/admin/krs?success=approved');
  } catch (error) {
    console.error('Error approve KRS:', error);
    res.status(500).send('Gagal menyetujui KRS');
  }
});

// ============================================================================
// REJECT KRS
// ============================================================================
router.post('/:id/reject', async (req, res) => {
  try {
    const krsRef = db.collection('krs').doc(req.params.id);
    const krsDoc = await krsRef.get();
    if (!krsDoc.exists) return res.status(404).send('KRS tidak ditemukan');
    const krsSebelumnya = krsDoc.data();

    await krsRef.update({
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.user.id
    });

    // Jaga-jaga: kalau KRS ini SEBELUMNYA sudah 'approved' (mis. ditolak
    // ulang lewat request manual, di luar alur tombol UI normal yang cuma
    // muncul untuk status 'pending'), enrollment yang sudah terlanjur
    // dibuat perlu dinonaktifkan juga - supaya matkul ini otomatis hilang
    // lagi dari KHS/Transkrip mahasiswa (yang sekarang baca dari
    // enrollment aktif), bukan nyantol sebagai "masih diprogram" padahal
    // KRS-nya sudah ditolak.
    if (krsSebelumnya.status === 'approved') {
      const enrollmentSnapshot = await db.collection('enrollment')
        .where('krsId', '==', req.params.id)
        .where('status', '==', 'active')
        .get();
      if (!enrollmentSnapshot.empty) {
        const batch = db.batch();
        enrollmentSnapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            status: 'dibatalkan',
            dibatalkanAt: new Date().toISOString(),
            dibatalkanKarena: 'KRS ditolak setelah sebelumnya disetujui'
          });
        });
        await batch.commit();
      }
    }

    res.redirect('/admin/krs?success=rejected');
  } catch (error) {
    console.error('Error reject KRS:', error);
    res.status(500).send('Gagal menolak KRS');
  }
});

// ============================================================================
// DELETE KRS (beserta file di Drive dan enrollment terkait)
// ============================================================================
router.post('/delete/:id', async (req, res) => {
  try {
    const krsDoc = await db.collection('krs').doc(req.params.id).get();
    if (!krsDoc.exists) {
      return res.status(404).send('KRS tidak ditemukan');
    }
    const krs = krsDoc.data();

    // Hapus file di Drive jika ada driveFileId
    if (krs.driveFileId) {
      try {
        await drive.files.delete({ fileId: krs.driveFileId });
        console.log('File di Drive berhasil dihapus:', krs.driveFileId);
      } catch (err) {
        console.error('Gagal menghapus file di Drive:', err.message);
      }
    }

    // Hapus semua enrollment yang terkait dengan KRS ini
    const enrollmentSnapshot = await db.collection('enrollment')
      .where('krsId', '==', req.params.id)
      .get();

    const batch = db.batch();
    enrollmentSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(krsDoc.ref);
    await batch.commit();

    res.redirect('/admin/krs?success=deleted');
  } catch (error) {
    console.error('Error delete KRS:', error);
    res.status(500).send('Gagal menghapus KRS');
  }
});

module.exports = router;