# Perapian cetak LKM Standarisasi (std-01 .. std-08)

Isi dan format tiap LKM Standarisasi tidak diubah. Yang dirapikan hanya tata letak cetak, karena dengan
Bootstrap asli (line-height 1,5) 6 dari 8 LKM punya halaman terakhir yang hanya berisi blok tanda tangan.

| File | Perubahan |
|---|---|
| views/lkm_std02..std08_print.ejs | `<head>` menyertakan `partials/lkm_mkplc_extra` (line-height 1,2 dan jarak lebih rapat) |
| views/lkm_std01_print.ejs | Style tambahan `body { line-height: 1.2; }` (file ini punya CSS sendiri) |
| views/lkm_std08_print.ejs | Tinggi baris tabel checklist audit diperkecil (t40 menjadi t30) agar butir ke-10 tidak tumpah ke halaman 2 |

Jumlah halaman cetak sekarang: STD-01: 4, STD-02: 2, STD-03: 2, STD-04: 2, STD-05: 2, STD-06: 2, STD-07: 3, STD-08: 2.
Sebelumnya: 6, 3, 3, 2, 4, 4, 3, 4 (sebagian hanya berisi tanda tangan).

Rollback: kembalikan lkm_std01..08_print.ejs dari versi sebelumnya.
