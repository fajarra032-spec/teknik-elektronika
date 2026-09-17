/**
 * scripts/reset-password-semua-dosen.js
 *
 * 1. Menampilkan daftar SEMUA dosen beserta UID (Firebase Auth) & email-nya.
 * 2. Kalau dijalankan dengan --confirm, langsung RESET PASSWORD semua akun
 *    dosen itu serentak ke: dosenelektronika
 *
 * UID dosen = ID dokumen di collection `dosen` (di sistem ini, dokumen
 * dosen SELALU dibuat dengan id yang sama persis dengan Firebase Auth UID
 * pemiliknya - lihat routes/admin/users.js & scripts/assign-dosen-pa-*.js).
 *
 * DEFAULT DRY-RUN - cuma menampilkan daftar UID & email, TIDAK mengubah
 * password siapa pun sampai dijalankan ulang dengan --confirm.
 *
 * Cara pakai:
 *   node scripts/reset-password-semua-dosen.js
 *   node scripts/reset-password-semua-dosen.js --confirm
 */

const { db, auth } = require('../config/firebaseAdmin');

const KONFIRMASI = process.argv.includes('--confirm');
const PASSWORD_BARU = 'dosenelektronika';

async function main() {
  console.log('='.repeat(70));
  console.log(`DAFTAR UID DOSEN${KONFIRMASI ? ' + RESET PASSWORD SERENTAK' : ''}`);
  console.log('='.repeat(70));
  console.log(`Mode: ${KONFIRMASI ? `🔴 KONFIRMASI - password SEMUA dosen akan diganti ke "${PASSWORD_BARU}"` : '🟡 DRY-RUN - cuma menampilkan daftar, tidak mengubah apa pun'}\n`);

  const snapshot = await db.collection('dosen').orderBy('nama').get();

  if (snapshot.empty) {
    console.log('Tidak ada data dosen ditemukan di collection "dosen".');
    process.exit(0);
  }

  console.log(`Total dosen ditemukan: ${snapshot.size}\n`);
  console.log('No | UID                           | Email                              | Nama');
  console.log('-'.repeat(110));

  const daftarDosen = snapshot.docs.map((doc, i) => {
    const d = doc.data();
    console.log(`${String(i + 1).padEnd(3)}| ${doc.id.padEnd(30)}| ${(d.email || '-').padEnd(35)}| ${d.nama || '-'}`);
    return { uid: doc.id, email: d.email, nama: d.nama };
  });

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru menampilkan daftar (DRY-RUN). Untuk benar-benar mereset password');
    console.log(`   SEMUA dosen di atas ke "${PASSWORD_BARU}", jalankan ulang dengan:`);
    console.log('   node scripts/reset-password-semua-dosen.js --confirm');
    process.exit(0);
  }

  console.log('\n--- Mereset password ---');
  let berhasil = 0;
  let gagal = 0;
  const gagalDetail = [];

  for (const d of daftarDosen) {
    try {
      await auth.updateUser(d.uid, { password: PASSWORD_BARU });
      console.log(`✅ ${d.nama} (${d.email}) - password direset.`);
      berhasil++;
    } catch (err) {
      console.error(`❌ ${d.nama} (${d.email}) - GAGAL: ${err.message}`);
      gagalDetail.push(`${d.nama} (${d.email}): ${err.message}`);
      gagal++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Total dosen        : ${daftarDosen.length}`);
  console.log(`Berhasil direset   : ${berhasil}`);
  console.log(`Gagal              : ${gagal}`);
  if (gagalDetail.length > 0) {
    console.log('\nDetail yang gagal:');
    gagalDetail.forEach(g => console.log(' - ' + g));
  }
  console.log(`\nSemua dosen yang berhasil sekarang bisa login pakai password: ${PASSWORD_BARU}`);
  console.log('Sarankan mereka segera ganti password sendiri setelah login.');

  process.exit(gagal > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
