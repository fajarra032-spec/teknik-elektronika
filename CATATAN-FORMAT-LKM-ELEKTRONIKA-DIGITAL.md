# LKM Elektronika Digital: pemeriksaan format dan perapian halaman

Hasil pemeriksaan: keenam LKM Elektronika Digital (lkm_ed01 sampai lkm_ed06) sudah berformat
berbeda satu sama lain (isian dan susunannya khusus per modul), jadi tidak ada yang perlu
dibuatkan format baru. Yang diperbaiki adalah pemakaiannya dan tata letak cetaknya.

## Yang berubah
| File | Perubahan |
|---|---|
| routes/dosen/mk.js, routes/mahasiswa/elearning.js | Membaca `viewCetak` (dari paket Mikrokontroler dan PLC). Sebelumnya `viewCetak` ED sudah ada di data, tetapi route selalu memakai template generik. |
| views/lkm_ed01-06_print.ejs | Menyertakan `partials/lkm_mkplc_extra` (jarak lebih rapat). 5 dari 6 LKM sebelumnya punya halaman terakhir yang hanya berisi blok tanda tangan. |
| lkm_ed01, 02, 06 | Tinggi sebagian kotak isian dikurangi agar muat pada jumlah halaman yang dirancang. |
| lkm_ed03, 05 | Bagian Analisis dipindahkan sengaja ke halaman 3 (dengan baris jawaban lebih banyak). ED-05 diberi judul "F. Analisis" untuk satu pertanyaan akhirnya. Baris tabel dirapatkan. |
| lkm_ed04 | Hanya jarak yang dirapatkan. Kini 2 halaman. |

## Jumlah halaman cetak sekarang
ED-01: 2, ED-02: 3, ED-03: 3, ED-04: 2, ED-05: 3, ED-06: 3.

## Catatan
- Isi modul di data (tujuan, langkah kerja, dsb.) tidak diubah.
- Baris tabel pada ED-03 dan ED-05 dibuat lebih rapat (sekitar 4-5 mm) supaya muat. Bila dosen
  ingin baris lebih lega, hapus blok `<style>` kecil di bagian `<head>` kedua file itu (halaman
  bertambah).
- Rollback: kembalikan lkm_ed01-06_print.ejs dari versi sebelumnya.
