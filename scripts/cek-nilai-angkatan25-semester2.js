/**
 * scripts/cek-nilai-angkatan25-semester2.js
 *
 * Script DIAGNOSTIK (read-only, tidak mengubah apa pun) untuk memastikan
 * apakah nilai Semester 2 angkatan 2025 (dari
 * scripts/input-nilai-angkatan25-semester2.js) SUNGGUHAN sudah tersimpan
 * di collection `grades` & `enrollment`, atau ada yang gagal tersimpan
 * diam-diam.
 *
 * Kalau semua "✓ ADA" di sini tapi tetap tidak muncul di halaman
 * "Kelola Nilai" (/admin/nilai/:mkId) admin, itu tandanya BUKAN masalah
 * penyimpanan - itu soal halaman itu defaultnya menampilkan periode AKTIF
 * SEKARANG, bukan periode histori "Genap 2025/2026". Sudah ditambahkan
 * dropdown pemilih periode di halaman itu untuk mengatasi ini - pilih
 * "Genap 2025/2026" di dropdown "Periode" di halaman Kelola Nilai MK terkait.
 *
 * Cara pakai:
 *   node scripts/cek-nilai-angkatan25-semester2.js
 */

const { db } = require('../config/firebaseAdmin');

const SEMESTER = 'Genap 2025/2026';

// Sama persis dengan DATA_NILAI di scripts/input-nilai-angkatan25-semester2.js
// (kolom nilai TIDAK dipakai di sini, cuma perlu NIM & nama untuk dicek)
const NIM_LIST = [
  '25302001', '25302002', '25302003', '25302005', '25302006', '25302007',
  '25302008', '25302009', '25302010', '25302012', '25302013', '25302014',
  '25302015', '25302016', '25302017', '25302018', '25302019', '25302020',
  '25302021', '25302022', '25302023', '25302024', '25302025', '25302026',
  '25302027', '25302028', '25302029'
];

async function main() {
  console.log('='.repeat(70));
  console.log(`CEK DATA TERSIMPAN - Semester "${SEMESTER}" Angkatan 2025`);
  console.log('='.repeat(70));

  const [gradesSnapshot, enrollmentSnapshot] = await Promise.all([
    db.collection('grades').where('semester', '==', SEMESTER).get(),
    db.collection('enrollment').where('semester', '==', SEMESTER).where('status', '==', 'active').get()
  ]);

  console.log(`\nTotal dokumen 'grades' untuk periode ini    : ${gradesSnapshot.size}`);
  console.log(`Total dokumen 'enrollment' aktif periode ini: ${enrollmentSnapshot.size}`);

  // Index by userId untuk pengecekan cepat per mahasiswa
  const gradesByUser = {};
  gradesSnapshot.docs.forEach(doc => {
    const g = doc.data();
    if (!gradesByUser[g.userId]) gradesByUser[g.userId] = [];
    gradesByUser[g.userId].push(g);
  });
  const enrollByUser = {};
  enrollmentSnapshot.docs.forEach(doc => {
    const e = doc.data();
    if (!enrollByUser[e.userId]) enrollByUser[e.userId] = [];
    enrollByUser[e.userId].push(e);
  });

  console.log('\n--- Per Mahasiswa ---');
  let totalNilaiSemuaMhs = 0;
  const nimTidakKetemu = [];

  for (const nim of NIM_LIST) {
    const userSnap = await db.collection('users').where('nim', '==', nim).limit(1).get();
    if (userSnap.empty) {
      console.log(`❌ NIM ${nim}: user tidak ditemukan di database.`);
      nimTidakKetemu.push(nim);
      continue;
    }
    const userId = userSnap.docs[0].id;
    const nama = userSnap.docs[0].data().nama;
    const jumlahGrade = (gradesByUser[userId] || []).length;
    const jumlahEnroll = (enrollByUser[userId] || []).length;
    console.log(`${jumlahGrade > 0 ? '✓' : '⚠️ '} ${nim} - ${nama}: ${jumlahGrade} nilai tersimpan, ${jumlahEnroll} enrollment aktif`);
    totalNilaiSemuaMhs += jumlahGrade;
  }

  console.log('\n' + '='.repeat(70));
  console.log('KESIMPULAN');
  console.log('='.repeat(70));
  console.log(`Total nilai tersimpan untuk semua mahasiswa di atas: ${totalNilaiSemuaMhs}`);
  if (nimTidakKetemu.length > 0) {
    console.log(`⚠️  NIM tidak ditemukan: ${nimTidakKetemu.join(', ')}`);
  }
  if (totalNilaiSemuaMhs > 0) {
    console.log('\n✅ Data SUDAH tersimpan di database. Kalau di web tetap tidak muncul,');
    console.log('   itu soal halaman yang dibuka default ke periode aktif SEKARANG -');
    console.log('   buka /admin/nilai/[mkId], lalu pilih "Genap 2025/2026" di dropdown');
    console.log('   "Periode" yang baru ditambahkan di pojok kiri atas halaman itu.');
  } else {
    console.log('\n❌ TIDAK ADA nilai tersimpan sama sekali untuk periode ini.');
    console.log('   Kemungkinan script input-nilai-angkatan25-semester2.js belum pernah');
    console.log('   dijalankan dengan flag --confirm (cuma dry-run).');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
