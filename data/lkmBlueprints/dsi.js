// Data dan Sistem Informasi (dsi-01 .. dsi-06): isian berbasis diagram, struktur tabel, dan query.
const { tb, gb, gr, kd, ru, tn, ck, fm, al, ft, rb, du, tg, ba, ru1, HAL } = require('./_h');
module.exports = {
  'dsi-01': [
    fm('Studi kasus sistem pencatatan yang diamati', ['Nama sistem pencatatan', 'Lokasi / unit', 'Pemakai utama', 'Jenis data yang dicatat']),
    tb('Dari data mentah menjadi informasi', ['Data mentah', 'Proses pengolahan', 'Informasi yang dihasilkan', 'Dipakai untuk'], { n: 4, rh: 28, no: false }),
    al('Komponen sistem', ['Masukan', 'Proses', 'Keluaran', 'Penyimpanan', 'Umpan balik'], 56),
    gb('Diagram alur data sederhana', 150, { bg: 'dot', cap: 'Gambar aliran: sumber data - proses - hasil' }),
    tb('Masalah pencatatan manual / tidak terstruktur', ['Masalah', 'Contoh nyata', 'Dampak', 'Usulan perbaikan'], { n: 3, rh: 32, no: false }),
    ru('Kesimpulan pentingnya sistem informasi terstruktur', 3),
  ],
  'dsi-02': [
    tb('Daftar entitas dan atribut', ['Entitas', 'Atribut (garis bawahi primary key)'], { n: 4, rh: 32, w: [24, null], no: false }),
    gb('Entity Relationship Diagram (ERD)', 220, { bg: 'dot', cap: 'Gambar entitas, atribut, relasi, dan kardinalitas' }),
    tb('Relasi dan kardinalitas', ['Entitas A', 'Relasi', 'Entitas B', 'Kardinalitas', 'Alasan'], { n: 4, rh: 26, no: false, w: [20, 18, 20, 14, null] }),
    ck('Pemeriksaan ERD', ['Setiap entitas memiliki primary key', 'Atribut tidak ganda / bercabang', 'Relasi banyak-ke-banyak telah dipecah', 'Penamaan konsisten', 'Tidak ada relasi yang janggal', 'ERD sudah direvisi bersama dosen']),
    ru('Kesimpulan tantangan merancang ERD', 3),
  ],
  'dsi-03': [
    tb('Struktur tabel hasil rancangan ERD', ['Nama kolom', 'Tipe data', 'Panjang', 'Kunci (PK / FK)', '[]Wajib diisi'], { n: 6, rh: 22, no: false, w: [30, 20, 12, 22, 16] }),
    kd('Perintah pembuatan tabel dan pengisian data', 110, 'CREATE TABLE ... / INSERT INTO ...'),
    tb('Latihan perintah SQL', ['Jenis perintah', 'Perintah yang dijalankan', 'Hasil / jumlah baris', '[]Berhasil'], { rl: ['SELECT semua data', 'SELECT dengan WHERE', 'INSERT', 'UPDATE', 'DELETE', 'ORDER BY', 'JOIN dasar'], w: [22, 44, 20, 14], rh: 26 }),
    gb('Tangkapan layar hasil query', 100, { cap: 'Tempel hasil SELECT' }),
    ru('Kesimpulan kegunaan tiap jenis perintah SQL', 3),
  ],
  'dsi-04': [
    tb('Tabel belum ternormalisasi (salin dari bahan latihan)', ['Kolom 1', 'Kolom 2', 'Kolom 3', 'Kolom 4', 'Kolom 5'], { n: 4, no: false, rh: 24 }),
    tb('Masalah yang ditemukan', ['Jenis masalah', 'Contoh pada tabel', 'Penyebab'], { rl: ['Duplikasi data', 'Anomali ubah', 'Anomali hapus', 'Anomali tambah'], w: [24, null, null], rh: 24 }),
    tg('Hasil tiap tahap normalisasi', [{ k: 'gambar', j: '1NF', h: 120 }, { k: 'gambar', j: '2NF', h: 120 }, { k: 'gambar', j: '3NF', h: 120 }]),
    tb('Struktur tabel akhir dan relasinya', ['Tabel', 'Primary key', 'Foreign key', 'Berelasi dengan'], { n: 4, rh: 24, no: false }),
    kd('Query JOIN untuk menggabungkan tabel', 80, 'SELECT ... FROM ... JOIN ...'),
    ru('Kesimpulan manfaat normalisasi bagi kualitas data', 3),
  ],
  'dsi-05': [
    tb('Tabel rekap hasil query', ['Kategori', 'Jumlah', 'Persentase (%)', 'Keterangan'], { n: 6, rh: 22 }),
    tb('Pemilihan jenis grafik', ['Jenis grafik', 'Cocok untuk data', '[]Dipilih', 'Alasan'], { rl: ['Batang', 'Garis', 'Lingkaran', 'Sebar'], w: [22, 34, 12, null], rh: 22 }),
    gr('Grafik hasil visualisasi', 170, 'Kategori', 'Jumlah', {}),
    ru('Narasi analisis laporan singkat', 6, { note: 'Tulis temuan utama, perbandingan, dan usulan keputusan yang didukung data.' }),
    tn('Pertanyaan analisis', ['Keputusan apa yang dapat diambil dari ringkasan data ini?', 'Apa keunggulan grafik dibanding tabel data mentah?'], 2),
  ],
  'dsi-06': [
    fm('Identitas proyek', ['Nama sistem informasi', 'Studi kasus', 'Nama kelompok', 'Anggota dan NIM']),
    tb('Kebutuhan data', ['Entitas', 'Atribut utama', 'Informasi yang dibutuhkan pengguna'], { n: 4, rh: 28, no: false }),
    gb('ERD sistem', 190, { bg: 'dot' }),
    tb('Struktur tabel pada basis data', ['Tabel', 'Kolom dan tipe data', 'PK / FK'], { n: 4, rh: 32, no: false }),
    HAL,
    kd('Kumpulan query kebutuhan informasi', 140, 'Tulis 3-5 query beserta tujuannya'),
    gb('Contoh laporan / visualisasi data keluaran', 140, { cap: 'Tempel hasil laporan' }),
    ft('Dokumentasi demonstrasi', ['Tampilan data', 'Hasil query', 'Presentasi']),
    rb('Penilaian proyek (diisi dosen)', [['Rancangan ERD dan tabel', '30'], ['Query dan hasilnya', '25'], ['Laporan / visualisasi', '20'], ['Dokumentasi', '10'], ['Demonstrasi', '15']]),
    ru('Refleksi kendala dan solusi', 3),
  ],
};
