/**
 * scripts/aktifkan-krs-semester3.js
 *
 * Mengaitkan (enroll) semua mahasiswa yang progres semesternya "Semester 3"
 * DAN statusnya "Aktif" ke paket KRS Semester 3, lewat helper yang sama
 * dengan yang jalan otomatis saat admin mengubah status mahasiswa - lihat
 * helpers/paketKurikulumHelper.js -> aktifkanPaketKrs().
 *
 * BEDA dengan scripts/aktifkan-krs-angkatan2026.js:
 * - Angkatan 2026 dicari dari AWALAN NIM ('26...') karena semester 1 pasti
 *   sama untuk semua (belum ada percabangan konsentrasi).
 * - Semester 3 di sini dicari dari field PROFIL mahasiswa (`semester` =
 *   "Semester 3"), BUKAN dari NIM - karena semester 3 bisa berlaku untuk
 *   mahasiswa angkatan mana pun (tergantung kapan mereka mulai), dan
 *   WAJIB sudah ada `konsentrasi` (Instrumentasi/Telekomunikasi) di
 *   profilnya masing-masing karena paket KRS semester 3 bercabang menurut
 *   konsentrasi (lihat PAKET_KURIKULUM di paketKurikulumHelper.js).
 *
 * Mahasiswa yang belum punya `konsentrasi` diisi TIDAK akan gagal fatal -
 * aktifkanPaketKrs() akan melaporkan dengan jelas "isi dulu Konsentrasi"
 * untuk mahasiswa itu di ringkasan akhir, supaya bisa dilengkapi lewat
 * /admin/mahasiswa lalu dijalankan ulang.
 *
 * AMAN DIJALANKAN BERKALI-KALI: mata kuliah yang SUDAH aktif di enrollment
 * mahasiswa tidak dibuat dobel.
 *
 * Cara pakai (dari root project, di server yang punya akses Firestore):
 *   node scripts/aktifkan-krs-semester3.js
 */

const { db } = require('../config/firebaseAdmin');
const { aktifkanPaketKrs } = require('../helpers/paketKurikulumHelper');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');

const SEMESTER_LABEL_PROFIL = 'Semester 3'; // nilai field `semester` di profil mahasiswa
const SEMESTER_NUMBER = 3;

async function jalankan() {
  console.log(`Mencari mahasiswa dengan status "${SEMESTER_LABEL_PROFIL}" & Aktif...\n`);

  const snapshot = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .where('semester', '==', SEMESTER_LABEL_PROFIL)
    .where('statusMahasiswa', '==', 'Aktif')
    .get();

  if (snapshot.empty) {
    console.log(`Tidak ada mahasiswa dengan status "${SEMESTER_LABEL_PROFIL}" & Aktif.`);
    console.log('Pastikan field "Semester" & "Status Mahasiswa" mereka sudah benar di /admin/mahasiswa.');
    process.exit(0);
  }

  console.log(`Ditemukan ${snapshot.size} mahasiswa. Mengaitkan ke paket KRS Semester ${SEMESTER_NUMBER}...\n`);

  const academicLabel = getCurrentAcademicSemester().label;
  let berhasil = 0;
  let gagal = 0;
  const detailGagal = [];
  const belumAdaKonsentrasi = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const label = `${data.nim} - ${data.nama}`;
    const konsentrasi = data.konsentrasi || null;

    if (!konsentrasi) {
      console.log(`⚠️  ${label}: belum ada Konsentrasi di profil - dilewati.`);
      belumAdaKonsentrasi.push(label);
      gagal++;
      continue;
    }

    try {
      const hasil = await aktifkanPaketKrs(db, doc.id, SEMESTER_NUMBER, konsentrasi, academicLabel, 'system-aktifkan-krs-semester3');
      if (hasil.ok) {
        console.log(`✅ ${label} (${konsentrasi}): ${hasil.message}`);
        berhasil++;
      } else {
        console.log(`⚠️  ${label} (${konsentrasi}): ${hasil.message}`);
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
  console.log(`Total mahasiswa diproses : ${snapshot.size}`);
  console.log(`Berhasil dikaitkan       : ${berhasil}`);
  console.log(`Gagal/perlu dicek        : ${gagal}`);

  if (belumAdaKonsentrasi.length > 0) {
    console.log('\n⚠️  Belum ada Konsentrasi (isi dulu lewat /admin/mahasiswa, lalu jalankan ulang):');
    belumAdaKonsentrasi.forEach(d => console.log(' - ' + d));
  }

  if (detailGagal.length > 0) {
    console.log('\nDetail lain yang perlu dicek:');
    detailGagal.forEach(d => console.log(' - ' + d));
    console.log('\nKalau pesannya soal mata kuliah/kelas tidak ditemukan, pastikan sudah:');
    console.log('  node scripts/sync-matakuliah-dari-rps.js');
    console.log('dan MK semester 3 (PEK32xx dkk) sudah dibuat dengan kode & kelas yang benar,');
    console.log('lalu jalankan ulang script ini.');
  }

  process.exit(gagal > 0 ? 1 : 0);
}

jalankan();
