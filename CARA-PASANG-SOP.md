# Modul SOP Prodi - cara pasang

## Isi paket
| File | Fungsi |
|---|---|
| `data/sop/master.js` | Buku Induk 47 SOP (nomor, judul, penanggung jawab, prioritas, akses publik/internal) |
| `data/sop/detail/sop-te-021.js` | Isi SOP Magang Dalam Negeri |
| `data/sop/detail/sop-te-023.js` | Isi SOP Penilaian, Laporan, Seminar Magang |
| `data/sop/index.js` | Penggabung master + isi |
| `helpers/sopDocx.js` | Pembuat file Word (.docx) memakai package `docx` yang sudah ada |
| `routes/sop.js` | `/sop`, `/sop/:kode`, `/sop/:kode/docx`, `/sop/magang` |
| `routes/admin/sop.js` | `/admin/sop` (status, versi, tanggal berlaku), `/admin/sop/export.xlsx` |
| `views/sop/index.ejs`, `views/sop/detail.ejs`, `views/admin/sop/index.ejs` | Tampilan |
| `scripts/pasang-menu-sop.js` | Memasang route ke `app.js` dan menu ke header (aman diulang, membuat `.bak`) |

## Langkah
1. Salin semua folder di paket ini ke folder proyek (struktur sama; tidak ada file yang tertimpa).
2. Dari folder proyek jalankan: `node scripts/pasang-menu-sop.js`
   Skrip menambah 2 baris di `app.js` dan 1 tautan di `header-landing.ejs` (menu Layanan) dan `header.ejs` (menu admin). Bila ada baris yang gagal, skrip menyebutkan; pasang manual:
   - `app.js`, setelah `app.use('/dokumen', ...)`: `app.use('/sop', require('./routes/sop'));`
   - `app.js`, sebelum `const adminRoutes = ...`: `app.use('/admin/sop', require('./routes/admin/sop'));`
3. Restart aplikasi. Tidak perlu paket baru dan tidak perlu index Firestore.
4. Buka `/sop` (publik) dan `/admin/sop` (admin).

## Data di Firestore
Koleksi baru `sop_status`, dokumen per nomor SOP (mis. `SOP-TE-021`): `status`, `versi`, `tanggalBerlaku`, `catatan`, `updatedAt`, `updatedBy`. Dibuat otomatis saat admin menekan Simpan. Isi SOP tetap di file kode.

## Menambah SOP baru
1. Salin `data/sop/detail/sop-te-021.js` menjadi `sop-te-0XX.js`, ubah `kode` (harus ada di `master.js`) dan isinya.
2. Restart aplikasi. SOP otomatis muncul di `/sop`, dapat diunduh .docx, dan statusnya berubah ke "Draf disusun" di `/admin/sop`.
3. SOP berakses `internal` (mis. backup, koreksi data, audit) hanya tampil untuk dosen/admin yang login.

## Yang perlu diputuskan sebelum disahkan
Lihat bagian `konfirmasi` di tiap file detail; daftar itu juga tampil untuk admin di bawah halaman SOP. Yang paling penting: bobot nilai akhir magang (sistem 50:50 dua komponen vs halaman pedoman 3 komponen).
