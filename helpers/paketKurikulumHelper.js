/**
 * helpers/paketKurikulumHelper.js
 *
 * "Paket KRS" per semester kurikulum (1, 2, 3, dst), dipakai untuk
 * OTOMATIS mengaktifkan KRS + enrollment mahasiswa begitu admin
 * menetapkan progres semester mahasiswa (field `semester` di profil,
 * mis. "Semester 1") dan status mahasiswa "Aktif".
 *
 * PENTING - konsep yang dipakai di sini:
 * - `jenis` di sini adalah metadata KURIKULUM (Wajib Umum / Penciri
 *   Dewantara / Inti Keahlian), disimpan di konfigurasi paket ini, BUKAN
 *   field baru di collection `mataKuliah`. Ini supaya tidak perlu migrasi
 *   skema mataKuliah - cukup dicocokkan lewat `kode` MK saat dipakai.
 * - Mulai semester 3, paket bercabang menurut `konsentrasi` mahasiswa
 *   ("Instrumentasi" / "Telekomunikasi"). Field `konsentrasi` ada di
 *   profil mahasiswa (collection `users`), diisi admin.
 * - Kalau kurikulum semester tsb sama untuk semua konsentrasi (semester 1
 *   & 2), taruh di bawah key `null` (artinya "semua konsentrasi").
 *
 * Untuk menambah semester baru, cukup tambah entri baru di PAKET_KURIKULUM.
 */

const PAKET_KURIKULUM = {
  1: {
    null: [
      // CATATAN: mata kuliah "Pendidikan Agama" TIDAK ditaruh statis di sini,
      // karena kodenya berbeda per agama (WUD2201 Islam, WUD2202 Kristen,
      // WUD2203 Katolik, WUD2204 Hindu, WUD2205 Budha - lihat scripts/seed-
      // matakuliah-2026.js). Sejak profil mahasiswa (collection `users`)
      // punya field `agama`, aktifkanPaketKrs() di bawah membaca field itu
      // dan MENAMBAHKAN kode yang sesuai secara dinamis ke paket semester 1
      // sebelum enrollment dibuat - lihat KODE_AGAMA + AGAMA_OPTIONS.
      { kode: 'WUD3208', jenis: 'Wajib Umum' },
      { kode: 'WUD3209', jenis: 'Wajib Umum' },
      { kode: 'PD3201', jenis: 'Penciri Dewantara' },
      { kode: 'PD3202', jenis: 'Penciri Dewantara' },
      { kode: 'PD3203', jenis: 'Penciri Dewantara' },
      { kode: 'PD3204', jenis: 'Penciri Dewantara' }
    ]
  },
  2: {
    null: [
      { kode: 'WUD2206', jenis: 'Wajib Umum' },
      { kode: 'PD3205', jenis: 'Penciri Dewantara' },
      { kode: 'PD3206', jenis: 'Penciri Dewantara' },
      { kode: 'PD3207', jenis: 'Penciri Dewantara' },
      { kode: 'PD3208', jenis: 'Penciri Dewantara' },
      { kode: 'PD3209', jenis: 'Penciri Dewantara' },
      { kode: 'PD3210', jenis: 'Penciri Dewantara' }
    ]
  },
  3: {
    Instrumentasi: [
      { kode: 'WUD2207', jenis: 'Wajib Umum' },
      { kode: 'PEK3201', jenis: 'Inti Keahlian' },
      { kode: 'PEK3202', jenis: 'Inti Keahlian' },
      { kode: 'PEK3203', jenis: 'Inti Keahlian' },
      { kode: 'PEK3204', jenis: 'Inti Keahlian' },
      { kode: 'PEK3205', jenis: 'Inti Keahlian' },
      { kode: 'PEK3206', jenis: 'Inti Keahlian' }
    ],
    Telekomunikasi: [
      { kode: 'WUD2207', jenis: 'Wajib Umum' },
      { kode: 'PEK3207', jenis: 'Inti Keahlian' },
      { kode: 'PEK3208', jenis: 'Inti Keahlian' },
      { kode: 'PEK3209', jenis: 'Inti Keahlian' },
      { kode: 'PEK3210', jenis: 'Inti Keahlian' },
      { kode: 'PEK3205', jenis: 'Inti Keahlian' },
      { kode: 'PEK3206', jenis: 'Inti Keahlian' }
    ]
  }
};

// Kode MK "Pendidikan Agama" per agama (semester 1). Urutan array di bawah
// ("AGAMA_OPTIONS") SENGAJA mengikuti urutan kode WUD2201-5 di RPS:
// 1=Islam, 2=Kristen, 3=Katolik, 4=Hindu, 5=Budha - dipakai otomatis oleh
// aktifkanPaketKrs() di bawah untuk menentukan mata kuliah agama mahasiswa
// semester 1 berdasarkan field `agama` di profil (collection `users`).
const KODE_AGAMA = {
  Islam: 'WUD2201',
  Kristen: 'WUD2202',
  Katolik: 'WUD2203',
  Hindu: 'WUD2204',
  Budha: 'WUD2205'
};

// Pilihan agama yang valid (dipakai di form profil mahasiswa & validasi).
// Urutan ini = urutan kode WUD2201-5 (1 Islam, 2 Kristen, 3 Katolik,
// 4 Hindu, 5 Budha).
const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Budha'];

// Default agama untuk mahasiswa baru kalau tidak diisi eksplisit saat
// pembuatan akun - admin bisa mengubahnya kapan saja lewat form edit
// mahasiswa (field ini TIDAK mengunci apa pun, murni nilai awal).
const DEFAULT_AGAMA = 'Islam';

// Daftar pilihan konsentrasi yang valid (dipakai di form profil mahasiswa)
const KONSENTRASI_OPTIONS = ['Instrumentasi', 'Telekomunikasi'];

// Mulai semester berapa mahasiswa WAJIB punya konsentrasi supaya paket
// bisa ditentukan (di bawah semester ini, konsentrasi belum relevan).
const SEMESTER_MULAI_KONSENTRASI = 3;

/**
 * Ambil daftar kode MK untuk 1 semester kurikulum + konsentrasi (kalau perlu).
 * @param {number} semesterNumber - 1, 2, 3, dst (angka kurikulum, bukan "Ganjil/Genap")
 * @param {string|null} konsentrasi - "Instrumentasi" / "Telekomunikasi" / null
 * @returns {Array<{kode:string, jenis:string}>|null} null kalau semester tidak dikenal
 *   atau (untuk semester >= SEMESTER_MULAI_KONSENTRASI) konsentrasi belum diisi.
 */
function getPaketMk(semesterNumber, konsentrasi) {
  const paketSemester = PAKET_KURIKULUM[semesterNumber];
  if (!paketSemester) return null;

  if (semesterNumber >= SEMESTER_MULAI_KONSENTRASI) {
    if (!konsentrasi || !paketSemester[konsentrasi]) return null;
    return paketSemester[konsentrasi];
  }
  return paketSemester[null] || null;
}

/**
 * Parse "Semester 3" -> 3. Return null kalau formatnya tidak dikenali.
 */
function parseSemesterNumber(semesterLabel) {
  if (!semesterLabel) return null;
  const match = String(semesterLabel).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Aktifkan paket KRS 1 semester kurikulum untuk seorang mahasiswa:
 * cari mataKuliah berdasarkan kode di paket, lalu buat KRS (status
 * approved) + enrollment aktif untuk periode akademik berjalan.
 * Dipakai otomatis saat admin set semester+status aktif, TAPI juga bisa
 * dipanggil manual (mis. tombol "Terapkan Paket" di form Buat KRS).
 *
 * @param {object} db - Firestore instance
 * @param {string} mahasiswaId
 * @param {number} semesterNumber
 * @param {string|null} konsentrasi
 * @param {string} academicLabel - mis. "Ganjil 2026/2027"
 * @param {string} actorId - uid admin yang men-trigger
 * @returns {Promise<{ok:boolean, message:string, jumlahBaru?:number, kodeTidakDitemukan?:string[]}>}
 */
async function aktifkanPaketKrs(db, mahasiswaId, semesterNumber, konsentrasi, academicLabel, actorId) {
  const paketDasar = getPaketMk(semesterNumber, konsentrasi);
  if (!paketDasar) {
    if (semesterNumber >= SEMESTER_MULAI_KONSENTRASI && !konsentrasi) {
      return {
        ok: false,
        message: `Paket KRS Semester ${semesterNumber} berbeda menurut konsentrasi - isi dulu field "Konsentrasi" mahasiswa ini sebelum paket bisa diaktifkan otomatis.`
      };
    }
    return {
      ok: false,
      message: `Belum ada konfigurasi paket kurikulum untuk Semester ${semesterNumber}${konsentrasi ? ' / ' + konsentrasi : ''}. Silakan tambahkan KRS secara manual, atau lengkapi PAKET_KURIKULUM di helpers/paketKurikulumHelper.js.`
    };
  }

  // Salin paket dasar supaya tidak mengubah PAKET_KURIKULUM asli.
  let paket = [...paketDasar];

  // Khusus Semester 1: sisipkan mata kuliah "Pendidikan Agama" yang sesuai
  // berdasarkan field `agama` di profil mahasiswa (collection `users`).
  // Default ke DEFAULT_AGAMA kalau field-nya kosong/belum diisi/tidak valid
  // (mis. data lama sebelum field ini ada) - admin bisa mengoreksi lewat
  // form edit mahasiswa lalu jalankan ulang aktivasi paket kapan saja.
  let agamaDipakai = null;
  if (semesterNumber === 1) {
    const mahasiswaSnap = await db.collection('users').doc(mahasiswaId).get();
    const agamaProfil = mahasiswaSnap.exists ? mahasiswaSnap.data().agama : null;
    agamaDipakai = AGAMA_OPTIONS.includes(agamaProfil) ? agamaProfil : DEFAULT_AGAMA;
    paket = [...paket, { kode: KODE_AGAMA[agamaDipakai], jenis: 'Wajib Umum' }];
  }

  // Cari mataKuliah berdasarkan kode (paralel)
  const kodeList = paket.map(p => p.kode);
  const mkSnapshots = await Promise.all(
    kodeList.map(kode => db.collection('mataKuliah').where('kode', '==', kode).limit(1).get())
  );

  const mkIds = [];
  const kodeTidakDitemukan = [];
  mkSnapshots.forEach((snap, i) => {
    if (snap.empty) kodeTidakDitemukan.push(kodeList[i]);
    else mkIds.push(snap.docs[0].id);
  });

  if (mkIds.length === 0) {
    return {
      ok: false,
      message: `Tidak ada mata kuliah paket Semester ${semesterNumber}${konsentrasi ? ' / ' + konsentrasi : ''} yang ditemukan di data Mata Kuliah (kode dicari: ${kodeList.join(', ')}). Pastikan mata kuliah sudah dibuat di menu Mata Kuliah dengan kode yang persis sama.`,
      kodeTidakDitemukan
    };
  }

  const hasil = await createKrsDanEnrollment(db, mahasiswaId, mkIds, academicLabel, actorId, {
    dibuatOlehSistem: true,
    catatan: `Paket KRS otomatis Semester ${semesterNumber}${konsentrasi ? ' (' + konsentrasi + ')' : ''}`
  });

  let message = `Paket KRS Semester ${semesterNumber}${konsentrasi ? ' / ' + konsentrasi : ''} diaktifkan: ${hasil.jumlahBaru} mata kuliah baru (dari ${mkIds.length} paket).`;
  if (kodeTidakDitemukan.length > 0) {
    message += ` PERHATIAN: kode berikut tidak ditemukan di data Mata Kuliah dan DILEWATI: ${kodeTidakDitemukan.join(', ')}.`;
  }
  if (semesterNumber === 1 && agamaDipakai) {
    message += ` Mata kuliah Pendidikan Agama disertakan otomatis: ${agamaDipakai} (${KODE_AGAMA[agamaDipakai]}) - sesuai field "Agama" di profil mahasiswa. Kalau agamanya salah/berubah, ubah dulu lewat form edit mahasiswa, lalu jalankan ulang aktivasi paket (mata kuliah agama lama TIDAK otomatis dihapus - hapus manual lewat "Buat KRS" kalau perlu).`;
  }

  return { ok: true, message, jumlahBaru: hasil.jumlahBaru, kodeTidakDitemukan };
}

/**
 * Inti pembuatan KRS (status approved langsung) + enrollment aktif untuk
 * daftar mkId tertentu. Dipakai bersama oleh:
 * - routes/admin/krs.js (POST /buat/:mahasiswaId - pilih manual)
 * - aktifkanPaketKrs() di atas (pilih otomatis dari paket kurikulum)
 * Supaya logic pembuatan KRS+enrollment tidak terduplikasi di 2 tempat.
 */
async function createKrsDanEnrollment(db, mahasiswaId, mkIds, academicLabel, actorId, opts = {}) {
  const batch = db.batch();

  const krsRef = db.collection('krs').doc();
  batch.set(krsRef, {
    userId: mahasiswaId,
    semester: academicLabel,
    mataKuliah: mkIds,
    status: 'approved',
    dibuatOlehAdmin: true,
    dibuatOlehSistem: !!opts.dibuatOlehSistem,
    catatan: opts.catatan || null,
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: actorId
  });

  const enrollmentChecks = await Promise.all(mkIds.map(mkId =>
    db.collection('enrollment')
      .where('userId', '==', mahasiswaId)
      .where('mkId', '==', mkId)
      .where('semester', '==', academicLabel)
      .where('status', '==', 'active')
      .limit(1)
      .get()
  ));

  let jumlahBaru = 0;
  for (let i = 0; i < mkIds.length; i++) {
    if (enrollmentChecks[i].empty) {
      const enrollmentRef = db.collection('enrollment').doc();
      batch.set(enrollmentRef, {
        userId: mahasiswaId,
        mkId: mkIds[i],
        semester: academicLabel,
        status: 'active',
        createdAt: new Date().toISOString(),
        approvedBy: actorId,
        krsId: krsRef.id
      });
      jumlahBaru++;
    }
  }

  await batch.commit();
  return { krsId: krsRef.id, jumlahBaru };
}

/**
 * SINKRONISASI penuh KRS+enrollment mahasiswa untuk 1 periode akademik ke
 * daftar mkIds yang diberikan - dipakai oleh form "Buat KRS" (custom oleh
 * admin), BEDA dari createKrsDanEnrollment() yang cuma nambah:
 * - mkId yang BELUM aktif tapi ada di `mkIds` -> dibuat enrollment baru (aktif)
 * - mkId yang SUDAH aktif dan tetap ada di `mkIds` -> dibiarkan (tidak disentuh)
 * - mkId yang SUDAH aktif tapi TIDAK ada lagi di `mkIds` -> DIBATALKAN
 *   (status enrollment jadi 'dibatalkan'), karena artinya admin sengaja
 *   menghapus centangnya di form.
 * Ini yang bikin form "Buat KRS" benar-benar jadi editor KRS mahasiswa
 * (custom penuh - tambah maupun kurangi mata kuliah), bukan cuma
 * penambah paket otomatis.
 *
 * @param {object} db
 * @param {string} mahasiswaId
 * @param {string[]} mkIds - daftar akhir mataKuliah yang harus aktif
 * @param {string} academicLabel
 * @param {string} actorId
 * @returns {Promise<{krsId:string, jumlahBaru:number, jumlahDibatalkan:number}>}
 */
async function syncKrsDanEnrollment(db, mahasiswaId, mkIds, academicLabel, actorId) {
  const mkIdSet = new Set(mkIds);

  // Enrollment aktif mahasiswa ini untuk periode akademik yang sama
  const activeSnapshot = await db.collection('enrollment')
    .where('userId', '==', mahasiswaId)
    .where('semester', '==', academicLabel)
    .where('status', '==', 'active')
    .get();

  const activeByMkId = new Map();
  activeSnapshot.docs.forEach(doc => activeByMkId.set(doc.data().mkId, doc));

  const batch = db.batch();

  const krsRef = db.collection('krs').doc();
  batch.set(krsRef, {
    userId: mahasiswaId,
    semester: academicLabel,
    mataKuliah: mkIds,
    status: 'approved',
    dibuatOlehAdmin: true,
    dibuatOlehSistem: false,
    catatan: 'Disesuaikan manual oleh admin lewat "Buat KRS"',
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: actorId
  });

  // Tambah enrollment baru untuk mkId yang belum aktif
  let jumlahBaru = 0;
  for (const mkId of mkIds) {
    if (!activeByMkId.has(mkId)) {
      const enrollmentRef = db.collection('enrollment').doc();
      batch.set(enrollmentRef, {
        userId: mahasiswaId,
        mkId,
        semester: academicLabel,
        status: 'active',
        createdAt: new Date().toISOString(),
        approvedBy: actorId,
        krsId: krsRef.id
      });
      jumlahBaru++;
    }
  }

  // Batalkan enrollment aktif yang tidak lagi dicentang
  let jumlahDibatalkan = 0;
  for (const [mkId, doc] of activeByMkId.entries()) {
    if (!mkIdSet.has(mkId)) {
      batch.update(doc.ref, {
        status: 'dibatalkan',
        dibatalkanAt: new Date().toISOString(),
        dibatalkanOleh: actorId,
        dibatalkanKarena: 'Dihapus dari KRS oleh admin lewat "Buat KRS"'
      });
      jumlahDibatalkan++;
    }
  }

  await batch.commit();
  return { krsId: krsRef.id, jumlahBaru, jumlahDibatalkan };
}

module.exports = {
  PAKET_KURIKULUM,
  KODE_AGAMA,
  AGAMA_OPTIONS,
  DEFAULT_AGAMA,
  KONSENTRASI_OPTIONS,
  SEMESTER_MULAI_KONSENTRASI,
  getPaketMk,
  parseSemesterNumber,
  aktifkanPaketKrs,
  createKrsDanEnrollment,
  syncKrsDanEnrollment
};
