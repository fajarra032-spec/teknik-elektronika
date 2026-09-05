/**
 * scripts/gabungkan-dosen-duplikat.js
 *
 * Menggabungkan dokumen dosen yang duplikat: semua mahasiswa yang
 * dosenPaId-nya menunjuk ke dokumen "duplikat" dipindahkan ke dokumen
 * "kanonik" (yang disimpan), lalu dokumen duplikatnya dihapus dan akun
 * Firebase Auth duplikatnya DINONAKTIFKAN (bukan dihapus permanen - lebih
 * aman, bisa dipulihkan lewat Firebase Console kalau ternyata keliru).
 *
 * CARA PAKAI:
 * 1. Jalankan dulu: node scripts/cek-dosen-duplikat.js
 * 2. Dari hasilnya, isi DAFTAR_GABUNG di bawah: `simpan` = id dosen yang
 *    mau dipertahankan (biasanya yang paling lama ada / paling banyak
 *    dipakai mahasiswa), `hapus` = id dosen duplikat yang mau dibuang.
 * 3. Jalankan: node scripts/gabungkan-dosen-duplikat.js
 *
 * AMAN: kalau DAFTAR_GABUNG masih kosong, script akan berhenti dan kasih
 * tahu tanpa mengubah apa pun.
 */

const { db, auth } = require('../config/firebaseAdmin');

// ============================================================================
// ISI INI SETELAH LIHAT HASIL scripts/cek-dosen-duplikat.js
// ============================================================================
// Contoh:
// const DAFTAR_GABUNG = [
//   { simpan: 'abc123IdDosenAsli', hapus: ['xyz789IdDosenDuplikat'] },
// ];
const DAFTAR_GABUNG = [
  {
    simpan: 'g4dtuUHKbqPliI7xtyUK2kkNF6j1', // Ariani Amri, S.Pd., M.Pd. | arianiamri@elektronika.com (dosen asli, sudah ada sebelumnya)
    hapus: ['cgVfJskNYgSKhjxOIeBlY0bQ6tp2'], // Ariani Amri, S.Pd., M.Pd | ariani.amri@elektronika.com (duplikat, 25 mahasiswa akan dipindahkan)
  },
];

async function main() {
  console.log('='.repeat(70));
  console.log('GABUNGKAN DOSEN DUPLIKAT');
  console.log('='.repeat(70));

  if (DAFTAR_GABUNG.length === 0) {
    console.log('DAFTAR_GABUNG masih kosong. Jalankan dulu:');
    console.log('  node scripts/cek-dosen-duplikat.js');
    console.log('lalu isi DAFTAR_GABUNG di scripts/gabungkan-dosen-duplikat.js sesuai hasilnya.');
    process.exit(0);
  }

  for (const item of DAFTAR_GABUNG) {
    console.log(`\n--- Gabungkan ke id "${item.simpan}" ---`);

    const simpanDoc = await db.collection('dosen').doc(item.simpan).get();
    if (!simpanDoc.exists) {
      console.log(`   ❌ Dosen id "${item.simpan}" (yang mau disimpan) tidak ditemukan - dilewati.`);
      continue;
    }
    const dataSimpan = simpanDoc.data();
    console.log(`   Dosen yang dipertahankan: ${dataSimpan.nama}`);

    for (const hapusId of item.hapus) {
      if (hapusId === item.simpan) {
        console.log(`   ⚠️  id "${hapusId}" sama dengan id yang disimpan - dilewati.`);
        continue;
      }

      const hapusDoc = await db.collection('dosen').doc(hapusId).get();
      if (!hapusDoc.exists) {
        console.log(`   ⚠️  Dosen duplikat id "${hapusId}" tidak ditemukan (mungkin sudah pernah dibersihkan) - dilewati.`);
        continue;
      }
      const dataHapus = hapusDoc.data();

      // Pindahkan semua mahasiswa yang dosenPaId-nya = hapusId
      const mahasiswaSnapshot = await db.collection('users').where('dosenPaId', '==', hapusId).get();
      console.log(`   Memindahkan ${mahasiswaSnapshot.size} mahasiswa dari "${dataHapus.nama}" (${hapusId}) ke "${dataSimpan.nama}" (${item.simpan})...`);

      const batchSize = 450;
      const docs = mahasiswaSnapshot.docs;
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        docs.slice(i, i + batchSize).forEach(doc => {
          batch.update(doc.ref, {
            dosenPaId: item.simpan,
            dosenPaNama: dataSimpan.nama,
            dosenPaNidn: dataSimpan.nidn || dataSimpan.nip || dataSimpan.nuptk || null,
            updatedAt: new Date().toISOString(),
          });
        });
        await batch.commit();
      }

      // Hapus dokumen dosen duplikat
      await db.collection('dosen').doc(hapusId).delete();
      console.log(`   🗑️  Dokumen dosen duplikat "${hapusId}" dihapus dari collection 'dosen'.`);

      // Nonaktifkan (bukan hapus permanen) akun Auth duplikatnya kalau ada
      if (dataHapus.userId) {
        try {
          await auth.updateUser(dataHapus.userId, { disabled: true });
          console.log(`   🔒 Akun login duplikat (userId: ${dataHapus.userId}, email: ${dataHapus.email || '-'}) dinonaktifkan.`);
        } catch (err) {
          console.log(`   ⚠️  Gagal menonaktifkan akun Auth duplikat: ${err.message}`);
        }
      }
    }
  }

  console.log('\nSelesai. Silakan cek ulang dengan: node scripts/cek-dosen-duplikat.js');
  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
