/**
 * scripts/buat-kelas-angkatan2026.js
 *
 * Menetapkan field `kelas` untuk mahasiswa angkatan 2026 (yang akunnya
 * SUDAH ADA di sistem - script ini TIDAK membuat akun baru, cuma mengisi
 * kelasnya). Dibagi jadi 3 kelas:
 *   - ELK1A  : 21 mahasiswa (termasuk Alfira & Salfiah Sakinah - digabung
 *              satu kelas sesuai permintaan)
 *   - ELK1B  : 21 mahasiswa
 *   - ELK1ON : Fajar Hariyanto & Fachri Huzain Ilyas (kelas khusus)
 *
 * "Kelas" di sistem ini cuma field teks bebas di dokumen mahasiswa (users)
 * - dipakai untuk pengelompokan/filter di Kelola Mahasiswa, bukan collection
 * terpisah - jadi tidak perlu "membuat" kelas di tempat lain, cukup diisi
 * di sini lalu otomatis muncul sebagai pilihan filter/kelas di halaman admin.
 *
 * AMAN DIJALANKAN BERKALI-KALI: cuma menimpa field `kelas`, tidak menyentuh
 * field lain (dosenPa, agama, biodata, dst tetap utuh).
 *
 * Cara pakai (dari root project, di server yang punya akses Firestore):
 *   node scripts/buat-kelas-angkatan2026.js
 */

const { db } = require('../config/firebaseAdmin');

// ============================================================================
// PEMBAGIAN KELAS
// ============================================================================

const ELK1A = [
  ['26302001', 'Alfira'],
  ['26302002', 'Muhammad Reham'],
  ['26302003', 'Elmi'],
  ['26302004', 'Akbar Harun'],
  ['26302005', 'Suriansyah'],
  ['26302006', 'Ahmad Syafiq Sholehan'],
  ['26302007', 'M. Ezzar Syahfiril'],
  ['26302008', 'Rayzha Putri Hikma'],
  ['26302009', 'Baso Kahar'],
  ['26302010', 'Pramudia Ananta Tribahari'],
  ['26302011', 'Harmawan'],
  ['26302013', 'Rahmaniar'],
  ['26302015', 'Dwi Ariyanto Jatmiko'],
  ['26302016', 'Muh Asmin'],
  ['26302017', 'Sulkarnain'],
  ['26302018', 'Anisa Daniel Tudang'],
  ['26302019', 'Salfiah Sakinah'],
  ['26302020', 'Andre Kondolele'],
  ['26302021', 'Febrianty Anton'],
  ['26302022', 'Triversa'],
  ['26302023', 'Jumadil Alisman'],
];

const ELK1B = [
  ['26302024', 'Aidil Jaya'],
  ['26302025', 'Riyani'],
  ['26302026', 'Andi Alifya Annisa S'],
  ['26302027', 'Davin Putra Emmanuel'],
  ['26302028', 'Indira Ramadani'],
  ['26302029', 'Ahmad Muflih'],
  ['26302030', 'Muh.Farrel'],
  ['26302031', 'Ainun Muhammad'],
  ['26302032', 'Muh. Jeyhan Jufri'],
  ['26302033', 'Deden Hardin'],
  ['26302034', 'Muh.Mufli Wahid M.Akil'],
  ['26302035', 'Ghifson Jasthin Ravael'],
  ['26302036', 'Rehan'],
  ['26302037', 'Herianto Parante'],
  ['26302038', 'Evan Dores'],
  ['26302039', 'Laurensya Parammangan'],
  ['26302040', 'Syariah Irawan'],
  ['26302041', 'Alga'],
  ['26302042', 'Muh. Ishak'],
  ['26302043', 'Rhapid Wahidan'],
  ['26302044', 'Rania'],
];

const ELK1ON = [
  ['26302012', 'Fajar Hariyanto'],
  ['26302014', 'Fachri Huzain Ilyas'],
];

const DAFTAR_KELAS = [
  { kelas: 'ELK1A', anggota: ELK1A },
  { kelas: 'ELK1B', anggota: ELK1B },
  { kelas: 'ELK1ON', anggota: ELK1ON },
];

// ============================================================================
// PROSES UTAMA
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('BUAT/SET KELAS - ANGKATAN 2026 SEMESTER 1');
  console.log('='.repeat(70));

  // Sanity check: pastikan tidak ada NIM yang kepencet dobel antar kelas
  const semuaNim = DAFTAR_KELAS.flatMap(k => k.anggota.map(a => a[0]));
  const hitung = {};
  semuaNim.forEach(nim => { hitung[nim] = (hitung[nim] || 0) + 1; });
  const dup = Object.keys(hitung).filter(n => hitung[n] > 1);
  if (dup.length > 0) {
    console.log('⚠️  NIM berikut ada di lebih dari satu kelas dalam daftar ini - dibetulkan dulu:', dup);
    process.exit(1);
  }
  console.log(`Total mahasiswa akan diproses: ${semuaNim.length}\n`);

  let berhasil = 0;
  let tidakDitemukan = [];

  for (const grup of DAFTAR_KELAS) {
    console.log(`--- Kelas ${grup.kelas} (${grup.anggota.length} mahasiswa) ---`);
    for (const [nim, namaHarapan] of grup.anggota) {
      const snapshot = await db.collection('users')
        .where('role', '==', 'mahasiswa')
        .where('nim', '==', nim)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(`   ❌ NIM ${nim} (${namaHarapan}) tidak ditemukan di sistem - dilewati.`);
        tidakDitemukan.push({ nim, nama: namaHarapan, kelas: grup.kelas });
        continue;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      if (data.nama && data.nama.trim().toLowerCase() !== namaHarapan.trim().toLowerCase()) {
        console.log(`   ⚠️  NIM ${nim}: nama di sistem ("${data.nama}") beda dengan daftar ("${namaHarapan}") - dicek manual ya.`);
      }

      await doc.ref.update({
        kelas: grup.kelas,
        updatedAt: new Date().toISOString(),
      });
      console.log(`   ✓  ${nim} - ${data.nama || namaHarapan}  ->  ${grup.kelas}`);
      berhasil++;
    }
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Total di daftar        : ${semuaNim.length}`);
  console.log(`Berhasil diset kelasnya: ${berhasil}`);
  console.log(`Tidak ditemukan        : ${tidakDitemukan.length}`);

  if (tidakDitemukan.length > 0) {
    console.log('\n❌ NIM yang TIDAK ditemukan di sistem (akun belum ada / NIM beda):');
    tidakDitemukan.forEach(t => console.log(`   - ${t.nim} - ${t.nama} (harusnya ${t.kelas})`));
    console.log('\nPastikan akun-akun ini sudah dibuat (mis. lewat scripts/seed-mahasiswa-angkatan2026.js');
    console.log('atau dibuat manual lewat /admin/mahasiswa), lalu jalankan ulang script ini.');
  }

  console.log('\nSelesai.');
  process.exit(tidakDitemukan.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
