/**
 * scripts/input-nilai-angkatan23-legacy.js
 *
 * Input nilai akhir Semester 1-3 + PDK 1-2-3 (Praktek Kerja 1/2/3) untuk
 * mahasiswa angkatan 2023 (NIM 233020xx dst) ke koleksi Firestore `grades`,
 * sumber data dari sheet INPUT file TRANSKIP_dan_KHS_2023.xlsx.
 *
 * BEDA PENTING dari script angkatan 2024/2025 - SESUAI INSTRUKSI ADMIN:
 * Angkatan 2023 masih pakai KURIKULUM LAMA. Kode mata kuliahnya DIBIARKAN
 * PAKAI KODE LAMA (CA302, WU219, PE301, WA210, dst - lihat TARGET_SEMESTER
 * di bawah), dan kode-kode lama ini TIDAK DICARI/DICOCOKKAN ke koleksi
 * `mataKuliah` sama sekali (beda dari script 2024/2025 yang mem-VERIFIKASI
 * ke database dulu). Artinya:
 *   - TIDAK ADA pengecekan apakah kode ini ada di koleksi `mataKuliah`.
 *   - TIDAK ADA dokumen mataKuliah baru yang dibuat untuk kode-kode lama ini.
 *   - TIDAK ADA `enrollment` yang dibuat (enrollment perlu mkId yang valid
 *     merujuk ke dokumen mataKuliah asli - karena sengaja tidak dibuatkan,
 *     enrollment juga sengaja dilewati di script ini).
 *   - Nilai tetap MUNCUL di KHS/Transkrip mahasiswa karena getTranskripMahasiswa
 *     punya jalur fallback yang membaca langsung dari koleksi `grades` tanpa
 *     perlu enrollment (kodeMk/namaMk/sks disimpan langsung di tiap dokumen
 *     grade, tidak perlu join ke mataKuliah).
 *
 * CATATAN SOAL KODE MK SEMESTER PDK (4/5/6):
 * Ada 2 versi kode berbeda di file Excel sumber untuk PDK 1/2/3:
 *   - Header sheet INPUT (baris 5): WP2021 / WP2022 / WP2023 (kode ini
 *     PERSIS SAMA dengan kode "Praktik Dunia Kerja 1" milik angkatan 2024
 *     di database sekarang - kelihatannya cuma template yang kebawa dari
 *     kurikulum baru, bukan kode asli angkatan 2023).
 *   - Sheet cetak "Semester 4/5/6" (KHS resmi per mahasiswa): WA210 / WA212
 *     / WA214 - kode ini yang dipakai script ini sebagai "kode lama" yang
 *     benar, karena itu yang tercetak di KHS resmi mahasiswa.
 * KALAU TERNYATA ASUMSI INI SALAH (yang benar WP2021/22/23), ganti nilai
 * `kode` di TARGET_SEMESTER[4/5/6] di bawah sebelum menjalankan --confirm.
 *
 * STATUS "LULUS" OTOMATIS:
 * Setelah nilai ditulis, untuk tiap mahasiswa dicek: kalau PDK 1, PDK 2,
 * DAN PDK 3 semuanya sudah ada nilai angka (bukan kosong, bukan teks kayak
 * "aktif kuliah"), maka field `statusMahasiswa` di dokumen `users` mahasiswa
 * itu diupdate jadi 'Lulus' (nilai valid sesuai STATUS_MAHASISWA_OPTIONS di
 * routes/admin/mahasiswa.js: ['Aktif','Lulus','Cuti','Keluar']). Mahasiswa
 * yang PDK-nya belum lengkap TIDAK disentuh status-nya sama sekali.
 *
 * CATATAN KUALITAS DATA (mohon dibaca sebelum --confirm):
 * 1) Ahmad Gazali (23302065) - nilai PDK 3 di Excel tertulis teks
 *    "aktif kuliah" (bukan angka). DIKELUARKAN dari data (null, dilewati),
 *    dan otomatis TIDAK memenuhi syarat status Lulus karena PDK3 dianggap
 *    belum ada nilainya.
 * 2) 4 mahasiswa - Desarmon Tojaya (23302004), Rahul Jeckson Gati (23302005),
 *    Fikri Habib (23302010), Vicky Prasetio (23302012) - nilai Semester 2
 *    mereka di Excel PERSIS SAMA ANGKA-NYA dengan nilai Semester 1 mereka
 *    (7 mata kuliah, semua sama persis) - sangat mungkin salah copy-paste
 *    di Excel sumber, BUKAN nilai asli Semester 2. Nilai Semester 2 untuk
 *    4 mahasiswa ini DIKOSONGKAN (null) di script, TIDAK ditulis ke
 *    database - mohon dicek ke dosen pengampu & Excel sumber diperbaiki,
 *    baru nanti ditambahkan manual atau lewat run ulang script ini.
 * 3) 2 mahasiswa - Pikram (23302020) & Fiiqril (23302038) - semua nilainya
 *    kosong di Excel (tidak aktif/tidak ada data sama sekali). Tidak ada
 *    yang ditulis untuk mereka berdua, dan otomatis tidak memenuhi syarat
 *    Lulus.
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar menulis &
 * mengubah status mahasiswa.
 *
 * Cara pakai:
 *   1) Taruh file ini di folder scripts/ project middleware Anda.
 *   2) Dry-run dulu (aman, tidak menulis/mengubah apa pun):
 *        node scripts/input-nilai-angkatan23-legacy.js
 *   3) Baca ringkasannya (terutama 3 catatan kualitas data di atas), lalu:
 *        node scripts/input-nilai-angkatan23-legacy.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { saveGradeFinal } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');

// Label periode akademik AKTUAL saat semester itu berlangsung - angkatan
// 2023 masuk September 2023.
const SEMESTER_LABEL = {
  1: 'Ganjil 2023/2024',
  2: 'Genap 2023/2024',
  3: 'Ganjil 2024/2025',
  4: 'Genap 2024/2025',  // PDK 1
  5: 'Ganjil 2025/2026',  // PDK 2
  6: 'Genap 2025/2026'   // PDK 3
};

// ============================================================================
// MATA KULIAH PER SEMESTER - KODE LAMA DIPAKAI APA ADANYA (TIDAK dicari/
// dicocokkan ke koleksi mataKuliah di database, sesuai instruksi admin).
// Urutan tiap array HARUS SAMA dengan urutan angka `nilai` di DATA_NILAI.
// ============================================================================
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

// ============================================================================
// DATA NILAI - direkap dari sheet INPUT TRANSKIP_dan_KHS_2023.xlsx.
// Urutan `nilai` (24 angka per mahasiswa): 7 Semester1, 7 Semester2,
// 7 Semester3, lalu PDK1, PDK2, PDK3 (index 21, 22, 23).
// null = kosong di Excel (atau dikeluarkan - lihat catatan kualitas data
// di atas) - OTOMATIS DILEWATI, tidak ditulis sebagai 0.
// ============================================================================
const DATA_NILAI = [
  { nim: '23302001', nama: 'Muh. Reski Chalik', nilai: [83.8, 89.0, 89.2, 87.3, 61.0, 66.8, 59.3, 85.8, 80.3, 73.9, 79.4, 79.4, 77.0, 75.5, 86.4, 85.89, 82.25, 85.89, 88.1, 68.6, 68.72, 91.0, 89.43, 86.7] },
  { nim: '23302002', nama: 'Muh.Ibrahim Hasan', nilai: [85.0, 92.0, 86.1, 88.9, 88.0, 66.1, 88.8, 88.5, 81.1, 82.3, 84.4, 81.4, 81.8, 66.2, 86.4, 85.54, 82.25, 85.89, 89.2, 73.7, 71.75, 89.7, 86.0, null] },
  { nim: '23302008', nama: 'Juniansa', nilai: [78.3, 92.0, 86.1, 85.5, 61.0, 62.7, 80.8, 86.4, 82.1, 75.1, 82.7, 78.7, 79.7, 66.3, 58.9, 85.19, 80.5, 85.89, 88.8, 67.3, 71.55, 86.0, 90.7, null] },
  { nim: '23302011', nama: 'Anwar', nilai: [76.8, 90.0, 86.5, 75.7, 88.0, 64.3, 60.0, 86.6, 82.0, 83.0, 84.2, 80.2, 77.4, 64.0, 58.9, 84.84, 82.25, 85.89, 89.1, 67.7, 73.67, 89.1, 86.0, null] },
  { nim: '23302014', nama: 'Afdhal', nilai: [82.0, 88.0, 86.0, 89.5, 88.0, 66.0, 59.8, 89.6, 86.2, 75.4, 86.1, 83.2, 76.2, 61.3, 71.4, 85.54, 81.85, 85.89, 89.5, 79.6, 78.9, 92.0, 87.0, 93.3] },
  { nim: '23302015', nama: 'Hairullah Hairuddin', nilai: [89.5, 91.0, 86.5, 89.5, 88.0, 64.9, 59.5, 89.0, 84.3, 75.6, 86.3, 82.5, 80.0, 74.0, 86.4, 85.54, 85.35, 85.89, 89.7, 75.4, 73.05, 90.2, 89.3, 89.6] },
  { nim: '23302016', nama: 'Abdul Jaya', nilai: [77.0, 89.0, 85.3, 67.8, 88.0, 62.5, 59.3, 82.7, 81.6, 75.4, 82.3, 70.7, 70.9, 61.3, 58.9, 85.54, 82.25, 85.89, 87.7, 74.2, 71.08, 89.0, 91.7, 93.3] },
  { nim: '23302020', nama: 'Pikram', nilai: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '23302022', nama: 'Shabrina Malika Az-Zahra', nilai: [81.0, 91.0, 86.1, 89.1, 88.0, 88.7, 85.7, 86.2, 85.0, 73.4, 85.4, 81.7, 83.1, 80.4, 69.4, 85.54, 82.25, 86.59, 89.9, 79.4, 70.5, 91.0, 86.7, null] },
  { nim: '23302023', nama: 'Erina', nilai: [81.0, 92.0, 86.5, 89.3, 88.0, 83.1, 77.8, 87.3, 84.3, 75.4, 83.5, 84.55, 83.08, 80.5, 86.9, 85.54, 82.25, 85.89, 89.3, 74.2, 73.0, 91.0, 89.0, null] },
  { nim: '23302024', nama: 'Faras Nur Anjani', nilai: [82.0, 91.0, 86.5, 88.9, 88.0, 60.7, 58.8, 86.96, 83.1, 75.1, 84.2, 82.35, 80.0, 79.5, 89.2, 85.54, 83.6, 85.89, 89.3, 67.8, 66.95, 91.0, 77.5, null] },
  { nim: '23302025', nama: 'Sulmika', nilai: [71.3, 84.0, 85.7, 89.3, 87.8, 65.1, 75.0, 86.0, 80.0, 83.1, 76.8, 79.5, 77.9, 78.3, 71.4, 84.7, 80.0, 85.05, 87.6, 70.4, 69.58, 93.0, 90.28, 92.0] },
  { nim: '23302026', nama: 'Muhammad Salman', nilai: [88.0, 89.0, 86.53, 85.5, 88.0, 63.0, 58.79, 84.29, 83.0, 81.7, 84.2, 82.0, 76.1, 78.75, 89.2, 85.54, 82.25, 85.89, 89.3, 66.7, 72.3, 91.3, 86.0, null] },
  { nim: '23302028', nama: 'Afandi Jhon Malabi', nilai: [71.5, 76.0, 85.7, 77.83, 88.0, 64.42, 63.79, 84.76, 79.5, 74.4, 78.4, 67.15, 56.6, 60.0, 58.8, 85.54, 84.7, 85.89, 88.1, 67.7, 67.72, 90.0, 87.8, 88.0] },
  { nim: '23302029', nama: 'Ibnu Muarif', nilai: [97.0, 91.0, 86.53, 89.5, 88.51, 91.07, 89.99, 88.9, 86.1, 73.4, 87.2, 81.46, 81.33, 72.5, 71.4, 88.34, 86.05, 86.59, 89.1, 86.6, 81.38, 89.0, 90.0, null] },
  { nim: '23302031', nama: 'Arbaiyah', nilai: [85.3, 93.0, 86.5, 89.3, 88.0, 60.3, 83.5, 86.5, 83.1, 83.2, 83.9, 82.4, 83.5, 76.8, 89.2, 88.34, 83.6, 86.59, 88.8, 73.5, 70.95, 91.0, 90.36, 90.1] },
  { nim: '23302032', nama: 'Asriyadi', nilai: [64.25, 60.0, 85.7, 68.75, 60.19, 52.33, 56.0, 85.49, 57.3, 75.8, 63.3, 70.1, 66.6, 55.5, 43.6, 85.05, 71.0, 84.7, 83.2, 66.0, 62.0, 86.0, 86.0, null] },
  { nim: '23302034', nama: 'Nur Fadillah', nilai: [92.5, 90.0, 86.5, 89.5, 87.5, 77.7, 85.8, 86.5, 61.1, 75.1, 84.2, 83.9, 80.0, 79.5, 89.2, 85.89, 83.6, 85.54, 88.8, 74.8, 67.08, 89.0, 88.9, 94.9] },
  { nim: '23302036', nama: 'Armayanti.A', nilai: [86.8, 83.0, 86.1, 84.9, 87.5, 66.0, 58.5, 85.9, 82.0, 82.2, 83.3, 80.5, 77.4, 73.5, 64.2, 85.89, 82.25, 85.54, 89.3, 69.7, 66.92, 86.7, 86.7, null] },
  { nim: '23302038', nama: 'Fiiqril', nilai: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
  { nim: '23302148', nama: 'Rifkhu Noperdiansyah', nilai: [95.8, 90.0, 86.1, 88.9, 88.5, 93.1, 90.0, 93.1, 86.8, 77.8, 87.7, 83.8, 84.4, 69.0, 71.4, 86.59, 85.3, 86.59, 89.7, 91.2, 81.0, 91.9, 86.0, null] },
  { nim: '23302035', nama: 'Saania Maharani', nilai: [77.0, 79.0, 86.5, 87.1, 87.2, 67.1, 58.5, 29.3, 60.0, 83.4, 76.9, 79.2, 79.2, 71.0, 52.6, 85.89, 83.6, 85.54, 88.4, 68.4, 65.9, 87.0, 89.1, null] },
  { nim: '23302062', nama: 'Muh. Arif Sutanto Akbar', nilai: [85.3, 93.0, 86.5, 89.3, 88.0, 87.0, 83.5, 86.5, 83.1, 83.2, 83.9, 82.4, 83.5, 76.8, 89.2, 88.34, 83.6, 86.59, 88.8, 73.5, 70.95, 91.0, 90.36, null] },
  { nim: '23302006', nama: 'Muh.Akram', nilai: [68.7, 93.1, 86.3, 89.9, 87.5, 84.6, 89.2, 83.7, 84.7, 84.7, 89.4, 86.0, 66.9, 83.3, 88.0, 86.25, 82.25, 86.25, 89.6, 74.4, 80.6, 90.0, 88.3, null] },
  { nim: '23302007', nama: 'Muh.Gerald Rofi\'if', nilai: [66.2, 81.5, 86.3, 89.9, 87.2, 79.8, 89.4, 83.7, 83.4, 83.4, 84.5, 82.87, 78.8, 65.25, 57.1, 84.71, 85.35, 84.01, 86.8, 59.7, 68.55, 86.0, 86.0, null] },
  { nim: '23302039', nama: 'Lira', nilai: [85.0, 90.9, 89.0, 89.9, 87.5, 66.3, 90.2, 83.7, 83.6, 83.6, 90.1, 84.9, 85.7, 89.0, 86.2, 86.25, 80.0, 86.25, 89.3, 73.7, 77.0, 90.0, 90.1, 89.6] },
  { nim: '23302040', nama: 'Muh Rifky', nilai: [50.0, 91.5, 85.5, 71.0, 87.5, 33.8, 90.2, 82.0, 58.8, 58.8, 71.08, 71.1, 64.3, 71.0, 53.46, 84.85, 84.0, 85.2, 85.9, 62.8, 61.1, 86.0, 92.0, null] },
  { nim: '23302043', nama: 'Nova Samulung', nilai: [78.6, 89.2, 85.9, 77.5, 87.5, 79.9, 90.3, 83.7, 74.2, 74.2, 85.2, 85.5, 81.8, 72.3, 60.8, 85.2, 71.0, 85.2, 86.5, 60.5, 68.1, 90.29, 90.1, 89.4] },
  { nim: '23302046', nama: 'Dela', nilai: [62.1, 86.4, 85.5, 84.6, 87.49, 76.68, 90.2, 83.7, 74.1, 74.1, 81.72, 85.57, 72.8, 76.5, 60.8, 85.2, 83.6, 85.2, 88.0, 59.0, 61.1, 89.1, 86.0, null] },
  { nim: '23302047', nama: 'Saenal', nilai: [96.15, 72.9, 86.33, 89.9, 87.49, 90.88, 89.15, 83.7, 83.1, 83.1, 86.15, 84.52, 78.0, 70.0, 55.27, 86.25, 83.6, 86.25, 87.2, 64.0, 62.7, 87.0, 89.0, 90.0] },
  { nim: '23302048', nama: 'Ibra Razak', nilai: [61.55, 73.7, 86.33, 89.9, 87.49, 73.83, 89.4, 83.7, 82.1, 82.1, 79.5, 80.12, 48.8, 65.25, 57.1, 86.25, 73.8, 86.25, 87.3, 59.0, 73.05, 90.0, 87.0, null] },
  { nim: '23302146', nama: 'Srilisa', nilai: [61.6, 88.6, 86.3, 77.5, 87.2, 69.9, 89.6, 83.7, 75.8, 75.8, 78.1, 80.7, 75.3, 72.8, 72.8, 85.2, 82.25, 85.2, 86.8, 57.3, 68.6, 90.0, 89.5, 88.1] },
  { nim: '23302055', nama: 'Agung', nilai: [51.2, 60.4, 0.0, 69.0, 60.5, 53.3, 0.0, 81.2, 56.8, 56.8, 60.0, 70.6, 25.3, 72.0, 59.0, 86.25, 84.65, 86.25, 86.5, 58.0, 59.1, 86.0, 86.0, null] },
  { nim: '23302056', nama: 'Muh Sulsabilah', nilai: [59.3, 65.7, 85.9, 89.3, 87.5, 51.1, 90.5, 81.2, 60.6, 60.6, 64.5, 72.0, 59.6, 54.5, 55.27, 85.06, 80.0, 84.36, 85.7, 57.1, 66.6, 87.0, 86.0, null] },
  { nim: '23302058', nama: 'Muh Adam', nilai: [52.9, 58.2, 69.0, 69.0, 60.5, 77.2, 85.0, 92.9, 56.1, 56.1, 60.0, 39.0, 60.0, 70.0, 57.1, 85.9, 82.25, 84.85, 86.0, 56.0, 65.6, 80.0, 89.5, null] },
  { nim: '23302060', nama: 'Ridwan', nilai: [46.7, 66.8, 85.9, 64.5, 60.5, 52.4, 84.0, 88.0, 66.0, 75.4, 77.0, 77.0, 78.0, 75.0, 59.0, 85.9, 80.0, 85.2, 85.7, 65.8, 69.55, 86.0, 86.0, null] },
  { nim: '23302064', nama: 'Muhammad Faiz Al-Gifari', nilai: [88.2, 86.2, 86.3, 89.9, 87.2, 90.3, 92.0, 83.7, 85.8, 85.8, 90.07, 78.5, 81.5, 60.5, 67.8, 85.9, 80.0, 85.2, 86.8, 73.5, 75.15, 92.0, 88.8, null] },
  { nim: '23302068', nama: 'Hasim Rahman', nilai: [55.3, 51.0, 85.9, 69.0, 60.2, 74.9, 76.0, 86.0, 75.0, 83.1, 76.8, 79.5, 77.9, 78.3, 53.46, 86.25, 82.25, 86.25, 87.9, 57.0, 60.75, 86.0, 88.9, null] },
  { nim: '23302067', nama: 'Vito Aditya', nilai: [35.4, 51.0, 86.3, 69.0, 60.2, 18.17, 89.2, 85.0, 75.0, 81.7, 75.5, 77.0, 78.0, 78.75, 53.5, 85.9, 80.0, 85.2, 79.4, 29.4, 36.35, 86.0, 86.0, null] },
  { nim: '23302004', nama: 'Desarmon Tojaya', nilai: [85.0, 92.0, 86.1, 88.9, 88.0, 66.1, 88.8, 85.0, 92.0, 86.1, 88.9, 88.0, 66.1, 88.8, 86.1, 78.0, 80.0, 81.0, 79.4, 65.8, 60.0, 86.0, 86.0, null] },
  { nim: '23302005', nama: 'Rahul Jeckson Gati', nilai: [78.3, 92.0, 86.1, 85.5, 61.0, 62.7, 80.8, 78.3, 92.0, 86.1, 85.5, 61.0, 62.7, 80.8, 86.1, 78.3, 80.0, 81.9, 79.3, 73.7, 72.1, 86.0, 86.0, null] },
  { nim: '23302010', nama: 'Fikri Habib', nilai: [76.8, 90.0, 86.5, 75.7, 88.0, 64.3, 60.0, 76.8, 90.0, 86.5, 75.7, 88.0, 64.3, 60.0, 86.1, 78.4, 80.0, 81.9, 79.3, 75.0, 72.0, 86.0, 86.0, null] },
  { nim: '23302012', nama: 'Vicky Prasetio', nilai: [82.0, 88.0, 86.0, 89.5, 88.0, 66.0, 59.8, 82.0, 88.0, 86.0, 89.5, 88.0, 66.0, 59.8, 86.7, 78.4, 80.0, 81.0, 79.3, 80.0, 72.62, 86.0, 87.1, 87.0] },
  { nim: '23302033', nama: 'Muhammad Gading Riyanto R', nilai: [89.5, 91.0, 86.5, 89.5, 88.0, 64.9, 59.5, 78.6, 89.2, 85.9, 77.5, 87.5, 79.9, 90.3, 86.7, 78.0, 80.0, 81.5, 79.3, 79.6, 72.6, 87.0, 89.4, 87.6] },
  { nim: '23302065', nama: 'Ahmad Gazali', nilai: [77.0, 89.0, 85.3, 67.8, 88.0, 62.5, 59.3, 62.1, 86.4, 85.5, 84.6, 87.49, 76.68, 90.2, 86.1, 78.0, 80.0, 81.0, 79.3, 75.4, 72.35, 87.05, 86.0, null] },
  { nim: '23302066', nama: 'Fendi Kurniawan', nilai: [81.0, 91.0, 86.1, 89.1, 88.0, 88.7, 85.7, 96.15, 72.9, 86.33, 89.9, 87.49, 90.88, 89.15, 86.1, 78.0, 80.0, 81.9, 79.3, 74.2, 72.0, 87.1, 88.3, 87.0] },
  { nim: '23303001', nama: 'Maryam', nilai: [81.0, 58.9, 66.0, 56.0, 66.0, 77.1, 67.7, 61.55, 73.7, 86.33, 89.9, 87.49, 73.83, 89.4, 86.3, 78.6, 80.0, 81.9, 79.3, 79.4, 72.0, 86.0, 86.0, null] },
  { nim: '23303010', nama: 'Nelson Paledung', nilai: [82.0, 71.4, 85.54, 81.85, 85.89, 89.5, 79.6, 61.6, 88.6, 86.3, 77.5, 87.2, 69.9, 89.6, 86.3, 78.3, 80.0, 81.5, 79.3, 73.5, 72.0, 86.0, 86.0, null] },
  { nim: '23303048', nama: 'Prawira Elia Besol', nilai: [71.3, 86.4, 85.54, 85.35, 85.89, 89.7, 75.4, 51.2, 60.4, 75.0, 69.0, 60.5, 53.3, 78.0, 86.3, 78.0, 80.0, 81.5, 79.3, 75.0, 71.9, 86.0, 86.0, null] },
  { nim: '23303077', nama: 'Melkiyas B', nilai: [86.5, 75.7, 88.0, 64.3, 85.89, 87.7, 74.2, 58.9, 84.84, 82.25, 81.2, 56.8, 56.8, 60.0, 86.3, 78.6, 80.0, 81.5, 79.3, 75.0, 72.0, 86.0, 86.0, null] },
  { nim: '23303149', nama: 'Risal Mubarak', nilai: [77.0, 89.5, 88.0, 66.0, 86.59, 89.9, 79.4, 71.4, 85.54, 81.85, 81.2, 60.6, 60.6, 64.5, 86.7, 78.0, 80.0, 81.0, 79.3, 77.0, 72.5, 86.0, 86.0, null] },
  { nim: '23405018', nama: 'Tika', nilai: [76.0, 75.7, 88.0, 64.3, 85.89, 89.3, 74.2, 81.2, 56.8, 58.9, 84.84, 82.25, 81.2, 56.8, 86.1, 78.0, 80.0, 81.0, 79.3, 77.0, 72.0, 86.0, 86.0, null] },
  { nim: '23406021', nama: 'Hengki Marjono', nilai: [58.9, 84.84, 82.25, 81.2, 56.8, 79.4, 79.4, 81.2, 60.6, 71.4, 85.54, 81.85, 81.2, 60.6, 86.3, 78.6, 80.0, 81.0, 79.3, 75.0, 72.0, 86.0, 86.0, null] },
  { nim: '23406006', nama: 'Zulfikar', nilai: [71.4, 85.54, 81.85, 81.2, 60.6, 84.4, 81.4, 69.4, 85.54, 81.2, 60.6, 60.6, 64.5, 77.0, 86.1, 78.6, 80.0, 81.0, 79.3, 73.5, 72.0, 86.0, 86.0, null] },
];

// ============================================================================
// FUNGSI BANTU
// ============================================================================

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
  console.log('Angkatan: 2023 (kurikulum lama, kode MK lama dipakai apa adanya)');
  console.log(`Jumlah mahasiswa dalam data: ${DATA_NILAI.length}\n`);

  const stat = {
    berhasilDitulis: 0,
    gagalTulis: 0,
    dilewatiNull: 0,
    tidakKetemuMhs: [],
    calonLulus: [],
    sudahDitandaiLulus: []
  };

  // Urutan semester & jumlah kolom per semester (harus sinkron dengan
  // urutan nilai di DATA_NILAI: 7 + 7 + 7 + 1 + 1 + 1 = 24 kolom).
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

    // Cek kelengkapan PDK 1-2-3 (index 21, 22, 23 di array nilai) untuk
    // penentuan status Lulus.
    const [pdk1, pdk2, pdk3] = [mhs.nilai[21], mhs.nilai[22], mhs.nilai[23]];
    const lengkapPdk = pdk1 !== null && pdk1 !== undefined
      && pdk2 !== null && pdk2 !== undefined
      && pdk3 !== null && pdk3 !== undefined;

    if (lengkapPdk) {
      console.log(`     \u2705 PDK 1-2-3 lengkap (${pdk1}, ${pdk2}, ${pdk3}) -> status Lulus.`);
      stat.calonLulus.push(mhs);
      if (KONFIRMASI) {
        try {
          await tandaiLulus(userId);
          stat.sudahDitandaiLulus.push(mhs);
        } catch (err) {
          console.error(`     \u26a0\ufe0f  Gagal update status Lulus untuk ${mhs.nim}:`, err.message);
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
  console.log(`\nMahasiswa memenuhi syarat Lulus (PDK 1-2-3 lengkap): ${stat.calonLulus.length}`);
  stat.calonLulus.forEach(m => console.log(`   - ${m.nim}  ${m.nama}`));

  if (!KONFIRMASI) {
    console.log('\n\ud83d\udc49 Ini baru DRY-RUN. Baca 3 catatan kualitas data di bagian atas file ini dulu');
    console.log('   (Ahmad Gazali, 4 mahasiswa Semester2 duplikat, Pikram & Fiiqril kosong),');
    console.log('   lalu kalau semua sudah oke, jalankan ulang dengan flag --confirm:');
    console.log('   node scripts/input-nilai-angkatan23-legacy.js --confirm');
  } else {
    console.log(`\nNilai berhasil disimpan     : ${stat.berhasilDitulis}`);
    console.log(`Nilai gagal disimpan        : ${stat.gagalTulis}`);
    console.log(`Status diubah jadi Lulus    : ${stat.sudahDitandaiLulus.length}`);
  }

  process.exit(0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
