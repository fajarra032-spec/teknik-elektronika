/**
 * scripts/input-nilai-angkatan22-legacy.js
 *
 * Input nilai akhir Semester 1-3 + PDK 1-2-3 (Praktek Kerja 1/2/3) untuk
 * mahasiswa angkatan 22 (NIM 22302xxx) ke koleksi Firestore
 * `grades`, sumber data dari sheet INPUT file TRANSKIP_dan_KHS_22.xlsx.
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
 * CATATAN KUALITAS DATA (mohon dibaca sebelum --confirm):
 * 1) Muh. Azhar Nur (22302009) - Semester 1 terisi normal, tapi SEMUA
 *    nilai Semester 2, 3, dan PDK 1-2-3 tertulis 0.00 di Excel sumber -
 *    kemungkinan besar mahasiswa berhenti/tidak aktif setelah Semester 1,
 *    BUKAN benar-benar dapat nilai 0. Nilai 0 ini TETAP DITULIS APA ADANYA
 *    (bukan kewenangan script mengubah data sumber), TAPI dikeluarkan dari
 *    perhitungan syarat Lulus (lihat aturan PDK > 0 di bawah).
 * 2) Resi Pamuso (22302055) - Semester 3 dan PDK 1 & PDK 3 tertulis 0.00,
 *    padahal PDK 2 ada nilainya (89.25) - pola tidak lengkap yang sama,
 *    nilai 0 ditulis apa adanya tapi dikeluarkan dari syarat Lulus.
 * 3) Muh. Ridwan (22302057) - PDK 3 kosong (belum ada nilai) - satu-satunya
 *    mahasiswa angkatan ini yang datanya genuinely belum lengkap (bukan 0).
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
 *   node scripts/input-nilai-angkatan22-legacy.js
 *   node scripts/input-nilai-angkatan22-legacy.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { saveGradeFinal } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');

const SEMESTER_LABEL = {
  1: 'Ganjil 2022/2023',
  2: 'Genap 2022/2023',
  3: 'Ganjil 2023/2024',
  4: 'Genap 2023/2024',  // PDK 1
  5: 'Ganjil 2024/2025',  // PDK 2
  6: 'Genap 2024/2025'   // PDK 3
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
    { kode: 'WU223', nama: 'Pendidikan Pancasila', sks: 2 },
    { kode: 'PE301', nama: 'Elektronika Daya', sks: 3 },
    { kode: 'PE306', nama: 'Transmisi dan Distribusi', sks: 3 },
    { kode: 'PE304', nama: 'Elektronika Digital', sks: 3 },
    { kode: 'PE302', nama: 'Elektromagnetik', sks: 3 },
    { kode: 'PE305', nama: 'Mikrokontroller', sks: 3 },
    { kode: 'PE303', nama: 'Rangkaian Elektronika', sks: 3 }
  ],
  4: [{ kode: 'WA210', nama: 'Praktek Kerja 1', sks: 20 }],
  5: [{ kode: 'WA212', nama: 'Praktek Kerja 2', sks: 20 }],
  6: [{ kode: 'WA214', nama: 'Praktek Kerja 3', sks: 20 }]
};

// Urutan `nilai` (24 angka per mahasiswa): 7 Semester1, 7 Semester2,
// 7 Semester3, lalu PDK1, PDK2, PDK3 (index 21, 22, 23).
// null = kosong di Excel - OTOMATIS DILEWATI, tidak ditulis sebagai 0.
const DATA_NILAI = [
  { nim: '22302001', nama: 'Syamsul Rijal', nilai: [80.5, 56.62, 78.7, 89.0, 82.8, 82.0, 90.0, 90.0, 85.4, 88.0, 88.9, 77.0, 94.0, 81.0, 60.0, 87.4, 85.0, 87.0, 84.4, 70.0, 84.15, 89.12, 89.01, 88.52] },
  { nim: '22302002', nama: 'Irham Ilyas', nilai: [89.5, 87.0, 87.1, 86.0, 86.1, 74.0, 90.3, 78.9, 68.9, 67.0, 79.8, 42.3, 78.0, 90.0, 53.0, 84.4, 82.3, 83.7, 85.7, 59.8, 60.0, 88.25, 89.01, 88.52] },
  { nim: '22302003', nama: 'Ahmad Iswadi', nilai: [83.0, 88.33, 88.5, 91.0, 89.5, 93.0, 90.15, 78.4, 66.48, 68.0, 75.8, 35.93, 79.0, 90.3, 76.0, 51.67, 69.05, 54.5, 34.0, 46.0, 55.0, 88.54, 86.64, 90.8] },
  { nim: '22302004', nama: 'Muh. Arif Ikhlasul Amal', nilai: [90.5, 88.65, 89.1, 90.0, 90.1, 90.4, 90.0, 96.0, 83.24, 92.0, 83.17, 78.33, 96.0, 90.15, 79.8, 82.52, 89.95, 88.95, 95.2, 88.4, 88.9, 89.61, 89.25, 92.32] },
  { nim: '22302005', nama: 'Sutan', nilai: [62.6, 84.58, 84.6, 89.0, 78.6, 87.35, 89.85, 93.4, 80.82, 89.0, 84.0, 76.63, 92.0, 90.0, 79.8, 80.27, 89.7, 82.8, 95.6, 89.6, 90.28, 89.57, 90.67, 86.66] },
  { nim: '22302006', nama: 'Wahyu Farhan', nilai: [77.0, 86.0, 88.1, 88.0, 86.1, 88.22, 89.25, 89.5, 81.86, 75.0, 82.0, 74.8, 90.0, 89.85, 79.3, 80.08, 91.0, 81.25, 90.8, 85.2, 85.05, 88.24, 91.52, 92.66] },
  { nim: '22302007', nama: 'Muhaimin Jabir', nilai: [82.0, 88.17, 88.1, 86.0, 82.6, 81.37, 86.1, 83.1, 80.33, 79.0, 77.3, 73.5, 89.0, 89.25, 79.3, 78.17, 89.1, 80.8, 83.0, 70.0, 78.13, 87.8, 89.11, 91.9] },
  { nim: '22302008', nama: 'Indriani Sukisman', nilai: [76.45, 90.6, 79.83, 80.35, 83.6, 79.2, 78.0, 87.1, 79.85, 86.0, 80.8, 68.67, 89.0, 86.1, 78.0, 79.83, 90.6, 80.35, 83.6, 79.2, 76.45, 89.22, 88.98, 89.42] },
  { nim: '22302009', nama: 'Muh. Azhar Nur', nilai: [90.75, 86.65, 87.9, 91.0, 86.2, 90.03, 90.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] },
  { nim: '22302010', nama: 'Asriani', nilai: [83.0, 85.25, 88.0, 88.0, 86.1, 85.43, 90.0, 88.0, 79.3, 88.0, 84.0, 74.5, 93.0, 90.0, 79.3, 78.43, 89.35, 79.1, 91.6, 79.6, 86.17, 90.63, 89.08, 90.79] },
  { nim: '22302011', nama: 'Akmal Kamaruddin', nilai: [83.0, 89.33, 88.2, 90.0, 86.5, 87.05, 90.15, 86.5, 78.69, 76.0, 80.8, 71.33, 94.0, 90.0, 79.0, 78.02, 90.1, 79.3, 90.0, 78.8, 84.45, 87.73, 88.47, 91.38] },
  { nim: '22302012', nama: 'Erin Barira', nilai: [83.0, 90.38, 87.5, 90.0, 86.2, 90.72, 89.85, 88.0, 77.53, 86.0, 84.0, 76.17, 90.0, 90.15, 79.8, 76.67, 89.1, 77.55, 87.6, 80.8, 81.22, 88.84, 90.74, 89.67] },
  { nim: '22302013', nama: 'Maulana Syam', nilai: [81.75, 86.94, 87.5, 86.0, 86.1, 84.57, 89.25, 91.0, 82.8, 86.0, 81.75, 79.17, 96.0, 89.85, 79.3, 79.1, 91.0, 81.45, 90.4, 82.8, 88.78, 89.76, 90.03, 91.92] },
  { nim: '22302014', nama: 'Hafid', nilai: [92.0, 88.08, 85.3, 90.0, 86.1, 93.12, 89.25, 88.0, 75.15, 82.0, 80.6, 74.8, 89.0, 89.25, 79.3, 76.75, 89.35, 78.9, 87.6, 71.6, 81.33, 87.37, 89.08, 91.0] },
  { nim: '22302015', nama: 'Nurhaliza', nilai: [77.0, 85.27, 86.5, 90.0, 86.1, 84.58, 89.25, 93.5, 76.67, 89.0, 82.97, 76.3, 96.0, 89.25, 79.5, 78.33, 90.1, 80.35, 92.8, 85.6, 87.02, 88.43, 88.36, 89.76] },
  { nim: '22302016', nama: 'Diwon Girik Allo', nilai: [92.0, 87.85, 87.9, 88.0, 88.0, 77.38, 88.12, 86.5, 80.59, 82.0, 78.93, 70.13, 86.0, 89.25, 76.0, 58.5, 89.55, 82.3, 89.6, 77.6, 80.0, 88.58, 90.11, 90.0] },
  { nim: '22302017', nama: 'Jumiati', nilai: [94.7, 89.38, 85.8, 90.0, 86.2, 93.27, 90.0, 87.0, 82.08, 88.0, 82.13, 76.0, 92.0, 88.12, 79.8, 81.17, 89.35, 79.6, 87.6, 78.0, 80.83, 89.1, 89.36, 89.4] },
  { nim: '22302018', nama: 'Annisa Diah Farny', nilai: [87.75, 90.58, 85.9, 89.0, 86.2, 88.68, 89.85, 89.5, 76.75, 87.0, 84.17, 78.0, 93.0, 90.0, 82.8, 79.77, 89.75, 84.75, 93.6, 81.6, 86.08, 88.56, 89.7, 88.09] },
  { nim: '22302019', nama: 'Devi Permata Sari', nilai: [83.0, 86.38, 85.4, 87.0, 86.2, 82.58, 90.0, 89.5, 76.88, 87.0, 80.17, 76.0, 94.0, 89.85, 76.0, 78.93, 90.6, 78.6, 91.6, 81.2, 82.32, 88.8, 89.32, 89.83] },
  { nim: '22302020', nama: 'Syamsul Bahri', nilai: [89.5, 83.0, 81.7, 90.0, 80.8, 84.5, 89.25, 83.9, 81.58, 88.0, 81.03, 68.47, 90.0, 90.0, 79.5, 80.17, 89.1, 82.6, 88.8, 70.8, 85.43, 87.68, 89.35, 87.68] },
  { nim: '22302021', nama: 'Salvator Olgi Endo', nilai: [84.75, 86.88, 87.9, 86.0, 87.7, 90.7, 89.25, 80.6, 75.3, 66.0, 76.43, 42.13, 87.0, 89.25, 76.0, 78.97, 70.15, 72.75, 84.0, 63.2, 67.33, 87.64, 86.42, 89.55] },
  { nim: '22302022', nama: 'Asa Yunus Rufina', nilai: [84.5, 85.0, 87.1, 91.0, 86.5, 88.13, 87.38, 87.0, 80.0, 86.0, 82.83, 77.83, 94.0, 89.25, 79.3, 77.08, 90.5, 84.55, 88.4, 86.0, 86.95, 88.4, 88.72, 90.2] },
  { nim: '22302023', nama: 'Priska Iriany Karoma\'', nilai: [79.25, 92.7, 87.4, 88.0, 91.6, 89.7, 89.25, 84.9, 81.06, 86.0, 82.33, 76.0, 90.0, 87.38, 78.0, 80.9, 90.3, 80.55, 88.4, 80.0, 83.6, 88.97, 89.49, 90.2] },
  { nim: '22302054', nama: 'Rachmad Alfiandy', nilai: [83.0, 84.88, 85.8, 91.0, 86.2, 85.8, 89.25, 95.0, 79.05, 86.0, 84.37, 49.6, 95.0, 89.25, 81.0, 76.87, 89.55, 80.55, 91.2, 86.0, 86.15, 86.71, 89.01, 90.44] },
  { nim: '22302055', nama: 'Resi Pamuso', nilai: [78.25, 89.25, 86.8, 86.0, 81.5, 71.72, 88.12, 51.4, 54.19, 20.0, 77.17, 45.63, 34.0, 89.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 89.25, 0.0] },
  { nim: '22302056', nama: 'Muh. Raiyhan Hadi Pratama', nilai: [76.0, 69.58, 85.2, 78.0, 89.0, 89.0, 90.15, 88.0, 88.0, 88.0, 88.0, 5.33, 78.0, 78.0, 79.8, 32.75, 88.85, 32.5, 47.2, 59.2, 72.29, 89.43, 89.63, 89.21] },
  { nim: '22302053', nama: 'Erlinda Dahlia', nilai: [75.92, 89.1, 77.78, 78.05, 86.4, 87.0, 79.3, 75.9, 17.42, 76.3, 61.63, 49.5, 73.0, 88.12, 79.3, 77.78, 89.1, 78.05, 86.4, 75.6, 75.92, 86.7, 89.27, 89.25] },
  { nim: '22302057', nama: 'Muh. Ridwan', nilai: [69.63, 89.35, 77.53, 77.55, 88.8, 78.0, 78.0, 80.6, 74.7, 78.0, 42.5, 44.8, 86.0, 90.15, 78.0, 77.53, 89.35, 77.55, 88.8, 63.6, 69.63, 88.6, 89.82, null] },
];

async function cariUserIdByNim(nim) {
  const snapshot = await db.collection('users').where('nim', '==', nim).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

async function tandaiLulus(userId) {
  await db.collection('users').doc(userId).update({ statusMahasiswa: 'Lulus' });
}

async function tandaiKeluar(userId) {
  await db.collection('users').doc(userId).update({ statusMahasiswa: 'Keluar' });
}

/**
 * Hitung berapa BLOK semester yang kosong dari 6 blok yang ada:
 * Semester 1, Semester 2, Semester 3, PDK 1, PDK 2, PDK 3.
 * Satu blok dianggap KOSONG kalau semua nilainya null (tidak diisi)
 * ATAU semua nilainya 0 (terbukti dari data sumber berarti "belum/tidak
 * aktif", bukan nilai asli - lihat catatan kualitas data di atas file ini).
 */
function hitungBlokKosong(nilai) {
  const blocks = [
    nilai.slice(0, 7),
    nilai.slice(7, 14),
    nilai.slice(14, 21),
    [nilai[21]],
    [nilai[22]],
    [nilai[23]]
  ];
  return blocks.filter(block => {
    const terisi = block.filter(v => v !== null && v !== undefined);
    if (terisi.length === 0) return true;
    return terisi.every(v => v === 0);
  }).length;
}

async function jalankan() {
  console.log(`Mode: ${KONFIRMASI ? '\ud83d\udd34 KONFIRMASI - AKAN MENULIS KE DATABASE & MENGUBAH STATUS MAHASISWA' : '\ud83d\udfe1 DRY-RUN - cuma simulasi, tidak menulis/mengubah apa pun'}`);
  console.log('Angkatan: 22 (kurikulum lama, kode MK lama dipakai apa adanya)');
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
    console.log('   node scripts/input-nilai-angkatan22-legacy.js --confirm');
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
