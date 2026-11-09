# Format LKM mata kuliah lainnya (template berbasis blueprint)

Mata kuliah yang sebelumnya memakai template generik `lkm_praktikum_print` kini memakai
`views/lkm_blueprint_print.ejs`. Satu template, tetapi susunan isinya ditentukan per modul lewat
"blueprint" (daftar blok) sehingga tidak ada dua LKM yang formatnya sama.

## Cakupan (57 modul)
Perangkat Lunak Aplikasi (pla-01..06), Aplikasi Komputer (ak-01..06), Data dan Sistem Informasi
(dsi-01..06), Teknik Pengukuran (tp-01..06), Menggambar Teknik (mgt-01..06), Dasar Sistem Tenaga
Listrik (dstl-01..07), Peralatan Teknik (pt-01..06), K3 (k3-01..07), Perawatan dan Perbaikan (pp-01..07).

## Struktur file
| File | Isi |
|---|---|
| views/lkm_blueprint_print.ejs | Renderer blok + pemenggalan halaman otomatis (kop surat di tiap halaman, tanda tangan tidak sendirian) |
| data/lkmBlueprints.js | Gabungan blueprint semua modul |
| data/lkmBlueprints/_h.js | Fungsi pembantu penulisan blok |
| data/lkmBlueprints/{pla,ak,dsi,tp,mgt,dstl,pt,k3,pp}.js | Blueprint per mata kuliah |
| data/modulPraktikumData.js | Di akhir file: modul yang belum punya `viewCetak` otomatis diberi `viewCetak = 'lkm_blueprint_print'` dan `blueprint` |
| views/partials/lkm_mkplc_extra.ejs | Ditambah `body { line-height: 1.2 }` (Bootstrap memakai 1,5 sehingga halaman cepat meluber) |

## Jenis blok
tabel (kolom bebas, baris berlabel / terisi, kolom centang `[]`, header bertingkat), gambar (polos / petak / titik),
grid grafik, kode (listing program), ruang (baris tulis), tanya, cek (daftar periksa), form, alur (diagram kotak),
foto, rubrik (penilaian dosen), etiket (kop gambar teknik), baris, rumus, catatan, dua / tiga kolom, osc (layar
osiloskop), hal (paksa halaman baru).

## Mengubah format satu LKM
Edit blueprint modul itu di data/lkmBlueprints/<mk>.js. Contoh satu tabel:
`tb('Judul bagian', ['Kolom 1', 'Kolom 2', '[]Centang'], { n: 5 })`.
Huruf bagian (A, B, C, ...) dan pemenggalan halaman dibuat otomatis.

## Catatan penting
- Pemenggalan halaman memakai estimasi tinggi yang dikalibrasi terhadap cetak Chromium dengan Bootstrap 5.1.3.
  Bila dosen mengubah teks Tujuan atau K3 secara panjang lewat override, tinggi kepala halaman 1 bisa bergeser
  beberapa puluh piksel; blok dipindah ke halaman berikutnya bila tidak muat, jadi tidak ada konten terpotong.
- Bila halaman terakhir masih longgar, ditambahkan ruang "Catatan hasil, temuan, dan kendala".
- `id` modul tidak berubah; status aktif, catatan dosen, dan pengumpulan LKM tetap terbaca.
- Rollback: hapus blok `LKM_BLUEPRINTS` di akhir data/modulPraktikumData.js (modul kembali ke template generik).
