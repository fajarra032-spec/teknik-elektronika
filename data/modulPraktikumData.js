/**
 * data/modulPraktikumData.js
 *
 * Konten default "Modul Praktikum" (job sheet) untuk mata kuliah yang
 * bersifat praktik: lihat helpers/modulPraktikumHelper.js (objek
 * JENIS_LABEL) untuk daftar mata kuliah yang didukung saat ini.
 *
 * Ini adalah TEMPLATE/KONSEP AWAL yang mengacu pada topik umum RPS
 * masing-masing mata kuliah (lihat scripts/sync-matakuliah-dari-rps.js untuk
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
  ],

  // ==========================================================================
  // PERANGKAT LUNAK APLIKASI (kode PD3204, semester 1 - mata kuliah dasar
  // "Penciri Dewantara": keterampilan memakai aplikasi perangkat lunak
  // umum untuk mendukung pekerjaan teknik, sebelum masuk ke mata kuliah
  // Aplikasi Komputer di semester berikutnya)
  // ==========================================================================
  perangkat_lunak_aplikasi: [
    {
      id: 'pla-01',
      judul: 'Pengenalan Sistem Operasi dan Manajemen File',
      pertemuanSaran: 2,
      tujuan: [
        'Mengoperasikan dasar sistem operasi (desktop, jendela aplikasi, pengaturan dasar)',
        'Membuat, menyalin, memindah, mengganti nama, dan menghapus file/folder secara terstruktur',
        'Menerapkan penamaan file dan struktur folder yang rapi untuk keperluan tugas kuliah/laporan teknik'
      ],
      alatBahan: [
        'Komputer/laptop dengan sistem operasi terpasang',
        'File explorer/manajer berkas bawaan sistem operasi',
        'Media penyimpanan (flashdisk/cloud storage) untuk latihan backup'
      ],
      dasarTeori: 'Sistem operasi (OS) adalah perangkat lunak dasar yang mengatur sumber daya komputer dan menjadi perantara antara pengguna dengan perangkat keras. Manajemen file yang baik (struktur folder, penamaan konsisten, backup berkala) adalah keterampilan dasar yang menopang seluruh pekerjaan dokumentasi teknis selama perkuliahan maupun di dunia kerja.',
      langkahKerja: [
        'Kenali elemen dasar antarmuka sistem operasi dan pengaturan tampilan/personalisasi',
        'Buat struktur folder untuk penyimpanan tugas per mata kuliah dan per semester',
        'Latihan operasi dasar: buat, salin, pindah, ganti nama, dan hapus file/folder',
        'Latihan kompresi (zip) dan ekstraksi file untuk keperluan pengumpulan tugas',
        'Latihan backup data penting ke media/penyimpanan cloud'
      ],
      tugasLaporan: [
        'Screenshot struktur folder hasil rancangan sendiri beserta penjelasan logika penamaannya',
        'Dokumentasi langkah kompresi dan backup yang dilakukan',
        'Kesimpulan manfaat manajemen file yang rapi bagi mahasiswa teknik'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pla-02',
      judul: 'Pengolah Kata (Word Processor) untuk Penulisan Laporan Teknis',
      pertemuanSaran: 4,
      tujuan: [
        'Mengoperasikan fitur dasar-menengah aplikasi pengolah kata (format teks, paragraf, tabel, gambar)',
        'Menerapkan format penulisan laporan teknis (heading terstruktur, daftar isi otomatis, penomoran halaman)',
        'Menyisipkan dan mengelola tabel, gambar, serta rumus/simbol sederhana pada dokumen teknis'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi pengolah kata terpasang',
        'Contoh data/gambar untuk latihan (tabel data, foto/skema sederhana)'
      ],
      dasarTeori: 'Aplikasi pengolah kata digunakan untuk menyusun dokumen tertulis seperti laporan praktikum, proposal, dan tugas akhir. Penggunaan fitur heading style, daftar isi (table of contents) otomatis, serta penomoran halaman yang konsisten membuat dokumen teknis lebih rapi, mudah dinavigasi, dan sesuai kaidah penulisan ilmiah/teknis.',
      langkahKerja: [
        'Atur format halaman (margin, ukuran kertas, orientasi) sesuai standar laporan teknik',
        'Gunakan heading style berjenjang (Judul, Sub-judul) untuk struktur dokumen',
        'Buat daftar isi otomatis berdasarkan heading yang telah dibuat',
        'Sisipkan dan format tabel data serta gambar/skema lengkap dengan keterangan (caption)',
        'Terapkan penomoran halaman dan header/footer sesuai kebutuhan laporan',
        'Latihan mail merge sederhana (opsional) untuk dokumen massal'
      ],
      tugasLaporan: [
        'Dokumen laporan teknis latihan (minimal 3 halaman) dengan heading, daftar isi otomatis, tabel, dan gambar',
        'Penjelasan singkat fitur yang digunakan dan kegunaannya',
        'Kesimpulan manfaat fitur otomatis (daftar isi, penomoran) dibanding cara manual'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pla-03',
      judul: 'Pengolah Angka (Spreadsheet) untuk Pengolahan Data dan Perhitungan Teknik',
      pertemuanSaran: 6,
      tujuan: [
        'Mengoperasikan fitur dasar-menengah aplikasi pengolah angka (rumus, fungsi, referensi sel)',
        'Menerapkan fungsi matematika, statistik, dan logika dasar untuk pengolahan data pengukuran/pengamatan',
        'Menyajikan data dalam bentuk tabel dan grafik (chart) yang informatif'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi pengolah angka terpasang',
        'Contoh data numerik (mis. hasil pengukuran/pengamatan) untuk latihan'
      ],
      dasarTeori: 'Aplikasi pengolah angka (spreadsheet) memungkinkan pengolahan data numerik secara efisien menggunakan rumus dan fungsi yang dapat dihitung ulang secara otomatis. Kemampuan ini penting bagi mahasiswa teknik untuk merekap data pengukuran, melakukan perhitungan berulang, serta menyajikan hasilnya dalam bentuk tabel dan grafik yang mudah dibaca.',
      langkahKerja: [
        'Kenali konsep sel, baris, kolom, dan referensi sel (relatif vs absolut)',
        'Latihan fungsi dasar (SUM, AVERAGE, MIN, MAX) dan fungsi logika (IF) pada data contoh',
        'Buat tabel rekap data pengukuran dengan perhitungan statistik dasar (rata-rata, nilai maksimum/minimum)',
        'Buat grafik (chart) yang sesuai untuk memvisualisasikan data (grafik garis/batang)',
        'Terapkan pemformatan bersyarat (conditional formatting) sederhana untuk menyoroti data tertentu'
      ],
      tugasLaporan: [
        'File spreadsheet hasil pengolahan data contoh lengkap dengan rumus/fungsi yang digunakan',
        'Grafik hasil visualisasi data beserta penjelasan pemilihan jenis grafik',
        'Kesimpulan efisiensi penggunaan rumus otomatis dibanding perhitungan manual'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pla-04',
      judul: 'Aplikasi Presentasi untuk Penyajian Hasil Kerja',
      pertemuanSaran: 8,
      tujuan: [
        'Mengoperasikan fitur dasar-menengah aplikasi presentasi (slide master, layout, transisi)',
        'Merancang slide presentasi yang ringkas, terstruktur, dan mudah dipahami audiens',
        'Menyisipkan data/grafik hasil olahan spreadsheet ke dalam slide presentasi'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi presentasi terpasang',
        'File hasil olahan data dari modul pengolah angka (untuk disisipkan sebagai grafik)'
      ],
      dasarTeori: 'Aplikasi presentasi digunakan untuk menyampaikan informasi secara visual dan ringkas kepada audiens. Prinsip desain slide yang baik (minim teks, hierarki visual jelas, konsistensi tema) sama pentingnya dengan konten itu sendiri agar pesan tersampaikan secara efektif dalam presentasi teknis maupun sidang tugas.',
      langkahKerja: [
        'Atur tema dan slide master agar tampilan presentasi konsisten',
        'Susun kerangka presentasi (judul, latar belakang, isi, kesimpulan) dalam beberapa slide',
        'Sisipkan grafik/data hasil olahan spreadsheet ke dalam slide',
        'Terapkan animasi/transisi secukupnya agar tidak mengganggu fokus audiens',
        'Latihan presentasi singkat di depan kelas/kelompok kecil dan menerima umpan balik'
      ],
      tugasLaporan: [
        'File presentasi hasil rancangan (minimal 6 slide) sesuai studi kasus yang ditentukan',
        'Refleksi hasil latihan presentasi (masukan yang diterima dan perbaikan yang dilakukan)'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pla-05',
      judul: 'Aplikasi Menggambar/Desain Sederhana untuk Dokumentasi Teknis',
      pertemuanSaran: 10,
      tujuan: [
        'Mengenal aplikasi menggambar/desain sederhana (diagram alur, sketsa, atau gambar vektor dasar)',
        'Membuat diagram blok/flowchart sederhana untuk mendukung dokumentasi teknis',
        'Mengintegrasikan hasil gambar/diagram ke dalam dokumen laporan atau slide presentasi'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi menggambar/diagram sederhana terpasang',
        'Studi kasus sederhana (mis. alur kerja suatu proses) untuk digambarkan'
      ],
      dasarTeori: 'Diagram (blok, alur, atau skematik sederhana) membantu menyampaikan informasi teknis yang kompleks secara visual dan ringkas. Kemampuan membuat diagram yang rapi menggunakan aplikasi menggambar/desain sederhana melengkapi keterampilan dokumentasi teknis mahasiswa, sebelum mempelajari aplikasi gambar teknik yang lebih spesifik di mata kuliah lain.',
      langkahKerja: [
        'Kenali alat-alat dasar aplikasi menggambar (bentuk, garis, teks, pengaturan warna)',
        'Buat diagram alur (flowchart) sederhana dari sebuah studi kasus proses kerja',
        'Rapikan tata letak (alignment, jarak antar objek) agar diagram mudah dibaca',
        'Ekspor hasil gambar/diagram ke format gambar (mis. PNG/JPG) atau salin langsung ke dokumen',
        'Sisipkan hasil diagram ke dalam dokumen laporan atau slide presentasi dari modul sebelumnya'
      ],
      tugasLaporan: [
        'File/gambar diagram alur hasil rancangan sendiri',
        'Contoh dokumen/slide yang telah menyertakan diagram tersebut',
        'Kesimpulan manfaat visualisasi diagram dalam dokumentasi teknis'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pla-06',
      judul: 'Proyek Akhir: Dokumen Laporan Teknis Terintegrasi',
      pertemuanSaran: 14,
      tujuan: [
        'Mengintegrasikan hasil kerja pengolah kata, pengolah angka, presentasi, dan aplikasi gambar dalam satu proyek',
        'Menyusun laporan teknis lengkap dan slide presentasi ringkasnya dari sebuah studi kasus sederhana',
        'Mempresentasikan hasil kerja secara ringkas dan menerima umpan balik'
      ],
      alatBahan: [
        'Komputer/laptop dengan seluruh aplikasi yang telah dipelajari (pengolah kata, angka, presentasi, gambar)',
        'Studi kasus/data sederhana yang ditentukan dosen atau dipilih mahasiswa'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan mengintegrasikan berbagai aplikasi perangkat lunak yang telah dipelajari menjadi satu alur kerja dokumentasi teknis yang utuh: mulai dari pengolahan data, penulisan laporan, pembuatan diagram pendukung, hingga penyajian hasil dalam bentuk presentasi.',
      langkahKerja: [
        'Tentukan studi kasus sederhana (mis. hasil pengamatan/pengukuran suatu topik teknik)',
        'Olah data pada aplikasi pengolah angka dan hasilkan tabel/grafik ringkasan',
        'Buat diagram alur/skema pendukung menggunakan aplikasi menggambar sederhana',
        'Susun laporan teknis lengkap pada aplikasi pengolah kata (menyertakan tabel, grafik, dan diagram)',
        'Ringkas isi laporan menjadi slide presentasi dan lakukan presentasi singkat di depan kelas'
      ],
      tugasLaporan: [
        'Dokumen laporan teknis terintegrasi (pengolah kata) lengkap dengan tabel, grafik, dan diagram',
        'File spreadsheet dan file presentasi pendukung',
        'Refleksi proses kerja dan kendala yang dihadapi selama proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // APLIKASI KOMPUTER (kode PD3206, semester 2 - "Penciri Dewantara":
  // dasar algoritma & pemrograman, sebagai bekal logika sebelum mata
  // kuliah pemrograman yang lebih spesifik seperti Mikrokontroler)
  // ==========================================================================
  aplikasi_komputer: [
    {
      id: 'ak-01',
      judul: 'Algoritma dan Flowchart',
      pertemuanSaran: 2,
      tujuan: [
        'Memahami konsep algoritma sebagai urutan langkah penyelesaian masalah',
        'Menggambarkan algoritma dalam bentuk flowchart menggunakan simbol standar',
        'Menyusun algoritma sederhana untuk studi kasus perhitungan/pengambilan keputusan sehari-hari'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi pembuat flowchart (atau kertas & alat gambar sebagai alternatif)',
        'Studi kasus sederhana (mis. menghitung luas bangun, menentukan bilangan genap/ganjil)'
      ],
      dasarTeori: 'Algoritma adalah urutan langkah logis dan terstruktur untuk menyelesaikan suatu masalah, yang menjadi dasar sebelum menulis kode program. Flowchart adalah representasi visual algoritma menggunakan simbol standar (mulai/selesai, proses, keputusan, input/output) sehingga alur logika lebih mudah dipahami dan dikomunikasikan.',
      langkahKerja: [
        'Kenali simbol-simbol standar flowchart dan fungsinya masing-masing',
        'Susun algoritma dalam bentuk tulisan (pseudocode) untuk studi kasus sederhana',
        'Gambarkan algoritma tersebut ke dalam bentuk flowchart',
        'Telusuri (trace) flowchart dengan beberapa contoh data untuk memverifikasi kebenaran logika',
        'Perbaiki flowchart apabila ditemukan alur yang tidak logis atau tidak lengkap'
      ],
      tugasLaporan: [
        'Pseudocode dan flowchart untuk minimal 2 studi kasus berbeda',
        'Hasil penelusuran (trace table) flowchart dengan beberapa data uji',
        'Kesimpulan pentingnya merancang algoritma sebelum menulis program'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ak-02',
      judul: 'Pengenalan Bahasa Pemrograman: Variabel, Tipe Data, dan Operator',
      pertemuanSaran: 4,
      tujuan: [
        'Mengenal struktur dasar program pada bahasa pemrograman yang dipakai (editor, kompilasi/menjalankan program)',
        'Mendeklarasikan variabel dengan tipe data yang sesuai (bilangan bulat, desimal, teks, boolean)',
        'Menerapkan operator aritmatika, perbandingan, dan logika dalam sebuah program sederhana'
      ],
      alatBahan: [
        'Komputer/laptop dengan editor/IDE bahasa pemrograman yang digunakan terpasang',
        'Contoh soal perhitungan sederhana untuk latihan'
      ],
      dasarTeori: 'Variabel adalah tempat penyimpanan data dalam program yang memiliki tipe data tertentu (menentukan jenis dan ukuran data yang dapat disimpan). Operator digunakan untuk melakukan operasi terhadap variabel/nilai, meliputi operator aritmatika (+, -, *, /), perbandingan (==, >, <), dan logika (AND, OR, NOT).',
      langkahKerja: [
        'Instal/buka editor atau IDE bahasa pemrograman yang digunakan, tulis dan jalankan program "Hello World"',
        'Deklarasikan beberapa variabel dengan tipe data berbeda dan tampilkan nilainya',
        'Latihan operasi aritmatika sederhana (mis. konversi satuan, perhitungan luas/volume)',
        'Latihan operator perbandingan dan logika menggunakan program sederhana',
        'Amati dan catat pesan error umum (mis. tipe data tidak sesuai) beserta cara memperbaikinya'
      ],
      tugasLaporan: [
        'Listing program latihan variabel, tipe data, dan operator beserta hasil keluarannya',
        'Catatan error yang ditemukan selama latihan dan cara mengatasinya',
        'Kesimpulan pentingnya pemilihan tipe data yang tepat'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ak-03',
      judul: 'Struktur Kontrol Percabangan (IF, IF-ELSE, IF Bersarang)',
      pertemuanSaran: 6,
      tujuan: [
        'Menerapkan struktur percabangan IF, IF-ELSE, dan IF bersarang/majemuk dalam program',
        'Menyusun kondisi logika yang tepat untuk pengambilan keputusan dalam program',
        'Menyelesaikan studi kasus sederhana yang memerlukan lebih dari satu kondisi'
      ],
      alatBahan: [
        'Komputer/laptop dengan editor/IDE bahasa pemrograman terpasang',
        'Studi kasus sederhana (mis. penentuan kategori nilai, seleksi kondisi sensor sederhana)'
      ],
      dasarTeori: 'Struktur kontrol percabangan memungkinkan program mengambil keputusan dan menjalankan blok kode berbeda tergantung pada suatu kondisi (benar/salah). IF digunakan untuk satu kondisi, IF-ELSE untuk dua kemungkinan, sedangkan IF bersarang/majemuk (else if) digunakan ketika ada lebih dari dua kemungkinan hasil.',
      langkahKerja: [
        'Buat program sederhana dengan satu kondisi IF (mis. cek bilangan positif/negatif)',
        'Kembangkan menjadi IF-ELSE untuk menangani dua kemungkinan hasil',
        'Buat program dengan IF bersarang/majemuk untuk studi kasus dengan lebih dari dua kategori (mis. penentuan grade nilai)',
        'Uji program dengan beberapa data masukan yang mewakili tiap kemungkinan kondisi',
        'Telusuri kembali logika program menggunakan flowchart dari modul sebelumnya untuk memverifikasi kesesuaian'
      ],
      tugasLaporan: [
        'Listing program untuk tiap jenis struktur percabangan beserta hasil pengujian',
        'Tabel hasil uji dengan beberapa data masukan berbeda',
        'Kesimpulan pemilihan jenis percabangan yang sesuai untuk tiap studi kasus'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ak-04',
      judul: 'Struktur Kontrol Perulangan (For, While, Do-While)',
      pertemuanSaran: 8,
      tujuan: [
        'Menerapkan struktur perulangan For, While, dan Do-While dalam program',
        'Memilih jenis perulangan yang tepat sesuai kebutuhan studi kasus',
        'Menyelesaikan studi kasus yang memerlukan pengulangan proses (mis. penjumlahan deret, pencarian nilai)'
      ],
      alatBahan: [
        'Komputer/laptop dengan editor/IDE bahasa pemrograman terpasang',
        'Studi kasus sederhana (mis. mencetak deret angka, menghitung total dari beberapa data)'
      ],
      dasarTeori: 'Struktur perulangan (looping) digunakan untuk mengulang eksekusi suatu blok kode selama kondisi tertentu masih terpenuhi, sehingga menghindari penulisan kode yang berulang-ulang. For cocok digunakan saat jumlah pengulangan sudah diketahui, sedangkan While dan Do-While lebih fleksibel untuk pengulangan berbasis kondisi yang belum tentu diketahui jumlahnya di awal.',
      langkahKerja: [
        'Buat program perulangan For untuk mencetak deret angka atau pola sederhana',
        'Buat program perulangan While untuk studi kasus dengan jumlah pengulangan tidak tetap',
        'Buat program perulangan Do-While dan bandingkan perilakunya dengan While (minimal satu kali eksekusi)',
        'Kombinasikan perulangan dengan percabangan untuk studi kasus yang lebih kompleks (mis. mencari bilangan prima dalam suatu rentang)',
        'Uji dan dokumentasikan hasil program pada beberapa kasus data'
      ],
      tugasLaporan: [
        'Listing program untuk tiap jenis struktur perulangan beserta hasil keluarannya',
        'Perbandingan karakteristik For, While, dan Do-While',
        'Kesimpulan hasil studi kasus kombinasi perulangan dan percabangan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ak-05',
      judul: 'Fungsi/Prosedur dan Array (Struktur Data Sederhana)',
      pertemuanSaran: 10,
      tujuan: [
        'Membuat dan memanggil fungsi/prosedur untuk memodularkan program',
        'Menggunakan array (larik) untuk menyimpan dan mengolah sekumpulan data sejenis',
        'Menggabungkan fungsi dan array untuk menyelesaikan studi kasus pengolahan data sederhana'
      ],
      alatBahan: [
        'Komputer/laptop dengan editor/IDE bahasa pemrograman terpasang',
        'Studi kasus sederhana (mis. mencari nilai maksimum/minimum dari sekumpulan data)'
      ],
      dasarTeori: 'Fungsi/prosedur adalah blok kode yang dapat dipanggil berulang kali untuk melakukan tugas tertentu, membuat program lebih terstruktur dan mudah dipelihara (modular). Array adalah struktur data yang menyimpan sekumpulan nilai bertipe sama dalam satu variabel, memudahkan pengolahan data dalam jumlah banyak, misalnya hasil pengukuran berulang.',
      langkahKerja: [
        'Buat fungsi sederhana dengan parameter dan nilai kembalian (return value)',
        'Panggil fungsi tersebut beberapa kali dengan data masukan berbeda',
        'Deklarasikan array untuk menyimpan sekumpulan data (mis. hasil pengukuran 10 data)',
        'Buat fungsi untuk mengolah array tersebut (mis. mencari nilai maksimum, minimum, rata-rata)',
        'Uji program dengan beberapa kumpulan data dan dokumentasikan hasilnya'
      ],
      tugasLaporan: [
        'Listing program fungsi dan array beserta hasil pengujian',
        'Penjelasan alur program (parameter masuk, proses, nilai kembalian)',
        'Kesimpulan manfaat penggunaan fungsi dan array untuk program yang lebih terstruktur'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'ak-06',
      judul: 'Proyek Akhir: Program Penyelesai Masalah Sederhana Bidang Teknik',
      pertemuanSaran: 14,
      tujuan: [
        'Merancang algoritma dan program untuk menyelesaikan studi kasus sederhana di bidang teknik elektronika/instrumentasi',
        'Mengintegrasikan variabel, percabangan, perulangan, fungsi, dan array dalam satu program',
        'Mendokumentasikan dan mempresentasikan hasil program yang dibuat'
      ],
      alatBahan: [
        'Komputer/laptop dengan editor/IDE bahasa pemrograman terpasang',
        'Studi kasus pilihan (mis. program konversi satuan pengukuran, kalkulator sederhana, atau pengolah data hasil pengukuran)'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan menyusun program yang lebih utuh, mulai dari perancangan algoritma/flowchart, implementasi kode dengan berbagai struktur kontrol dan struktur data, hingga pengujian dan dokumentasi program - sebagai bekal logika pemrograman sebelum mempelajari pemrograman mikrokontroler.',
      langkahKerja: [
        'Tentukan studi kasus dan susun algoritma/flowchart penyelesaiannya',
        'Implementasikan algoritma menjadi program menggunakan variabel, percabangan, dan perulangan yang sesuai',
        'Modularkan program dengan fungsi, gunakan array bila studi kasus memerlukan pengolahan banyak data',
        'Uji program dengan beberapa skenario data, termasuk data batas (edge case)',
        'Siapkan dokumentasi program dan lakukan demonstrasi singkat di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Laporan rancangan lengkap (deskripsi masalah, algoritma/flowchart, listing program)',
        'Dokumentasi hasil pengujian dengan berbagai skenario data',
        'Refleksi kendala dan solusi yang dilakukan selama pengerjaan proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // DATA DAN SISTEM INFORMASI / DSI (kode PD3210, semester 2 - "Penciri
  // Dewantara": konsep data, basis data, dan sistem informasi sederhana
  // untuk mendukung pengelolaan data teknik di dunia kerja)
  // ==========================================================================
  data_sistem_informasi: [
    {
      id: 'dsi-01',
      judul: 'Konsep Dasar Data, Informasi, dan Sistem Informasi',
      pertemuanSaran: 2,
      tujuan: [
        'Membedakan konsep data, informasi, dan pengetahuan',
        'Memahami komponen dan siklus kerja sebuah sistem informasi (input - proses - output)',
        'Mengidentifikasi contoh sistem informasi sederhana di lingkungan kerja teknik/laboratorium'
      ],
      alatBahan: [
        'Komputer/laptop untuk studi kasus dan diskusi kelompok',
        'Contoh dokumen/form pencatatan data di laboratorium atau bengkel (fisik/digital) sebagai bahan diskusi'
      ],
      dasarTeori: 'Data adalah fakta mentah yang belum memiliki makna, sedangkan informasi adalah data yang telah diolah sehingga bermakna dan berguna bagi penerimanya. Sistem informasi adalah kumpulan komponen (manusia, prosedur, perangkat keras/lunak, data) yang bekerja sama mengolah data menjadi informasi untuk mendukung pengambilan keputusan dan kegiatan operasional, misalnya pencatatan inventaris alat laboratorium.',
      langkahKerja: [
        'Diskusikan contoh data mentah dan bagaimana data tersebut diolah menjadi informasi',
        'Identifikasi komponen input-proses-output pada sebuah sistem pencatatan sederhana yang ada di lingkungan kampus/lab',
        'Gambarkan diagram alur data sederhana (input, proses, output) dari studi kasus yang diidentifikasi',
        'Diskusikan kelompok mengenai potensi masalah bila pengelolaan data dilakukan secara manual/tidak terstruktur'
      ],
      tugasLaporan: [
        'Deskripsi studi kasus sistem pencatatan data yang diamati beserta komponen input-proses-outputnya',
        'Diagram alur data sederhana hasil pengamatan',
        'Kesimpulan pentingnya sistem informasi yang terstruktur untuk pengelolaan data teknik'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dsi-02',
      judul: 'Perancangan Basis Data: Entity Relationship Diagram (ERD)',
      pertemuanSaran: 4,
      tujuan: [
        'Memahami konsep entitas, atribut, dan relasi dalam perancangan basis data',
        'Merancang Entity Relationship Diagram (ERD) untuk studi kasus sederhana',
        'Menentukan kunci utama (primary key) dan kunci tamu (foreign key) pada rancangan tabel'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi pembuat diagram (atau kertas & alat gambar sebagai alternatif)',
        'Studi kasus sederhana (mis. data inventaris alat laboratorium, data peminjaman alat)'
      ],
      dasarTeori: 'Entity Relationship Diagram (ERD) adalah alat bantu visual untuk merancang struktur basis data dengan menggambarkan entitas (objek data, mis. Alat, Mahasiswa), atribut (karakteristik entitas), serta relasi antar entitas (mis. satu mahasiswa dapat meminjam banyak alat). Primary key adalah atribut unik pengenal suatu entitas, sedangkan foreign key adalah atribut yang menghubungkan satu tabel dengan tabel lain.',
      langkahKerja: [
        'Identifikasi entitas-entitas utama dari studi kasus yang dipilih (mis. Alat, Peminjam, Peminjaman)',
        'Tentukan atribut dari masing-masing entitas beserta primary key-nya',
        'Identifikasi relasi antar entitas beserta kardinalitasnya (satu-ke-satu, satu-ke-banyak, banyak-ke-banyak)',
        'Gambarkan ERD lengkap dari studi kasus tersebut',
        'Diskusikan dan revisi ERD bersama kelompok/dosen untuk memastikan tidak ada relasi yang janggal'
      ],
      tugasLaporan: [
        'ERD lengkap dari studi kasus yang dipilih beserta penjelasan tiap entitas dan atributnya',
        'Penjelasan kardinalitas relasi antar entitas',
        'Kesimpulan tantangan yang ditemui saat merancang ERD'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dsi-03',
      judul: 'Implementasi Basis Data dan Query Dasar (SQL)',
      pertemuanSaran: 6,
      tujuan: [
        'Mengimplementasikan rancangan ERD menjadi tabel-tabel pada aplikasi basis data',
        'Menerapkan perintah SQL dasar: SELECT, INSERT, UPDATE, dan DELETE',
        'Melakukan query data sederhana dengan kondisi (WHERE) dan pengurutan (ORDER BY)'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi/sistem manajemen basis data (DBMS) terpasang',
        'Rancangan ERD dari modul sebelumnya sebagai acuan pembuatan tabel'
      ],
      dasarTeori: 'SQL (Structured Query Language) adalah bahasa standar untuk berinteraksi dengan basis data relasional, meliputi pembuatan struktur tabel (DDL) dan pengolahan data di dalamnya (DML: SELECT untuk membaca, INSERT untuk menambah, UPDATE untuk mengubah, DELETE untuk menghapus data). Penguasaan SQL dasar penting untuk mengelola data secara efisien dan akurat.',
      langkahKerja: [
        'Buat tabel-tabel basis data sesuai rancangan ERD (tentukan nama kolom dan tipe data tiap atribut)',
        'Masukkan (INSERT) beberapa data contoh ke dalam tabel yang telah dibuat',
        'Latihan query SELECT untuk menampilkan seluruh data dan data dengan kondisi tertentu (WHERE)',
        'Latihan UPDATE untuk mengubah data tertentu dan DELETE untuk menghapus data tertentu',
        'Latihan pengurutan (ORDER BY) dan query sederhana yang melibatkan lebih dari satu tabel (JOIN dasar, bila memungkinkan)'
      ],
      tugasLaporan: [
        'Struktur tabel yang dibuat beserta data contoh yang dimasukkan',
        'Kumpulan perintah SQL yang telah dilatih (SELECT, INSERT, UPDATE, DELETE) beserta hasil eksekusinya',
        'Kesimpulan kegunaan tiap jenis perintah SQL dalam pengelolaan data'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dsi-04',
      judul: 'Normalisasi Data dan Relasi Antar Tabel',
      pertemuanSaran: 8,
      tujuan: [
        'Memahami tujuan normalisasi data dalam perancangan basis data',
        'Menerapkan normalisasi data hingga bentuk normal ketiga (3NF) secara sederhana',
        'Membangun relasi antar tabel (JOIN) menggunakan primary key dan foreign key'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi/sistem manajemen basis data terpasang',
        'Contoh data tidak ternormalisasi (mis. tabel data peminjaman alat yang masih tercampur) sebagai bahan latihan'
      ],
      dasarTeori: 'Normalisasi adalah proses penataan struktur tabel basis data untuk mengurangi duplikasi data dan menghindari anomali (kesalahan) saat data ditambah, diubah, atau dihapus. Bentuk normal pertama (1NF) menghilangkan data berulang dalam satu sel, bentuk normal kedua (2NF) menghilangkan ketergantungan sebagian pada primary key, dan bentuk normal ketiga (3NF) menghilangkan ketergantungan transitif antar atribut non-kunci.',
      langkahKerja: [
        'Amati contoh tabel data tidak ternormalisasi dan identifikasi masalah/duplikasi yang muncul',
        'Terapkan normalisasi tahap pertama (1NF) dengan memisahkan data berulang',
        'Terapkan normalisasi tahap kedua dan ketiga (2NF, 3NF) hingga struktur tabel lebih efisien',
        'Implementasikan hasil normalisasi sebagai beberapa tabel yang saling berelasi pada basis data',
        'Latihan query JOIN sederhana untuk menggabungkan data dari beberapa tabel hasil normalisasi'
      ],
      tugasLaporan: [
        'Tabel data sebelum dan sesudah normalisasi beserta penjelasan tiap tahap normalisasi',
        'Struktur tabel akhir hasil normalisasi beserta relasinya',
        'Hasil query JOIN dan kesimpulan manfaat normalisasi terhadap kualitas data'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dsi-05',
      judul: 'Visualisasi dan Pelaporan Data',
      pertemuanSaran: 10,
      tujuan: [
        'Mengolah data dari basis data/tabel menjadi ringkasan informasi yang bermakna',
        'Menyajikan data dalam bentuk tabel rekap dan grafik/dashboard sederhana',
        'Menyusun laporan informasi yang komunikatif untuk pengambilan keputusan'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi pengolah data/spreadsheet atau fitur pelaporan pada DBMS yang digunakan',
        'Data hasil query dari modul-modul sebelumnya sebagai bahan visualisasi'
      ],
      dasarTeori: 'Visualisasi data mengubah data mentah/hasil query menjadi bentuk grafis (grafik, dashboard) yang lebih mudah dipahami dan dianalisis dibanding tabel angka semata. Pelaporan data yang baik menyajikan informasi secara ringkas, akurat, dan relevan dengan kebutuhan pengambil keputusan, misalnya laporan kondisi ketersediaan alat laboratorium.',
      langkahKerja: [
        'Ekspor atau salin hasil query data dari basis data ke aplikasi pengolah data',
        'Buat tabel rekap/ringkasan data (mis. jumlah peminjaman per alat, per periode waktu)',
        'Buat grafik yang sesuai untuk merepresentasikan ringkasan data tersebut',
        'Susun laporan singkat yang menggabungkan tabel rekap, grafik, dan narasi analisis',
        'Diskusikan hasil laporan dan bagaimana informasi tersebut dapat mendukung pengambilan keputusan'
      ],
      tugasLaporan: [
        'Tabel rekap dan grafik hasil visualisasi data',
        'Laporan singkat (narasi analisis) berdasarkan hasil visualisasi',
        'Kesimpulan manfaat visualisasi data dibanding tabel data mentah'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dsi-06',
      judul: 'Proyek Akhir: Rancang Bangun Sistem Informasi Sederhana',
      pertemuanSaran: 14,
      tujuan: [
        'Merancang dan mengimplementasikan sistem informasi sederhana untuk studi kasus pengelolaan data di lingkungan teknik/laboratorium',
        'Mengintegrasikan perancangan ERD, implementasi basis data, dan pelaporan/visualisasi data dalam satu proyek',
        'Mendokumentasikan dan mempresentasikan hasil rancangan sistem informasi'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi/sistem manajemen basis data dan aplikasi pengolah data terpasang',
        'Studi kasus pilihan (mis. sistem informasi inventaris alat laboratorium atau pencatatan kehadiran praktikum)'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan merancang sistem informasi secara utuh: mulai dari analisis kebutuhan data, perancangan ERD, implementasi basis data dan query, hingga penyajian informasi dalam bentuk laporan/visualisasi - sebagai simulasi sederhana dari siklus pengembangan sistem informasi di dunia kerja.',
      langkahKerja: [
        'Tentukan studi kasus dan identifikasi kebutuhan data (entitas, atribut, relasi)',
        'Rancang ERD dan implementasikan menjadi struktur tabel pada basis data',
        'Masukkan data contoh dan buat query-query yang dibutuhkan sesuai kebutuhan informasi studi kasus',
        'Susun laporan/visualisasi data hasil query sebagai keluaran sistem informasi',
        'Siapkan dokumentasi rancangan lengkap dan lakukan demonstrasi/presentasi di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Dokumen rancangan lengkap (analisis kebutuhan, ERD, struktur tabel, kumpulan query)',
        'Contoh laporan/visualisasi data hasil implementasi sistem',
        'Refleksi kendala dan solusi yang dilakukan selama pengerjaan proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // RANGKAIAN ELEKTRONIKA (kode PEK3204 - Pilihan Teknik Elektronika/Instrumentasi)
  // Fokus: elektronika analog dasar (komponen pasif, dioda, transistor, op-amp)
  // ==========================================================================
  rangkaian_elektronika: [
    {
      id: 're-01',
      judul: 'Pengukuran dan Karakteristik Komponen Elektronika Dasar',
      pertemuanSaran: 2,
      tujuan: [
        'Mengidentifikasi jenis dan membaca nilai komponen dasar (resistor, kapasitor, induktor) dari kode warna/label',
        'Mengukur nilai resistansi, kapasitansi, dan induktansi menggunakan alat ukur yang sesuai',
        'Membandingkan nilai hasil pengukuran dengan nilai nominal/toleransi komponen'
      ],
      alatBahan: [
        'Multimeter digital (fitur ukur R, C, L bila tersedia) atau LCR meter',
        'Berbagai resistor, kapasitor, dan induktor dengan nilai berbeda',
        'Project board dan kabel jumper'
      ],
      dasarTeori: 'Komponen elektronika pasif (resistor, kapasitor, induktor) memiliki nilai nominal yang ditandai dengan kode warna atau label, serta toleransi yang menunjukkan rentang penyimpangan nilai aktual dari nilai nominalnya. Pengukuran langsung diperlukan untuk memverifikasi kondisi komponen sebelum dipakai pada suatu rangkaian, terutama untuk mendeteksi komponen yang rusak atau nilainya menyimpang jauh dari spesifikasi.',
      langkahKerja: [
        'Baca kode warna/label pada beberapa resistor dan tentukan nilai nominal serta toleransinya',
        'Ukur nilai resistansi aktual menggunakan multimeter dan bandingkan dengan nilai nominal',
        'Ukur nilai kapasitansi beberapa kapasitor menggunakan multimeter/LCR meter (bila tersedia)',
        'Ukur nilai induktansi induktor menggunakan LCR meter (bila tersedia)',
        'Catat dan analisis penyimpangan nilai hasil pengukuran terhadap nilai nominal/toleransi'
      ],
      tugasLaporan: [
        'Tabel hasil pembacaan kode warna/label dan hasil pengukuran tiap komponen',
        'Analisis penyimpangan nilai terukur terhadap nilai nominal dan toleransi',
        'Kesimpulan pentingnya verifikasi komponen sebelum digunakan pada rangkaian'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 're-02',
      judul: 'Rangkaian Dioda: Penyearah (Rectifier) Setengah dan Gelombang Penuh',
      pertemuanSaran: 4,
      tujuan: [
        'Memahami prinsip kerja dioda sebagai penyearah (rectifier) sinyal AC ke DC',
        'Merangkai dan menguji rangkaian penyearah setengah gelombang dan gelombang penuh',
        'Mengamati bentuk gelombang output menggunakan osiloskop dan pengaruh kapasitor filter'
      ],
      alatBahan: [
        'Trafo step-down, dioda (mis. 1N4001/1N4007), kapasitor filter',
        'Project board, osiloskop, multimeter, catu daya AC (dari trafo)'
      ],
      dasarTeori: 'Dioda hanya melewatkan arus pada satu arah sehingga dapat digunakan untuk mengubah sinyal AC menjadi sinyal DC berdenyut (proses penyearahan). Penyearah setengah gelombang menggunakan satu dioda dan hanya memanfaatkan setengah siklus sinyal AC, sedangkan penyearah gelombang penuh (mis. konfigurasi jembatan/bridge dengan 4 dioda) memanfaatkan kedua siklus sehingga riak (ripple) output lebih kecil. Kapasitor filter dipasang untuk meratakan tegangan output.',
      langkahKerja: [
        'Rangkai penyearah setengah gelombang dengan satu dioda, amati bentuk gelombang input dan output pada osiloskop',
        'Rangkai penyearah gelombang penuh (jembatan dioda), bandingkan bentuk gelombang output dengan penyearah setengah gelombang',
        'Tambahkan kapasitor filter pada output dan amati perubahan bentuk gelombang (pengurangan riak)',
        'Ukur tegangan DC output dan riak tegangan (ripple) pada kedua jenis penyearah',
        'Bandingkan efisiensi dan kualitas output kedua jenis rangkaian penyearah'
      ],
      tugasLaporan: [
        'Gambar rangkaian dan bentuk gelombang hasil pengamatan (sebelum/sesudah filter)',
        'Tabel hasil pengukuran tegangan DC dan riak untuk tiap jenis penyearah',
        'Kesimpulan perbandingan penyearah setengah gelombang dan gelombang penuh'
      ],
      k3: 'Berhati-hati saat bekerja dengan tegangan AC dari trafo; pastikan wiring benar sebelum menyalakan sumber tegangan.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 're-03',
      judul: 'Rangkaian Catu Daya (Power Supply) dengan Regulator Tegangan',
      pertemuanSaran: 6,
      tujuan: [
        'Merangkai catu daya DC teregulasi menggunakan IC regulator tegangan (mis. seri 78xx)',
        'Mengukur kestabilan tegangan output terhadap perubahan beban (regulasi beban)',
        'Menerapkan rangkaian pengaman sederhana (mis. sekring/fuse) pada catu daya'
      ],
      alatBahan: [
        'Trafo, dioda bridge, kapasitor filter, IC regulator tegangan (mis. 7805/7812)',
        'Beban uji (resistor daya/lampu), sekring, multimeter, osiloskop'
      ],
      dasarTeori: 'IC regulator tegangan menjaga tegangan output tetap stabil pada nilai tertentu meskipun terjadi perubahan tegangan input atau perubahan beban, dengan cara mengatur arus yang dilewatkan secara otomatis. Rangkaian catu daya lengkap umumnya terdiri dari transformator (step-down tegangan), penyearah (rectifier), filter (kapasitor), dan regulator tegangan, ditambah komponen pengaman seperti sekring.',
      langkahKerja: [
        'Rangkai catu daya penyearah dan filter (dari modul sebelumnya) sebagai input regulator',
        'Tambahkan IC regulator tegangan pada output filter dan ukur tegangan keluarannya',
        'Uji regulasi beban: ukur tegangan output pada beberapa nilai beban berbeda',
        'Amati bentuk gelombang output sebelum dan sesudah regulator menggunakan osiloskop',
        'Pasang sekring pada jalur input sebagai pengaman dan jelaskan fungsinya'
      ],
      tugasLaporan: [
        'Gambar rangkaian catu daya lengkap (trafo-penyearah-filter-regulator)',
        'Tabel hasil pengujian regulasi beban (tegangan output vs beban)',
        'Kesimpulan kestabilan tegangan output dan pentingnya rangkaian pengaman'
      ],
      k3: 'Perhatikan arus maksimum IC regulator dan gunakan heatsink bila diperlukan agar IC tidak overheat.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 're-04',
      judul: 'Transistor sebagai Saklar dan Penguat (Amplifier) Sederhana',
      pertemuanSaran: 8,
      tujuan: [
        'Memahami prinsip kerja transistor bipolar (BJT) pada mode saklar dan mode penguat',
        'Merangkai transistor sebagai saklar elektronik untuk mengendalikan beban (LED/relay)',
        'Merangkai dan menguji penguat transistor sederhana (common emitter) serta mengukur penguatannya'
      ],
      alatBahan: [
        'Transistor NPN (mis. BC547/2N2222), resistor bias, LED/modul relay',
        'Function generator, osiloskop, project board, catu daya DC'
      ],
      dasarTeori: 'Transistor bipolar dapat dioperasikan pada dua mode utama: mode saklar (bekerja pada kondisi saturasi/cutoff untuk menghidupkan-matikan beban) dan mode penguat/aktif (bekerja pada daerah linear untuk memperkuat sinyal). Pada mode penguat common emitter, sinyal input kecil pada basis menghasilkan perubahan arus kolektor yang lebih besar, sehingga sinyal output pada kolektor menjadi versi yang diperkuat dari sinyal input.',
      langkahKerja: [
        'Rangkai transistor sebagai saklar untuk menyalakan LED berdasarkan sinyal digital input',
        'Uji rangkaian saklar transistor untuk mengendalikan beban yang lebih besar (mis. lewat relay)',
        'Rangkai penguat common emitter sederhana dengan bias yang sesuai',
        'Berikan sinyal AC kecil dari function generator ke input penguat, amati sinyal output pada osiloskop',
        'Hitung dan ukur faktor penguatan (gain) tegangan dari perbandingan amplitudo output terhadap input'
      ],
      tugasLaporan: [
        'Gambar rangkaian saklar dan penguat transistor beserta hasil pengujian',
        'Bentuk gelombang input-output penguat dan perhitungan faktor penguatan',
        'Kesimpulan perbedaan karakteristik transistor pada mode saklar dan mode penguat'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 're-05',
      judul: 'Rangkaian Op-Amp Dasar: Penguat Inverting, Non-Inverting, dan Komparator',
      pertemuanSaran: 10,
      tujuan: [
        'Memahami karakteristik dasar penguat operasional (op-amp) sebagai penguat ideal',
        'Merangkai dan menguji penguat inverting dan non-inverting menggunakan IC op-amp',
        'Merangkai rangkaian komparator sederhana menggunakan op-amp'
      ],
      alatBahan: [
        'IC op-amp (mis. LM741/LM358), resistor sesuai kebutuhan rangkaian',
        'Function generator, osiloskop, project board, catu daya DC (dual supply bila diperlukan)'
      ],
      dasarTeori: 'Op-amp (operational amplifier) adalah IC penguat serba guna yang penguatannya ditentukan oleh rangkaian resistor eksternal (umpan balik). Konfigurasi inverting menghasilkan sinyal output yang berlawanan fasa dengan input, sedangkan non-inverting menghasilkan output sefasa dengan input. Op-amp tanpa umpan balik negatif (open loop) dapat berfungsi sebagai komparator yang membandingkan dua level tegangan.',
      langkahKerja: [
        'Rangkai penguat inverting dengan penguatan tertentu (tentukan nilai resistor sesuai target penguatan)',
        'Berikan sinyal input dari function generator dan amati sinyal output pada osiloskop, verifikasi penguatan dan pembalikan fasa',
        'Rangkai penguat non-inverting, lakukan pengujian serupa dan bandingkan hasilnya',
        'Rangkai op-amp sebagai komparator sederhana (mis. membandingkan tegangan input dengan tegangan referensi)',
        'Uji rangkaian komparator dengan beberapa level tegangan input dan amati perubahan kondisi output'
      ],
      tugasLaporan: [
        'Gambar rangkaian dan hasil pengujian penguat inverting dan non-inverting (bentuk gelombang, penguatan terukur vs perhitungan)',
        'Hasil pengujian rangkaian komparator pada beberapa level tegangan',
        'Kesimpulan perbandingan karakteristik ketiga rangkaian op-amp yang diuji'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 're-06',
      judul: 'Proyek Akhir: Rangkaian Elektronika Terapan',
      pertemuanSaran: 14,
      tujuan: [
        'Merancang dan merealisasikan rangkaian elektronika terapan yang mengintegrasikan beberapa konsep (penyearah, regulator, transistor, dan/atau op-amp)',
        'Menguji dan menganalisis kinerja rangkaian yang dibuat sesuai spesifikasi target',
        'Mendokumentasikan dan mempresentasikan hasil rancangan'
      ],
      alatBahan: [
        'Komponen sesuai rancangan kelompok (dioda, transistor, IC regulator/op-amp, dsb.)',
        'Project board/PCB prototyping, alat ukur (multimeter, osiloskop), catu daya'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan merancang rangkaian elektronika analog yang lebih utuh dan aplikatif, misalnya catu daya teregulasi dengan indikator LED, atau penguat audio sederhana, dengan menggabungkan beberapa blok fungsi (penyearah, filter, regulator, penguat) yang telah dipelajari pada modul-modul sebelumnya.',
      langkahKerja: [
        'Tentukan studi kasus/spesifikasi target rangkaian (mis. catu daya ganda dengan indikator, atau penguat audio sederhana)',
        'Rancang diagram blok dan skematik rangkaian sesuai spesifikasi',
        'Rakit dan uji tiap blok rangkaian secara terpisah sebelum digabungkan',
        'Integrasikan seluruh blok dan lakukan pengujian sistem secara keseluruhan terhadap spesifikasi target',
        'Siapkan dokumentasi dan lakukan demonstrasi di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Laporan rancangan lengkap (spesifikasi target, diagram blok, skematik rangkaian)',
        'Dokumentasi pengujian tiap blok dan sistem terintegrasi terhadap spesifikasi',
        'Refleksi kendala dan solusi yang dilakukan selama proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // TEKNIK PENGUKURAN (kode PD3207, semester 2 - "Penciri Dewantara")
  // Fokus: penggunaan alat ukur listrik/elektronik dasar dan konsep
  // ketidakpastian pengukuran/kalibrasi
  // ==========================================================================
  teknik_pengukuran: [
    {
      id: 'tp-01',
      judul: 'Pengenalan dan Penggunaan Alat Ukur Dasar (Multimeter Analog dan Digital)',
      pertemuanSaran: 2,
      tujuan: [
        'Mengenal bagian-bagian dan fungsi multimeter analog dan digital',
        'Memilih rentang ukur (range) dan mode pengukuran yang tepat sesuai besaran yang diukur',
        'Melakukan pengukuran dasar tegangan, arus, dan resistansi dengan benar dan aman'
      ],
      alatBahan: [
        'Multimeter analog dan multimeter digital',
        'Rangkaian resistor sederhana dan catu daya DC untuk latihan pengukuran'
      ],
      dasarTeori: 'Multimeter adalah alat ukur serba guna yang dapat mengukur tegangan (voltmeter), arus (amperemeter), dan resistansi (ohmmeter). Multimeter analog menampilkan hasil ukur melalui jarum penunjuk pada skala, sedangkan multimeter digital menampilkan hasil ukur dalam bentuk angka digital yang lebih presisi dan mudah dibaca. Pemilihan rentang ukur yang tepat penting untuk mendapatkan hasil ukur yang akurat dan menjaga keselamatan alat.',
      langkahKerja: [
        'Kenali bagian-bagian multimeter analog dan digital serta fungsi selector/rentang ukurnya',
        'Latihan mengukur tegangan DC pada catu daya dengan rentang ukur yang sesuai',
        'Latihan mengukur arus DC pada rangkaian sederhana (perhatikan cara pemasangan seri amperemeter)',
        'Latihan mengukur resistansi beberapa resistor (pastikan rangkaian tidak dalam kondisi bertegangan)',
        'Bandingkan hasil pengukuran multimeter analog dan digital untuk besaran yang sama'
      ],
      tugasLaporan: [
        'Tabel hasil pengukuran tegangan, arus, dan resistansi menggunakan kedua jenis multimeter',
        'Perbandingan kemudahan dan ketelitian pembacaan multimeter analog vs digital',
        'Kesimpulan prosedur pengukuran yang aman dan tepat'
      ],
      k3: 'Selalu matikan sumber tegangan sebelum mengukur resistansi, dan pastikan selector multimeter sesuai besaran yang diukur untuk menghindari kerusakan alat.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'tp-02',
      judul: 'Pengukuran Tegangan, Arus, dan Resistansi pada Rangkaian DC',
      pertemuanSaran: 4,
      tujuan: [
        'Menerapkan teknik pengukuran tegangan dan arus pada rangkaian seri, paralel, dan campuran',
        'Memverifikasi hukum Ohm dan hukum Kirchhoff melalui pengukuran langsung',
        'Menganalisis penyimpangan hasil pengukuran terhadap perhitungan teoritis'
      ],
      alatBahan: [
        'Multimeter digital, project board, resistor berbagai nilai, catu daya DC'
      ],
      dasarTeori: 'Hukum Ohm menyatakan hubungan tegangan, arus, dan resistansi pada suatu rangkaian (V = I x R), sedangkan hukum Kirchhoff menjelaskan kekekalan arus pada suatu titik percabangan (KCL) dan kekekalan tegangan pada suatu loop tertutup (KVL). Pengukuran langsung pada rangkaian nyata digunakan untuk memverifikasi hukum-hukum tersebut sekaligus melatih ketelitian dan teknik pengukuran yang benar.',
      langkahKerja: [
        'Rangkai rangkaian resistor seri sederhana, ukur tegangan pada tiap resistor dan arus yang mengalir',
        'Bandingkan hasil pengukuran dengan perhitungan teoritis menggunakan hukum Ohm',
        'Rangkai rangkaian resistor paralel, ukur tegangan dan arus pada tiap cabang',
        'Verifikasi hukum Kirchhoff (KCL/KVL) dari data hasil pengukuran',
        'Analisis penyebab penyimpangan (bila ada) antara hasil pengukuran dan perhitungan teoritis'
      ],
      tugasLaporan: [
        'Data hasil pengukuran dan perhitungan teoritis untuk rangkaian seri dan paralel',
        'Verifikasi hukum Ohm dan Kirchhoff berdasarkan data yang diperoleh',
        'Analisis penyimpangan hasil pengukuran dan kemungkinan penyebabnya'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'tp-03',
      judul: 'Penggunaan Osiloskop untuk Pengukuran Sinyal AC',
      pertemuanSaran: 6,
      tujuan: [
        'Mengenal bagian-bagian dan fungsi kontrol dasar osiloskop',
        'Melakukan kalibrasi probe dan pengaturan skala tegangan (volt/div) serta waktu (time/div)',
        'Mengukur amplitudo, periode, dan frekuensi sinyal AC menggunakan osiloskop'
      ],
      alatBahan: [
        'Osiloskop dan probe osiloskop',
        'Function generator sebagai sumber sinyal AC uji'
      ],
      dasarTeori: 'Osiloskop adalah alat ukur yang menampilkan bentuk gelombang sinyal listrik terhadap waktu, memungkinkan pengamatan visual karakteristik sinyal seperti amplitudo, periode, frekuensi, dan bentuk gelombang (sinus, kotak, segitiga). Pengaturan volt/div menentukan skala tegangan pada sumbu vertikal, sedangkan time/div menentukan skala waktu pada sumbu horizontal layar osiloskop.',
      langkahKerja: [
        'Kalibrasi probe osiloskop menggunakan sinyal kalibrasi bawaan osiloskop',
        'Hubungkan output function generator ke osiloskop, atur volt/div dan time/div agar sinyal tertampil jelas',
        'Ukur amplitudo (tegangan peak-to-peak) sinyal dari layar osiloskop',
        'Ukur periode sinyal dari layar osiloskop dan hitung frekuensinya, bandingkan dengan nilai yang diatur pada function generator',
        'Ulangi pengukuran untuk beberapa bentuk gelombang (sinus, kotak, segitiga) dan beberapa nilai frekuensi'
      ],
      tugasLaporan: [
        'Tabel hasil pengukuran amplitudo, periode, dan frekuensi untuk beberapa sinyal uji',
        'Perbandingan frekuensi hasil pengukuran dengan pengaturan pada function generator',
        'Kesimpulan fungsi dan manfaat osiloskop dibanding multimeter untuk pengukuran sinyal AC'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'tp-04',
      judul: 'Penggunaan Generator Fungsi (Function Generator) dan Pengukuran Frekuensi',
      pertemuanSaran: 8,
      tujuan: [
        'Mengoperasikan function generator untuk menghasilkan berbagai bentuk dan frekuensi sinyal',
        'Mengukur frekuensi sinyal menggunakan frequency counter dan/atau osiloskop',
        'Mengamati pengaruh perubahan frekuensi terhadap respon suatu rangkaian sederhana (mis. filter RC)'
      ],
      alatBahan: [
        'Function generator, frequency counter (bila tersedia), osiloskop',
        'Rangkaian filter RC sederhana (low-pass/high-pass) sebagai beban uji'
      ],
      dasarTeori: 'Function generator adalah alat yang menghasilkan sinyal listrik dengan bentuk gelombang (sinus, kotak, segitiga), frekuensi, dan amplitudo yang dapat diatur, umum digunakan sebagai sumber sinyal uji dalam pengukuran karakteristik suatu rangkaian. Pengukuran frekuensi dapat dilakukan dengan frequency counter (pembacaan langsung) atau dihitung dari periode sinyal yang teramati pada osiloskop.',
      langkahKerja: [
        'Atur function generator untuk menghasilkan sinyal sinus dengan frekuensi dan amplitudo tertentu',
        'Ukur frekuensi sinyal tersebut menggunakan frequency counter dan/atau osiloskop, bandingkan dengan pengaturan',
        'Hubungkan sinyal function generator ke rangkaian filter RC sederhana',
        'Ubah frekuensi sinyal input secara bertahap dan amati perubahan amplitudo output pada osiloskop',
        'Identifikasi frekuensi cut-off filter berdasarkan data pengamatan (amplitudo output turun signifikan)'
      ],
      tugasLaporan: [
        'Tabel hasil pengukuran frekuensi pada beberapa pengaturan function generator',
        'Tabel hasil pengamatan amplitudo output filter RC terhadap variasi frekuensi input',
        'Kesimpulan perkiraan frekuensi cut-off filter dan penjelasan singkat prinsip kerjanya'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'tp-05',
      judul: 'Ketidakpastian Pengukuran (Kesalahan Pengukuran) dan Kalibrasi Alat Ukur',
      pertemuanSaran: 10,
      tujuan: [
        'Membedakan jenis-jenis kesalahan pengukuran (kesalahan sistematis, acak, dan kekeliruan)',
        'Menghitung ketidakpastian pengukuran dari data pengukuran berulang',
        'Memahami konsep dan pentingnya kalibrasi alat ukur secara berkala'
      ],
      alatBahan: [
        'Multimeter/alat ukur lain yang telah digunakan pada modul sebelumnya',
        'Sumber tegangan/resistansi referensi yang nilainya diketahui (bila tersedia) untuk latihan kalibrasi'
      ],
      dasarTeori: 'Setiap hasil pengukuran memiliki ketidakpastian yang perlu dilaporkan bersama nilai hasil ukurnya. Kesalahan sistematis bersifat konsisten dan dapat dikoreksi (mis. akibat alat yang tidak terkalibrasi), kesalahan acak bersifat fluktuatif dan dianalisis secara statistik, sedangkan kekeliruan terjadi akibat kesalahan pengamat/prosedur. Kalibrasi adalah proses membandingkan alat ukur dengan standar acuan untuk memastikan hasil ukurannya tetap akurat dan tertelusur.',
      langkahKerja: [
        'Lakukan pengukuran berulang (mis. 10 kali) pada satu besaran yang sama menggunakan alat ukur yang sama',
        'Hitung nilai rata-rata, simpangan, dan ketidakpastian pengukuran dari data yang diperoleh',
        'Identifikasi kemungkinan sumber kesalahan sistematis dan acak dari prosedur pengukuran yang dilakukan',
        'Diskusikan konsep kalibrasi dan lakukan simulasi/pembandingan alat ukur dengan nilai referensi (bila tersedia)',
        'Diskusikan dampak alat ukur yang tidak terkalibrasi terhadap keputusan teknis di lapangan'
      ],
      tugasLaporan: [
        'Data pengukuran berulang beserta perhitungan rata-rata dan ketidakpastian pengukuran',
        'Analisis sumber kesalahan sistematis dan acak yang teridentifikasi',
        'Kesimpulan pentingnya kalibrasi alat ukur secara berkala'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'tp-06',
      judul: 'Proyek Akhir: Pengukuran dan Analisis Karakteristik Rangkaian',
      pertemuanSaran: 14,
      tujuan: [
        'Merancang prosedur pengukuran yang tepat untuk mengkarakterisasi sebuah rangkaian sederhana',
        'Melakukan pengukuran menggunakan kombinasi alat ukur (multimeter, osiloskop, function generator)',
        'Menganalisis dan menyajikan hasil pengukuran secara sistematis dalam bentuk laporan'
      ],
      alatBahan: [
        'Multimeter, osiloskop, function generator',
        'Rangkaian uji sesuai studi kasus (mis. filter RC, rangkaian pembagi tegangan, atau rangkaian sederhana lain)'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan merancang dan melaksanakan prosedur pengukuran yang tepat untuk mengkarakterisasi suatu rangkaian secara menyeluruh, meliputi pengukuran besaran DC, respon frekuensi (bila relevan), serta analisis ketidakpastian hasil pengukuran, sebagai simulasi tugas pengukuran teknis di dunia kerja.',
      langkahKerja: [
        'Tentukan studi kasus rangkaian yang akan dikarakterisasi dan besaran-besaran yang perlu diukur',
        'Susun prosedur pengukuran (alat yang digunakan, urutan langkah, titik ukur) untuk studi kasus tersebut',
        'Laksanakan pengukuran sesuai prosedur yang disusun, catat seluruh data dengan rapi',
        'Analisis data hasil pengukuran (termasuk estimasi ketidakpastian bila relevan) dan bandingkan dengan nilai teoritis/spesifikasi',
        'Susun laporan hasil karakterisasi rangkaian dan presentasikan temuan di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Prosedur pengukuran yang disusun beserta alasan pemilihan alat dan titik ukur',
        'Data hasil pengukuran lengkap dan hasil analisis (termasuk perbandingan dengan nilai teoritis)',
        'Kesimpulan dan refleksi kendala yang dihadapi selama proses pengukuran'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // MENGGAMBAR TEKNIK (kode PD3209, semester 2 - "Penciri Dewantara")
  // Fokus: standar gambar teknik, proyeksi, dan pengenalan aplikasi CAD
  // untuk gambar/skematik kelistrikan-elektronika
  // ==========================================================================
  menggambar_teknik: [
    {
      id: 'mgt-01',
      judul: 'Standar dan Etiket Gambar Teknik',
      pertemuanSaran: 2,
      tujuan: [
        'Memahami standar garis, huruf, dan skala pada gambar teknik',
        'Membuat etiket (kop) gambar sesuai standar yang berlaku',
        'Menerapkan kerapian dan kejelasan garis sesuai fungsinya (garis tepi, garis bantu, garis ukuran, dsb.)'
      ],
      alatBahan: [
        'Kertas gambar, pensil/rapido dengan berbagai ketebalan, penggaris/mistar, jangka',
        'Contoh format etiket gambar teknik standar'
      ],
      dasarTeori: 'Gambar teknik memiliki standar baku (mis. standar ISO) mengenai jenis dan ketebalan garis, jenis huruf/angka, serta skala penggambaran agar gambar dapat dipahami secara seragam oleh siapa pun yang membacanya, tanpa memerlukan penjelasan tambahan dari pembuat gambar. Etiket (kop) gambar berisi informasi penting seperti judul gambar, skala, satuan, nama pembuat, dan nomor gambar.',
      langkahKerja: [
        'Kenali jenis-jenis garis pada gambar teknik (garis tepi, garis benda, garis bantu, garis ukuran, garis sumbu) beserta fungsinya',
        'Latihan membuat berbagai jenis garis dengan ketebalan yang sesuai standar',
        'Latihan menulis huruf dan angka standar gambar teknik',
        'Buat etiket (kop) gambar sesuai format standar yang ditentukan',
        'Susun sebuah lembar gambar sederhana lengkap dengan etiket dan garis tepi'
      ],
      tugasLaporan: [
        'Lembar latihan jenis-jenis garis dan huruf/angka standar gambar teknik',
        'Etiket gambar hasil rancangan sendiri sesuai format standar',
        'Kesimpulan pentingnya standardisasi dalam gambar teknik'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mgt-02',
      judul: 'Proyeksi Ortogonal dan Gambar Pandangan (Tampak Atas, Depan, Samping)',
      pertemuanSaran: 4,
      tujuan: [
        'Memahami konsep proyeksi ortogonal (proyeksi Eropa/Amerika) untuk menggambarkan benda 3 dimensi',
        'Menggambar pandangan depan, atas, dan samping dari sebuah benda sederhana',
        'Memverifikasi kesesuaian antar pandangan (konsistensi ukuran dan posisi)'
      ],
      alatBahan: [
        'Kertas gambar, pensil, penggaris/mistar, jangka',
        'Model/benda sederhana (mis. balok berlubang, siku, atau benda kerja sederhana) sebagai objek gambar'
      ],
      dasarTeori: 'Proyeksi ortogonal adalah metode menggambarkan objek 3 dimensi ke dalam beberapa pandangan 2 dimensi (tampak depan, atas, samping) yang saling berkaitan, sehingga bentuk benda dapat dipahami secara lengkap tanpa ambigu. Terdapat dua sistem proyeksi yang umum digunakan yaitu proyeksi Eropa (kuadran I) dan proyeksi Amerika (kuadran III), yang berbeda pada tata letak pandangan.',
      langkahKerja: [
        'Amati bentuk benda sederhana yang akan digambar dari berbagai sisi',
        'Gambar pandangan depan benda tersebut sesuai proporsi yang benar',
        'Gambar pandangan atas dan samping dengan memperhatikan kesesuaian ukuran terhadap pandangan depan',
        'Susun ketiga pandangan dalam satu lembar gambar sesuai tata letak proyeksi yang ditentukan (Eropa/Amerika)',
        'Periksa kembali kesesuaian ukuran dan posisi antar pandangan'
      ],
      tugasLaporan: [
        'Gambar tiga pandangan (depan, atas, samping) dari benda yang ditentukan',
        'Penjelasan sistem proyeksi yang digunakan (Eropa/Amerika) beserta simbolnya',
        'Kesimpulan tantangan yang dihadapi dalam menyelaraskan antar pandangan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mgt-03',
      judul: 'Dimensi (Ukuran) dan Toleransi pada Gambar Teknik',
      pertemuanSaran: 6,
      tujuan: [
        'Menerapkan aturan pemberian ukuran (dimensioning) pada gambar teknik',
        'Memahami konsep toleransi ukuran dan alasan penerapannya pada komponen teknik',
        'Melengkapi gambar pandangan dari modul sebelumnya dengan ukuran dan toleransi yang sesuai'
      ],
      alatBahan: [
        'Gambar pandangan hasil modul sebelumnya, pensil, penggaris/mistar',
        'Contoh tabel toleransi standar (bila tersedia) sebagai acuan'
      ],
      dasarTeori: 'Dimensi (ukuran) pada gambar teknik menunjukkan besaran fisik suatu benda (panjang, lebar, diameter, dsb.) yang harus dicantumkan dengan aturan tertentu (garis ukuran, garis bantu, angka ukuran) agar mudah dibaca dan tidak ambigu. Toleransi adalah batas penyimpangan ukuran yang masih diperbolehkan agar komponen tetap dapat berfungsi dan saling dipasangkan (interchangeable) dengan komponen lain, penting terutama untuk komponen yang diproduksi secara massal.',
      langkahKerja: [
        'Pelajari aturan dasar pemberian ukuran (posisi garis ukur, arah angka, jarak antar garis ukur)',
        'Tambahkan ukuran pada gambar tiga pandangan dari modul sebelumnya sesuai aturan dimensioning',
        'Tentukan toleransi yang sesuai untuk beberapa ukuran penting pada gambar (berdasarkan fungsi komponen)',
        'Periksa kembali kelengkapan dan konsistensi ukuran pada seluruh pandangan gambar',
        'Diskusikan dampak toleransi yang terlalu ketat atau terlalu longgar terhadap proses produksi'
      ],
      tugasLaporan: [
        'Gambar teknik lengkap dengan ukuran dan toleransi pada bagian-bagian penting',
        'Penjelasan alasan pemilihan nilai toleransi pada beberapa ukuran kritis',
        'Kesimpulan pentingnya dimensi dan toleransi yang tepat pada gambar teknik'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mgt-04',
      judul: 'Pengenalan Aplikasi CAD (Computer Aided Design) untuk Gambar Teknik',
      pertemuanSaran: 8,
      tujuan: [
        'Mengenal antarmuka dan perintah dasar aplikasi CAD untuk gambar teknik 2 dimensi',
        'Menggambar ulang (redraw) gambar manual sebelumnya menggunakan aplikasi CAD',
        'Menerapkan fitur dasar CAD (layer, dimensi otomatis, cetak/print skala)'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi CAD 2D terpasang',
        'Gambar manual (pandangan + dimensi) dari modul-modul sebelumnya sebagai acuan'
      ],
      dasarTeori: 'Aplikasi CAD (Computer Aided Design) memungkinkan pembuatan gambar teknik secara digital dengan presisi tinggi, mudah diedit, dan dapat dicetak sesuai skala yang diinginkan. Penggunaan layer memisahkan elemen gambar (garis benda, garis ukuran, teks) berdasarkan fungsinya, sedangkan fitur dimensi otomatis mempercepat proses pemberian ukuran dibanding cara manual.',
      langkahKerja: [
        'Kenali antarmuka aplikasi CAD dan perintah dasar (garis, lingkaran, offset, trim, dsb.)',
        'Atur layer sesuai kebutuhan (garis benda, garis bantu, garis ukuran, teks)',
        'Gambar ulang salah satu pandangan dari gambar manual sebelumnya menggunakan aplikasi CAD',
        'Tambahkan dimensi menggunakan fitur dimensi otomatis pada aplikasi CAD',
        'Atur skala cetak dan cetak/ekspor gambar ke format yang dapat dibagikan (mis. PDF)'
      ],
      tugasLaporan: [
        'File/hasil cetak gambar CAD dari pandangan yang digambar ulang',
        'Penjelasan pengaturan layer dan fitur CAD yang digunakan',
        'Kesimpulan perbandingan efisiensi menggambar manual vs menggunakan CAD'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mgt-05',
      judul: 'Gambar Skematik/Diagram Rangkaian Elektronik-Kelistrikan menggunakan CAD',
      pertemuanSaran: 10,
      tujuan: [
        'Mengenal simbol-simbol standar komponen elektronik/kelistrikan pada gambar skematik',
        'Menggambar diagram skematik rangkaian sederhana menggunakan aplikasi CAD',
        'Menyusun diagram pengawatan (wiring diagram) dari suatu skematik rangkaian'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi CAD (2D umum atau CAD elektrik/skematik bila tersedia)',
        'Contoh rangkaian sederhana (mis. rangkaian lampu dengan saklar, atau rangkaian elektronik dari mata kuliah lain) sebagai studi kasus'
      ],
      dasarTeori: 'Gambar skematik menggunakan simbol-simbol standar untuk merepresentasikan komponen elektronik/kelistrikan (resistor, kapasitor, saklar, sumber tegangan, dsb.) beserta hubungan antar komponen tersebut, tanpa menggambarkan bentuk fisik sebenarnya. Diagram pengawatan (wiring diagram) melengkapi skematik dengan informasi tata letak dan jalur kabel fisik untuk keperluan instalasi/perakitan.',
      langkahKerja: [
        'Kenali simbol-simbol standar komponen elektronik/kelistrikan yang umum digunakan',
        'Gambar diagram skematik dari studi kasus rangkaian sederhana yang ditentukan menggunakan aplikasi CAD',
        'Beri label/keterangan pada tiap komponen (nilai, nama komponen) sesuai standar',
        'Susun diagram pengawatan (wiring diagram) sederhana berdasarkan skematik yang telah dibuat',
        'Periksa kembali kesesuaian skematik dengan rangkaian nyata/studi kasus yang diacu'
      ],
      tugasLaporan: [
        'File/hasil cetak gambar skematik dan diagram pengawatan dari studi kasus yang ditentukan',
        'Daftar simbol komponen yang digunakan beserta keterangannya',
        'Kesimpulan manfaat gambar skematik dan wiring diagram dalam pekerjaan teknik elektronika'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'mgt-06',
      judul: 'Proyek Akhir: Gambar Kerja Lengkap untuk Studi Kasus Sederhana',
      pertemuanSaran: 14,
      tujuan: [
        'Menyusun gambar kerja (working drawing) lengkap untuk sebuah studi kasus sederhana',
        'Mengintegrasikan standar gambar, proyeksi, dimensi/toleransi, dan/atau gambar skematik dalam satu paket dokumen',
        'Mempresentasikan dan menjelaskan gambar kerja yang telah dibuat'
      ],
      alatBahan: [
        'Komputer/laptop dengan aplikasi CAD terpasang (dan/atau alat gambar manual bila diperlukan)',
        'Studi kasus pilihan (mis. gambar kerja komponen mekanik sederhana atau gambar skematik+wiring suatu rangkaian)'
      ],
      dasarTeori: 'Gambar kerja (working drawing) adalah paket gambar teknik lengkap yang digunakan sebagai acuan dalam proses pembuatan/perakitan suatu komponen atau sistem, mencakup gambar pandangan, dimensi, toleransi, serta keterangan lain yang diperlukan (skala, material, catatan khusus). Proyek akhir ini melatih kemampuan menyusun dokumen gambar teknik yang informatif dan siap digunakan sebagai acuan kerja.',
      langkahKerja: [
        'Tentukan studi kasus dan kumpulkan informasi/dimensi objek yang akan digambar',
        'Susun gambar pandangan (proyeksi ortogonal) sesuai objek studi kasus',
        'Lengkapi gambar dengan dimensi, toleransi, dan etiket (kop) gambar sesuai standar',
        'Tambahkan gambar skematik/wiring diagram bila studi kasus melibatkan rangkaian kelistrikan/elektronik',
        'Finalisasi gambar kerja menggunakan aplikasi CAD, cetak/ekspor, dan siapkan presentasi singkat'
      ],
      tugasLaporan: [
        'Paket gambar kerja lengkap (pandangan, dimensi, toleransi, etiket, dan skematik bila relevan)',
        'Penjelasan singkat proses penyusunan gambar kerja',
        'Refleksi kendala dan solusi yang dilakukan selama proyek'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // DASAR SISTEM TENAGA LISTRIK (kode PEK3201 - Pilihan Teknik
  // Elektronika/Instrumentasi). Fokus: kelistrikan arus kuat dasar (AC
  // satu fasa/tiga fasa, transformator, motor, dan keselamatan kelistrikan)
  // ==========================================================================
  dasar_sistem_tenaga_listrik: [
    {
      id: 'dstl-01',
      judul: 'Pengukuran Besaran Listrik pada Rangkaian AC Satu Fasa',
      pertemuanSaran: 2,
      tujuan: [
        'Mengukur tegangan, arus, dan daya pada rangkaian arus bolak-balik (AC) satu fasa',
        'Membedakan daya aktif, daya reaktif, dan daya semu pada beban AC',
        'Menggunakan alat ukur yang sesuai (voltmeter, amperemeter, wattmeter) untuk rangkaian AC'
      ],
      alatBahan: [
        'Sumber tegangan AC satu fasa (dari jala-jala/trainer kelistrikan)',
        'Voltmeter AC, amperemeter AC (tang ampere/clamp meter), wattmeter (bila tersedia)',
        'Beban uji (lampu pijar, elemen pemanas) sebagai beban resistif'
      ],
      dasarTeori: 'Pada rangkaian AC, daya listrik terdiri dari daya aktif (P, satuan watt, daya yang benar-benar terpakai), daya reaktif (Q, satuan VAR, terkait medan magnet/listrik pada beban induktif/kapasitif), dan daya semu (S, satuan VA, hasil kali tegangan dan arus). Pengukuran besaran-besaran ini penting untuk memahami karakteristik beban listrik dan efisiensi sistem kelistrikan.',
      langkahKerja: [
        'Rangkai pengukuran tegangan dan arus pada beban resistif murni (lampu pijar) menggunakan sumber AC satu fasa',
        'Ukur daya menggunakan wattmeter (atau hitung dari V x I untuk beban resistif murni)',
        'Amati dan catat nilai tegangan, arus, dan daya pada beberapa nilai beban berbeda',
        'Diskusikan perbedaan antara daya aktif, reaktif, dan semu berdasarkan hasil pengukuran',
        'Terapkan prosedur K3 kelistrikan (matikan sumber sebelum mengubah rangkaian) selama praktikum'
      ],
      tugasLaporan: [
        'Tabel hasil pengukuran tegangan, arus, dan daya pada beberapa kondisi beban',
        'Penjelasan konsep daya aktif, reaktif, dan semu berdasarkan hasil praktik',
        'Kesimpulan pentingnya pengukuran besaran listrik yang akurat pada sistem kelistrikan'
      ],
      k3: 'Bekerja dengan tegangan jala-jala AC berisiko tinggi - pastikan didampingi dosen/instruktur, matikan sumber sebelum wiring, dan gunakan alat pelindung diri (APD) sesuai prosedur bengkel.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dstl-02',
      judul: 'Rangkaian Beban R-L-C dan Faktor Daya (Power Factor)',
      pertemuanSaran: 4,
      tujuan: [
        'Mengamati pengaruh beban resistif, induktif, dan kapasitif terhadap faktor daya rangkaian AC',
        'Mengukur faktor daya (cos phi) pada beban campuran R-L',
        'Memahami konsep perbaikan faktor daya menggunakan kapasitor'
      ],
      alatBahan: [
        'Sumber AC satu fasa, beban resistif (lampu pijar), beban induktif (motor kecil/lilitan induktor, atau kumparan trainer)',
        'Kapasitor daya (untuk perbaikan faktor daya), voltmeter, amperemeter, wattmeter/power factor meter (bila tersedia)'
      ],
      dasarTeori: 'Faktor daya (cos phi) menunjukkan seberapa efektif daya listrik dimanfaatkan oleh beban, dengan nilai ideal 1 (seluruh daya termanfaatkan sebagai daya aktif). Beban induktif (seperti motor) cenderung menurunkan faktor daya karena menyerap daya reaktif, sehingga sering diperbaiki dengan menambahkan kapasitor yang bersifat menyuplai daya reaktif berlawanan arah.',
      langkahKerja: [
        'Ukur tegangan, arus, dan daya pada beban resistif murni, hitung/ukur faktor dayanya (idealnya mendekati 1)',
        'Ganti/tambahkan beban induktif (motor kecil), ukur kembali tegangan, arus, dan daya, amati perubahan faktor daya',
        'Pasang kapasitor secara paralel dengan beban induktif untuk perbaikan faktor daya',
        'Ukur kembali faktor daya setelah pemasangan kapasitor dan bandingkan dengan sebelum perbaikan',
        'Analisis pengaruh nilai kapasitor terhadap perbaikan faktor daya'
      ],
      tugasLaporan: [
        'Tabel hasil pengukuran V, I, P, dan faktor daya pada tiap kondisi beban (resistif, resistif-induktif, setelah perbaikan)',
        'Analisis pengaruh beban induktif dan kapasitor terhadap faktor daya',
        'Kesimpulan manfaat perbaikan faktor daya bagi efisiensi sistem kelistrikan'
      ],
      k3: 'Perhatikan tegangan kerja kapasitor yang digunakan dan pastikan kapasitor benar-benar dikosongkan (discharge) sebelum disentuh setelah rangkaian dimatikan.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dstl-03',
      judul: 'Transformator Satu Fasa: Prinsip Kerja dan Pengujian',
      pertemuanSaran: 6,
      tujuan: [
        'Memahami prinsip kerja transformator sebagai pengubah level tegangan AC',
        'Melakukan pengujian beban nol (no-load test) dan berbeban pada transformator satu fasa',
        'Menghitung rasio transformasi dan efisiensi transformator dari hasil pengujian'
      ],
      alatBahan: [
        'Transformator satu fasa (step-down/step-up) untuk keperluan praktikum',
        'Voltmeter, amperemeter, wattmeter, beban uji (resistor daya/lampu)'
      ],
      dasarTeori: 'Transformator bekerja berdasarkan prinsip induksi elektromagnetik untuk menaikkan atau menurunkan level tegangan AC, dengan rasio tegangan sebanding dengan rasio jumlah lilitan kumparan primer dan sekunder. Pengujian beban nol dilakukan untuk mengetahui rugi-rugi inti (core loss), sedangkan pengujian berbeban digunakan untuk mengetahui performa transformator saat menyuplai beban, termasuk efisiensinya.',
      langkahKerja: [
        'Ukur tegangan sisi primer dan sekunder transformator tanpa beban, hitung rasio transformasi',
        'Lakukan pengujian beban nol: ukur arus dan daya pada sisi primer saat sisi sekunder tidak berbeban',
        'Pasang beban pada sisi sekunder secara bertahap, ukur tegangan, arus, dan daya pada sisi primer dan sekunder',
        'Hitung efisiensi transformator pada beberapa kondisi pembebanan',
        'Analisis perubahan tegangan sekunder (voltage drop) seiring bertambahnya beban'
      ],
      tugasLaporan: [
        'Data hasil pengujian beban nol dan berbeban beserta perhitungan rasio transformasi dan efisiensi',
        'Grafik/tabel hubungan antara beban dan tegangan sekunder (voltage drop)',
        'Kesimpulan karakteristik transformator berdasarkan hasil pengujian'
      ],
      k3: 'Perhatikan rating tegangan dan arus transformator, jangan membebani melebihi kapasitas nominalnya.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dstl-04',
      judul: 'Sistem Tiga Fasa: Hubungan Bintang (Y) dan Segitiga (Delta)',
      pertemuanSaran: 8,
      tujuan: [
        'Memahami konsep dasar sistem kelistrikan tiga fasa',
        'Merangkai dan mengukur besaran listrik pada beban tiga fasa hubungan bintang (Y) dan segitiga (delta)',
        'Membandingkan hubungan antara tegangan fasa-netral dan fasa-fasa pada hubungan bintang'
      ],
      alatBahan: [
        'Sumber tegangan tiga fasa (trainer kelistrikan tiga fasa)',
        'Beban tiga fasa seimbang (mis. 3 lampu identik atau elemen pemanas), voltmeter, amperemeter'
      ],
      dasarTeori: 'Sistem tiga fasa umum digunakan pada instalasi listrik industri karena lebih efisien dalam penyaluran daya dibanding sistem satu fasa. Pada hubungan bintang (Y), tegangan fasa-fasa (line-to-line) adalah akar tiga (~1.73) kali tegangan fasa-netral (line-to-neutral), sedangkan pada hubungan segitiga (delta), tegangan fasa-fasa sama dengan tegangan pada tiap kumparan beban.',
      langkahKerja: [
        'Rangkai beban tiga fasa seimbang dengan hubungan bintang (Y), ukur tegangan fasa-netral dan fasa-fasa',
        'Verifikasi hubungan matematis antara tegangan fasa-netral dan fasa-fasa (rasio akar tiga) dari data pengukuran',
        'Ukur arus pada tiap fasa dan pada kawat netral (idealnya mendekati nol untuk beban seimbang)',
        'Rangkai ulang beban yang sama dengan hubungan segitiga (delta), ukur kembali tegangan dan arus pada tiap fasa',
        'Bandingkan karakteristik tegangan dan arus antara hubungan bintang dan segitiga'
      ],
      tugasLaporan: [
        'Data hasil pengukuran tegangan dan arus untuk hubungan bintang dan segitiga',
        'Verifikasi hubungan matematis tegangan fasa-netral vs fasa-fasa pada hubungan bintang',
        'Kesimpulan perbedaan karakteristik hubungan bintang dan segitiga'
      ],
      k3: 'Sistem tiga fasa bekerja pada tegangan yang lebih tinggi dari satu fasa - wajib didampingi dosen/instruktur dan matikan sumber sebelum mengubah wiring.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dstl-05',
      judul: 'Motor Listrik Dasar: Prinsip Kerja dan Pengujian Motor Induksi Satu Fasa',
      pertemuanSaran: 10,
      tujuan: [
        'Memahami prinsip kerja motor listrik, khususnya motor induksi satu fasa',
        'Mengidentifikasi bagian-bagian utama motor induksi satu fasa (stator, rotor, kapasitor start/run)',
        'Melakukan pengujian dasar motor induksi satu fasa (arus start, arus nominal, arah putaran)'
      ],
      alatBahan: [
        'Motor induksi satu fasa (dengan kapasitor start/run), sumber AC satu fasa',
        'Amperemeter (clamp meter direkomendasikan untuk arus start), voltmeter, tachometer (bila tersedia)'
      ],
      dasarTeori: 'Motor induksi satu fasa mengubah energi listrik menjadi energi mekanik (putaran) berdasarkan prinsip induksi elektromagnetik antara stator dan rotor. Karena medan putar tidak dapat terbentuk langsung dari sumber satu fasa, motor jenis ini umumnya memerlukan bantuan kapasitor start untuk menghasilkan pergeseran fasa yang memungkinkan motor mulai berputar.',
      langkahKerja: [
        'Identifikasi terminal-terminal motor induksi satu fasa (kumparan utama, kumparan bantu, kapasitor) berdasarkan name plate/manual',
        'Ukur arus start (saat motor pertama kali dinyalakan) dan arus nominal (setelah motor berputar stabil)',
        'Amati arah putaran motor dan cara membalik arah putaran (jika berlaku untuk jenis motor yang digunakan)',
        'Ukur kecepatan putar motor menggunakan tachometer (bila tersedia) dan bandingkan dengan spesifikasi name plate',
        'Diskusikan fungsi kapasitor start/run berdasarkan hasil pengamatan'
      ],
      tugasLaporan: [
        'Data hasil pengukuran arus start, arus nominal, dan kecepatan putar motor',
        'Penjelasan fungsi kapasitor start/run pada motor induksi satu fasa',
        'Kesimpulan hasil pengujian dibandingkan dengan spesifikasi name plate motor'
      ],
      k3: 'Jaga jarak dari bagian motor yang berputar, pastikan motor terpasang kokoh pada dudukannya sebelum dioperasikan.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dstl-06',
      judul: 'Sistem Pembumian (Grounding) dan Keselamatan Kelistrikan',
      pertemuanSaran: 12,
      tujuan: [
        'Memahami fungsi dan prinsip sistem pembumian (grounding) pada instalasi listrik',
        'Mengukur tahanan pembumian menggunakan earth tester/megger (bila tersedia)',
        'Menerapkan prinsip keselamatan kelistrikan (K3) pada pekerjaan instalasi listrik'
      ],
      alatBahan: [
        'Elektroda pembumian (grounding rod) contoh/trainer, earth tester atau megger (bila tersedia)',
        'Kabel penghubung, alat pelindung diri (APD) untuk kerja kelistrikan'
      ],
      dasarTeori: 'Sistem pembumian (grounding) berfungsi mengalirkan arus bocor atau arus gangguan ke tanah, melindungi manusia dari bahaya sengatan listrik dan melindungi peralatan dari kerusakan akibat gangguan listrik. Nilai tahanan pembumian yang baik (umumnya di bawah nilai ambang tertentu sesuai standar) penting untuk memastikan sistem proteksi bekerja efektif.',
      langkahKerja: [
        'Identifikasi komponen sistem pembumian pada instalasi/trainer yang tersedia (elektroda, kawat penghantar, terminal pembumian)',
        'Ukur tahanan pembumian menggunakan earth tester/megger (bila tersedia) dan bandingkan dengan standar yang berlaku',
        'Diskusikan dampak sistem pembumian yang buruk terhadap keselamatan pengguna instalasi listrik',
        'Identifikasi potensi bahaya kelistrikan pada beberapa contoh instalasi (kabel terkelupas, sambungan tidak sempurna, dsb.)',
        'Susun daftar praktik K3 kelistrikan yang wajib diterapkan saat bekerja dengan instalasi listrik'
      ],
      tugasLaporan: [
        'Hasil pengukuran tahanan pembumian (bila alat tersedia) beserta interpretasinya',
        'Daftar potensi bahaya kelistrikan yang teridentifikasi dan cara pencegahannya',
        'Kesimpulan pentingnya sistem pembumian dan penerapan K3 kelistrikan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'dstl-07',
      judul: 'Proyek Akhir: Instalasi dan Pengujian Sistem Tenaga Listrik Sederhana',
      pertemuanSaran: 14,
      tujuan: [
        'Merancang dan memasang instalasi listrik sederhana sesuai studi kasus (mis. instalasi penerangan dengan beberapa titik lampu dan saklar)',
        'Mengintegrasikan prinsip pengukuran besaran listrik, keselamatan kelistrikan, dan pembumian pada instalasi yang dibuat',
        'Menguji dan mendokumentasikan hasil instalasi yang telah dibuat'
      ],
      alatBahan: [
        'Kabel instalasi, saklar, fitting lampu, MCB (pengaman), papan instalasi/trainer',
        'Alat ukur (multimeter, earth tester bila tersedia), alat tangan kelistrikan (obeng, tang, dsb.)'
      ],
      dasarTeori: 'Proyek akhir melatih kemampuan merancang dan memasang instalasi listrik sederhana yang aman dan sesuai kaidah teknik, mengintegrasikan seluruh konsep yang telah dipelajari (pengukuran besaran listrik, sistem pembumian, dan prinsip keselamatan kelistrikan) dalam satu pekerjaan instalasi yang nyata.',
      langkahKerja: [
        'Tentukan studi kasus instalasi (mis. 2-3 titik lampu dengan saklar tunggal/seri) dan buat gambar rencana instalasi',
        'Siapkan material dan alat sesuai rencana instalasi',
        'Lakukan pemasangan instalasi sesuai gambar rencana, dengan memperhatikan prosedur keselamatan kerja',
        'Uji instalasi yang telah dipasang (fungsi saklar, kondisi tegangan pada tiap titik) sebelum dan sesudah energize',
        'Dokumentasikan hasil instalasi dan lakukan presentasi/demonstrasi di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Gambar rencana instalasi dan daftar material yang digunakan',
        'Dokumentasi proses pemasangan dan hasil pengujian instalasi',
        'Refleksi kendala dan penerapan prosedur keselamatan kerja selama proyek'
      ],
      k3: 'Pastikan sumber listrik dalam keadaan mati (MCB off) selama proses pemasangan, dan lakukan pengujian akhir dengan pengawasan dosen/instruktur.',
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // PERALATAN TEKNIK (kode PD3208, semester 2 - "Penciri Dewantara")
  // Fokus: perkakas tangan, alat ukur mekanik, dan peralatan bengkel -
  // berbeda dari Teknik Pengukuran (PD3207) yang fokus pada alat ukur
  // listrik/elektronik
  // ==========================================================================
  peralatan_teknik: [
    {
      id: 'pt-01',
      judul: 'K3 Bengkel dan Pengenalan Perkakas Tangan Dasar',
      pertemuanSaran: 2,
      tujuan: [
        'Memahami dan menerapkan prosedur Keselamatan dan Kesehatan Kerja (K3) di bengkel/laboratorium',
        'Mengidentifikasi jenis dan fungsi perkakas tangan dasar (obeng, tang, kunci pas/ring, palu)',
        'Menggunakan alat pelindung diri (APD) yang sesuai saat bekerja di bengkel'
      ],
      alatBahan: [
        'Berbagai jenis obeng, tang (kombinasi, potong, lancip), kunci pas/ring, palu',
        'Alat pelindung diri (APD): sarung tangan, kacamata pelindung, sepatu safety (bila tersedia)'
      ],
      dasarTeori: 'K3 (Keselamatan dan Kesehatan Kerja) adalah prinsip dasar yang wajib diterapkan setiap kali bekerja di bengkel/laboratorium teknik untuk mencegah kecelakaan kerja dan menjaga kesehatan pekerja. Perkakas tangan dasar seperti obeng, tang, kunci pas/ring, dan palu adalah alat yang paling sering digunakan dalam pekerjaan teknik, sehingga penting untuk mengetahui jenis, fungsi, dan cara penggunaan yang benar dan aman.',
      langkahKerja: [
        'Pelajari tata tertib dan prosedur K3 yang berlaku di bengkel/laboratorium kampus',
        'Identifikasi dan kelompokkan jenis-jenis obeng, tang, kunci pas/ring, dan palu beserta fungsinya masing-masing',
        'Latihan menggunakan tiap jenis perkakas tangan pada studi kasus sederhana (mis. melepas-memasang baut, mengupas kabel)',
        'Diskusikan potensi bahaya penggunaan perkakas tangan yang tidak sesuai prosedur',
        'Praktikkan penggunaan APD yang sesuai selama sesi praktikum'
      ],
      tugasLaporan: [
        'Daftar jenis perkakas tangan yang dipelajari beserta fungsi dan cara penggunaannya',
        'Rangkuman poin-poin K3 bengkel yang wajib diterapkan',
        'Kesimpulan pentingnya penggunaan APD dan prosedur K3 dalam pekerjaan teknik'
      ],
      k3: 'Selalu gunakan alat sesuai fungsinya (jangan memaksakan alat untuk pekerjaan di luar fungsinya) dan kembalikan alat ke tempatnya setelah digunakan.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pt-02',
      judul: 'Penggunaan Alat Ukur Mekanik Dasar (Jangka Sorong dan Mikrometer)',
      pertemuanSaran: 4,
      tujuan: [
        'Membaca skala jangka sorong (vernier caliper) dan mikrometer sekrup dengan benar',
        'Mengukur dimensi benda kerja (panjang, diameter, kedalaman) menggunakan kedua alat tersebut',
        'Memahami tingkat ketelitian dan batas kemampuan ukur masing-masing alat'
      ],
      alatBahan: [
        'Jangka sorong (vernier caliper) analog/digital, mikrometer sekrup',
        'Beberapa benda kerja dengan dimensi berbeda (mis. baut, pipa, pelat) untuk latihan pengukuran'
      ],
      dasarTeori: 'Jangka sorong digunakan untuk mengukur dimensi luar, dalam, dan kedalaman suatu benda dengan ketelitian hingga 0,05 mm atau 0,02 mm tergantung jenisnya, sedangkan mikrometer sekrup memiliki ketelitian lebih tinggi (hingga 0,01 mm) dan umumnya digunakan untuk mengukur dimensi yang lebih presisi seperti ketebalan atau diameter kecil. Pemilihan alat ukur yang tepat bergantung pada tingkat ketelitian yang dibutuhkan.',
      langkahKerja: [
        'Pelajari bagian-bagian dan cara membaca skala pada jangka sorong (skala utama dan skala nonius/vernier)',
        'Latihan mengukur dimensi luar, dalam, dan kedalaman beberapa benda kerja menggunakan jangka sorong',
        'Pelajari bagian-bagian dan cara membaca skala pada mikrometer sekrup',
        'Latihan mengukur dimensi (mis. diameter/tebal) beberapa benda kerja menggunakan mikrometer sekrup',
        'Bandingkan hasil pengukuran benda yang sama menggunakan jangka sorong dan mikrometer, diskusikan perbedaan ketelitian'
      ],
      tugasLaporan: [
        'Tabel hasil pengukuran beberapa benda kerja menggunakan jangka sorong dan mikrometer',
        'Penjelasan cara pembacaan skala kedua alat ukur',
        'Kesimpulan perbandingan ketelitian dan kegunaan jangka sorong vs mikrometer'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pt-03',
      judul: 'Perkakas Tangan untuk Pemotongan dan Pembentukan (Gergaji, Kikir, Tap-Snei)',
      pertemuanSaran: 6,
      tujuan: [
        'Menggunakan gergaji tangan dan kikir untuk memotong dan membentuk benda kerja sederhana',
        'Memahami prinsip dan langkah penggunaan tap dan snei untuk membuat ulir dalam dan ulir luar',
        'Menghasilkan benda kerja sederhana sesuai ukuran yang ditentukan menggunakan perkakas tersebut'
      ],
      alatBahan: [
        'Gergaji tangan, berbagai jenis kikir (kasar, halus, bentuk), ragum (vice)',
        'Set tap dan snei, benda kerja logam sederhana (mis. batang/pelat aluminium atau besi lunak)'
      ],
      dasarTeori: 'Gergaji tangan digunakan untuk memotong benda kerja sesuai ukuran yang dibutuhkan, sedangkan kikir digunakan untuk menghaluskan atau membentuk permukaan benda kerja setelah dipotong. Tap digunakan untuk membuat ulir dalam (pada lubang), sedangkan snei digunakan untuk membuat ulir luar (pada batang/poros) - keduanya penting dalam pekerjaan perakitan komponen mekanik menggunakan baut dan mur.',
      langkahKerja: [
        'Cekam benda kerja pada ragum dengan benar dan aman',
        'Latihan memotong benda kerja menggunakan gergaji tangan sesuai ukuran yang ditentukan',
        'Latihan menghaluskan/membentuk permukaan benda kerja hasil potongan menggunakan kikir',
        'Latihan membuat ulir dalam pada lubang benda kerja menggunakan tap',
        'Latihan membuat ulir luar pada batang benda kerja menggunakan snei, lalu uji kesesuaian ulir dalam dan luar yang dibuat'
      ],
      tugasLaporan: [
        'Foto/dokumentasi benda kerja hasil pemotongan, pengikiran, dan pembuatan ulir',
        'Penjelasan langkah kerja yang dilakukan beserta kendala yang dihadapi',
        'Kesimpulan ketepatan ukuran benda kerja terhadap target yang ditentukan'
      ],
      k3: 'Pastikan benda kerja tercekam kuat pada ragum sebelum dipotong/dikikir, dan jauhkan tangan dari arah mata gergaji/kikir saat bekerja.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pt-04',
      judul: 'Peralatan Listrik Portabel (Bor, Gerinda, Solder) dan Prosedur Aman Penggunaannya',
      pertemuanSaran: 8,
      tujuan: [
        'Mengoperasikan bor listrik portabel untuk membuat lubang pada benda kerja',
        'Mengoperasikan gerinda tangan untuk memotong/menghaluskan benda kerja logam dengan aman',
        'Menggunakan solder listrik untuk menyambung komponen elektronik sederhana'
      ],
      alatBahan: [
        'Bor listrik portabel beserta mata bor berbagai ukuran',
        'Gerinda tangan beserta mata gerinda potong/asah, solder listrik dan timah solder',
        'Benda kerja logam sederhana, PCB/komponen elektronik sederhana untuk latihan menyolder'
      ],
      dasarTeori: 'Peralatan listrik portabel seperti bor dan gerinda mempercepat pekerjaan pemotongan, penghalusan, dan pelubangan dibanding perkakas tangan manual, namun memiliki risiko kecelakaan kerja yang lebih tinggi sehingga wajib dioperasikan sesuai prosedur keselamatan. Solder listrik digunakan untuk menyambung komponen elektronik secara permanen menggunakan timah solder yang dilelehkan pada suhu tertentu.',
      langkahKerja: [
        'Pelajari bagian-bagian dan prosedur pengoperasian aman bor listrik portabel',
        'Latihan membuat lubang pada benda kerja menggunakan bor listrik sesuai ukuran yang ditentukan',
        'Pelajari prosedur pengoperasian aman gerinda tangan, termasuk posisi tubuh dan arah percikan',
        'Latihan memotong/menghaluskan benda kerja logam sederhana menggunakan gerinda tangan (dengan pengawasan ketat)',
        'Latihan menyolder komponen elektronik sederhana pada PCB menggunakan solder listrik'
      ],
      tugasLaporan: [
        'Dokumentasi hasil pekerjaan menggunakan bor, gerinda, dan solder',
        'Daftar prosedur keselamatan yang diterapkan untuk tiap alat',
        'Kesimpulan tantangan dan tips penggunaan aman peralatan listrik portabel'
      ],
      k3: 'Gerinda dan bor wajib dioperasikan dengan pengawasan dosen/instruktur; gunakan kacamata pelindung, jauhkan benda mudah terbakar dari percikan gerinda, dan cabut steker alat saat mengganti mata bor/gerinda.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pt-05',
      judul: 'Perawatan, Kalibrasi Sederhana, dan Penyimpanan Peralatan Teknik',
      pertemuanSaran: 10,
      tujuan: [
        'Memahami prosedur perawatan berkala untuk perkakas tangan dan peralatan listrik portabel',
        'Melakukan pengecekan sederhana kondisi alat ukur (mis. titik nol jangka sorong/mikrometer) sebelum digunakan',
        'Menerapkan tata cara penyimpanan peralatan teknik yang baik dan aman'
      ],
      alatBahan: [
        'Perkakas tangan dan alat ukur yang telah digunakan pada modul-modul sebelumnya',
        'Bahan pembersih/pelumas sederhana (kain lap, minyak pelumas ringan) sesuai kebutuhan'
      ],
      dasarTeori: 'Perawatan berkala memperpanjang usia pakai peralatan teknik dan menjaga keakuratannya, misalnya membersihkan sisa kotoran/korosi pada perkakas tangan atau memeriksa titik nol alat ukur sebelum digunakan. Penyimpanan yang baik (tempat kering, tersusun rapi, terlindung dari benturan) juga penting untuk mencegah kerusakan dan mempermudah pencarian alat saat dibutuhkan.',
      langkahKerja: [
        'Periksa kondisi fisik perkakas tangan yang telah digunakan (karat, keausan, kerusakan) dan bersihkan sesuai kebutuhan',
        'Lakukan pengecekan titik nol (kalibrasi sederhana) pada jangka sorong dan mikrometer sebelum digunakan',
        'Diskusikan tanda-tanda alat ukur yang perlu dikalibrasi ulang secara resmi (di luar kemampuan kalibrasi sederhana mahasiswa)',
        'Susun daftar periksa (checklist) perawatan rutin untuk beberapa jenis peralatan teknik',
        'Praktikkan penyimpanan peralatan teknik sesuai jenis dan fungsinya pada tempat penyimpanan yang tersedia'
      ],
      tugasLaporan: [
        'Daftar periksa (checklist) perawatan rutin yang disusun untuk beberapa jenis peralatan',
        'Hasil pengecekan titik nol alat ukur yang dilakukan',
        'Kesimpulan pentingnya perawatan dan penyimpanan peralatan yang baik'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pt-06',
      judul: 'Proyek Akhir: Praktik Kerja Bangku (Pembuatan Benda Kerja Sederhana)',
      pertemuanSaran: 14,
      tujuan: [
        'Mengintegrasikan keterampilan penggunaan perkakas tangan, alat ukur, dan peralatan listrik portabel dalam satu pekerjaan',
        'Membuat benda kerja sederhana sesuai gambar kerja dan ukuran yang ditentukan',
        'Menerapkan prosedur K3 secara konsisten selama proses pengerjaan'
      ],
      alatBahan: [
        'Seluruh perkakas tangan dan alat ukur yang telah dipelajari (gergaji, kikir, jangka sorong, bor, dsb.)',
        'Bahan kerja (mis. pelat/batang logam ringan) sesuai studi kasus benda kerja yang ditentukan'
      ],
      dasarTeori: 'Praktik kerja bangku adalah kegiatan mengerjakan benda kerja logam menggunakan perkakas tangan dan peralatan bengkel dasar untuk menghasilkan bentuk dan ukuran sesuai gambar kerja, melatih ketelitian, kesabaran, dan penerapan K3 secara menyeluruh sebagai bekal dasar sebelum bekerja dengan peralatan yang lebih kompleks.',
      langkahKerja: [
        'Pelajari gambar kerja benda yang akan dibuat (dimensi dan toleransi yang ditentukan)',
        'Potong bahan kerja sesuai ukuran awal menggunakan gergaji tangan',
        'Bentuk dan haluskan benda kerja menggunakan kikir hingga mendekati ukuran akhir yang ditentukan',
        'Lubangi bagian yang diperlukan menggunakan bor listrik sesuai gambar kerja',
        'Ukur dan verifikasi dimensi akhir benda kerja menggunakan jangka sorong/mikrometer, bandingkan dengan gambar kerja'
      ],
      tugasLaporan: [
        'Gambar kerja yang diacu dan dokumentasi tahapan pengerjaan benda kerja',
        'Hasil pengukuran akhir benda kerja dibandingkan dengan ukuran target pada gambar kerja',
        'Refleksi kendala, penerapan K3, dan pembelajaran yang diperoleh selama praktik kerja bangku'
      ],
      k3: 'Terapkan seluruh prosedur K3 dari modul-modul sebelumnya secara konsisten; gunakan APD lengkap selama proses pengerjaan.',
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // KESELAMATAN DAN KESEHATAN KERJA / K3 (kode PD3205, semester 2 -
  // "Penciri Dewantara"). Fokus: identifikasi bahaya, APD, tanggap
  // darurat, dan budaya kerja aman di bengkel/laboratorium
  // ==========================================================================
  keselamatan_kesehatan_kerja: [
    {
      id: 'k3-01',
      judul: 'Identifikasi Bahaya dan Penilaian Risiko (HIRA) di Tempat Kerja',
      pertemuanSaran: 2,
      tujuan: [
        'Mengidentifikasi sumber bahaya (hazard) yang ada di lingkungan bengkel/laboratorium',
        'Melakukan penilaian risiko sederhana (kemungkinan x keparahan) terhadap bahaya yang teridentifikasi',
        'Menyusun rekomendasi pengendalian risiko sesuai hierarki pengendalian (eliminasi, substitusi, rekayasa, administratif, APD)'
      ],
      alatBahan: [
        'Lembar kerja/formulir identifikasi bahaya dan penilaian risiko (HIRA)',
        'Lingkungan bengkel/laboratorium kampus sebagai objek observasi'
      ],
      dasarTeori: 'HIRA (Hazard Identification and Risk Assessment) adalah proses sistematis untuk mengenali potensi bahaya di suatu area kerja, menilai tingkat risikonya (berdasarkan kemungkinan terjadi dan tingkat keparahan dampaknya), lalu menentukan langkah pengendalian yang sesuai. Hierarki pengendalian risiko mengutamakan eliminasi bahaya sebagai solusi terbaik, diikuti substitusi, rekayasa teknik, pengendalian administratif, dan APD sebagai lapisan terakhir.',
      langkahKerja: [
        'Lakukan observasi langsung pada satu area bengkel/laboratorium yang ditentukan',
        'Identifikasi dan catat seluruh potensi bahaya yang ditemukan (fisik, kimia, ergonomi, listrik, dsb.)',
        'Nilai tingkat risiko tiap bahaya menggunakan matriks kemungkinan x keparahan sederhana',
        'Urutkan bahaya berdasarkan tingkat risiko dari yang tertinggi',
        'Susun rekomendasi pengendalian untuk 3 bahaya dengan risiko tertinggi sesuai hierarki pengendalian'
      ],
      tugasLaporan: [
        'Tabel HIRA lengkap (bahaya, penilaian risiko, rekomendasi pengendalian) dari area yang diobservasi',
        'Penjelasan alasan pemilihan metode pengendalian untuk 3 bahaya prioritas',
        'Kesimpulan pentingnya identifikasi bahaya sejak dini di tempat kerja'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'k3-02',
      judul: 'Alat Pelindung Diri (APD): Jenis, Pemilihan, dan Cara Penggunaan',
      pertemuanSaran: 4,
      tujuan: [
        'Mengidentifikasi jenis-jenis APD dan fungsinya masing-masing',
        'Memilih APD yang sesuai untuk jenis pekerjaan/bahaya tertentu',
        'Menggunakan dan merawat APD dengan cara yang benar'
      ],
      alatBahan: [
        'Contoh APD: kacamata pelindung, sarung tangan (berbagai jenis), masker, ear plug/ear muff, sepatu safety, helm (bila tersedia)',
        'Studi kasus pekerjaan bengkel/laboratorium untuk latihan pemilihan APD'
      ],
      dasarTeori: 'APD (Alat Pelindung Diri) adalah lapisan pertahanan terakhir untuk melindungi pekerja dari bahaya yang tidak dapat sepenuhnya dihilangkan melalui pengendalian lain. Pemilihan APD harus disesuaikan dengan jenis bahaya yang dihadapi (mis. kacamata untuk bahaya percikan/serpihan, ear protection untuk kebisingan tinggi, sarung tangan sesuai jenis bahan yang ditangani), dan APD yang tidak dirawat dengan baik dapat kehilangan fungsi perlindungannya.',
      langkahKerja: [
        'Identifikasi jenis-jenis APD yang tersedia beserta fungsi perlindungannya masing-masing',
        'Diskusikan studi kasus beberapa jenis pekerjaan bengkel dan tentukan APD yang sesuai untuk tiap pekerjaan',
        'Latihan memakai dan melepas APD dengan cara yang benar (terutama untuk APD yang memerlukan prosedur khusus)',
        'Periksa kondisi beberapa contoh APD dan identifikasi tanda-tanda APD yang sudah tidak layak pakai',
        'Diskusikan cara perawatan dan penyimpanan APD yang baik'
      ],
      tugasLaporan: [
        'Tabel jenis APD, fungsi, dan contoh pekerjaan yang memerlukannya',
        'Hasil analisis pemilihan APD untuk studi kasus pekerjaan yang didiskusikan',
        'Kesimpulan pentingnya penggunaan dan perawatan APD yang benar'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'k3-03',
      judul: 'Penanganan Kebakaran Dasar dan Penggunaan Alat Pemadam Api Ringan (APAR)',
      pertemuanSaran: 6,
      tujuan: [
        'Memahami konsep segitiga api dan klasifikasi jenis kebakaran (kelas A, B, C, D, K)',
        'Mengidentifikasi jenis-jenis APAR dan kesesuaiannya dengan klasifikasi kebakaran',
        'Mempraktikkan teknik dasar penggunaan APAR (metode PASS: Pull, Aim, Squeeze, Sweep)'
      ],
      alatBahan: [
        'APAR (jenis dry chemical/CO2, sesuai yang tersedia di kampus - untuk pembelajaran/simulasi, gunakan APAR latihan/expired bila tersedia)',
        'Media edukasi (poster/video) segitiga api dan klasifikasi kebakaran'
      ],
      dasarTeori: 'Api dapat terjadi jika tiga unsur segitiga api (bahan bakar, oksigen, dan panas/sumber pemicu) terpenuhi secara bersamaan; memutus salah satu unsur ini adalah prinsip dasar pemadaman kebakaran. Klasifikasi kebakaran dibagi berdasarkan jenis bahan yang terbakar (kelas A: bahan padat biasa, kelas B: cairan/gas mudah terbakar, kelas C: instalasi listrik bertegangan, kelas D: logam, kelas K: minyak/lemak masak), dan tiap kelas memerlukan jenis APAR yang sesuai agar pemadaman efektif dan aman.',
      langkahKerja: [
        'Pelajari konsep segitiga api dan klasifikasi jenis-jenis kebakaran',
        'Identifikasi jenis APAR yang tersedia di lingkungan kampus dan kesesuaiannya dengan klasifikasi kebakaran di area tersebut',
        'Pelajari dan praktikkan teknik dasar penggunaan APAR dengan metode PASS (di bawah pengawasan instruktur, gunakan APAR latihan bila tersedia)',
        'Diskusikan langkah-langkah yang harus dilakukan saat mendeteksi kebakaran di lingkungan kerja (termasuk kapan harus mengevakuasi diri, bukan memadamkan sendiri)',
        'Identifikasi lokasi APAR dan jalur evakuasi di gedung/bengkel kampus'
      ],
      tugasLaporan: [
        'Penjelasan segitiga api dan klasifikasi kebakaran beserta jenis APAR yang sesuai',
        'Dokumentasi praktik penggunaan APAR (metode PASS)',
        'Denah sederhana lokasi APAR dan jalur evakuasi di area yang diamati'
      ],
      k3: 'Praktik penggunaan APAR wajib didampingi instruktur/petugas terlatih; jangan mencoba memadamkan kebakaran besar sendirian - prioritaskan evakuasi dan hubungi pihak berwenang.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'k3-04',
      judul: 'Pertolongan Pertama pada Kecelakaan (P3K) Dasar',
      pertemuanSaran: 8,
      tujuan: [
        'Memahami prinsip dasar pertolongan pertama pada kecelakaan kerja ringan',
        'Mempraktikkan penanganan dasar untuk luka ringan, luka bakar ringan, dan sengatan listrik ringan',
        'Mengetahui kapan dan bagaimana merujuk korban ke penanganan medis lanjutan'
      ],
      alatBahan: [
        'Kotak P3K (kasa steril, plester, antiseptik, dsb.)',
        'Boneka/manekin latihan (bila tersedia) atau simulasi antar mahasiswa untuk latihan penanganan dasar'
      ],
      dasarTeori: 'Pertolongan pertama adalah bantuan awal yang diberikan kepada korban kecelakaan sebelum mendapat penanganan medis profesional, bertujuan mencegah kondisi korban memburuk. Prinsip dasarnya meliputi memastikan keamanan penolong dan korban, menilai kondisi korban, memberikan pertolongan sesuai jenis cedera, dan segera merujuk ke fasilitas kesehatan bila diperlukan.',
      langkahKerja: [
        'Pelajari isi dan fungsi kotak P3K standar',
        'Latihan penanganan dasar luka ringan (pembersihan dan penutupan luka) menggunakan simulasi',
        'Latihan penanganan dasar luka bakar ringan (pendinginan dengan air mengalir, penutupan luka)',
        'Diskusikan langkah penanganan awal korban sengatan listrik (memastikan sumber listrik telah diputus sebelum menyentuh korban)',
        'Diskusikan kriteria kondisi yang memerlukan rujukan segera ke fasilitas kesehatan'
      ],
      tugasLaporan: [
        'Ringkasan langkah P3K untuk luka ringan, luka bakar ringan, dan sengatan listrik ringan',
        'Dokumentasi hasil praktik/simulasi penanganan dasar yang dilakukan',
        'Kesimpulan pentingnya kesigapan P3K di lingkungan kerja teknik'
      ],
      k3: 'Pertolongan pertama pada sengatan listrik: JANGAN menyentuh korban sebelum sumber listrik benar-benar diputus, untuk menghindari penolong ikut tersengat.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'k3-05',
      judul: 'Ergonomi Kerja dan Pencegahan Cedera Akibat Postur Kerja',
      pertemuanSaran: 10,
      tujuan: [
        'Memahami prinsip dasar ergonomi dalam pekerjaan teknik (postur kerja, tata letak alat, durasi kerja)',
        'Mengidentifikasi postur kerja yang berisiko menyebabkan cedera otot/rangka',
        'Menerapkan perbaikan sederhana pada postur dan tata letak kerja untuk mengurangi risiko cedera'
      ],
      alatBahan: [
        'Meja kerja/bangku praktikum yang tersedia di bengkel/laboratorium',
        'Lembar observasi postur kerja sederhana'
      ],
      dasarTeori: 'Ergonomi mempelajari kesesuaian antara pekerja dengan lingkungan dan peralatan kerjanya, bertujuan meminimalkan risiko cedera otot rangka (musculoskeletal disorders) akibat postur kerja yang tidak alami, gerakan berulang, atau durasi kerja statis yang terlalu lama. Penyesuaian sederhana seperti ketinggian meja kerja, posisi duduk/berdiri, dan jeda istirahat berkala dapat secara signifikan mengurangi risiko cedera jangka panjang.',
      langkahKerja: [
        'Amati postur kerja mahasiswa/teknisi saat melakukan salah satu pekerjaan bengkel (mis. mengikir, menyolder, merangkai)',
        'Identifikasi postur yang berpotensi menyebabkan cedera (membungkuk berlebihan, posisi tangan tidak alami, dsb.)',
        'Diskusikan dan terapkan perbaikan sederhana pada postur/tata letak kerja yang diamati',
        'Bandingkan tingkat kenyamanan/kelelahan sebelum dan sesudah perbaikan postur (berdasarkan pengalaman subjektif)',
        'Susun rekomendasi ergonomi sederhana untuk area kerja yang diamati'
      ],
      tugasLaporan: [
        'Dokumentasi (foto/gambar) postur kerja sebelum dan sesudah perbaikan',
        'Analisis risiko postur kerja yang diamati',
        'Rekomendasi perbaikan ergonomi untuk area kerja tersebut'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'k3-06',
      judul: 'Prosedur Tanggap Darurat dan Simulasi Evakuasi',
      pertemuanSaran: 12,
      tujuan: [
        'Memahami komponen prosedur tanggap darurat (jalur evakuasi, titik kumpul, tim tanggap darurat)',
        'Mengikuti simulasi evakuasi darurat sesuai prosedur yang berlaku di kampus',
        'Mengevaluasi kelancaran proses evakuasi dan mengidentifikasi area perbaikan'
      ],
      alatBahan: [
        'Denah jalur evakuasi dan titik kumpul gedung kampus',
        'Peluit/alarm simulasi (bila tersedia) untuk keperluan latihan'
      ],
      dasarTeori: 'Prosedur tanggap darurat adalah rangkaian langkah yang harus diikuti saat terjadi keadaan darurat (kebakaran, gempa, dsb.) untuk menyelamatkan seluruh penghuni gedung secara tertib dan cepat, meliputi jalur evakuasi yang jelas, titik kumpul yang aman, serta peran tim tanggap darurat dalam mengoordinasikan proses evakuasi. Simulasi berkala penting untuk memastikan seluruh penghuni gedung familiar dengan prosedur dan dapat bertindak cepat saat kejadian sesungguhnya.',
      langkahKerja: [
        'Pelajari denah jalur evakuasi dan lokasi titik kumpul gedung yang digunakan untuk perkuliahan',
        'Ikuti simulasi evakuasi darurat sesuai arahan dosen/tim K3 kampus',
        'Catat waktu yang dibutuhkan untuk mencapai titik kumpul dari ruang kelas/laboratorium',
        'Identifikasi kendala yang ditemui selama proses evakuasi (mis. jalur terhalang, kebingungan arah)',
        'Diskusikan dan susun rekomendasi perbaikan proses evakuasi berdasarkan hasil simulasi'
      ],
      tugasLaporan: [
        'Denah jalur evakuasi yang diikuti beserta catatan waktu evakuasi',
        'Kendala yang ditemukan selama simulasi evakuasi',
        'Rekomendasi perbaikan prosedur tanggap darurat berdasarkan hasil simulasi'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'k3-07',
      judul: 'Proyek Akhir: Audit K3 Sederhana pada Area Kerja/Laboratorium',
      pertemuanSaran: 14,
      tujuan: [
        'Melakukan audit K3 sederhana pada satu area bengkel/laboratorium secara menyeluruh',
        'Mengintegrasikan konsep HIRA, APD, kesiapan tanggap darurat, dan ergonomi dalam satu laporan audit',
        'Menyusun rekomendasi perbaikan K3 yang dapat diterapkan secara nyata di area yang diaudit'
      ],
      alatBahan: [
        'Formulir audit K3 sederhana (checklist)',
        'Area bengkel/laboratorium yang ditentukan sebagai objek audit'
      ],
      dasarTeori: 'Audit K3 adalah proses evaluasi sistematis terhadap penerapan aspek keselamatan dan kesehatan kerja pada suatu area, mencakup pemeriksaan bahaya fisik, ketersediaan dan kondisi APD, kesiapan sarana tanggap darurat (APAR, jalur evakuasi), serta aspek ergonomi. Hasil audit digunakan untuk menyusun rekomendasi perbaikan agar area kerja tersebut lebih aman dan sesuai standar K3.',
      langkahKerja: [
        'Tentukan area bengkel/laboratorium yang akan diaudit dan susun checklist audit berdasarkan modul-modul sebelumnya',
        'Lakukan observasi dan pemeriksaan menyeluruh sesuai checklist (bahaya, APD, sarana tanggap darurat, ergonomi)',
        'Dokumentasikan temuan (foto/catatan) untuk setiap poin checklist',
        'Susun rekomendasi perbaikan untuk setiap temuan yang tidak sesuai standar',
        'Presentasikan hasil audit dan rekomendasi di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Checklist audit K3 lengkap beserta hasil temuan dan dokumentasi',
        'Daftar rekomendasi perbaikan berdasarkan temuan audit',
        'Refleksi proses audit dan pembelajaran yang diperoleh'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ],

  // ==========================================================================
  // PERAWATAN DAN PERBAIKAN (kode PEK3205 - Pilihan Teknik
  // Elektronika/Instrumentasi). Fokus: pemeliharaan preventif dan
  // troubleshooting/perbaikan peralatan elektronik
  // ==========================================================================
  perawatan_dan_perbaikan: [
    {
      id: 'pp-01',
      judul: 'Konsep Dasar Perawatan (Preventif, Korektif, Prediktif) dan Dokumentasi Peralatan',
      pertemuanSaran: 2,
      tujuan: [
        'Membedakan jenis-jenis perawatan: preventif, korektif, dan prediktif',
        'Menyusun kartu riwayat (maintenance record) untuk sebuah peralatan elektronik',
        'Menyusun jadwal perawatan preventif sederhana untuk peralatan laboratorium'
      ],
      alatBahan: [
        'Contoh peralatan elektronik/laboratorium (mis. power supply, osiloskop, atau alat lain yang tersedia)',
        'Formulir kartu riwayat perawatan (maintenance record card)'
      ],
      dasarTeori: 'Perawatan preventif dilakukan secara terjadwal untuk mencegah kerusakan sebelum terjadi, perawatan korektif dilakukan setelah kerusakan terjadi untuk mengembalikan fungsi alat, sedangkan perawatan prediktif menggunakan data kondisi alat (mis. hasil pengukuran berkala) untuk memperkirakan kapan perawatan perlu dilakukan. Dokumentasi riwayat perawatan penting untuk melacak kondisi alat dari waktu ke waktu dan menjadi dasar pengambilan keputusan perawatan selanjutnya.',
      langkahKerja: [
        'Pilih satu peralatan elektronik/laboratorium yang tersedia sebagai objek pembelajaran',
        'Identifikasi jenis perawatan yang sesuai untuk alat tersebut (preventif/korektif/prediktif) berdasarkan karakteristiknya',
        'Buat kartu riwayat perawatan untuk alat tersebut (identitas alat, riwayat pemakaian, riwayat perawatan/perbaikan)',
        'Susun jadwal perawatan preventif sederhana (mis. pembersihan berkala, pengecekan kabel/konektor) untuk alat tersebut',
        'Diskusikan konsekuensi bila perawatan preventif diabaikan pada alat tersebut'
      ],
      tugasLaporan: [
        'Kartu riwayat perawatan yang dibuat untuk alat yang dipilih',
        'Jadwal perawatan preventif sederhana beserta alasan penyusunannya',
        'Kesimpulan perbedaan dan kegunaan masing-masing jenis perawatan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pp-02',
      judul: 'Teknik Troubleshooting dan Diagnosa Kerusakan Rangkaian Elektronik',
      pertemuanSaran: 4,
      tujuan: [
        'Menerapkan pendekatan sistematis (systematic troubleshooting) untuk mendiagnosa kerusakan rangkaian elektronik',
        'Menggunakan alat ukur (multimeter, osiloskop) untuk melacak titik kerusakan pada rangkaian',
        'Membedakan gejala kerusakan komponen umum (short, open, komponen terbakar)'
      ],
      alatBahan: [
        'Rangkaian elektronik sederhana yang sengaja dibuat rusak (fault-inserted) untuk latihan diagnosa',
        'Multimeter, osiloskop, kaca pembesar (untuk inspeksi visual komponen)'
      ],
      dasarTeori: 'Troubleshooting sistematis dimulai dari pemeriksaan visual (komponen terbakar, solderan retak, kabel putus), dilanjutkan pengukuran titik-titik kunci rangkaian (tegangan, kontinuitas) dari sumber ke beban secara bertahap (metode half-split atau signal tracing) untuk mempersempit lokasi kerusakan, sebelum akhirnya mengidentifikasi komponen yang rusak secara spesifik.',
      langkahKerja: [
        'Lakukan inspeksi visual pada rangkaian uji untuk mencari tanda-tanda kerusakan fisik (komponen gosong, solderan retak, dsb.)',
        'Ukur tegangan pada beberapa titik kunci rangkaian dan bandingkan dengan nilai yang seharusnya',
        'Terapkan metode half-split (memeriksa titik tengah rangkaian) untuk mempersempit lokasi kerusakan',
        'Identifikasi komponen yang diduga rusak dan verifikasi menggunakan multimeter (mode dioda/kontinuitas/resistansi)',
        'Dokumentasikan proses diagnosa dari gejala awal hingga ditemukannya komponen yang rusak'
      ],
      tugasLaporan: [
        'Dokumentasi langkah-langkah troubleshooting yang dilakukan beserta hasil pengukuran tiap tahap',
        'Kesimpulan komponen yang teridentifikasi rusak dan alasan diagnosanya',
        'Refleksi efektivitas metode troubleshooting yang digunakan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pp-03',
      judul: 'Perawatan dan Perbaikan Catu Daya (Power Supply)',
      pertemuanSaran: 6,
      tujuan: [
        'Melakukan pemeriksaan dan perawatan rutin pada rangkaian catu daya (power supply)',
        'Mendiagnosa dan memperbaiki kerusakan umum pada catu daya (mis. output tidak stabil, tidak ada output)',
        'Menguji ulang catu daya setelah perbaikan untuk memastikan kinerjanya sesuai spesifikasi'
      ],
      alatBahan: [
        'Catu daya (power supply) yang mengalami gangguan/kerusakan umum untuk bahan praktik',
        'Multimeter, osiloskop, komponen pengganti (dioda, kapasitor, IC regulator, sekring) sesuai kebutuhan'
      ],
      dasarTeori: 'Kerusakan umum pada catu daya sering disebabkan oleh komponen yang aus/rusak seperti kapasitor filter yang mengering (menyebabkan riak tegangan tinggi), dioda penyearah yang short/putus, atau IC regulator yang rusak akibat panas berlebih. Perawatan rutin (pembersihan debu, pengecekan sekring, pengukuran output berkala) dapat mendeteksi tanda-tanda kerusakan sejak dini sebelum catu daya benar-benar gagal berfungsi.',
      langkahKerja: [
        'Lakukan pemeriksaan visual pada catu daya (kondisi kapasitor, sekring, solderan, komponen yang menggelembung/gosong)',
        'Ukur tegangan output catu daya dalam kondisi tanpa beban dan berbeban, bandingkan dengan spesifikasi',
        'Diagnosa penyebab gangguan/kerusakan berdasarkan gejala yang ditemukan (mis. riak tinggi menunjukkan kapasitor filter bermasalah)',
        'Ganti komponen yang teridentifikasi rusak dengan komponen pengganti yang sesuai spesifikasi',
        'Uji ulang catu daya setelah perbaikan (tegangan output, riak, regulasi beban) untuk memastikan kinerjanya pulih'
      ],
      tugasLaporan: [
        'Dokumentasi gejala kerusakan awal dan hasil diagnosa penyebabnya',
        'Daftar komponen yang diganti beserta alasan penggantiannya',
        'Hasil pengujian catu daya setelah perbaikan dibandingkan dengan sebelum perbaikan'
      ],
      k3: 'Kapasitor pada rangkaian catu daya dapat menyimpan muatan listrik meski sumber sudah dimatikan - pastikan dikosongkan (discharge) dengan aman sebelum disentuh/diganti.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pp-04',
      judul: 'Perbaikan Peralatan Elektronik Sederhana (Studi Kasus Peralatan Rumah Tangga)',
      pertemuanSaran: 8,
      tujuan: [
        'Mendiagnosa kerusakan pada peralatan elektronik rumah tangga sederhana (mis. kipas angin, radio, charger)',
        'Melakukan perbaikan sesuai hasil diagnosa dengan mengikuti prosedur keselamatan yang sesuai',
        'Menguji kembali fungsi peralatan setelah diperbaiki'
      ],
      alatBahan: [
        'Peralatan elektronik rumah tangga sederhana yang mengalami kerusakan (mis. kipas angin, radio, charger) sebagai bahan praktik',
        'Obeng, multimeter, solder, komponen pengganti sesuai kebutuhan'
      ],
      dasarTeori: 'Peralatan elektronik rumah tangga sederhana umumnya memiliki rangkaian yang relatif mudah dipahami, sehingga cocok digunakan sebagai bahan latihan penerapan teknik troubleshooting dan perbaikan yang telah dipelajari, sekaligus melatih kehati-hatian dalam membongkar-pasang casing/komponen tanpa merusak bagian yang masih baik.',
      langkahKerja: [
        'Pastikan peralatan dalam keadaan tidak terhubung ke sumber listrik sebelum dibongkar',
        'Bongkar casing peralatan dengan hati-hati dan amati rangkaian/komponen di dalamnya',
        'Lakukan diagnosa kerusakan menggunakan teknik troubleshooting yang telah dipelajari',
        'Perbaiki/ganti komponen yang rusak sesuai hasil diagnosa',
        'Pasang kembali casing dan uji fungsi peralatan setelah perbaikan (dengan pengawasan sebelum dihubungkan ke sumber listrik)'
      ],
      tugasLaporan: [
        'Dokumentasi proses pembongkaran, diagnosa, dan perbaikan yang dilakukan',
        'Daftar komponen yang diperbaiki/diganti',
        'Hasil pengujian akhir peralatan setelah diperbaiki'
      ],
      k3: 'Selalu cabut steker dari sumber listrik sebelum membongkar peralatan; uji coba pertama setelah perbaikan sebaiknya dengan pengawasan dan menggunakan pengaman arus (mis. MCB/RCD) bila tersedia.',
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pp-05',
      judul: 'Perawatan Berkala Peralatan Praktikum/Laboratorium Elektronika',
      pertemuanSaran: 10,
      tujuan: [
        'Melakukan perawatan berkala pada peralatan laboratorium elektronika (mis. trainer, alat ukur)',
        'Memeriksa kalibrasi/keakuratan dasar alat ukur sebelum digunakan',
        'Menyusun jadwal dan checklist perawatan berkala untuk peralatan laboratorium'
      ],
      alatBahan: [
        'Peralatan laboratorium elektronika (trainer, power supply, multimeter, dsb.) yang digunakan sehari-hari',
        'Kain pembersih, kuas kecil, checklist perawatan berkala'
      ],
      dasarTeori: 'Peralatan laboratorium yang digunakan berulang kali oleh banyak mahasiswa memerlukan perawatan berkala untuk menjaga keandalan dan keakuratannya, meliputi pembersihan debu/kotoran, pengecekan kabel dan konektor, serta verifikasi dasar keakuratan alat ukur (mis. membandingkan dengan alat ukur referensi) sebelum digunakan pada praktikum berikutnya.',
      langkahKerja: [
        'Susun checklist perawatan berkala untuk beberapa jenis peralatan laboratorium yang umum digunakan',
        'Lakukan pembersihan fisik pada peralatan (debu, kotoran pada konektor/tombol)',
        'Periksa kondisi kabel, probe, dan konektor pada alat ukur (retak, kendor, karat)',
        'Lakukan verifikasi dasar keakuratan alat ukur dengan membandingkan hasil ukur pada nilai referensi yang diketahui',
        'Catat hasil perawatan pada checklist dan tandai peralatan yang memerlukan tindak lanjut (perbaikan/kalibrasi resmi)'
      ],
      tugasLaporan: [
        'Checklist perawatan berkala yang telah diisi untuk peralatan yang diperiksa',
        'Daftar peralatan yang memerlukan tindak lanjut beserta alasannya',
        'Kesimpulan pentingnya perawatan berkala bagi keandalan peralatan laboratorium'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pp-06',
      judul: 'Dokumentasi dan Pelaporan Hasil Perawatan/Perbaikan',
      pertemuanSaran: 12,
      tujuan: [
        'Menyusun laporan perawatan/perbaikan yang informatif dan terstruktur',
        'Mendokumentasikan riwayat perawatan/perbaikan suatu alat secara berkelanjutan',
        'Memahami pentingnya dokumentasi bagi pengambilan keputusan perawatan di masa depan (mis. kapan alat perlu diganti)'
      ],
      alatBahan: [
        'Data/hasil perawatan-perbaikan dari modul-modul sebelumnya',
        'Template laporan perawatan/perbaikan'
      ],
      dasarTeori: 'Dokumentasi yang baik atas setiap kegiatan perawatan dan perbaikan membentuk riwayat (history) suatu alat yang berguna untuk menganalisis pola kerusakan berulang, memperkirakan usia pakai alat, dan menjadi dasar keputusan apakah suatu alat masih layak diperbaiki atau sebaiknya diganti (repair vs replace decision).',
      langkahKerja: [
        'Kumpulkan seluruh catatan perawatan/perbaikan yang telah dilakukan pada modul-modul sebelumnya',
        'Susun laporan perawatan/perbaikan yang terstruktur (identitas alat, gejala awal, tindakan, hasil akhir) untuk salah satu alat',
        'Analisis pola kerusakan (bila alat pernah mengalami lebih dari satu kali perbaikan) dari riwayat yang ada',
        'Diskusikan kriteria sederhana untuk memutuskan apakah suatu alat masih layak diperbaiki atau perlu diganti',
        'Presentasikan salah satu laporan perawatan/perbaikan yang disusun di depan kelas'
      ],
      tugasLaporan: [
        'Laporan perawatan/perbaikan yang terstruktur untuk minimal satu alat',
        'Analisis pola kerusakan (jika data riwayat tersedia)',
        'Kesimpulan kriteria repair vs replace yang didiskusikan'
      ],
      estimasiWaktu: '2 x 50 menit'
    },
    {
      id: 'pp-07',
      judul: 'Proyek Akhir: Diagnosa dan Perbaikan Perangkat Elektronik (Studi Kasus Nyata)',
      pertemuanSaran: 14,
      tujuan: [
        'Mengintegrasikan seluruh teknik troubleshooting, perawatan, dan dokumentasi dalam satu studi kasus perbaikan nyata',
        'Mendiagnosa dan memperbaiki sebuah perangkat elektronik yang mengalami kerusakan',
        'Menyusun laporan akhir dan mendemonstrasikan hasil perbaikan'
      ],
      alatBahan: [
        'Satu perangkat elektronik rusak (dipilih sendiri atau ditentukan dosen) sebagai studi kasus akhir',
        'Seluruh alat ukur dan alat tangan yang telah digunakan pada modul-modul sebelumnya'
      ],
      dasarTeori: 'Proyek akhir menggabungkan seluruh kompetensi yang telah dipelajari - identifikasi gejala kerusakan, troubleshooting sistematis, perbaikan/penggantian komponen, pengujian ulang, hingga dokumentasi lengkap - dalam satu studi kasus perbaikan perangkat elektronik yang representatif terhadap pekerjaan teknisi perawatan di dunia kerja.',
      langkahKerja: [
        'Pilih/terima satu perangkat elektronik rusak sebagai studi kasus, catat gejala kerusakan yang dilaporkan/diamati',
        'Lakukan diagnosa sistematis menggunakan teknik troubleshooting yang telah dipelajari',
        'Lakukan perbaikan (penggantian komponen, perbaikan sambungan, dsb.) sesuai hasil diagnosa',
        'Uji fungsi perangkat setelah perbaikan dan pastikan bekerja sesuai spesifikasi semula',
        'Susun laporan akhir lengkap dan demonstrasikan hasil perbaikan di depan dosen/kelas'
      ],
      tugasLaporan: [
        'Laporan lengkap studi kasus (gejala awal, proses diagnosa, tindakan perbaikan, hasil akhir)',
        'Dokumentasi foto/video sebelum dan sesudah perbaikan',
        'Refleksi kendala dan pembelajaran yang diperoleh selama proyek perbaikan'
      ],
      estimasiWaktu: '3 x 50 menit (dapat dikerjakan lintas pertemuan)'
    }
  ]
};
