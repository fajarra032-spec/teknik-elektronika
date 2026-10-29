# Update: Rekomendasi Pembahasan dan Alur Pertemuan (dari RPS)

Folder ini meniru struktur root proyek. Salin isinya ke root proyek (folder yang
berisi `routes/`, `views/`, `data/`), pilih "timpa/merge", lalu restart server.
Tidak ada perubahan database dan tidak ada package baru.

## Isi (9 file)

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
