/**
 * scripts/naikkan-semester-batch.js
 *
 * Menaikkan field "Semester" di profil mahasiswa secara massal berdasarkan
 * awalan NIM (angkatan) - dipakai untuk pergantian tahun akademik, supaya
 * tidak perlu edit satu-satu lewat /admin/mahasiswa.
 *
 * KONFIGURASI SAAT INI:
 *   - NIM awalan '25' (angkatan 2025) -> Semester 3
 *   - NIM awalan '24' (angkatan 2024) -> Semester 5
 *
 * AMAN & HATI-HATI:
 * - HANYA memproses mahasiswa berstatus "Aktif" (yang "Cuti"/"Keluar"/
 *   "Lulus" TIDAK disentuh - lihat hasil cek-status-angkatan2025.js
 *   sebelumnya, ada 1 mahasiswa berstatus "Keluar" yang sengaja dilewati).
 * - TIDAK PERNAH MENURUNKAN semester: kalau mahasiswa semester-nya sudah
 *   SAMA DENGAN atau LEBIH TINGGI dari target (mis. ada yang manual sudah
 *   di-set semester 5 duluan), dilewati dengan aman - dilaporkan sebagai
 *   "sudah >= target, dilewati", bukan ditimpa mundur.
 * - TIDAK mengaktifkan KRS secara langsung di sini (supaya bisa dicek dulu
 *   hasilnya) - setelah script ini selesai, jalankan manual:
 *     node scripts/aktifkan-krs-semester3.js   (untuk yang baru naik ke 3)
 *   dan buat/jalankan script serupa untuk semester 5 kalau paket
 *   kurikulumnya sudah ada di PAKET_KURIKULUM.
 *
 * Cara pakai:
 *   node scripts/naikkan-semester-batch.js
 */

const { db } = require('../config/firebaseAdmin');
const { parseSemesterNumber } = require('../helpers/paketKurikulumHelper');

// ============================================================================
// KONFIGURASI: awalan NIM -> semester target
// ============================================================================
const DAFTAR_KENAIKAN = [
  { prefixNim: '25', semesterTarget: 3 },
  { prefixNim: '24', semesterTarget: 5 },
];

async function main() {
  console.log('='.repeat(70));
  console.log('NAIKKAN SEMESTER MASSAL');
  console.log('='.repeat(70));

  const snapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
  const semuaMahasiswa = snapshot.docs.map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() }));

  let totalNaik = 0;
  let totalDilewati = 0;
  let totalBukanAktif = 0;

  for (const grup of DAFTAR_KENAIKAN) {
    const targetLabel = `Semester ${grup.semesterTarget}`;
    const anggota = semuaMahasiswa
      .filter(m => (m.nim || '').startsWith(grup.prefixNim))
      .sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));

    console.log(`\n--- Angkatan 20${grup.prefixNim} -> ${targetLabel} (${anggota.length} mahasiswa ditemukan) ---`);

    for (const m of anggota) {
      const label = `${m.nim} - ${m.nama}`;

      if (m.statusMahasiswa !== 'Aktif') {
        console.log(`   ⏭️  ${label}: status "${m.statusMahasiswa || 'kosong'}" (bukan Aktif) - dilewati.`);
        totalBukanAktif++;
        continue;
      }

      const semesterSekarang = parseSemesterNumber(m.semester);
      if (semesterSekarang !== null && semesterSekarang >= grup.semesterTarget) {
        console.log(`   ⏭️  ${label}: sudah "${m.semester}" (>= target) - dilewati.`);
        totalDilewati++;
        continue;
      }

      await m.ref.update({ semester: targetLabel, updatedAt: new Date().toISOString() });
      console.log(`   ✅ ${label}: "${m.semester || 'kosong'}" -> "${targetLabel}"`);
      totalNaik++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Dinaikkan semesternya : ${totalNaik}`);
  console.log(`Dilewati (sudah >=)   : ${totalDilewati}`);
  console.log(`Dilewati (bukan Aktif): ${totalBukanAktif}`);
  console.log('\nLangkah selanjutnya:');
  console.log('  node scripts/aktifkan-krs-semester3.js   <- untuk yang baru naik ke Semester 3');
  console.log('(untuk Semester 5, beri tahu saya kalau PAKET_KURIKULUM semester 5 sudah siap,');
  console.log(' nanti saya buatkan scripts/aktifkan-krs-semester5.js dengan pola yang sama)');

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
