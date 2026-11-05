# Integrasi LKM Seven Segment + LCD 16x2 I2C dan Serial UART

Mata kuliah: Mikrokontroler (PEK3203). Tidak ada perubahan pada route, database, atau helper.

## File yang berubah (timpa file lama dengan path yang sama)
| File | Perubahan |
|---|---|
| data/modulPraktikumData.js | Modul `mk-06` diganti jadi "Seven Segment dan LCD 16x2 I2C" (pertemuan 7). Modul `mk-05` diganti jadi "Serial Input sebagai Kontrol (UART)" (pertemuan 10). Urutan array diurutkan menurut pertemuan: mk-01, 02, 03, **06**, 04, 05, 07. |
| views/partials/lkm_khusus.ejs | **BARU.** Menampilkan tabel rangkaian, program contoh, dan pemecahan masalah. |
| views/dosen/mk_modul.ejs | Menambah 1 baris include partial setelah Langkah Kerja. |
| views/dosen/mk_praktikum.ejs | Sama seperti di atas. |
| views/mahasiswa/elearning/mk_modul.ejs | Sama seperti di atas. |
| views/lkm_praktikum_print.ejs | Cetak LKM: menampilkan Tabel Referensi dan tabel Data Hasil Pengamatan khusus per modul. Modul lain tetap memakai tabel generik 8 baris. |

## Field baru pada modul (semua opsional)
- `tabelReferensi`: [{ judul, kolom[], baris[][] }]
- `program`: [{ judul, kode }]
- `pemecahanMasalah`: [{ gejala, penyebab, solusi }]
- `tabelData`: [{ judul, kolom[], lebar[] (persen), baris[][] }]. Sel '' dicetak sebagai kolom isian kosong.

Modul lama tidak punya field ini, jadi tampilannya tidak berubah.

## Hal yang perlu diperhatikan
- `id` modul (mk-05 dan mk-06) tidak diubah, jadi status aktif, tanggal, catatan dosen, dan pengumpulan LKM mahasiswa tetap terbaca.
- Nomor "Modul X dari 7" pada cetak LKM ikut bergeser karena urutan berubah (LCD jadi modul ke-4, UART modul ke-6).
- Listing program tampil di halaman web (dosen dan mahasiswa), tidak ikut dicetak, supaya LKM tulis tangan tetap ringkas.
- `mk-07` (proyek akhir) tidak diubah.
- Rollback: kembalikan 6 file di atas dari versi sebelumnya.
