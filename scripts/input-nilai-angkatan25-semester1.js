/**
 * scripts/input-nilai-angkatan25-semester1.js
 *
 * Memasukkan nilai akhir Semester 1 untuk 29 mahasiswa angkatan 2025
 * (NIM 253020xx) ke koleksi Firestore `grades`, sumber data dari file
 * Excel KHS/Transkrip yang diberikan admin (sheet INPUT).
 *
 * KEAMANAN DATA (supaya nilai TIDAK NYASAR ke mahasiswa yang salah):
 * - Pencocokan mahasiswa dilakukan lewat NIM (query exact-match ke
 *   koleksi 'users'), BUKAN lewat nama - NIM unik, nama bisa kembar/typo.
 * - Kalau NIM dari Excel tidak ketemu user-nya di database, mahasiswa itu
 *   DILEWATI (bukan ditebak/dicocokkan paksa) dan dicatat di ringkasan
 *   akhir supaya bisa dicek manual.
 * - Menyimpan nilai lewat saveGradeFinal() yang sudah ada (bukan tulis
 *   Firestore manual) - otomatis upsert per (userId, kodeMk, semester),
 *   jadi aman dijalankan berkali-kali, tidak akan dobel.
 * - Sekaligus membuat dokumen `enrollment` (status 'active') untuk tiap
 *   mahasiswa x MK, supaya mahasiswa ini muncul juga di daftar Rubrik
 *   dosen untuk MK-MK ini (Rubrik ambil daftar mahasiswa dari enrollment,
 *   bukan dari grades) - juga upsert-safe, dicek dulu sebelum dibuat.
 * - DEFAULT DRY-RUN: sekadar MENAMPILKAN apa yang akan ditulis, TIDAK
 *   benar-benar menyimpan apa pun, sampai dijalankan ulang dengan flag
 *   --confirm.
 *
 * PRASYARAT: scripts/seed-matakuliah-2026.js HARUS sudah dijalankan lebih
 * dulu (script ini akan berhenti otomatis kalau ada mata kuliah yang
 * belum ada di database).
 *
 * Cara pakai:
 *   1) Cek dulu (aman, tidak menulis apa pun):
 *        node scripts/input-nilai-angkatan25-semester1.js
 *   2) Kalau hasil dry-run di atas sudah benar semua, baru jalankan sungguhan:
 *        node scripts/input-nilai-angkatan25-semester1.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { saveGradeFinal } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const SEMESTER = 'Ganjil 2025/2026'; // Semester 1 angkatan 2025

// ============================================================================
// DEFAULT SEMENTARA UNTUK MATA KULIAH AGAMA
// File Excel sumber datanya cuma punya SATU kolom "Pendidikan Agama" (tidak
// disebutkan agamanya apa), padahal kurikulum sekarang punya 5 matkul agama
// terpisah. Sesuai arahan admin: semua nilai "Pendidikan Agama" di Excel
// untuk sementara dimasukkan ke default di bawah ini, nanti dikoreksi
// manual satu-satu lewat halaman admin (Kelola Nilai) untuk mahasiswa yang
// agamanya berbeda.
// ============================================================================
const AGAMA_DEFAULT_KODE = 'WUD2201';
const AGAMA_DEFAULT_NAMA = 'Pendidikan Agama Islam';

// Kolom Excel (sheet INPUT) -> kode MK kurikulum baru
// urutan array nilai per mahasiswa di bawah HARUS sama urutannya dengan ini:
const MATKUL_SEMESTER_1 = [
  { kodeMk: 'PD3203', namaMk: 'Matematika Teknik', sks: 3 },
  { kodeMk: 'PD3201', namaMk: 'Etika Kerja', sks: 3 },
  { kodeMk: 'PD3202', namaMk: 'Standardisasi', sks: 3 },
  { kodeMk: AGAMA_DEFAULT_KODE, namaMk: AGAMA_DEFAULT_NAMA, sks: 2 },
  { kodeMk: 'WUD3208', namaMk: 'Bahasa Indonesia', sks: 3 },
  { kodeMk: 'PD3204', namaMk: 'Perangkat Lunak Aplikasi', sks: 3 },
  { kodeMk: 'WUD3209', namaMk: 'Bahasa Inggris', sks: 3 }
];

// Data nilai per mahasiswa - diambil dari sheet INPUT kolom G..M,
// urutan nilai: [Matematika, Etika Kerja, Standardisasi, Agama, B.Indo, PLA, B.Inggris]
const DATA_NILAI = [
  { nim: '25302001', nama: 'Marshall Hansen Paranna', nilai: [93.8, 84.3, 86.2, 96, 88.15, 89.1, 86.2] },
  { nim: '25302002', nama: 'Nesa Anastasyia', nilai: [97.5, 86.8, 86.8, 96.4, 88.35, 90.1, 89.2] },
  { nim: '25302003', nama: 'Jihan Sabrina', nilai: [97.5, 86.8, 84.6, 96.4, 86.65, 90.1, 89.2] },
  { nim: '25302004', nama: 'Muh Musliadi', nilai: [0, 0, 0, 37, 0, 0, 11.7] },
  { nim: '25302005', nama: 'Muh Afridzal', nilai: [97.5, 86.8, 87, 96.4, 90.4, 90.1, 89.2] },
  { nim: '25302006', nama: 'Muhammad Nizam Sidik', nilai: [97.5, 85.3, 87.6, 96.4, 91.35, 87.2, 87.7] },
  { nim: '25302007', nama: 'Marcel', nilai: [96.5, 85.3, 86.8, 96.4, 85.35, 88.7, 87.7] },
  { nim: '25302008', nama: 'Dwi Anggara Prasetyo', nilai: [97.5, 86.8, 86.8, 96.4, 88.15, 90.1, 89.2] },
  { nim: '25302009', nama: 'Muhammad Fahril M', nilai: [72.5, 86.8, 85, 37, 89.4, 84.3, 83.3] },
  { nim: '25302010', nama: 'Muh. Aqild Baim Pratama', nilai: [97.5, 86.8, 86.8, 96.2, 89.4, 90.1, 89.2] },
  { nim: '25302011', nama: 'Rafael Zoe Pratama', nilai: [0, 0, 0, 37, 0, 0, 11.7] },
  { nim: '25302012', nama: 'Nurul Ilmi Jasman', nilai: [97.5, 86.8, 85.4, 96.8, 89.4, 88.7, 87.7] },
  { nim: '25302013', nama: 'Mey Narsi', nilai: [97.5, 86.8, 86.1, 96.8, 90.6, 90.1, 89.2] },
  { nim: '25302014', nama: 'Whulan Khesya', nilai: [96.5, 86.8, 86.8, 96.8, 90, 90.1, 89.2] },
  { nim: '25302015', nama: 'Gelvano Herschel Sikota', nilai: [97.5, 86.8, 85, 100, 88.3, 90.1, 89.2] },
  { nim: '25302016', nama: 'Muh Aqram Sulaeman', nilai: [97.5, 85.3, 86.8, 96.8, 92.2, 90.1, 89.2] },
  { nim: '25302017', nama: 'Hans Doalan Glorius Mowisu', nilai: [96.5, 86.8, 85, 97, 88.9, 90.1, 89.2] },
  { nim: '25302018', nama: 'Muh Al Jihad', nilai: [97.5, 67.7, 86.8, 96.5, 90.6, 90.1, 89.2] },
  { nim: '25302019', nama: 'Rahmatsalopi', nilai: [97.5, 86.8, 86.8, 96.5, 90.6, 90.1, 89.2] },
  { nim: '25302020', nama: 'Abi Al Ahkyar.K', nilai: [97.5, 86.8, 86.8, 96.5, 90.6, 90.1, 89.2] },
  { nim: '25302021', nama: 'Muh Aidit Algifari', nilai: [97.5, 86.8, 84.8, 95.8, 89.4, 90.1, 89.2] },
  { nim: '25302022', nama: "Nelson Linggi' Masakke", nilai: [97.5, 86.8, 86.8, 97, 89, 90.1, 89.2] },
  { nim: '25302023', nama: 'Muh. Zulqivly Rusli', nilai: [97.5, 86.8, 84.4, 92.4, 87.8, 90.1, 89.2] },
  { nim: '25302026', nama: 'Muh. Saad', nilai: [97.5, 69.1, 87.1, 96.5, 90.6, 90.1, 89.2] },
  { nim: '25302027', nama: 'Assabi Kullail', nilai: [97.5, 86.3, 84.2, 96.5, 89.9, 90.1, 89.2] },
  { nim: '25302028', nama: 'Natasya Aureliya Lakinende', nilai: [97, 88.3, 87.3, 81, 90, 90.1, 89.2] },
  { nim: '25302024', nama: 'Taufik Mubaraq', nilai: [94.1, 86, 86.2, 92.7, 86.9, 95.6, 96] },
  { nim: '25302025', nama: 'Yosep Saleppang', nilai: [93.5, 86, 87.2, 93.9, 87.9, 95.6, 97] },
  { nim: '25302029', nama: 'Intan Rianita', nilai: [49, 86.1, 86.2, 87, 86.3, 72, 71] }
];

async function cariUserIdByNim(nim) {
  const snapshot = await db.collection('users')
    .where('nim', '==', nim)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/**
 * Cari ID dokumen Firestore mataKuliah berdasarkan kode-nya.
 * Dibutuhkan supaya bisa bikin `enrollment` (yang key-nya mkId, bukan
 * kodeMk) - lihat catatan panjang soal ini di bagian atas file.
 */
async function cariMkIdByKode(kode) {
  const snapshot = await db.collection('mataKuliah').where('kode', '==', kode).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/**
 * Bikin (kalau belum ada) dokumen `enrollment` untuk 1 mahasiswa x 1 MK x
 * 1 semester, status langsung 'active' - meniru persis dokumen yang
 * dibuat otomatis saat admin approve KRS (routes/admin/krs.js), BEDANYA
 * `krsId` diisi null (tidak ada KRS asli di balik ini, ini input nilai
 * historis langsung) supaya jelas ketahuan kalau ada yang audit data ini
 * nanti - bukan dibuat seolah-olah ada pengajuan KRS yang sungguhan.
 */
async function pastikanEnrollment(userId, mkId, semester) {
  const existing = await db.collection('enrollment')
    .where('userId', '==', userId)
    .where('mkId', '==', mkId)
    .where('semester', '==', semester)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (!existing.empty) return 'sudah-ada';

  await db.collection('enrollment').add({
    userId,
    mkId,
    semester,
    status: 'active',
    createdAt: new Date().toISOString(),
    approvedBy: null,
    krsId: null,
    catatan: 'Dibuat otomatis dari input nilai historis (scripts/input-nilai-angkatan25-semester1.js) - tidak ada pengajuan KRS asli di balik enrollment ini.'
  });
  return 'dibuat';
}

async function jalankan() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS KE DATABASE' : '🟡 DRY-RUN - cuma simulasi, tidak menulis apa pun'}`);
  console.log(`Semester: ${SEMESTER}`);
  console.log(`Jumlah mahasiswa: ${DATA_NILAI.length}, tiap orang ${MATKUL_SEMESTER_1.length} mata kuliah\n`);

  // Resolve mkId tiap kode SEKALI DI AWAL (bukan berulang per mahasiswa).
  // Kalau ada yang belum ketemu, berarti scripts/seed-matakuliah-2026.js
  // belum dijalankan - berhenti di sini daripada lanjut dengan data yang
  // enrollment-nya bakal timpang (grades ada, enrollment tidak, untuk
  // sebagian matkul saja).
  console.log('Mengecek mataKuliah...');
  const mkIdMap = {};
  let adaMkHilang = false;
  for (const mk of MATKUL_SEMESTER_1) {
    const mkId = await cariMkIdByKode(mk.kodeMk);
    if (!mkId) {
      console.log(`❌ Mata kuliah ${mk.kodeMk} (${mk.namaMk}) BELUM ADA di database.`);
      adaMkHilang = true;
    } else {
      mkIdMap[mk.kodeMk] = mkId;
    }
  }
  if (adaMkHilang) {
    console.log('\n⛔ Berhenti. Jalankan dulu: node scripts/seed-matakuliah-2026.js');
    process.exit(1);
  }
  console.log('✅ Semua mata kuliah sudah ada.\n');

  const tidakKetemu = [];
  let berhasilDitulis = 0;
  let gagalTulis = 0;
  let enrollmentDibuat = 0;
  let enrollmentSudahAda = 0;

  for (const mhs of DATA_NILAI) {
    const userId = await cariUserIdByNim(mhs.nim);
    if (!userId) {
      console.log(`❌ TIDAK KETEMU: NIM ${mhs.nim} (${mhs.nama}) - tidak ada user dengan NIM ini di database. DILEWATI.`);
      tidakKetemu.push(mhs);
      continue;
    }

    console.log(`👤 ${mhs.nim} - ${mhs.nama}  (userId: ${userId})`);
    for (let i = 0; i < MATKUL_SEMESTER_1.length; i++) {
      const mk = MATKUL_SEMESTER_1[i];
      const nilai = mhs.nilai[i];
      console.log(`     ${mk.kodeMk} ${mk.namaMk}: ${nilai}`);

      if (KONFIRMASI) {
        try {
          await saveGradeFinal({
            userId,
            kodeMk: mk.kodeMk,
            namaMk: mk.namaMk,
            sks: mk.sks,
            nilai,
            semester: SEMESTER
          });
          berhasilDitulis++;

          const hasil = await pastikanEnrollment(userId, mkIdMap[mk.kodeMk], SEMESTER);
          if (hasil === 'dibuat') enrollmentDibuat++;
          else enrollmentSudahAda++;
        } catch (err) {
          console.error(`     ⚠️  Gagal simpan ${mk.kodeMk} untuk ${mhs.nim}:`, err.message);
          gagalTulis++;
        }
      }
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Mahasiswa ditemukan & diproses : ${DATA_NILAI.length - tidakKetemu.length} / ${DATA_NILAI.length}`);
  if (tidakKetemu.length > 0) {
    console.log(`\n⚠️  ${tidakKetemu.length} NIM TIDAK DITEMUKAN di database (perlu dicek manual - mungkin akun mahasiswanya belum dibuat):`);
    tidakKetemu.forEach(m => console.log(`   - ${m.nim}  ${m.nama}`));
  }

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru DRY-RUN. Kalau daftar mahasiswa & nilai di atas sudah benar semua,');
    console.log('   jalankan ulang dengan flag --confirm untuk benar-benar menyimpan:');
    console.log('   node scripts/input-nilai-angkatan25-semester1.js --confirm');
  } else {
    console.log(`\nNilai berhasil disimpan     : ${berhasilDitulis}`);
    console.log(`Nilai gagal disimpan        : ${gagalTulis}`);
    console.log(`Enrollment dibuat baru      : ${enrollmentDibuat}`);
    console.log(`Enrollment sudah ada (skip) : ${enrollmentSudahAda}`);
  }

  process.exit(0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
