/**
 * scripts/perbaiki-sks-pdk.js
 *
 * Memperbaiki field `sks` pada dokumen `mataKuliah` untuk mata kuliah
 * Praktik Dunia Kerja (PDK / magang - kode WP2021/WP2022/WP2023) yang
 * ternyata tersimpan salah (mis. 6) di database, padahal yang benar
 * SATU-SATUNYA yang dipakai di kurikulum resmi & seed (lihat
 * scripts/seed-matakuliah-2026.js, views/dokumen/kurikulum.ejs,
 * routes/landing.js) adalah 20 SKS.
 *
 * Mencari SEMUA dokumen `mataKuliah` yang namanya mengandung
 * "Praktik Dunia Kerja" (case-insensitive, jadi ketemu juga varian
 * "Praktek Dunia Kerja"/"PDK 1/2/3") dengan sks !== 20, lalu
 * mengoreksinya jadi 20.
 *
 * DEFAULT DRY-RUN (cuma menampilkan apa yang AKAN diubah).
 * Perlu flag --confirm untuk benar-benar menyimpan perubahan.
 *
 * Cara pakai:
 *   node scripts/perbaiki-sks-pdk.js            (cek dulu, tidak mengubah apa pun)
 *   node scripts/perbaiki-sks-pdk.js --confirm  (terapkan perbaikan)
 */

const { db } = require('../config/firebaseAdmin');

const SKS_BENAR = 20;
const KONFIRMASI = process.argv.includes('--confirm');

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENYIMPAN PERUBAHAN' : '🟡 DRY-RUN - cuma simulasi, tidak mengubah apa pun'}\n`);

  const semuaMkSnapshot = await db.collection('mataKuliah').get();
  const semuaMk = semuaMkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const targetPdk = semuaMk.filter(mk =>
    (mk.nama || '').toLowerCase().includes('praktik dunia kerja') ||
    (mk.nama || '').toLowerCase().includes('praktek dunia kerja')
  );

  if (targetPdk.length === 0) {
    console.log('Tidak ditemukan mata kuliah "Praktik Dunia Kerja" apa pun di koleksi mataKuliah.');
    return;
  }

  console.log(`Ditemukan ${targetPdk.length} dokumen MK Praktik Dunia Kerja:\n`);

  let totalDiperbaiki = 0;

  for (const mk of targetPdk) {
    const sksSekarang = mk.sks;
    const perluDiperbaiki = sksSekarang !== SKS_BENAR;

    console.log(`--- [${mk.kode || '-'}] ${mk.nama} - kelas: ${mk.kelas || '-'} - id: ${mk.id} ---`);
    console.log(`   SKS sekarang: ${sksSekarang === undefined ? '(kosong)' : sksSekarang}`);

    if (!perluDiperbaiki) {
      console.log('   ✅ Sudah benar (20 SKS), dilewati.');
      continue;
    }

    console.log(`   ⚠️  Salah - seharusnya ${SKS_BENAR} SKS.`);

    if (KONFIRMASI) {
      await db.collection('mataKuliah').doc(mk.id).update({ sks: SKS_BENAR });
      console.log(`   ✍️  Diperbaiki jadi ${SKS_BENAR} SKS.`);
    } else {
      console.log(`   ⏭️  (dry-run, belum disimpan - jalankan ulang dengan --confirm)`);
    }
    totalDiperbaiki++;
  }

  console.log('\n' + '='.repeat(78));
  console.log(`Total dokumen yang ${KONFIRMASI ? 'diperbaiki' : 'PERLU diperbaiki'}: ${totalDiperbaiki}`);
  if (!KONFIRMASI && totalDiperbaiki > 0) {
    console.log('Jalankan lagi dengan --confirm untuk benar-benar menyimpan perubahan.');
  }
  console.log('='.repeat(78));
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Gagal menjalankan script:', err);
    process.exit(1);
  });
