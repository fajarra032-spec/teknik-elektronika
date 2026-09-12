/**
 * scripts/input-nilai-angkatan21-legacy.js
 *
 * Input nilai akhir Semester 1-3 + PDK 1-2-3 (Praktek Kerja 1/2/3) untuk
 * mahasiswa angkatan 21 (NIM 21302xxx) ke koleksi Firestore
 * `grades`, sumber data dari sheet INPUT file TRANSKIP_dan_KHS_21.xlsx.
 *
 * POLA SAMA PERSIS dengan scripts/input-nilai-angkatan23-legacy.js:
 * - Kode MK kurikulum LAMA dipakai APA ADANYA (kode diambil dari sheet
 *   cetak "Semester N" per mahasiswa - itu yang dipakai di KHS resmi -
 *   BUKAN dari header sheet INPUT yang kadang berisi kode berbeda/keliru).
 * - TIDAK dicocokkan/dicari ke koleksi `mataKuliah` di database sama
 *   sekali - tidak ada dokumen MK baru yang dibuat, tidak ada `enrollment`
 *   yang dibuat (sesuai keputusan admin utk angkatan 2023 kemarin, dipakai
 *   lagi di sini). Nilai tetap muncul di KHS/Transkrip mahasiswa karena
 *   getTranskripMahasiswa punya jalur fallback yang baca langsung dari
 *   `grades` tanpa perlu enrollment.
 *
 * CATATAN KUALITAS DATA PENTING (mohon dibaca sebelum --confirm):
 * 1) TEMUAN SERIUS - 19 dari 21 mahasiswa (semua KECUALI Adimas Pangestu
 *    21302007 dan Muh. Rifqi Ariansyah 21302021) punya nilai Semester 2
 *    di Excel sumber PERSIS SAMA ANGKA-NYA dengan nilai Semester 1 mereka
 *    (7 mata kuliah, semua sama persis) - hampir pasti kesalahan copy-paste
 *    kolom Semester 1 ke Semester 2 di Excel sumber untuk (hampir) SATU
 *    ANGKATAN PENUH, bukan nilai Semester 2 yang asli. Nilai Semester 2
 *    untuk 19 mahasiswa ini DIKOSONGKAN (null) di script, TIDAK ditulis -
 *    SANGAT DISARANKAN dicek ke bagian akademik/dosen pengampu dan Excel
 *    sumber diperbaiki dulu, baru nilai Semester 2 angkatan ini diinput
 *    (bisa lewat run ulang script ini setelah datanya diperbaiki).
 * 2) Beberapa mahasiswa (21302001, 21302013 s/d 21302020) datanya berhenti
 *    di Semester 1/2 saja (Semester 3 & PDK kosong semua) - kemungkinan
 *    tidak melanjutkan studi. Tidak ada yang ditulis untuk semester yang
 *    kosong, dan otomatis tidak memenuhi syarat Lulus.
 *
 * STATUS "LULUS" OTOMATIS:
 * Setelah nilai ditulis, dicek: kalau PDK 1, PDK 2, DAN PDK 3 semuanya
 * ADA nilainya DAN semuanya LEBIH BESAR DARI 0 (bukan cuma "tidak kosong"
 * - nilai 0 di data sumber terbukti berarti "belum/tidak aktif", BUKAN
 * nilai asli - lihat catatan di atas), maka `statusMahasiswa` di dokumen
 * `users` mahasiswa itu diupdate jadi 'Lulus'. Mahasiswa yang belum
 * memenuhi ini TIDAK disentuh status-nya sama sekali.
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar menulis &
 * mengubah status mahasiswa.
 *
 * Cara pakai:
 *   node scripts/input-nilai-angkatan21-legacy.js
 *   node scripts/input-nilai-angkatan21-legacy.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { saveGradeFinal } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');

const SEMESTER_LABEL = {
  1: 'Ganjil 2021/2022',
  2: 'Genap 2021/2022',
  3: 'Ganjil 2022/2023',
  4: 'Genap 2022/2023',  // PDK 1
  5: 'Ganjil 2023/2024',  // PDK 2
  6: 'Genap 2023/2024'   // PDK 3
};

const TARGET_SEMESTER = {
  1: [
    { kode: 'CA302', nama: 'Matematika Teknik', sks: 3 },
    { kode: 'CA305', nama: 'Etika Kerja', sks: 3 },
    { kode: 'CA308', nama: 'Standardisasi', sks: 3 },
    { kode: 'CA311', nama: 'Pendidikan Agama', sks: 3 },
    { kode: 'WU207', nama: 'Bahasa Indonesia', sks: 2 },
    { kode: 'WU226', nama: 'Perangkat Lunak Aplikasi', sks: 3 },
    { kode: 'WU229', nama: 'Bahasa Inggris', sks: 3 }
  ],
  2: [
    { kode: 'WU219', nama: 'Keselamatan dan Kesehatan Kerja', sks: 3 },
    { kode: 'CA313', nama: 'Aplikasi Komputer', sks: 3 },
    { kode: 'CA316', nama: 'Teknik Pengukuran', sks: 3 },
    { kode: 'CA319', nama: 'Peralatan Teknik', sks: 3 },
    { kode: 'CA322', nama: 'Menggambar Teknik', sks: 3 },
    { kode: 'CA325', nama: 'Data dan Sistem Informasi', sks: 3 },
    { kode: 'CA328', nama: 'Pendidikan Kewarganegaraan', sks: 2 }
  ],
  3: [
    { kode: 'WU222', nama: 'Pendidikan Pancasila', sks: 2 },
    { kode: 'PMM301', nama: 'Elektronika Daya', sks: 3 },
    { kode: 'PMM302', nama: 'Transmisi dan Distribusi', sks: 3 },
    { kode: 'PMM303', nama: 'Elektronika Digital', sks: 3 },
    { kode: 'PMM304', nama: 'Elektromagnetik', sks: 3 },
    { kode: 'PMM305', nama: 'Mikrokontroller', sks: 3 },
    { kode: 'PMM306', nama: 'Rangkaian Elektronika', sks: 3 }
  ],
  4: [{ kode: 'WA210', nama: 'Praktek Kerja 1', sks: 20 }],
  5: [{ kode: 'WA212', nama: 'Praktek Kerja 2', sks: 20 }],
  6: [{ kode: 'WA214', nama: 'Praktek Kerja 3', sks: 20 }]
};

// Urutan `nilai` (24 angka per mahasiswa): 7 Semester1, 7 Semester2,
// 7 Semester3, lalu PDK1, PDK2, PDK3 (index 21, 22, 23).
// null = kosong di Excel - OTOMATIS DILEWATI, tidak ditulis sebagai 0.
const DATA_NILAI = [
  { nim: '21302001', nama: 'Serliadi', nilai: [12.75, 2.31, 14.96, 0.0, 0.0, 0.0, 0.0, null, null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, null] },
  { nim: '21302002', nama: 'Asri Dian Perdana T', nilai: [66.75, 91.75, 76.58, 88.75, 78.5, 78.3, 85.0, null, null, null, null, null, null, null, 85.0, 85.0, 83.0, 82.25, 85.0, 55.0, 60.0, 86.1, 85.2, 89.0] },
  { nim: '21302003', nama: 'Yudi Ahmar', nilai: [86.93, 83.5, 73.84, 87.9, 84.7, 73.24, 86.0, null, null, null, null, null, null, null, 89.84, 84.0, 84.0, 87.4, 80.0, 59.0, 60.0, 87.0, 87.0, 87.78] },
  { nim: '21302004', nama: 'Hendra', nilai: [64.75, 91.75, 73.58, 88.09, 86.6, 86.0, 90.0, null, null, null, null, null, null, null, 90.0, 86.0, 87.0, 82.25, 84.3, 59.0, 64.0, 91.7, 86.0, 89.31] },
  { nim: '21302005', nama: 'Wilfani Tosampe', nilai: [63.75, 89.08, 66.37, 89.9, 87.5, 81.9, 80.0, null, null, null, null, null, null, null, 87.0, 85.0, 87.0, 80.5, 91.3, 59.0, 62.0, 86.4, 86.5, 92.58] },
  { nim: '21302006', nama: 'Saipul', nilai: [65.75, 89.25, 64.53, 84.59, 86.2, 81.1, 85.0, null, null, null, null, null, null, null, 90.0, 60.0, 85.0, 80.5, 83.4, 59.0, 60.0, 86.2, 86.2, 91.17] },
  { nim: '21302007', nama: 'Adimas Pangestu', nilai: [27.0, 70.0, 35.1, 73.0, 40.0, 70.0, 72.0, 27.0, 72.0, 35.1, 70.0, 40.0, 72.0, 70.0, 72.0, 70.0, 70.0, 73.0, 70.0, 70.0, 72.0, 87.0, 88.0, 88.0] },
  { nim: '21302008', nama: 'Ifan', nilai: [68.0, 90.12, 62.02, 86.7, 86.6, 83.0, 80.0, null, null, null, null, null, null, null, 88.0, 88.0, 88.0, 80.5, 89.3, 58.0, 65.0, 87.6, 90.85, 89.0] },
  { nim: '21302009', nama: 'Sanjaya', nilai: [60.75, 89.25, 59.15, 83.73, 87.4, 79.6, 75.0, null, null, null, null, null, null, null, 88.0, 85.0, 83.0, 80.5, 56.4, 58.0, 60.0, 85.4, 87.51, 89.0] },
  { nim: '21302010', nama: 'Rifaldhy Saputra', nilai: [86.0, 91.75, 72.55, 89.8, 86.2, 88.5, 85.0, null, null, null, null, null, null, null, 91.0, 88.0, 90.0, 80.5, 91.5, 59.0, 66.0, 87.0, 86.7, 91.52] },
  { nim: '21302011', nama: 'Suwandi Supu', nilai: [86.3, 84.19, 78.78, 90.9, 88.5, 89.47, 88.0, null, null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null] },
  { nim: '21302012', nama: 'Randi Dwi Putra', nilai: [62.5, 86.75, 45.33, 80.63, 86.0, 77.1, 75.0, null, null, null, null, null, null, null, 86.0, 60.0, 86.0, 80.5, 80.6, 59.0, 60.0, 86.3, 87.54, 89.0] },
  { nim: '21302013', nama: 'Wanda Meylani Putri', nilai: [86.25, 82.5, 65.45, 83.12, 91.8, 75.97, 84.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302014', nama: 'Muh Arqha', nilai: [0.0, 2.0, 5.67, 0.0, 0.0, 13.58, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302015', nama: 'Muh. Arafat Rifaldy Muslimin', nilai: [50.5, 66.2, 47.67, 64.47, 83.83, 70.67, 85.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302016', nama: 'Serlina', nilai: [86.25, 83.5, 66.1, 90.0, 87.15, 73.6, 85.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302017', nama: 'Harmiati', nilai: [85.75, 85.4, 72.45, 84.62, 91.1, 78.4, 85.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302018', nama: 'Yatno Mangnga', nilai: [25.0, 0.0, 0.0, 0.0, 0.0, 0.0, 40.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302019', nama: 'Rifky Alamsyah', nilai: [57.25, 62.15, 58.43, 79.83, 72.94, 71.22, 84.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302020', nama: 'Widya Anggraeni', nilai: [82.75, 79.25, 66.6, 67.58, 88.05, 77.43, 84.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '21302021', nama: 'Muh. Rifqi Ariansyah', nilai: [57.25, 62.2, 58.43, 79.83, 72.95, 71.0, 84.0, 88.0, 89.0, 77.0, 79.0, 89.0, 89.0, 80.0, 86.0, 60.0, 86.0, 80.5, 86.0, 59.0, 64.0, 86.0, 89.75, 89.0] },
];

async function cariUserIdByNim(nim) {
  const snapshot = await db.collection('users').where('nim', '==', nim).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

async function tandaiLulus(userId) {
  await db.collection('users').doc(userId).update({ statusMahasiswa: 'Lulus' });
}

async function jalankan() {
  console.log(`Mode: ${KONFIRMASI ? '\ud83d\udd34 KONFIRMASI - AKAN MENULIS KE DATABASE & MENGUBAH STATUS MAHASISWA' : '\ud83d\udfe1 DRY-RUN - cuma simulasi, tidak menulis/mengubah apa pun'}`);
  console.log('Angkatan: 21 (kurikulum lama, kode MK lama dipakai apa adanya)');
  console.log(`Jumlah mahasiswa dalam data: ${DATA_NILAI.length}\n`);

  const stat = {
    berhasilDitulis: 0,
    gagalTulis: 0,
    dilewatiNull: 0,
    tidakKetemuMhs: [],
    calonLulus: [],
    sudahDitandaiLulus: [],
    calonKeluar: [],
    sudahDitandaiKeluar: []
  };

  const urutanSemester = [1, 2, 3, 4, 5, 6];

  for (const mhs of DATA_NILAI) {
    const userId = await cariUserIdByNim(mhs.nim);
    if (!userId) {
      console.log(`\u274c TIDAK KETEMU: NIM ${mhs.nim} (${mhs.nama}) - tidak ada user dengan NIM ini. DILEWATI SELURUHNYA.`);
      stat.tidakKetemuMhs.push(mhs);
      continue;
    }

    console.log(`\ud83d\udc64 ${mhs.nim} - ${mhs.nama}`);

    let idx = 0;
    for (const semesterNum of urutanSemester) {
      const targets = TARGET_SEMESTER[semesterNum];
      const label = SEMESTER_LABEL[semesterNum];

      for (const target of targets) {
        const nilai = mhs.nilai[idx];
        idx++;

        if (nilai === null || nilai === undefined) {
          console.log(`     [S${semesterNum}] [${target.kode}] ${target.nama}: (kosong - DILEWATI)`);
          stat.dilewatiNull++;
          continue;
        }

        console.log(`     [S${semesterNum}] [${target.kode}] ${target.nama}: ${nilai}`);

        if (KONFIRMASI) {
          try {
            await saveGradeFinal({
              userId,
              kodeMk: target.kode,
              namaMk: target.nama,
              sks: target.sks,
              nilai,
              semester: label
            });
            stat.berhasilDitulis++;
          } catch (err) {
            console.error(`     \u26a0\ufe0f  Gagal simpan ${target.kode} untuk ${mhs.nim}:`, err.message);
            stat.gagalTulis++;
          }
        }
      }
    }

    // Cek kelengkapan PDK 1-2-3 (index 21, 22, 23) - HARUS ada nilainya
    // DAN lebih besar dari 0 (0 terbukti berarti belum/tidak aktif).
    const [pdk1, pdk2, pdk3] = [mhs.nilai[21], mhs.nilai[22], mhs.nilai[23]];
    const lengkapPdk = pdk1 !== null && pdk1 !== undefined && pdk1 > 0
      && pdk2 !== null && pdk2 !== undefined && pdk2 > 0
      && pdk3 !== null && pdk3 !== undefined && pdk3 > 0;

    if (lengkapPdk) {
      console.log(`     \u2705 PDK 1-2-3 lengkap & valid (${pdk1}, ${pdk2}, ${pdk3}) -> status Lulus.`);
      stat.calonLulus.push(mhs);
      if (KONFIRMASI) {
        try {
          await tandaiLulus(userId);
          stat.sudahDitandaiLulus.push(mhs);
        } catch (err) {
          console.error(`     \u26a0\ufe0f  Gagal update status Lulus untuk ${mhs.nim}:`, err.message);
        }
      }
    } else {
      // Bukan kandidat Lulus - cek apakah layak ditandai Keluar (2+ blok
      // semester kosong dari 6 blok yang ada).
      const jumlahKosong = hitungBlokKosong(mhs.nilai);
      if (jumlahKosong >= 2) {
        console.log(`     \u26a0\ufe0f  ${jumlahKosong} dari 6 blok semester kosong -> status Keluar.`);
        stat.calonKeluar.push(mhs);
        if (KONFIRMASI) {
          try {
            await tandaiKeluar(userId);
            stat.sudahDitandaiKeluar.push(mhs);
          } catch (err) {
            console.error(`     \u26a0\ufe0f  Gagal update status Keluar untuk ${mhs.nim}:`, err.message);
          }
        }
      }
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Mahasiswa diproses          : ${DATA_NILAI.length - stat.tidakKetemuMhs.length} / ${DATA_NILAI.length}`);
  if (stat.tidakKetemuMhs.length > 0) {
    console.log(`\n\u26a0\ufe0f  ${stat.tidakKetemuMhs.length} NIM tidak ditemukan di database:`);
    stat.tidakKetemuMhs.forEach(m => console.log(`   - ${m.nim}  ${m.nama}`));
  }
  console.log(`\nItem nilai kosong dilewati  : ${stat.dilewatiNull}`);
  console.log(`\nMahasiswa memenuhi syarat Lulus (PDK 1-2-3 lengkap & > 0): ${stat.calonLulus.length}`);
  stat.calonLulus.forEach(m => console.log(`   - ${m.nim}  ${m.nama}`));
  console.log(`\nMahasiswa memenuhi syarat Keluar (>=2 blok semester kosong): ${stat.calonKeluar.length}`);
  stat.calonKeluar.forEach(m => console.log(`   - ${m.nim}  ${m.nama}`));

  if (!KONFIRMASI) {
    console.log('\n\ud83d\udc49 Ini baru DRY-RUN. Baca catatan kualitas data di bagian atas file ini dulu,');
    console.log('   lalu kalau semua sudah oke, jalankan ulang dengan flag --confirm:');
    console.log('   node scripts/input-nilai-angkatan21-legacy.js --confirm');
  } else {
    console.log(`\nNilai berhasil disimpan     : ${stat.berhasilDitulis}`);
    console.log(`Nilai gagal disimpan        : ${stat.gagalTulis}`);
    console.log(`Status diubah jadi Lulus    : ${stat.sudahDitandaiLulus.length}`);
    console.log(`Status diubah jadi Keluar   : ${stat.sudahDitandaiKeluar.length}`);
  }

  process.exit(0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
