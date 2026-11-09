// Perawatan dan Perbaikan (pp-01 .. pp-07): isian berbasis kartu riwayat, diagnosa, dan laporan perbaikan.
const { tb, gb, gr, kd, ru, tn, ck, fm, al, ft, rb, du, tg, ba, ru1, HAL } = require('./_h');
module.exports = {
  'pp-01': [
    tb('Jenis perawatan', ['Jenis', 'Pengertian singkat', 'Penerapan pada alat yang dipilih', '[]Cocok'], { rl: ['Preventif', 'Korektif', 'Prediktif'], w: [20, 34, null, 10], rh: 34 }),
    fm('Kartu riwayat perawatan: identitas alat', ['Nama alat', 'Merek / tipe', 'Nomor seri', 'Lokasi', 'Tanggal pengadaan', 'Kondisi awal']),
    tb('Riwayat perawatan', ['Tanggal', 'Jenis perawatan', 'Tindakan', 'Teknisi', 'Keterangan'], { n: 5, rh: 24, no: false }),
    tb('Jadwal perawatan preventif', ['Kegiatan', 'Frekuensi', 'Penanggung jawab', '[]Dilakukan'], { n: 5, rh: 22, w: [40, 18, 24, null], no: false }),
    ru('Konsekuensi bila perawatan preventif diabaikan', 3),
  ],
  'pp-02': [
    fm('Gejala awal kerusakan', ['Rangkaian / alat uji', 'Gejala yang diamati', 'Kondisi saat gejala muncul', 'Tanggal']),
    tb('Inspeksi visual', ['Bagian', 'Temuan', 'Dugaan'], { n: 4, rh: 24, no: false }),
    al('Metode half-split', ['Seluruh rangkaian', 'Bagi dua pada titik tengah', 'Titik tengah normal?', 'Lanjut ke sisi bermasalah'], 52),
    tb('Pengukuran titik kunci', ['Titik uji', 'Nilai seharusnya (V)', 'Nilai terukur (V)', 'Selisih', 'Kesimpulan'], { n: 6, rh: 22, w: [20, 20, 20, 14, null], no: false }),
    tb('Verifikasi komponen yang diduga rusak', ['Komponen', 'Cara uji', 'Hasil', '[]Rusak'], { n: 3, rh: 24, w: [26, 30, null, 10], no: false }),
    ru('Kesimpulan komponen rusak dan alasan diagnosa', 3),
  ],
  'pp-03': [
    ck('Pemeriksaan visual catu daya', ['Kapasitor tidak menggembung / bocor', 'Sekring tidak putus', 'Solderan tidak retak / dingin', 'Komponen tidak gosong', 'Kabel dan konektor baik', 'Heatsink terpasang kuat']),
    du('Pengukuran output', { k: 'tabel', j: 'Sebelum perbaikan', cols: ['Beban', 'Vout (V)', 'Vriak (mV)'], rl: ['Tanpa beban', 'Beban 50 %', 'Beban penuh'], w: [36, null, null], rh: 24 }, { k: 'tabel', j: 'Setelah perbaikan', cols: ['Beban', 'Vout (V)', 'Vriak (mV)'], rl: ['Tanpa beban', 'Beban 50 %', 'Beban penuh'], w: [36, null, null], rh: 24 }),
    tb('Diagnosa gangguan', ['Gejala', 'Dugaan penyebab', 'Cara uji', 'Hasil uji'], { n: 4, rh: 26, no: false }),
    tb('Komponen yang diganti', ['Kode', 'Komponen lama', 'Pengganti (spesifikasi)', 'Alasan penggantian'], { n: 3, rh: 26, no: false }),
    ru('Perbandingan kondisi sebelum dan sesudah perbaikan', 4),
  ],
  'pp-04': [
    fm('Peralatan yang diperbaiki', ['Nama peralatan', 'Merek / tipe', 'Gejala kerusakan', 'Daya / tegangan']),
    ck('Prosedur aman sebelum dan selama pembongkaran', ['Steker dicabut dari sumber listrik', 'Kapasitor besar dikosongkan', 'Alat dan area kerja kering', 'Posisi baut dicatat / difoto', 'Casing dibuka dengan perkakas yang tepat']),
    ft('Dokumentasi tahapan', ['Sebelum dibongkar', 'Kondisi bagian dalam', 'Setelah perbaikan']),
    tb('Diagnosa dan perbaikan', ['Bagian', 'Temuan', 'Tindakan perbaikan', 'Hasil'], { n: 4, rh: 28, no: false }),
    tb('Uji fungsi akhir', ['Fungsi diuji', 'Standar yang diharapkan', 'Hasil', '[]Lulus'], { n: 4, rh: 24, w: [28, 28, null, 10], no: false }),
    ru('Daftar komponen diperbaiki / diganti dan hasil pengujian', 3),
  ],
  'pp-05': [
    tb('Daftar periksa perawatan berkala', ['Peralatan', '[]Bersih', '[]Kabel / probe baik', '[]Konektor baik', '[]Verifikasi ukur', 'Tindak lanjut'], { n: 6, rh: 24, w: [24, 10, 14, 14, 14, null], no: false }),
    tb('Verifikasi keakuratan dasar alat ukur', ['Alat', 'Nilai acuan', 'Nilai terbaca', 'Selisih', '[]Layak'], { n: 3, rh: 26, no: false, w: [26, 20, 20, 16, null] }),
    tb('Peralatan yang perlu tindak lanjut', ['Peralatan', 'Masalah', 'Prioritas', 'Usulan tindakan'], { n: 4, rh: 26, no: false, w: [24, 30, 14, null] }),
    ru('Kesimpulan pentingnya perawatan berkala', 4),
  ],
  'pp-06': [
    tb('Kumpulan catatan perawatan dan perbaikan', ['No', 'Alat', 'Tanggal', 'Gejala', 'Tindakan'], { n: 5, rh: 24, w: [6, 24, 14, 26, null] }),
    fm('Kerangka laporan terstruktur', ['Identitas alat', 'Gejala awal', 'Tindakan perbaikan', 'Hasil akhir']),
    tb('Analisis pola kerusakan', ['Jenis kerusakan', 'Frekuensi', 'Penyebab umum', 'Pencegahan'], { n: 4, rh: 26, no: false }),
    tb('Pertimbangan repair atau replace', ['Kriteria', 'Alat A', 'Alat B', 'Keputusan'], { rl: ['Biaya perbaikan dibanding beli baru', 'Ketersediaan suku cadang', 'Usia dan kondisi alat', 'Risiko keselamatan', 'Dampak bila alat tidak berfungsi'], w: [36, 20, 20, null], rh: 26 }),
    gb('Kerangka presentasi laporan', 100, { cap: 'Poin utama yang akan dipresentasikan' }),
    ru('Kesimpulan kriteria repair atau replace', 3),
  ],
  'pp-07': [
    fm('Identitas studi kasus', ['Perangkat yang diperbaiki', 'Merek / tipe', 'Gejala awal', 'Nama kelompok']),
    al('Alur diagnosa dan perbaikan', ['Gejala', 'Inspeksi', 'Diagnosa', 'Perbaikan', 'Uji fungsi'], 52),
    tb('Catatan diagnosa sistematis', ['Langkah', 'Pemeriksaan', 'Hasil', 'Kesimpulan sementara'], { n: 5, rh: 26, w: [8, 34, 28, null] }),
    HAL,
    tb('Perbaikan yang dilakukan', ['Komponen / bagian', 'Tindakan', 'Pengganti / bahan', 'Hasil'], { n: 4, rh: 28, no: false }),
    tb('Uji fungsi terhadap spesifikasi awal', ['Fungsi', 'Spesifikasi', 'Hasil sesudah perbaikan', '[]Lulus'], { n: 4, rh: 24, w: [28, 28, null, 10], no: false }),
    ft('Dokumentasi sebelum dan sesudah', ['Kondisi sebelum', 'Proses perbaikan', 'Kondisi sesudah']),
    rb('Penilaian proyek (diisi dosen)', [['Ketepatan diagnosa', '30'], ['Kualitas perbaikan dan uji fungsi', '30'], ['Keselamatan kerja', '15'], ['Laporan dan dokumentasi', '15'], ['Presentasi', '10']]),
    ru('Refleksi kendala dan pembelajaran', 3),
  ],
};
