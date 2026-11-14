# Modul SOP Prodi - cara pasang

Zip ini sudah berisi semua file dengan struktur folder yang sama dengan proyek Anda, termasuk 3 file yang sudah diedit (menu dan route sudah terpasang).

## Opsi A - timpa langsung (paling cepat)
Syarat: app.js, views/partials/header.ejs, dan views/partials/header-landing.ejs di server Anda masih sama dengan yang ada di routes.zip yang Anda kirim.
1. Ekstrak zip ini ke folder proyek dan setuju menimpa 3 file tersebut.
2. Restart aplikasi.

## Opsi B - aman bila 3 file itu sudah Anda ubah sendiri
1. Ekstrak zip ke folder proyek, tetapi JANGAN menimpa app.js, header.ejs, header-landing.ejs.
2. Jalankan: node scripts/pasang-menu-sop.js  (menambah 2 baris di app.js dan 2 tautan menu; membuat cadangan .bak; aman diulang)
3. Restart aplikasi.

## Hasilnya
- Menu admin: Layanan > Buku Induk SOP (halaman /admin/sop)
- Menu publik: Layanan > Dokumen > Semua SOP Prodi (halaman /sop)
- Unduh Word: /sop/SOP-TE-021/docx dan /sop/SOP-TE-023/docx

## File baru
data/sop/*, helpers/sopDocx.js, routes/sop.js, routes/admin/sop.js, views/sop/*, views/admin/sop/index.ejs, scripts/pasang-menu-sop.js

## Data Firestore
Koleksi baru sop_status (otomatis dibuat saat admin menekan Simpan). Tidak perlu index baru.

## Menambah SOP baru
Salin data/sop/detail/sop-te-021.js menjadi sop-te-0XX.js, ubah kode (harus ada di master.js) dan isinya, restart.

## Perlu diputuskan sebelum disahkan
Lihat bagian konfirmasi di tiap file detail (juga tampil bagi admin di halaman SOP). Terpenting: bobot nilai akhir magang (sistem 50:50 dua komponen vs halaman pedoman 3 komponen).

## Pembaruan 14 November 2026
SOP baru: SOP-TE-002 (KRS) dan SOP-TE-012 (Penyelesaian Studi). Bila modul sudah terpasang, cukup salin folder data/sop (master.js dan detail/*.js) lalu restart; tidak ada file lain yang berubah.

## Pembaruan 14 November 2026 (2)
SOP baru: SOP-TE-029 (Persuratan Mahasiswa) dan SOP-TE-033 (Penugasan Mengajar dan Penerbitan SK; akses internal dosen/admin). Bila modul sudah terpasang, cukup salin folder data/sop lalu restart.

## Pembaruan 14 November 2026 (3)
SOP baru: SOP-TE-016 (Peminjaman dan Pengembalian Alat Laboratorium) dan SOP-TE-046 (Koreksi dan Perubahan Data Akademik; akses internal dosen/admin). Bila modul sudah terpasang, cukup salin folder data/sop lalu restart.
