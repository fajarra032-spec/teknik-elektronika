# Tab RPS pada kelas dosen (setelah tab Tugas)

Salin isi folder ini ke root proyek (timpa/merge), lalu restart server.
Tidak ada package baru dan tidak ada indeks Firestore baru.

| File | Status |
|---|---|
| helpers/rpsHelper.js | BARU - default RPS, identitas Kaprodi, pengolah form |
| views/dosen/mk_rps.ejs | BARU - halaman edit (tab RPS) |
| views/dosen/mk_rps_cetak.ejs | BARU - halaman cetak A4 landscape |
| routes/dosen/mk.js | diubah - 4 rute: GET/POST /:id/rps, POST /:id/rps/reset, GET /:id/rps/cetak |
| views/dosen/partials/mk_tabs.ejs | diubah - tab "RPS" setelah "Tugas" |

## Cara kerja
- Isi awal: 16 pertemuan (topik, kemampuan, metode, bobot) dari data/rencanaPertemuanData.js.
- Dosen mengedit semua bagian, lalu Simpan. Tersimpan di Firestore: mataKuliah/{id}/rps/utama
  (satu dokumen per MK, dipakai bersama dosen pengampu, dibawa ke semester berikutnya).
- "Kembalikan ke Default" menghapus dokumen itu.
- Cetak: /dosen/mk/:id/rps/cetak (A4 landscape, margin 2,54 cm, Arial 10pt, biru #9CC3E5).
  Di dialog cetak aktifkan "Background graphics".
- Kaprodi (nama, NUPTK, /images/ttd.png) diambil dari sumber yang sama dengan SK/surat
  (konstanta KAPRODI di helpers/rpsHelper.js; ubah di sana jika Kaprodi berganti).
