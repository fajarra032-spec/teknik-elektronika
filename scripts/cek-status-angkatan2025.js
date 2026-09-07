/**
 * scripts/cek-status-angkatan2025.js
 *
 * Script DIAGNOSTIK (tidak mengubah apa pun) untuk melihat kenapa
 * scripts/aktifkan-krs-semester3.js cuma menemukan sedikit mahasiswa,
 * padahal mestinya banyak mahasiswa angkatan 2025 yang seharusnya
 * semester 3 sekarang.
 *
 * Mencetak field `semester`, `statusMahasiswa`, dan `konsentrasi` SEMUA
 * mahasiswa dengan NIM diawali '25', supaya kelihatan mana yang:
 * - Field semester-nya BELUM "Semester 3" (makanya tidak ketemu query)
 * - Statusnya BUKAN "Aktif"
 * - Konsentrasinya belum diisi
 *
 * Cara pakai:
 *   node scripts/cek-status-angkatan2025.js
 */

const { db } = require('../config/firebaseAdmin');

const PREFIX_NIM = '25';

async function main() {
  console.log('='.repeat(80));
  console.log(`CEK STATUS MAHASISWA ANGKATAN 20${PREFIX_NIM} (NIM diawali '${PREFIX_NIM}')`);
  console.log('='.repeat(80));

  const snapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
  const angkatan = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(m => (m.nim || '').startsWith(PREFIX_NIM))
    .sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));

  if (angkatan.length === 0) {
    console.log(`Tidak ada mahasiswa dengan NIM diawali '${PREFIX_NIM}' sama sekali di sistem.`);
    console.log('Kalau seharusnya ada, berarti akun mereka belum pernah dibuat.');
    process.exit(0);
  }

  console.log(`Total ditemukan: ${angkatan.length} mahasiswa\n`);

  const rekap = {};
  angkatan.forEach(m => {
    console.log(
      `${m.nim} - ${(m.nama || '-').padEnd(30)} | Semester: ${(m.semester || 'KOSONG').padEnd(12)} | Status: ${(m.statusMahasiswa || 'KOSONG').padEnd(8)} | Konsentrasi: ${m.konsentrasi || 'KOSONG'}`
    );
    const key = `${m.semester || 'KOSONG'} / ${m.statusMahasiswa || 'KOSONG'}`;
    rekap[key] = (rekap[key] || 0) + 1;
  });

  console.log('\n' + '-'.repeat(80));
  console.log('REKAP (Semester / Status Mahasiswa) -> jumlah:');
  Object.entries(rekap).forEach(([key, jumlah]) => console.log(`  ${key} -> ${jumlah} mahasiswa`));

  const belumSemester3 = angkatan.filter(m => m.semester !== 'Semester 3');
  if (belumSemester3.length > 0) {
    console.log(`\n⚠️  ${belumSemester3.length} mahasiswa field Semester-nya BUKAN "Semester 3":`);
    belumSemester3.forEach(m => console.log(`   - ${m.nim} - ${m.nama}: Semester saat ini = "${m.semester || 'kosong'}"`));
    console.log('\nKalau menurut Anda mereka SEHARUSNYA sudah semester 3 sekarang, jalankan:');
    console.log('  node scripts/set-semester3-angkatan2025.js');
    console.log('(akan saya buatkan setelah Anda konfirmasi ini memang yang diinginkan)');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
