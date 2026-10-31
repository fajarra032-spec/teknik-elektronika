/**
 * PERLUASAN rincian per pertemuan - MK SEMESTER 3 (bagian A), urutan sama dengan sem3a.js (P1-7, P9-15).
 * Pancasila, Dasar Sistem Tenaga Listrik, Elektronika Digital (2 jalur), Mikrokontroler.
 * Format: T([butir tambahan...], 'kegiatan pembelajaran / tugas / praktik')
 */
const T = (extra, keg) => ({ extra, keg });

const digitalAwal = () => [
  T(['Konversi biner-desimal dengan metode bobot dan pembagian 2', 'Heksadesimal untuk alamat dan data', 'Bilangan bertanda: komplemen 1 dan 2'],
    'latihan 15 soal konversi'),
  T(['Simbol gerbang logika (IEEE/IEC)', 'Gerbang universal NAND dan NOR', 'Hukum De Morgan'],
    'menguji gerbang pada IC 7400/7408/7432 dan mengisi tabel kebenaran'),
  T(['Peta Karnaugh 3 dan 4 variabel', 'Bentuk SOP dan POS', 'Kondisi tak peduli (don\'t care)'],
    'merancang dan merakit satu rangkaian dari tabel kebenaran'),
  T(['Rangkaian pembanding (comparator)', 'Decoder seven-segment (7447)', 'Encoder dengan prioritas'],
    'merakit adder 1 bit dan mengujinya'),
  T(['Latch dan flip-flop berpicu tepi', 'Masukan preset dan clear', 'Pembagi frekuensi dengan flip-flop T'],
    'merakit pembagi frekuensi dua dengan IC 7474/7476'),
  T(['Mesin keadaan Moore dan Mealy (pengantar)', 'Tabel keadaan dan tabel eksitasi', 'Diagram waktu'],
    'menganalisis rangkaian sekuensial dan menggambar diagram waktu'),
  T(['Counter 4 bit (7493) dan decade (7490)', 'Register geser serial dan paralel', 'Aplikasi: penghitung digital dan pengatur lampu'],
    'merakit counter 0-9 dengan tampilan seven-segment')
];

const digitalAkhir = () => [
  T(['Logic probe, pulser, dan multimeter', 'Kesalahan umum: kaki IC longgar, catu daya, input mengambang', 'Pemeriksaan dari keluaran ke masukan'],
    'mencari kesalahan pada rangkaian yang telah dikondisikan rusak'),
  T(['Kerusakan umum counter: reset tidak bekerja, clock terlalu cepat', 'Pemeriksaan dengan osiloskop', 'Penulisan laporan perbaikan'],
    'memperbaiki rangkaian dan membuat catatan perbaikan'),
  T(['Contoh proyek: jam digital, penghitung pengunjung, lampu lalu lintas', 'Spesifikasi, diagram blok, dan skema', 'Daftar komponen dan anggaran'],
    'menyusun rancangan proyek dan konsultasi'),
  T(['Perakitan di breadboard lalu PCB lubang', 'Pengujian bertahap', 'Dokumentasi foto dan laporan'],
    'merakit dan menguji proyek'),
  T(['Skenario demonstrasi', 'Penjelasan skema dan alur logika', 'Rubrik penilaian'],
    'presentasi dan demonstrasi proyek')
];

module.exports = {
  pancasila: [
    T(['Pidato 1 Juni 1945 dan Panitia Sembilan', 'Perubahan sila pertama pada 18 Agustus 1945', 'Hari Lahir Pancasila dan maknanya'],
      'menyusun lini masa peristiwa lahirnya Pancasila'),
    T(['Pancasila sebagai paradigma pembangunan', 'Hierarki peraturan perundang-undangan (UU No. 12 Tahun 2011)', 'Pancasila sebagai pemersatu bangsa'],
      'menelusuri keterkaitan Pancasila dengan satu undang-undang'),
    T(['Toleransi dan kebebasan beragama', 'Hak asasi manusia dan martabat manusia', 'Contoh pengamalan di kampus'],
      'menyusun contoh pengamalan sila pertama dan kedua'),
    T(['Persatuan dalam keberagaman', 'Musyawarah mufakat dan kepemimpinan', 'Keadilan sosial dan pemerataan pembangunan'],
      'diskusi pengamalan sila ketiga sampai kelima dalam kehidupan mahasiswa'),
    T(['Nilai dasar, instrumental, dan praksis sebagai kerangka etika', 'Prinsip: kemanusiaan, keadilan, tanggung jawab', 'Etika dalam kehidupan digital'],
      'menilai satu perilaku dengan kerangka etika Pancasila'),
    T(['Kasus kecurangan akademik', 'Kasus perundungan (bullying)', 'Kasus korupsi skala kecil dan besar'],
      'analisis satu kasus dengan lembar analisis'),
    T(['Pancasila dalam kode etik profesi', 'Integritas pada pengukuran dan pelaporan data', 'Kerja sama lintas latar belakang'],
      'diskusi penerapan nilai Pancasila pada situasi kerja nyata'),
    T(['Kasus intoleransi di lingkungan pendidikan', 'Kasus ketidakadilan dalam pelayanan', 'Cara menganalisis dengan sila yang terkait'],
      'analisis kasus dan penentuan sila yang dilanggar'),
    T(['Kasus ketidakjujuran dalam proyek kelompok', 'Kasus pelanggaran privasi data', 'Perumusan solusi yang adil'],
      'presentasi kelompok dan umpan balik'),
    T(['Gotong royong dan kerja bakti', 'Musyawarah warga', 'Kearifan lokal sebagai pengamalan nilai Pancasila'],
      'wawancara singkat dengan tokoh masyarakat dan pelaporan hasilnya'),
    T(['Budaya akademik jujur dan menghargai karya orang lain', 'Kerja tim yang adil dan saling menghargai', 'Etika komunikasi dengan atasan dan rekan'],
      'menyusun tata tertib tim kerja berbasis Pancasila'),
    T(['Hak atas lingkungan kerja yang aman', 'Tanggung jawab bersama menjaga keselamatan', 'Keadilan dalam penerapan K3'],
      'menganalisis kasus kecelakaan dari sudut sila kedua dan kelima'),
    T(['Tanggung jawab terhadap alam sebagai amanat bersama', 'Prinsip keberlanjutan pada produk elektronik', 'Pengelolaan limbah dan daur ulang'],
      'menyusun rencana kegiatan peduli lingkungan kampus'),
    T(['Rangkuman nilai-nilai Pancasila', 'Rencana pengamalan pribadi', 'Umpan balik'],
      'menulis refleksi dan komitmen pengamalan')
  ],

  dasar_sistem_tenaga_listrik: [
    T(['Daya: P = V·I·cos φ; satuan W, VA, dan VAR', 'Segitiga daya (pengantar)', 'Peran PLN dan sistem interkoneksi'],
      'menggambar diagram alur sistem tenaga listrik'),
    T(['Alasan tegangan dinaikkan pada transmisi', 'Susut daya pada saluran: I²R', 'Komponen: tiang, isolator, penghantar, penangkal petir'],
      'menghitung susut daya pada contoh saluran'),
    T(['Rasio Vp/Vs = Np/Ns = Is/Ip', 'Rugi inti dan rugi tembaga (pengantar)', 'Pengujian polaritas dan tahanan belitan'],
      'menghitung tegangan keluaran dan mengamati transformator'),
    T(['Fungsi MCB, MCCB, kontaktor, dan relay termal', 'Diagram pengawatan dan label terminal', 'Kode warna penghantar fasa, netral, dan tanah'],
      'menggambar diagram satu garis (single line diagram) satu panel'),
    T(['Karakteristik trip MCB tipe B, C, dan D', 'Rating arus dan kapasitas pemutusan', 'Fuse tabung dan fuse NH (pengantar)'],
      'memilih MCB untuk tiga beban berbeda'),
    T(['Hubung singkat dan beban lebih', 'Prinsip kerja ELCB/RCD (arus bocor)', 'Koordinasi pengaman hulu-hilir'],
      'diskusi kasus gangguan dan pengaman yang bekerja'),
    T(['Rangkaian lampu dengan saklar tunggal dan saklar tukar', 'Pemasangan stop kontak berpengaman', 'Pemasangan sesuai PUIL'],
      'merakit instalasi satu lampu dan satu stop kontak pada papan latihan'),
    T(['Pemasangan voltmeter dan amperemeter', 'Wattmeter dan kWh meter', 'Faktor daya cos φ'],
      'mengukur V, I, dan P satu beban dan menghitung cos φ'),
    T(['Beban lampu pijar, motor, dan kapasitor', 'Pengaruh beban terhadap faktor daya', 'Pencatatan tabel hasil'],
      'mengukur tiga jenis beban dan membandingkan hasilnya'),
    T(['Hubungan VL = √3 Vp (bintang)', 'Hubungan IL = √3 Ip (segitiga)', 'Urutan fasa dan pengukuran antarfasa', 'Keuntungan sistem 3 fasa dibanding 1 fasa', 'Beban motor induksi pada hubungan bintang dan segitiga', 'Sistem 4 kawat: tiga fasa dan netral'],
      'mengukur tegangan fasa dan tegangan line pada beban 3 fasa'),
    T(['Daya 3 fasa: P = √3 VL IL cos φ', 'Beban tak seimbang dan arus netral', 'Perbaikan cos φ dengan kapasitor'],
      'menghitung kebutuhan kapasitor untuk memperbaiki cos φ'),
    T(['Sistem pentanahan TN, TT, dan IT (pengantar)', 'Elektroda pentanahan', 'Nilai tahanan pentanahan yang disyaratkan'],
      'memeriksa pentanahan di laboratorium dan mencatat hasilnya'),
    T(['APD kelistrikan: sarung tangan dan sepatu isolasi', 'Lock-out/tag-out: kunci dan tanda', 'Uji tegangan nol sebelum bekerja'],
      'praktik prosedur kerja aman pada panel latihan'),
    T(['Struktur laporan: tujuan, dasar teori, data, analisis, simpulan', 'Penyajian data pengukuran', 'Pengumpulan dan umpan balik'],
      'menyusun laporan praktik lengkap')
  ],

  elektronika_digital_instrumentasi: [
    ...digitalAwal(),
    T(['Counter modulo-6 dan modulo-10 dengan reset', 'Cascading counter', 'Tampilan seven-segment'],
      'merancang counter modulo-N'),
    T(['Pengaturan input dan clock pada simulator', 'Probe logika dan penganalisis logika', 'Perbandingan dengan hasil praktik'],
      'mensimulasikan counter dan membandingkannya dengan perakitan'),
    ...digitalAkhir()
  ],

  elektronika_digital_telekomunikasi: [
    ...digitalAwal(),
    T(['Encoder 8-ke-3 dan decoder 3-ke-8', 'Multiplexer 4-ke-1 sebagai pemilih kanal', 'Demultiplexer pada distribusi data'],
      'merakit multiplexer dan menguji pemilihan kanal'),
    T(['Parity genap dan ganjil (gerbang XOR)', 'Konversi paralel-serial dengan IC 74165/74595', 'Deteksi kesalahan 1 bit'],
      'merakit pembangkit parity dan mengujinya'),
    ...digitalAkhir()
  ],

  mikrokontroler: [
    T(['Capaian: merancang sistem berbasis mikrokontroler', 'Daftar alat: Arduino Uno, breadboard, sensor, kabel jumper', 'Prosedur keselamatan praktikum'],
      'pengenalan RPS dan pembagian kelompok'),
    T(['ATmega328P: memori flash, SRAM, dan EEPROM', 'Pin digital, analog, dan PWM', 'Catu daya dan port USB'],
      'mengidentifikasi pin dan bagian papan Arduino'),
    T(['Pemilihan board dan port', 'Library dan contoh sketch', 'Mengunggah program Blink'],
      'mengunggah program Blink dan mengubah waktu nyala'),
    T(['Ruang lingkup variabel: lokal dan global', 'Konstanta (const dan #define)', 'Operator aritmetika dan perbandingan'],
      'membuat program perhitungan sederhana dengan Serial Monitor'),
    T(['Fungsi buatan sendiri', 'Array satu dimensi dan indeks', 'millis() sebagai alternatif delay()'],
      'membuat program dengan fungsi dan array'),
    T(['Pemilihan resistor pembatas arus', 'pinMode dan digitalWrite', 'Pola running LED dan kedip bergantian'],
      'merakit dan memrogram 4 LED dengan pola'),
    T(['Seven-segment common cathode/anode', 'LCD I2C: alamat dan library LiquidCrystal_I2C', 'Menampilkan hasil sensor'],
      'menampilkan angka dan teks pada LCD'),
    T(['Rumus jarak = (waktu x 0,034) / 2', 'Sensor air dan analogRead', 'Sensor sentuh kapasitif'],
      'membuat alat ukur jarak dengan tampilan LCD'),
    T(['Serial.begin dan Serial.read', 'Perintah karakter untuk menyalakan perangkat', 'Penguraian (parsing) perintah sederhana'],
      'mengontrol LED dari Serial Monitor'),
    T(['Library Servo dan pengaturan sudut', 'Driver motor L298N', 'Mengatur kecepatan motor dengan analogWrite'],
      'mengendalikan kecepatan motor dan sudut servo'),
    T(['Pilihan topik: lampu otomatis, pintu otomatis, alarm jarak', 'Daftar kebutuhan dan anggaran', 'Flowchart sistem'],
      'menyusun proposal proyek akhir'),
    T(['Perakitan bertahap dan pengujian per modul', 'Debugging dengan Serial Monitor', 'Pembagian peran kelompok'],
      'merakit dan memrogram proyek'),
    T(['Uji fungsi dan uji ketahanan', 'Daftar masalah dan perbaikan', 'Penyusunan laporan akhir'],
      'menguji proyek dan menyusun laporan'),
    T(['Struktur presentasi: tujuan, rancangan, demonstrasi, hasil', 'Penjelasan kode program', 'Rubrik penilaian'],
      'presentasi dan demonstrasi tugas besar')
  ]
};
