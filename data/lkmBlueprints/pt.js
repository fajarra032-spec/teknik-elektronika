// Peralatan Teknik (pt-01 .. pt-06): isian berbasis identifikasi perkakas, hasil kerja bangku, dan dimensi.
const { tb, gb, gr, kd, ru, tn, ck, fm, al, ft, rb, du, tg, ba, ru1, HAL } = require('./_h');
module.exports = {
  'pt-01': [
    ck('Tata tertib dan prosedur K3 bengkel yang dipahami', ['Memakai APD sebelum masuk area kerja', 'Mengetahui letak APAR dan kotak P3K', 'Mengetahui jalur dan titik kumpul darurat', 'Tidak bercanda atau berlari di bengkel', 'Perkakas dikembalikan ke tempatnya', 'Melaporkan kerusakan alat kepada pembimbing']),
    tb('Pengenalan perkakas tangan', ['Perkakas', 'Jenis / ukuran yang ditemui', 'Fungsi', 'Cara pakai yang aman'], { rl: ['Obeng', 'Tang', 'Kunci pas / ring', 'Palu'], w: [18, 24, 28, null], rh: 32 }),
    tb('APD yang dipakai', ['APD', 'Dipakai saat pekerjaan', '[]Dipakai hari ini'], { n: 4, rh: 22, w: [28, null, 18], no: false }),
    tb('Latihan penggunaan perkakas', ['Pekerjaan', 'Perkakas yang dipilih', 'Hasil', 'Potensi bahaya yang dicegah'], { n: 3, rh: 28, no: false }),
    ru('Kesimpulan pentingnya APD dan prosedur K3', 3),
  ],
  'pt-02': [
    tb('Latihan membaca skala jangka sorong', ['Soal', 'Skala utama (mm)', 'Skala nonius (mm)', 'Hasil bacaan (mm)'], { n: 4, rh: 22 }),
    tb('Latihan membaca skala mikrometer', ['Soal', 'Skala utama (mm)', 'Skala putar (mm)', 'Hasil bacaan (mm)'], { n: 4, rh: 22 }),
    tb('Pengukuran benda kerja', ['Benda kerja', 'Dimensi yang diukur', 'Jangka sorong (mm)', 'Mikrometer (mm)', 'Selisih (mm)'], { n: 5, rh: 24, w: [20, 24, 18, 18, null], no: false }),
    ba('Ketelitian alat', ['Ketelitian jangka sorong (mm)', 'Ketelitian mikrometer (mm)', 'Alat yang lebih teliti untuk benda ini']),
    ck('Pemeriksaan sebelum mengukur', ['Titik nol jangka sorong diperiksa', 'Titik nol mikrometer diperiksa', 'Permukaan benda bersih', 'Rahang tidak dipaksa menekan benda']),
    ru('Kesimpulan perbandingan ketelitian dan kegunaan', 3),
  ],
  'pt-03': [
    gb('Gambar kerja benda yang dikerjakan', 120, { bg: 'grid', cap: 'Salin gambar dan ukuran target' }),
    tb('Tahapan pengerjaan', ['Tahap', 'Perkakas', 'Ukuran target (mm)', 'Ukuran hasil (mm)', 'Selisih (mm)', '[]Sesuai'], { rl: ['Mencekam benda di ragum', 'Memotong dengan gergaji', 'Mengikir permukaan', 'Membuat ulir dalam (tap)', 'Membuat ulir luar (snei)'], w: [26, 18, 14, 14, 14, null], rh: 26 }),
    tb('Uji kesesuaian ulir', ['Ulir', 'Ukuran', 'Uji pasang baut / mur', 'Hasil'], { rl: ['Ulir dalam', 'Ulir luar'], w: [20, 20, null, null], rh: 26 }),
    ck('Keselamatan kerja bangku', ['Benda tercekam kuat sebelum dipotong', 'Kacamata pelindung dipakai', 'Serpihan dibersihkan dengan kuas', 'Tangan tidak berada di arah gerak gergaji']),
    ft('Dokumentasi benda kerja', ['Hasil pemotongan', 'Hasil pengikiran', 'Hasil ulir']),
    ru('Kendala dan kesimpulan ketepatan ukuran', 3),
  ],
  'pt-04': [
    tg('Prosedur aman tiap alat', [{ k: 'tabel', j: 'Bor listrik', cols: ['Pemeriksaan', '[]'], rl: ['Mata bor terpasang kuat', 'Benda dijepit', 'Kecepatan sesuai bahan'], w: [78, null], rh: 24 }, { k: 'tabel', j: 'Gerinda tangan', cols: ['Pemeriksaan', '[]'], rl: ['Pelindung terpasang', 'Arah percikan aman', 'Kacamata dipakai'], w: [78, null], rh: 24 }, { k: 'tabel', j: 'Solder listrik', cols: ['Pemeriksaan', '[]'], rl: ['Dudukan solder ada', 'Ventilasi cukup', 'Kabel tidak menyentuh ujung solder'], w: [78, null], rh: 24 }]),
    tb('Hasil pekerjaan', ['Pekerjaan', 'Alat', 'Ukuran target', 'Hasil', 'Kendala'], { rl: ['Lubang pada benda kerja', 'Pemotongan / penghalusan logam', 'Penyolderan pada PCB'], w: [28, 14, 16, 16, null], rh: 30 }),
    tb('Kualitas sambungan solder', ['Sambungan', '[]Mengkilap', '[]Tidak dingin', '[]Tidak hubung singkat'], { n: 5, rh: 22, w: [16, 28, 28, null] }),
    ft('Dokumentasi', ['Hasil bor', 'Hasil gerinda', 'Hasil solder']),
    ru('Tantangan dan tips penggunaan aman', 3),
  ],
  'pt-05': [
    tb('Inspeksi kondisi perkakas', ['Perkakas', 'Kondisi (karat / aus / rusak)', 'Tindakan', '[]Layak pakai'], { n: 5, rh: 24, w: [24, 32, null, 14], no: false }),
    tb('Cek titik nol alat ukur', ['Alat', 'Bacaan saat tertutup', 'Koreksi', '[]Layak'], { rl: ['Jangka sorong', 'Mikrometer'], w: [30, null, null, 14], rh: 28 }),
    tb('Daftar periksa perawatan rutin', ['Peralatan', 'Item yang diperiksa', 'Frekuensi', '[]Dilakukan'], { n: 6, rh: 22, w: [24, 40, 18, null], no: false }),
    tb('Penyimpanan peralatan', ['Peralatan', 'Tempat penyimpanan', 'Kondisi / syarat penyimpanan'], { n: 4, rh: 24, no: false }),
    ru('Kesimpulan pentingnya perawatan dan penyimpanan', 3),
  ],
  'pt-06': [
    fm('Identitas benda kerja', ['Nama benda', 'Bahan', 'Nama kelompok', 'Anggota dan NIM']),
    gb('Gambar kerja yang diacu', 150, { bg: 'grid', cap: 'Salin gambar kerja dan ukuran target' }),
    tb('Rencana dan realisasi pengerjaan', ['Tahap', 'Perkakas', 'Waktu rencana (menit)', 'Waktu realisasi (menit)', '[]Selesai'], { rl: ['Memotong bahan', 'Membentuk dengan kikir', 'Membor lubang', 'Menghaluskan dan membersihkan', 'Mengukur dimensi akhir'], w: [30, 22, 16, 16, null], rh: 24 }),
    HAL,
    tb('Verifikasi dimensi akhir', ['Dimensi', 'Target (mm)', 'Toleransi (+/-)', 'Hasil ukur (mm)', '[]Lulus'], { n: 6, rh: 24, w: [26, 18, 18, 20, null], no: false }),
    ck('Penerapan K3 selama kerja', ['APD dipakai sepanjang kerja', 'Benda tercekam kuat', 'Area kerja bersih', 'Alat dikembalikan dan dirawat']),
    ft('Dokumentasi tahapan', ['Setelah dipotong', 'Setelah dibentuk', 'Hasil akhir']),
    rb('Penilaian hasil (diisi dosen)', [['Ketepatan dimensi', '35'], ['Kerapian dan kualitas permukaan', '20'], ['Penerapan K3', '20'], ['Ketepatan waktu dan dokumentasi', '15'], ['Refleksi dan presentasi', '10']]),
    ru('Refleksi kendala, K3, dan pembelajaran', 3),
  ],
};
