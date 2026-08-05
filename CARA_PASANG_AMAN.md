# Cara Pasang yang Aman

Panduan ini melengkapi `RUBRIK_INTEGRASI.md`. Tujuannya satu: supaya kalau
ada yang tidak beres, Anda tahu persis di langkah mana masalahnya, dan bisa
mundur (rollback) dengan cepat - bukan menebak-nebak dari 20+ file sekaligus.

## Langkah 0 - Backup (wajib, sebelum apa pun)

```bash
# Dari root project Anda (folder yang sejajar dengan config/, routes/, helpers/)
node scripts/backup-collections.js
```

Ini membuat folder `backup-2026-08-05_.../` berisi salinan JSON dari semua
koleksi yang disentuh pembaruan ini. Read-only, tidak menyentuh data asli
sama sekali. Simpan folder ini di tempat aman (bukan di folder yang sama
yang nanti mungkin ikut ter-*deploy*).

## Langkah 0.5 - Verifikasi kondisi data SEKARANG (sebelum pasang apa pun)

```bash
node scripts/verifikasi-sebelum-pasang.js
```

Ini kasih tahu Anda: berapa banyak dokumen nilai duplikat, tugas yang
periode-nya drift, dan tugas "salah MK" yang SUDAH ADA di data Anda **saat
ini juga**, terlepas dari pembaruan apa pun. Ini murni membaca, jadi aman
dijalankan kapan saja. Simpan hasilnya (screenshot/copy teks) untuk
dibandingkan nanti.

## Langkah 1 - Pasang yang PALING AMAN dulu (murni baca data)

Ini golongan risiko paling rendah karena tidak pernah menulis apa pun ke
database, cuma mengubah cara mengambil data:

1. `helpers/academicHelper.js`
2. `routes/admin/dashboard.js`
3. `routes/dosen/dashboard.js`
4. `routes/mahasiswa/dashboard.js`

Pasang keempatnya, restart server, buka dashboard admin/dosen/mahasiswa
masing-masing satu kali, pastikan angka-angka yang tampil masuk akal
(jumlah mahasiswa, jumlah MK, dll - bandingkan dengan yang Anda tahu
seharusnya). Kalau ada yang aneh, gampang dikembalikan (tinggal timpa lagi
dengan file lama, tidak ada data yang berubah).

## Langkah 2 - Fitur Rubrik & Rincian Tugas (baca + tulis field baru)

File: `helpers/nilaiHelper.js`, `routes/dosen/rubrik.js`,
`routes/admin/rubrik.js`, semua `views/.../rubrik_*.ejs`,
`views/dosen/dashboard.ejs`, `views/admin/dashboard.ejs`.

Ini menambah field BARU (`catatan`, koleksi `rubrikBobot`, `tugasManual`) -
tidak pernah menghapus/menimpa data lama. Setelah pasang:
- Jalankan `node scripts/verifikasi-sebelum-pasang.js` lagi.
- Buka Rubrik untuk **satu** MK dulu, input satu nilai, cek hasilnya benar.
- Baru pakai untuk MK lain.

## Langkah 3 - Fix duplikat nilai & tugas detail (`routes/dosen/index.js`,
`views/dosen/tugas_detail.ejs`)

Ini yang mengandung logika **pembersihan duplikat** (satu-satunya bagian
yang melakukan `.delete()` pada data lama). Sebelum pasang:
- Pastikan Langkah 0 & 0.5 sudah dilakukan HARI INI (bukan minggu lalu).
- Setelah pasang, buka satu tugas yang Anda tahu SEBELUMNYA bermasalah,
  cek nilainya tampil benar.
- Jalankan `node scripts/verifikasi-sebelum-pasang.js` sekali lagi - angka
  "Nilai duplikat" harusnya mulai turun (berkurang seiring dokumen itu
  diakses/dinilai ulang lewat aplikasi, bukan langsung nol seketika).

## Langkah 4 - Modul Magang (admin/dosen/mahasiswa) & tombol "Setujui 1 Minggu"

File-file `routes/*/magang*.js`, `routes/*/laporanMagang.js`,
`routes/*/perusahaan.js`, `routes/*/emagang.js`, `views/.../magang_detail.ejs`,
`views/admin/emagang_mahasiswa.ejs`, `views/mahasiswa/magang/logbook.ejs`.

Tombol "Setujui 1 Minggu" MENULIS data (mengubah status logbook jadi
approved). Sebelum dipakai pertama kali:
- Coba dulu di SATU mahasiswa yang logbooknya memang siap disetujui.
- Cek di halaman mahasiswa, logbook itu benar berubah status + ada catatan.

## Langkah 5 - Index Firestore

Tambahkan index dari `firestore.indexes.json` lewat Firebase Console
(Firestore → Indexes → Composite → Add Index) atau `firebase deploy
--only firestore:indexes`. Ini di GCP, bukan di kode aplikasi - tidak ada
risiko ke data sama sekali, cuma mempercepat query yang sudah ada. Aman
dilakukan kapan saja, bahkan sebelum langkah 1.

## Kalau ada yang tidak beres (rollback)

- **Kode**: timpa lagi file yang bermasalah dengan versi lama Anda (kalau
  pakai git, `git checkout -- <file>` per file yang barusan diganti - ini
  kenapa memasang bertahap per-langkah lebih aman daripada sekaligus).
- **Data**: file JSON dari Langkah 0 ada di folder `backup-.../` - untuk
  memulihkan, perlu ditulis manual balik ke Firestore (skrip restore tidak
  disertakan di sini karena restore lebih berisiko daripada backup - kalau
  sampai perlu, kabari saya, saya bantu buatkan skrip restore yang hati-hati
  dan spesifik ke koleksi yang bermasalah saja).
