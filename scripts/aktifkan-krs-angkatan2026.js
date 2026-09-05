/**
 * scripts/aktifkan-krs-angkatan2026.js
 *
 * Mengaitkan (enroll) semua mahasiswa angkatan 2026 (NIM diawali '26') ke
 * paket KRS Semester 1, lewat helper yang sama dengan yang jalan otomatis
 * saat admin ubah status mahasiswa jadi "Aktif" di menu Mata Kuliah/
 * Mahasiswa - lihat helpers/paketKurikulumHelper.js -> aktifkanPaketKrs().
 *
 * KAPAN PERLU SCRIPT INI:
 * - Kalau scripts/seed-mahasiswa-angkatan2026.js dijalankan SEBELUM data
 *   mata kuliah semester 1 lengkap di database (mis. sebelum menjalankan
 *   scripts/sync-matakuliah-dari-rps.js), auto-aktivasi KRS di script itu
 *   akan gagal/lewat sebagian - jalankan script ini setelahnya untuk
 *   melengkapi yang belum terkait.
 * - Atau kalau mau mengaitkan ulang / memastikan semua mahasiswa angkatan
 *   2026 sudah punya KRS semester 1, kapan saja.
 *
 * AMAN DIJALANKAN BERKALI-KALI: mata kuliah yang SUDAH aktif di enrollment
 * mahasiswa tidak dibuat dobel (dicek oleh aktifkanPaketKrs/
 * createKrsDanEnrollment sebelum menambah).
 *
 * Cara pakai (dari root project, di server yang punya akses Firestore):
 *   node scripts/aktifkan-krs-angkatan2026.js
 */

const { db } = require('../config/firebaseAdmin');
const { aktifkanPaketKrs } = require('../helpers/paketKurikulumHelper');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');

// Prefix NIM angkatan 2026. Ganti kalau mau dipakai untuk angkatan lain.
const PREFIX_NIM_ANGKATAN = '26';
const SEMESTER_NUMBER = 1;
const KONSENTRASI = null; // semester 1 belum ada konsentrasi

async function jalankan() {
  console.log(`Mencari mahasiswa dengan NIM awalan '${PREFIX_NIM_ANGKATAN}'...\n`);

  const snapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
  const mahasiswaAngkatan = snapshot.docs.filter(doc => {
    const nim = doc.data().nim || '';
    return nim.startsWith(PREFIX_NIM_ANGKATAN);
  });

  if (mahasiswaAngkatan.length === 0) {
    console.log('Tidak ada mahasiswa dengan NIM awalan itu. Pastikan scripts/seed-mahasiswa-angkatan2026.js sudah dijalankan.');
    process.exit(0);
  }

  console.log(`Ditemukan ${mahasiswaAngkatan.length} mahasiswa. Mengaitkan ke paket KRS Semester ${SEMESTER_NUMBER}...\n`);

  const academicLabel = getCurrentAcademicSemester().label;
  let berhasil = 0;
  let gagal = 0;
  const detailGagal = [];

  for (const doc of mahasiswaAngkatan) {
    const data = doc.data();
    const label = `${data.nim} - ${data.nama}`;
    try {
      const hasil = await aktifkanPaketKrs(db, doc.id, SEMESTER_NUMBER, KONSENTRASI, academicLabel, 'system-aktifkan-krs-angkatan2026');
      if (hasil.ok) {
        console.log(`✅ ${label}: ${hasil.message}`);
        berhasil++;
      } else {
        console.log(`⚠️  ${label}: ${hasil.message}`);
        gagal++;
        detailGagal.push(`${label}: ${hasil.message}`);
      }
    } catch (error) {
      console.error(`❌ ${label}: ${error.message}`);
      gagal++;
      detailGagal.push(`${label}: ${error.message}`);
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Total mahasiswa diproses : ${mahasiswaAngkatan.length}`);
  console.log(`Berhasil dikaitkan : ${berhasil}`);
  console.log(`Gagal/perlu dicek : ${gagal}`);
  if (detailGagal.length > 0) {
    console.log('\nDetail yang perlu dicek:');
    detailGagal.forEach(d => console.log(' - ' + d));
    console.log('\nKalau pesannya soal mata kuliah tidak ditemukan, jalankan dulu:');
    console.log('  node scripts/sync-matakuliah-dari-rps.js');
    console.log('lalu jalankan ulang script ini.');
  }

  process.exit(gagal > 0 ? 1 : 0);
}

jalankan();
