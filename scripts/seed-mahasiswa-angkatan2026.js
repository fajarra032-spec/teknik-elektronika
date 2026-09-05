/**
 * scripts/seed-mahasiswa-angkatan2026.js
 *
 * Menambahkan 43 mahasiswa baru angkatan 2026 (Semester 1, status Aktif):
 * - Membuat akun login di Firebase Auth (email + password)
 * - Membuat dokumen profil di koleksi Firestore `users`
 * - Membuat dokumen kosong di koleksi `tagihan`
 * - (opsional, lihat AKTIFKAN_PAKET_KRS_OTOMATIS) langsung mengaktifkan
 *   paket KRS Semester 1 lewat helpers/paketKurikulumHelper.js, SAMA
 *   PERSIS seperti yang terjadi otomatis kalau admin ubah status/semester
 *   mahasiswa lewat form edit di /admin/mahasiswa.
 *
 * AGAMA: tiap mahasiswa di daftar `mahasiswaBaru` di bawah bisa punya field
 * `agama` opsional ('Islam'/'Kristen'/'Katolik'/'Hindu'/'Budha' - lihat
 * AGAMA_OPTIONS di helpers/paketKurikulumHelper.js). Kalau tidak diisi,
 * DEFAULT ke Islam. Ini cuma nilai AWAL - admin bisa mengubahnya kapan saja
 * lewat form edit mahasiswa di /admin/mahasiswa, dan field ini menentukan
 * mata kuliah "Pendidikan Agama" (WUD2201-5) mana yang otomatis dikaitkan
 * saat paket KRS Semester 1 diaktifkan (lihat aktifkanPaketKrs()).
 *
 * AMAN DIJALANKAN BERKALI-KALI: sebelum membuat, script ini selalu cek
 * dulu apakah NIM sudah ada di Firestore - kalau sudah ada, dilewati
 * (skip), TIDAK ditimpa dan TIDAK dibuat dobel. Jadi kalau baru sebagian
 * yang berhasil (mis. koneksi putus di tengah, atau kuota Auth habis),
 * tinggal jalankan ulang dari awal, aman.
 *
 * PENTING SEBELUM MENJALANKAN:
 * 1. Cek/ubah konfigurasi EMAIL_DOMAIN dan PASSWORD_AWAL di bawah sesuai
 *    kebutuhan kampus.
 * 2. Semua mahasiswa baru di batch ini akan pakai password awal yang SAMA
 *    (lihat PASSWORD_AWAL) - sampaikan ke mahasiswa untuk login lalu
 *    ganti password masing-masing.
 *
 * Cara pakai (dari root project, di server yang punya akses Firebase):
 *   node scripts/seed-mahasiswa-angkatan2026.js
 */

const { db, auth } = require('../config/firebaseAdmin');
const { aktifkanPaketKrs, DEFAULT_AGAMA } = require('../helpers/paketKurikulumHelper');
const { getCurrentAcademicSemester } = require('../helpers/academicHelper');

// ============================================================================
// KONFIGURASI - SESUAIKAN DULU SEBELUM MENJALANKAN SCRIPT INI
// ============================================================================

// Domain email yang dipakai untuk akun mahasiswa baru: <nim>@<EMAIL_DOMAIN>
const EMAIL_DOMAIN = 'polidewa.elk';

// Semester & status awal untuk mahasiswa baru angkatan 2026
const SEMESTER_AWAL = 'Semester 1';
const STATUS_MAHASISWA_AWAL = 'Aktif';

// Kalau true: begitu akun dibuat, paket KRS Semester 1 langsung diaktifkan
// otomatis (sama seperti yang terjadi kalau admin edit status mahasiswa
// jadi "Aktif" di Semester 1 lewat form biasa). Set false kalau mau isi
// KRS-nya manual belakangan lewat menu "Buat KRS".
const AKTIFKAN_PAKET_KRS_OTOMATIS = true;

// Password awal SAMA untuk semua mahasiswa baru di batch ini. Sampaikan
// ke mahasiswa untuk login lalu ganti password.
const PASSWORD_AWAL = 'elektronika2026';
function buatPassword(nim) {
  return PASSWORD_AWAL;
}

// ============================================================================
// DATA 43 MAHASISWA BARU ANGKATAN 2026
// ============================================================================
const mahasiswaBaru = [
  { nim: '26302001', nama: 'Alfira' },
  { nim: '26302002', nama: 'Muhammad Reham' },
  { nim: '26302003', nama: 'Elmi' },
  { nim: '26302004', nama: 'Akbar Harun' },
  { nim: '26302005', nama: 'Suriansyah' },
  { nim: '26302006', nama: 'Ahmad Syafiq Sholehan' },
  { nim: '26302007', nama: 'M. Ezzar Syahfiril' },
  { nim: '26302008', nama: 'Rayzha Putri Hikma' },
  { nim: '26302009', nama: 'Baso Kahar' },
  { nim: '26302010', nama: 'Pramudia Ananta Tribahari' },
  { nim: '26302011', nama: 'Harmawan' },
  { nim: '26302012', nama: 'Fajar Hariyanto' },
  { nim: '26302013', nama: 'Rahmaniar' },
  { nim: '26302014', nama: 'Fachri Huzain Ilyas' },
  { nim: '26302015', nama: 'Dwi Ariyanto Jatmiko' },
  { nim: '26302016', nama: 'Muh Asmin' },
  { nim: '26302017', nama: 'Sulkarnain' },
  { nim: '26302018', nama: 'Anisa Daniel Tudang' },
  { nim: '26302019', nama: 'Salfiah Sakinah' },
  { nim: '26302020', nama: 'Andre Kondolele' },
  { nim: '26302021', nama: 'Febrianty Anton' },
  { nim: '26302022', nama: 'Triversa' },
  { nim: '26302023', nama: 'Jumadil Alisman' },
  { nim: '26302024', nama: 'Aidil Jaya' },
  { nim: '26302025', nama: 'Riyani' },
  { nim: '26302026', nama: 'Andi Alifya Annisa S' },
  { nim: '26302027', nama: 'Davin Putra Emmanuel' },
  { nim: '26302028', nama: 'Indira Ramadani' },
  { nim: '26302029', nama: 'Ahmad Muflih' },
  { nim: '26302030', nama: 'Muh. Farrel' },
  { nim: '26302031', nama: 'Ainun Muhammad' },
  { nim: '26302032', nama: 'Muh. Jeyhan Jufri' },
  { nim: '26302033', nama: 'Deden Hardin' },
  { nim: '26302034', nama: 'Muh. Mufli Wahid M. Akil' },
  { nim: '26302035', nama: 'Ghifson Jasthin Ravael' },
  { nim: '26302036', nama: 'Rehan' },
  { nim: '26302037', nama: 'Herianto Parante' },
  { nim: '26302038', nama: 'Evan Dores' },
  { nim: '26302039', nama: 'Laurensya Parammangan' },
  { nim: '26302040', nama: 'Syariah Irawan' },
  { nim: '26302041', nama: 'Alga' },
  { nim: '26302042', nama: 'Muh. Ishak' },
  { nim: '26302043', nama: 'Rhapid Wahidan' },
];

// ============================================================================
// PROSES
// ============================================================================
async function seed() {
  console.log(`Memulai penambahan ${mahasiswaBaru.length} mahasiswa angkatan 2026...\n`);

  let dibuat = 0;
  let dilewati = 0;
  let gagal = 0;
  const detailGagal = [];

  for (const m of mahasiswaBaru) {
    const nim = m.nim.trim();
    const nama = m.nama.trim();

    try {
      // Cek dulu apakah NIM sudah terdaftar - kalau sudah, lewati (aman
      // dijalankan berkali-kali / lanjut dari yang gagal sebelumnya).
      const existing = await db.collection('users').where('nim', '==', nim).limit(1).get();
      if (!existing.empty) {
        console.log(`⏭  Lewati ${nim} - ${nama} (NIM sudah terdaftar)`);
        dilewati++;
        continue;
      }

      const email = `${nim}@${EMAIL_DOMAIN}`;
      const password = buatPassword(nim);

      // Buat akun login. Kalau email ternyata sudah dipakai (mis. sisa
      // percobaan sebelumnya yang gagal di tengah jalan), pakai akun yang
      // sudah ada itu supaya tidak berhenti karena error.
      let userRecord;
      try {
        userRecord = await auth.createUser({ email, password, displayName: nama });
      } catch (authError) {
        if (authError.code === 'auth/email-already-exists') {
          userRecord = await auth.getUserByEmail(email);
        } else {
          throw authError;
        }
      }

      await db.collection('users').doc(userRecord.uid).set({
        nim,
        nama,
        email,
        foto: null,
        fotoFileId: null,
        role: 'mahasiswa',
        semester: SEMESTER_AWAL,
        statusMagang: null,
        statusMahasiswa: STATUS_MAHASISWA_AWAL,
        kelas: null,
        konsentrasi: null,
        // Agama: pakai yang diisi di data mahasiswaBaru (m.agama) kalau ada,
        // kalau tidak default ke Islam. Admin bisa ubah belakangan.
        agama: m.agama || DEFAULT_AGAMA,
        createdAt: new Date().toISOString(),
      });

      await db.collection('tagihan').doc(userRecord.uid).set({
        mahasiswaId: userRecord.uid,
        semester: [],
      });

      let infoKrs = '';
      if (AKTIFKAN_PAKET_KRS_OTOMATIS) {
        try {
          const hasilKrs = await aktifkanPaketKrs(
            db, userRecord.uid, 1, null,
            getCurrentAcademicSemester().label, 'system-seed-angkatan2026'
          );
          infoKrs = `  | KRS: ${hasilKrs.message}`;
        } catch (krsError) {
          infoKrs = `  | KRS GAGAL: ${krsError.message}`;
        }
      }

      console.log(`✅ ${nim} - ${nama} (email: ${email}, password: ${password})${infoKrs}`);
      dibuat++;
    } catch (error) {
      console.error(`❌ Gagal ${nim} - ${nama}: ${error.message}`);
      gagal++;
      detailGagal.push(`${nim} - ${nama}: ${error.message}`);
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Berhasil dibuat : ${dibuat}`);
  console.log(`Dilewati (sudah ada) : ${dilewati}`);
  console.log(`Gagal : ${gagal}`);
  if (detailGagal.length > 0) {
    console.log('\nDetail yang gagal (jalankan ulang script untuk mencoba lagi):');
    detailGagal.forEach(d => console.log(' - ' + d));
  }

  process.exit(gagal > 0 ? 1 : 0);
}

seed();
