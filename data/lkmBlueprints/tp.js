// Teknik Pengukuran (tp-01 .. tp-06): isian berbasis tabel data ukur, grafik, dan ketidakpastian.
const { tb, gb, gr, kd, ru, tn, ck, fm, al, ft, rb, du, tg, ba, ru1, HAL, osc } = require('./_h');
module.exports = {
  'tp-01': [
    du('Bagian-bagian multimeter', { k: 'tabel', j: 'Multimeter analog', cols: ['Bagian', 'Fungsi'], rl: ['Skala dan jarum', 'Selector rentang', 'Sekrup nol mekanik', 'Probe + / -'], w: [40, null] }, { k: 'tabel', j: 'Multimeter digital', cols: ['Bagian', 'Fungsi'], rl: ['Layar (display)', 'Selector fungsi', 'Tombol hold / range', 'Soket COM / V / A'], w: [40, null] }),
    tb('Hasil pengukuran analog dibanding digital', ['Besaran yang diukur', 'Rentang analog', 'Hasil analog', 'Rentang digital', 'Hasil digital', 'Selisih'], { rl: ['Tegangan DC catu daya', 'Arus DC rangkaian sederhana', 'Resistansi R1', 'Resistansi R2', 'Resistansi R3'], w: [28, 14, 14, 14, 14, null], rh: 26 }),
    ck('Prosedur pengukuran aman', ['Mulai dari rentang ukur terbesar', 'Ampermeter dipasang seri dengan beban', 'Voltmeter dipasang paralel', 'Resistansi diukur tanpa sumber tegangan', 'Probe dicabut sebelum mengganti fungsi', 'Multimeter dimatikan setelah dipakai']),
    tb('Perbandingan kedua jenis multimeter', ['Aspek', 'Analog', 'Digital'], { rl: ['Kemudahan membaca', 'Ketelitian pembacaan', 'Hambatan masukan', 'Risiko salah baca (paralaks)'], w: [32, null, null], rh: 24 }),
    ru('Kesimpulan prosedur pengukuran yang aman dan tepat', 3),
  ],
  'tp-02': [
    du('Rangkaian yang dirakit', { k: 'gambar', j: 'Skema resistor seri', h: 110 }, { k: 'gambar', j: 'Skema resistor paralel', h: 110 }),
    tb('Rangkaian seri', ['Komponen', 'R nominal (ohm)', 'V ukur (V)', 'V hitung (V)', 'I ukur (mA)', 'I hitung (mA)'], { rl: ['R1', 'R2', 'R3', 'Total (sumber)'], rh: 24, w: [20, null, null, null, null, null] }),
    tb('Rangkaian paralel', ['Cabang', 'R (ohm)', 'V (V)', 'I ukur (mA)', 'I hitung (mA)'], { rl: ['Cabang 1', 'Cabang 2', 'Cabang 3', 'Total (sumber)'], rh: 24, w: [22, null, null, null, null] }),
    tb('Verifikasi hukum Kirchhoff', ['Hukum', 'Persamaan yang diuji', 'Ruas kiri', 'Ruas kanan', 'Selisih (%)'], { rl: ['KVL (rangkaian seri)', 'KCL (titik cabang paralel)'], w: [24, 28, 14, 14, null], rh: 30 }),
    ru('Analisis penyimpangan hasil ukur terhadap perhitungan', 4),
  ],
  'tp-03': [
    ck('Kalibrasi probe dan persiapan osiloskop', ['Probe dihubungkan ke terminal kalibrasi', 'Redaman probe x1 / x10 sesuai pengaturan', 'Gelombang kotak kalibrasi tampak rata (tidak miring)', 'Garis nol (ground) diatur di tengah layar']),
    tb('Hasil ukur beberapa sinyal', ['Bentuk gelombang', 'Setting generator (Hz)', 'Vp-p (div x V/div)', 'Periode (div x s/div)', 'f hitung (Hz)', 'Selisih (%)'], { rl: ['Sinus', 'Sinus', 'Kotak', 'Kotak', 'Segitiga', 'Segitiga'], w: [18, 16, 18, 18, 16, null], rh: 24, rumus: 'Vp-p = jumlah kotak vertikal x Volt/div  |  T = jumlah kotak horizontal x Time/div  |  f = 1 / T' }),
    du('Gambar gelombang pada layar', { k: 'osc', j: 'Sinyal sinus', rows: 8 }, { k: 'osc', j: 'Sinyal kotak', rows: 8 }),
    ru('Perbandingan frekuensi ukur dengan setting generator', 3),
    tn('Pertanyaan analisis', ['Apa kelebihan osiloskop dibanding multimeter untuk mengukur sinyal AC?'], 3),
  ],
  'tp-04': [
    tb('Frekuensi generator: setting dan hasil ukur', ['Setting generator (Hz)', 'Amplitudo setting (V)', 'Frequency counter (Hz)', 'Osiloskop (Hz)', 'Selisih (%)'], { n: 4, rh: 24, no: false }),
    fm('Rangkaian filter RC', ['R (ohm)', 'C (uF)', 'fc teori (Hz)', 'Jenis filter'], { k: 2, lw: 16 }),
    tb('Respons filter terhadap frekuensi', ['f input (Hz)', 'Vin p-p (V)', 'Vout p-p (V)', 'Vout / Vin', 'Gain (dB)'], { n: 9, rh: 21, no: false, rumus: 'fc = 1 / (2 pi R C)  |  Gain (dB) = 20 log (Vout / Vin)  |  Pada fc: Vout / Vin = 0,707' }),
    gr('Kurva respons filter', 170, 'f (Hz), skala logaritmik', 'Vout / Vin'),
    ba('Frekuensi cut-off', ['fc dari grafik (Hz)', 'fc dari teori (Hz)', 'Selisih (%)']),
    ru('Kesimpulan prinsip kerja filter RC', 3),
  ],
  'tp-05': [
    tb('Pengukuran berulang 10 kali', ['No', 'Hasil ukur xi', 'xi - rata-rata', '(xi - rata-rata)^2'], { n: 10, rh: 20, w: [8, null, null, null] }),
    tb('Perhitungan statistik', ['Besaran', 'Rumus', 'Hasil'], { rl: ['Rata-rata', 'Simpangan baku s', 'Ketidakpastian tipe A (s / akar n)', 'Hasil dilaporkan (rata-rata +/- U)'], w: [34, 36, null], rh: 24 }),
    tb('Sumber kesalahan', ['Jenis', 'Sumber', 'Cara mengurangi'], { rl: ['Sistematis', 'Sistematis', 'Acak', 'Acak'], w: [20, null, null], rh: 26 }),
    tb('Pembandingan alat dengan nilai acuan', ['Alat', 'Nilai ukur', 'Nilai acuan', 'Koreksi', '[]Layak pakai'], { n: 3, rh: 24, no: false }),
    tn('Pertanyaan analisis', ['Apa akibatnya bagi keputusan teknis bila alat ukur tidak pernah dikalibrasi?'], 3),
  ],
  'tp-06': [
    fm('Identitas proyek pengukuran', ['Rangkaian yang dikarakterisasi', 'Nama kelompok', 'Besaran yang diukur', 'Anggota dan NIM']),
    tb('Prosedur pengukuran yang disusun', ['Langkah', 'Kegiatan', 'Alat ukur', 'Titik ukur'], { n: 5, rh: 26, w: [8, 38, 24, null] }),
    tb('Data hasil pengukuran', ['No', 'Titik / kondisi', 'Nilai terukur', 'Satuan', 'Nilai teori', 'Selisih (%)'], { n: 8, rh: 22, w: [6, 28, 16, 12, 16, null] }),
    HAL,
    gr('Grafik karakteristik rangkaian', 190, 'Variabel bebas', 'Variabel terukur'),
    tb('Estimasi ketidakpastian', ['Sumber', 'Besar perkiraan', 'Pengaruh pada hasil'], { n: 3, rh: 26, no: false }),
    rb('Penilaian proyek (diisi dosen)', [['Kelayakan prosedur dan pemilihan alat', '25'], ['Kualitas data dan ketelitian', '30'], ['Analisis dan ketidakpastian', '25'], ['Presentasi dan laporan', '20']]),
    ru('Kesimpulan dan refleksi kendala', 4),
  ],
};
