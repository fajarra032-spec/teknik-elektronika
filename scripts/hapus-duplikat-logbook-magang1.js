/**
 * scripts/hapus-duplikat-logbook-magang1.js
 *
 * Mencari logbook Magang 1 (PDK dengan urutanPDK = 1, kode WP2021 "Praktik
 * Dunia Kerja 1" / variannya) yang DUPLIKAT - mahasiswa yang sama, tanggal
 * sama, dan isi kegiatan sama persis (biasanya kejadian karena tombol
 * submit ke-klik dua kali).
 *
 * ATURAN "DUPLIKAT" (biar tidak salah hapus):
 * - userId SAMA + tanggal SAMA + kegiatan SAMA PERSIS (dinormalisasi:
 *   spasi ganda & besar/kecil huruf diabaikan) + pdkId SAMA (Magang 1).
 * - Kalau lokasi/durasi ATAU jumlah foto lampiran (imageUrls) BERBEDA
 *   antar dokumen yang "isinya sama" itu, TIDAK dihapus otomatis - cuma
 *   dilaporkan untuk dicek manual (supaya tidak ada foto/detail unik yang
 *   hilang tanpa sengaja).
 *
 * DOKUMEN YANG DIPERTAHANKAN per kelompok duplikat (prioritas):
 *   1. Yang statusnya 'approved' (kalau cuma satu yang approved).
 *   2. Kalau status semuanya sama, pertahankan yang PALING LAMA
 *      (createdAt paling awal - biasanya submit yang asli).
 * Sisanya (duplikatnya) akan dihapus.
 *
 * DEFAULT DRY-RUN - cuma menampilkan apa yang AKAN dihapus. Tidak ada
 * perubahan ke database sampai dijalankan ulang dengan --confirm.
 *
 * Cara pakai:
 *   node scripts/hapus-duplikat-logbook-magang1.js
 *   node scripts/hapus-duplikat-logbook-magang1.js --confirm
 */

const { db } = require('../config/firebaseAdmin');

const KONFIRMASI = process.argv.includes('--confirm');

function normalisasiTeks(t) {
  return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('='.repeat(70));
  console.log(`HAPUS DUPLIKAT LOGBOOK MAGANG 1 - Mode: ${KONFIRMASI ? '🔴 KONFIRMASI (akan menghapus)' : '🟡 DRY-RUN (cuma simulasi)'}`);
  console.log('='.repeat(70));

  // 1. Cari mataKuliah PDK dengan urutanPDK = 1 (Magang 1)
  const mkSnapshot = await db.collection('mataKuliah')
    .where('isPDK', '==', true)
    .where('urutanPDK', '==', 1)
    .get();

  if (mkSnapshot.empty) {
    console.log('❌ Tidak ada mata kuliah PDK dengan urutanPDK=1 (Magang 1) ditemukan. Berhenti.');
    process.exit(1);
  }
  const pdkIds = mkSnapshot.docs.map(d => d.id);
  console.log(`Magang 1 ditemukan: ${mkSnapshot.docs.map(d => `${d.data().kode} (${d.id})`).join(', ')}\n`);

  // 2. Ambil semua logbook untuk PDK Magang 1 itu
  const logbookSnapshot = await db.collection('logbookMagang')
    .where('pdkId', 'in', pdkIds)
    .get();
  const semuaLogbook = logbookSnapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  console.log(`Total logbook Magang 1 di database: ${semuaLogbook.length}\n`);

  // 3. Kelompokkan per userId + tanggal + kegiatan (dinormalisasi)
  const kelompok = {};
  semuaLogbook.forEach(log => {
    const key = `${log.userId}|${log.tanggal}|${normalisasiTeks(log.kegiatan)}`;
    if (!kelompok[key]) kelompok[key] = [];
    kelompok[key].push(log);
  });

  const kelompokDuplikat = Object.values(kelompok).filter(g => g.length > 1);

  if (kelompokDuplikat.length === 0) {
    console.log('✅ Tidak ditemukan logbook Magang 1 yang duplikat. Aman, tidak ada yang perlu dihapus.');
    process.exit(0);
  }

  console.log(`⚠️  Ditemukan ${kelompokDuplikat.length} kelompok logbook duplikat:\n`);

  let totalAkanDihapus = 0;
  let totalPerluDicekManual = 0;

  for (const grup of kelompokDuplikat) {
    // Ambil data mahasiswa untuk ditampilkan (sekali per grup)
    const userDoc = await db.collection('users').doc(grup[0].userId).get();
    const namaMhs = userDoc.exists ? `${userDoc.data().nim} - ${userDoc.data().nama}` : grup[0].userId;

    console.log(`--- ${namaMhs} | Tanggal: ${grup[0].tanggal} | "${grup[0].kegiatan}" (${grup.length} dokumen) ---`);

    // Cek apakah lokasi/durasi/jumlah foto SAMA semua di grup ini
    const semuaSama = grup.every(l =>
      normalisasiTeks(l.lokasi) === normalisasiTeks(grup[0].lokasi) &&
      normalisasiTeks(l.durasi) === normalisasiTeks(grup[0].durasi) &&
      (l.imageUrls || []).length === (grup[0].imageUrls || []).length
    );

    grup.forEach(l => {
      console.log(`   - id: ${l.id} | status: ${l.status} | createdAt: ${l.createdAt} | foto: ${(l.imageUrls || []).length}`);
    });

    if (!semuaSama) {
      console.log('   ⚠️  Lokasi/durasi/jumlah foto BERBEDA antar dokumen ini - TIDAK dihapus otomatis, cek manual.\n');
      totalPerluDicekManual += grup.length;
      continue;
    }

    // Tentukan yang dipertahankan: approved dulu, kalau tidak ada/lebih dari satu, yang paling lama
    let dipertahankan = grup.find(l => l.status === 'approved');
    if (!dipertahankan) {
      dipertahankan = [...grup].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
    }
    const dihapus = grup.filter(l => l.id !== dipertahankan.id);

    console.log(`   ✓  Dipertahankan: ${dipertahankan.id} (status: ${dipertahankan.status})`);
    for (const l of dihapus) {
      console.log(`   🗑️  ${KONFIRMASI ? 'Menghapus' : 'Akan dihapus'}: ${l.id} (status: ${l.status})`);
      if (KONFIRMASI) {
        await l.ref.delete();
      }
      totalAkanDihapus++;
    }
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Kelompok duplikat ditemukan     : ${kelompokDuplikat.length}`);
  console.log(`Dokumen ${KONFIRMASI ? 'dihapus' : 'akan dihapus'}              : ${totalAkanDihapus}`);
  console.log(`Perlu dicek manual (beda detail): ${totalPerluDicekManual}`);

  if (!KONFIRMASI && totalAkanDihapus > 0) {
    console.log('\n👉 Ini baru DRY-RUN. Kalau daftar di atas sudah benar, jalankan ulang dengan:');
    console.log('   node scripts/hapus-duplikat-logbook-magang1.js --confirm');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
