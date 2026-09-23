/**
 * scripts/buat-akun-mahasiswa-angkatan21-22-missing.js
 *
 * Membuat akun untuk mahasiswa angkatan 2021 & 2022 yang ternyata BELUM
 * ADA di database (ketahuan lewat scripts/cek-akun-angkatan21-22.js):
 *   - 14 mahasiswa angkatan 2021
 *   - 1 mahasiswa angkatan 2022 (Muh. Azhar Nur - datanya cuma sampai
 *     Semester 1, kemungkinan tidak melanjutkan, tapi tetap dibuatkan
 *     akun supaya nilai Semester 1-nya bisa tercatat di sistem)
 *
 * Mengikuti pola PERSIS SAMA dengan
 * scripts/buat-akun-mahasiswa-angkatan23-missing.js: auth.createUser +
 * dokumen users + dokumen tagihan.
 *
 * Kredensial akun:
 *   - email/username : <nim>@polidewa.elk
 *   - password 2021   : elektronika2021
 *   - password 2022   : elektronika2022
 *
 * SETELAH akun-akun ini dibuat, jalankan ULANG:
 *   node scripts/input-nilai-angkatan21-legacy.js --confirm
 *   node scripts/input-nilai-angkatan22-legacy.js --confirm
 * supaya nilai mereka (yang sebelumnya dilewati karena NIM belum ada)
 * ikut tertulis, dan status Lulus/Keluar-nya ikut dihitung ulang.
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar membuat akun.
 *
 * Cara pakai:
 *   node scripts/buat-akun-mahasiswa-angkatan21-22-missing.js
 *   node scripts/buat-akun-mahasiswa-angkatan21-22-missing.js --confirm
 */

const { db, auth } = require('../config/firebaseAdmin');

const KONFIRMASI = process.argv.includes('--confirm');

const DOMAIN_EMAIL = 'polidewa.elk';

const MAHASISWA_BARU_2021 = [
  { nim: '21302001', nama: 'Serliadi' },
  { nim: '21302004', nama: 'Hendra' },
  { nim: '21302005', nama: 'Wilfani Tosampe' },
  { nim: '21302008', nama: 'Ifan' },
  { nim: '21302010', nama: 'Rifaldhy Saputra' },
  { nim: '21302011', nama: 'Suwandi Supu' },
  { nim: '21302013', nama: 'Wanda Meylani Putri' },
  { nim: '21302014', nama: 'Muh Arqha' },
  { nim: '21302015', nama: 'Muh. Arafat Rifaldy Muslimin' },
  { nim: '21302016', nama: 'Serlina' },
  { nim: '21302017', nama: 'Harmiati' },
  { nim: '21302018', nama: 'Yatno Mangnga' },
  { nim: '21302019', nama: 'Rifky Alamsyah' },
  { nim: '21302020', nama: 'Widya Anggraeni' }
];

const MAHASISWA_BARU_2022 = [
  { nim: '22302009', nama: 'Muh. Azhar Nur' }
];

const GRUP = [
  { label: '2021', daftar: MAHASISWA_BARU_2021, password: 'elektronika2021', semester: 'Semester 6' },
  { label: '2022', daftar: MAHASISWA_BARU_2022, password: 'elektronika2022', semester: 'Semester 6' }
];

async function cariUserIdByNim(nim) {
  const snapshot = await db.collection('users').where('nim', '==', nim).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

async function buatAkun(mhs, password, semesterDefault) {
  const email = `${mhs.nim}@${DOMAIN_EMAIL}`;

  const userRecord = await auth.createUser({
    email,
    password,
    displayName: mhs.nama
  });

  await db.collection('users').doc(userRecord.uid).set({
    nim: mhs.nim,
    nama: mhs.nama,
    email,
    foto: null,
    fotoFileId: null,
    role: 'mahasiswa',
    semester: semesterDefault,
    statusMagang: null,
    statusMahasiswa: 'Aktif', // nanti dihitung ulang otomatis oleh script input-nilai-angkatan*-legacy.js (Lulus/Keluar sesuai data)
    kelas: null,
    konsentrasi: null,
    agama: 'Islam', // default sistem - koreksi manual kalau perlu
    dosenPaId: null,
    dosenPaNama: null,
    dosenPaNidn: null,
    createdAt: new Date().toISOString()
  });

  await db.collection('tagihan').doc(userRecord.uid).set({
    mahasiswaId: userRecord.uid,
    semester: []
  });

  return userRecord.uid;
}

async function jalankan() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MEMBUAT AKUN BARU' : '🟡 DRY-RUN - cuma simulasi, tidak membuat apa pun'}`);
  console.log(`Domain email: @${DOMAIN_EMAIL}\n`);

  let totalDibuat = 0, totalDilewatiSudahAda = 0, totalGagal = 0;

  for (const grup of GRUP) {
    console.log(`\n=== Angkatan ${grup.label} (password: ${grup.password}) ===`);
    for (const mhs of grup.daftar) {
      const existingId = await cariUserIdByNim(mhs.nim);
      if (existingId) {
        console.log(`⏭️  ${mhs.nim} - ${mhs.nama}: sudah ada user di database (id: ${existingId}), DILEWATI.`);
        totalDilewatiSudahAda++;
        continue;
      }

      const email = `${mhs.nim}@${DOMAIN_EMAIL}`;
      console.log(`👤 ${mhs.nim} - ${mhs.nama}  ->  ${email}`);

      if (KONFIRMASI) {
        try {
          const uid = await buatAkun(mhs, grup.password, grup.semester);
          console.log(`   ✅ Akun dibuat (uid: ${uid})`);
          totalDibuat++;
        } catch (err) {
          console.error(`   ⚠️  Gagal membuat akun untuk ${mhs.nim}:`, err.message);
          totalGagal++;
        }
      }
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Sudah ada sebelumnya (dilewati) : ${totalDilewatiSudahAda}`);
  if (!KONFIRMASI) {
    const totalAkanDibuat = MAHASISWA_BARU_2021.length + MAHASISWA_BARU_2022.length - totalDilewatiSudahAda;
    console.log(`Akan dibuat kalau --confirm     : ${totalAkanDibuat}`);
    console.log('\n👉 Ini baru DRY-RUN. Kalau daftar di atas sudah benar, jalankan ulang dengan --confirm:');
    console.log('   node scripts/buat-akun-mahasiswa-angkatan21-22-missing.js --confirm');
  } else {
    console.log(`Akun berhasil dibuat            : ${totalDibuat}`);
    console.log(`Gagal dibuat                    : ${totalGagal}`);
    console.log('\n👉 Selanjutnya jalankan ulang supaya nilai mereka ikut tertulis (& status Lulus/Keluar terhitung):');
    console.log('   node scripts/input-nilai-angkatan21-legacy.js --confirm');
    console.log('   node scripts/input-nilai-angkatan22-legacy.js --confirm');
  }

  process.exit(0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
