// helpers/nilaiHelper.js
const { db } = require('../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('./academicHelper');

/**
 * Label periode akademik aktif saat ini (mis. "Ganjil 2025/2026").
 * Dipakai sebagai nilai default field `periode` pada dokumen 'tugas' dan 'nilai'
 * supaya data komponen nilai antar semester tidak tercampur saat MK yang sama
 * dibuka lagi di periode berikutnya, atau saat mahasiswa mengulang MK.
 */
function getPeriodeAktif() {
  return getCurrentAcademicSemester().label;
}

/**
 * Mendapatkan atau membuat entri nilai untuk mahasiswa
 * @param {string} mahasiswaId - UID mahasiswa
 * @param {string} mkId - ID mata kuliah
 * @param {string} tugasId - ID tugas
 * @param {string} judulTugas - Judul tugas (untuk display)
 * @param {number} nilai - Nilai yang diberikan
 * @param {string} [periode] - Periode akademik (default: periode aktif saat ini)
 * @returns {Promise<Object>}
 */
async function saveNilai(mahasiswaId, mkId, tugasId, judulTugas, nilai, periode = getPeriodeAktif(), komentar = null) {
  const tipeNilai = `tugas_${tugasId}`; // Format unik: tugas_<tugasId>

  // Disengaja: query juga menyertakan periode, supaya nilai attempt mahasiswa
  // yang mengulang MK ini di periode lain tidak tertimpa/dianggap sama.
  const existingSnapshot = await db.collection('nilai')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('mkId', '==', mkId)
    .where('tipe', '==', tipeNilai)
    .where('periode', '==', periode)
    .limit(1)
    .get();
  
  const nilaiAngka = parseFloat(nilai);
  const now = new Date().toISOString();
  
  if (existingSnapshot.empty) {
    const docRef = await db.collection('nilai').add({
      mahasiswaId,
      mkId,
      tipe: tipeNilai,
      judulTugas,
      nilai: nilaiAngka,
      komentar,
      periode,
      createdAt: now,
      updatedAt: now
    });
    return { id: docRef.id, isNew: true };
  } else {
    const docRef = existingSnapshot.docs[0].ref;
    await docRef.update({
      nilai: nilaiAngka,
      judulTugas,
      komentar,
      updatedAt: now
    });
    return { id: existingSnapshot.docs[0].id, isNew: false };
  }
}

/**
 * Mendapatkan semua nilai untuk suatu mata kuliah, dibatasi pada satu periode
 * akademik (default periode aktif) supaya nilai dari penawaran/percobaan MK
 * di periode lain tidak ikut tercampur.
 * @param {string} mkId - ID mata kuliah
 * @param {string} [periode] - Periode akademik (default: periode aktif saat ini)
 * @returns {Promise<Object>} Map mahasiswaId -> { tugasId: nilai }
 */
async function getNilaiByMkId(mkId, periode = getPeriodeAktif()) {
  // Jalur murah: query terfilter periode langsung di Firestore (cuma baca
  // dokumen yang benar-benar cocok, bukan seluruh riwayat).
  let snapshot = await db.collection('nilai')
    .where('mkId', '==', mkId)
    .where('periode', '==', periode)
    .get();

  if (snapshot.empty) {
    // Kemungkinan data lama belum ditandai `periode` (migrasi belum jalan).
    // Ambil semua utk MK ini sekali, lalu tandai otomatis (self-heal) supaya
    // panggilan berikutnya bisa lewat jalur murah di atas lagi.
    const semuaSnapshot = await db.collection('nilai').where('mkId', '==', mkId).get();
    const perluDitandai = semuaSnapshot.docs.filter(doc => !doc.data().periode);
    if (perluDitandai.length > 0) {
      await Promise.all(perluDitandai.map(doc => doc.ref.update({ periode }).catch(() => {})));
    }
    snapshot = semuaSnapshot;
  }

  const result = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const periodeData = data.periode || periode;
    if (periodeData !== periode) return;

    if (!result[data.mahasiswaId]) {
      result[data.mahasiswaId] = {};
    }
    // Extract tugasId dari tipe "tugas_<tugasId>"
    const tugasId = data.tipe.replace('tugas_', '');
    result[data.mahasiswaId][tugasId] = {
      nilai: data.nilai,
      judul: data.judulTugas,
      updatedAt: data.updatedAt
    };
  });
  
  return result;
}

/**
 * Mendapatkan semua tugas untuk suatu mata kuliah pada satu periode akademik
 * (default periode aktif), supaya tugas dari penawaran MK di periode lain
 * (mis. semester lalu) tidak ikut muncul.
 * @param {string} mkId - ID mata kuliah
 * @param {string} [periode] - Periode akademik (default: periode aktif saat ini)
 * @returns {Promise<Array>} Daftar tugas
 */
async function getTugasByMkId(mkId, periode = getPeriodeAktif()) {
  let snapshot;
  try {
    snapshot = await db.collection('tugas')
      .where('mkId', '==', mkId)
      .where('periode', '==', periode)
      .orderBy('deadline', 'asc')
      .get();
  } catch (indexError) {
    // Index composite (mkId, periode, deadline) belum siap di Firestore - mundur ke query aman
    console.error('Index tugas belum siap, fallback ke query tanpa periode:', indexError.message);
    snapshot = await db.collection('tugas').where('mkId', '==', mkId).get();
  }

  if (snapshot.empty) {
    // Fallback + self-heal: data lama mungkin belum ditandai periode
    const semuaSnapshot = await db.collection('tugas').where('mkId', '==', mkId).get();
    const perluDitandai = semuaSnapshot.docs.filter(doc => !doc.data().periode);
    if (perluDitandai.length > 0) {
      await Promise.all(perluDitandai.map(doc => doc.ref.update({ periode }).catch(() => {})));
    }
    snapshot = semuaSnapshot;
  }

  return snapshot.docs
    .filter(doc => (doc.data().periode || periode) === periode) // data lama tanpa periode dianggap periode aktif
    .sort((a, b) => (a.data().deadline || '').localeCompare(b.data().deadline || ''))
    .map(doc => ({
      id: doc.id,
      judul: doc.data().judul,
      deadline: doc.data().deadline,
      deskripsi: doc.data().deskripsi
    }));
}

/**
 * Mendapatkan nilai untuk satu mahasiswa pada satu tugas
 * @param {string} mahasiswaId - UID mahasiswa
 * @param {string} tugasId - ID tugas
 * @returns {Promise<Object|null>}
 */
async function getNilaiByTugasId(mahasiswaId, tugasId) {
  const tipeNilai = `tugas_${tugasId}`;
  const snapshot = await db.collection('nilai')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('tipe', '==', tipeNilai)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

/**
 * Menghitung nilai akhir satu mata kuliah berdasarkan bobot komponen.
 * Bobot: rata-rata tugas 40%, UTS 30%, UAS 30%.
 * Dipindahkan ke sini (dari routes/admin/nilai.js) supaya semua modul yang
 * butuh nilai akhir (admin, transkrip mahasiswa, KHS, dst) memakai satu
 * sumber logika yang sama alih-alih menduplikasi rumus di banyak file.
 *
 * @param {Object} nilaiMap - map nilai dengan key tipe (mis. 'tugas_x', 'UTS', 'UAS')
 * @returns {number|null} nilai akhir (0-100), atau null jika komponen belum lengkap
 */
function hitungNilaiAkhir(nilaiMap) {
  const tugasValues = [];
  let uts = null, uas = null;

  for (const [tipe, data] of Object.entries(nilaiMap)) {
    const nilaiValue = typeof data === 'object' ? data.nilai : data;
    if (tipe.toLowerCase().includes('tugas')) {
      tugasValues.push(nilaiValue);
    } else if (tipe.toUpperCase() === 'UTS') {
      uts = nilaiValue;
    } else if (tipe.toUpperCase() === 'UAS') {
      uas = nilaiValue;
    }
  }

  if (tugasValues.length === 0 || uts === null || uas === null) {
    return null; // komponen belum lengkap
  }

  const rataTugas = tugasValues.reduce((a, b) => a + b, 0) / tugasValues.length;
  const nilaiAkhir = (rataTugas * 0.4) + (uts * 0.3) + (uas * 0.3);
  return Math.round(nilaiAkhir * 100) / 100;
}

/**
 * Konversi nilai angka (skala 0-100) ke bobot IPK (skala 0-4), memakai
 * breakpoint huruf yang sama dengan yang dipakai di tampilan transkrip
 * (badge A/B/C/D/E: >=80/>=70/>=60/>=50/lainnya) supaya konsisten di
 * seluruh aplikasi, bukan konversi rasio sembarang.
 * @param {number} nilai - nilai 0-100
 * @returns {number} bobot 0-4
 */
function nilaiKeBobot(nilai) {
  if (nilai >= 80) return 4;
  if (nilai >= 70) return 3;
  if (nilai >= 60) return 2;
  if (nilai >= 50) return 1;
  return 0;
}

/**
 * Menyimpan satu nilai akhir (final) mata kuliah untuk mahasiswa ke koleksi 'grades'.
 * Ini adalah nilai resmi yang tercatat di transkrip/KHS/perhitungan IPK, diisi
 * manual oleh admin (lihat routes/admin/nilai.js) setelah meninjau rekap
 * komponen nilai (tugas/UTS/UAS) dari koleksi 'nilai'.
 *
 * @param {Object} data
 * @param {string} data.userId - UID mahasiswa
 * @param {string} data.kodeMk
 * @param {string} data.namaMk
 * @param {number} data.sks
 * @param {number} data.nilai - skala 0-100
 * @param {string} data.semester
 * @returns {Promise<{id: string}>}
 */
async function saveGradeFinal({ userId, kodeMk, namaMk, sks, nilai, semester }) {
  if (!userId || !kodeMk || !semester) {
    throw new Error('userId, kodeMk, dan semester wajib diisi');
  }
  const nilaiAngka = parseFloat(nilai);
  if (isNaN(nilaiAngka) || nilaiAngka < 0 || nilaiAngka > 100) {
    throw new Error('Nilai harus berupa angka 0-100');
  }

  // Cegah duplikat: satu mahasiswa hanya boleh punya satu nilai akhir per MK per semester
  const existingSnapshot = await db.collection('grades')
    .where('userId', '==', userId)
    .where('kodeMk', '==', kodeMk)
    .where('semester', '==', semester)
    .limit(1)
    .get();

  const now = new Date().toISOString();
  const payload = {
    userId,
    kodeMk,
    namaMk: namaMk || '-',
    sks: parseFloat(sks) || 0,
    nilai: nilaiAngka,
    semester,
    updatedAt: now
  };

  if (!existingSnapshot.empty) {
    const docRef = existingSnapshot.docs[0].ref;
    await docRef.update(payload);
    return { id: existingSnapshot.docs[0].id, isNew: false };
  }

  const docRef = await db.collection('grades').add({ ...payload, createdAt: now });
  return { id: docRef.id, isNew: true };
}

/**
 * Mengambil transkrip lengkap (semua nilai akhir yang sudah diinput admin) untuk
 * satu mahasiswa dari koleksi 'grades', beserta IPK terkonversi ke skala 0-4
 * (pakai breakpoint huruf yang sama dengan badge di tampilan transkrip).
 *
 * @param {string} mahasiswaId - UID mahasiswa
 * @returns {Promise<{items: Array, totalSKS: number, ipk: string}>}
 */
async function getTranskripMahasiswa(mahasiswaId) {
  const gradesSnapshot = await db.collection('grades')
    .where('userId', '==', mahasiswaId)
    .get();

  const items = gradesSnapshot.docs.map(doc => {
    const g = doc.data();
    return {
      id: doc.id,
      kodeMk: g.kodeMk || '-',
      namaMk: g.namaMk || '-',
      sks: parseFloat(g.sks) || 0,
      semester: g.semester || '-',
      nilai: g.nilai,
      createdAt: g.createdAt
    };
  });

  items.sort((a, b) => String(a.semester).localeCompare(String(b.semester)));

  let totalSKSDihitung = 0;
  let totalBobotNilai = 0;
  items.forEach(item => {
    if (item.nilai !== null && item.nilai !== undefined && item.sks > 0) {
      totalSKSDihitung += item.sks;
      totalBobotNilai += item.sks * nilaiKeBobot(item.nilai);
    }
  });

  const ipk = totalSKSDihitung > 0
    ? (totalBobotNilai / totalSKSDihitung).toFixed(2)
    : '0.00';

  return { items, totalSKS: totalSKSDihitung, ipk };
}

module.exports = {
  getPeriodeAktif,
  saveNilai,
  getNilaiByMkId,
  getTugasByMkId,
  getNilaiByTugasId,
  hitungNilaiAkhir,
  saveGradeFinal,
  getTranskripMahasiswa
};