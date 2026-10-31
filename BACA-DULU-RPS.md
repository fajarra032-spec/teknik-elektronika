# Tab RPS pada kelas dosen (setelah tab Tugas)

Salin isi folder ini ke root proyek (timpa/merge), lalu restart server.
Tidak ada package baru dan tidak ada indeks Firestore baru.

| File | Status |
|---|---|
| helpers/rpsHelper.js | BARU - default RPS, identitas Kaprodi, pengolah form |
| data/rpsDetail/index.js | BARU - penggabung + validasi rincian per pertemuan |
| data/rpsDetail/sem1.js, sem2.js, sem3a.js, sem3b.js | BARU - judul, butir dasar, Sub-CPMK, indikator |
| data/rpsDetail/tambahan1.js, tambahan2.js, tambahan3a.js, tambahan3b.js | BARU - butir materi tambahan + kegiatan |
| views/dosen/mk_rps.ejs | BARU - halaman edit (tab RPS) |
| views/dosen/mk_rps_cetak.ejs | BARU - halaman cetak A4 landscape |
| routes/dosen/mk.js | diubah - rute GET/POST /:id/rps, POST /:id/rps/reset, GET /:id/rps/cetak |
| views/dosen/partials/mk_tabs.ejs | diubah - tab "RPS" setelah "Tugas" |

## Rincian per pertemuan (data/rpsDetail)
- 25 mata kuliah x 14 pertemuan materi = 350 rincian (berlaku untuk 29 kode MK). P8 = UTS, P16 = UAS.
- Tiap pertemuan: judul spesifik, rata-rata 6 butir pokok bahasan (rumus, contoh, alat, aturan),
  Sub-CPMK, indikator penilaian, dan satu baris "Kegiatan:" (praktik/tugas/diskusi).
- Pokok Bahasan di bagian atas RPS otomatis disusun dari judul 14 pertemuan.
- Topik besar, urutan, metode, dan bobot TETAP dari RPS resmi (data/rencanaPertemuanData.js).
- Antena & Propagasi dan Keamanan Siber masih DRAFT di data resmi: rincian mengikuti urutan topik
  draft; cocokkan dengan RPS resmi.
- Mengubah isi: edit sem*.js (judul/butir dasar/Sub-CPMK/indikator) dan tambahan*.js (butir tambahan
  + kegiatan); 14 entri per MK urut P1-7 lalu P9-15. index.js memvalidasi jumlah entri saat start
  dan membuang butir yang duplikat.
- RPS yang SUDAH disimpan dosen sebelum update ini tidak berubah otomatis; gunakan tombol
  "Kembalikan ke Default" untuk memuat rincian baru.

## Cara kerja
- Dosen mengedit semua bagian lalu Simpan -> Firestore mataKuliah/{id}/rps/utama
  (satu dokumen per MK, dipakai bersama dosen pengampu, dibawa ke semester berikutnya).
- Cetak: /dosen/mk/:id/rps/cetak (A4 landscape, margin 2,54 cm, Arial 10pt, biru #9CC3E5).
  Di dialog cetak aktifkan "Background graphics".
- Kaprodi (nama, NUPTK, /images/ttd.png) dari sumber yang sama dengan SK/surat
  (konstanta KAPRODI di helpers/rpsHelper.js).
