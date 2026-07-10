/**
 * scripts/migrate-add-periode.js
 *
 * Migrasi satu kali: mengisi field `periode` pada dokumen 'tugas' dan 'nilai'
 * yang belum punya field itu (data lama, dari sebelum fitur pemisahan
 * semester ditambahkan).
 *
 * Sesuai keputusan: semua data lama dianggap berasal dari PERIODE AKTIF SAAT
 * INI dijalankannya skrip ini. Jalankan skrip ini SEKALI, idealnya sebelum
 * pergantian ke semester berikutnya, supaya data lama tidak salah tertandai
 * sebagai milik semester baru.
 *
 * Cara pakai:
 *   node scripts/migrate-add-periode.js
 *
 * Aman dijalankan berkali-kali (idempotent): dokumen yang sudah punya field
 * `periode` akan dilewati, tidak ditimpa.
 */

const { db } = require('../config/firebaseAdmin');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');

async function migrateCollection(collectionName) {
  const periodeAktif = getCurrentAcademicSemester().label;
  const snapshot = await db.collection(collectionName).get();

  let jumlahDiperbarui = 0;
  let jumlahDilewati = 0;

  // Batch maksimum 500 operasi per commit di Firestore
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.periode) {
      jumlahDilewati++;
      continue;
    }
    batch.update(doc.ref, { periode: periodeAktif });
    jumlahDiperbarui++;
    opsInBatch++;

    if (opsInBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`✅ ${collectionName}: ${jumlahDiperbarui} dokumen diberi periode="${periodeAktif}", ${jumlahDilewati} dilewati (sudah punya periode)`);
}

async function main() {
  console.log('Memulai migrasi periode...');
  await migrateCollection('tugas');
  await migrateCollection('nilai');
  console.log('Migrasi selesai.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Migrasi gagal:', err);
  process.exit(1);
});
