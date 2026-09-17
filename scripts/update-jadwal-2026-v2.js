/**
 * scripts/update-jadwal-2026-v2.js
 *
 * UPDATE dari scripts/setup-jadwal-semester1-2026.js &
 * scripts/setup-jadwal-semester3-2026.js, sesuai jadwal REVISI yang baru
 * (dokumen "..._2026-2027 (2).docx"). Perubahan dari jadwal versi
 * sebelumnya:
 *
 * SEMESTER 1:
 * - Bahasa Indonesia: dosen berganti ke Sarifuddin Islah Al Amin (dari Ehlisa)
 * - Etika Kerja: dosen berganti ke Farhan Yustisio (dari Izza Fadhlinah Dirham)
 * - Standardisasi (ELK1A): jadwal berubah ke Rabu 08.30-09.30, K303 (dari
 *   Rabu 09.30-10.30, K103) - dosen tetap sama
 * - Bahasa Inggris: SEBELUMNYA dipisah per kelas (ELK1A/ELK1B beda jadwal),
 *   SEKARANG DIGABUNG lagi jadi satu sesi bareng (Jumat 10.45-11.45, K103)
 *   - dosen tetap Suardi
 * - Pendidikan Agama: SEBELUMNYA semua kode agama (WUD2201-5) satu dosen
 *   (Esron). SEKARANG DIPISAH: Islam (WUD2201) tetap Esron, tapi Kristen +
 *   "Agama Lain" (WUD2202-5, mewakili Katolik/Hindu/Budha) pindah ke dosen
 *   Gunawan Tari, jadwal & ruang juga beda dari sebelumnya.
 * - KELAS ELK1ON: SEBELUMNYA sama sekali belum ada jadwal/dosen (lihat
 *   peringatan di setup-jadwal-semester1-2026.js). SEKARANG sudah ada -
 *   dosennya sebagian BEDA dari kelas A/B (kelas online associate dengan
 *   dosen sendiri untuk beberapa MK), jadwalnya fleksibel/asinkron (tidak
 *   ada hari/jam tetap). Matematika Teknik ELK1ON dosennya masih KOSONG
 *   ("-" di dokumen) - dilaporkan di akhir, isi manual nanti.
 *
 * SEMESTER 3 (Kelas 3A):
 * - DSTL & Perawatan dan Perbaikan: ruang pindah dari K303 -> K302. Dosen &
 *   jadwal hari/jam TIDAK berubah.
 *
 * CATATAN PENTING SOAL MODEL DATA: supaya ELK1ON tidak ikut "tercampur"
 * ke mata kuliah yang sebelumnya cuma 1 dokumen "kelas: null" (dianggap
 * berlaku utk SEMUA kelas), mata kuliah yang sifatnya "Gabungan Kelas A &
 * B" sekarang DIBUATKAN 2 dokumen terpisah (kelas: 'ELK1A' dan kelas:
 * 'ELK1B', isinya identik/sama persis) - BUKAN 1 dokumen kelas: null lagi.
 * ELK1ON selalu jadi dokumen ke-3 yang terpisah. Ini supaya logika
 * pencocokan otomatis di helpers/paketKurikulumHelper.js (yang mencocokkan
 * PERSIS berdasarkan field `kelas` mahasiswa) tetap benar untuk 3 kelas
 * sekaligus.
 *
 * AMAN DIJALANKAN BERULANG & OTOMATIS MIGRASI: dokumen lama (baik yang
 * "kelas: null" dari sebelum ELK1ON ada, maupun yang sudah kelas: 'ELK1A'/
 * 'ELK1B' dari setup sebelumnya) akan dipakai ulang (id tidak berubah,
 * cuma di-update), bukan dibuat dobel. Kalau ada mahasiswa yang sudah
 * ter-enroll ke dokumen lama "kelas: null" tapi kelasnya sekarang ternyata
 * ELK1B atau ELK1ON, enrollment-nya otomatis dipindahkan ke dokumen yang
 * benar.
 *
 * Cara pakai:
 *   node scripts/update-jadwal-2026-v2.js
 */

const { db, auth } = require('../config/firebaseAdmin');
const academicHelper = require('../helpers/academicHelper');

const PASSWORD_DOSEN_BARU = 'dosenelektronika';
const JADWAL_ONLINE = 'Fleksibel (Asinkron) - koordinasi langsung dengan dosen pengampu';

// ============================================================================
// DATA DOSEN
// ============================================================================
const DAFTAR_DOSEN = [
  // Sudah ada di sistem sebelumnya (nama HARUS persis sama dengan yang
  // sudah tersimpan supaya tidak dibuat dobel - lihat normalisasiNama()):
  { nama: 'Ariani Amri, S.Pd., M.Pd', identitas: '0918029701' },
  { nama: 'Fajar Ramadhan, S.Pd., M.T', identitas: '8559777678130153' },
  { nama: 'Gunawan Tari, S.T., M.T', identitas: '0908058803' },
  { nama: 'Suardi, S.Pd., M.Pd', identitas: '0905068702' },
  { nama: 'Rahman Syam, S.Pd., M.Si', identitas: '0921129104' },
  { nama: 'Miftahul Hairia, S.Pd., M.Pd', identitas: '6138777678230143' },
  { nama: 'Chalik Mawardi, S.P., M.Si.', identitas: null },
  { nama: 'Esron', identitas: null }, // dibuat dulu tanpa gelar - dipertahankan biar tidak dobel

  // Baru di revisi jadwal ini - belum ada NIDN/NUPTK di dokumen:
  { nama: 'Sarifuddin Islah Al Amin, S.Pd., M.Pd', identitas: null },
  { nama: 'Farhan Yustisio', identitas: null },
  { nama: 'Nur Afifah Rustan, S.Pd., M.Pd.', identitas: null },
  { nama: 'Drs. Salahuddin Abadi AS, M.Si', identitas: null },
  { nama: 'Ir. Irhamni Nuhardin, S.T., M.T., IPP.', identitas: null },
  { nama: 'Ramlan, S.Kom., M.Si.', identitas: null },
];

// ============================================================================
// MATA KULIAH SEMESTER 1 - tiap kode diberi jadwal untuk ELK1A, ELK1B, ELK1ON
// ============================================================================
const MK_SEMESTER1 = [
  {
    kode: 'WUD3208', // Bahasa Indonesia
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Senin 09.30-10.30, K102 (Gabungan Kelas A & B)', dosen: ['Sarifuddin Islah Al Amin, S.Pd., M.Pd'] },
      { kelas: 'ELK1B', jadwal: 'Senin 09.30-10.30, K102 (Gabungan Kelas A & B)', dosen: ['Sarifuddin Islah Al Amin, S.Pd., M.Pd'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: ['Sarifuddin Islah Al Amin, S.Pd., M.Pd'] },
    ]
  },
  {
    kode: 'WUD3209', // Bahasa Inggris - SEKARANG GABUNGAN (dulu dipisah)
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Jumat 10.45-11.45, K103 (Gabungan Kelas A & B)', dosen: ['Suardi, S.Pd., M.Pd'] },
      { kelas: 'ELK1B', jadwal: 'Jumat 10.45-11.45, K103 (Gabungan Kelas A & B)', dosen: ['Suardi, S.Pd., M.Pd'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: ['Nur Afifah Rustan, S.Pd., M.Pd.'] },
    ]
  },
  {
    kode: 'PD3201', // Etika Kerja
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Kamis 11.30-12.30, K103 (Gabungan Kelas A & B)', dosen: ['Farhan Yustisio'] },
      { kelas: 'ELK1B', jadwal: 'Kamis 11.30-12.30, K103 (Gabungan Kelas A & B)', dosen: ['Farhan Yustisio'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: ['Drs. Salahuddin Abadi AS, M.Si'] },
    ]
  },
  {
    kode: 'PD3202', // Standardisasi - tetap dipisah, ELK1A jadwal/ruang berubah
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Rabu 08.30-09.30, K303', dosen: ['Ariani Amri, S.Pd., M.Pd', 'Fajar Ramadhan, S.Pd., M.T'] },
      { kelas: 'ELK1B', jadwal: 'Senin 14.30-15.30, K202', dosen: ['Ariani Amri, S.Pd., M.Pd', 'Fajar Ramadhan, S.Pd., M.T'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: ['Ir. Irhamni Nuhardin, S.T., M.T., IPP.'] },
    ]
  },
  {
    kode: 'PD3203', // Matematika Teknik - tetap dipisah, jadwal A/B tidak berubah
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Sabtu 14.30-15.30, K201', dosen: ['Rahman Syam, S.Pd., M.Si'] },
      { kelas: 'ELK1B', jadwal: 'Sabtu 15.30-16.30, K201', dosen: ['Rahman Syam, S.Pd., M.Si'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: [] }, // dosen belum ditentukan ("-" di dokumen)
    ]
  },
  {
    kode: 'PD3204', // Perangkat Lunak Aplikasi - tetap dipisah, jadwal A/B tidak berubah
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Kamis 16.30-17.30, LAB 2', dosen: ['Ariani Amri, S.Pd., M.Pd', 'Gunawan Tari, S.T., M.T'] },
      { kelas: 'ELK1B', jadwal: 'Rabu 09.30-10.30, LAB 1', dosen: ['Ariani Amri, S.Pd., M.Pd', 'Gunawan Tari, S.T., M.T'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: ['Ramlan, S.Kom., M.Si.'] },
    ]
  },
  {
    kode: 'WUD2201', // Pendidikan Agama Islam
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Jumat 16.00-17.00, AULA LT4 (Gabungan Kelas A & B, dan ARS 1.1)', dosen: ['Esron'] },
      { kelas: 'ELK1B', jadwal: 'Jumat 16.00-17.00, AULA LT4 (Gabungan Kelas A & B, dan ARS 1.1)', dosen: ['Esron'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: ['Esron'] },
    ]
  },
  // Pendidikan Agama Kristen, Katolik, Hindu, Budha - digabung jadi satu sesi
  // "Kristen dan Agama Lain", dosen Gunawan Tari (BUKAN Esron lagi)
  ...['WUD2202', 'WUD2203', 'WUD2204', 'WUD2205'].map(kode => ({
    kode,
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Jumat 11.45-13.30, K202 (Gabungan Kelas A & B - Kristen dan Agama Lain)', dosen: ['Gunawan Tari, S.T., M.T'] },
      { kelas: 'ELK1B', jadwal: 'Jumat 11.45-13.30, K202 (Gabungan Kelas A & B - Kristen dan Agama Lain)', dosen: ['Gunawan Tari, S.T., M.T'] },
      { kelas: 'ELK1ON', jadwal: JADWAL_ONLINE, dosen: ['Gunawan Tari, S.T., M.T'] },
    ]
  })),
];

// ============================================================================
// MATA KULIAH SEMESTER 3 (Kelas 3A) - cuma update ruang DSTL & Perawatan
// ============================================================================
const MK_SEMESTER3_UPDATE_RUANG = [
  { kode: 'PEK3201', jadwal: 'Senin 10.30-11.30, K302' }, // DSTL, dari K303
  { kode: 'PEK3205', jadwal: 'Senin 11.30-12.30, K302' }, // Perawatan dan Perbaikan, dari K303
];

// ============================================================================
// FUNGSI BANTU
// ============================================================================

function normalisasiNama(nama) {
  return (nama || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function buatEmailDosen(namaLengkap) {
  const namaSaja = namaLengkap.split(',')[0];
  const bersih = namaSaja.replace(/[^a-zA-Z\s]/g, '').trim();
  const slug = bersih.toLowerCase().replace(/\s+/g, '.');
  return `${slug}@elektronika.com`;
}

async function pastikanDosenAda(dosenInfo, semuaDosenSnapshotRef) {
  const targetNormal = normalisasiNama(dosenInfo.nama);
  const cocok = semuaDosenSnapshotRef.docs.find(doc => normalisasiNama(doc.data().nama) === targetNormal);

  if (cocok) {
    const data = cocok.data();
    return { id: cocok.id, nama: data.nama, dibuatBaru: false };
  }

  const email = buatEmailDosen(dosenInfo.nama);
  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password: PASSWORD_DOSEN_BARU, displayName: dosenInfo.nama });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  await db.collection('dosen').doc(userRecord.uid).set({
    nama: dosenInfo.nama,
    email,
    nip: dosenInfo.identitas,
    nidn: dosenInfo.identitas,
    role: 'dosen',
    userId: userRecord.uid,
    createdAt: new Date().toISOString(),
  });

  return { id: userRecord.uid, nama: dosenInfo.nama, dibuatBaru: true };
}

function buatMateriKosong() {
  return Array.from({ length: 16 }, (_, i) => ({ pertemuan: i + 1, topik: '' }));
}

async function setPengampuAktif(mkId, dosenIds) {
  const activePeriodeId = academicHelper.getActivePeriodeId();
  const info = academicHelper.generatePeriodeOptions(50, 5).find(p => p.id === activePeriodeId);
  await db.collection('mataKuliah').doc(mkId).collection('pengampuPeriode').doc(activePeriodeId).set({
    periodeId: activePeriodeId,
    label: info ? info.label : activePeriodeId,
    semester: info ? info.semester : null,
    tahunAwal: info ? info.tahunAwal : null,
    tahunAkhir: info ? info.tahunAkhir : null,
    urutan: info ? info.urutan : 0,
    dosenIds,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  await db.collection('mataKuliah').doc(mkId).update({
    dosenIds,
    periodeAktifId: activePeriodeId,
    periodeAktifLabel: info ? info.label : activePeriodeId
  });
}

/**
 * Pastikan satu kode MK punya dokumen yang benar untuk SETIAP kelas di
 * kelasList (create/update/migrasi enrollment sesuai kondisi yang ada).
 */
async function pastikanMkPerKelas(kode, kelasList, dosenMap) {
  const snap = await db.collection('mataKuliah').where('kode', '==', kode).get();
  const existingByKelas = {};
  let legacyNullDoc = null;
  snap.docs.forEach(d => {
    const k = d.data().kelas;
    if (k) existingByKelas[k] = d;
    else if (!legacyNullDoc) legacyNullDoc = d;
  });

  const namaMkLama = snap.docs.length > 0 ? snap.docs[0].data().nama : null;
  const kelasDocMap = {};
  let legacyNullDipakaiUntuk = null;

  for (const target of kelasList) {
    const dosenIds = (target.dosen || []).map(n => {
      const d = dosenMap[n];
      if (!d) throw new Error(`Dosen "${n}" tidak ditemukan di DAFTAR_DOSEN - cek penulisan nama.`);
      return d.id;
    });

    if (existingByKelas[target.kelas]) {
      const doc = existingByKelas[target.kelas];
      await doc.ref.update({ jadwal: target.jadwal, updatedAt: new Date().toISOString() });
      await setPengampuAktif(doc.id, dosenIds);
      kelasDocMap[target.kelas] = { id: doc.id, ref: doc.ref };
      console.log(`   ✓  Diperbarui: ${kode} [${target.kelas}] -> ${target.jadwal}`);
    } else if (legacyNullDoc && !legacyNullDipakaiUntuk) {
      await legacyNullDoc.ref.update({ kelas: target.kelas, jadwal: target.jadwal, updatedAt: new Date().toISOString() });
      await setPengampuAktif(legacyNullDoc.id, dosenIds);
      kelasDocMap[target.kelas] = { id: legacyNullDoc.id, ref: legacyNullDoc.ref };
      legacyNullDipakaiUntuk = target.kelas;
      console.log(`   🔄 Dokumen lama (tanpa kelas spesifik) ${kode} diubah jadi [${target.kelas}] (id tetap: ${legacyNullDoc.id})`);
    } else {
      const docRef = await db.collection('mataKuliah').add({
        kode,
        nama: namaMkLama,
        kelas: target.kelas,
        jadwal: target.jadwal,
        dosenIds,
        materi: buatMateriKosong(),
        createdAt: new Date().toISOString(),
      });
      await setPengampuAktif(docRef.id, dosenIds);
      kelasDocMap[target.kelas] = { id: docRef.id, ref: docRef };
      console.log(`   ✅ Dibuat baru: ${kode} [${target.kelas}] (id: ${docRef.id})`);
    }
  }

  // Migrasi enrollment dari dokumen lama (null-kelas) ke dokumen kelas yang benar
  if (legacyNullDoc && legacyNullDipakaiUntuk) {
    const enrollmentSnap = await db.collection('enrollment').where('mkId', '==', legacyNullDoc.id).get();
    let dipindah = 0;
    for (const enr of enrollmentSnap.docs) {
      const mhsSnap = await db.collection('users').doc(enr.data().userId).get();
      const kelasMhs = mhsSnap.exists ? (mhsSnap.data().kelas || null) : null;
      if (kelasMhs && kelasMhs !== legacyNullDipakaiUntuk && kelasDocMap[kelasMhs]) {
        await enr.ref.update({ mkId: kelasDocMap[kelasMhs].id, updatedAt: new Date().toISOString() });
        dipindah++;
      }
    }
    if (dipindah > 0) console.log(`   📦 ${dipindah} mahasiswa dipindahkan ke dokumen kelas yang sesuai untuk ${kode}.`);
  }
}

// ============================================================================
// PROSES UTAMA
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('UPDATE JADWAL v2 - SEMESTER 1 & 3 (GANJIL TA 2026/2027)');
  console.log('='.repeat(70));

  console.log('\n--- Memproses Dosen ---');
  let semuaDosenSnapshot = await db.collection('dosen').get();
  const dosenMap = {};
  for (const d of DAFTAR_DOSEN) {
    const hasil = await pastikanDosenAda(d, semuaDosenSnapshot);
    dosenMap[d.nama] = hasil;
    if (hasil.dibuatBaru) {
      console.log(`   ✅ Dibuat akun baru: ${hasil.nama} (${buatEmailDosen(hasil.nama)})${d.identitas ? '' : ' - ⚠️ NIDN/NUPTK belum diisi'}`);
      semuaDosenSnapshot = await db.collection('dosen').get();
    } else {
      console.log(`   ✓  Sudah ada: ${hasil.nama}`);
    }
  }

  console.log('\n--- Memproses Mata Kuliah Semester 1 ---');
  for (const mk of MK_SEMESTER1) {
    console.log(`\n[${mk.kode}]`);
    await pastikanMkPerKelas(mk.kode, mk.kelasList, dosenMap);
  }

  console.log('\n--- Memperbarui Ruang Mata Kuliah Semester 3 (Kelas 3A) ---');
  for (const item of MK_SEMESTER3_UPDATE_RUANG) {
    const snap = await db.collection('mataKuliah').where('kode', '==', item.kode).get();
    if (snap.empty) {
      console.log(`   ❌ ${item.kode} tidak ditemukan - dilewati.`);
      continue;
    }
    const doc = snap.docs[0];
    await doc.ref.update({ jadwal: item.jadwal, updatedAt: new Date().toISOString() });
    console.log(`   ✓  ${item.kode} -> jadwal diperbarui: ${item.jadwal}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('SELESAI');
  console.log('='.repeat(70));
  console.log('⚠️  Matematika Teknik untuk kelas ELK1ON belum ada dosennya (dokumen');
  console.log('   sumber menulis "-") - isi manual lewat /admin/matakuliah kalau sudah ada.');
  console.log('⚠️  Beberapa dosen baru belum ada NIDN/NUPTK - lengkapi lewat /admin/dosen:');
  console.log('   Sarifuddin Islah Al Amin, Farhan Yustisio, Nur Afifah Rustan,');
  console.log('   Drs. Salahuddin Abadi AS, Ir. Irhamni Nuhardin, Ramlan.');
  console.log('⚠️  PENGEJAAN NAMA TIDAK KONSISTEN di dokumen sumber untuk 3 dosen berikut -');
  console.log('   saya anggap orang yang SAMA dengan yang sudah ada di sistem (mohon cek):');
  console.log('   - "Sarifuddin Ihsan Al Alim" (di jadwal ELK1ON) = "Sarifuddin Islah Al Amin" (ELK1A/B)');
  console.log('   - "Erson" (di jadwal ELK1ON) = "Esron" (yang sudah ada di sistem)');
  console.log('   - "Pak Gunawan" (di jadwal ELK1ON) = "Gunawan Tari, S.T., M.T" (yang sudah ada)');
  console.log('\nLangkah selanjutnya: jalankan ulang node scripts/aktifkan-krs-angkatan2026.js');
  console.log('dan node scripts/aktifkan-krs-semester3.js supaya enrollment ikut sinkron.');

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
