// Keselamatan dan Kesehatan Kerja (k3-01 .. k3-07): isian berbasis matriks risiko, denah, dan lembar audit.
const { tb, gb, gr, kd, ru, tn, ck, fm, al, ft, rb, du, tg, ba, ru1, HAL } = require('./_h');
module.exports = {
  'k3-01': [
    fm('Area yang diamati', ['Nama area / bengkel', 'Tanggal observasi', 'Jumlah orang di area', 'Jenis pekerjaan']),
    tb('Tabel HIRA (identifikasi bahaya dan penilaian risiko)', ['No', 'Potensi bahaya', 'Jenis', 'K', 'P', 'K x P', 'Tingkat', 'Pengendalian'], { n: 7, rh: 26, w: [5, 26, 12, 6, 6, 8, 10, null], note: 'K = tingkat keparahan (1-5), P = kemungkinan terjadi (1-5). Skor K x P menentukan tingkat risiko.' }),
    tb('Matriks risiko 5 x 5', ['P \\ K', '1', '2', '3', '4', '5'], { r: [['5', '5', '10', '15', '20', '25'], ['4', '4', '8', '12', '16', '20'], ['3', '3', '6', '9', '12', '15'], ['2', '2', '4', '6', '8', '10'], ['1', '1', '2', '3', '4', '5']], rh: 20, w: [16, null, null, null, null, null], note: 'Arsir: 1-4 rendah, 5-9 sedang, 10-16 tinggi, 20-25 ekstrem.' }),
    tb('Rekomendasi pengendalian untuk 3 bahaya prioritas', ['Prioritas', 'Bahaya', 'Hierarki yang dipakai', 'Rekomendasi'], { rl: ['1', '2', '3'], w: [14, 28, 24, null], rh: 30 }),
    ru('Kesimpulan pentingnya identifikasi bahaya sejak dini', 3),
  ],
  'k3-02': [
    tb('Jenis APD dan fungsinya', ['APD', 'Melindungi bagian', 'Standar / penanda', 'Contoh pekerjaan'], { rl: ['Helm pelindung', 'Kacamata pelindung', 'Sarung tangan', 'Sepatu keselamatan', 'Masker / respirator', 'Penyumbat telinga'], w: [24, 22, 24, null], rh: 24 }),
    tb('Studi kasus pemilihan APD', ['Pekerjaan', 'Bahaya utama', 'APD wajib', 'APD tambahan'], { n: 4, rh: 30, no: false }),
    ck('Cara memakai dan melepas APD yang benar', ['Memeriksa APD sebelum dipakai', 'Memakai sesuai urutan', 'Ukuran dan kekencangan pas', 'Melepas tanpa menyentuh bagian kotor', 'Mencuci tangan setelah melepas']),
    tb('Pemeriksaan kondisi APD', ['APD', 'Kondisi', '[]Layak', 'Alasan'], { n: 4, rh: 24, w: [24, 30, 12, null], no: false }),
    ru('Kesimpulan pentingnya penggunaan dan perawatan APD', 3),
  ],
  'k3-03': [
    du('Segitiga api dan klasifikasi', { k: 'gambar', j: 'Segitiga api (isi tiga unsurnya)', h: 120 }, { k: 'tabel', j: 'Klasifikasi kebakaran', cols: ['Kelas', 'Bahan terbakar', 'Media tepat'], rl: ['A', 'B', 'C', 'D'], w: [14, 40, null], rh: 24 }),
    tb('APAR yang ditemukan di lingkungan kampus', ['Lokasi', 'Jenis APAR', 'Kapasitas', 'Tekanan baik', 'Kedaluwarsa', '[]Sesuai'], { n: 4, rh: 24, w: [26, 18, 14, 14, 16, null], no: false }),
    al('Teknik PASS', ['Pull (tarik pin)', 'Aim (arahkan ke dasar api)', 'Squeeze (tekan tuas)', 'Sweep (sapukan)'], 50),
    gb('Denah APAR dan jalur evakuasi', 190, { bg: 'grid', cap: 'Tandai lokasi APAR, pintu keluar, dan jalur' }),
    ru('Langkah saat mendeteksi kebakaran di lingkungan kampus', 4),
  ],
  'k3-04': [
    tb('Isi kotak P3K', ['Isi', 'Fungsi', 'Jumlah ada', 'Kondisi / kedaluwarsa'], { rl: ['Perban', 'Plester', 'Kasa steril', 'Antiseptik', 'Gunting', 'Sarung tangan'], w: [20, 36, 16, null], rh: 22 }),
    tb('Langkah penanganan awal', ['Kasus', 'Langkah 1', 'Langkah 2', 'Langkah 3'], { rl: ['Luka ringan', 'Luka bakar ringan', 'Sengatan listrik'], w: [20, null, null, null], rh: 46 }),
    tb('Catatan simulasi penanganan', ['Skenario', 'Peran', 'Tindakan', 'Waktu (detik)', 'Evaluasi'], { n: 3, rh: 28, w: [22, 14, 28, 14, null], no: false }),
    ck('Kriteria rujukan segera ke fasilitas kesehatan', ['Korban tidak sadar', 'Perdarahan tidak berhenti', 'Luka bakar luas / dalam', 'Korban sengatan listrik tegangan tinggi', 'Dugaan patah tulang']),
    ft('Dokumentasi simulasi', ['Penanganan luka ringan', 'Penanganan luka bakar', 'Diskusi sengatan listrik']),
  ],
  'k3-05': [
    fm('Pekerjaan yang diamati', ['Jenis pekerjaan', 'Durasi pengamatan', 'Nama yang diamati', 'Lokasi']),
    du('Sketsa postur kerja', { k: 'gambar', j: 'Sebelum perbaikan', h: 140 }, { k: 'gambar', j: 'Sesudah perbaikan', h: 140 }),
    tb('Analisis postur kerja', ['Bagian tubuh', '[]Postur berisiko', 'Penyebab', 'Perbaikan'], { rl: ['Leher', 'Punggung', 'Bahu dan lengan', 'Pergelangan tangan', 'Kaki'], w: [24, 16, 30, null], rh: 26 }),
    tb('Perbandingan kenyamanan', ['Aspek', 'Sebelum (1-5)', 'Sesudah (1-5)', 'Selisih'], { rl: ['Kenyamanan', 'Kelelahan', 'Pegal / nyeri', 'Kemudahan menjangkau alat'], w: [38, null, null, null], rh: 24 }),
    ru('Rekomendasi ergonomi untuk area kerja', 4),
  ],
  'k3-06': [
    gb('Denah jalur evakuasi yang diikuti', 225, { bg: 'grid', cap: 'Tandai ruang awal, jalur, tangga, dan titik kumpul' }),
    tb('Catatan waktu evakuasi', ['Percobaan / kelompok', 'Mulai', 'Tiba di titik kumpul', 'Waktu (menit:detik)', 'Jumlah orang'], { n: 4, rh: 24, no: false }),
    ck('Pemeriksaan jalur dan titik kumpul', ['Jalur tidak terhalang', 'Pintu keluar mudah dibuka', 'Penunjuk arah terlihat jelas', 'Titik kumpul cukup luas', 'Peluit / alarm berbunyi']),
    tb('Kendala selama simulasi', ['Kendala', 'Lokasi', 'Dampak', 'Usulan perbaikan'], { n: 4, rh: 26, no: false }),
    ru('Rekomendasi perbaikan prosedur tanggap darurat', 4),
  ],
  'k3-07': [
    fm('Identitas audit', ['Area yang diaudit', 'Tanggal audit', 'Nama auditor / kelompok', 'Pendamping area']),
    tb('Lembar periksa audit K3', ['No', 'Butir pemeriksaan', '[]Sesuai', '[]Tidak sesuai', '[]N/A', 'Bukti / foto'], { r: [['1', 'Lantai bersih, kering, dan tidak licin'], ['2', 'Jalur lalu lintas bebas hambatan'], ['3', 'Instalasi listrik rapi tanpa kabel terkelupas'], ['4', 'Kotak kontak tidak overload'], ['5', 'APD tersedia dan terpakai'], ['6', 'APAR terlihat, terjangkau, dan tidak kedaluwarsa'], ['7', 'Kotak P3K lengkap'], ['8', 'Jalur dan tanda evakuasi jelas'], ['9', 'Perkakas disimpan rapi'], ['10', 'Rambu K3 terpasang']], w: [5, 42, 9, 11, 7, null], rh: 24 }),
    HAL,
    ru1('Perhitungan kesesuaian', 'Kesesuaian (%) = jumlah butir sesuai / (jumlah butir - butir N/A) x 100 %  = ........ %'),
    tb('Temuan dan rekomendasi perbaikan', ['Temuan', 'Tingkat', 'Rekomendasi', 'Penanggung jawab', 'Batas waktu'], { n: 6, rh: 26, no: false, w: [28, 12, 28, 18, null] }),
    ft('Dokumentasi temuan', ['Temuan 1', 'Temuan 2', 'Temuan 3']),
    rb('Penilaian audit (diisi dosen)', [['Kelengkapan dan ketepatan lembar periksa', '30'], ['Kualitas bukti dan temuan', '25'], ['Rekomendasi perbaikan', '25'], ['Presentasi', '20']]),
    ru('Refleksi proses audit', 3),
  ],
};
