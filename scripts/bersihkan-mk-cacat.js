/**
 * scripts/bersihkan-mk-cacat.js
 *
 * Membersihkan dokumen `mataKuliah` CACAT (semester/sks kosong) yang
 * ketahuan lewat scripts/cek-mk-malformed.js, KHUSUS untuk kasus di mana
 * SEMUA mahasiswa di dokumen cacat itu 100% sudah terdaftar juga di
 * dokumen SEHAT dengan kode+kelas yang sama (dobel murni, aman dibersihkan).
 *
 * Untuk tiap dokumen cacat yang memenuhi syarat itu:
 *   1. Hapus SEMUA dokumen `enrollment` yang menunjuk ke mkId dokumen
 *      cacat itu (mahasiswanya TETAP terdaftar lewat dokumen sehat yang
 *      jadi pasangannya - jadi tidak ada yang kehilangan enrollment).
 *   2. Hapus dokumen `mataKuliah` cacat itu sendiri.
 *
 * SYARAT KEAMANAN (supaya tidak salah hapus):
 *   - HANYA diproses kalau dokumen cacat itu 0% berisi mahasiswa yang
 *     TIDAK ada pasangannya di dokumen sehat (semua harus 100% dobel).
 *     Kalau ada satu saja mahasiswa yang CUMA ada di dokumen cacat (tidak
 *     dobel), dokumen itu DILEWATI & dilaporkan - tidak dihapus, karena
 *     berarti ada nilai/data yang mungkin cuma ada di situ.
 *   - HANYA mencari pasangan dokumen sehat dengan kode+kelas YANG SAMA
 *     persis, bukan tebakan.
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar menghapus.
 *
 * Cara pakai:
 *   node scripts/bersihkan-mk-cacat.js
 *   node scripts/bersihkan-mk-cacat.js --confirm
 */

const { db } = require('../config/firebaseAdmin');

const KONFIRMASI = process.argv.includes('--confirm');

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENGHAPUS' : '🟡 DRY-RUN - cuma simulasi, tidak menghapus apa pun'}\n`);

  const semuaMkSnapshot = await db.collection('mataKuliah').get();
  const semuaMk = semuaMkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const cacat = semuaMk.filter(mk => mk.semester === undefined || mk.semester === null || mk.sks === undefined || mk.sks === null);
  const sehat = semuaMk.filter(mk => !cacat.includes(mk));

  console.log(`Dokumen cacat ditemukan: ${cacat.length}\n`);

  let totalDihapusEnrollment = 0;
  let totalDihapusMk = 0;
  let totalDilewati = 0;

  for (const mkCacat of cacat) {
    console.log(`--- [${mkCacat.kode}] ${mkCacat.nama || '(nama kosong)'} - kelas: ${mkCacat.kelas || '-'} - id: ${mkCacat.id} ---`);

    // Cari pasangan sehat dengan kode+kelas yang SAMA PERSIS.
    const pasangan = sehat.filter(mk => mk.kode === mkCacat.kode && mk.kelas === mkCacat.kelas);

    if (pasangan.length !== 1) {
      console.log(`   ⏭️  DILEWATI - ditemukan ${pasangan.length} dokumen sehat dengan kode+kelas sama (harus tepat 1 supaya aman diproses otomatis).`);
      totalDilewati++;
      continue;
    }

    const mkSehat = pasangan[0];

    const enrollCacatSnapshot = await db.collection('enrollment').where('mkId', '==', mkCacat.id).get();
    const enrollSehatSnapshot = await db.collection('enrollment').where('mkId', '==', mkSehat.id).get();
    const userIdSehat = new Set(enrollSehatSnapshot.docs.map(d => d.data().userId));

    const tidakDobel = enrollCacatSnapshot.docs.filter(d => !userIdSehat.has(d.data().userId));

    if (tidakDobel.length > 0) {
      console.log(`   ⏭️  DILEWATI - ada ${tidakDobel.length} enrollment di dokumen cacat yang TIDAK dobel (tidak ada pasangannya di dokumen sehat ${mkSehat.id}). Perlu dicek manual, tidak dihapus otomatis.`);
      tidakDobel.forEach(d => console.log(`        userId ${d.data().userId} (enrollment ${d.id})`));
      totalDilewati++;
      continue;
    }

    console.log(`   ✅ Aman diproses: ${enrollCacatSnapshot.size} enrollment di dokumen cacat, semuanya 100% dobel dengan dokumen sehat ${mkSehat.id}.`);

    if (KONFIRMASI) {
      const batch = db.batch();
      enrollCacatSnapshot.docs.forEach(d => batch.delete(d.ref));
      batch.delete(db.collection('mataKuliah').doc(mkCacat.id));
      await batch.commit();
      console.log(`   🗑️  Dihapus: ${enrollCacatSnapshot.size} enrollment + 1 dokumen mataKuliah cacat.`);
    } else {
      console.log(`   (dry-run - akan menghapus ${enrollCacatSnapshot.size} enrollment + dokumen mataKuliah ini kalau --confirm)`);
    }

    totalDihapusEnrollment += enrollCacatSnapshot.size;
    totalDihapusMk += 1;
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Dokumen mataKuliah cacat ${KONFIRMASI ? 'dihapus' : 'AKAN dihapus'}   : ${totalDihapusMk}`);
  console.log(`Enrollment dobel ${KONFIRMASI ? 'dihapus' : 'AKAN dihapus'}          : ${totalDihapusEnrollment}`);
  console.log(`Dilewati (perlu cek manual)              : ${totalDilewati}`);

  if (!KONFIRMASI && totalDihapusMk > 0) {
    console.log('\n👉 Ini baru DRY-RUN. Kalau daftar di atas sudah sesuai, jalankan ulang dengan --confirm:');
    console.log('   node scripts/bersihkan-mk-cacat.js --confirm');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
