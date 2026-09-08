/**
 * scripts/input-nilai-angkatan24-semester1-4.js
 *
 * Memasukkan nilai akhir Semester 1, 2, 3, dan 4 untuk mahasiswa angkatan
 * 2024 (NIM 243020xx) ke koleksi Firestore `grades`, sumber data dari sheet
 * INPUT file TRANSKIP_dan_KHS_2024.xlsx (kolom yang SUDAH TERISI saja -
 * kolom yang masih kosong di Excel DIBIARKAN KOSONG, tidak ditulis/ditebak).
 *
 * POLA SAMA PERSIS dengan scripts/input-nilai-angkatan25-semester2.js:
 * - Mata kuliah dicocokkan BERDASARKAN NAMA ke koleksi `mataKuliah` (bukan
 *   kode - kode di Excel angkatan 2024 ini kode LAMA/beda dari kode yang
 *   dipakai database sekarang, sama seperti kasus angkatan 2025).
 * - kodeMk & sks yang ditulis ke `grades` DIAMBIL dari dokumen mataKuliah
 *   yang ketemu di database, bukan ditulis manual.
 * - Mahasiswa dicocokkan lewat NIM (exact-match ke koleksi 'users').
 * - saveGradeFinal() dipakai (upsert, aman dijalankan berkali-kali).
 * - enrollment 'active' dipastikan ada untuk tiap mahasiswa x MK.
 * - DEFAULT DRY-RUN, perlu flag --confirm untuk benar-benar menulis.
 *
 * BEDA dari script angkatan 2025 (perlu strategi tambahan):
 * 1) 4 semester sekaligus (bukan 1), masing-masing diproses independen -
 *    kalau pencocokan MK Semester 3 gagal, Semester 1/2/4 tetap lanjut
 *    diproses (tidak saling menjegal).
 * 2) "Pendidikan Agama" (Semester 1) di Excel cuma SATU kolom generik,
 *    padahal kurikulum sekarang punya 5 matkul agama terpisah (Islam,
 *    Kristen, Katolik, Hindu, Budha). TIDAK ADA cara menebak agama
 *    mahasiswa dari Excel ini - mengikuti keputusan admin yang sama di
 *    scripts/input-nilai-angkatan25-semester1.js, nilai ini SEMENTARA
 *    semua dimasukkan ke default "Pendidikan Agama Islam" (kode
 *    WUD2201), dicari via KODE bukan nama (lihat AGAMA_DEFAULT di bawah).
 *    WAJIB dikoreksi manual satu-satu lewat halaman admin (Kelola Nilai)
 *    untuk mahasiswa yang agamanya bukan Islam.
 * 3) Semester 3 di Excel ini memakai nama singkatan (DSTL, PLC,
 *    Mikrokontroller, Perawatan & Perbaikan) yang TIDAK otomatis cocok
 *    lewat substring sederhana dengan nama lengkap di database - tiap
 *    target dikasih beberapa KANDIDAT nama (kandidat pertama yang
 *    ketemu di database yang dipakai).
 * 4) "Elektronika Digital" ada di DUA jalur peminatan (Instrumentasi &
 *    Telekomunikasi) dengan nama identik tapi kode beda - berpotensi
 *    ambigu. Script ini ASUMSI angkatan 2024 di sini ambil jalur
 *    INSTRUMENTASI (cocok dengan susunan 7 matkul semester 3 di Excel:
 *    Pancasila, Perawatan&Perbaikan, DSTL, Elektronika Digital, PLC,
 *    Mikrokontroller, Rangkaian Elektronika - persis matkul pilihan
 *    Instrumentasi). Kalau asumsi ini salah, PERIKSA & UBAH nilai
 *    `PREFER_JENIS_PILIHAN` di bawah sebelum menjalankan --confirm.
 * 5) Ada 1 nilai di Excel sumber yang JELAS SALAH (di luar rentang 0-100):
 *    Aidil Jalil (24302005) - nilai K3 (Semester 2) tertulis 269 di Excel.
 *    Nilai ini DIKELUARKAN dari data (null / dilewati), TIDAK ditulis ke
 *    database. Mohon dicek & diperbaiki manual di Excel sumber juga.
 * 6) Beberapa mahasiswa (Lukman, Wirya Rusli Lutra, Andri Otniel Satoding,
 *    Rofik Gustomi Paida, Muhammad Akbar Yasir, Kisan) punya nilai
 *    Semester 2 yang identik semua (74.9/74.9/75.3/74.3/74.9/74.9/81.8) -
 *    ini SUDAH begitu di Excel sumber, kemungkinan nilai sementara/
 *    placeholder yang belum final. Tetap ditulis apa adanya (bukan
 *    kewenangan script ini mengubah data), tapi disebut di sini supaya
 *    admin sadar dan bisa cek ulang ke dosen pengampu kalau perlu.
 *
 * PRASYARAT: mataKuliah semester 1-4 (termasuk 5 matkul agama & matkul
 * pilihan Instrumentasi semester 3) sudah ada di koleksi `mataKuliah`.
 *
 * Cara pakai:
 *   1) Taruh file ini di folder scripts/ project middleware Anda.
 *   2) Dry-run dulu (aman, tidak menulis apa pun):
 *        node scripts/input-nilai-angkatan24-semester1-4.js
 *   3) Baca ringkasannya BAIK-BAIK (terutama poin 2, 4, 5 di atas), lalu
 *      kalau sudah yakin benar:
 *        node scripts/input-nilai-angkatan24-semester1-4.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { saveGradeFinal } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');

// Asumsi jalur peminatan Semester 3 (lihat catatan poin 4 di atas).
// Ganti ke 'Telekomunikasi' kalau ternyata angkatan ini ambil jalur itu.
const PREFER_JENIS_PILIHAN = 'Instrumentasi';

// Label periode akademik AKTUAL saat semester itu berlangsung (BUKAN
// periode aktif sekarang) - angkatan 2024 masuk September 2024.
const SEMESTER_LABEL = {
  1: 'Ganjil 2024/2025',
  2: 'Genap 2024/2025',
  3: 'Ganjil 2025/2026',
  4: 'Genap 2025/2026'
};

// Default sementara utk "Pendidikan Agama" (lihat catatan poin 2 di atas).
const AGAMA_DEFAULT_KODE = 'WUD2201';

// ============================================================================
// TARGET MATA KULIAH PER SEMESTER - dicari berdasarkan NAMA (kandidat
// pertama yang match dipakai), KECUALI Pendidikan Agama yang dicari lewat
// KODE tetap (lihat mode: 'kode').
// Urutan tiap array HARUS SAMA dengan urutan angka `nilai` di DATA_NILAI
// semester terkait di bawah.
// ============================================================================
const TARGET_SEMESTER = {
  1: [
    { label: 'Matematika Teknik', mode: 'nama', kandidat: ['Matematika Teknik'] },
    { label: 'Etika Kerja', mode: 'nama', kandidat: ['Etika Kerja'] },
    { label: 'Standardisasi', mode: 'nama', kandidat: ['Standardisasi'] },
    { label: 'Pendidikan Agama (default Islam - lihat catatan)', mode: 'kode', kodeTetap: AGAMA_DEFAULT_KODE },
    { label: 'Bahasa Indonesia', mode: 'nama', kandidat: ['Bahasa Indonesia'] },
    { label: 'Perangkat Lunak Aplikasi', mode: 'nama', kandidat: ['Perangkat Lunak Aplikasi'] },
    { label: 'Bahasa Inggris', mode: 'nama', kandidat: ['Bahasa Inggris'] }
  ],
  2: [
    { label: 'K3', mode: 'nama', kandidat: ['keselamatan dan kesehatan kerja'] },
    { label: 'Aplikasi Komputer', mode: 'nama', kandidat: ['Aplikasi Komputer'] },
    { label: 'Teknik Pengukuran', mode: 'nama', kandidat: ['Teknik Pengukuran'] },
    { label: 'Peralatan Teknik', mode: 'nama', kandidat: ['Peralatan Teknik'] },
    { label: 'Menggambar Teknik', mode: 'nama', kandidat: ['Menggambar Teknik'] },
    { label: 'Data dan Sistem Informasi', mode: 'nama', kandidat: ['Data dan Sistem Informasi'] },
    { label: 'Pendidikan Kewarganegaraan', mode: 'nama', kandidat: ['Pendidikan Kewarganegaraan'] }
  ],
  3: [
    { label: 'Pendidikan Pancasila', mode: 'nama', kandidat: ['Pendidikan Pancasila'] },
    { label: 'Perawatan & Perbaikan', mode: 'nama', kandidat: ['Perawatan dan Perbaikan', 'Perawatan & Perbaikan', 'Perawatan Perbaikan'] },
    { label: 'DSTL', mode: 'nama', kandidat: ['Dasar Sistem Tenaga Listrik', 'DSTL'] },
    { label: 'Elektronika Digital', mode: 'nama', kandidat: ['Elektronika Digital'], preferJenisContains: PREFER_JENIS_PILIHAN },
    { label: 'PLC', mode: 'nama', kandidat: ['Programable Logic Control', 'Programmable Logic Control', 'PLC'] },
    { label: 'Mikrokontroller', mode: 'nama', kandidat: ['Mikrokontroler', 'Mikrokontroller'] },
    { label: 'Rangkaian Elektronika', mode: 'nama', kandidat: ['Rangkaian Elektronika'] }
  ],
  4: [
    { label: 'Praktek Kerja 1', mode: 'nama', kandidat: ['Praktik Dunia Kerja 1', 'Praktek Kerja 1'] }
  ]
};

// ============================================================================
// DATA NILAI PER SEMESTER - direkap dari sheet INPUT TRANSKIP_dan_KHS_2024.xlsx
// (kolom yang masih kosong di Excel = null di sini, OTOMATIS DILEWATI, tidak
// ditulis sebagai 0). Urutan `nilai` mengikuti urutan TARGET_SEMESTER[n] di atas.
// ============================================================================
const DATA_NILAI = {
  1: [
    { nim: '24302001', nama: 'Wahidin Salim', nilai: [66.4, 83.8, 79.2, 78.9, 83.0, 60.1, 87.5] },
    { nim: '24302002', nama: 'Stanislaus Agung Paborrong', nilai: [89.2, 88.2, 80.3, 90.0, 83.0, 91.1, 89.0] },
    { nim: '24302003', nama: 'Asmunandar', nilai: [86.9, 87.65, 80.8, 85.0, 82.0, 93.7, 86.0] },
    { nim: '24302004', nama: 'Ahmad Arifin', nilai: [66.4, 87.65, 80.8, 84.0, 83.0, 78.8, 89.0] },
    { nim: '24302005', nama: 'Aidil Jalil', nilai: [85.7, 87.65, 80.8, 80.5, 83.0, 70.1, 87.5] },
    { nim: '24302006', nama: 'Aida Pita', nilai: [89.3, 94.25, 81.9, 92.3, 83.0, 92.9, 89.0] },
    { nim: '24302007', nama: 'Aan Alamsyah', nilai: [66.2, 89.3, 81.9, 90.0, 83.0, 93.5, 87.0] },
    { nim: '24302009', nama: 'Muhammad Akbar Ali', nilai: [66.4, 90.4, 81.2, 81.3, 86.0, 66.0, 89.0] },
    { nim: '24302010', nama: 'Muh Ramadhan', nilai: [66.6, 73.9, 81.7, 82.8, 83.0, 57.7, 89.0] },
    { nim: '24302011', nama: 'Andi Reski Utama', nilai: [76.9, 90.4, 80.9, 80.3, 83.0, 92.3, 89.0] },
    { nim: '24302012', nama: 'Ahmad Idul Fatri', nilai: [66.6, 88.2, 81.3, 88.0, 83.0, 68.5, 89.0] },
    { nim: '24302013', nama: 'Randi Saputra', nilai: [66.0, 90.93, 81.3, 82.0, 83.0, 78.2, 89.0] },
    { nim: '24302014', nama: 'Muh. Aswan', nilai: [73.4, 77.75, 81.3, 63.6, 83.0, 69.0, 89.0] },
    { nim: '24302015', nama: 'Muh. Amri Saharuddin', nilai: [66.4, 87.65, 80.8, 86.0, 83.0, 68.8, 89.0] },
    { nim: '24302016', nama: 'Nailla Istianna', nilai: [87.8, 95.9, 81.3, 92.1, 83.0, 92.7, 89.0] },
    { nim: '24302028', nama: 'Ian Adi Putra', nilai: [65.2, 92.05, 79.3, 74.1, 83.0, 69.5, 84.4] },
    { nim: '24302018', nama: 'Dandi S. Tandiwara', nilai: [83.9, 90.4, 80.8, 80.0, 83.0, 86.8, 89.0] },
    { nim: '24302019', nama: 'Sem Irfan Patabang', nilai: [0.0, 0.0, 10.5, 0.0, 0.0, 0.0, 0.0] },
    { nim: '24302020', nama: 'Musafira Nur Asyiarah', nilai: [87.6, 90.4, 81.7, 88.1, 83.0, 92.7, 89.0] },
    { nim: '24302021', nama: 'Lalu Muhammad Ikhsan Giwana', nilai: [87.4, 83.8, 81.9, 88.3, 83.0, 92.3, 87.5] },
    { nim: '24302022', nama: 'Musliadi', nilai: [66.4, 88.75, 81.2, 80.8, 83.0, 64.5, 87.5] },
    { nim: '24302023', nama: 'Muhammad Samsul', nilai: [83.9, 87.65, 81.2, 78.6, 83.0, 55.0, 87.5] },
    { nim: '24302024', nama: 'Ibra Pagiling', nilai: [65.6, 88.2, 63.3, 83.3, 81.0, 71.8, 87.5] },
    { nim: '24302025', nama: 'Ariyo Tangdiombo', nilai: [65.2, 92.05, 70.3, 80.0, 83.0, 51.7, 79.8] },
    { nim: '24302026', nama: 'Muh. Akmal Syawal Angkotasan', nilai: [0.0, 0.0, 0.0, 0.0, 0.0, 37.8, 0.0] },
    { nim: '24302008', nama: 'Lukman', nilai: [88.1, 88.0, 80.0, 81.0, 80.0, 79.0, 95.0] },
    { nim: '24302017', nama: 'Wirya Rusli Lutra', nilai: [75.0, 82.1, 73.4, 77.75, 81.3, 70.0, 75.0] },
    { nim: '24302027', nama: 'Andri Otniel Satoding', nilai: [86.4, 81.0, 79.2, 81.0, 83.0, 79.0, 85.0] },
    { nim: '24302029', nama: 'Rofik Gustomi Paida', nilai: [0.0, 81.2, 79.2, 78.9, 83.0, 78.0, 75.0] },
    { nim: '24302030', nama: 'Muhammad Akbar Yasir', nilai: [86.0, 82.0, 79.2, 81.0, 83.0, 79.0, 79.4] },
    { nim: '24302031', nama: 'Kisan', nilai: [85.5, 81.5, 79.2, 78.9, 83.0, 79.0, 75.0] }
  ],
  2: [
    { nim: '24302001', nama: 'Wahidin Salim', nilai: [88.9, 85.8, 84.3, 84.4, 85.8, 88.4, 91.1] },
    { nim: '24302002', nama: 'Stanislaus Agung Paborrong', nilai: [85.8, 82.1, 84.7, 84.4, 85.6, 88.4, 91.1] },
    { nim: '24302003', nama: 'Asmunandar', nilai: [88.7, 88.1, 88.0, 84.0, 84.5, 92.8, 91.4] },
    { nim: '24302004', nama: 'Ahmad Arifin', nilai: [90.2, 82.8, 84.7, 84.4, 86.0, 91.4, 91.1] },
    { nim: '24302005', nama: 'Aidil Jalil', nilai: [null, 82.8, 84.7, 84.4, 85.4, 89.4, 91.1] }, // K3 aslinya 269 (invalid) - dilewati
    { nim: '24302006', nama: 'Aida Pita', nilai: [89.0, 88.3, 86.3, 84.6, 86.2, 89.2, 91.1] },
    { nim: '24302007', nama: 'Aan Alamsyah', nilai: [86.4, 88.3, 86.5, 83.4, 85.2, 92.0, 91.1] },
    { nim: '24302009', nama: 'Muhammad Akbar Ali', nilai: [88.2, 82.8, 84.7, 84.4, 82.7, 83.0, 90.4] },
    { nim: '24302010', nama: 'Muh Ramadhan', nilai: [91.2, 83.9, 84.4, 84.4, 85.0, 89.5, 91.1] },
    { nim: '24302011', nama: 'Andi Reski Utama', nilai: [85.8, 84.6, 84.8, 84.6, 85.4, 86.9, 91.1] },
    { nim: '24302012', nama: 'Ahmad Idul Fatri', nilai: [84.1, 85.8, 84.7, 83.6, 82.3, 88.9, 91.1] },
    { nim: '24302013', nama: 'Randi Saputra', nilai: [89.0, 82.9, 84.4, 84.4, 80.0, 89.7, 91.1] },
    { nim: '24302014', nama: 'Muh. Aswan', nilai: [88.4, 82.8, 84.7, 84.4, 85.4, 87.4, 91.4] },
    { nim: '24302015', nama: 'Muh. Amri Saharuddin', nilai: [89.0, 82.8, 84.3, 84.4, 85.4, 86.4, 91.4] },
    { nim: '24302016', nama: 'Nailla Istianna', nilai: [85.8, 83.9, 86.2, 84.6, 85.8, 90.0, 91.1] },
    { nim: '24302028', nama: 'Ian Adi Putra', nilai: [89.4, 59.4, 82.6, 83.4, 82.3, 82.0, 90.4] },
    { nim: '24302018', nama: 'Dandi S. Tandiwara', nilai: [85.6, 86.4, 87.1, 84.4, 82.7, 85.9, 91.1] },
    { nim: '24302019', nama: 'Sem Irfan Patabang', nilai: [0.0, 0.0, 78.0, 65.6, 0.0, 0.0, 0.0] },
    { nim: '24302020', nama: 'Musafira Nur Asyiarah', nilai: [89.0, 88.3, 89.2, 84.6, 86.2, 91.0, 91.2] },
    { nim: '24302021', nama: 'Lalu Muhammad Ikhsan Giwana', nilai: [85.8, 86.2, 86.5, 84.4, 85.8, 84.7, 91.1] },
    { nim: '24302022', nama: 'Musliadi', nilai: [89.0, 85.8, 84.7, 84.4, 85.2, 89.7, 91.1] },
    { nim: '24302023', nama: 'Muhammad Samsul', nilai: [89.0, 87.2, 84.7, 84.4, 85.4, 88.5, 91.1] },
    { nim: '24302024', nama: 'Ibra Pagiling', nilai: [85.8, 85.4, 84.7, 84.6, 83.3, 85.5, 91.1] },
    { nim: '24302025', nama: 'Ariyo Tangdiombo', nilai: [83.6, 58.8, 84.7, 84.4, 79.0, 68.0, 91.1] },
    { nim: '24302026', nama: 'Muh. Akmal Syawal Angkotasan', nilai: [0.0, 0.0, 0.0, 84.4, 0.0, 0.0, 0.0] },
    { nim: '24302008', nama: 'Lukman', nilai: [74.9, 74.9, 75.3, 74.3, 74.9, 74.9, 81.8] },
    { nim: '24302017', nama: 'Wirya Rusli Lutra', nilai: [74.9, 74.9, 75.3, 74.3, 74.9, 74.9, 81.8] },
    { nim: '24302027', nama: 'Andri Otniel Satoding', nilai: [74.9, 74.9, 75.3, 74.3, 74.9, 74.9, 81.8] },
    { nim: '24302029', nama: 'Rofik Gustomi Paida', nilai: [74.9, 74.9, 75.3, 74.3, 74.9, 74.9, 81.8] },
    { nim: '24302030', nama: 'Muhammad Akbar Yasir', nilai: [74.9, 74.9, 75.3, 74.3, 74.9, 74.9, 81.8] },
    { nim: '24302031', nama: 'Kisan', nilai: [74.9, 74.9, 75.3, 74.3, 74.9, 74.9, 81.8] }
  ],
  3: [
    { nim: '24302001', nama: 'Wahidin Salim', nilai: [58.8, 76.1, 52.3, 91.2, 89.4, 84.0, 87.7] },
    { nim: '24302002', nama: 'Stanislaus Agung Paborrong', nilai: [86.4, 95.9, 80.9, 91.4, 85.9, 87.4, 92.1] },
    { nim: '24302003', nama: 'Asmunandar', nilai: [85.0, 97.4, 88.0, 90.9, 94.0, 92.4, 92.1] },
    { nim: '24302004', nama: 'Ahmad Arifin', nilai: [85.0, 94.2, 78.0, 84.7, 90.5, 87.7, 92.1] },
    { nim: '24302005', nama: 'Aidil Jalil', nilai: [84.9, 93.4, 80.0, 76.3, 90.4, 88.1, 92.1] },
    { nim: '24302006', nama: 'Aida Pita', nilai: [88.5, 97.0, 84.9, 89.7, 94.0, 90.1, 92.1] },
    { nim: '24302007', nama: 'Aan Alamsyah', nilai: [84.6, 96.4, 89.8, 82.3, 90.0, 90.3, 92.1] },
    { nim: '24302009', nama: 'Muhammad Akbar Ali', nilai: [85.4, 91.7, 84.3, 90.9, 91.8, 88.8, 92.1] },
    { nim: '24302010', nama: 'Muh Ramadhan', nilai: [86.2, 97.2, 84.0, 90.9, 84.4, 89.3, 92.1] },
    { nim: '24302011', nama: 'Andi Reski Utama', nilai: [86.2, 93.8, 83.7, 91.4, 84.2, 89.3, 92.1] },
    { nim: '24302012', nama: 'Ahmad Idul Fatri', nilai: [86.2, 97.8, 79.6, 84.7, 83.6, 88.0, 92.1] },
    { nim: '24302013', nama: 'Randi Saputra', nilai: [85.7, 96.4, 84.0, 86.3, 86.1, 89.8, 92.1] },
    { nim: '24302014', nama: 'Muh. Aswan', nilai: [85.4, 93.6, 84.2, 76.5, 89.9, 87.7, 92.1] },
    { nim: '24302015', nama: 'Muh. Amri Saharuddin', nilai: [86.2, 96.6, 79.4, 90.4, 90.9, 88.6, 92.1] },
    { nim: '24302016', nama: 'Nailla Istianna', nilai: [84.4, 96.4, 81.0, 91.4, 92.8, 90.0, 92.1] },
    { nim: '24302028', nama: 'Ian Adi Putra', nilai: [75.1, 95.7, 80.0, 78.8, 74.7, 58.6, 92.1] },
    { nim: '24302018', nama: 'Dandi S. Tandiwara', nilai: [75.8, 96.8, 58.3, 78.8, 93.4, 89.4, 92.1] },
    { nim: '24302019', nama: 'Sem Irfan Patabang', nilai: [null, null, null, null, null, null, null] },
    { nim: '24302020', nama: 'Musafira Nur Asyiarah', nilai: [86.3, 97.4, 87.8, 90.9, 92.9, 90.2, 92.1] },
    { nim: '24302021', nama: 'Lalu Muhammad Ikhsan Giwana', nilai: [84.9, 94.6, 86.3, 78.8, 83.7, 89.8, 92.1] },
    { nim: '24302022', nama: 'Musliadi', nilai: [86.7, 93.6, 80.0, 78.8, 91.8, 89.2, 92.1] },
    { nim: '24302023', nama: 'Muhammad Samsul', nilai: [85.2, 94.2, 84.7, 78.8, 91.5, 89.0, 92.1] },
    { nim: '24302024', nama: 'Ibra Pagiling', nilai: [86.3, 92.5, 77.0, 84.6, 82.3, 87.0, 92.1] },
    { nim: '24302025', nama: 'Ariyo Tangdiombo', nilai: [84.8, 91.9, 81.5, 74.2, 82.7, 88.0, 92.1] },
    { nim: '24302026', nama: 'Muh. Akmal Syawal Angkotasan', nilai: [null, null, null, null, null, null, null] },
    { nim: '24302008', nama: 'Lukman', nilai: [null, null, null, null, null, null, null] },
    { nim: '24302017', nama: 'Wirya Rusli Lutra', nilai: [null, null, null, null, null, null, null] },
    { nim: '24302027', nama: 'Andri Otniel Satoding', nilai: [null, null, null, null, null, null, null] },
    { nim: '24302029', nama: 'Rofik Gustomi Paida', nilai: [null, null, null, null, null, null, null] },
    { nim: '24302030', nama: 'Muhammad Akbar Yasir', nilai: [null, null, null, null, null, null, null] },
    { nim: '24302031', nama: 'Kisan', nilai: [null, null, null, null, null, null, null] }
  ],
  4: [
    { nim: '24302001', nama: 'Wahidin Salim', nilai: [null] },
    { nim: '24302002', nama: 'Stanislaus Agung Paborrong', nilai: [87.7] },
    { nim: '24302003', nama: 'Asmunandar', nilai: [null] },
    { nim: '24302004', nama: 'Ahmad Arifin', nilai: [90.0] },
    { nim: '24302005', nama: 'Aidil Jalil', nilai: [91.5] },
    { nim: '24302006', nama: 'Aida Pita', nilai: [89.1] },
    { nim: '24302007', nama: 'Aan Alamsyah', nilai: [92.1] },
    { nim: '24302009', nama: 'Muhammad Akbar Ali', nilai: [90.0] },
    { nim: '24302010', nama: 'Muh Ramadhan', nilai: [92.0] },
    { nim: '24302011', nama: 'Andi Reski Utama', nilai: [89.1] },
    { nim: '24302012', nama: 'Ahmad Idul Fatri', nilai: [null] },
    { nim: '24302013', nama: 'Randi Saputra', nilai: [91.3] },
    { nim: '24302014', nama: 'Muh. Aswan', nilai: [90.0] },
    { nim: '24302015', nama: 'Muh. Amri Saharuddin', nilai: [90.0] },
    { nim: '24302016', nama: 'Nailla Istianna', nilai: [89.1] },
    { nim: '24302028', nama: 'Ian Adi Putra', nilai: [null] },
    { nim: '24302018', nama: 'Dandi S. Tandiwara', nilai: [null] },
    { nim: '24302019', nama: 'Sem Irfan Patabang', nilai: [null] },
    { nim: '24302020', nama: 'Musafira Nur Asyiarah', nilai: [89.1] },
    { nim: '24302021', nama: 'Lalu Muhammad Ikhsan Giwana', nilai: [90.2] },
    { nim: '24302022', nama: 'Musliadi', nilai: [89.1] },
    { nim: '24302023', nama: 'Muhammad Samsul', nilai: [90.2] },
    { nim: '24302024', nama: 'Ibra Pagiling', nilai: [null] },
    { nim: '24302025', nama: 'Ariyo Tangdiombo', nilai: [null] },
    { nim: '24302026', nama: 'Muh. Akmal Syawal Angkotasan', nilai: [null] },
    { nim: '24302008', nama: 'Lukman', nilai: [null] },
    { nim: '24302017', nama: 'Wirya Rusli Lutra', nilai: [null] },
    { nim: '24302027', nama: 'Andri Otniel Satoding', nilai: [null] },
    { nim: '24302029', nama: 'Rofik Gustomi Paida', nilai: [null] },
    { nim: '24302030', nama: 'Muhammad Akbar Yasir', nilai: [null] },
    { nim: '24302031', nama: 'Kisan', nilai: [null] }
  ]
};

// ============================================================================
// FUNGSI BANTU
// ============================================================================

function normalisasiNama(nama) {
  return String(nama || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function cariUserIdByNim(nim) {
  const snapshot = await db.collection('users').where('nim', '==', nim).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].id;
}

/** Cocokkan satu target ke daftar mataKuliah semester tsb (nama ATAU kode tetap). */
function cariMkUntukTarget(target, daftarMkSemester) {
  if (target.mode === 'kode') {
    const found = daftarMkSemester.find(mk => mk.kode === target.kodeTetap);
    return found ? [found] : [];
  }
  for (const kandidat of target.kandidat) {
    const targetNorm = normalisasiNama(kandidat);
    const cocok = daftarMkSemester.filter(mk => {
      const mkNorm = normalisasiNama(mk.nama);
      return mkNorm === targetNorm || mkNorm.includes(targetNorm) || targetNorm.includes(mkNorm);
    });
    if (cocok.length > 0) {
      if (cocok.length > 1 && target.preferJenisContains) {
        const jenisNorm = normalisasiNama(target.preferJenisContains);
        const filtered = cocok.filter(mk => normalisasiNama(mk.jenis || '').includes(jenisNorm));
        if (filtered.length === 1) return filtered;
      }
      return cocok; // kandidat pertama yang ketemu dipakai (walau masih >1 -> caller anggap ambigu)
    }
  }
  return [];
}

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
    userId, mkId, semester, status: 'active',
    createdAt: new Date().toISOString(),
    approvedBy: null,
    krsId: null,
    catatan: 'Dibuat otomatis dari input nilai historis (scripts/input-nilai-angkatan24-semester1-4.js) - tidak ada pengajuan KRS asli di balik enrollment ini.'
  });
  return 'dibuat';
}

/** Proses satu semester penuh: cocokkan MK lalu tulis nilai semua mahasiswa. */
async function prosesSemester(semesterNum, statTotal) {
  const label = SEMESTER_LABEL[semesterNum];
  const targets = TARGET_SEMESTER[semesterNum];
  const dataNilai = DATA_NILAI[semesterNum];

  console.log(`\n================ SEMESTER ${semesterNum} (${label}) ================`);

  const snapshot = await db.collection('mataKuliah').where('semester', '==', semesterNum).get();
  const daftarMk = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`📚 ${daftarMk.length} mata kuliah semester ${semesterNum} ditemukan di database.`);

  const hasilMap = {};
  const tidakKetemu = [];
  for (const target of targets) {
    const cocok = cariMkUntukTarget(target, daftarMk);
    if (cocok.length === 0) {
      tidakKetemu.push(target.label);
      console.log(`❌ Tidak ketemu MK untuk "${target.label}".`);
    } else if (cocok.length > 1) {
      tidakKetemu.push(target.label);
      console.log(`⚠️  "${target.label}" ambigu, cocok ke lebih dari satu MK:`);
      cocok.forEach(mk => console.log(`      - [${mk.kode}] ${mk.nama} (jenis: ${mk.jenis || '-'})`));
    } else {
      hasilMap[target.label] = cocok[0];
      console.log(`✅ "${target.label}" -> [${cocok[0].kode}] ${cocok[0].nama}`);
    }
  }

  if (tidakKetemu.length > 0) {
    console.log(`\n⛔ Semester ${semesterNum} DILEWATI SELURUHNYA (tidak ada yang ditulis) karena ${tidakKetemu.length} MK gagal dicocokkan: ${tidakKetemu.join(', ')}`);
    console.log('   Perbaiki nama MK di database, atau sesuaikan daftar `kandidat` di script ini untuk semester ini, lalu jalankan ulang.');
    return;
  }

  const tidakKetemuMhs = [];
  for (const mhs of dataNilai) {
    const userId = await cariUserIdByNim(mhs.nim);
    if (!userId) {
      console.log(`❌ TIDAK KETEMU: NIM ${mhs.nim} (${mhs.nama}) - tidak ada user dengan NIM ini. DILEWATI.`);
      tidakKetemuMhs.push(mhs);
      continue;
    }

    console.log(`👤 ${mhs.nim} - ${mhs.nama}`);
    for (let i = 0; i < targets.length; i++) {
      const mk = hasilMap[targets[i].label];
      const nilai = mhs.nilai[i];

      if (nilai === null || nilai === undefined) {
        console.log(`     [${mk.kode}] ${mk.nama}: (kosong di Excel - DILEWATI)`);
        statTotal.dilewatiNull++;
        continue;
      }

      console.log(`     [${mk.kode}] ${mk.nama}: ${nilai}`);

      if (KONFIRMASI) {
        try {
          await saveGradeFinal({ userId, kodeMk: mk.kode, namaMk: mk.nama, sks: mk.sks, nilai, semester: label });
          statTotal.berhasilDitulis++;
          const hasil = await pastikanEnrollment(userId, mk.id, label);
          if (hasil === 'dibuat') statTotal.enrollmentDibuat++; else statTotal.enrollmentSudahAda++;
        } catch (err) {
          console.error(`     ⚠️  Gagal simpan ${mk.kode} untuk ${mhs.nim}:`, err.message);
          statTotal.gagalTulis++;
        }
      }
    }
  }

  if (tidakKetemuMhs.length > 0) {
    console.log(`\n⚠️  ${tidakKetemuMhs.length} NIM tidak ditemukan di database untuk semester ${semesterNum}:`);
    tidakKetemuMhs.forEach(m => console.log(`   - ${m.nim}  ${m.nama}`));
  }
}

async function jalankan() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS KE DATABASE' : '🟡 DRY-RUN - cuma simulasi, tidak menulis apa pun'}`);
  console.log('Angkatan: 2024 (NIM 243020xx)');
  console.log('Semester yang diproses: 1, 2, 3, 4 (masing-masing independen)');

  const statTotal = { berhasilDitulis: 0, gagalTulis: 0, dilewatiNull: 0, enrollmentDibuat: 0, enrollmentSudahAda: 0 };

  for (const semesterNum of [1, 2, 3, 4]) {
    await prosesSemester(semesterNum, statTotal);
  }

  console.log('\n\n=== RINGKASAN TOTAL (semua semester) ===');
  console.log(`Item nilai kosong (null) dilewati : ${statTotal.dilewatiNull}`);
  console.log('Catatan: Aidil Jalil (24302005) - K3 Semester 2 dikeluarkan (nilai sumber 269, invalid).');

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru DRY-RUN. Kalau semua pencocokan MK & nilai di atas sudah benar (perhatikan');
    console.log('   khusus Pendidikan Agama & Elektronika Digital di catatan atas file ini),');
    console.log('   jalankan ulang dengan flag --confirm:');
    console.log('   node scripts/input-nilai-angkatan24-semester1-4.js --confirm');
  } else {
    console.log(`Nilai berhasil disimpan     : ${statTotal.berhasilDitulis}`);
    console.log(`Nilai gagal disimpan        : ${statTotal.gagalTulis}`);
    console.log(`Enrollment dibuat baru      : ${statTotal.enrollmentDibuat}`);
    console.log(`Enrollment sudah ada (skip) : ${statTotal.enrollmentSudahAda}`);
  }

  process.exit(0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
