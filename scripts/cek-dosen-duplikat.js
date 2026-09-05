/**
 * scripts/cek-dosen-duplikat.js
 *
 * Script DIAGNOSTIK (tidak mengubah apa pun) untuk mengecek dosen yang
 * mungkin duplikat di collection `dosen` - baik karena dibuat berulang
 * oleh script assign-dosen-pa-*, maupun sebab lain (input manual dengan
 * ejaan beda).
 *
 * CARA KERJA:
 * 1. Normalisasi nama tiap dosen (huruf kecil semua, buang gelar/tanda
 *    baca/spasi ganda) supaya "Ariani Amri, S.Pd., M.Pd" dan
 *    "ariani amri s.pd m.pd" dianggap SAMA untuk pengecekan ini.
 * 2. Kelompokkan dosen berdasarkan nama yang sudah dinormalisasi itu.
 * 3. Cetak SEMUA kelompok yang punya lebih dari 1 dokumen - lengkap dengan
 *    id dokumen, nama asli, email, nip/nidn, userId, jumlah mahasiswa yang
 *    sedang menunjuk ke masing-masing id (via dosenPaId) - supaya kelihatan
 *    mana yang "aktif dipakai" dan mana yang kosong (kemungkinan besar
 *    duplikat yang aman dihapus).
 *
 * SETELAH DIJALANKAN: salin hasilnya dan kirim ke saya (atau isi
 * scripts/gabungkan-dosen-duplikat.js langsung) supaya bisa ditentukan mana
 * yang disimpan (id "kanonik") dan mana yang digabungkan/dihapus.
 *
 * Cara pakai:
 *   node scripts/cek-dosen-duplikat.js
 */

const { db } = require('../config/firebaseAdmin');

function normalisasiNama(nama) {
  return (nama || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // buang titik, koma, dll
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('='.repeat(70));
  console.log('CEK DOSEN DUPLIKAT (diagnostik - tidak mengubah data)');
  console.log('='.repeat(70));

  const dosenSnapshot = await db.collection('dosen').get();
  console.log(`Total dokumen di collection 'dosen': ${dosenSnapshot.size}\n`);

  // Kelompokkan berdasarkan nama yang dinormalisasi
  const kelompok = {};
  dosenSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const key = normalisasiNama(data.nama);
    if (!kelompok[key]) kelompok[key] = [];
    kelompok[key].push({ id: doc.id, ...data });
  });

  // Hitung berapa mahasiswa menunjuk ke tiap dosenId (via dosenPaId)
  console.log('Menghitung jumlah mahasiswa per dosenPaId (mungkin agak lama)...\n');
  const jumlahMahasiswaPerDosen = {};
  const mahasiswaSnapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
  mahasiswaSnapshot.docs.forEach(doc => {
    const dosenPaId = doc.data().dosenPaId;
    if (dosenPaId) {
      jumlahMahasiswaPerDosen[dosenPaId] = (jumlahMahasiswaPerDosen[dosenPaId] || 0) + 1;
    }
  });

  const namaDuplikat = Object.keys(kelompok).filter(key => kelompok[key].length > 1);

  if (namaDuplikat.length === 0) {
    console.log('✅ Tidak ditemukan dosen dengan nama yang mirip/duplikat.');
    process.exit(0);
  }

  console.log(`⚠️  Ditemukan ${namaDuplikat.length} nama dosen yang punya lebih dari 1 dokumen:\n`);

  namaDuplikat.forEach((key, idx) => {
    const anggota = kelompok[key];
    console.log(`${idx + 1}. Kelompok nama: "${key}" (${anggota.length} dokumen)`);
    anggota.forEach(d => {
      const jumlahMhs = jumlahMahasiswaPerDosen[d.id] || 0;
      console.log(`   - id: ${d.id}`);
      console.log(`     nama asli   : "${d.nama}"`);
      console.log(`     email       : ${d.email || '-'}`);
      console.log(`     nip/nidn    : ${d.nip || d.nidn || d.nuptk || '-'}`);
      console.log(`     userId      : ${d.userId || '-'}`);
      console.log(`     createdAt   : ${d.createdAt || '-'}`);
      console.log(`     dipakai oleh: ${jumlahMhs} mahasiswa (dosenPaId)`);
      console.log('');
    });
  });

  console.log('='.repeat(70));
  console.log('LANGKAH SELANJUTNYA');
  console.log('='.repeat(70));
  console.log('Salin/screenshot output di atas dan kirim ke saya (Claude) - saya akan');
  console.log('tentukan mana yang perlu disimpan (biasanya yang paling lama/paling');
  console.log('banyak dipakai) dan buatkan script gabungnya supaya aman (tidak ada');
  console.log('mahasiswa yang PA-nya hilang / tertimpa data yang salah).');

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
