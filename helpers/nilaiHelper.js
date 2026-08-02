// helpers/nilaiHelper.js
const { db } = require('../config/firebaseAdmin');
const { getCurrentAcademicSemester, getSemesterForDate } = require('./academicHelper');

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
  // Ambil SEMUA nilai untuk MK ini (tanpa filter periode di level query).
  // Sengaja begini (bukan `.where('periode','==',periode)`) supaya nilai
  // TUGAS tidak ikut terbuang di tahap query kalau field `periode` di
  // dokumennya kebetulan berbeda dari periode aktif sekarang - penyaringan
  // yang benar untuk tugas dilakukan di JS di bawah (lihat komentar `isTugas`).
  // Self-heal: dokumen lama yang belum punya field `periode` ditandai di sini.
  const snapshot = await db.collection('nilai').where('mkId', '==', mkId).get();

  const perluDitandai = snapshot.docs.filter(doc => !doc.data().periode);
  if (perluDitandai.length > 0) {
    await Promise.all(perluDitandai.map(doc => doc.ref.update({ periode }).catch(() => {})));
  }

  const result = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const isTugas = typeof data.tipe === 'string' && data.tipe.startsWith('tugas_');

    // Untuk nilai TUGAS: jangan disaring lagi lewat field `periode` di
    // dokumen 'nilai' - cakupan periodenya sudah ditentukan oleh tugasId
    // itu sendiri (lihat getTugasByMkId/getRataTugasByMkId yang sudah
    // menyaring tugasList berdasarkan periode). Ini mencegah nilai tugas
    // "hilang" kalau dokumen nilainya kebetulan tersimpan saat label
    // periode aktif sempat berbeda dari periode tugas induknya (mis. saat
    // ada penyesuaian batas bulan semester). Untuk tipe lain (UTS/UAS/dll)
    // filter periode tetap ketat seperti semula.
    if (!isTugas) {
      const periodeData = data.periode || periode;
      if (periodeData !== periode) return;
    }

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
  // Ambil SEMUA tugas untuk MK ini (tanpa filter periode di level query).
  // Sengaja begini: field `periode` yang tersimpan di dokumen bisa saja
  // salah/drift (mis. dibuat saat batas bulan semester sempat berbeda dari
  // yang sekarang berlaku) - jadi kita HITUNG ULANG periode yang seharusnya
  // dari tanggal asli tugas itu sendiri (deadline, atau createdAt kalau
  // deadline tidak ada), bukan cuma percaya field `periode` yang tersimpan.
  // Kalau hasil hitung ulang beda dari yang tersimpan, dokumennya langsung
  // diperbaiki (self-heal) supaya query berikutnya sudah benar dari awal.
  const snapshot = await db.collection('tugas').where('mkId', '==', mkId).get();

  const hasil = [];
  const perluDiperbaiki = [];

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const tanggalAcuan = data.deadline || data.createdAt;
    const periodeSeharusnya = tanggalAcuan
      ? getSemesterForDate(tanggalAcuan).label
      : (data.periode || periode);

    if (data.periode !== periodeSeharusnya) {
      perluDiperbaiki.push({ ref: doc.ref, periodeBaru: periodeSeharusnya });
    }

    if (periodeSeharusnya === periode) {
      hasil.push({
        id: doc.id,
        judul: data.judul,
        deadline: data.deadline,
        deskripsi: data.deskripsi
      });
    }
  });

  if (perluDiperbaiki.length > 0) {
    await Promise.all(perluDiperbaiki.map(p =>
      p.ref.update({ periode: p.periodeBaru }).catch(() => {})
    ));
  }

  return hasil.sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
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

// ============================================================================
// RUBRIK PENILAIAN (Kehadiran, Sikap, Keaktifan, Kuis, UTS, UAS, Tugas)
// ============================================================================
// Bagian ini menambahkan komponen penilaian yang belum ditangani oleh
// hitungNilaiAkhir() (yang hanya tahu tugas/UTS/UAS), yaitu: Kehadiran (dari
// jumlah pertemuan hadir), Sikap, Keaktifan, dan Kuis - dengan bobot yang bisa
// diatur per mata kuliah oleh dosen. Disimpan di koleksi yang sama ('nilai')
// supaya konsisten dengan alur yang sudah ada, memakai tipe baru:
//   'KEHADIRAN_JUMLAH' -> jumlah pertemuan hadir (angka, mis. 14)
//   'KEHADIRAN_TOTAL'  -> total pertemuan (angka, default 16)
//   'SIKAP'            -> nilai sikap (0-100)
//   'KEAKTIFAN'        -> nilai keaktifan (0-100)
//   'KUIS'             -> nilai kuis (0-100)
// (UTS/UAS memakai tipe 'UTS'/'UAS' yang sudah dipakai di alur lama.)

const TIPE_RUBRIK_KOMPONEN = ['KEHADIRAN_JUMLAH', 'KEHADIRAN_TOTAL', 'SIKAP', 'KEAKTIFAN', 'KUIS', 'UTS', 'UAS'];

/**
 * Bobot default rubrik (dipakai kalau dosen belum pernah mengatur bobot
 * untuk MK/periode ini). Total kelima bobot komponen akhir = 100, dan total
 * ketiga sub-bobot kehadiran = 100 - sama seperti default di template Excel.
 */
const BOBOT_DEFAULT = {
  kehadiran: 10,
  tugas: 20,
  kuis: 10,
  uts: 30,
  uas: 30,
  persenHadir: 50,
  sikap: 25,
  keaktifan: 25
};

/**
 * Simpan/ubah satu nilai komponen rubrik (kehadiran, sikap, keaktifan, kuis)
 * untuk satu mahasiswa pada satu MK. Upsert seperti saveNilai(), memakai
 * field `tipe` generik alih-alih format 'tugas_<id>'.
 */
async function saveKomponenRubrik(mahasiswaId, mkId, tipe, nilai, periode = getPeriodeAktif()) {
  if (!TIPE_RUBRIK_KOMPONEN.includes(tipe)) {
    throw new Error(`Tipe komponen rubrik tidak dikenal: ${tipe}`);
  }
  const nilaiAngka = parseFloat(nilai);
  const now = new Date().toISOString();

  const existingSnapshot = await db.collection('nilai')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('mkId', '==', mkId)
    .where('tipe', '==', tipe)
    .where('periode', '==', periode)
    .limit(1)
    .get();

  if (existingSnapshot.empty) {
    const docRef = await db.collection('nilai').add({
      mahasiswaId, mkId, tipe, nilai: nilaiAngka, periode, createdAt: now, updatedAt: now
    });
    return { id: docRef.id, isNew: true };
  } else {
    const docRef = existingSnapshot.docs[0].ref;
    await docRef.update({ nilai: nilaiAngka, updatedAt: now });
    return { id: existingSnapshot.docs[0].id, isNew: false };
  }
}

/**
 * Ambil seluruh komponen rubrik (kehadiran/sikap/keaktifan/kuis/uts/uas)
 * untuk semua mahasiswa pada satu MK+periode.
 * @returns {Promise<Object>} map mahasiswaId -> { tipe: nilai }
 */
async function getKomponenRubrikByMkId(mkId, periode = getPeriodeAktif()) {
  const snapshot = await db.collection('nilai')
    .where('mkId', '==', mkId)
    .where('periode', '==', periode)
    .get();

  const result = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!TIPE_RUBRIK_KOMPONEN.includes(data.tipe)) return; // lewati tipe 'tugas_...'
    if (!result[data.mahasiswaId]) result[data.mahasiswaId] = {};
    result[data.mahasiswaId][data.tipe] = data.nilai;
  });
  return result;
}

/**
 * Ambil bobot rubrik untuk satu MK+periode (koleksi 'rubrikBobot', 1 dokumen
 * per mkId+periode). Kembalikan default kalau dosen belum pernah mengatur.
 */
async function getBobotRubrik(mkId, periode = getPeriodeAktif()) {
  const snapshot = await db.collection('rubrikBobot')
    .where('mkId', '==', mkId)
    .where('periode', '==', periode)
    .limit(1)
    .get();
  if (snapshot.empty) return { ...BOBOT_DEFAULT };
  const data = snapshot.docs[0].data();
  return { ...BOBOT_DEFAULT, ...data.bobot };
}

/**
 * Simpan (upsert) bobot rubrik untuk satu MK+periode.
 * @param {Object} bobot - lihat BOBOT_DEFAULT untuk daftar key yang valid
 */
async function saveBobotRubrik(mkId, bobot, periode = getPeriodeAktif()) {
  const now = new Date().toISOString();
  const snapshot = await db.collection('rubrikBobot')
    .where('mkId', '==', mkId)
    .where('periode', '==', periode)
    .limit(1)
    .get();

  const payload = { mkId, periode, bobot: { ...BOBOT_DEFAULT, ...bobot }, updatedAt: now };

  if (snapshot.empty) {
    const docRef = await db.collection('rubrikBobot').add({ ...payload, createdAt: now });
    return { id: docRef.id, isNew: true };
  } else {
    await snapshot.docs[0].ref.update(payload);
    return { id: snapshot.docs[0].id, isNew: false };
  }
}

/**
 * Hitung rekap rubrik lengkap untuk satu mahasiswa: nilai kehadiran akhir
 * (gabungan % hadir + sikap + keaktifan), rata-rata tugas, kuis, UTS, UAS,
 * nilai akhir, nilai huruf, dan keterangan lulus/tidak - sesuai bobot yang
 * diberikan. Fungsi murni (tidak akses DB) supaya mudah dipakai ulang di
 * halaman dosen, admin, maupun cetak.
 *
 * @param {Object} komponen - { KEHADIRAN_JUMLAH, KEHADIRAN_TOTAL, SIKAP, KEAKTIFAN, KUIS, UTS, UAS }
 * @param {number|null} rataTugas - rata-rata nilai tugas mahasiswa ini (dari koleksi 'tugas'/'nilai')
 * @param {Object} bobot - lihat BOBOT_DEFAULT
 * @returns {Object} { persenHadir, kehadiranAkhir, rataTugas, kuis, uts, uas, nilaiAkhir, huruf, keterangan }
 */
function hitungRubrik(komponen, rataTugas, bobot = BOBOT_DEFAULT) {
  const jumlahHadir = komponen.KEHADIRAN_JUMLAH;
  const totalPertemuan = komponen.KEHADIRAN_TOTAL || 16;
  const persenHadir = (jumlahHadir === undefined || jumlahHadir === null)
    ? null
    : Math.min(100, (parseFloat(jumlahHadir) / totalPertemuan) * 100);

  const sikap = komponen.SIKAP ?? null;
  const keaktifan = komponen.KEAKTIFAN ?? null;
  const kuis = komponen.KUIS ?? null;
  const uts = komponen.UTS ?? null;
  const uas = komponen.UAS ?? null;

  // --- Sub-komponen Kehadiran (% Hadir, Sikap, Keaktifan) ---
  // Komponen dengan bobot 0 (atau tidak diisi bobotnya) dianggap TIDAK
  // DIPAKAI oleh dosen ini (mis. tidak pernah menilai Keaktifan terpisah),
  // sehingga tidak ikut disyaratkan maupun dihitung. Kehadiran Akhir hanya
  // butuh komponen yang bobotnya > 0 dan sudah diisi.
  const subKomponen = [
    { label: '% Hadir', nilai: persenHadir, bobot: bobot.persenHadir },
    { label: 'Sikap', nilai: sikap, bobot: bobot.sikap },
    { label: 'Keaktifan', nilai: keaktifan, bobot: bobot.keaktifan }
  ].filter(k => (k.bobot || 0) > 0);

  const subBelumLengkap = subKomponen.filter(k => k.nilai === null || k.nilai === undefined).map(k => k.label);

  let kehadiranAkhir = null;
  if (subKomponen.length > 0 && subBelumLengkap.length === 0) {
    const totalSub = subKomponen.reduce((s, k) => s + k.bobot, 0);
    kehadiranAkhir = totalSub > 0
      ? subKomponen.reduce((s, k) => s + k.nilai * k.bobot, 0) / totalSub
      : null;
  }

  // --- Nilai Akhir (Kehadiran, Tugas, Kuis, UTS, UAS) ---
  // Sama seperti di atas: komponen dengan bobot 0 (mis. Kuis dihilangkan
  // karena dosen tidak pernah kuis) tidak ikut disyaratkan/dihitung, dan
  // sisa bobot komponen yang dipakai dinormalisasi otomatis ke 100%.
  const komponenAkhir = [
    { label: 'Kehadiran', nilai: kehadiranAkhir, bobot: bobot.kehadiran },
    { label: 'Tugas', nilai: rataTugas, bobot: bobot.tugas },
    { label: 'Kuis', nilai: kuis, bobot: bobot.kuis },
    { label: 'UTS', nilai: uts, bobot: bobot.uts },
    { label: 'UAS', nilai: uas, bobot: bobot.uas }
  ].filter(k => (k.bobot || 0) > 0);

  // Kalau Kehadiran dipakai (bobot>0) tapi sub-komponennya belum lengkap,
  // laporkan sub-komponen yang kurang itu (lebih informatif daripada cuma
  // bilang "Kehadiran belum lengkap").
  const belumLengkap = [];
  komponenAkhir.forEach(k => {
    if (k.label === 'Kehadiran' && (k.nilai === null || k.nilai === undefined)) {
      belumLengkap.push(...(subBelumLengkap.length > 0 ? subBelumLengkap : ['Kehadiran']));
    } else if (k.nilai === null || k.nilai === undefined) {
      belumLengkap.push(k.label);
    }
  });

  let nilaiAkhir = null;
  if (komponenAkhir.length > 0 && belumLengkap.length === 0) {
    const totalBobot = komponenAkhir.reduce((s, k) => s + k.bobot, 0);
    if (totalBobot > 0) {
      nilaiAkhir = komponenAkhir.reduce((s, k) => s + k.nilai * k.bobot, 0) / totalBobot;
      nilaiAkhir = Math.round(nilaiAkhir * 100) / 100;
    }
  }

  return {
    persenHadir: persenHadir !== null ? Math.round(persenHadir * 100) / 100 : null,
    jumlahHadir: jumlahHadir ?? null,
    totalPertemuan,
    sikap, keaktifan, kuis, uts, uas,
    kehadiranAkhir: kehadiranAkhir !== null ? Math.round(kehadiranAkhir * 100) / 100 : null,
    rataTugas: (rataTugas !== null && rataTugas !== undefined) ? Math.round(rataTugas * 100) / 100 : null,
    nilaiAkhir,
    huruf: nilaiKeHurufRubrik(nilaiAkhir),
    keterangan: nilaiAkhir === null ? null : (nilaiAkhir >= 45 ? 'LULUS' : 'TIDAK LULUS'),
    belumLengkap // array label komponen yang masih kosong (bobot>0 tapi belum diisi); kosong berarti sudah lengkap
  };
}

/**
 * Konversi nilai 0-100 ke huruf, TANPA A- dan B- (sesuai kebijakan prodi):
 * A (>=85), B+ (75-84), B (65-74), C+ (55-64), C (45-54), D (35-44), E (<35).
 */
function nilaiKeHurufRubrik(nilai) {
  if (nilai === null || nilai === undefined) return null;
  if (nilai >= 85) return 'A';
  if (nilai >= 75) return 'B+';
  if (nilai >= 65) return 'B';
  if (nilai >= 55) return 'C+';
  if (nilai >= 45) return 'C';
  if (nilai >= 35) return 'D';
  return 'E';
}

/**
 * Ambil rata-rata nilai tugas per mahasiswa untuk satu MK (mengandalkan
 * getTugasByMkId yang sudah ada, supaya tetap satu sumber data tugas dengan
 * modul e-learning yang sudah berjalan).
 *
 * PENTING: nilai per tugas diambil langsung lewat mkId + tipe ('tugas_<id>'),
 * SAMA PERSIS seperti cara halaman 'Daftar Tugas' (routes/dosen/index.js,
 * GET /tugas/:id) membaca nilai - BUKAN lewat getNilaiByMkId(mkId, periode).
 * Alasannya: cakupan periode tugas sudah ditentukan oleh getTugasByMkId
 * (tugasList hanya berisi tugas milik periode aktif). Kalau nilai ikut
 * disaring lagi pakai field `periode` di dokumen 'nilai', nilai bisa
 * "hilang" dari rubrik ketika dokumen nilai itu tersimpan pada saat label
 * periode aktif sempat berbeda dari periode tugasnya (mis. karena
 * penyesuaian batas bulan semester) - padahal nilainya tetap tampil normal
 * di halaman Daftar Tugas karena halaman itu tidak memfilter periode sama
 * sekali. Dengan menyaring lewat tugasId (bukan field periode di 'nilai'),
 * rubrik selalu konsisten dengan apa yang dosen lihat di Daftar Tugas.
 *
 * @returns {Promise<Object>} map mahasiswaId -> rata-rata tugas (number|null)
 */
/**
 * ============================================================================
 * TUGAS MANUAL - untuk tugas yang diberikan TIDAK lewat web (mis. dikerjakan
 * di kertas, presentasi lisan, praktikum tanpa upload, dll) tapi tetap ingin
 * ikut dihitung sebagai bagian dari rata-rata "Tugas" di Rubrik, berdampingan
 * dengan tugas yang dibuat lewat menu Kelola Tugas.
 * ============================================================================
 * Disimpan di koleksi terpisah 'tugasManual' (bukan 'tugas', supaya tidak
 * tercampur dengan modul e-learning/pengumpulan file yang sudah ada).
 * Nilainya tetap disimpan di koleksi 'nilai' yang sama, memakai tipe
 * `tugasmanual_<id>` (prefix beda dari `tugas_<id>` supaya tidak pernah
 * bentrok/tertukar).
 */

async function tambahTugasManual(mkId, dosenId, judul, periode = getPeriodeAktif()) {
  const now = new Date().toISOString();
  const docRef = await db.collection('tugasManual').add({
    mkId, dosenId, judul, periode, createdAt: now
  });
  return { id: docRef.id };
}

async function hapusTugasManual(tugasManualId) {
  await db.collection('tugasManual').doc(tugasManualId).delete();
  // Ikut hapus semua nilai yang sudah terlanjur diisi utk tugas manual ini,
  // supaya tidak jadi data nyasar (orphan) di koleksi 'nilai'.
  const snapshot = await db.collection('nilai').where('tipe', '==', `tugasmanual_${tugasManualId}`).get();
  await Promise.all(snapshot.docs.map(doc => doc.ref.delete().catch(() => {})));
}

/**
 * Ambil daftar tugas manual untuk satu MK+periode, direkonsiliasi dengan
 * prinsip yang sama seperti getTugasByMkId (hitung ulang periode dari
 * createdAt-nya sendiri, self-heal kalau ternyata drift).
 */
async function getTugasManualByMkId(mkId, periode = getPeriodeAktif()) {
  const snapshot = await db.collection('tugasManual').where('mkId', '==', mkId).get();

  const hasil = [];
  const perluDiperbaiki = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const periodeSeharusnya = data.createdAt ? getSemesterForDate(data.createdAt).label : (data.periode || periode);
    if (data.periode !== periodeSeharusnya) {
      perluDiperbaiki.push({ ref: doc.ref, periodeBaru: periodeSeharusnya });
    }
    if (periodeSeharusnya === periode) {
      hasil.push({ id: doc.id, judul: data.judul, createdAt: data.createdAt, manual: true });
    }
  });

  if (perluDiperbaiki.length > 0) {
    await Promise.all(perluDiperbaiki.map(p => p.ref.update({ periode: p.periodeBaru }).catch(() => {})));
  }

  return hasil.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

/**
 * Simpan/ubah nilai satu mahasiswa untuk satu tugas manual (upsert, sama
 * polanya dengan saveKomponenRubrik).
 */
async function saveNilaiTugasManual(mahasiswaId, mkId, tugasManualId, nilai, periode = getPeriodeAktif()) {
  const tipe = `tugasmanual_${tugasManualId}`;
  const nilaiAngka = parseFloat(nilai);
  const now = new Date().toISOString();

  const existingSnapshot = await db.collection('nilai')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('mkId', '==', mkId)
    .where('tipe', '==', tipe)
    .limit(1)
    .get();

  if (existingSnapshot.empty) {
    const docRef = await db.collection('nilai').add({
      mahasiswaId, mkId, tipe, nilai: nilaiAngka, periode, createdAt: now, updatedAt: now
    });
    return { id: docRef.id, isNew: true };
  } else {
    await existingSnapshot.docs[0].ref.update({ nilai: nilaiAngka, updatedAt: now });
    return { id: existingSnapshot.docs[0].id, isNew: false };
  }
}

/**
 * Gabungkan tugas dari web (getTugasByMkId) + tugas manual
 * (getTugasManualByMkId) jadi satu daftar tunggal, dan ambil semua nilainya
 * sekaligus (satu query 'nilai' per MK). Dipakai bersama oleh
 * getRataTugasByMkId & getRincianTugasByMkId supaya keduanya selalu
 * konsisten satu sama lain, dan supaya tugas manual otomatis ikut masuk ke
 * rata-rata Tugas tanpa perlu logika terpisah.
 */
async function _getSemuaTugasDenganNilai(mkId, periode) {
  const [tugasWeb, tugasManual] = await Promise.all([
    getTugasByMkId(mkId, periode),
    getTugasManualByMkId(mkId, periode)
  ]);
  const semuaTugas = [...tugasWeb, ...tugasManual]; // tugas web dulu, baru manual

  if (semuaTugas.length === 0) return { semuaTugas, perMahasiswa: {} };

  const tipeMap = new Map(); // tipe -> tugasId
  tugasWeb.forEach(t => tipeMap.set(`tugas_${t.id}`, t.id));
  tugasManual.forEach(t => tipeMap.set(`tugasmanual_${t.id}`, t.id));

  const snapshot = await db.collection('nilai').where('mkId', '==', mkId).get();
  const perMahasiswa = {}; // mahasiswaId -> { tugasId: nilai }
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    if (!tipeMap.has(data.tipe)) return;
    const tugasId = tipeMap.get(data.tipe);
    if (!perMahasiswa[data.mahasiswaId]) perMahasiswa[data.mahasiswaId] = {};
    perMahasiswa[data.mahasiswaId][tugasId] = data.nilai;
  });

  return { semuaTugas, perMahasiswa };
}

/**
 * Rata-rata nilai tugas (WEB + MANUAL digabung) per mahasiswa untuk satu MK.
 * Lihat _getSemuaTugasDenganNilai untuk penjelasan penggabungannya, dan
 * komentar panjang sebelumnya soal kenapa nilai tugas TIDAK disaring lagi
 * lewat field periode di dokumen 'nilai' itu sendiri.
 * @returns {Promise<Object>} map mahasiswaId -> rata-rata tugas (number|null)
 */
async function getRataTugasByMkId(mkId, periode = getPeriodeAktif()) {
  const { semuaTugas, perMahasiswa } = await _getSemuaTugasDenganNilai(mkId, periode);
  if (semuaTugas.length === 0) return {};

  const result = {};
  Object.keys(perMahasiswa).forEach(mahasiswaId => {
    const nilaiValid = semuaTugas
      .map(t => perMahasiswa[mahasiswaId][t.id])
      .filter(v => v !== undefined && v !== null);
    result[mahasiswaId] = nilaiValid.length > 0
      ? nilaiValid.reduce((a, b) => a + b, 0) / nilaiValid.length
      : null;
  });
  return result;
}

/**
 * Sama seperti getRataTugasByMkId, tapi mengembalikan RINCIAN per-tugas
 * (WEB + MANUAL digabung, manual ditandai `manual: true`) - dipakai halaman
 * "Rincian Tugas" supaya dosen bisa melihat akumulasi semua tugas per
 * mahasiswa, termasuk yang diberikan di luar web.
 *
 * @returns {Promise<Object>} {
 *   tugasList: [{ id, judul, deadline?, manual? }, ...],
 *   perMahasiswa: { mahasiswaId: { tugasId: nilai|null, rata: number|null } }
 * }
 */
async function getRincianTugasByMkId(mkId, periode = getPeriodeAktif()) {
  const { semuaTugas, perMahasiswa: nilaiPerMahasiswa } = await _getSemuaTugasDenganNilai(mkId, periode);
  if (semuaTugas.length === 0) return { tugasList: [], perMahasiswa: {} };

  const perMahasiswa = {};
  Object.keys(nilaiPerMahasiswa).forEach(mahasiswaId => {
    const nilaiMap = {};
    const nilaiValid = [];
    semuaTugas.forEach(t => {
      const v = nilaiPerMahasiswa[mahasiswaId][t.id];
      nilaiMap[t.id] = (v === undefined) ? null : v;
      if (v !== undefined && v !== null) nilaiValid.push(v);
    });
    perMahasiswa[mahasiswaId] = {
      ...nilaiMap,
      rata: nilaiValid.length > 0
        ? Math.round((nilaiValid.reduce((a, b) => a + b, 0) / nilaiValid.length) * 100) / 100
        : null
    };
  });

  return { tugasList: semuaTugas, perMahasiswa };
}

module.exports = {
  getPeriodeAktif,
  saveNilai,
  getNilaiByMkId,
  getTugasByMkId,
  getNilaiByTugasId,
  hitungNilaiAkhir,
  saveGradeFinal,
  getTranskripMahasiswa,
  // --- Rubrik Penilaian ---
  BOBOT_DEFAULT,
  saveKomponenRubrik,
  getKomponenRubrikByMkId,
  getBobotRubrik,
  saveBobotRubrik,
  hitungRubrik,
  nilaiKeHurufRubrik,
  getRataTugasByMkId,
  getRincianTugasByMkId,
  tambahTugasManual,
  hapusTugasManual,
  getTugasManualByMkId,
  saveNilaiTugasManual
};