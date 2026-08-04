// routes/admin/rubrik.js
// Rekap Rubrik Penilaian SELURUH Mata Kuliah (Admin/Kaprodi).
// Admin bisa melihat hasil rubrik (kehadiran, sikap, keaktifan, tugas, kuis,
// UTS, UAS, nilai akhir, huruf) untuk setiap MK dari semua dosen, mencetaknya,
// dan mengunci nilai akhir seorang mahasiswa ke koleksi 'grades' resmi
// (dipakai transkrip/KHS) memakai saveGradeFinal yang sudah ada.

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const {
  getPeriodeAktif,
  getHasilRubrikSemuaMahasiswa,
  hitungRubrik,
  saveGradeFinal
} = require('../../helpers/nilaiHelper');

router.use(verifyToken);
router.use(isAdmin);

// ✅ OPTIMISASI KUOTA: cache nama dosen dalam satu request (banyak MK sering
// diampu oleh dosen yang sama, jadi tidak perlu baca dokumen `users` yang
// sama berkali-kali).
const _dosenNamaCache = new Map();
async function getDosenNamaByIds(dosenIds = []) {
  const idBelumAda = dosenIds.filter(id => !_dosenNamaCache.has(id));
  if (idBelumAda.length > 0) {
    const refs = idBelumAda.map(id => db.collection('users').doc(id));
    const docs = await db.getAll(...refs);
    docs.forEach((doc, i) => {
      _dosenNamaCache.set(idBelumAda[i], doc.exists ? (doc.data().nama || idBelumAda[i]) : idBelumAda[i]);
    });
  }
  return dosenIds.map(id => _dosenNamaCache.get(id)).join(', ');
}

/**
 * Ambil banyak dokumen `users` SEKALIGUS (satu round-trip via db.getAll),
 * bukan satu per satu dalam loop - dipakai utk daftar mahasiswa di halaman
 * detail rubrik/cetak.
 */
async function getMahasiswaBanyak(uids) {
  if (uids.length === 0) return {};
  const refs = uids.map(uid => db.collection('users').doc(uid));
  const docs = await db.getAll(...refs);
  const map = {};
  docs.forEach((doc, i) => {
    map[uids[i]] = doc.exists ? { id: uids[i], ...doc.data() } : { id: uids[i], nama: 'Unknown', nim: '-' };
  });
  return map;
}

async function ambilDataRubrik(mkId, periode) {
  const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
  if (!mkDoc.exists) return null;
  const mk = { id: mkId, ...mkDoc.data() };

  const enrollmentSnapshot = await db.collection('enrollment')
    .where('mkId', '==', mkId)
    .where('status', '==', 'active')
    .get();
  const mahasiswaIds = enrollmentSnapshot.docs.map(d => d.data().userId);

  const { bobot, komponenMap, hasilMap } = await getHasilRubrikSemuaMahasiswa(mkId, periode);
  const mahasiswaMap = await getMahasiswaBanyak(mahasiswaIds); // 1 round-trip, bukan N

  const data = mahasiswaIds.map(uid => {
    const mahasiswa = mahasiswaMap[uid];
    const komponen = komponenMap[uid] || {};
    const hasil = hasilMap[uid] || hitungRubrik({}, null, bobot);
    return { mahasiswa, komponen, hasil };
  });
  data.sort((a, b) => String(a.mahasiswa.nim).localeCompare(String(b.mahasiswa.nim)));

  return { mk, bobot, data };
}

// ============================================================================
// DAFTAR SEMUA MATA KULIAH (lintas dosen)
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const mkSnapshot = await db.collection('mataKuliah').orderBy('kode').get();

    // ✅ OPTIMISASI KUOTA: sebelumnya, untuk SETIAP mata kuliah di daftar ini,
    // sistem membaca ULANG SELURUH koleksi 'nilai' MK tsb DUA KALI
    // (getKomponenRubrikByMkId + getRataTugasByMkId) hanya untuk menghitung
    // "berapa mahasiswa yang rubriknya sudah lengkap" - padahal itu cuma
    // angka ringkasan di halaman daftar. Kalau prodi punya puluhan MK, itu
    // artinya puluhan kali pembacaan penuh koleksi 'nilai' SETIAP KALI
    // admin membuka halaman ini. Sekarang dihapus dari sini - angka
    // kelengkapan lengkap tetap bisa dilihat dengan klik ke detail MK
    // (yang memang perlu baca data itu, tapi cuma untuk 1 MK, bukan semua).
    // Jumlah mahasiswa per MK juga dipakai count() aggregation (bukan
    // membaca semua dokumen enrollment).
    const mkList = await Promise.all(mkSnapshot.docs.map(async (doc) => {
      const mk = { id: doc.id, ...doc.data() };
      const [jumlahMahasiswa, namaDosen] = await Promise.all([
        db.collection('enrollment')
          .where('mkId', '==', doc.id)
          .where('status', '==', 'active')
          .count().get()
          .then(s => s.data().count)
          .catch(async () => {
            const s = await db.collection('enrollment').where('mkId', '==', doc.id).where('status', '==', 'active').get();
            return s.size;
          }),
        getDosenNamaByIds(mk.dosenIds || [])
      ]);
      mk.jumlahMahasiswa = jumlahMahasiswa;
      mk.namaDosen = namaDosen;
      return mk;
    }));

    res.render('admin/rubrik_list', {
      title: 'Rekap Rubrik Penilaian - Semua Mata Kuliah',
      mkList,
      periode
    });
  } catch (error) {
    console.error('Error daftar rubrik admin:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat daftar rubrik: ' + error.message });
  }
});

// ============================================================================
// DETAIL RUBRIK SATU MK (READ-ONLY REKAP, semua komponen + nilai akhir)
// ============================================================================
router.get('/:mkId', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const hasil = await ambilDataRubrik(req.params.mkId, periode);
    if (!hasil) {
      return res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Mata kuliah tidak ditemukan' });
    }
    hasil.mk.namaDosen = await getDosenNamaByIds(hasil.mk.dosenIds || []);

    res.render('admin/rubrik_detail', {
      title: `Rubrik Penilaian - ${hasil.mk.kode} ${hasil.mk.nama}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode
    });
  } catch (error) {
    console.error('Error detail rubrik admin:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail rubrik: ' + error.message });
  }
});

// ============================================================================
// KUNCI NILAI AKHIR -> koleksi 'grades' resmi (dipakai transkrip/KHS/IPK)
// ============================================================================
router.post('/:mkId/kunci/:mahasiswaId', async (req, res) => {
  try {
    const { mkId, mahasiswaId } = req.params;
    const periode = req.body.periode || getPeriodeAktif();

    const hasil = await ambilDataRubrik(mkId, periode);
    if (!hasil) return res.status(404).json({ success: false, message: 'MK tidak ditemukan' });

    const item = hasil.data.find(d => d.mahasiswa.id === mahasiswaId);
    if (!item || item.hasil.nilaiAkhir === null) {
      return res.status(400).json({ success: false, message: 'Komponen rubrik mahasiswa ini belum lengkap' });
    }

    await saveGradeFinal({
      userId: mahasiswaId,
      kodeMk: hasil.mk.kode,
      namaMk: hasil.mk.nama,
      sks: hasil.mk.sks,
      nilai: item.hasil.nilaiAkhir,
      semester: periode
    });

    res.json({ success: true, nilaiAkhir: item.hasil.nilaiAkhir, huruf: item.hasil.huruf });
  } catch (error) {
    console.error('Error kunci nilai akhir dari rubrik:', error);
    res.status(500).json({ success: false, message: 'Gagal mengunci nilai: ' + error.message });
  }
});

// ============================================================================
// CETAK RUBRIK (dipakai juga oleh admin, view sama dengan dosen)
// ============================================================================
router.get('/:mkId/cetak', async (req, res) => {
  try {
    const periode = req.query.periode || getPeriodeAktif();
    const hasil = await ambilDataRubrik(req.params.mkId, periode);
    if (!hasil) return res.status(404).send('Mata kuliah tidak ditemukan');
    hasil.mk.namaDosen = await getDosenNamaByIds(hasil.mk.dosenIds || []);

    res.render('rubrik_print', {
      title: `Cetak Rubrik Penilaian - ${hasil.mk.kode}`,
      mk: hasil.mk,
      bobot: hasil.bobot,
      data: hasil.data,
      periode,
      namaDosen: hasil.mk.namaDosen
    });
  } catch (error) {
    console.error('Error cetak rubrik admin:', error);
    res.status(500).send('Gagal memuat halaman cetak: ' + error.message);
  }
});

module.exports = router;
