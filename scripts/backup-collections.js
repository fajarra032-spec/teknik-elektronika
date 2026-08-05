/**
 * scripts/backup-collections.js
 * ============================================================================
 * BACKUP SEDERHANA & AMAN - tanpa perlu Cloud Storage/plan Blaze.
 *
 * Skrip ini HANYA MEMBACA data (read-only, tidak pernah menulis/menghapus
 * apa pun di Firestore) dan menyimpan salinannya sebagai file JSON lokal di
 * komputer/server Anda. Kalau nanti ada yang tidak beres setelah memasang
 * pembaruan, Anda punya salinan datanya untuk dibandingkan atau dipulihkan
 * manual.
 *
 * CARA PAKAI:
 *   1. Taruh file ini di folder `scripts/` pada root project Anda (folder
 *      yang sejajar dengan `config/`, `routes/`, `helpers/`).
 *   2. Jalankan dari root project:  node scripts/backup-collections.js
 *   3. Hasilnya akan tersimpan di folder `backup-YYYY-MM-DD_HH-mm-ss/`
 *      (dibuat otomatis), berisi satu file .json per koleksi.
 *
 * Jalankan skrip ini SEBELUM memasang pembaruan apa pun, sebagai jaring
 * pengaman. Aman dijalankan kapan saja karena sifatnya cuma membaca.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseAdmin');

// Koleksi yang disarankan di-backup - sesuaikan/tambah kalau perlu.
// Ini koleksi-koleksi yang disentuh (dibaca ATAU ditulis) oleh pembaruan
// rubrik/magang/dashboard yang sudah dibuat.
const KOLEKSI_YANG_DIBACKUP = [
  'nilai',
  'tugas',
  'tugasManual',
  'rubrikBobot',
  'logbookMagang',
  'magangPeriod',
  'enrollment',
  'mataKuliah'
];

async function backupKoleksi(namaKoleksi, folderTujuan) {
  process.stdout.write(`  - ${namaKoleksi} ... `);
  try {
    const snapshot = await db.collection(namaKoleksi).get();
    const dataArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const filePath = path.join(folderTujuan, `${namaKoleksi}.json`);
    fs.writeFileSync(filePath, JSON.stringify(dataArray, null, 2), 'utf-8');
    console.log(`OK (${dataArray.length} dokumen)`);
    return { koleksi: namaKoleksi, jumlah: dataArray.length, error: null };
  } catch (error) {
    console.log(`GAGAL: ${error.message}`);
    return { koleksi: namaKoleksi, jumlah: 0, error: error.message };
  }
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('Z')[0];
  const folderTujuan = path.join(process.cwd(), `backup-${timestamp}`);
  fs.mkdirSync(folderTujuan, { recursive: true });

  console.log(`\n📦 Membuat backup di: ${folderTujuan}\n`);
  console.log('Mem-backup koleksi (read-only, tidak mengubah apa pun):');

  const ringkasan = [];
  for (const koleksi of KOLEKSI_YANG_DIBACKUP) {
    const hasil = await backupKoleksi(koleksi, folderTujuan);
    ringkasan.push(hasil);
  }

  const ringkasanPath = path.join(folderTujuan, '_ringkasan.json');
  fs.writeFileSync(ringkasanPath, JSON.stringify({
    waktuBackup: new Date().toISOString(),
    ringkasan
  }, null, 2), 'utf-8');

  console.log(`\n✅ Selesai. Total ${ringkasan.reduce((a, r) => a + r.jumlah, 0)} dokumen ter-backup.`);
  console.log(`   Folder: ${folderTujuan}\n`);

  const adaError = ringkasan.some(r => r.error);
  if (adaError) {
    console.log('⚠️  Ada koleksi yang gagal di-backup (lihat di atas) - periksa nama koleksinya benar/ada.');
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Backup gagal total:', error);
  process.exitCode = 1;
});
