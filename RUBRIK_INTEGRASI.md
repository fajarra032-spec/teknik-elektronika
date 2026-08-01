# Integrasi Fitur "Rubrik Penilaian" ke Web Prodi

File-file di dalam zip ini adalah **tambahan/perubahan** untuk project Anda
(Node.js + Express + EJS + Firebase Firestore). Cara pakainya: salin/timpa
file-file ini ke lokasi yang sama persis di project Anda (bukan project baru).

## 0. Update kali ini (revisi)

1. **Tidak ada perubahan navbar/menu.** Sesuai permintaan, link Rubrik Penilaian
   ditaruh sebagai **pintasan/shortcut di dashboard**, bukan di menu navigasi:
   - `views/dosen/dashboard.ejs` → kartu pintasan baru "Rubrik Penilaian" di
     section "Pengajaran & Pengabdian", tepat setelah kartu "Input Nilai".
   - `views/admin/dashboard.ejs` → kartu menu baru "Rubrik Penilaian" tepat
     setelah kartu "Input Nilai".
   File asli lain tidak disentuh (cari saja baris `<a href="/admin/nilai"...`
   dan `<a href="/dosen/nilai"...` di file Anda kalau mau pasang manual).

2. **Perbaikan batas semester (`helpers/academicHelper.js`).** Sebelumnya
   Genap = Februari–Juli, Ganjil = Agustus–Desember. Sekarang direvisi jadi:
   - **Genap: Februari s/d akhir Agustus**
   - **Ganjil: mulai September s/d Desember** (Januari tetap dihitung Ganjil
     tahun sebelumnya, tidak berubah)

   Efeknya: karena sekarang masih bulan Agustus, sistem otomatis kembali
   menghitung periode aktif sebagai **"Genap 2025/2026"** (bukan "Ganjil
   2026/2027" seperti sebelumnya) — jadi nilai tugas semester lalu yang
   "hilang" kemarin akan **otomatis muncul kembali** begitu file ini
   diganti, tanpa perlu migrasi data apapun (datanya memang tidak pernah
   terhapus, hanya tidak ke-query karena label periode-nya berbeda).

   Sudah saya tes manual (simulasi tanggal 1–31 tiap bulan tahun 2026):
   bulan 2–8 → Genap 2025/2026, bulan 9–12 → Ganjil 2026/2027, bulan 1 →
   Ganjil 2025/2026.

3. **Perbaikan nilai tugas yang "tidak terbaca" di Rekap Nilai & Rubrik.**
   Ditemukan akar masalahnya: halaman **Daftar Tugas** (`/dosen/tugas/:id`)
   membaca nilai tugas hanya lewat `mkId + tipe` (tanpa filter periode),
   sedangkan halaman **Rekap Nilai** (`/dosen/nilai`) dan **Rubrik** (buatan
   saya) sama-sama memakai `getNilaiByMkId(mkId, periode)` yang tadinya
   **ikut menyaring nilai tugas lewat field `periode` di dokumen `nilai`**.
   Kalau nilai sebuah tugas kebetulan tersimpan saat label periode aktif
   sempat berbeda dari periode tugas induknya (persis seperti yang terjadi
   akibat batas bulan semester kemarin), nilai itu jadi "hilang" di Rekap
   Nilai maupun Rubrik — padahal tetap tampil normal di Daftar Tugas.

   **Perbaikan** (di `helpers/nilaiHelper.js`):
   - `getNilaiByMkId()` sekarang **tidak lagi menyaring nilai TUGAS lewat
     field periode-nya sendiri** — cakupan periode untuk tugas ditentukan
     lewat `tugasId`-nya (yang sudah pasti benar lewat `getTugasByMkId`).
     Filter periode ketat tetap berlaku untuk komponen lain (UTS, UAS,
     Kehadiran, Sikap, Keaktifan, Kuis) karena itu tidak attached ke
     dokumen tugas manapun.
   - `getRataTugasByMkId()` (dipakai rubrik) diperbaiki dengan logika serupa.
   - `saveNilai(...)` saat dosen menilai tugas sekarang dipanggil dengan
     periode **milik dokumen tugasnya sendiri** (`tugas.periode`), bukan
     periode aktif saat menilai — supaya nilai baru ke depannya tidak
     pernah drift lagi walau dinilai belakangan setelah pergantian semester.

   Sudah saya tes dengan simulasi data tiruan (nilai tugas yang periode-nya
   sengaja dibuat "salah") — hasilnya nilai tugas tetap terbaca, sementara
   filter periode untuk UTS/UAS tetap bekerja seperti semula (tidak ada efek
   samping).

---



| File | Perubahan |
|---|---|
| `helpers/nilaiHelper.js` | Ditambah fungsi rubrik (kehadiran/sikap/keaktifan/kuis, bobot custom, hitung nilai akhir, huruf tanpa A-/B-). Fungsi lama tidak diubah/dihapus. |
| `helpers/academicHelper.js` | Batas bulan semester direvisi: Genap Feb-Agustus, Ganjil September-Desember (lihat bagian 0 di atas). |
| `routes/dosen/index.js` | Ditambah 2 baris: `require('./rubrik')` + `router.use('/rubrik', rubrikRouter)`. |
| `routes/admin/index.js` | Ditambah 1 baris: `router.use('/rubrik', require('./rubrik'))`. |
| `views/dosen/dashboard.ejs` | Ditambah 1 kartu pintasan "Rubrik Penilaian". |
| `views/admin/dashboard.ejs` | Ditambah 1 kartu menu "Rubrik Penilaian". |

**Cara aman menerapkannya**: buka file Anda yang asli, cari baris yang sama
persis (lihat isi file di zip ini), lalu tambahkan baris barunya secara manual
kalau Anda sudah banyak mengubah file aslinya. Kalau file asli belum banyak
diutak-atik, boleh langsung ditimpa dengan file dari zip ini.

## 2. File baru

- `routes/dosen/rubrik.js` – halaman dosen: pilih MK → isi rubrik → atur bobot → cetak.
- `routes/admin/rubrik.js` – halaman admin/kaprodi: rekap semua MK, lihat rubrik tiap MK, kunci nilai ke transkrip, cetak.
- `views/dosen/rubrik_pilih_mk.ejs`
- `views/dosen/rubrik_input.ejs`
- `views/admin/rubrik_list.ejs`
- `views/admin/rubrik_detail.ejs`
- `views/rubrik_print.ejs` – halaman cetak (dipakai dosen & admin, sudah pakai kop surat Politeknik Dewantara seperti halaman cetak KRS Anda).

## 3. Bagaimana ini "otomatis" ambil MK & nama mahasiswa

Fitur ini **tidak menyimpan ulang** MK atau data mahasiswa. Ia memakai koleksi
yang sudah ada di sistem Anda:
- `mataKuliah` → daftar MK & dosen pengampu (field `dosenIds`).
- `enrollment` → mahasiswa yang aktif di MK tsb (field `mkId`, `userId`, `status`).
- `users` → nama & NIM mahasiswa.
- `tugas` + `nilai` (tipe `tugas_<id>`) → dipakai untuk menghitung **rata-rata
  Tugas otomatis**, jadi dosen tidak perlu input ulang nilai tugas di rubrik;
  begitu dosen menilai tugas lewat menu **Kelola Tugas** yang sudah ada,
  angkanya langsung ikut ke rubrik.

Jadi begitu dosen membuka `/dosen/rubrik/:mkId`, kolom No/NIM/Nama/Tugas semua
otomatis terisi dari data yang sudah ada — dosen tinggal isi Kehadiran, Sikap,
Keaktifan, Kuis, UTS, UAS.

## 4. Koleksi Firestore baru

- **`nilai`** (koleksi lama, dipakai ulang) — ditambah tipe baru:
  `KEHADIRAN_JUMLAH`, `KEHADIRAN_TOTAL`, `SIKAP`, `KEAKTIFAN`, `KUIS`, `UTS`, `UAS`.
  Formatnya identik dengan dokumen `tugas_<id>` yang sudah ada (field
  `mahasiswaId`, `mkId`, `tipe`, `nilai`, `periode`), supaya tidak perlu
  koleksi baru untuk komponen ini dan tetap konsisten dengan alur lama.
- **`rubrikBobot`** (koleksi baru) — 1 dokumen per `mkId` + `periode`, isinya
  bobot komponen (kehadiran/tugas/kuis/uts/uas + sub-bobot %hadir/sikap/keaktifan)
  yang bisa diubah dosen. Kalau belum pernah diisi, dipakai bobot default:
  Kehadiran 10%, Tugas 20%, Kuis 10%, UTS 30%, UAS 30%
  (sub-kehadiran: %Hadir 50%, Sikap 25%, Keaktifan 25%) — sama seperti template
  Excel yang sebelumnya dibuat.

### Index Firestore yang mungkin dibutuhkan
Karena beberapa query menggabungkan `where('mkId','==',...)` dengan
`where('periode','==',...)`, Firestore mungkin meminta index komposit
(`nilai`: mkId+periode, `rubrikBobot`: mkId+periode). Kalau muncul error index
di console/log, klik link yang diberikan Firestore untuk membuat index-nya
otomatis (pola yang sama seperti index `tugas` yang sudah ada di kode lama).

## 5. Rute yang tersedia

**Dosen** (butuh login dosen, prefix `/dosen`):
- `GET /dosen/rubrik` — pilih MK.
- `GET /dosen/rubrik/:mkId` — form isi rubrik (nilai tugas otomatis, sisanya diisi manual, tersimpan otomatis tiap kolom berubah).
- `POST /dosen/rubrik/:mkId/bobot` — simpan bobot komponen untuk MK ini.
- `POST /dosen/rubrik/input` — simpan satu nilai komponen (dipanggil otomatis lewat AJAX dari halaman input).
- `GET /dosen/rubrik/:mkId/cetak` — halaman cetak/PDF.

**Admin/Kaprodi** (butuh login admin, prefix `/admin`):
- `GET /admin/rubrik` — daftar semua MK + status kelengkapan rubrik.
- `GET /admin/rubrik/:mkId` — rekap rubrik lengkap satu MK (read-only) + tombol "Kunci ke Transkrip".
- `POST /admin/rubrik/:mkId/kunci/:mahasiswaId` — mengunci nilai akhir rubrik mahasiswa ke koleksi `grades` resmi (dipakai transkrip/KHS/IPK), memakai `saveGradeFinal` yang sudah ada.
- `GET /admin/rubrik/:mkId/cetak` — halaman cetak yang sama dengan dosen.

## 6. Menu navigasi

Tambahkan link ke `/dosen/rubrik` dan `/admin/rubrik` di partial menu Anda
(`views/partials/header.ejs`), mengikuti pola link menu "Rekap Nilai" yang
sudah ada di sana, contoh:

```html
<a class="nav-link" href="/dosen/rubrik"><i class="bi bi-clipboard-data"></i> Rubrik Penilaian</a>
```

## 7. Catatan penting sebelum deploy

- Zip yang Anda unggah **tidak menyertakan** `app.js`/`server.js`, folder
  `config/`, `middleware/`, atau `package.json`, jadi kode ini tidak bisa saya
  jalankan/tes langsung di sini. Kode ini ditulis mengikuti pola & konvensi
  yang sama persis dengan file-file lain di project Anda (require path,
  `verifyToken`/`isDosen`/`isAdmin`, `db` dari `config/firebaseAdmin`, dsb.),
  jadi seharusnya langsung "plug-in", tapi mohon tetap dites di environment
  Anda (terutama nama field `sks`, `semester` di `mataKuliah`, dan field
  `nama`/`nim` di `users`, karena field itu diasumsikan sama seperti kode
  `nilai.js` yang sudah ada).
- `POST /dosen/rubrik/input` mengharapkan body `application/x-www-form-urlencoded`
  (sama seperti form-form lain di app Anda) — pastikan `express.urlencoded({extended:true})`
  aktif secara global (biasanya sudah, karena form nilai lama juga memakainya).
- Predikat huruf sengaja **tanpa A- dan B-**: A (≥85), B+ (75-84), B (65-74),
  C+ (55-64), C (45-54), D (35-44), E (<35), sesuai permintaan.
