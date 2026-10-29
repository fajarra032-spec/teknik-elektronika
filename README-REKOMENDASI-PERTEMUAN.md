# Update: Rekomendasi Pembahasan, Alur Pertemuan, dan Pemantauan Admin (dari RPS)

Folder ini meniru struktur root proyek. Salin isinya ke root proyek (folder yang
berisi `routes/`, `views/`, `data/`), pilih "timpa/merge", lalu restart server.
Tidak ada perubahan database dan tidak ada package baru.

## Isi (12 file)

| File | Status | Fungsi |
|---|---|---|
| `data/rencanaPertemuanData.js` | BARU | Rencana 16 pertemuan tiap MK, hardcoded dari RPS |
| `routes/dosen/kurikulum.js` | diubah | Suplai rekomendasi ke Ringkasan Kurikulum dosen |
| `views/dosen/kurikulum/detail.ejs` | diubah | Kartu rekomendasi di Ringkasan + penanda di tabel |
| `routes/dosen/mk.js` | diubah | Suplai rekomendasi ke halaman Pertemuan dosen |
| `views/dosen/mk_detail.ejs` | diubah | Kartu rekomendasi + tombol "Pakai" |
| `routes/mahasiswa/elearning.js` | diubah | Suplai alur 16 pertemuan ke tampilan mahasiswa |
| `views/mahasiswa/elearning/partials/alur_pertemuan.ejs` | BARU | Garis waktu Alur Pertemuan 1-16 |
| `views/mahasiswa/elearning/mk_detail.ejs` | diubah | Memasang alur di tab Ringkasan mahasiswa |
| `views/mahasiswa/elearning/mk_pertemuan.ejs` | diubah | Menambah baris "Target" di tab Pertemuan |
| `routes/admin/pengajaran.js` | diubah | Pemantauan kelengkapan + sinkron topik dari RPS |
| `views/admin/pengajaran_list.ejs` | diubah | Penanda pemantauan, filter "Perlu perhatian", tombol sinkron |
| `views/admin/pengajaran_detail.ejs` | diubah | Rekomendasi RPS per pertemuan, status absensi, tombol isi topik |

## Tampilan dosen

- Ringkasan Kurikulum (`/dosen/kurikulum/:id`): blok "Rekomendasi Pembahasan" berisi
  pertemuan ini dan pertemuan berikutnya (topik, jenis, metode, target). Baris
  pertemuan ini di tabel disorot; tiap baris punya "Rekomendasi RPS: ...".
- Halaman Pertemuan (`/dosen/mk/:id`): kartu yang sama + tombol "Pakai" untuk mengisi
  kolom Topik (tersimpan setelah dosen menekan Simpan).

## Tampilan mahasiswa

- Tab Ringkasan (`/mahasiswa/elearning/mk/:id`): kartu "Alur Pertemuan 1-16" berbentuk
  garis waktu. Setiap pertemuan menampilkan nomor/centang, topik, jenis (teori, praktik,
  presentasi, ujian), dan tanggal bila ada. Pertemuan ini diberi tanda kuning dan,
  bersama pertemuan berikutnya, menampilkan target pembelajaran.
- Tab Pertemuan (`/mahasiswa/elearning/mk/:id/pertemuan`): kolom Topik kini otomatis
  terisi dari RPS bila dosen belum mengisi, dan ada baris "Target".

## Tampilan admin (Monitoring Pengajaran, `/admin/pengajaran`)

Modul ini sudah ada (progres, rekap semester/dosen, ekspor). Yang ditambahkan:

Daftar MK:
- Tiap MK menampilkan "Pertemuan berikutnya #N: topik RPS", chip "Topik x/16",
  "n terlambat ditandai" (sudah lewat tanggal tapi belum ditandai selesai) dan
  "n selesai tanpa absensi".
- Filter baru "Perlu perhatian" (terlambat ditandai atau selesai tanpa absensi).
- Ringkasan di atas: jumlah MK perlu perhatian, MK belum lengkap topiknya, MK tanpa dosen.
- Tombol "Isi topik dari RPS": mengisi topik kosong SEMUA MK sekaligus. Ada pratinjau
  dan konfirmasi (jumlah topik dan MK) sebelum disimpan.

Detail MK:
- Di bawah topik tiap pertemuan tampil "RPS: ..." bila topik berbeda dari RPS.
- Pertemuan selesai menampilkan status "Absensi ada/belum".
- Tombol "Isi n topik kosong dari RPS" untuk satu MK.

Aturan sinkron topik: hanya mengisi topik kosong atau berisi "Pertemuan N". Topik yang
sudah diisi, tanggal, status, catatan, dan file materi tidak diubah. MK draft
(PEK3209, PEK3210) dan MK tanpa RPS dilewati. Menjalankan ulang tidak mengubah apa pun.

Setelah topik disinkronkan, dosen dan mahasiswa melihat topik resmi dari RPS tanpa
bergantung pada rekomendasi.

## Aturan

- "Pertemuan ini" = pertemuan pertama yang belum ditandai selesai oleh dosen.
- Topik yang diisi dosen selalu menang; RPS hanya mengisi yang kosong.
- Cetak dan absensi tidak berubah (membaca `materi[].topik` seperti sebelumnya).
- MK tanpa data (mis. Praktik Dunia Kerja): kartu rekomendasi dosen tidak muncul; alur
  mahasiswa tetap tampil tanpa badge jenis.
- PEK3209 Antena dan Propagasi serta PEK3210 Keamanan Siber masih DRAFT. Dosen melihat
  tanda "Draft"; mahasiswa melihat catatan bahwa rencana topik masih sementara.

## Mengubah isi rekomendasi

Edit `data/rencanaPertemuanData.js`. Tiap baris:
`R(dariPertemuan, sampaiPertemuan, topik, targetKemampuan, metode, bobot)`.
