/**
 * scripts/buat-akun-mahasiswa-angkatan23-missing.js
 *
 * Membuat akun untuk 11 mahasiswa angkatan 2023 yang ternyata BELUM ADA di
 * database (muncul sebagai "TIDAK KETEMU" waktu menjalankan
 * scripts/input-nilai-angkatan23-legacy.js). Mengikuti pola PERSIS SAMA
 * dengan pembuatan mahasiswa lewat form admin (lihat POST '/' di
 * routes/admin/mahasiswa.js): buat user di Firebase Auth dulu, baru
 * dokumen di koleksi `users` (uid Auth dipakai sebagai id dokumen), lalu
 * dokumen kosong di koleksi `tagihan`.
 *
 * Kredensial akun (SESUAI PERMINTAAN ADMIN):
 *   - email/username : <nim>@polidewa.elk
 *   - password        : elektronika2023   (SAMA untuk semua 11 akun)
 *
 * PENTING - password ini dipakai apa adanya untuk semua akun, jadi begitu
 * dibuat, SANGAT DISARANKAN masing-masing mahasiswa diminta ganti password
 * saat pertama kali login (Firebase Auth-nya sendiri tidak mengunci ini -
 * kalau mau dipaksa ganti password di login pertama, itu perlu logika
 * tambahan di halaman login, bukan cakupan script ini).
 *
 * ASUMSI DATA (field yang tidak ada sumbernya di Excel/percakapan kita,
 * silakan koreksi manual lewat halaman admin kalau perlu):
 *   - role            : 'mahasiswa'
 *   - semester        : 'Semester 6' (angkatan 2023 saat ini sedang/baru
 *                        selesai PDK 3 = semester 6 kurikulum lama)
 *   - statusMahasiswa : 'Aktif' (bukan 'Lulus' - dicek dulu: dari 11 NIM
 *                        ini, PDK 1-2-3 TIDAK ADA yang lengkap bertiga
 *                        sekaligus di data yang kita punya, jadi tidak ada
 *                        yang otomatis memenuhi syarat Lulus)
 *   - statusMagang, kelas, konsentrasi, dosenPaId : dikosongkan (null)
 *   - agama           : default Islam (DEFAULT_AGAMA di sistem) - WAJIB
 *                        dikoreksi manual satu-satu untuk yang bukan Islam
 *
 * SETELAH akun-akun ini dibuat, NIM-nya baru akan "ketemu" - jangan lupa
 * jalankan ULANG scripts/input-nilai-angkatan23-legacy.js --confirm
 * supaya nilai ke-11 mahasiswa ini (yang sebelumnya dilewati) ikut
 * tertulis. Script itu aman dijalankan berkali-kali (upsert).
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar membuat akun.
 *
 * Cara pakai:
 *   1) Taruh file ini di folder scripts/ project middleware Anda.
 *   2) Dry-run dulu (aman, tidak membuat apa pun):
 *        node scripts/buat-akun-mahasiswa-angkatan23-missing.js
 *   3) Kalau daftar di bawah sudah benar:
 *        node scripts/buat-akun-mahasiswa-angkatan23-missing.js --confirm
 *   4) Lalu jalankan ulang:
 *        node scripts/input-nilai-angkatan23-legacy.js --confirm
 */

const { db, auth } = require('../config/firebaseAdmin');

const KONFIRMASI = process.argv.includes('--confirm');

const DOMAIN_EMAIL = 'polidewa.elk';
const PASSWORD_DEFAULT = 'elektronika2023';
const SEMESTER_DEFAULT = 'Semester 6';
const STATUS_DEFAULT = 'Aktif';

// 11 mahasiswa yang tidak ketemu waktu run input-nilai-angkatan23-legacy.js
const MAHASISWA_BARU = [
  { nim: '23302020', nama: 'Pikram' },
  { nim: '23302006', nama: 'Muh.Akram' },
  { nim: '23302007', nama: "Muh.Gerald Rofi'if" },
  { nim: '23303001', nama: 'Maryam' },
  { nim: '23303010', nama: 'Nelson Paledung' },
  { nim: '23303048', nama: 'Prawira Elia Besol' },
  { nim: '23303077', nama: 'Melkiyas B' },
  { nim: '23303149', nama: 'Risal Mubarak' },
  { nim: '23405018', nama: 'Tika' },
  { nim: '23406021', nama: 'Hengki Marjono' },
  { nim: '23406006', nama: 'Zulfikar' }
];

async function cariUserIdByNim(nim) {
  const snapshot = await db.collection('users').where('nim', '==', nim).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

async function buatAkun(mhs) {
  const email = `${mhs.nim}@${DOMAIN_EMAIL}`;

  const userRecord = await auth.createUser({
    email,
    password: PASSWORD_DEFAULT,
    displayName: mhs.nama
  });

  await db.collection('users').doc(userRecord.uid).set({
    nim: mhs.nim,
    nama: mhs.nama,
    email,
    foto: null,
    fotoFileId: null,
    role: 'mahasiswa',
    semester: SEMESTER_DEFAULT,
    statusMagang: null,
    statusMahasiswa: STATUS_DEFAULT,
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
  console.log(`Domain email: @${DOMAIN_EMAIL}  |  Password default: ${PASSWORD_DEFAULT}`);
  console.log(`Jumlah calon akun: ${MAHASISWA_BARU.length}\n`);

  let dibuat = 0, dilewatiSudahAda = 0, gagal = 0;

  for (const mhs of MAHASISWA_BARU) {
    const existingId = await cariUserIdByNim(mhs.nim);
    if (existingId) {
      console.log(`⏭️  ${mhs.nim} - ${mhs.nama}: sudah ada user di database (id: ${existingId}), DILEWATI (tidak dibuat dobel).`);
      dilewatiSudahAda++;
      continue;
    }

    const email = `${mhs.nim}@${DOMAIN_EMAIL}`;
    console.log(`👤 ${mhs.nim} - ${mhs.nama}  ->  ${email}`);

    if (KONFIRMASI) {
      try {
        const uid = await buatAkun(mhs);
        console.log(`   ✅ Akun dibuat (uid: ${uid})`);
        dibuat++;
      } catch (err) {
        console.error(`   ⚠️  Gagal membuat akun untuk ${mhs.nim}:`, err.message);
        gagal++;
      }
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Sudah ada sebelumnya (dilewati) : ${dilewatiSudahAda}`);
  if (!KONFIRMASI) {
    console.log(`Akan dibuat kalau --confirm     : ${MAHASISWA_BARU.length - dilewatiSudahAda}`);
    console.log('\n👉 Ini baru DRY-RUN. Kalau daftar di atas sudah benar, jalankan ulang dengan --confirm:');
    console.log('   node scripts/buat-akun-mahasiswa-angkatan23-missing.js --confirm');
  } else {
    console.log(`Akun berhasil dibuat            : ${dibuat}`);
    console.log(`Gagal dibuat                    : ${gagal}`);
    console.log('\n👉 Selanjutnya jalankan ulang supaya nilai ke-11 mahasiswa ini ikut tertulis:');
    console.log('   node scripts/input-nilai-angkatan23-legacy.js --confirm');
  }

  process.exit(0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
