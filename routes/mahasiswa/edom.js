const express = require('express');
const router = express.Router();
const { verifyToken, isMahasiswa } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { getActiveEdomPeriod, getActiveQuestions, hasFilledEdom } = require('../../helpers/edomHelper');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');

function setMessage(req, type, text) {
  req.session.message = { type, text };
}
function getMessage(req) {
  const msg = req.session.message;
  delete req.session.message;
  return msg || null;
}

router.use((req, res, next) => {
  console.log(`[EDOM DEBUG] ${req.method} ${req.originalUrl}`);
  next();
});

router.use(verifyToken);
router.use(isMahasiswa);

// ==================== DAFTAR MATA KULIAH ====================
router.get('/', async (req, res) => {
  try {
    const activePeriod = await getActiveEdomPeriod();
    const message = getMessage(req);
    if (!activePeriod) {
      return res.render('mahasiswa/edom/index', {
        title: 'EDOM',
        activePeriod: null,
        mkList: [],
        message: message || { type: 'info', text: 'Tidak ada periode evaluasi aktif saat ini.' }
      });
    }

    const currentSemester = getCurrentAcademicSemester().label;
    const semesterPeriod = activePeriod.semester || currentSemester;
    const enrollmentSnap = await db.collection('enrollment')
      .where('userId', '==', req.user.id)
      .where('status', '==', 'active')
      .where('semester', '==', semesterPeriod)
      .get();

    const mkList = [];
    for (const enroll of enrollmentSnap.docs) {
      const mkId = enroll.data().mkId;
      const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
      if (!mkDoc.exists) continue;
      const mk = mkDoc.data();

      // Ambil daftar nama dosen (untuk tampilan)
      let dosenNames = [];
      if (mk.dosenIds && mk.dosenIds.length) {
        for (const dId of mk.dosenIds) {
          const dosenDoc = await db.collection('dosen').doc(dId).get();
          if (dosenDoc.exists) dosenNames.push(dosenDoc.data().nama);
        }
      }

      // Cek apakah sudah ada evaluasi (minimal satu) untuk MK ini
      const sudahDiisi = await hasFilledEdom(req.user.id, mkId, activePeriod.id); // tanpa dosenId

mkList.push({
  id: mkId,
  kode: mk.kode,
  nama: mk.nama,
  dosen: dosenNames.join(', ') || 'Tidak ada dosen',
  sudahDiisi,   // <-- boolean: true jika ada minimal satu respon
  semester: semesterPeriod
});
    }

    res.render('mahasiswa/edom/index', { title: 'Evaluasi Dosen (EDOM)', activePeriod, mkList, message });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat data mata kuliah');
    res.redirect('/mahasiswa/dashboard');
  }
});

// ==================== FORM EVALUASI ====================
router.get('/mk/:mkId', async (req, res) => {
  try {
    const { mkId } = req.params;
    const activePeriod = await getActiveEdomPeriod();
    if (!activePeriod) {
      setMessage(req, 'error', 'Tidak ada periode evaluasi aktif');
      return res.redirect('/mahasiswa/edom');
    }

    // Cek apakah sudah ada evaluasi untuk MK ini
    const sudahDiisi = await hasFilledEdom(req.user.id, mkId, activePeriod.id);
    if (sudahDiisi) {
      setMessage(req, 'info', 'Anda sudah mengisi evaluasi untuk mata kuliah ini.');
      return res.redirect('/mahasiswa/edom');
    }

    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    if (!mkDoc.exists) {
      setMessage(req, 'error', 'Mata kuliah tidak ditemukan');
      return res.redirect('/mahasiswa/edom');
    }
    const mk = mkDoc.data();

    // Ambil daftar dosen pengampu (semua)
    let dosenList = [];
    if (mk.dosenIds && mk.dosenIds.length) {
      for (const dId of mk.dosenIds) {
        const dosenDoc = await db.collection('dosen').doc(dId).get();
        if (dosenDoc.exists) {
          dosenList.push({ id: dId, nama: dosenDoc.data().nama });
        }
      }
    }

    const questions = await getActiveQuestions();
    if (!questions.length) {
      setMessage(req, 'error', 'Belum ada pertanyaan evaluasi. Silakan hubungi admin.');
      return res.redirect('/mahasiswa/edom');
    }
    if (dosenList.length === 0) {
      setMessage(req, 'error', 'Mata kuliah ini belum memiliki dosen pengampu.');
      return res.redirect('/mahasiswa/edom');
    }

    const message = getMessage(req);
    res.render('mahasiswa/edom/form', {
      title: `Evaluasi - ${mk.kode} ${mk.nama}`,
      mk,
      mkId,
      dosenList,
      questions,
      activePeriod,
      message
    });
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal memuat form evaluasi');
    res.redirect('/mahasiswa/edom');
  }
});

// ==================== PROSES SUBMIT ====================
router.post('/mk/:mkId', async (req, res) => {
  try {
    const { mkId } = req.params;
    const { dosenId } = req.body;

    if (!dosenId) {
      setMessage(req, 'error', 'Pilih dosen yang akan dievaluasi');
      return res.redirect(`/mahasiswa/edom/mk/${mkId}`);
    }

    const activePeriod = await getActiveEdomPeriod();
    if (!activePeriod) {
      setMessage(req, 'error', 'Periode evaluasi tidak aktif');
      return res.redirect('/mahasiswa/edom');
    }

    // Cek apakah sudah ada evaluasi (global per MK)
    const sudahDiisi = await hasFilledEdom(req.user.id, mkId, activePeriod.id);
    if (sudahDiisi) {
      setMessage(req, 'error', 'Anda sudah mengisi evaluasi untuk mata kuliah ini.');
      return res.redirect('/mahasiswa/edom');
    }

    // Data dosen
    const dosenDoc = await db.collection('dosen').doc(dosenId).get();
    if (!dosenDoc.exists) {
      setMessage(req, 'error', 'Dosen tidak ditemukan');
      return res.redirect(`/mahasiswa/edom/mk/${mkId}`);
    }
    const dosenNama = dosenDoc.data().nama;

    const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
    if (!mkDoc.exists) {
      setMessage(req, 'error', 'Mata kuliah tidak ditemukan');
      return res.redirect('/mahasiswa/edom');
    }
    const mk = mkDoc.data();

    const questions = await getActiveQuestions();
    const answers = [];
    let totalNilai = 0;
    let ratingCount = 0;

    for (const q of questions) {
      if (q.tipe === 'rating') {
        const nilai = parseInt(req.body[`nilai_${q.id}`]);
        if (isNaN(nilai)) {
          setMessage(req, 'error', `Harap pilih skala untuk pertanyaan: ${q.pertanyaan}`);
          return res.redirect(`/mahasiswa/edom/mk/${mkId}`);
        }
        answers.push({
          pertanyaanId: q.id,
          pertanyaan: q.pertanyaan,
          tipe: 'rating',
          nilai,
        });
        totalNilai += nilai;
        ratingCount++;
      } else {
        const jawabanTeks = (req.body[`jawaban_teks_${q.id}`] || '').trim();
        if (!jawabanTeks) {
          setMessage(req, 'error', `Jawaban untuk pertanyaan teks wajib diisi: ${q.pertanyaan}`);
          return res.redirect(`/mahasiswa/edom/mk/${mkId}`);
        }
        answers.push({
          pertanyaanId: q.id,
          pertanyaan: q.pertanyaan,
          tipe: 'text',
          jawabanTeks,
        });
      }
    }

    const nilaiRata = ratingCount > 0 ? totalNilai / ratingCount : 0;

    await db.collection('edom_respon').add({
      mahasiswaId: req.user.id,
      mahasiswaNama: req.user.nama,
      mkId,
      mkKode: mk.kode,
      mkNama: mk.nama,
      dosenId,
      dosenNama,
      periodeId: activePeriod.id,
      semester: activePeriod.semester || getCurrentAcademicSemester().label,
      jawaban: answers,
      nilaiRata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    setMessage(req, 'success', `Evaluasi untuk ${dosenNama} berhasil disimpan. Terima kasih.`);
    res.redirect('/mahasiswa/edom');
  } catch (err) {
    console.error(err);
    setMessage(req, 'error', 'Gagal menyimpan evaluasi: ' + err.message);
    res.redirect(`/mahasiswa/edom/mk/${req.params.mkId}`);
  }
});

module.exports = router;