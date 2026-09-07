/**
 * scripts/set-instrumentasi-semester3.js
 *
 * Mencari SEMUA mahasiswa yang:
 * - statusMahasiswa = "Aktif"
 * - semester = "Semester 3"
 * - konsentrasi masih KOSONG
 * ...lalu mengisi Konsentrasi = "Instrumentasi" untuk semuanya, dan
 * langsung mengaktifkan paket KRS Semester 3 / Instrumentasi (sama seperti
 * aktifkan-krs-semester3.js, tapi kali ini pasti berhasil karena
 * konsentrasinya baru saja diisi).
 *
 * Tidak perlu ketik NIM satu-satu - otomatis kena ke SEMUA yang cocok
 * kriteria di atas (termasuk yang belum ada di daftar sebelumnya, kalau
 * ada mahasiswa baru menyusul).
 *
 * AMAN DIJALANKAN BERKALI-KALI: mahasiswa yang konsentrasinya sudah terisi
 * (apa pun isinya) TIDAK disentuh/ditimpa oleh script ini. Mata kuliah
 * yang sudah aktif di KRS tidak dibuat dobel.
 *
 * Cara pakai:
 *   node scripts/set-instrumentasi-semester3.js
 */

const { db } = require('../config/firebaseAdmin');
const { aktifkanPaketKrs } = require('../helpers/paketKurikulumHelper');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');

const KONSENTRASI_TARGET = 'Instrumentasi';

async function main() {
  console.log('='.repeat(70));
  console.log(`ISI KONSENTRASI "${KONSENTRASI_TARGET}" + AKTIVASI KRS SEMESTER 3`);
  console.log('='.repeat(70));

  const snapshot = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .where('statusMahasiswa', '==', 'Aktif')
    .where('semester', '==', 'Semester 3')
    .get();

  const target = snapshot.docs.filter(doc => !doc.data().konsentrasi);

  if (target.length === 0) {
    console.log('Tidak ada mahasiswa Semester 3 Aktif yang konsentrasinya kosong. Tidak ada yang perlu diproses.');
    process.exit(0);
  }

  console.log(`Ditemukan ${target.length} mahasiswa yang akan diisi Konsentrasi = "${KONSENTRASI_TARGET}":\n`);

  const academicLabel = getCurrentAcademicSemester().label;
  let berhasil = 0;
  let gagal = 0;

  for (const doc of target) {
    const data = doc.data();
    const label = `${data.nim} - ${data.nama}`;

    await doc.ref.update({
      konsentrasi: KONSENTRASI_TARGET,
      updatedAt: new Date().toISOString()
    });
    console.log(`✓  ${label}: Konsentrasi diisi -> ${KONSENTRASI_TARGET}`);

    try {
      const hasil = await aktifkanPaketKrs(db, doc.id, 3, KONSENTRASI_TARGET, academicLabel, 'system-set-instrumentasi-semester3');
      if (hasil.ok) {
        console.log(`   ✅ ${hasil.message}`);
        berhasil++;
      } else {
        console.log(`   ⚠️  ${hasil.message}`);
        gagal++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      gagal++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Total diproses    : ${target.length}`);
  console.log(`Berhasil          : ${berhasil}`);
  console.log(`Gagal/perlu dicek : ${gagal}`);
  console.log('\nCatatan: kalau ternyata ada di antara mahasiswa ini yang seharusnya');
  console.log('Telekomunikasi (bukan Instrumentasi), ganti manual Konsentrasinya lewat');
  console.log('/admin/mahasiswa, lalu jalankan ulang node scripts/aktifkan-krs-semester3.js.');

  process.exit(gagal > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
