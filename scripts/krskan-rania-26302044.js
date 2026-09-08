/**
 * scripts/krskan-rania-26302044.js
 *
 * Memastikan mahasiswa berikut ada akunnya, kelasnya benar, dan KRS
 * Semester 1-nya aktif:
 *   NIM   : 26302044
 *   Nama  : Rania
 *   Email : 26302044@polidewa.elk
 *   Kelas : ELK1B
 *
 * Kalau akunnya BELUM ADA, dibuatkan dulu (password mengikuti pola yang
 * sama seperti mahasiswa angkatan 2026 lainnya: elektronika2026).
 * Kalau SUDAH ADA, tidak dibuat dobel - cuma dipastikan kelasnya ELK1B,
 * lalu KRS Semester 1 diaktifkan/disinkronkan (aman dijalankan berkali-kali,
 * mata kuliah yang sudah aktif tidak dibuat dobel).
 *
 * Cara pakai:
 *   node scripts/krskan-rania-26302044.js
 */

const { db, auth } = require('../config/firebaseAdmin');
const { aktifkanPaketKrs, DEFAULT_AGAMA } = require('../helpers/paketKurikulumHelper');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');

const NIM = '26302044';
const NAMA = 'Rania';
const EMAIL = '26302044@polidewa.elk';
const PASSWORD = 'elektronika2026';
const KELAS = 'ELK1B';

async function main() {
  console.log('='.repeat(70));
  console.log(`PASTIKAN AKUN + KRS SEMESTER 1: ${NIM} - ${NAMA}`);
  console.log('='.repeat(70));

  const snapshot = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .where('nim', '==', NIM)
    .limit(1)
    .get();

  let userId;

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    userId = doc.id;
    const data = doc.data();
    console.log(`✓  Akun sudah ada (nama tersimpan: "${data.nama}").`);
    if (data.nama && data.nama.trim().toLowerCase() !== NAMA.toLowerCase()) {
      console.log(`   ⚠️  Nama di sistem beda dengan "${NAMA}" - dicek manual ya (tidak diubah otomatis oleh script ini).`);
    }
    await doc.ref.update({ kelas: KELAS, updatedAt: new Date().toISOString() });
    console.log(`✓  Kelas dipastikan: ${KELAS}`);
  } else {
    console.log('Akun belum ada - membuat baru...');
    let userRecord;
    try {
      userRecord = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: NAMA });
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        userRecord = await auth.getUserByEmail(EMAIL);
      } else {
        throw err;
      }
    }
    userId = userRecord.uid;

    await db.collection('users').doc(userId).set({
      nim: NIM,
      nama: NAMA,
      email: EMAIL,
      foto: null,
      fotoFileId: null,
      role: 'mahasiswa',
      semester: 'Semester 1',
      statusMagang: null,
      statusMahasiswa: 'Aktif',
      kelas: KELAS,
      konsentrasi: null,
      agama: DEFAULT_AGAMA,
      createdAt: new Date().toISOString(),
    });

    await db.collection('tagihan').doc(userId).set({
      mahasiswaId: userId,
      semester: [],
    });

    console.log(`✅ Akun baru dibuat: ${EMAIL} | password awal: ${PASSWORD}`);
  }

  console.log('\nMengaktifkan KRS Semester 1...');
  const academicLabel = getCurrentAcademicSemester().label;
  const hasil = await aktifkanPaketKrs(db, userId, 1, null, academicLabel, 'system-krskan-rania-26302044');

  if (hasil.ok) {
    console.log(`✅ ${hasil.message}`);
  } else {
    console.log(`⚠️  ${hasil.message}`);
  }

  console.log('\nSelesai.');
  process.exit(hasil.ok ? 0 : 1);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
