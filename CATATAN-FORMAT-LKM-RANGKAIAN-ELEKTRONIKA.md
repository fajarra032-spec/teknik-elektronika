# Format LKM Rangkaian Elektronika: tiap LKM punya format sendiri

Mata kuliah: Rangkaian Elektronika (PEK3204). Sama seperti Mikrokontroler dan PLC
(lihat CATATAN-FORMAT-LKM-MIKROKONTROLER-PLC.md), setiap modul sekarang memakai template cetak
sendiri lewat field `viewCetak`, bukan template generik `lkm_praktikum_print`.

## Template baru (views/)
| Modul | Template | Ciri format |
|---|---|---|
| re-01 Komponen dasar | lkm_re01_print | tabel kode warna resistor, kapasitor/induktor, uji kondisi komponen (open/short) |
| re-02 Penyearah dioda | lkm_re02_print | dua skema, 4 kotak layar osiloskop, tabel Vdc/riak, perbandingan dengan teori |
| re-03 Catu daya + regulator | lkm_re03_print | diagram blok bertitik ukur, tabel regulasi beban, grafik Vout-IL, fungsi pengaman |
| re-04 Transistor saklar dan penguat | lkm_re04_print | tabel cutoff/saturasi, titik kerja DC, tabel gain + osiloskop dua kanal |
| re-05 Op-amp | lkm_re05_print | perancangan resistor, tabel inverting/non-inverting, tabel komparator, grafik transfer |
| re-06 Proyek akhir | lkm_re06_print | tabel spesifikasi target vs hasil ukur, uji per blok, uji variasi kondisi, penilaian |

## File pendukung
- views/partials/lkm_re_extra.ejs (BARU): gaya kotak layar osiloskop, tabel kode warna, diagram blok.
- views/partials/lkm_osc.ejs (BARU): kotak layar osiloskop kosong (parameter `judul`, `baris`).
- data/modulPraktikumData.js: tambah `viewCetak` pada re-01 sampai re-06 (isi modul tidak diubah).
- Template ini juga memakai views/partials/lkm_mkplc_extra.ejs dan lkm_std_bottom.ejs dari paket sebelumnya.
- Route (routes/dosen/mk.js, routes/mahasiswa/elearning.js) harus sudah membaca `viewCetak`
  (perubahan dari paket Mikrokontroler dan PLC). Paket ini menyertakannya lagi agar berdiri sendiri.

## Catatan
- `id` modul tidak diubah, jadi status aktif, catatan dosen, dan pengumpulan LKM tetap terbaca.
- Rollback: hapus baris `viewCetak` re-01 sampai re-06 pada data.
