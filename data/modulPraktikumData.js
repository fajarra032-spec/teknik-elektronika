/**
 * data/modulPraktikumData.js
 *
 * Konten default "Modul Praktikum" (job sheet) untuk mata kuliah yang
 * bersifat praktik laboratorium: Elektronika Digital, Mikrokontroler, dan
 * PLC (Programmable Logic Control).
 *
 * Ini adalah TEMPLATE/KONSEP AWAL yang mengacu pada topik umum RPS ketiga
 * mata kuliah tersebut (lihat scripts/sync-matakuliah-dari-rps.js untuk
 * kode & nama MK). Isi tiap modul (tujuan, alat/bahan, dasar teori, langkah
 * kerja, tugas laporan) bisa disesuaikan/ditimpa oleh dosen pengampu lewat
 * halaman "Modul Praktikum" pada workspace MK - lihat helpers/modulPraktikumHelper.js
 * untuk mekanisme override & publikasi per modul.
 *
 * Struktur tiap modul:
 *   id             - slug unik & stabil (dipakai untuk menyimpan override di Firestore)
 *   judul          - judul job sheet
 *   pertemuanSaran - pertemuan ke berapa (acuan, boleh berbeda per kelas)
 *   tujuan         - daftar capaian praktikum (array string)
 *   alatBahan      - daftar alat & bahan (array string)
 *   dasarTeori     - ringkasan teori singkat (1 paragraf)
 *   langkahKerja   - langkah kerja praktikum (array string, berurutan)
 *   tugasLaporan   - poin yang wajib ada di laporan resmi praktikum (array string)
 *   k3             - catatan keselamatan kerja (opsional, string)
 *   estimasiWaktu  - estimasi durasi praktikum
 */

module.exports = {
  // ==========================================================================
  // ELEKTRONIKA DIGITAL (kode a.l. PEK3202 / PEK3208)
  // ==========================================================================
  elektronika_digital: [
    {
      id: 'ed-01',
      judul: 'Gerbang Logika Dasar (AND, OR, NOT, NAND, NOR, XOR, XNOR)',
      pertemuanSaran: 2,
      tujuan: [
        'Mengidentifikasi kaki (pin) IC gerbang logika TTL/CMOS umum (7408, 7432, 7404, 7400, 7402, 7486)',
        'Merangkai dan menguji tabel kebenaran tiap jenis gerbang logika dasar',
        'Membandingkan hasil pengujian rangkaian dengan tabel kebenaran teoritis'
      ],
      alatBahan: [
        'Trainer/project board digital + catu daya 5V',
        'IC 7408 (AND), 7432 (OR), 7404 (NOT), 7400 (NAND), 7402 (NOR), 7486 (XOR)',
        'LED indikator output, resistor 330 ohm',
        'Saklar toggle/DIP switch untuk input logika',
        'Multimeter dan kabel jumper'
      ],
      dasarTeori: 'Gerbang logika adalah blok bangunan dasar rangkaian digital yang mengimplementasikan operasi aljabar Boolean (AND, OR, NOT, dan turunannya NAND/NOR/XOR/XNOR). Setiap gerbang memiliki tabel kebenaran yang memetakan kombinasi input biner ke satu output biner.',
      langkahKerja: [
        'Siapkan project board dan pastikan catu daya 5V terukur benar sebelum IC dipasang',
        'Pasang IC gerbang logika sesuai datasheet, perhatikan posisi pin VCC dan GND',
        'Hubungkan input gerbang ke saklar logika dan output ke LED indikator',
        'Ubah kombinasi input sesuai tabel kebenaran, catat kondisi output (nyala/mati) untuk tiap kombinasi',
        'Ulangi langkah untuk setiap jenis gerbang (AND, OR, NOT, NAND, NOR, XOR, XNOR)',
        'Bandingkan hasil pengamatan dengan tabel kebenaran teori, catat penyimpangan bila ada'
      ],
      tugasLaporan: [
        'Tabel kebenaran hasil pengujian tiap gerbang beserta gambar rangkaian',
        'Analisis kesesuaian hasil praktik dengan teori',
        'Kesimpulan karakteristik tiap jenis gerbang logika'
      ],
      k3: 'Pastikan polaritas catu daya benar sebelum IC dipasang untuk menghindari IC terbakar.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ed-02',
      judul: 'Aljabar Boolean dan Penyederhanaan Rangkaian (Peta Karnaugh)',
      pertemuanSaran: 4,
      tujuan: [
        'Menerapkan hukum aljabar Boolean untuk menyederhanakan persamaan logika',
        'Menggunakan Peta Karnaugh (K-Map) untuk minimasi 3-4 variabel',
        'Mengimplementasikan hasil penyederhanaan ke rangkaian gerbang logika nyata'
      ],
      alatBahan: [
        'Trainer/project board digital',
        'IC gerbang logika (AND, OR, NOT sesuai kebutuhan hasil minimasi)',
        'LED indikator, saklar logika, kabel jumper'
      ],
      dasarTeori: 'Penyederhanaan rangkaian logika bertujuan mengurangi jumlah gerbang yang dipakai tanpa mengubah fungsi logikanya, sehingga rangkaian lebih hemat komponen, lebih murah, dan lebih cepat. Peta Karnaugh adalah metode visual untuk minimasi persamaan Boolean berdasarkan pengelompokan sel-sel yang bernilai 1 (atau 0).',
      langkahKerja: [
        'Tentukan fungsi Boolean awal (SOP) dari studi kasus yang diberikan asisten/dosen',
        'Petakan fungsi ke K-Map 3 atau 4 variabel',
        'Lakukan pengelompokan (grouping) untuk mendapatkan persamaan minimal',
        'Gambar rangkaian gerbang logika hasil minimasi',
        'Rangkai hasil minimasi pada project board dan uji dengan tabel kebenaran',
        'Bandingkan jumlah gerbang sebelum dan sesudah penyederhanaan'
      ],
      tugasLaporan: [
        'Langkah minimasi K-Map lengkap (tabel kebenaran awal, K-Map, hasil SOP minimal)',
        'Perbandingan rangkaian sebelum dan sesudah penyederhanaan (jumlah IC/gerbang)',
        'Hasil pengujian rangkaian minimal dan pembahasan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ed-03',
      judul: 'Rangkaian Kombinasional: Decoder/Encoder dan Multiplexer/Demultiplexer',
      pertemuanSaran: 6,
      tujuan: [
        'Memahami prinsip kerja decoder, encoder, multiplexer, dan demultiplexer',
        'Merangkai IC decoder (74138) dan multiplexer (74151) pada aplikasi sederhana',
        'Menerapkan multiplexer/decoder untuk studi kasus seleksi data atau tampilan'
      ],
      alatBahan: [
        'IC 74138 (3-to-8 line decoder), 74148 (encoder), 74151 (8-to-1 multiplexer), 74153',
        'Seven segment display + IC driver (opsional)',
        'Project board, LED, saklar logika, kabel jumper'
      ],
      dasarTeori: 'Decoder mengubah kode biner menjadi salah satu dari beberapa saluran output aktif, sedangkan encoder melakukan kebalikannya. Multiplexer memilih salah satu dari beberapa saluran input untuk diteruskan ke satu output berdasarkan sinyal select, sedangkan demultiplexer mendistribusikan satu input ke banyak output.',
      langkahKerja: [
        'Pelajari datasheet IC 74138 dan 74151, identifikasi pin select dan enable',
        'Rangkai decoder 74138, uji setiap kombinasi input select dan amati output yang aktif',
        'Rangkai multiplexer 74151 dengan beberapa sumber data input, uji perpindahan output berdasarkan sinyal select',
        'Implementasikan studi kasus sederhana, misalnya seleksi tampilan salah satu dari 4 sensor pada 1 indikator',
        'Dokumentasikan hasil pengujian tiap kombinasi input'
      ],
      tugasLaporan: [
        'Tabel fungsi (function table) hasil pengujian decoder dan multiplexer',
        'Gambar rangkaian dan penjelasan aplikasi studi kasus yang dibuat',
        'Analisis dan kesimpulan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ed-04',
      judul: 'Flip-Flop dan Rangkaian Sekuensial Dasar (RS, D, JK, T)',
      pertemuanSaran: 9,
      tujuan: [
        'Membedakan prinsip kerja flip-flop RS, D, JK, dan T',
        'Merangkai dan menguji karakteristik pencacahan bit (bistable) pada IC flip-flop (7474, 7476)',
        'Memahami peran sinyal clock pada rangkaian sekuensial'
      ],
      alatBahan: [
        'IC 7474 (D flip-flop), 7476 (JK flip-flop)',
        'Pulser/clock generator sederhana atau saklar debounce',
        'LED indikator output Q dan Q-bar, project board'
      ],
      dasarTeori: 'Berbeda dengan rangkaian kombinasional yang outputnya hanya bergantung pada input saat itu, rangkaian sekuensial memiliki elemen memori (flip-flop) sehingga output juga bergantung pada kondisi/state sebelumnya. Flip-flop adalah elemen memori 1-bit yang berubah state mengikuti sinyal clock.',
      langkahKerja: [
        'Rangkai D flip-flop, berikan input data dan pulsa clock, amati perubahan output Q',
        'Rangkai JK flip-flop, uji keempat kombinasi J-K (set, reset, hold, toggle)',
        'Bandingkan respons flip-flop terhadap clock edge (naik/turun)',
        'Catat tabel kondisi (state table) hasil pengujian tiap flip-flop'
      ],
      tugasLaporan: [
        'Tabel kondisi (state table) hasil praktik untuk tiap jenis flip-flop',
        'Diagram pewaktuan (timing diagram) sederhana dari hasil pengamatan',
        'Kesimpulan perbedaan karakteristik flip-flop RS, D, JK, dan T'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ed-05',
      judul: 'Register Geser dan Pencacah (Counter) Sinkron/Asinkron',
      pertemuanSaran: 11,
      tujuan: [
        'Merangkai pencacah (counter) asinkron dan sinkron menggunakan IC 7493/74193',
        'Merangkai register geser (shift register) menggunakan IC 7494/74164',
        'Menganalisis perbedaan mode hitung naik (up) dan turun (down) pada counter'
      ],
      alatBahan: [
        'IC 7493 (counter asinkron), 74193 (counter sinkron up/down)',
        'IC 7494 atau 74164 (shift register)',
        'Seven segment + BCD to 7-segment decoder (opsional)',
        'Project board, LED, clock generator'
      ],
      dasarTeori: 'Counter adalah rangkaian sekuensial yang menghitung jumlah pulsa clock yang masuk, dapat berupa hitungan naik, turun, atau modulo tertentu. Register geser menyimpan dan menggeser data bit demi bit pada setiap pulsa clock, sering dipakai untuk konversi data serial-paralel.',
      langkahKerja: [
        'Rangkai counter asinkron 4-bit, amati pola hitung biner pada LED output',
        'Rangkai counter sinkron dengan fitur up/down, uji perpindahan arah hitung',
        'Rangkai register geser, masukkan data secara serial, amati pergeseran bit pada tiap clock',
        'Hubungkan output counter ke decoder BCD-seven segment untuk verifikasi visual (jika tersedia)'
      ],
      tugasLaporan: [
        'Diagram rangkaian dan tabel hasil pencacahan (waveform/urutan biner)',
        'Perbandingan karakteristik counter asinkron vs sinkron',
        'Analisis hasil praktik register geser'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ed-06',
      judul: 'Proyek Akhir: Prototipe Sistem Digital Sederhana',
      pertemuanSaran: 14,
      tujuan: [
        'Mengintegrasikan gerbang logika, rangkaian kombinasional, dan sekuensial dalam satu sistem',
        'Merancang dan merealisasikan prototipe sesuai studi kasus yang dipilih (mis. pengontrol lampu lalu lintas sederhana atau penghitung antrian digital)',
        'Mempresentasikan dan mendemonstrasikan hasil rancangan'
      ],
      alatBahan: [
        'Kombinasi IC gerbang logika, counter, dan decoder sesuai rancangan kelompok',
        'Project board/PCB prototyping, LED/seven segment, catu daya',
        'Alat ukur (multimeter, osiloskop bila tersedia)'
      ],
      dasarTeori: 'Proyek akhir menggabungkan seluruh konsep elektronika digital (gerbang logika, minimasi, rangkaian kombinasional, dan sekuensial) menjadi satu sistem fungsional, melatih kemampuan perancangan sistem digital secara utuh dari studi kasus hingga implementasi perangkat keras.',
      langkahKerja: [
        'Tentukan studi kasus dan buat diagram blok sistem',
        'Rancang persamaan logika/rangkaian tiap blok fungsi',
        'Rakit dan uji tiap blok secara terpisah sebelum diintegrasikan',
        'Integrasikan seluruh blok dan lakukan pengujian sistem secara keseluruhan',
        'Siapkan dokumentasi dan lakukan demonstrasi di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Laporan rancangan lengkap (diagram blok, skematik, perhitungan logika)',
        'Dokumentasi pengujian tiap blok dan sistem terintegrasi',
        'Video/foto demonstrasi serta refleksi kendala dan solusi selama proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // MIKROKONTROLER (kode a.l. PEK3203) - berbasis platform Arduino/AVR
  // ==========================================================================
  mikrokontroler: [
    {
      id: 'mk-01',
      judul: 'Pengenalan Perangkat Keras Mikrokontroler dan IDE Pemrograman',
      pertemuanSaran: 2,
      tujuan: [
        'Mengenal arsitektur dasar mikrokontroler dan board pengembangan yang digunakan',
        'Menginstal dan mengonfigurasi IDE pemrograman serta driver board',
        'Membuat, meng-compile, dan meng-upload program pertama (LED berkedip/blink)'
      ],
      alatBahan: [
        'Board mikrokontroler (mis. Arduino Uno/Nano atau setara)',
        'Kabel USB, komputer/laptop dengan IDE terpasang',
        'LED, resistor 220-330 ohm, kabel jumper, breadboard'
      ],
      dasarTeori: 'Mikrokontroler adalah sistem komputer dalam satu chip (CPU, memori, I/O) yang dirancang untuk aplikasi kendali (embedded system). Program yang telah dikompilasi disimpan pada memori flash mikrokontroler dan dijalankan berulang mengikuti struktur setup() dan loop().',
      langkahKerja: [
        'Instal IDE dan driver board, hubungkan board via kabel USB',
        'Pilih jenis board dan port komunikasi yang sesuai pada IDE',
        'Tulis program blink LED pada pin digital output',
        'Rangkai LED pada breadboard sesuai pin yang diprogram',
        'Compile dan upload program, amati hasil kedipan LED',
        'Ubah nilai delay dan amati perubahan kecepatan kedip sebagai verifikasi pemahaman'
      ],
      tugasLaporan: [
        'Screenshot program dan hasil upload yang berhasil',
        'Penjelasan struktur program (setup, loop, fungsi pinMode/digitalWrite)',
        'Kesimpulan hasil percobaan variasi delay'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mk-02',
      judul: 'Input/Output Digital: Saklar (Debouncing) dan LED/Relay',
      pertemuanSaran: 4,
      tujuan: [
        'Membaca kondisi input digital dari push button/saklar',
        'Menerapkan teknik debouncing sederhana secara software',
        'Mengendalikan output digital (LED/relay) berdasarkan kondisi input'
      ],
      alatBahan: [
        'Board mikrokontroler, push button, resistor pull-up/pull-down',
        'LED atau modul relay, breadboard, kabel jumper'
      ],
      dasarTeori: 'Input digital dari saklar mekanis sering menghasilkan sinyal "bouncing" (perubahan level tegangan yang tidak stabil sesaat setelah ditekan) akibat kontak logam yang bergetar, sehingga perlu penanganan debouncing agar mikrokontroler tidak salah membaca banyak penekanan dari satu kali tekan.',
      langkahKerja: [
        'Rangkai push button dengan resistor pull-up/pull-down pada pin input digital',
        'Tulis program pembacaan status tombol dan tampilkan pada Serial Monitor',
        'Amati gejala bouncing pada pembacaan tanpa debouncing',
        'Terapkan debouncing sederhana (delay atau pencacahan waktu) pada program',
        'Gunakan status tombol untuk menyalakan/mematikan LED atau relay (toggle)'
      ],
      tugasLaporan: [
        'Listing program sebelum dan sesudah debouncing beserta penjelasan',
        'Data/hasil pengamatan gejala bouncing',
        'Kesimpulan efektivitas metode debouncing yang digunakan'
      ],
      k3: 'Jika menggunakan modul relay untuk beban tegangan AC, pastikan pengawasan dosen/instruktur dan jangan menyentuh bagian output relay saat aktif.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mk-03',
      judul: 'Input Analog (ADC) dan Output PWM',
      pertemuanSaran: 6,
      tujuan: [
        'Membaca nilai tegangan analog menggunakan ADC internal mikrokontroler',
        'Menghasilkan sinyal PWM untuk mengatur kecerahan LED/kecepatan motor DC',
        'Memetakan (mapping) nilai ADC ke nilai duty cycle PWM'
      ],
      alatBahan: [
        'Board mikrokontroler, potensiometer 10k, LED, motor DC kecil (opsional)',
        'Driver motor sederhana (mis. transistor/modul driver) bila menggunakan motor DC'
      ],
      dasarTeori: 'ADC (Analog to Digital Converter) mengubah tegangan analog menjadi nilai digital yang dapat dibaca program. PWM (Pulse Width Modulation) menghasilkan sinyal digital dengan lebar pulsa yang bervariasi untuk mensimulasikan output analog, umum dipakai mengatur kecerahan LED atau kecepatan motor DC.',
      langkahKerja: [
        'Rangkai potensiometer ke pin input analog, baca nilainya via Serial Monitor',
        'Rangkai LED ke pin PWM, buat program dasar mengatur duty cycle secara tetap',
        'Petakan (map) nilai pembacaan ADC potensiometer ke rentang duty cycle PWM',
        'Amati perubahan kecerahan LED (atau kecepatan motor) seiring perubahan posisi potensiometer',
        'Catat nilai ADC dan duty cycle pada beberapa titik pengujian'
      ],
      tugasLaporan: [
        'Tabel hasil pengujian (posisi potensiometer, nilai ADC, nilai PWM, kondisi output)',
        'Listing program dan penjelasan fungsi mapping',
        'Kesimpulan hubungan input analog terhadap output PWM'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mk-04',
      judul: 'Interrupt dan Timer',
      pertemuanSaran: 8,
      tujuan: [
        'Memahami konsep interrupt eksternal dan penggunaannya dibandingkan polling',
        'Menerapkan timer/counter internal untuk menjalankan tugas terjadwal',
        'Membuat program yang responsif terhadap kejadian tanpa mengganggu proses utama'
      ],
      alatBahan: [
        'Board mikrokontroler, push button untuk trigger interrupt',
        'LED indikator, breadboard, kabel jumper'
      ],
      dasarTeori: 'Interrupt memungkinkan mikrokontroler menghentikan sementara proses utama untuk menjalankan rutin penanganan kejadian tertentu (mis. tombol ditekan) secara cepat tanpa harus memeriksa (polling) status input terus-menerus. Timer internal digunakan untuk menghasilkan interval waktu yang presisi, misalnya untuk penjadwalan tugas berkala.',
      langkahKerja: [
        'Konfigurasi pin interrupt eksternal dan tulis Interrupt Service Routine (ISR) sederhana',
        'Uji respons sistem terhadap trigger interrupt (mis. mengubah status LED)',
        'Konfigurasi timer internal untuk membangkitkan interval waktu tertentu',
        'Bandingkan pendekatan interrupt dengan pendekatan polling/delay pada studi kasus yang sama',
        'Dokumentasikan waktu respons pada masing-masing pendekatan'
      ],
      tugasLaporan: [
        'Listing program interrupt dan timer beserta penjelasan alur ISR',
        'Perbandingan pendekatan polling vs interrupt (kelebihan/kekurangan)',
        'Kesimpulan hasil pengujian'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mk-05',
      judul: 'Komunikasi Serial (UART)',
      pertemuanSaran: 10,
      tujuan: [
        'Memahami prinsip komunikasi serial asinkron (UART)',
        'Mengirim dan menerima data antara mikrokontroler dan komputer via Serial Monitor',
        'Membuat protokol data sederhana untuk mengirim pembacaan sensor'
      ],
      alatBahan: [
        'Board mikrokontroler, kabel USB',
        'Sensor sederhana (mis. sensor suhu/LDR) untuk data yang dikirim'
      ],
      dasarTeori: 'UART (Universal Asynchronous Receiver-Transmitter) adalah protokol komunikasi serial yang mengirim data bit demi bit tanpa sinyal clock bersama, menggunakan kesepakatan baud rate antar perangkat. UART umum dipakai untuk debugging maupun pertukaran data antara mikrokontroler dan komputer atau modul lain.',
      langkahKerja: [
        'Inisialisasi komunikasi serial pada baud rate tertentu',
        'Kirim data teks sederhana dari mikrokontroler ke Serial Monitor',
        'Baca data yang dikirim dari komputer ke mikrokontroler dan proses sesuai perintah (mis. nyalakan/matikan LED)',
        'Baca data sensor dan kirimkan secara berkala melalui UART dengan format data yang jelas',
        'Uji keandalan komunikasi pada beberapa nilai baud rate'
      ],
      tugasLaporan: [
        'Listing program pengirim dan penerima data',
        'Contoh tampilan data pada Serial Monitor',
        'Analisis pengaruh baud rate terhadap keandalan komunikasi'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mk-06',
      judul: 'Komunikasi I2C/SPI dan Modul Tampilan (LCD/OLED)',
      pertemuanSaran: 12,
      tujuan: [
        'Memahami prinsip komunikasi I2C dan/atau SPI antar perangkat',
        'Menghubungkan dan memprogram modul LCD/OLED sebagai tampilan output',
        'Menampilkan data sensor atau status sistem pada modul display'
      ],
      alatBahan: [
        'Board mikrokontroler, modul LCD I2C 16x2 atau OLED SPI/I2C',
        'Sensor tambahan (opsional) untuk data yang ditampilkan'
      ],
      dasarTeori: 'I2C dan SPI adalah protokol komunikasi serial sinkron yang memungkinkan satu mikrokontroler berkomunikasi dengan satu atau beberapa perangkat (sensor, display) menggunakan jalur data yang lebih sedikit dibanding komunikasi paralel. Modul LCD/OLED umumnya menggunakan salah satu dari kedua protokol ini untuk menerima data yang akan ditampilkan.',
      langkahKerja: [
        'Hubungkan modul LCD/OLED ke pin I2C/SPI mikrokontroler sesuai datasheet',
        'Instal pustaka (library) yang sesuai dan uji tampilan teks dasar',
        'Tampilkan data statis (nama, NIM, judul modul) pada layar',
        'Tampilkan data dinamis dari sensor atau input pengguna secara real-time',
        'Uji kestabilan tampilan pada pembaruan data yang cepat'
      ],
      tugasLaporan: [
        'Listing program dan penjelasan konfigurasi komunikasi (alamat I2C/pin SPI)',
        'Foto/dokumentasi tampilan hasil pengujian',
        'Kesimpulan dan kendala yang dihadapi saat interfacing'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mk-07',
      judul: 'Proyek Akhir: Integrasi Sistem Mini (Sensor, Aktuator, dan Tampilan)',
      pertemuanSaran: 14,
      tujuan: [
        'Merancang sistem mikrokontroler yang mengintegrasikan sensor, aktuator, dan tampilan',
        'Menerapkan konsep-konsep sebelumnya (I/O, ADC/PWM, interrupt/timer, komunikasi) dalam satu sistem',
        'Mendemonstrasikan dan mempresentasikan hasil proyek'
      ],
      alatBahan: [
        'Board mikrokontroler, sensor sesuai studi kasus (mis. suhu, cahaya, jarak)',
        'Aktuator (LED, buzzer, motor/relay), modul tampilan (LCD/OLED)',
        'Breadboard/PCB prototyping, catu daya'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan merancang sistem embedded secara utuh: mulai dari akuisisi data sensor, pengolahan logika kendali, hingga aktuasi dan penyajian informasi ke pengguna, sekaligus melatih dokumentasi teknis proyek.',
      langkahKerja: [
        'Tentukan studi kasus dan buat diagram blok sistem (sensor - proses - aktuator/tampilan)',
        'Rancang alur program (flowchart) sistem secara keseluruhan',
        'Implementasikan dan uji tiap modul (sensor, aktuator, tampilan) secara terpisah',
        'Integrasikan seluruh modul menjadi satu sistem dan lakukan pengujian fungsional',
        'Siapkan dokumentasi dan lakukan demonstrasi di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Laporan rancangan lengkap (diagram blok, flowchart, listing program)',
        'Dokumentasi pengujian tiap modul dan sistem terintegrasi',
        'Video/foto demonstrasi serta refleksi kendala dan solusi selama proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // PLC - PROGRAMMABLE LOGIC CONTROL (kode a.l. PEK3206)
  // ==========================================================================
  plc: [
    {
      id: 'plc-01',
      judul: 'Pengenalan Perangkat Keras PLC dan Software Pemrograman Ladder',
      pertemuanSaran: 2,
      tujuan: [
        'Mengenal komponen utama PLC (CPU, modul input/output, power supply) dan wiring dasarnya',
        'Menginstal dan mengoperasikan software pemrograman ladder diagram',
        'Melakukan koneksi PLC-komputer serta upload/download program sederhana'
      ],
      alatBahan: [
        'Unit trainer PLC beserta software pemrograman terkait',
        'Kabel komunikasi PLC-komputer, kabel wiring I/O',
        'Push button, lampu indikator/LED sebagai simulasi beban'
      ],
      dasarTeori: 'PLC (Programmable Logic Control) adalah pengendali berbasis mikroprosesor yang dirancang untuk kebutuhan kontrol industri, diprogram menggunakan bahasa ladder diagram yang merepresentasikan logika kontrol layaknya rangkaian relai. PLC menerima sinyal dari perangkat input (sensor, saklar) dan mengeluarkan sinyal ke perangkat output (lampu, motor, kontaktor) sesuai program yang dibuat.',
      langkahKerja: [
        'Kenali tata letak terminal input/output pada unit trainer PLC',
        'Instal software pemrograman dan hubungkan PLC ke komputer',
        'Wiring sederhana: 1 push button ke input, 1 lampu/LED ke output',
        'Buat program ladder sederhana (1 kontak menggerakkan 1 koil output)',
        'Download program ke PLC dan uji hasilnya secara langsung (online monitoring)'
      ],
      tugasLaporan: [
        'Diagram wiring I/O yang dibuat',
        'Screenshot program ladder sederhana beserta penjelasan tiap elemen',
        'Hasil pengujian dan kendala instalasi/koneksi yang ditemui'
      ],
      k3: 'Pastikan wiring terminal input/output sesuai tegangan kerja PLC (umumnya 24V DC) dan matikan power supply sebelum mengubah pengawatan.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'plc-02',
      judul: 'Instruksi Dasar Ladder Diagram (Kontak, Koil, Logika AND/OR/NOT)',
      pertemuanSaran: 4,
      tujuan: [
        'Menggunakan instruksi dasar ladder: kontak NO/NC, koil output, dan garis daya',
        'Menerapkan logika AND, OR, dan NOT dalam bentuk rangkaian ladder',
        'Membuat program kontrol lampu berbasis kombinasi saklar (studi kasus sederhana)'
      ],
      alatBahan: [
        'Unit trainer PLC dan software pemrograman',
        'Beberapa push button/saklar sebagai input, lampu/LED sebagai output'
      ],
      dasarTeori: 'Ladder diagram menggunakan simbol kontak (mirip kontak relai NO/NC) yang disusun secara seri (logika AND) atau paralel (logika OR) untuk menggerakkan koil output. Kontak NC yang diprogram dari input NO dapat berfungsi sebagai fungsi NOT/negasi terhadap kondisi input tersebut.',
      langkahKerja: [
        'Buat program dengan dua kontak disusun seri (logika AND) untuk menggerakkan satu koil',
        'Buat program dengan dua kontak disusun paralel (logika OR) untuk menggerakkan koil yang sama',
        'Kombinasikan AND dan OR untuk studi kasus sederhana (mis. lampu menyala jika saklar A dan (B atau C) aktif)',
        'Uji tiap kombinasi input dan catat kondisi output pada tabel pengujian',
        'Bandingkan hasil pengujian dengan tabel kebenaran logika yang direncanakan'
      ],
      tugasLaporan: [
        'Listing/gambar program ladder untuk tiap studi kasus',
        'Tabel pengujian kombinasi input-output',
        'Kesimpulan kesesuaian hasil dengan rancangan logika'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'plc-03',
      judul: 'Timer dan Counter pada PLC',
      pertemuanSaran: 6,
      tujuan: [
        'Menerapkan instruksi timer (TON/TOF) untuk kontrol berbasis waktu tunda',
        'Menerapkan instruksi counter (up/down) untuk kontrol berbasis pencacahan kejadian',
        'Mengimplementasikan studi kasus sederhana seperti lampu lalu lintas atau penghitung produk'
      ],
      alatBahan: [
        'Unit trainer PLC dan software pemrograman',
        'Push button (untuk simulasi sensor pencacah), lampu indikator berbagai warna'
      ],
      dasarTeori: 'Timer pada PLC digunakan untuk menunda aktivasi/deaktivasi output selama durasi tertentu (TON = timer on-delay, TOF = timer off-delay), sedangkan counter digunakan untuk menghitung jumlah kejadian/pulsa input, umum dipakai pada aplikasi penghitung produk pada lini produksi.',
      langkahKerja: [
        'Buat program timer on-delay sederhana: output aktif beberapa detik setelah input aktif',
        'Uji dan catat waktu aktual keluaran timer dibanding waktu yang diset',
        'Buat program counter naik: hitung jumlah penekanan push button dan tampilkan pada output/indikator saat mencapai nilai tertentu',
        'Kembangkan studi kasus lampu lalu lintas sederhana (merah-kuning-hijau) menggunakan kombinasi beberapa timer',
        'Uji dan dokumentasikan hasil kerja sistem'
      ],
      tugasLaporan: [
        'Listing/gambar program timer dan counter',
        'Tabel hasil pengujian waktu tunda dan hasil pencacahan',
        'Dokumentasi studi kasus lampu lalu lintas atau penghitung produk'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'plc-04',
      judul: 'Kontrol Sekuensial: Interlock, Start-Stop, dan Forward-Reverse',
      pertemuanSaran: 8,
      tujuan: [
        'Menerapkan rangkaian pengunci (self-holding/latching) pada tombol start-stop',
        'Menerapkan interlock untuk mencegah dua kondisi aktif secara bersamaan (mis. forward-reverse motor)',
        'Memahami prinsip keselamatan kontrol motor berbasis PLC'
      ],
      alatBahan: [
        'Unit trainer PLC dan software pemrograman',
        'Push button start/stop, lampu indikator sebagai simulasi motor forward/reverse'
      ],
      dasarTeori: 'Rangkaian self-holding memungkinkan output tetap aktif meski tombol start sudah dilepas, hingga tombol stop ditekan. Interlock digunakan untuk mencegah dua output yang saling bertentangan aktif bersamaan (mis. arah putar motor maju dan mundur), sebuah prinsip keselamatan penting pada kontrol motor industri.',
      langkahKerja: [
        'Buat program start-stop dengan self-holding contact pada satu output',
        'Uji: tombol start ditekan sesaat, output tetap aktif; tombol stop ditekan, output mati',
        'Kembangkan program forward-reverse dua output dengan interlock (kontak NC dari output lawan disisipkan pada tiap cabang)',
        'Uji skenario menekan tombol forward dan reverse secara bersamaan, pastikan interlock mencegah kedua output aktif bersamaan',
        'Dokumentasikan hasil pengujian seluruh skenario'
      ],
      tugasLaporan: [
        'Listing/gambar program self-holding dan interlock',
        'Tabel skenario pengujian dan hasilnya',
        'Analisis pentingnya interlock dari sisi keselamatan operasi'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'plc-05',
      judul: 'Interfacing Sensor dan Aktuator (Proximity, Limit Switch, Relay/Kontaktor)',
      pertemuanSaran: 10,
      tujuan: [
        'Menghubungkan sensor proximity/limit switch sebagai input PLC',
        'Menghubungkan output PLC ke relay/kontaktor untuk menggerakkan beban yang lebih besar',
        'Membuat program kontrol berbasis umpan balik sensor posisi'
      ],
      alatBahan: [
        'Unit trainer PLC, sensor proximity atau limit switch',
        'Modul relay/kontaktor, lampu indikator sebagai simulasi aktuator'
      ],
      dasarTeori: 'Pada sistem otomasi nyata, PLC berinteraksi dengan dunia fisik melalui sensor (mis. proximity untuk deteksi objek tanpa sentuhan, limit switch untuk deteksi posisi mekanis) sebagai input, dan melalui relay/kontaktor sebagai penghubung ke aktuator berdaya lebih besar seperti motor listrik.',
      langkahKerja: [
        'Pasang sensor proximity/limit switch pada terminal input PLC sesuai wiring diagram',
        'Buat program yang membaca status sensor dan menampilkannya pada output indikator',
        'Hubungkan output PLC ke modul relay, verifikasi kontak relay bekerja sesuai program',
        'Buat studi kasus sederhana: objek terdeteksi sensor -> PLC aktifkan relay -> aktuator (lampu/motor simulasi) bekerja selama waktu tertentu',
        'Uji keandalan sistem dengan beberapa kali simulasi deteksi objek'
      ],
      tugasLaporan: [
        'Diagram wiring sensor dan aktuator ke PLC',
        'Listing/gambar program dan penjelasan logika kontrol',
        'Hasil pengujian dan analisis keandalan sistem'
      ],
      k3: 'Perhatikan rating tegangan/arus kontak relay yang digunakan dan hindari menyentuh terminal output saat sistem bertegangan.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'plc-06',
      judul: 'Proyek Akhir: Simulasi Sistem Otomasi Sederhana',
      pertemuanSaran: 14,
      tujuan: [
        'Merancang sistem kontrol otomasi berbasis PLC untuk studi kasus nyata sederhana (mis. sorting, conveyor, atau pengisian botol)',
        'Mengintegrasikan instruksi dasar, timer/counter, interlock, dan sensor-aktuator dalam satu program',
        'Mendemonstrasikan dan mempresentasikan hasil rancangan'
      ],
      alatBahan: [
        'Unit trainer PLC, miniatur conveyor/sorting (jika tersedia) atau simulasi dengan lampu/motor',
        'Sensor dan aktuator sesuai studi kasus kelompok'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan merancang sistem kontrol otomasi secara utuh: menerjemahkan proses kerja mesin/industri menjadi diagram alur (sequence), lalu mengimplementasikannya sebagai program ladder yang terintegrasi dengan input sensor dan output aktuator.',
      langkahKerja: [
        'Tentukan studi kasus dan buat diagram alur proses (sequence of operation)',
        'Rancang alokasi alamat input/output PLC sesuai kebutuhan sistem',
        'Buat program ladder bertahap: fungsi dasar dulu, lalu tambahkan timer/counter/interlock sesuai kebutuhan',
        'Uji tiap bagian program secara bertahap sebelum digabung menjadi satu sequence utuh',
        'Lakukan uji coba sistem keseluruhan dan siapkan dokumentasi serta demonstrasi'
      ],
      tugasLaporan: [
        'Laporan rancangan lengkap (diagram alur proses, tabel alokasi I/O, listing program ladder)',
        'Dokumentasi pengujian tiap tahap dan sistem terintegrasi',
        'Video/foto demonstrasi serta refleksi kendala dan solusi selama proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ]
};
