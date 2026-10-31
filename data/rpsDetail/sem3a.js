/**
 * Rincian per pertemuan - MK SEMESTER 3 (bagian A):
 * Pancasila, Dasar Sistem Tenaga Listrik, Elektronika Digital (Instrumentasi & Telekomunikasi), Mikrokontroler.
 * Urutan: pertemuan 1-7, 9-15. Format: D(judul, [butir materi], subCPMK, indikator [, metode])
 */
const D = (judul, poin, sub, ind, metode) => ({ judul, poin, sub, ind, metode });

// Pertemuan 1-7 Elektronika Digital sama untuk jalur Instrumentasi dan Telekomunikasi
const digitalAwal = () => [
  D('Sistem Bilangan Digital', ['Bilangan biner, oktal, desimal, dan heksadesimal', 'Konversi antarsistem bilangan', 'Kode BCD dan Gray'],
    'Menjelaskan sistem bilangan digital', 'Ketepatan konversi bilangan'),
  D('Gerbang Logika Dasar', ['Gerbang AND, OR, NOT, NAND, NOR, XOR', 'Tabel kebenaran', 'Aljabar Boolean dasar'],
    'Menjelaskan gerbang logika dasar', 'Ketepatan tabel kebenaran dan ekspresi Boolean'),
  D('Rangkaian Kombinasional I', ['Penyederhanaan fungsi Boolean dan peta Karnaugh', 'Merancang rangkaian dari tabel kebenaran', 'Praktik dengan IC gerbang logika'],
    'Merancang rangkaian kombinasional sederhana', 'Kebenaran rancangan dan hasil uji rangkaian'),
  D('Rangkaian Kombinasional II', ['Half adder dan full adder', 'Multiplexer, demultiplexer, dan decoder', 'Praktik rangkaian'],
    'Menganalisis rangkaian kombinasional aritmetika dan data', 'Ketepatan analisis dan hasil praktik'),
  D('Flip-Flop', ['Flip-flop SR, D, JK, dan T', 'Clock dan pemicuan tepi (edge triggering)', 'Demonstrasi flip-flop'],
    'Menjelaskan flip-flop', 'Ketepatan penjelasan operasi flip-flop'),
  D('Rangkaian Sekuensial', ['Analisis rangkaian sekuensial', 'Diagram keadaan sederhana', 'Demonstrasi'],
    'Menganalisis rangkaian sekuensial', 'Ketepatan analisis diagram keadaan dan keluaran'),
  D('Counter dan Register', ['Counter asinkron dan sinkron', 'Shift register', 'Demonstrasi counter dan register'],
    'Menjelaskan counter dan register', 'Ketepatan penjelasan dan pembacaan keluaran counter')
];

const digitalAkhir = () => [
  D('Troubleshooting Rangkaian Digital I', ['Kesalahan umum pada rangkaian digital', 'Penggunaan logic probe dan multimeter', 'Praktik mencari kesalahan'],
    'Melakukan troubleshooting rangkaian digital', 'Ketepatan menemukan kesalahan rangkaian'),
  D('Troubleshooting Rangkaian Digital II', ['Kasus kerusakan rangkaian counter/register', 'Langkah sistematis pemeriksaan', 'Pelaporan hasil'],
    'Memperbaiki rangkaian digital yang bermasalah', 'Keberhasilan perbaikan dan kelengkapan laporan'),
  D('Proyek Rangkaian Digital I', ['Menentukan topik dan spesifikasi proyek', 'Merancang rangkaian', 'Konsultasi desain'],
    'Merancang proyek rangkaian digital', 'Kelengkapan dan kebenaran rancangan'),
  D('Proyek Rangkaian Digital II', ['Merakit dan menguji rangkaian', 'Perbaikan kesalahan', 'Dokumentasi proyek'],
    'Menyelesaikan proyek rangkaian digital', 'Fungsi rangkaian dan kelengkapan dokumentasi'),
  D('Presentasi dan Laporan Proyek', ['Presentasi proyek', 'Demonstrasi rangkaian', 'Pengumpulan laporan'],
    'Mempresentasikan proyek dan menyusun laporan', 'Kualitas presentasi, demonstrasi, dan laporan')
];

module.exports = {
  pancasila: [
    D('Sejarah Lahirnya Pancasila', ['Sidang BPUPKI dan PPKI', 'Piagam Jakarta dan rumusan final Pancasila', 'Peran tokoh perumus'],
      'Menjelaskan sejarah lahirnya Pancasila', 'Ketepatan urutan peristiwa dan peran tokoh'),
    D('Kedudukan Pancasila', ['Pancasila sebagai dasar negara, ideologi, dan pandangan hidup', 'Pancasila sebagai sumber hukum', 'Pancasila dalam Pembukaan UUD 1945'],
      'Menjelaskan kedudukan Pancasila', 'Ketepatan penjelasan kedudukan dan fungsi Pancasila'),
    D('Sila Pertama dan Kedua', ['Ketuhanan Yang Maha Esa: makna dan nilai', 'Kemanusiaan yang adil dan beradab: makna dan nilai', 'Contoh pengamalan'],
      'Menjelaskan sila pertama dan kedua', 'Ketepatan makna dan contoh pengamalan'),
    D('Sila Ketiga, Keempat, dan Kelima', ['Persatuan Indonesia', 'Kerakyatan yang dipimpin oleh hikmat kebijaksanaan', 'Keadilan sosial bagi seluruh rakyat Indonesia'],
      'Menjelaskan sila ketiga, keempat, dan kelima', 'Ketepatan makna dan contoh pengamalan'),
    D('Pancasila sebagai Sistem Etika', ['Pengertian etika dan nilai', 'Pancasila sebagai sumber nilai etika', 'Etika sosial dan politik'],
      'Mengaitkan Pancasila dengan etika', 'Ketepatan keterkaitan Pancasila dan etika'),
    D('Studi Kasus Pancasila dan Etika', ['Kasus pelanggaran etika', 'Analisis dengan nilai Pancasila', 'Diskusi kelompok'],
      'Menganalisis kasus etika berdasarkan Pancasila', 'Ketajaman analisis dan kualitas diskusi'),
    D('Pancasila dan Profesi', ['Nilai Pancasila dalam profesi teknisi', 'Integritas, tanggung jawab, dan kerja sama', 'Diskusi dan presentasi singkat'],
      'Mengaitkan Pancasila dengan profesi', 'Ketepatan keterkaitan nilai Pancasila dengan profesi'),
    D('Studi Kasus Pancasila I', ['Kasus pelanggaran nilai Pancasila di masyarakat', 'Analisis penyebab dan dampak', 'Solusi'],
      'Menganalisis studi kasus Pancasila', 'Ketajaman analisis dan kelayakan solusi'),
    D('Studi Kasus Pancasila II', ['Kasus di lingkungan kampus dan kerja', 'Analisis berbasis nilai Pancasila', 'Presentasi hasil analisis'],
      'Menganalisis studi kasus Pancasila lanjutan', 'Kualitas analisis dan presentasi'),
    D('Implementasi Pancasila di Masyarakat', ['Gotong royong dan musyawarah', 'Kerukunan dan toleransi', 'Contoh implementasi di lingkungan sekitar'],
      'Mengidentifikasi implementasi Pancasila di masyarakat', 'Ketepatan dan kelengkapan contoh implementasi'),
    D('Implementasi Pancasila di Kampus dan Dunia Kerja', ['Budaya akademik berlandaskan Pancasila', 'Etika kerja dan kerja sama tim', 'Diskusi kelompok'],
      'Mengidentifikasi implementasi Pancasila di kampus dan dunia kerja', 'Kualitas diskusi dan ketepatan contoh'),
    D('Pancasila dan K3', ['Nilai kemanusiaan pada keselamatan kerja', 'Keadilan bagi pekerja', 'Diskusi kasus kecelakaan kerja'],
      'Mengaitkan Pancasila dengan K3', 'Ketepatan keterkaitan dan kualitas diskusi'),
    D('Pancasila dan Lingkungan', ['Tanggung jawab terhadap lingkungan', 'Keadilan antargenerasi dan pembangunan berkelanjutan', 'Diskusi limbah elektronik'],
      'Mengaitkan Pancasila dengan lingkungan', 'Ketepatan keterkaitan dan kualitas diskusi'),
    D('Refleksi Akhir', ['Rangkuman materi', 'Refleksi pengamalan Pancasila', 'Evaluasi pembelajaran'],
      'Melakukan refleksi akhir', 'Kejujuran dan kedalaman refleksi')
  ],

  dasar_sistem_tenaga_listrik: [
    D('Konsep Sistem Tenaga Listrik', ['Besaran listrik: tegangan, arus, dan daya', 'Alur pembangkitan, transmisi, dan distribusi', 'Jenis pembangkit (PLTA, PLTU, PLTS)'],
      'Menjelaskan konsep sistem tenaga listrik', 'Ketepatan penjelasan alur sistem tenaga'),
    D('Transmisi dan Distribusi', ['Tingkat tegangan transmisi (SUTT/SUTET)', 'Gardu induk dan gardu distribusi', 'Jaringan tegangan menengah dan rendah'],
      'Menjelaskan transmisi dan distribusi tenaga listrik', 'Ketepatan penjelasan tingkat tegangan dan komponen jaringan'),
    D('Transformator', ['Prinsip kerja dan rasio belitan', 'Jenis transformator', 'Observasi transformator'],
      'Mengidentifikasi komponen transformator dan prinsip kerjanya', 'Ketepatan identifikasi dan perhitungan rasio'),
    D('Panel Distribusi dan Komponen', ['Panel, busbar, dan kabel', 'Kontaktor dan relay', 'Observasi panel distribusi'],
      'Mengidentifikasi komponen panel distribusi', 'Ketepatan identifikasi komponen dan fungsinya'),
    D('Pengaman Listrik: MCB dan Fuse', ['Prinsip kerja MCB dan fuse', 'Karakteristik dan rating pengaman', 'Pemilihan pengaman'],
      'Menjelaskan MCB dan fuse', 'Ketepatan penjelasan dan pemilihan rating pengaman'),
    D('Gangguan dan Koordinasi Proteksi', ['Jenis gangguan: hubung singkat dan beban lebih', 'Pengaman tambahan (ELCB/RCD)', 'Diskusi kasus'],
      'Menjelaskan sistem proteksi terhadap gangguan', 'Ketepatan analisis gangguan dan pengaman yang sesuai'),
    D('Instalasi Listrik Sederhana', ['Diagram instalasi rumah', 'Pemasangan saklar, stop kontak, dan lampu', 'Pengaman instalasi sesuai PUIL'],
      'Melakukan instalasi listrik sederhana', 'Kebenaran rangkaian dan keselamatan pemasangan'),
    D('Pengukuran Sistem 1 Fasa I', ['Pengukuran tegangan dan arus', 'Pengukuran daya dengan wattmeter', 'Faktor daya'],
      'Mengukur besaran sistem 1 fasa', 'Ketepatan pengukuran dan pencatatan'),
    D('Pengukuran Sistem 1 Fasa II', ['Beban resistif, induktif, dan kapasitif', 'Pengukuran dan pencatatan', 'Analisis hasil'],
      'Menganalisis hasil pengukuran beban 1 fasa', 'Ketepatan analisis dan kelengkapan data'),
    D('Sistem Tenaga 3 Fasa', ['Hubungan bintang dan segitiga', 'Tegangan fasa dan tegangan line', 'Pengukuran 3 fasa'],
      'Mengukur sistem tenaga 3 fasa', 'Ketepatan pengukuran dan konfigurasi'),
    D('Analisis Beban Listrik', ['Menghitung daya dan energi', 'Beban seimbang dan tidak seimbang', 'Faktor daya dan perbaikannya'],
      'Menganalisis beban listrik', 'Ketepatan perhitungan dan analisis beban'),
    D('Grounding', ['Tujuan dan jenis sistem pentanahan', 'Pengenalan pengukuran tahanan pentanahan', 'Pemasangan grounding'],
      'Menjelaskan grounding', 'Ketepatan penjelasan dan prosedur grounding'),
    D('K3 pada Sistem Tenaga', ['Bahaya listrik dan APD', 'Prosedur lock-out/tag-out', 'Praktik kerja aman'],
      'Menerapkan K3 pada sistem tenaga', 'Ketepatan penerapan prosedur K3'),
    D('Laporan Sistem Tenaga Listrik', ['Menyusun laporan praktik', 'Sistematika dan analisis data', 'Pengumpulan dan pembahasan'],
      'Menyusun laporan sistem tenaga listrik', 'Kelengkapan dan ketepatan laporan')
  ],

  elektronika_digital_instrumentasi: [
    ...digitalAwal(),
    D('Perancangan Counter', ['Merancang counter 4 bit', 'Counter modulo-N (reset)', 'Praktik dengan IC counter'],
      'Merancang counter sederhana', 'Kebenaran rancangan dan hasil uji counter'),
    D('Simulasi Rangkaian Digital', ['Menggunakan simulator rangkaian digital', 'Menjalankan dan membaca hasil simulasi', 'Membandingkan simulasi dan praktik'],
      'Mensimulasikan rangkaian digital', 'Kesesuaian hasil simulasi dengan rancangan'),
    ...digitalAkhir()
  ],

  elektronika_digital_telekomunikasi: [
    ...digitalAwal(),
    D('Aplikasi Digital pada Telekomunikasi I', ['Multiplexer dan demultiplexer dalam pengiriman data', 'Encoder dan decoder', 'Praktik rangkaian'],
      'Menerapkan rangkaian digital pada sistem telekomunikasi sederhana', 'Kebenaran rangkaian dan hasil uji'),
    D('Aplikasi Digital pada Telekomunikasi II', ['Pendeteksian kesalahan (parity)', 'Konversi paralel-serial dengan shift register', 'Praktik rangkaian'],
      'Menerapkan rangkaian digital untuk pengiriman data serial', 'Kebenaran rangkaian dan hasil uji'),
    ...digitalAkhir()
  ],

  mikrokontroler: [
    D('Kontrak Perkuliahan dan RPS', ['Penjelasan RPS dan tujuan pembelajaran', 'Sistem penilaian', 'Tata tertib laboratorium'],
      'Menyepakati kontrak perkuliahan dan RPS', 'Pemahaman terhadap kontrak dan penilaian'),
    D('Pengenalan Mikrokontroler dan Arduino', ['Pengertian dan arsitektur mikrokontroler', 'Keluarga AVR dan platform Arduino', 'Pengenalan papan Arduino Uno'],
      'Menjelaskan mikrokontroler dan Arduino', 'Ketepatan penjelasan dan identifikasi bagian papan Arduino'),
    D('Arduino IDE dan Struktur Dasar Bahasa C', ['Instalasi Arduino IDE', 'Menu dan fitur IDE', 'Fungsi setup() dan loop()'],
      'Menggunakan Arduino IDE dan memahami struktur dasar program', 'Keberhasilan upload program pertama'),
    D('Variabel pada Arduino', ['Tipe data: int, float, char, boolean', 'Deklarasi dan penggunaan variabel', 'Operator'],
      'Menggunakan variabel pada program Arduino', 'Ketepatan penggunaan variabel dan tipe data'),
    D('Logika Pemrograman', ['IF, IF-ELSE, dan SWITCH-CASE', 'FOR, WHILE, dan DO-WHILE', 'Latihan program'],
      'Menerapkan logika pemrograman', 'Ketepatan program dengan percabangan dan perulangan'),
    D('Praktikum LED', ['Merangkai LED dan resistor', 'digitalWrite dan delay', 'Pola nyala LED'],
      'Merangkai dan mengendalikan LED', 'Kebenaran rangkaian dan pola nyala LED'),
    D('Praktikum Seven Segment dan LCD 2x16 I2C', ['Rangkaian seven segment', 'LCD 2x16 dengan modul I2C', 'Menampilkan teks dan angka'],
      'Mengendalikan seven segment dan LCD', 'Kebenaran tampilan'),
    D('Praktikum Sensor Ultrasonik, Air, dan Sentuh', ['Sensor ultrasonik (HC-SR04)', 'Sensor air dan sensor sentuh', 'Membaca dan menampilkan data'],
      'Menggunakan sensor ultrasonik, air, dan sentuh', 'Ketepatan pembacaan data sensor'),
    D('Praktikum Serial Input sebagai Kontrol', ['Serial Monitor dan perintah serial', 'Membaca input serial', 'Mengontrol keluaran dari serial'],
      'Menggunakan serial input sebagai kontrol', 'Kebenaran kontrol melalui serial'),
    D('Praktikum Motor Servo dan Motor DC', ['Kendali motor servo', 'Kendali motor DC dengan driver', 'Konsep PWM (pulse width modulation)'],
      'Mengendalikan motor servo dan motor DC', 'Kebenaran pengendalian motor'),
    D('Proyek Akhir: Perancangan', ['Menentukan topik dan spesifikasi', 'Diagram blok dan flowchart', 'Daftar komponen dan rencana kerja'],
      'Merancang sistem proyek akhir berbasis mikrokontroler', 'Kelengkapan rancangan'),
    D('Proyek Akhir: Perakitan dan Pemrograman', ['Merakit rangkaian', 'Menulis dan mengunggah program', 'Konsultasi dan troubleshooting'],
      'Merangkai dan mengontrol sistem proyek akhir', 'Kemajuan dan fungsi sistem'),
    D('Pengujian dan Penyempurnaan Proyek', ['Pengujian fungsional', 'Perbaikan kesalahan', 'Penyusunan laporan'],
      'Menguji dan menyempurnakan proyek', 'Kelengkapan pengujian dan kualitas perbaikan'),
    D('Presentasi Tugas Besar', ['Presentasi proyek', 'Demonstrasi sistem', 'Tanya jawab'],
      'Mempresentasikan tugas besar', 'Kualitas presentasi, demo, dan ketepatan menjawab')
  ]
};
