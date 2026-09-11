/**
 * scripts/cek-enrollment-per-mk.js
 *
 * Script DIAGNOSTIK (READ-ONLY - tidak mengubah/menghapus apa pun) untuk
 * menyelidiki kenapa seorang mahasiswa yang "seharusnya" sudah lewat dari
 * suatu MK (mis. MK Semester 1, tapi mahasiswanya sekarang sudah Semester 3)
 * masih muncul di daftar peserta MK itu di halaman dosen.
 *
 * Menampilkan SEMUA dokumen `enrollment` untuk satu MK - TANPA filter
 * semester/status - supaya kelihatan APA ADANYA: berapa banyak dokumen
 * enrollment yang ada untuk MK ini, punya siapa saja, semester apa saja,
 * statusnya apa, kapan dibuat, dan (paling penting) apakah ada `catatan`
 * yang menandakan dokumen itu dibuat oleh salah satu script otomatis kita
 * (scripts/input-nilai-angkatan*.js selalu mengisi field `catatan` dengan
 * teks "Dibuat otomatis dari input nilai historis...").
 *
 * Juga menampilkan nilai `getPeriodeAktif()` saat ini sebagai pembanding,
 * supaya kelihatan jelas dokumen mana yang akan LOLOS filter periode-aktif
 * (yang sudah dipasang di routes/dosen/mk.js, nilai.js, index.js) dan mana
 * yang seharusnya sudah tersaring.
 *
 * Cara pakai:
 *   node scripts/cek-enrollment-per-mk.js <kodeMk>
 *   node scripts/cek-enrollment-per-mk.js <kodeMk> <nim>   (fokus 1 mahasiswa saja)
 *
 * Contoh:
 *   node scripts/cek-enrollment-per-mk.js PD3205
 *   node scripts/cek-enrollment-per-mk.js PD3205 24302013
 */

const { db } = require('../config/firebaseAdmin');
const { getPeriodeAktif } = require('../helpers/nilaiHelper');

async function main() {
  const kodeMk = process.argv[2];
  const fokusNim = process.argv[3] || null;

  if (!kodeMk) {
    console.log('Cara pakai: node scripts/cek-enrollment-per-mk.js <kodeMk> [nim]');
    process.exit(1);
  }

  const periodeAktif = getPeriodeAktif();
  console.log('='.repeat(78));
  console.log(`CEK ENROLLMENT UNTUK MK KODE "${kodeMk}"`);
  console.log(`Periode aktif SEKARANG menurut sistem: "${periodeAktif}"`);
  console.log('='.repeat(78));

  // 1) Cari SEMUA dokumen mataKuliah dengan kode ini (bisa >1 kalau ada
  //    duplikat kode di database - itu sendiri juga layak dicurigai).
  const mkSnapshot = await db.collection('mataKuliah').where('kode', '==', kodeMk).get();
  if (mkSnapshot.empty) {
    console.log(`\n❌ Tidak ada mataKuliah dengan kode "${kodeMk}" di database.`);
    process.exit(1);
  }

  if (mkSnapshot.size > 1) {
    console.log(`\n⚠️  ADA ${mkSnapshot.size} DOKUMEN mataKuliah dengan kode yang sama "${kodeMk}"!`);
    console.log('   Ini sendiri bisa jadi penyebab peserta ganda kalau dosen/enrollment tersebar ke id yang berbeda-beda.');
  }

  for (const mkDoc of mkSnapshot.docs) {
    const mk = mkDoc.data();
    console.log(`\n--- mataKuliah id: ${mkDoc.id} ---`);
    console.log(`    kode: ${mk.kode} | nama: ${mk.nama} | semester: ${mk.semester} | sks: ${mk.sks}`);
    console.log(`    dosenIds: ${JSON.stringify(mk.dosenIds || [])}`);

    // 2) Ambil SEMUA enrollment untuk mkId ini - TANPA filter apa pun.
    const enrollSnapshot = await db.collection('enrollment').where('mkId', '==', mkDoc.id).get();
    console.log(`\n    Total dokumen enrollment untuk MK ini (semua status/semester): ${enrollSnapshot.size}`);

    if (enrollSnapshot.empty) continue;

    // Ambil data user sekaligus (batch) supaya bisa tampilkan nim/nama.
    const userIds = [...new Set(enrollSnapshot.docs.map(d => d.data().userId).filter(Boolean))];
    const userDocs = userIds.length > 0
      ? await db.getAll(...userIds.map(uid => db.collection('users').doc(uid)))
      : [];
    const userMap = {};
    userDocs.forEach(uDoc => { if (uDoc.exists) userMap[uDoc.id] = uDoc.data(); });

    // Susun baris untuk ditampilkan, urutkan by NIM lalu semester.
    let rows = enrollSnapshot.docs.map(doc => {
      const e = doc.data();
      const u = userMap[e.userId] || {};
      return {
        enrollmentId: doc.id,
        nim: u.nim || '(user tidak ketemu)',
        nama: u.nama || '-',
        userId: e.userId,
        semester: e.semester || '(kosong)',
        status: e.status,
        cocokPeriodeAktif: e.semester === periodeAktif,
        createdAt: e.createdAt || '-',
        catatan: e.catatan || ''
      };
    });

    if (fokusNim) {
      rows = rows.filter(r => r.nim === fokusNim);
      console.log(`    (difilter tampilan cuma untuk NIM ${fokusNim})`);
    }

    rows.sort((a, b) => (a.nim || '').localeCompare(b.nim || '') || (a.semester || '').localeCompare(b.semester || ''));

    console.log('');
    rows.forEach(r => {
      const tandaiLolos = r.status === 'active' && r.cocokPeriodeAktif ? '👉 MUNCUL di roster dosen sekarang' : '   (tidak muncul di roster sekarang)';
      const sumberScript = r.catatan.includes('Dibuat otomatis dari input nilai historis')
        ? '  [dibuat oleh script input-nilai-* kita]'
        : '';
      console.log(`    [${r.enrollmentId}] NIM ${r.nim.padEnd(12)} ${r.nama.padEnd(30)} semester="${r.semester}" status=${r.status}  ${tandaiLolos}${sumberScript}`);
      if (r.catatan) console.log(`         catatan: ${r.catatan}`);
      console.log(`         createdAt: ${r.createdAt}`);
    });
  }

  console.log('\n' + '='.repeat(78));
  console.log('Selesai. Baris bertanda "👉 MUNCUL di roster dosen sekarang" itulah yang');
  console.log('akan tampil di halaman dosen setelah patch semester-filter dipasang.');
  console.log('Kalau ada mahasiswa yang seharusnya TIDAK muncul tapi tetap bertanda 👉,');
  console.log('berarti field `semester` di dokumen enrollment-nya memang sama persis');
  console.log(`dengan periode aktif sekarang ("${periodeAktif}") - itu akar masalahnya,`);
  console.log('bukan lagi soal query filter (yang sudah benar).');
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
