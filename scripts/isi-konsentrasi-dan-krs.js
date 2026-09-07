/**
 * scripts/isi-konsentrasi-dan-krs.js
 *
 * Untuk mahasiswa yang KRS-nya gagal diaktifkan gara-gara field
 * "Konsentrasi" masih kosong (lihat output scripts/aktifkan-krs-semester3.js
 * dkk - pesan "belum ada Konsentrasi di profil"). Script ini:
 * 1. Mengisi field `konsentrasi` di profil mahasiswa (sama seperti admin
 *    mengisinya lewat form edit di /admin/mahasiswa).
 * 2. Langsung mengaktifkan paket KRS semester yang sesuai untuk mahasiswa
 *    itu (lewat aktifkanPaketKrs() yang sama, jadi hasilnya identik dengan
 *    kalau dijalankan lewat script aktifkan-krs-semesterX.js).
 *
 * ISI DAFTAR_MAHASISWA DI BAWAH sebelum menjalankan - satu baris per
 * mahasiswa yang mau dilengkapi. `semester` diisi ANGKA (1, 2, 3, dst -
 * sesuai progres semester mahasiswa itu SAAT INI, cek di /admin/mahasiswa
 * kalau tidak yakin).
 *
 * AMAN DIJALANKAN BERKALI-KALI: mata kuliah yang sudah aktif tidak dibuat
 * dobel.
 *
 * Cara pakai:
 *   node scripts/isi-konsentrasi-dan-krs.js
 */

const { db } = require('../config/firebaseAdmin');
const { aktifkanPaketKrs, KONSENTRASI_OPTIONS } = require('../helpers/paketKurikulumHelper');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');

// ============================================================================
// ISI DI SINI: NIM, konsentrasi yang benar, dan semester mahasiswa saat ini
// ============================================================================
const DAFTAR_MAHASISWA = [
  { nim: '25302001', konsentrasi: 'Instrumentasi', semester: 3 }, // Marshall Hansen Paranna - GANTI 'Instrumentasi' jadi 'Telekomunikasi' kalau ternyata itu yang benar
];

async function jalankan() {
  console.log('='.repeat(70));
  console.log('ISI KONSENTRASI + AKTIVASI KRS');
  console.log('='.repeat(70));

  const academicLabel = getCurrentAcademicSemester().label;
  let berhasil = 0;
  let gagal = 0;

  for (const item of DAFTAR_MAHASISWA) {
    if (!KONSENTRASI_OPTIONS.includes(item.konsentrasi)) {
      console.log(`❌ NIM ${item.nim}: konsentrasi "${item.konsentrasi}" tidak valid. Pilihan: ${KONSENTRASI_OPTIONS.join(', ')}`);
      gagal++;
      continue;
    }

    const snapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .where('nim', '==', item.nim)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`❌ NIM ${item.nim}: mahasiswa tidak ditemukan di sistem.`);
      gagal++;
      continue;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    const label = `${data.nim} - ${data.nama}`;

    await doc.ref.update({
      konsentrasi: item.konsentrasi,
      updatedAt: new Date().toISOString()
    });
    console.log(`✓  ${label}: Konsentrasi diisi -> ${item.konsentrasi}`);

    try {
      const hasil = await aktifkanPaketKrs(db, doc.id, item.semester, item.konsentrasi, academicLabel, 'system-isi-konsentrasi-dan-krs');
      if (hasil.ok) {
        console.log(`✅ ${label}: ${hasil.message}`);
        berhasil++;
      } else {
        console.log(`⚠️  ${label}: ${hasil.message}`);
        gagal++;
      }
    } catch (error) {
      console.error(`❌ ${label}: ${error.message}`);
      gagal++;
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Total diproses     : ${DAFTAR_MAHASISWA.length}`);
  console.log(`Berhasil            : ${berhasil}`);
  console.log(`Gagal/perlu dicek   : ${gagal}`);

  process.exit(gagal > 0 ? 1 : 0);
}

jalankan();
