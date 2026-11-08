# Format LKM Mikrokontroler dan PLC: tiap LKM punya format sendiri

Sebelumnya semua LKM Mikrokontroler dan PLC dicetak lewat satu template yang sama
(`views/lkm_praktikum_print.ejs`): Tujuan, Alat & Bahan, tabel 8 baris generik, lalu halaman
pembahasan. Sekarang setiap modul memakai template cetak sendiri dengan isian yang sesuai
isi praktikumnya. Tidak ada dua LKM dengan susunan yang sama.

## Daftar template baru (views/)
| Modul | Template | Ciri format |
|---|---|---|
| MK LKM 1 Pengenalan perangkat keras dan IDE | lkm_mk01_print | daftar periksa, identifikasi bagian board, pengaturan IDE, variasi delay |
| MK LKM 2 I/O digital dan debouncing | lkm_mk02_print | skema + tabel pin, logika pull-up/pull-down, 8 percobaan bouncing, sketsa sinyal |
| MK LKM 3 ADC dan PWM | lkm_mk03_print | tabel kalibrasi, perhitungan contoh, grafik ADC-PWM, uji map() |
| MK LKM 4 Seven segment dan LCD (mk-06) | lkm_mk06_print | arsir segmen a-g, kotak LCD 16x2, Tabel A/B1/B2/C |
| MK LKM 5 Interrupt dan timer (mk-04) | lkm_mk04_print | alur utama vs ISR, respons polling vs interrupt, diagram waktu, galat timer |
| MK LKM 6 UART (mk-05) | lkm_mk05_print | frame 8N1, Tabel A-D, salinan layar Serial Monitor |
| MK LKM 7 Proyek akhir | lkm_mk07_print | identitas proyek, diagram blok, daftar komponen, alokasi pin, flowchart, uji fungsional, penilaian |
| PLC LKM 1 Pengenalan PLC | lkm_plc01_print | komponen trainer, peta alamat I/O, wiring, lampu indikator, uji online |
| PLC LKM 2 Instruksi dasar ladder | lkm_plc02_print | gambar ladder AND/OR/NOT, tabel kebenaran, studi kasus A.(B+C) |
| PLC LKM 3 Timer dan counter | lkm_plc03_print | galat TON, tabel counter 1-10, lampu lalu lintas, diagram waktu |
| PLC LKM 4 Sekuensial dan interlock | lkm_plc04_print | tabel urutan kerja, 3 rung, matriks skenario uji FWD/REV, daftar periksa keselamatan |
| PLC LKM 5 Sensor dan aktuator | lkm_plc05_print | spesifikasi perangkat, titik ukur tegangan, 10 uji deteksi, % keberhasilan |
| PLC LKM 6 Proyek akhir | lkm_plc06_print | urutan proses, alokasi I/O, uji bertahap, penilaian demo, refleksi |

## File lain yang berubah
| File | Perubahan |
|---|---|
| data/modulPraktikumData.js | Tambah `viewCetak` pada 7 modul mikrokontroler dan 6 modul PLC. Isi modul tidak diubah. |
| routes/dosen/mk.js | `res.render(modul.viewCetak \|\| 'lkm_praktikum_print', ...)` (1 baris) |
| routes/mahasiswa/elearning.js | Sama seperti di atas (1 baris) |
| views/partials/lkm_std_bottom.ejs | Kotak "Nilai LKM" membaca `nilaiNo` bila ada (supaya urutan MK yang digeser tetap benar). Tanpa `nilaiNo`, perilaku lama. |
| views/partials/lkm_mkplc_extra.ejs | BARU. Gaya tambahan (grid grafik, rung ladder, kotak LCD, dll). |
| views/partials/lkm_plc_rung.ejs | BARU. Kotak rung ladder kosong. |

## Hal yang perlu diperhatikan
- Sebelum perubahan ini, kedua route selalu memakai `lkm_praktikum_print` dan tidak membaca
  `viewCetak`. Dengan baris baru di route, template cetak khusus Elektronika Digital
  (`lkm_ed01-06_print`) dan Standarisasi (`lkm_std01-08_print`) yang sudah dideklarasikan di data
  ikut dipakai. Mata kuliah lain yang tidak punya `viewCetak` tetap memakai template generik.
- Penomoran LKM Mikrokontroler mengikuti urutan array (mk-06 jadi LKM 4, mk-04 jadi LKM 5,
  mk-05 jadi LKM 6), sesuai CATATAN-INTEGRASI-LKM.md.
- `id` modul tidak diubah, jadi status aktif, catatan dosen, dan pengumpulan LKM tetap terbaca.
- Isian Mikrokontroler LKM 4 dan 6 tetap memakai nama tabel yang dipakai di Langkah Kerja
  (Tabel A, B1, B2, C untuk LKM 4; Tabel A-D untuk LKM 6).
- Rollback: kembalikan 4 file lama (data, 2 route, lkm_std_bottom) dari versi sebelumnya.
