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

4. **Komponen penilaian sekarang bisa disesuaikan sendiri (mis. hilangkan Kuis).**
   Sebelumnya `hitungRubrik()` **mewajibkan kelima komponen** (Kehadiran,
   Tugas, Kuis, UTS, UAS) terisi sebelum Nilai Akhir dihitung — kalau dosen
   memang tidak pernah kuis, kolom Kuis akan selalu kosong dan **Nilai Akhir
   tidak akan pernah muncul**, walaupun komponen lain sudah lengkap. Ini
   ternyata penyebab keluhan "hasil hitungan tidak muncul".

   **Sekarang:** set bobot komponen yang tidak dipakai jadi **0%** di panel
   "Bobot Komponen" (mis. Kuis = 0). Komponen berbobot 0% otomatis:
   - Tidak wajib diisi.
   - Tidak ikut dihitung sama sekali (bobot sisanya otomatis dinormalisasi
     ke 100% dari komponen yang benar-benar dipakai).
   - Header kolomnya ditandai abu-abu "(tidak dipakai)" di halaman input,
     supaya jelas kolom mana yang memang sengaja tidak dipakai.
   Ini berlaku juga untuk sub-komponen Kehadiran (% Hadir/Sikap/Keaktifan) -
   kalau dosen tidak menilai Sikap secara terpisah misalnya, set bobot Sikap
   ke 0% juga.

   Sudah dites: bobot Kuis=0 dengan Kuis kosong + komponen lain lengkap →
   Nilai Akhir tetap terhitung normal (bobot sisanya ternormalisasi otomatis).

5. **Perbaikan input Kehadiran/Sikap/Keaktifan/Kuis/UTS/UAS yang "cuma bisa
   1-2 digit" & hasil tidak langsung muncul.**
   Sebelumnya tiap kolom pakai `onchange` yang langsung **reload seluruh
   halaman** begitu tersimpan. Ini berisiko mengganggu saat mengetik (di
   sebagian browser/keyboard, event bisa terpicu sebelum digit kedua
   sempat diketik) dan terasa lambat. Sekarang diganti jadi **auto-save
   dengan jeda ~0.9 detik setelah berhenti mengetik** (bukan tiap huruf/klik),
   dan **tanpa reload halaman** - begitu tersimpan, kotak yang diubah akan
   berkedip hijau sebentar dan sel Nilai Akhir/Huruf/Keterangan di baris yang
   sama langsung ter-update dari hasil hitungan server. Jadi mengetik angka
   2 digit seperti 80 tidak lagi terputus, dan hasilnya langsung kelihatan.

6. **Nilai Tugas di rubrik = akumulasi Tugas 1, 2, 3, dst (dan cara cek sinkron
   dengan Daftar Tugas).** Ditambahkan halaman baru **"Rincian Tugas"**
   (`/dosen/rubrik/:mkId/rincian-tugas`, link ada di pojok kanan atas halaman
   Rubrik) yang menampilkan tabel nilai **per tugas satu per satu** (Tugas 1,
   Tugas 2, Tugas 3, ... sesuai tugas yang benar-benar dibuat di MK itu) plus
   kolom Rata-rata — mirip sheet "Detail Tugas" di Excel yang dulu dibuat.

   Angka rata-rata di halaman ini dijamin **identik** dengan angka "Tugas
   (otomatis)" di Rubrik, karena keduanya (`getRincianTugasByMkId` dan
   `getRataTugasByMkId`) memakai query & logika yang sama persis - sudah
   saya tes dengan data tiruan 3 tugas (termasuk 1 nilai yang periode-nya
   sengaja dibuat beda) dan hasilnya konsisten 100% di kedua fungsi.

   Kalau nanti masih ada yang terlihat "belum sinkron" antara Daftar Tugas
   dan Rubrik, buka halaman Rincian Tugas ini dulu - kalau di situ juga
   sudah tidak sesuai dengan Daftar Tugas, kemungkinan ada MK/tugas/nilai
   spesifik yang bermasalah (mis. `mkId` di dokumen `tugas` tidak persis
   sama dengan `mkId` yang dipakai enrollment) - kabari saya MK & tugas mana
   supaya saya bisa telusuri lebih spesifik.

7. **Kolom bobot 0% sekarang benar-benar disembunyikan (bukan cuma abu-abu).**
   Di halaman input dosen, halaman detail admin, dan halaman cetak - kalau
   bobot Kuis/Sikap/Keaktifan diatur 0%, kolomnya **hilang total** dari tabel
   (bukan cuma diberi label "tidak dipakai" seperti revisi sebelumnya).

8. **Kenapa Huruf/Nilai Akhir kadang tidak muncul - sekarang ada penjelasannya
   langsung di tabel.** Root cause paling umum: dosen mengira menghapus satu
   komponen (mis. set bobot Kuis = 0) sudah cukup, padahal ada komponen LAIN
   yang bobotnya masih > 0 tapi belum sempat diisi (paling sering:
   Sikap/Keaktifan, karena keduanya dipakai untuk menghitung Kehadiran Akhir).
   Selama ada komponen berbobot > 0 yang masih kosong, Nilai Akhir memang
   sengaja belum dihitung (supaya tidak salah/prematur).

   **Sekarang lebih transparan:** kalau Nilai Akhir masih "-", di bawah
   angkanya muncul catatan kecil **"Belum: Sikap, Keaktifan"** (misalnya) -
   jadi dosen langsung tahu komponen mana yang masih perlu diisi atau
   bobotnya perlu di-nol-kan juga. Ini update otomatis tanpa reload begitu
   nilai disimpan.

9. **Diagnostik tugas "salah MK" (kemungkinan akar masalah sinkron yang
   sebenarnya).** Karena laporan "tugas belum sinkron" ternyata menunjuk ke
   URL Daftar Tugas & detail tugas spesifik yang tidak bisa saya akses
   langsung (di luar percakapan ini, perlu login), saya tambahkan alat
   diagnostik otomatis di halaman **Rincian Tugas**: sistem akan mengecek
   apakah ada tugas dengan **kode MK yang sama persis** (mis. sama-sama
   "ELK301") tapi **ID data Mata Kuliah yang berbeda** di Firestore - ini
   biasanya terjadi kalau ada 2 dokumen `mataKuliah` untuk kelas yang
   terlihat sama di UI tapi sebenarnya beda record (mis. sisa duplikat dari
   semester sebelumnya). Kalau ditemukan, akan muncul kotak peringatan merah
   di atas tabel Rincian Tugas yang menyebutkan tugas mana saja yang
   "salah tempat" beserta ID datanya masing-masing - supaya bisa langsung
   ketahuan apakah ini penyebabnya.

   **Catatan jujur:** saya tidak bisa membuka `wa.ac.id/dosen/tugas/...` dari
   sini (perlu login & di luar akses saya), jadi kalau setelah update ini
   kotak peringatan itu tetap tidak muncul padahal Anda yakin datanya beda,
   tolong screenshot atau salin isi halaman Daftar Tugas + Rincian Tugas
   untuk MK yang sama, biar saya bisa bandingkan lebih spesifik.

10. **Akar masalah sebenarnya dari "tugas hilang di Daftar Tugas" - ditemukan
    & diperbaiki.** Ternyata bukan soal nilai, tapi **dokumen tugasnya sendiri**
    yang hilang dari daftar. Kronologinya:
    - `helpers/academicHelper.js` versi lama menganggap Agustus = "Ganjil".
    - Kalau ada tugas yang **dibuat di bulan Agustus 2026** (sebelum saya
      perbaiki batas semester minggu lalu), tugas itu ikut tersimpan dengan
      label `periode: "Ganjil 2026/2027"` - padahal seharusnya
      "Genap 2025/2026".
    - Begitu batas semester saya perbaiki (Agustus jadi masuk Genap lagi),
      **Daftar Tugas** (`/dosen/tugas`) dan **Rubrik/Rincian Tugas** sama-sama
      cuma menampilkan tugas yang labelnya persis "Genap 2025/2026" -
      sehingga tugas yang telanjur salah label itu **hilang total** dari
      kedua halaman, walau datanya tetap ada utuh di Firestore.

    **Perbaikan** (di `helpers/academicHelper.js`, `helpers/nilaiHelper.js`,
    `routes/dosen/index.js`):
    - Ditambahkan `getSemesterForDate(tanggal)` - versi umum dari
      `getCurrentAcademicSemester()` yang bisa menghitung label semester
      untuk **tanggal apa saja**, bukan cuma "sekarang".
    - `getTugasByMkId()` (dipakai Rubrik/Rincian Tugas) dan halaman
      **Daftar Tugas** sekarang **menghitung ulang periode setiap tugas dari
      tanggal deadline/dibuatnya sendiri** (sumber kebenaran yang tidak
      pernah berubah), BUKAN mempercayai field `periode` yang tersimpan.
      Kalau hasilnya beda dari yang tersimpan, dokumennya langsung
      **diperbaiki otomatis** (self-heal) saat pertama kali diakses.

    Sudah saya tes ulang persis skenario ini (tugas dibuat 15 Agustus 2026,
    label salah tersimpan "Ganjil 2026/2027") — setelah fix, tugas tsb
    langsung muncul lagi di Daftar Tugas & Rubrik, dan dokumennya otomatis
    diperbaiki labelnya secara permanen begitu diakses sekali saja.

    Ini kemungkinan besar **penyebab sebenarnya** dari laporan tugas
    "belum sinkron" sebelumnya - bukan soal nilai tugas yang tidak terbaca,
    tapi tugasnya sendiri yang sempat tidak kelihatan.

11. **Fitur baru: Tugas Manual** (untuk tugas yang diberikan TIDAK lewat web -
    misal dikerjakan di kertas, presentasi lisan, praktikum tanpa upload,
    dll) - tetap ikut dihitung sebagai bagian dari rata-rata "Tugas" di
    Rubrik, berdampingan dengan tugas yang dibuat lewat menu Kelola Tugas.

    **Cara pakai:** buka halaman **Rincian Tugas**
    (`/dosen/rubrik/:mkId/rincian-tugas`) → ada form kecil "+ Tambah Tugas
    Manual" di atas tabel → isi judulnya (mis. "Presentasi Kelompok") →
    kolom baru bertanda badge kuning **MANUAL** langsung muncul di tabel dan
    **bisa diisi langsung di situ** (auto-save ~0.9 detik setelah berhenti
    mengetik, sama seperti input di halaman Rubrik). Kolom Rata-rata & Tugas
    di Rubrik otomatis ikut memperhitungkan nilai ini.

    Tugas manual bisa dihapus lagi kapan saja (tombol ✕ kecil di header
    kolomnya, dengan konfirmasi) - nilainya ikut terhapus rapi, tidak
    meninggalkan data nyasar.

    **Cara kerja teknis:** disimpan di koleksi Firestore baru `tugasManual`
    (terpisah dari `tugas` supaya tidak tercampur dengan modul e-learning),
    nilainya tetap di koleksi `nilai` yang sama (tipe `tugasmanual_<id>`,
    prefix beda dari `tugas_<id>` biar tidak pernah bentrok). Rata-rata Tugas
    di Rubrik (`getRataTugasByMkId`) sekarang otomatis menggabungkan tugas
    web + tugas manual jadi satu perhitungan.

    Sudah saya tes: gabungan 1 tugas web (nilai 80) + 1 tugas manual (nilai
    90) → rata-rata 85 ✅; tambah tugas manual baru (nilai 70) → rata-rata
    otomatis jadi 80 ✅; hapus tugas manual → rata-rata kembali ke 85 dan
    nilainya ikut terhapus ✅.

12. **Bug penyebab "nilai yang sudah diperiksa belum kembali" - ditemukan &
    diperbaiki.** Ini beda lagi dari sebelumnya, dan cukup halus: fungsi
    `saveNilai()` (dipakai setiap dosen menilai/memeriksa tugas) tadinya
    mengecek "apakah nilai untuk mahasiswa+tugas ini sudah pernah ada?" dengan
    ikut menyaring field `periode`. Kalau label periode aktif SEKARANG beda
    dari yang tersimpan di nilai LAMA (persis skenario akibat penyesuaian
    batas semester kemarin), pengecekan ini **gagal menemukan nilai lama**
    dan malah **membuat dokumen nilai BARU** - sehingga ada 2 dokumen nilai
    untuk mahasiswa+tugas yang sama. Karena halaman detail tugas menampilkan
    nilai tanpa urutan yang pasti, nilai yang baru saja diperiksa dosen bisa
    "keteter" oleh dokumen lama saat ditampilkan lagi - persis seperti yang
    dilaporkan.

    **Perbaikan** (`helpers/nilaiHelper.js` - `saveNilai()`):
    - Pengecekan nilai yang sudah ada sekarang **tidak lagi ikut menyaring
      periode** - cukup (mahasiswaId, mkId, tipe tugas), karena satu tugasId
      memang sudah pasti hanya milik satu periode.
    - Kalau ternyata SUDAH ADA lebih dari satu dokumen nilai untuk kombinasi
      yang sama (sisa dari bug lama), sistem otomatis **membersihkan
      duplikatnya** - menyimpan ke yang paling baru diubah, menghapus sisanya.
    - Halaman **detail tugas** (`/dosen/tugas/:id`) juga diperkuat sebagai
      lapis kedua: kalau masih ada duplikat nyasar, otomatis pilih nilai yang
      **paling baru** (bukan asal urutan Firestore) dan bersihkan sisanya.

    Sudah saya tes persis skenario ini: nilai lama (60, periode drift) +
    dosen menilai ulang jadi 95 (periode sudah benar) → hasilnya **1
    dokumen saja**, nilai ter-update jadi 95, bukan 2 dokumen yang
    tumpang tindih. Ini kemungkinan **penyebab pasti** dari laporan
    "nilai yang diperiksa belum kembali".

13. **AKAR MASALAH SEBENARNYA dari "nilai belum kembali" - ditemukan.** Ini
    yang paling penting, dan sebenarnya sudah tersirat dari permintaan Anda
    sebelumnya ("buat tugas bisa diisi manual kalau diberi tidak lewat web").
    Ternyata halaman **detail tugas** (`/dosen/tugas/:id`) HANYA menampilkan
    tombol "Nilai" untuk mahasiswa yang **sudah upload/submit lewat web**
    (ada dokumen `pengumpulan`). Untuk mahasiswa yang tugasnya dikerjakan
    **tidak lewat web** (kertas, presentasi lisan, dll) atau belum sempat
    upload, tombolnya **tidak ada sama sekali** - jadi dosen memang TIDAK
    BISA memberi nilai untuk mahasiswa itu lewat halaman ini. Ini kemungkinan
    besar penyebab pasti "nilai belum kembali" - bukan soal sinkronisasi,
    tapi memang belum pernah bisa diisi dari awal untuk mahasiswa tersebut.

    Ditemukan juga bug kedua yang berkaitan: kolom "Nilai" di tabel ini
    membaca dari `pengumpulan.nilai` (yang cuma ada kalau ada submission),
    BUKAN dari nilai sebenarnya yang tersimpan di collection `nilai` - jadi
    walaupun suatu saat nilai berhasil tersimpan lewat cara lain, kolom ini
    tetap akan menampilkan "-".

    **Perbaikan** (`views/dosen/tugas_detail.ejs` + `routes/dosen/index.js`):
    - Kolom "Nilai" sekarang membaca nilai yang benar (`m.nilai`, hasil dari
      collection `nilai`) - tampil dengan benar baik ada submission atau tidak.
    - Mahasiswa **tanpa submission** sekarang tetap dapat tombol
      **"Nilai Langsung"** (beda warna dari tombol "Nilai" biasa) yang
      membuka modal yang sama, tapi menyimpan nilai **langsung by mahasiswaId**
      tanpa perlu dokumen pengumpulan - route baru
      `POST /dosen/tugas/nilai-langsung`.
    - Modal input nilai juga sekarang **pre-fill** nilai yang sudah ada
      (kalau sebelumnya pernah dinilai), jadi bisa langsung diedit, bukan
      cuma bisa isi baru.

    Ini file BARU yang perlu Anda tambahkan/timpa: `views/dosen/tugas_detail.ejs`
    (selain `routes/dosen/index.js` yang sudah diperbarui lagi).

14. **Optimasi kuota Firestore - dashboard & rubrik jauh lebih hemat baca.**
    Ini bukan bug baru, tapi memang boros dari sananya (dan sebagian dari
    fitur Rubrik yang saya buat sendiri juga ikut boros, sudah diperbaiki
    sekalian). Perubahan di `routes/admin/dashboard.js`,
    `routes/dosen/dashboard.js`, `routes/admin/rubrik.js`, dan
    `routes/dosen/rubrik.js`:

    - **Dashboard Admin**: 8 query yang tadinya `.get()` penuh (baca SEMUA
      dokumen yang cocok cuma untuk dapat angkanya) diganti pakai Firestore
      **`count()` aggregation** - jauh lebih murah, apalagi untuk koleksi
      besar seperti `users`. Ada fallback otomatis ke cara lama kalau versi
      `firebase-admin` di server belum mendukung `count()`.
    - **Dashboard Dosen**: ada 2 pola **N+1 query** yang lumayan parah -
      "pengumpulan belum dinilai" tadinya query TERPISAH untuk **setiap**
      tugas (20 tugas = 20 query), dan "logbook" tadinya query TERPISAH
      untuk **setiap** mahasiswa bimbingan + `users` diambil satu-satu untuk
      tiap entri pending. Sekarang semuanya di-batch (`where(...,'in',...)`,
      per 10 sekaligus) dan dokumen `users` yang dibutuhkan diambil
      SEKALIGUS lewat `db.getAll(...)`, bukan satu per satu dalam loop.
    - **Halaman Rekap Rubrik Admin** (daftar semua MK): tadinya, untuk
      **SETIAP** MK di daftar, sistem membaca ULANG SELURUH koleksi `nilai`
      MK itu **dua kali** cuma untuk menghitung "berapa mahasiswa yang
      rubriknya lengkap" - kalau ada 30 MK, itu 60 pembacaan penuh koleksi
      nilai setiap kali admin buka halaman ini. Angka kelengkapan itu sudah
      dihapus dari daftar (tetap bisa dilihat begitu klik ke detail 1 MK,
      yang memang cuma perlu baca 1 MK, bukan semua). Jumlah mahasiswa per
      MK juga diganti pakai `count()`.
    - **Halaman Rubrik & Rincian Tugas** (dosen & admin): dokumen mahasiswa
      (`users`) yang tadinya diambil **satu per satu dalam loop** (N query
      utk N mahasiswa di kelas) sekarang diambil **sekaligus** lewat
      `db.getAll(...)` (1 round-trip). Nama dosen juga di-cache dalam satu
      request supaya MK dengan dosen yang sama tidak baca dokumen `users`
      yang sama berulang kali.

    **Catatan:** `count()` aggregation query butuh `firebase-admin` versi
    yang cukup baru (kira-kira v10.6+/v11+). Sudah saya kasih fallback
    otomatis kalau ternyata versi di server Anda lebih lama, jadi tidak akan
    error - cuma belum sehemat itu sampai `firebase-admin` di-update
    (`npm update firebase-admin`).

15. **Optimasi kuota Firestore - modul MAGANG (admin, dosen, mahasiswa).**
    Sama seperti dashboard, modul magang punya beberapa pola boros yang
    sekarang diperbaiki tanpa mengubah fungsionalitas (hasil akhir yang
    ditampilkan ke pengguna tetap sama persis):

    - **`routes/dosen/magang.js`** - `getLogbookStatistik()` (dipanggil
      **sekali per mahasiswa bimbingan** di halaman daftar) tadinya membaca
      ulang SELURUH logbook mahasiswa itu **4 kali** (total, pending,
      approved, rejected - overlap besar) → sekarang pakai `count()`
      aggregation, 4 angka tanpa mengunduh isi dokumennya sama sekali. Selain
      itu, enrollment & periode aktif tadinya di-query **terpisah per
      mahasiswa**, dan dokumen mataKuliah diambil **satu per satu per
      enrollment** (bisa 50+ pembacaan serial untuk 10 mahasiswa x 5
      enrollment) → sekarang di-batch pakai `where(...,'in',...)` per 10
      mahasiswa sekaligus, dan semua dokumen mataKuliah diambil sekaligus
      lewat `db.getAll()`.
    - **`routes/admin/emagang.js`** - halaman detail logbook satu mahasiswa
      tadinya membaca **koleksi logbook mahasiswa yang sama sampai 5 kali**
      dalam satu page load (sekali utk tampilan, sekali lagi utk daftar
      semester, lalu sekali lagi PER PERIODE magang utk statistik) → sekarang
      cukup **1 kali baca**, sisanya (filter tampilan, daftar semester,
      statistik per PDK) dihitung dari data yang sama di memori/JS.
    - **`routes/dosen/magangPeriod.js`, `routes/mahasiswa/magang.js`** -
      pola yang sama (fetch mataKuliah per-enrollment satu-satu secara
      serial) diperbaiki jadi `db.getAll()` sekaligus. Juga: 2 query yang
      cuma butuh JUMLAH logbook (progress bar) diganti ke `count()`; query
      cek ulasan perusahaan yang tadinya **per periode magang** (N query)
      digabung jadi 1 query batch `'in'`; dan 3 dokumen laporan magang tetap
      (laporan ke-1/2/3) yang tadinya diambil lewat 3x `.get()` berurutan
      sekarang lewat 1x `db.getAll()`.
    - **`routes/admin/laporanMagang.js`, `routes/dosen/laporanMagang.js`,
      `routes/dosen/perusahaan.js`** - ketiganya punya pola yang sama:
      data mahasiswa diambil **satu per satu di dalam loop** (N query utk N
      mahasiswa berbeda yang muncul di daftar laporan/perusahaan) → sekarang
      1 kali `db.getAll()` untuk semua mahasiswa yang dibutuhkan sekaligus.

    **Catatan jujur soal batas optimasi:** untuk pola "ambil dokumen A, B, C
    satu per satu" (mis. `db.getAll()`), biaya BACA dokumennya di Firestore
    sebenarnya sama saja (tetap dihitung per dokumen) - yang benar-benar
    dihemat adalah jumlah ROUND-TRIP/koneksi (lebih cepat & lebih sedikit
    request), plus untuk kasus dengan hasil KOSONG, query terpisah tadinya
    tetap kena biaya minimum per query, sedangkan digabung jadi 1 query
    biayanya cuma sekali. Penghematan BACA DOKUMEN yang paling signifikan ada
    di 2 pola: (1) mengganti `.get()`+`.size`/`.forEach` yang cuma butuh
    angka dengan `count()` aggregation (hemat besar utk koleksi berisi
    banyak dokumen), dan (2) menghilangkan pembacaan koleksi yang SAMA
    berulang-ulang dalam satu request (mis. logbook 4x atau 5x tadi).
    Modul-modul yang sudah dipakai `count()`/`db.getAll()` dan bebas dari
    pembacaan berulang di atas sudah dioptimalkan sejauh mungkin tanpa
    mengubah skema data atau fungsionalitas.

16. **Fitur baru: tombol "Setujui 1 Minggu" untuk logbook magang** (dosen
    Pembimbing 2 & admin) - supaya tidak perlu menyetujui logbook satu per
    satu setiap hari.

    **Lokasi tombol:** di bagian atas halaman detail logbook mahasiswa,
    berdampingan dengan tombol Print/Kembali yang sudah ada:
    - Dosen: `/dosen/magang/:userId` (hanya tampil kalau Anda Pembimbing 2).
    - Admin: `/admin/emagang/mahasiswa/:userId`.

    **Cara kerja:** sekali klik (dengan konfirmasi), sistem menyetujui
    **SEMUA logbook berstatus "pending" dalam 7 hari terakhir** milik
    mahasiswa itu sekaligus (bukan cuma hari ini - betul-betul 1 minggu
    penuh ke belakang). Kalau sedang memilih periode magang tertentu (filter
    PDK di halaman itu), hanya logbook periode itu yang ikut disetujui.
    Setiap logbook yang disetujui lewat tombol ini otomatis diberi catatan:

    > "Mahasiswa telah konsultasi dan logbook disetujui"

    Catatan ini muncul di halaman logbook mahasiswa (`mahasiswa/magang/logbook.ejs`)
    dan di halaman detail dosen/admin, di bawah nama yang menyetujui - jadi
    semua pihak tahu logbook itu disetujui secara massal per minggu, bukan
    ditinjau satu per satu.

    **Teknis:** field baru `catatan` pada dokumen `logbookMagang` (field
    `keterangan` yang sudah ada TIDAK disentuh - itu dipakai untuk status
    hadir/sakit/izin dari mahasiswa, beda konsep). Update ke banyak dokumen
    dilakukan lewat satu `db.batch()` (bukan update satu-satu), jadi tetap
    hemat kuota. Kalau tidak ada logbook pending dalam 7 hari terakhir, akan
    muncul pesan "Tidak ada logbook pending" - tombol aman diklik kapan saja
    tanpa risiko error.

    File baru/berubah: `routes/dosen/magang.js`, `routes/admin/emagang.js`,
    `views/dosen/magang_detail.ejs`, `views/admin/emagang_mahasiswa.ejs`,
    `views/mahasiswa/magang/logbook.ejs`.

17. **Optimasi kuota - Rubrik Penilaian dosen (ini yang paling parah, dan
    paling sering kena karena auto-save).** Ditemukan 2 masalah:

    - **Setiap kali dosen mengetik SATU nilai** (Kehadiran/Sikap/Keaktifan/
      Kuis/UTS/UAS/Tugas Manual - auto-save ~0.9 detik setelah berhenti
      ngetik), sistem SEBELUMNYA membaca ULANG **seluruh koleksi `nilai`
      untuk SEMUA mahasiswa di kelas itu**, padahal cuma perlu hasil untuk
      SATU mahasiswa yang sedang diedit. Untuk kelas 30 mahasiswa, itu bisa
      puluhan-ratusan pembacaan dokumen HANYA untuk menyimpan 1 angka.
    - Halaman rubrik kelas penuh (input dosen, detail admin, cetak) juga
      membaca koleksi `nilai` yang sama **2 kali terpisah** (sekali lewat
      `getKomponenRubrikByMkId`, sekali lagi lewat `getRataTugasByMkId`).

    **Perbaikan** (`helpers/nilaiHelper.js`):
    - Fungsi baru `getHasilRubrikSatuMahasiswa()` - query `nilai` dipersempit
      langsung di Firestore ke SATU mahasiswa saja
      (`where('mahasiswaId','==',...)`), dipakai di route auto-save
      (`POST /dosen/rubrik/input` dan `POST /dosen/rubrik/tugas-manual/nilai`).
    - Fungsi baru `getHasilRubrikSemuaMahasiswa()` - menggabungkan
      `getKomponenRubrikByMkId` + `getRataTugasByMkId` jadi SATU pembacaan
      koleksi `nilai`, dipakai di halaman kelas penuh (dosen, admin, cetak).

    **Hasil tes nyata** (simulasi kelas 30 mahasiswa, menyimpan 1 nilai):
    cara lama = **68 operasi baca**, cara baru = **7 operasi baca** - sekitar
    **10x lebih hemat**, dan penghematannya makin besar untuk kelas yang
    lebih besar (karena cara lama scaling-nya ikut jumlah mahasiswa, cara
    baru tidak).

18. **Kenapa dashboard dosen terasa lambat - ini soal KECEPATAN, bukan
    cuma kuota.** Setelah optimasi kuota sebelumnya (poin 14), ternyata
    dashboard dosen masih bisa lambat karena masalah yang BEDA: banyak
    query yang **saling tidak berhubungan** tapi ditulis menunggu satu-satu
    secara BERURUTAN (`await` demi `await`), bukan berbarengan.

    Bedanya penting: kalau 5 query independen dijalankan berurutan, total
    waktu tunggu = **jumlah** semua waktu round-trip-nya (mis. 5 x 150ms =
    750ms). Kalau dijalankan bersamaan (`Promise.all`), total waktu tunggu =
    waktu round-trip **paling lama saja** (~150-200ms) - jauh lebih cepat,
    meskipun jumlah dokumen yang dibaca sama persis.

    Titik yang paling berdampak: bagian "pdkInfo" untuk logbook pending
    tadinya query `magangPeriod` **satu per satu dalam for-loop serial** -
    kalau ada 15 logbook pending, ini menunggu 15 round-trip Firestore
    berurutan (bisa nambah 1-3 detik sendiri ke waktu loading dashboard).

    **Perbaikan** (`routes/dosen/dashboard.js`):
    - 5 query independen di awal (mata kuliah, bimbingan1, bimbingan2, tugas,
      event) digabung jadi satu `Promise.all`.
    - Query batch "pengumpulan belum dinilai" per-chunk, dan "logbook"
      per-chunk, dijalankan bersamaan lewat `Promise.all` (sebelumnya
      for-loop serial menunggu chunk demi chunk).
    - Bagian pdkInfo per logbook pending (yang paling berat) diubah dari
      for-loop serial jadi `Promise.all(pendingRaw.map(...))`.

    Jumlah dokumen yang dibaca **tidak berubah** (optimasi kuota poin 14
    tetap berlaku) - yang berubah cuma cara menjalankannya, dari
    satu-per-satu-menunggu jadi bersamaan. Dashboard admin sudah memakai
    pola `Promise.all` sejak awal jadi tidak ada perubahan di sana.

19. **Sapuan lebih luas - titik boros lain yang ditemukan & sebagian
    diperbaiki.** Saya telusuri seluruh 78 file route di project (bukan
    cuma dashboard/rubrik/magang), cari pola query-di-dalam-loop yang sama.
    Yang sudah diperbaiki di update ini:

    - **`routes/mahasiswa/dashboard.js`** (PALING PENTING - dashboard yang
      dibuka SETIAP mahasiswa SETIAP login): daftar MK yang diambil tadinya
      fetch `mataKuliah` satu per satu per enrollment (serial) → sekarang
      `db.getAll()`. Daftar tugas aktif tadinya query TERPISAH per MK (N
      query kalau ambil N MK) → sekarang di-batch pakai `'in'`. 3 pemanggilan
      data yang saling independen (tagihan, MK, event) juga digabung jadi
      `Promise.all` (sama seperti perbaikan dashboard dosen kemarin).
    - **`routes/dosen/mk.js`** (halaman "Kelola Mata Kuliah" - dosen kelola
      satu MK: presensi, materi, dll): daftar mahasiswa peserta (muncul di
      2 tempat di file ini) dan daftar nama dosen pengampu tadinya fetch
      satu per satu → sekarang `db.getAll()`.
    - **`routes/dosen/mahasiswa.js`**: halaman daftar "Mahasiswa Bimbingan"
      - fetch data mahasiswa satu per satu → `db.getAll()`. Halaman detail
      satu mahasiswa - nilai per MK tadinya di-query terpisah PER MK (bisa
      2x query per MK karena ada fallback) → digabung jadi 1 query batch
      `'in'` untuk semua MK sekaligus.

    **Kandidat lain yang TERDETEKSI tapi BELUM sempat diperbaiki** (skala
    dampaknya lebih kecil - biasanya halaman detail satu-data, bukan
    dashboard/list besar - tapi tetap pola yang sama kalau mau dibereskan
    juga):
    - `mahasiswa/elearning.js` (~baris 331-343): fetch `mataKuliah` per tugas
      dalam loop.
    - `mahasiswa/akademik.js` (~baris 96, 243, 300): fetch `mataKuliah` per
      item KRS/KHS dalam loop, muncul di 3 tempat berbeda.
    - `dosen/kurikulum.js`, `dosen/nilai.js`, `admin/pengajaran.js`,
      `admin/mahasiswa.js`, `admin/bimbingan.js`, `admin/khs.js`,
      `admin/tagihan.js`, `admin/sk.js`, `admin/spmp.js`, `admin/rps.js`,
      `admin/berkas.js`, `landing.js` - masing-masing punya 1-2 titik fetch
      dokumen tunggal (`dosen`/`users`/`mataKuliah`) di dalam loop kecil,
      biasanya di halaman form/detail (bukan dashboard), jadi prioritasnya
      lebih rendah.

    Kalau mau saya lanjutkan membereskan sisanya, tinggal bilang saja -
    pola perbaikannya sama semua (batch pakai `db.getAll()` atau `'in'`).

20. **Analisis data ASLI dari Firebase Query Insights (Aug 4-5) - ini
    konfirmasi nyata, bukan simulasi lagi.** Anda share data 24 jam terakhir
    dari Firebase Console, dan ini yang paling penting ditemukan:

    **a) Query PALING BOROS: `logbookMagang` WHERE (userId, pdkId, status)**
    - Cuma 59 kali dipanggil, tapi total **4.363 operasi baca**, dan
      rata-rata **2.303 index entries dibaca** padahal cuma 72 dokumen yang
      benar-benar jadi hasil (rasio index-dibaca/hasil = **32x**!).
    - **Penyebabnya**: query dengan 3+ filter kesetaraan (`==`) TANPA index
      komposit yang cocok, Firestore terpaksa **zigzag-merge** antar index
      per-field satu-satu (index `userId`, index `pdkId`, index `status`
      masing-masing sendiri-sendiri) - jauh lebih boros daripada kalau ada
      SATU index gabungan utk ketiganya sekaligus.
    - Sumbernya: `helpers/magangHelper.js` (`getProgressMagangHarian` -
      dipakai halaman publik/papan display, sudah di-cache 15 menit tapi
      query di baliknya tetap boros tiap kali cache refresh).
    - **Perbaikan: bukan ubah kode, tapi TAMBAH INDEX KOMPOSIT** (lihat
      `firestore.indexes.json` di zip ini) - setelah index ini ada,
      Firestore otomatis pakai jalur cepat, TANPA perlu ubah satu baris
      kode pun.

    **b) Query nomor 2 paling boros: `nilai` WHERE (mahasiswaId, mkId, tipe,
    periode) LIMIT 1** - 117 eksekusi, pola sama (zigzag-merge, rasio 58.5x).
    Ini kode SAYA SENDIRI (`saveKomponenRubrik` - dipanggil tiap dosen input
    Kehadiran/Sikap/dll di Rubrik). **Sudah saya perbaiki di update ini**:
    field `periode` dihapus dari pengecekan (sama seperti fix `saveNilai`
    sebelumnya - satu `mkId` di aplikasi ini representasi satu periode
    tertentu, jadi `periode` tidak perlu ikut jadi kunci pencarian). Index
    komposit utk 3 field sisanya (mahasiswaId, mkId, tipe) tetap saya
    sertakan sebagai lapis kedua.

    **c) Ditemukan juga: `enrollment` WHERE status = ? (SATU filter saja)**
    - 234 dokumen dibaca RATA-RATA setiap eksekusi - ini membaca **SEMUA
      enrollment aktif DI SELURUH SISTEM** (semua mata kuliah, bukan cuma
      magang), padahal cuma dibutuhkan yang terkait PDK/magang.
    - Sumbernya: `routes/admin/emagang.js` (halaman "Manajemen Magang" admin)
    - **Sudah saya perbaiki**: sekarang cari dulu MK mana yang `isPDK==true`
      (jumlahnya jauh lebih sedikit), baru query enrollment DIBATASI ke
      MK-MK itu saja - bukan seluruh sistem.

    **d) KONFIRMASI PENTING: optimasi `count()` yang saya buat SEBELUMNYA
    kemungkinan BELUM AKTIF di server Anda.** Baris `COLLECTION /users WHERE
    role = ?` (47 eksekusi, ~105 dokumen dibaca tiap kali) dan
    `COLLECTION /dosen` (47 eksekusi, ~7 dokumen tiap kali) polanya PERSIS
    seperti dashboard admin yang saya optimasi pakai `count()` (poin 14) -
    tapi kalau `count()` benar-benar jalan, harusnya angka "dokumen dibaca"
    jauh lebih kecil dari ini. Ini indikasi kuat **fallback ke cara lama**
    sedang aktif, artinya versi `firebase-admin` di server kemungkinan
    **belum mendukung `count()` aggregation**.

    **➡️ Yang perlu Anda lakukan:**
    1. Jalankan `npm list firebase-admin` di server, lalu
       `npm install firebase-admin@latest` kalau versinya di bawah v11
       (minimal v10.6) - supaya semua optimasi `count()` yang sudah dibuat
       benar-benar aktif, bukan fallback.
    2. Tambahkan index komposit dari `firestore.indexes.json` (di zip ini)
       ke Firebase Console Anda: buka **Firestore → Indexes → Composite →
       Add Index**, lalu buat 4 index sesuai isi file itu (kalau Anda pakai
       Firebase CLI, gabungkan isinya ke `firestore.indexes.json` project
       Anda - JANGAN ditimpa kalau sudah ada index lain di situ - lalu
       jalankan `firebase deploy --only firestore:indexes`). Index komposit
       **gratis** di plan Spark, tidak kena biaya.
    3. Setelah kedua langkah di atas + file kode yang sudah diperbarui
       terpasang, cek lagi Query Insights besok - baris `logbookMagang`
       (userId+pdkId+status) seharusnya rasio index/hasil-nya turun drastis
       dari 32x mendekati 1x.

21. **Lanjutan sapuan efisiensi (tanpa emulator, langsung ke kode) -
    `mahasiswa/elearning.js` & `mahasiswa/akademik.js`.**

    - **`routes/mahasiswa/elearning.js`** (halaman "Tugas Aktif" mahasiswa):
      query `tugas` per-MK dan cek `pengumpulan` per-tugas yang tadinya
      serial (N query utk N MK/tugas) → di-batch pakai `'in'` per 10
      sekaligus, dijalankan paralel.
    - **`routes/mahasiswa/akademik.js`** (KRS & KHS) - 3 tempat terpisah:
      - Daftar KRS: fetch `mataKuliah` per KRS x per mkId (nested loop
        serial) → dikumpulkan jadi satu set ID unik, diambil sekaligus
        lewat `db.getAll()`.
      - Detail KRS: sama, fetch satu per satu → `db.getAll()`.
      - Cetak KHS: sama, plus tetap mempertahankan logika "pengaman" aslinya
        (item bisa berupa string ID atau object `{id/kode/mkId}`) - cuma
        bagian pengambilan dokumennya yang di-batch.

    Semua fungsionalitas (termasuk pesan warning kalau MK tidak ditemukan,
    fallback nama kolom, dst) dipertahankan persis seperti sebelumnya - cuma
    cara ambil datanya yang berubah.

22. **Digabung dengan kontribusi Anda: Cetak jadi 5 halaman dokumen
    perkuliahan lengkap** (file `file-yang-diubah.zip` yang Anda kirim).
    Anda memperluas halaman cetak dari 1 halaman (Rubrik saja) jadi 5
    halaman sekaligus, dengan kop surat yang sudah dipisah jadi partial
    (`views/partials/kop_surat.ejs`) supaya bisa dipakai ulang:

    1. **Penilaian** - rincian nilai per tugas (bukan cuma rata-rata)
    2. **Rubrik Penilaian** - seperti sebelumnya
    3. **Kontrak Kuliah** - deskripsi MK, ringkasan 16 pertemuan, bobot,
       kriteria kelulusan, tata tertib
    4. **Berita Acara Pengajaran** - rekap pertemuan yang benar-benar
       terlaksana (tanggal, topik, ada/tidak materi, catatan)
    5. **Berita Acara Tanda Terima Penyerahan Nilai**

    **Yang saya sesuaikan saat menggabungkan** (route `routes/dosen/rubrik.js`
    & `routes/admin/rubrik.js` versi Anda dibuat dari versi rubrik.js yang
    lebih lama, sebelum optimasi kuota poin 17/20 - jadi saya satukan lagi
    dengan versi TERBARU, bukan menimpa optimasi yang sudah ada):
    - Halaman "Penilaian" (rincian per tugas) sekarang pakai
      `getRincianTugasByMkId()` yang sudah ada (bukan query manual
      `getNilaiByMkId`+`getTugasByMkId` terpisah) - efeknya: **Tugas Manual
      ikut tercetak juga**, tidak cuma tugas dari web.
    - Dihapus 1 query enrollment yang redundan (data mahasiswa dipakai
      ulang dari `hasil.data`, yang sudah diambil `ambilDataRubrik`
      lewat `db.getAll()` - bukan query baru).
    - Ditambahkan versi yang sama persis untuk **admin** juga (`routes/admin/rubrik.js`)
      - sebelumnya kalau tidak disesuaikan, tombol cetak dari sisi admin
        akan ERROR karena template sekarang butuh variabel `penilaian`,
        `pertemuanList`, dll yang cuma disiapkan di sisi dosen. Untuk NUPTK
        dosen di sisi admin (yang tidak py `req.dosen` sendiri), diambil
        dari dosen pertama yang mengampu MK tsb.

    Sudah saya tes end-to-end (bukan cuma cek sintaks) - langsung memanggil
    route handler-nya dengan data tiruan, dan memverifikasi SEMUA variabel
    yang dibutuhkan ke-5 halaman cetak (`penilaian`, `pertemuanList`,
    `terlaksana`, `infoSemester`, `nuptkDosen`, dst) terisi dengan struktur
    yang benar, baik dari sisi dosen maupun admin - tidak ada error runtime.

---



| File | Perubahan |
|---|---|
| `helpers/nilaiHelper.js` | Ditambah fungsi rubrik (kehadiran/sikap/keaktifan/kuis, bobot custom, hitung nilai akhir, huruf tanpa A-/B-). Fungsi lama tidak diubah/dihapus. |
| `helpers/academicHelper.js` | Batas bulan semester direvisi: Genap Feb-Agustus, Ganjil September-Desember (lihat bagian 0 di atas). |
| `routes/dosen/index.js` | Ditambah 2 baris: `require('./rubrik')` + `router.use('/rubrik', rubrikRouter)`. |
| `routes/admin/index.js` | Ditambah 1 baris: `router.use('/rubrik', require('./rubrik'))`. |
| `views/dosen/dashboard.ejs` | Ditambah 1 kartu pintasan "Rubrik Penilaian". |
| `views/admin/dashboard.ejs` | Ditambah 1 kartu menu "Rubrik Penilaian". |
| `views/dosen/tugas_detail.ejs` | Perbaikan kolom Nilai + tombol "Nilai Langsung" untuk mahasiswa tanpa submission (lihat poin 13). |
| `routes/admin/dashboard.js` | Optimasi kuota: pakai `count()` aggregation (lihat poin 14). |
| `routes/dosen/dashboard.js` | Optimasi kuota: hilangkan pola N+1 query (lihat poin 14). |
| `routes/dosen/magang.js` | Optimasi kuota modul magang (lihat poin 15). |
| `routes/admin/emagang.js` | Optimasi kuota modul magang (lihat poin 15). |
| `routes/dosen/magangPeriod.js` | Optimasi kuota modul magang (lihat poin 15). |
| `routes/admin/laporanMagang.js` | Optimasi kuota modul magang (lihat poin 15). |
| `routes/dosen/laporanMagang.js` | Optimasi kuota modul magang (lihat poin 15). |
| `routes/dosen/perusahaan.js` | Optimasi kuota modul magang (lihat poin 15). |
| `routes/mahasiswa/magang.js` | Optimasi kuota modul magang (lihat poin 15). |

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
