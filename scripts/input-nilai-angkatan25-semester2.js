/**
 * scripts/input-nilai-angkatan25-semester2.js
 *
 * Memasukkan nilai akhir Semester 2 (Genap 2025/2026) untuk mahasiswa
 * angkatan 2025 (NIM 253020xx) ke koleksi Firestore `grades`, sumber data
 * dari 7 Daftar Nilai Mahasiswa (DNM) dosen yang sudah direkap:
 *   K3, Aplikasi Komputer, Teknik Pengukuran, Peralatan Teknik,
 *   Menggambar Teknik, Data dan Sistem Informasi, Pendidikan Kewarganegaraan.
 *
 * CARA KERJA PENCOCOKAN MATA KULIAH (SESUAI PERMINTAAN ADMIN):
 * - TIDAK hardcode kodeMk. Script ini dulu MEMBACA seluruh koleksi
 *   `mataKuliah` semester 2 yang ada di database, lalu mencocokkan tiap
 *   target di TARGET_MATKUL_SEMESTER_2 berdasarkan NAMA (dinormalisasi:
 *   huruf kecil, tanda baca & spasi ganda dibuang, "(...)" diabaikan),
 *   BUKAN berdasarkan kode - karena kode di rekap lama admin ternyata
 *   berbeda dari kode yang dipakai di database saat ini.
 * - kodeMk & sks yang ditulis ke `grades` DIAMBIL LANGSUNG dari dokumen
 *   mataKuliah yang ketemu di database (bukan ditulis manual di sini),
 *   supaya selalu konsisten dengan data MK yang sesungguhnya berlaku.
 * - Kalau salah satu target MK tidak ketemu namanya di database, script
 *   BERHENTI di awal (sebelum menulis apa pun) dan menyebutkan nama mana
 *   yang tidak cocok - supaya tidak ada nilai yang "nyasar" ke MK yang salah.
 *
 * KEAMANAN DATA MAHASISWA (pola sama seperti
 * input-nilai-angkatan25-semester1.js):
 * - Pencocokan mahasiswa lewat NIM (exact-match ke koleksi 'users'),
 *   BUKAN lewat nama.
 * - NIM yang tidak ketemu di database DILEWATI & dicatat di ringkasan.
 * - saveGradeFinal() dipakai (upsert per userId+kodeMk+semester) - aman
 *   dijalankan berkali-kali, tidak dobel.
 * - enrollment (status 'active') dipastikan ada untuk tiap mahasiswa x MK,
 *   supaya muncul juga di halaman Rubrik dosen.
 * - DEFAULT DRY-RUN: hanya menampilkan apa yang AKAN ditulis. Tidak ada
 *   perubahan ke database sampai dijalankan ulang dengan flag --confirm.
 *
 * CATATAN KHUSUS DATA (baca sebelum --confirm):
 * - Muh Musliadi (25302004) & Rafael Zoe Pratama (25302011): TIDAK muncul
 *   sama sekali di 7 DNM sumber (beda dgn semester 1 yang masih ada nilai
 *   0/parsial). Karena itu keduanya TIDAK ADA di DATA_NILAI - tidak ada
 *   nilai semester 2 yang ditulis untuk mereka lewat script ini.
 * - Intan Rianita (25302029): nilai Menggambar Teknik `null` (tidak ada
 *   di DNM Menggambar Teknik - dia tidak tercantum di daftar itu). Item
 *   dengan nilai null OTOMATIS DILEWATI (tidak ditulis, tidak dianggap 0).
 * - Pendidikan Kewarganegaraan (PKN) diampu 2 dosen; nilai final di bawah
 *   sudah digabung: pakai nilai dosen Koordinator (Muslim Andi Yusuf),
 *   KECUALI Taufik Mubaraq (70.00) & Yosep Saleppang (68.00) yang di rekap
 *   Koordinator kosong (0.00) sehingga diambil dari rekap dosen kedua
 *   (A. Muhammad Yushan Patawari).
 *
 * PRASYARAT: MK-MK semester 2 di atas sudah ada di koleksi `mataKuliah`
 * (mis. lewat scripts/seed-matakuliah-2026.js atau input manual admin).
 * Script ini akan berhenti otomatis kalau ada nama MK yang belum ketemu.
 *
 * Cara pakai:
 *   1) Taruh file ini di folder scripts/ project middleware Anda.
 *   2) Cek dulu (aman, tidak menulis apa pun):
 *        node scripts/input-nilai-angkatan25-semester2.js
 *   3) Kalau hasil dry-run di atas sudah benar semua, baru jalankan sungguhan:
 *        node scripts/input-nilai-angkatan25-semester2.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { saveGradeFinal } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const SEMESTER = 'Genap 2025/2026'; // Semester 2 angkatan 2025
const SEMESTER_ANGKA_MK = 2;        // field `semester` di dokumen mataKuliah (angka, bukan label)

// ============================================================================
// TARGET MATA KULIAH SEMESTER 2 - dicari BERDASARKAN NAMA di database,
// bukan berdasarkan kode. `namaCari` dipakai untuk pencocokan (boleh nama
// pendek/inti); `label` cuma untuk tampilan log.
// Urutan array ini HARUS SAMA dengan urutan angka di `nilai` pada DATA_NILAI
// di bawah: [K3, Aplikasi Komputer, Teknik Pengukuran, Peralatan Teknik,
//            Menggambar Teknik, Data dan Sistem Informasi, PKN]
// ============================================================================
const TARGET_MATKUL_SEMESTER_2 = [
  { label: 'K3',                          namaCari: 'keselamatan dan kesehatan kerja' },
  { label: 'Aplikasi Komputer',           namaCari: 'aplikasi komputer' },
  { label: 'Teknik Pengukuran',           namaCari: 'teknik pengukuran' },
  { label: 'Peralatan Teknik',            namaCari: 'peralatan teknik' },
  { label: 'Menggambar Teknik',           namaCari: 'menggambar teknik' },
  { label: 'Data dan Sistem Informasi',   namaCari: 'data dan sistem informasi' },
  { label: 'Pendidikan Kewarganegaraan',  namaCari: 'pendidikan kewarganegaraan' }
];

// Data nilai per mahasiswa - direkap dari 7 DNM dosen (lihat catatan di atas
// soal Musliadi/Rafael yang tidak masuk daftar ini, Intan Rianita yang
// null di Menggambar Teknik, dan penggabungan 2 dosen PKN).
// Urutan nilai: [K3, Apkom, T.Pengukuran, Peralatan, Gamtek, DSI, PKN]
const DATA_NILAI = [
  { nim: '25302001', nama: 'Marshall Hansen Paranna', nilai: [88.25, 91.40, 88.00, 86.10, 91.43, 87.20, 89.81] },
  { nim: '25302002', nama: 'Nesa Anastasyia', nilai: [87.12, 91.08, 88.00, 86.40, 91.37, 86.28, 88.80] },
  { nim: '25302003', nama: 'Jihan Sabrina', nilai: [86.63, 85.79, 89.00, 86.96, 90.72, 86.85, 88.00] },
  { nim: '25302005', nama: 'Muh Afridzal', nilai: [87.90, 91.52, 88.00, 87.60, 91.65, 88.42, 88.80] },
  { nim: '25302006', nama: 'Muhammad Nizam Sidik', nilai: [86.95, 87.09, 90.00, 87.68, 88.02, 86.63, 88.80] },
  { nim: '25302007', nama: 'Marcel', nilai: [88.23, 86.79, 88.00, 89.20, 87.40, 93.33, 86.30] },
  { nim: '25302008', nama: 'Dwi Anggara Prasetyo', nilai: [86.75, 89.95, 89.00, 76.35, 82.18, 83.40, 87.10] },
  { nim: '25302009', nama: 'Muhammad Fahril M', nilai: [70.31, 80.05, 89.00, 70.00, 84.00, 75.00, 0.00] },
  { nim: '25302010', nama: 'Muh. Aqild Baim Pratama', nilai: [87.58, 91.20, 88.00, 87.02, 90.72, 87.47, 88.80] },
  { nim: '25302012', nama: 'Nurul Ilmi Jasman', nilai: [85.33, 85.87, 88.00, 86.04, 91.67, 87.15, 85.50] },
  { nim: '25302013', nama: 'Mey Narsi', nilai: [86.53, 87.60, 88.00, 87.18, 92.33, 87.15, 88.00] },
  { nim: '25302014', nama: 'Whulan Khesya', nilai: [86.85, 91.00, 89.00, 86.66, 89.70, 87.15, 88.00] },
  { nim: '25302015', nama: 'Gelvano Herschel Sikota', nilai: [85.10, 76.65, 89.00, 77.32, 78.00, 81.24, 85.50] },
  { nim: '25302016', nama: 'Muh Aqram Sulaeman', nilai: [86.38, 91.32, 90.00, 86.50, 81.40, 87.15, 87.10] },
  { nim: '25302017', nama: 'Hans Doalan Glorius Mowisu', nilai: [83.13, 64.70, 90.00, 68.72, 78.10, 78.67, 75.50] },
  { nim: '25302018', nama: 'Muh Al Jihad', nilai: [84.65, 85.55, 90.00, 78.58, 80.50, 80.94, 86.30] },
  { nim: '25302019', nama: 'Rahmatsalopi', nilai: [87.25, 86.59, 89.00, 86.84, 89.82, 88.78, 86.30] },
  { nim: '25302020', nama: 'Abi Al Ahkyar.K', nilai: [84.00, 85.71, 89.00, 69.65, 77.83, 79.80, 0.00] },
  { nim: '25302021', nama: 'Muh Aidit Algifari', nilai: [86.05, 91.12, 88.00, 79.46, 80.02, 82.98, 0.00] },
  { nim: '25302022', nama: "Nelson Linggi' Masakke", nilai: [88.33, 92.24, 89.00, 88.20, 92.02, 87.51, 88.00] },
  { nim: '25302023', nama: 'Muh. Zulqivly Rusli', nilai: [86.93, 89.95, 90.00, 84.74, 89.40, 86.32, 88.80] },
  { nim: '25302024', nama: 'Taufik Mubaraq', nilai: [87.64, 85.50, 88.00, 86.00, 85.60, 87.00, 70.00] },
  { nim: '25302025', nama: 'Yosep Saleppang', nilai: [86.46, 85.50, 89.00, 86.00, 85.60, 87.00, 68.00] },
  { nim: '25302026', nama: 'Muh. Saad', nilai: [74.47, 72.24, 88.00, 68.77, 76.75, 77.91, 85.50] },
  { nim: '25302027', nama: 'Assabi Kullail', nilai: [87.43, 88.14, 89.00, 86.18, 86.67, 85.16, 76.30] },
  { nim: '25302028', nama: 'Natasya Aureliya Lakinende', nilai: [77.85, 77.98, 89.00, 86.10, 76.60, 86.32, 87.80] },
  { nim: '25302029', nama: 'Intan Rianita', nilai: [89.10, 87.13, 89.00, 87.28, null, 90.02, 88.00] }
];

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/** Normalisasi nama MK supaya pencocokan tidak terganggu huruf besar/kecil,
 *  spasi ganda, atau catatan dalam kurung (mis. "(K3)"). */
function normalisasiNama(nama) {
  return String(nama || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')   // buang teks dalam kurung
    .replace(/[^a-z0-9\s]/g, ' ') // buang tanda baca
    .replace(/\s+/g, ' ')
    .trim();
}

async function cariUserIdByNim(nim) {
  const snapshot = await db.collection('users')
    .where('nim', '==', nim)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/**
 * Ambil SEMUA mataKuliah semester 2 dari database SEKALI di awal ("pelajari
 * dulu data MK di db"), lalu cocokkan tiap target di TARGET_MATKUL_SEMESTER_2
 * berdasarkan nama (bukan kode).
 */
async function pelajariMataKuliahSemester2() {
  const snapshot = await db.collection('mataKuliah')
    .where('semester', '==', SEMESTER_ANGKA_MK)
    .get();

  const daftarMk = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`📚 Ditemukan ${daftarMk.length} mata kuliah semester ${SEMESTER_ANGKA_MK} di database:`);
  daftarMk.forEach(mk => console.log(`   - [${mk.kode}] ${mk.nama} (${mk.sks} SKS)`));
  console.log('');

  const hasilMap = {}; // label target -> { id, kode, nama, sks }
  const tidakKetemu = [];

  for (const target of TARGET_MATKUL_SEMESTER_2) {
    const targetNorm = normalisasiNama(target.namaCari);
    const cocok = daftarMk.filter(mk => {
      const mkNorm = normalisasiNama(mk.nama);
      return mkNorm === targetNorm || mkNorm.includes(targetNorm) || targetNorm.includes(mkNorm);
    });

    if (cocok.length === 0) {
      tidakKetemu.push(target.label);
      console.log(`❌ Tidak ketemu MK dengan nama mirip "${target.label}" di database.`);
    } else if (cocok.length > 1) {
      // Ambiguous - jangan menebak, minta admin selesaikan manual.
      tidakKetemu.push(target.label);
      console.log(`⚠️  Nama "${target.label}" cocok dengan LEBIH DARI SATU MK di database, tidak bisa dipastikan otomatis:`);
      cocok.forEach(mk => console.log(`      - [${mk.kode}] ${mk.nama}`));
    } else {
      const mk = cocok[0];
      hasilMap[target.label] = mk;
      console.log(`✅ "${target.label}" -> [${mk.kode}] ${mk.nama} (mkId: ${mk.id})`);
    }
  }

  return { hasilMap, tidakKetemu };
}

/** Sama seperti di script semester 1: pastikan enrollment 'active' ada. */
async function pastikanEnrollment(userId, mkId, semester) {
  const existing = await db.collection('enrollment')
    .where('userId', '==', userId)
    .where('mkId', '==', mkId)
    .where('semester', '==', semester)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (!existing.empty) return 'sudah-ada';

  await db.collection('enrollment').add({
    userId,
    mkId,
    semester,
    status: 'active',
    createdAt: new Date().toISOString(),
    approvedBy: null,
    krsId: null,
    catatan: 'Dibuat otomatis dari input nilai historis (scripts/input-nilai-angkatan25-semester2.js) - tidak ada pengajuan KRS asli di balik enrollment ini.'
  });
  return 'dibuat';
}

async function jalankan() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS KE DATABASE' : '🟡 DRY-RUN - cuma simulasi, tidak menulis apa pun'}`);
  console.log(`Semester: ${SEMESTER}`);
  console.log(`Jumlah mahasiswa: ${DATA_NILAI.length}, tiap orang sampai ${TARGET_MATKUL_SEMESTER_2.length} mata kuliah\n`);

  console.log('Mempelajari data mataKuliah semester 2 di database...');
  const { hasilMap, tidakKetemu } = await pelajariMataKuliahSemester2();

  if (tidakKetemu.length > 0) {
    console.log(`\n⛔ Berhenti. ${tidakKetemu.length} mata kuliah tidak bisa dicocokkan otomatis: ${tidakKetemu.join(', ')}`);
    console.log('   Perbaiki nama MK di database atau sesuaikan `namaCari` di script ini, lalu jalankan ulang.');
    process.exit(1);
  }
  console.log('\n✅ Semua mata kuliah target berhasil dicocokkan.\n');

  const tidakKetemuMhs = [];
  let berhasilDitulis = 0;
  let gagalTulis = 0;
  let dilewatiNull = 0;
  let enrollmentDibuat = 0;
  let enrollmentSudahAda = 0;

  for (const mhs of DATA_NILAI) {
    const userId = await cariUserIdByNim(mhs.nim);
    if (!userId) {
      console.log(`❌ TIDAK KETEMU: NIM ${mhs.nim} (${mhs.nama}) - tidak ada user dengan NIM ini di database. DILEWATI.`);
      tidakKetemuMhs.push(mhs);
      continue;
    }

    console.log(`👤 ${mhs.nim} - ${mhs.nama}  (userId: ${userId})`);
    for (let i = 0; i < TARGET_MATKUL_SEMESTER_2.length; i++) {
      const target = TARGET_MATKUL_SEMESTER_2[i];
      const mk = hasilMap[target.label];
      const nilai = mhs.nilai[i];

      if (nilai === null || nilai === undefined) {
        console.log(`     [${mk.kode}] ${mk.nama}: (tidak ada nilai di DNM sumber - DILEWATI, tidak ditulis 0)`);
        dilewatiNull++;
        continue;
      }

      console.log(`     [${mk.kode}] ${mk.nama}: ${nilai}`);

      if (KONFIRMASI) {
        try {
          await saveGradeFinal({
            userId,
            kodeMk: mk.kode,
            namaMk: mk.nama,
            sks: mk.sks,
            nilai,
            semester: SEMESTER
          });
          berhasilDitulis++;

          const hasil = await pastikanEnrollment(userId, mk.id, SEMESTER);
          if (hasil === 'dibuat') enrollmentDibuat++;
          else enrollmentSudahAda++;
        } catch (err) {
          console.error(`     ⚠️  Gagal simpan ${mk.kode} untuk ${mhs.nim}:`, err.message);
          gagalTulis++;
        }
      }
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Mahasiswa ditemukan & diproses : ${DATA_NILAI.length - tidakKetemuMhs.length} / ${DATA_NILAI.length}`);
  if (tidakKetemuMhs.length > 0) {
    console.log(`\n⚠️  ${tidakKetemuMhs.length} NIM TIDAK DITEMUKAN di database (perlu dicek manual):`);
    tidakKetemuMhs.forEach(m => console.log(`   - ${m.nim}  ${m.nama}`));
  }
  console.log(`\nItem nilai kosong (null) dilewati : ${dilewatiNull}`);
  console.log('   (mis. Intan Rianita - Menggambar Teknik, tidak ada di DNM sumber)');

  console.log('\nCatatan: Muh Musliadi (25302004) & Rafael Zoe Pratama (25302011)');
  console.log('sengaja TIDAK ADA di DATA_NILAI karena tidak muncul sama sekali di 7 DNM sumber.');

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru DRY-RUN. Kalau daftar MK, mahasiswa & nilai di atas sudah benar semua,');
    console.log('   jalankan ulang dengan flag --confirm untuk benar-benar menyimpan:');
    console.log('   node scripts/input-nilai-angkatan25-semester2.js --confirm');
  } else {
    console.log(`\nNilai berhasil disimpan     : ${berhasilDitulis}`);
    console.log(`Nilai gagal disimpan        : ${gagalTulis}`);
    console.log(`Enrollment dibuat baru      : ${enrollmentDibuat}`);
    console.log(`Enrollment sudah ada (skip) : ${enrollmentSudahAda}`);
  }

  process.exit(0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
