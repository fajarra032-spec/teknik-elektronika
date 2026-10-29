/**
 * data/rencanaPertemuanData.js
 *
 * Rencana 16 pertemuan per mata kuliah, DISALIN DARI RPS resmi
 * (https://elektronika.polidewa.ac.id/dokumen/rps/RPS_Semester_1-3.pdf,
 * tanggal penyusunan 8 April 2026, Kurikulum 2026).
 *
 * Status sumber per MK (field `sumber`):
 *   'rps'    -> isi diambil dari tabel "Pelaksanaan Perkuliahan" di RPS.
 *   'usulan' -> RPS belum terbaca (PEK3209 Antena dan Propagasi,
 *               PEK3210 Keamanan Siber); isi DRAFT, cocokkan dulu dengan RPS.
 *
 * Catatan format RPS: sebagian besar MK menulis satu materi untuk DUA
 * pertemuan (mis. "1-2", "3-4") dan satu pertemuan untuk "7" dan "15".
 * Di sini tiap pertemuan dipecah sendiri; materi 2 pertemuan diberi
 * penanda "bagian 1/2" dan "bagian 2/2" (pembagian isi dua bagian itu
 * diserahkan ke dosen). Mikrokontroler (PEK3203) di RPS-nya sudah per pertemuan.
 *
 * P8 = UTS, P16 = UAS di semua MK.
 *
 * Pemakaian:
 *   const { getRencanaPertemuan, getInfoRencana } = require('../../data/rencanaPertemuanData');
 *   const rencana = getRencanaPertemuan(mk.kode);   // array 16 | null
 */

const W_TEORI2 = '2 x 50 menit (Teori)';
const W_PRAKTIK = '1 x 50 menit (Teori) + 2 x 170 menit (Praktik)';
const W_AGAMA = '1 x 50 menit (Teori) + 1 x 170 menit (Praktik)';

// baris RPS: [dariPertemuan, sampaiPertemuan, topik, kemampuanAkhir, metode, bobot%]
const R = (a, b, topik, kemampuan, metode, bobot) => ({ a, b, topik, kemampuan, metode, bobot });

function jenisDari(metode, topik) {
  if (/^presentasi/i.test(topik)) return 'presentasi';
  if (/praktikum|PjBL|project based|observasi/i.test(metode)) return 'praktik';
  return 'materi';
}

function bangun(rows, sumber) {
  const hasil = [];
  for (const r of rows) {
    const n = r.b - r.a + 1;
    for (let p = r.a; p <= r.b; p++) {
      hasil.push({
        pertemuan: p,
        topik: n > 1 ? `${r.topik} (bagian ${p - r.a + 1}/${n})` : r.topik,
        topikRps: r.topik,
        bagian: n > 1 ? `${p - r.a + 1}/${n}` : null,
        kemampuan: r.kemampuan,
        metode: r.metode,
        bobot: r.bobot,
        jenis: jenisDari(r.metode, r.topik),
        sumber,
      });
    }
  }
  hasil.push({ pertemuan: 8, topik: 'Ujian Tengah Semester (UTS)', topikRps: 'UTS', bagian: null, kemampuan: 'Mencakup materi pertemuan 1-7', metode: '', bobot: null, jenis: 'ujian', sumber });
  hasil.push({ pertemuan: 16, topik: 'Ujian Akhir Semester (UAS)', topikRps: 'UAS', bagian: null, kemampuan: 'Mencakup materi pertemuan 9-15', metode: '', bobot: null, jenis: 'ujian', sumber });
  hasil.sort((x, y) => x.pertemuan - y.pertemuan);
  if (hasil.length !== 16) throw new Error('Rencana harus 16 pertemuan, dapat ' + hasil.length);
  hasil.forEach((h, i) => { if (h.pertemuan !== i + 1) throw new Error('Urutan/celah pertemuan salah di ' + h.pertemuan); });
  return hasil;
}

// draft untuk MK yang RPS-nya belum terbaca: 14 topik (P1-7, P9-15)
function bangunUsulan(topik14) {
  const rows = [];
  let k = 0;
  for (let p = 1; p <= 15; p++) {
    if (p === 8) continue;
    rows.push(R(p, p, topik14[k++], '', '', null)); // draft: target & metode dikosongkan
  }
  return bangun(rows, 'usulan');
}

const RENCANA = {
  // ===================== SEMESTER 1 =====================
  agama: { nama: 'Pendidikan Agama (WUD2201-2205)', sks: 2, waktu: W_AGAMA, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Konsep Ketuhanan dan Agama', 'Menjelaskan konsep ketuhanan dan agama', 'Ceramah, diskusi', 10),
    R(3, 4, 'Nilai-nilai Keagamaan', 'Mengidentifikasi nilai-nilai keagamaan', 'Ceramah, diskusi kelompok', 10),
    R(5, 6, 'Etika dalam Beragama', 'Menjelaskan etika dalam beragama', 'Ceramah, studi kasus', 10),
    R(7, 7, 'Agama dan Profesi', 'Mengaitkan agama dengan profesi', 'Diskusi, presentasi', 10),
    R(9, 10, 'Toleransi Beragama', 'Menjelaskan toleransi beragama', 'Ceramah, diskusi', 10),
    R(11, 12, 'Agama dan Moral', 'Menginternalisasi agama dan moral', 'Ceramah, diskusi', 10),
    R(13, 14, 'Agama dan Etika Kerja', 'Menganalisis studi kasus agama dan etika kerja', 'Diskusi, studi kasus', 10),
    R(15, 15, 'Presentasi Kelompok', 'Mempresentasikan hasil diskusi kelompok', 'Presentasi', 10),
  ], 'rps') },

  bahasa_indonesia: { nama: 'Bahasa Indonesia (WUD3208)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Karakteristik Bahasa Indonesia Keilmuan', 'Menjelaskan karakteristik Bahasa Indonesia Keilmuan (BIK)', 'Ceramah, diskusi', 5),
    R(3, 4, 'Tata Tulis Ilmiah', 'Menerapkan tata tulis karya ilmiah', 'Praktikum, latihan', 10),
    R(5, 6, 'Latar Belakang dan Tinjauan Pustaka', 'Menyusun latar belakang dan tinjauan pustaka', 'Praktikum, tugas', 10),
    R(7, 7, 'Metodologi dan Kesimpulan', 'Menyusun metodologi dan kesimpulan', 'Praktikum, diskusi', 5),
    R(9, 10, 'Laporan Teknis', 'Menyusun laporan teknis sederhana', 'Praktikum', 10),
    R(11, 12, 'Teknik Penulisan dan Editing', 'Menerapkan teknik penulisan dan penyuntingan laporan', 'Praktikum, tugas', 10),
    R(13, 14, 'Presentasi Ilmiah', 'Menyusun presentasi ilmiah', 'Praktikum, simulasi', 10),
    R(15, 15, 'Presentasi', 'Mempresentasikan karya ilmiah', 'Presentasi', 5),
  ], 'rps') },

  bahasa_inggris: { nama: 'Bahasa Inggris (WUD3209)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Reading', 'Memahami teks teknis sederhana', 'Praktikum, diskusi', 6),
    R(3, 4, 'Vocabulary and Structure', 'Mengidentifikasi kosakata dan struktur kalimat teknis', 'Latihan, kuis', 6),
    R(5, 6, 'Writing: Paragraf Deskriptif dan Prosedural', 'Menulis paragraf deskriptif dan prosedural', 'Praktikum, tugas', 6),
    R(7, 7, 'Writing: Email Profesional', 'Menulis email profesional', 'Praktikum, simulasi', 5),
    R(9, 10, 'Reading and Summarizing', 'Membaca dan meringkas artikel teknik', 'Praktikum, diskusi', 8),
    R(11, 12, 'Writing: Laporan Sederhana', 'Menulis laporan sederhana', 'Praktikum, tugas', 8),
    R(13, 14, 'Presentation: Menyusun dan Berlatih', 'Menyusun dan berlatih presentasi', 'Praktikum, simulasi', 8),
    R(15, 15, 'Presentation', 'Mempresentasikan topik teknik', 'Presentasi', 8),
  ], 'rps') },

  etika_kerja: { nama: 'Etika Kerja (PD3201)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Konsep Etika dan Etika Profesi', 'Menjelaskan konsep etika, moral, dan etika profesi', 'Ceramah, diskusi', 5),
    R(3, 4, 'Kode Etik dan Perilaku Kerja', 'Mengidentifikasi kode etik dan perilaku etis/tidak etis', 'Diskusi kelompok', 10),
    R(5, 6, 'Studi Kasus Etika Kerja', 'Menganalisis kasus etika di tempat kerja', 'Analisis kasus', 10),
    R(7, 7, 'Tanggung Jawab Profesional', 'Menjelaskan tanggung jawab profesional', 'Ceramah, diskusi', 5),
    R(9, 10, 'Aplikasi Etika Kerja', 'Menerapkan etika dalam simulasi situasi kerja', 'Simulasi, role play', 10),
    R(11, 12, 'Etika, K3, dan Lingkungan', 'Mengaitkan etika dengan K3 dan lingkungan kerja', 'Diskusi', 10),
    R(13, 14, 'Makalah dan Presentasi', 'Menyusun dan mempresentasikan makalah etika kerja', 'Tugas mandiri, presentasi', 10),
    R(15, 15, 'Refleksi', 'Melakukan refleksi dan komitmen etis', 'Diskusi, refleksi', 5),
  ], 'rps') },

  standardisasi: { nama: 'Standardisasi (PD3202)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Pengantar Standardisasi', 'Menjelaskan pengertian, tujuan, dan organisasi standardisasi', 'Ceramah, diskusi', 5),
    R(3, 4, 'SNI dan Standar Komponen', 'Menjelaskan SNI dan standar komponen elektronika', 'Ceramah, diskusi kelompok', 10),
    R(5, 6, 'ISO/IEC dan Standar Keselamatan', 'Menjelaskan ISO, IEC, dan standar keselamatan', 'Ceramah, diskusi', 10),
    R(7, 7, 'Akreditasi dan Sertifikasi', 'Menjelaskan akreditasi dan sertifikasi', 'Ceramah, diskusi', 5),
    R(9, 10, 'Aplikasi Standar Dokumen/Gambar', 'Menerapkan standar dalam dokumen dan gambar teknik', 'Praktikum', 10),
    R(11, 12, 'Standar Kelistrikan', 'Menerapkan standar kelistrikan pada praktik', 'Praktikum', 10),
    R(13, 14, 'Makalah dan Presentasi', 'Menyusun dan mempresentasikan makalah standardisasi', 'Tugas mandiri, presentasi', 10),
    R(15, 15, 'Diskusi Penerapan Standar', 'Berdiskusi penerapan standar di industri', 'Diskusi', 5),
  ], 'rps') },

  matematika_teknik: { nama: 'Matematika Teknik (PD3203)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Integral Dasar dan Teknik Integrasi', 'Menjelaskan dan menerapkan integral dasar', 'Ceramah, latihan soal', 6),
    R(3, 4, 'Aplikasi Integral', 'Menerapkan integral pada permasalahan teknik', 'Ceramah, latihan soal', 6),
    R(5, 6, 'Persamaan Diferensial Orde Satu', 'Menjelaskan dan menyelesaikan persamaan diferensial orde satu', 'Ceramah, latihan soal', 6),
    R(7, 7, 'Aplikasi Persamaan Diferensial', 'Menerapkan persamaan diferensial pada rangkaian elektronika', 'Latihan soal', 5),
    R(9, 10, 'Bilangan Kompleks', 'Menjelaskan bilangan kompleks', 'Ceramah, latihan', 8),
    R(11, 12, 'Matriks dan Aplikasinya', 'Menjelaskan dan menerapkan matriks pada teknik', 'Ceramah, latihan soal', 8),
    R(13, 14, 'Deret dan Fungsi', 'Menjelaskan dan menerapkan deret dan fungsi', 'Ceramah, latihan soal', 8),
    R(15, 15, 'Evaluasi dan Refleksi', 'Latihan soal komprehensif', 'Latihan, refleksi', 3),
  ], 'rps') },

  perangkat_lunak_aplikasi: { nama: 'Perangkat Lunak Aplikasi (PD3204)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Pengenalan Software Teknik', 'Menjelaskan berbagai perangkat lunak teknik', 'Ceramah, diskusi', 5),
    R(3, 4, 'Excel', 'Menggunakan Excel untuk perhitungan dan grafik teknik', 'Praktikum', 10),
    R(5, 6, 'CAD 2D/3D', 'Menggambar 2D dan 3D dengan CAD', 'Praktikum', 10),
    R(7, 7, 'Latihan CAD', 'Latihan menggambar 3D', 'Praktikum', 5),
    R(9, 10, 'MechaniCalc dan Simulasi', 'Menggunakan MechaniCalc dan software simulasi', 'Praktikum', 10),
    R(11, 12, 'Desain PCB', 'Membuat skematik dan layout PCB dengan Eagle/KiCad', 'Praktikum', 10),
    R(13, 14, 'Latihan Desain PCB', 'Latihan desain PCB komprehensif', 'Praktikum', 5),
    R(15, 15, 'Presentasi Hasil Desain', 'Mempresentasikan hasil desain', 'Presentasi', 5),
  ], 'rps') },

  // ===================== SEMESTER 2 =====================
  pkn: { nama: 'Pendidikan Kewarganegaraan (WUD2206)', sks: 2, waktu: W_TEORI2, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Konsep Warga Negara', 'Menjelaskan konsep warga negara', 'Ceramah, diskusi', 15),
    R(3, 4, 'Hak dan Kewajiban', 'Menyebutkan hak dan kewajiban warga negara', 'Ceramah, tanya jawab', 15),
    R(5, 6, 'Bela Negara', 'Menjelaskan konsep bela negara', 'Ceramah, diskusi', 15),
    R(7, 7, 'Demokrasi dan Pemilu', 'Menjelaskan demokrasi dan pemilu', 'Ceramah, diskusi', 5),
    R(9, 10, 'Pancasila sebagai Ideologi', 'Menjelaskan Pancasila sebagai ideologi negara', 'Ceramah, diskusi', 15),
    R(11, 12, 'Peran Warga Negara', 'Mengidentifikasi peran warga negara dalam pembangunan', 'Diskusi kelompok', 15),
    R(13, 14, 'Studi Kasus', 'Menganalisis studi kasus kewarganegaraan', 'Analisis kasus', 10),
    R(15, 15, 'Refleksi Akhir', 'Melakukan refleksi akhir pembelajaran', 'Diskusi, refleksi', 10),
  ], 'rps') },

  k3: { nama: 'Keselamatan dan Kesehatan Kerja / K3 (PD3205)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Pengantar dan Regulasi K3', 'Menjelaskan pengertian, tujuan, dan regulasi K3', 'Ceramah, studi dokumen', 5),
    R(3, 4, 'Identifikasi Bahaya', 'Mengidentifikasi bahaya di laboratorium elektronika', 'Observasi lab', 6),
    R(5, 6, 'Rambu K3 dan APD', 'Menjelaskan rambu K3 dan menggunakan APD', 'Demonstrasi, praktikum', 8),
    R(7, 7, 'Perawatan APD', 'Merawat APD', 'Praktikum', 5),
    R(9, 10, 'Kebakaran dan APAR', 'Menjelaskan segitiga api dan simulasi pemadaman APAR', 'Ceramah, praktikum simulasi', 8),
    R(11, 12, 'Sengatan Listrik dan P3K', 'Menerapkan prosedur sengatan listrik dan P3K', 'Ceramah, praktikum simulasi', 8),
    R(13, 14, 'Prinsip 5R', 'Menerapkan prinsip 5R di laboratorium', 'Ceramah, praktik kelompok', 8),
    R(15, 15, 'Laporan K3', 'Menyusun laporan K3', 'Penugasan', 7),
  ], 'rps') },

  aplikasi_komputer: { nama: 'Aplikasi Komputer (PD3206)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Pengantar dan Word Dasar', 'Menjelaskan fungsi aplikasi komputer dan menggunakan MS Word dasar', 'Ceramah, praktikum', 6),
    R(3, 4, 'Word Lanjutan dan Dokumen Teknis', 'Menggunakan MS Word lanjutan untuk dokumen teknis', 'Praktikum', 8),
    R(5, 6, 'Excel Dasar dan Lanjutan', 'Menggunakan MS Excel dasar dan lanjutan', 'Praktikum', 8),
    R(7, 7, 'Grafik Excel', 'Membuat grafik dengan Excel', 'Praktikum', 3),
    R(9, 10, 'Pengolahan Data', 'Mengolah data eksperimen dengan Excel', 'Praktikum', 8),
    R(11, 12, 'PowerPoint dan Presentasi', 'Menyusun presentasi dan berlatih dengan PowerPoint', 'Praktikum, simulasi', 8),
    R(13, 14, 'Proyek Terintegrasi', 'Menyelesaikan proyek terintegrasi Word-Excel-PowerPoint', 'Tugas mandiri', 8),
    R(15, 15, 'Presentasi Proyek', 'Mempresentasikan proyek', 'Presentasi', 6),
  ], 'rps') },

  teknik_pengukuran: { nama: 'Teknik Pengukuran (PD3207)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Pengantar Pengukuran dan Alat Ukur', 'Menjelaskan prinsip dasar pengukuran dan jenis alat ukur', 'Ceramah, demonstrasi', 5),
    R(3, 4, 'Praktik Multimeter', 'Menggunakan multimeter untuk mengukur tegangan, arus, dan resistansi', 'Praktikum', 10),
    R(5, 6, 'Osiloskop', 'Menjelaskan dan menggunakan osiloskop', 'Ceramah, demonstrasi, praktikum', 10),
    R(7, 7, 'Function Generator', 'Menggunakan function generator', 'Praktikum', 5),
    R(9, 10, 'Pengukuran Non-Listrik', 'Mengukur besaran non-listrik dengan sensor dasar', 'Ceramah, praktikum', 10),
    R(11, 12, 'Kalibrasi dan Troubleshooting', 'Melakukan kalibrasi sederhana dan troubleshooting', 'Praktikum', 10),
    R(13, 14, 'Latihan Pengukuran', 'Latihan pengukuran komprehensif', 'Praktikum', 8),
    R(15, 15, 'Laporan Pengukuran', 'Menyusun laporan pengukuran', 'Penugasan', 2),
  ], 'rps') },

  peralatan_teknik: { nama: 'Peralatan Teknik (PD3208)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Pengantar Peralatan Teknik', 'Menjelaskan pengelompokan dan fungsi peralatan teknik', 'Ceramah, demonstrasi', 5),
    R(3, 4, 'Praktik Multimeter dan Osiloskop', 'Menggunakan multimeter dan osiloskop', 'Praktikum', 10),
    R(5, 6, 'Praktik Function Generator, Power Supply, Solder', 'Menggunakan function generator, power supply, dan solder', 'Praktikum', 10),
    R(7, 7, 'Alat Tangan', 'Menggunakan alat tangan (tang, cutter)', 'Praktikum', 5),
    R(9, 10, 'Perawatan Peralatan', 'Merawat peralatan teknik', 'Praktikum', 10),
    R(11, 12, 'Troubleshooting dan Perbaikan', 'Mengidentifikasi dan memperbaiki kerusakan alat sederhana', 'Praktikum', 10),
    R(13, 14, 'Latihan Komprehensif', 'Latihan komprehensif penggunaan dan perawatan alat', 'Praktikum', 8),
    R(15, 15, 'Laporan dan Presentasi', 'Menyusun dan mempresentasikan laporan alat', 'Penugasan, presentasi', 2),
  ], 'rps') },

  menggambar_teknik: { nama: 'Menggambar Teknik (PD3209)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Alat dan Standar Gambar', 'Menjelaskan alat dan standar gambar teknik', 'Ceramah, demonstrasi', 5),
    R(3, 4, 'Latihan Dasar dan Proyeksi', 'Menggambar garis, huruf, dan proyeksi sederhana', 'Praktikum', 8),
    R(5, 6, 'Skema Elektronika dan Diagram Kelistrikan', 'Menggambar skema elektronika dan diagram kelistrikan', 'Praktikum', 10),
    R(7, 7, 'Layout PCB Manual', 'Menggambar layout PCB sederhana secara manual', 'Praktikum', 5),
    R(9, 10, 'Pengenalan CAD dan Gambar 2D', 'Mengenal dan menggambar 2D dengan software CAD', 'Praktikum', 10),
    R(11, 12, 'CAD Skematik dan Layout PCB', 'Menggambar skematik dan layout PCB dengan CAD', 'Praktikum', 10),
    R(13, 14, 'Latihan CAD dan Gambar Kerja', 'Latihan CAD komprehensif dan menyusun gambar kerja', 'Praktikum', 8),
    R(15, 15, 'Presentasi Gambar', 'Mempresentasikan hasil gambar', 'Presentasi', 2),
  ], 'rps') },

  data_sistem_informasi: { nama: 'Data dan Sistem Informasi (PD3210)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Pengantar Sistem Informasi', 'Menjelaskan konsep data, informasi, dan komponen sistem informasi', 'Ceramah, diskusi kelompok', 5),
    R(3, 4, 'Excel Dasar dan Analisis', 'Menggunakan Excel untuk data dan analisis dasar', 'Praktikum', 10),
    R(5, 6, 'SPSS Dasar dan Statistik', 'Menggunakan SPSS dasar dan statistik', 'Praktikum', 10),
    R(7, 7, 'Pengolahan Data', 'Mengolah data dengan Excel dan SPSS', 'Praktikum', 5),
    R(9, 10, 'Visualisasi Data', 'Membuat grafik dan visualisasi data', 'Praktikum', 10),
    R(11, 12, 'Laporan Analisis Data', 'Menyusun laporan analisis data', 'Praktikum, penugasan', 10),
    R(13, 14, 'Latihan Analisis Data', 'Latihan analisis data komprehensif', 'Praktikum', 8),
    R(15, 15, 'Presentasi Hasil Analisis', 'Mempresentasikan hasil analisis', 'Presentasi', 2),
  ], 'rps') },

  // ===================== SEMESTER 3 =====================
  pancasila: { nama: 'Pendidikan Pancasila (WUD2207)', sks: 2, waktu: W_TEORI2, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Sejarah dan Kedudukan Pancasila', 'Menjelaskan sejarah dan kedudukan Pancasila', 'Ceramah, diskusi', 15),
    R(3, 4, 'Sila-sila Pancasila', 'Menjelaskan sila-sila Pancasila', 'Ceramah, diskusi', 15),
    R(5, 6, 'Pancasila dan Etika', 'Mengaitkan Pancasila dengan etika', 'Diskusi, studi kasus', 15),
    R(7, 7, 'Pancasila dan Profesi', 'Mengaitkan Pancasila dengan profesi', 'Diskusi, presentasi', 5),
    R(9, 10, 'Studi Kasus Pancasila', 'Menganalisis studi kasus Pancasila', 'Analisis kasus', 15),
    R(11, 12, 'Implementasi Pancasila', 'Mengidentifikasi implementasi Pancasila', 'Diskusi', 15),
    R(13, 14, 'Pancasila, K3, dan Lingkungan', 'Mengaitkan Pancasila dengan K3 dan lingkungan', 'Diskusi', 10),
    R(15, 15, 'Refleksi Akhir', 'Melakukan refleksi akhir', 'Refleksi', 10),
  ], 'rps') },

  dasar_sistem_tenaga_listrik: { nama: 'Dasar Sistem Tenaga Listrik (PEK3201)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Prinsip Dasar Sistem Tenaga', 'Menjelaskan prinsip dasar, pembangkit, transmisi, dan distribusi tenaga listrik', 'Ceramah, diskusi', 6),
    R(3, 4, 'Komponen Sistem Tenaga', 'Mengidentifikasi komponen sistem tenaga (transformator, panel distribusi)', 'Ceramah, demonstrasi, observasi', 8),
    R(5, 6, 'Sistem Proteksi', 'Menjelaskan sistem proteksi (MCB, fuse)', 'Ceramah, diskusi', 6),
    R(7, 7, 'Instalasi Listrik', 'Melakukan instalasi listrik sederhana', 'Praktikum', 5),
    R(9, 10, 'Pengukuran 1 Fasa', 'Mengukur sistem tenaga 1 fasa', 'Praktikum', 8),
    R(11, 12, 'Pengukuran 3 Fasa dan Analisis Beban', 'Mengukur sistem tenaga 3 fasa dan menganalisis beban listrik', 'Praktikum', 8),
    R(13, 14, 'Grounding dan K3', 'Menjelaskan grounding dan menerapkan K3 pada sistem tenaga', 'Ceramah, praktikum', 8),
    R(15, 15, 'Laporan', 'Menyusun laporan sistem tenaga listrik', 'Penugasan', 2),
  ], 'rps') },

  elektronika_digital_instrumentasi: { nama: 'Elektronika Digital - Instrumentasi (PEK3202)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Sistem Bilangan dan Gerbang Logika', 'Menjelaskan sistem bilangan digital dan gerbang logika dasar', 'Ceramah, demonstrasi', 6),
    R(3, 4, 'Rangkaian Kombinasional', 'Menganalisis dan merancang rangkaian kombinasional', 'Ceramah, praktikum', 8),
    R(5, 6, 'Flip-Flop dan Rangkaian Sekuensial', 'Menjelaskan flip-flop dan menganalisis rangkaian sekuensial', 'Ceramah, demonstrasi', 8),
    R(7, 7, 'Counter dan Register', 'Menjelaskan counter dan register', 'Ceramah, demonstrasi', 5),
    R(9, 10, 'Perancangan Counter dan Simulasi', 'Merancang counter sederhana dan mensimulasikan rangkaian digital', 'Praktikum', 8),
    R(11, 12, 'Troubleshooting', 'Melakukan troubleshooting rangkaian digital', 'Praktikum', 8),
    R(13, 14, 'Proyek Rangkaian Digital', 'Menyelesaikan proyek rangkaian digital', 'Praktikum, PjBL', 8),
    R(15, 15, 'Presentasi dan Laporan', 'Mempresentasikan proyek dan menyusun laporan', 'Presentasi, penugasan', 2),
  ], 'rps') },

  elektronika_digital_telekomunikasi: { nama: 'Elektronika Digital - Telekomunikasi (PEK3208)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Sistem Bilangan dan Gerbang Logika', 'Menjelaskan sistem bilangan digital dan gerbang logika dasar', 'Ceramah, demonstrasi', 6),
    R(3, 4, 'Rangkaian Kombinasional', 'Menganalisis dan merancang rangkaian kombinasional', 'Ceramah, praktikum', 8),
    R(5, 6, 'Flip-Flop dan Sekuensial', 'Menjelaskan flip-flop dan menganalisis rangkaian sekuensial', 'Ceramah, demonstrasi', 8),
    R(7, 7, 'Counter dan Register', 'Menjelaskan counter dan register', 'Ceramah, demonstrasi', 5),
    R(9, 10, 'Aplikasi Digital pada Telekomunikasi', 'Menerapkan rangkaian digital pada sistem telekomunikasi sederhana', 'Praktikum', 8),
    R(11, 12, 'Troubleshooting', 'Melakukan troubleshooting rangkaian digital', 'Praktikum', 8),
    R(13, 14, 'Proyek Rangkaian Digital', 'Menyelesaikan proyek rangkaian digital', 'Praktikum, PjBL', 8),
    R(15, 15, 'Presentasi dan Laporan', 'Mempresentasikan proyek dan menyusun laporan', 'Presentasi, penugasan', 2),
  ], 'rps') },

  mikrokontroler: { nama: 'Mikrokontroler (PEK3203)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', catatan: 'RPS Mikrokontroler sudah ditulis per pertemuan (bukan per 2 pertemuan).', pertemuan: bangun([
    R(1, 1, 'Kontrak Perkuliahan dan RPS', 'Menyepakati kontrak perkuliahan, RPS, penilaian, tujuan pembelajaran, dan tata tertib', 'Kuliah tatap muka dan diskusi', 1),
    R(2, 2, 'Pengenalan Mikrokontroler Arduino', 'Menjelaskan pengertian mikrokontroler dan Arduino, arsitektur hardware, keluarga AVR, dan platform Arduino', 'Kuliah, diskusi, pemberian tugas', 5),
    R(3, 3, 'Instalasi Arduino IDE dan Struktur Dasar Bahasa C', 'Memahami Arduino IDE, menu-menunya, dan struktur dasar bahasa C', 'Project based learning', 10),
    R(4, 4, 'Variabel dan Penggunaannya pada Arduino IDE', 'Memahami jenis variabel dan mempraktikkannya pada program bahasa C', 'Project based learning', 10),
    R(5, 5, 'Logika Pemrograman: IF, IF ELSE, SWITCH CASE, FOR, WHILE, DO WHILE', 'Memahami dan mempraktikkan logika pemrograman', 'Project based learning', 5),
    R(6, 6, 'Praktikum Merangkai dan Mengendalikan LED', 'Merangkai dan mengendalikan lampu LED dengan Arduino', 'Praktikum, project based learning', 8),
    R(7, 7, 'Praktikum Seven Segment dan LCD 2x16 I2C', 'Menggunakan dan mengendalikan seven segment serta LCD 2x16 I2C', 'Praktikum, project based learning', 8),
    R(9, 9, 'Praktikum Sensor Ultrasonik, Sensor Air, Sensor Sentuh', 'Menggunakan sensor ultrasonik, sensor air, dan sensor sentuh', 'Praktikum, project based learning', 8),
    R(10, 10, 'Praktikum Serial Input sebagai Kontrol', 'Menggunakan serial input sebagai kontrol sistem', 'Praktikum, project based learning', 8),
    R(11, 11, 'Praktikum Motor Servo dan Motor DC', 'Mengendalikan motor servo dan motor DC dengan Arduino', 'Praktikum, project based learning', 8),
    R(12, 13, 'Merangkai dan Mengontrol Sistem Berbasis Mikrokontroler (Proyek Akhir)', 'Merangkai dan mengontrol sistem sederhana berbasis mikrokontroler sebagai proyek akhir', 'Project based learning', 12),
    R(14, 14, 'Pengujian dan Penyempurnaan Proyek', 'Menguji dan menyempurnakan sistem proyek akhir', 'Praktikum, diskusi', 6),
    R(15, 15, 'Presentasi Tugas Besar', 'Mempresentasikan tugas besar (proyek mikrokontroler)', 'Presentasi', 5),
  ], 'rps') },

  rangkaian_elektronika: { nama: 'Rangkaian Elektronika (PEK3204)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Komponen Pasif dan Dioda', 'Menjelaskan komponen pasif dan dioda beserta aplikasinya', 'Ceramah, demonstrasi', 6),
    R(3, 4, 'Rangkaian Penyearah dan BJT', 'Menganalisis rangkaian penyearah dan transistor BJT', 'Ceramah, latihan, demonstrasi', 8),
    R(5, 6, 'Rangkaian Transistor dan FET', 'Menganalisis rangkaian transistor dan menjelaskan transistor FET', 'Ceramah, latihan', 8),
    R(7, 7, 'Op-Amp Dasar', 'Menjelaskan dan menganalisis op-amp dasar', 'Ceramah, demonstrasi', 5),
    R(9, 10, 'Perancangan Power Supply', 'Merancang power supply sederhana', 'Praktikum', 8),
    R(11, 12, 'Perancangan Penguat dan Simulasi', 'Merancang penguat sederhana dan mensimulasikan rangkaian', 'Praktikum', 8),
    R(13, 14, 'Troubleshooting dan Proyek', 'Melakukan troubleshooting dan menyelesaikan proyek rangkaian elektronika', 'Praktikum, PjBL', 8),
    R(15, 15, 'Presentasi Proyek', 'Mempresentasikan proyek rangkaian elektronika', 'Presentasi', 2),
  ], 'rps') },

  perawatan_perbaikan: { nama: 'Perawatan dan Perbaikan (PEK3205)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Konsep dan Jenis Perawatan', 'Menjelaskan konsep dan jenis perawatan (preventif, korektif)', 'Ceramah, diskusi', 6),
    R(3, 4, 'Alat/Bahan Perawatan dan Diagnosis', 'Menjelaskan alat dan bahan perawatan serta mendiagnosis kerusakan', 'Demonstrasi, praktikum', 8),
    R(5, 6, 'Diagnosis Power Supply dan Amplifier', 'Mendiagnosis kerusakan power supply dan amplifier', 'Praktikum', 8),
    R(7, 7, 'Diagnosis Perangkat Digital', 'Mendiagnosis kerusakan perangkat digital', 'Praktikum', 5),
    R(9, 10, 'Perbaikan Solder dan Power Supply', 'Melakukan perbaikan solder dan power supply', 'Praktikum', 8),
    R(11, 12, 'Perbaikan Amplifier dan Digital', 'Melakukan perbaikan amplifier dan perangkat digital', 'Praktikum', 8),
    R(13, 14, 'Penggantian Komponen dan Laporan', 'Mengganti komponen rusak dan menyusun laporan perbaikan', 'Praktikum, penugasan', 8),
    R(15, 15, 'Presentasi Perbaikan', 'Mempresentasikan hasil perbaikan', 'Presentasi', 2),
  ], 'rps') },

  plc: { nama: 'Programmable Logic Control / PLC (PEK3206)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Konsep Otomasi dan Arsitektur PLC', 'Menjelaskan konsep otomasi industri dan arsitektur PLC', 'Ceramah, demonstrasi', 6),
    R(3, 4, 'Ladder Diagram dan Relay', 'Menjelaskan ladder diagram dasar dan memprogram relay', 'Ceramah, demonstrasi, praktikum', 8),
    R(5, 6, 'Timer dan Counter', 'Memprogram timer dan counter pada PLC', 'Praktikum', 8),
    R(7, 7, 'Sequencer', 'Memprogram sequencer', 'Praktikum', 5),
    R(9, 10, 'Kendali Motor dan Konveyor', 'Merancang kendali motor dan konveyor sederhana', 'Praktikum', 8),
    R(11, 12, 'Troubleshooting dan HMI', 'Melakukan troubleshooting PLC dan mengintegrasikan dengan HMI', 'Praktikum', 8),
    R(13, 14, 'Proyek PLC', 'Menyelesaikan proyek PLC', 'Praktikum, PjBL', 8),
    R(15, 15, 'Presentasi dan Laporan PLC', 'Mempresentasikan proyek PLC dan menyusun laporan', 'Presentasi, penugasan', 2),
  ], 'rps') },

  komunikasi_data_jaringan: { nama: 'Komunikasi Data dan Jaringan (PEK3207)', sks: 3, waktu: W_PRAKTIK, sumber: 'rps', pertemuan: bangun([
    R(1, 2, 'Konsep Komunikasi Data dan OSI', 'Menjelaskan konsep komunikasi data dan model OSI', 'Ceramah, diskusi', 6),
    R(3, 4, 'TCP/IP dan Media Transmisi', 'Menjelaskan model TCP/IP dan media transmisi', 'Ceramah, demonstrasi', 8),
    R(5, 6, 'Encoding dan Modulasi', 'Menjelaskan teknik encoding dan modulasi', 'Ceramah, latihan', 8),
    R(7, 7, 'Protokol Komunikasi', 'Menjelaskan protokol komunikasi', 'Ceramah, diskusi', 5),
    R(9, 10, 'Konfigurasi Jaringan', 'Mengkonfigurasi jaringan sederhana dan menggunakan perangkat jaringan', 'Praktikum', 8),
    R(11, 12, 'Simulasi dan LAN', 'Menggunakan Cisco Packet Tracer dan membangun jaringan LAN', 'Praktikum', 8),
    R(13, 14, 'Troubleshooting dan Proyek Jaringan', 'Melakukan troubleshooting jaringan dan menyelesaikan proyek jaringan', 'Praktikum, PjBL', 8),
    R(15, 15, 'Presentasi Proyek', 'Mempresentasikan proyek jaringan', 'Presentasi', 2),
  ], 'rps') },

  // ===== RPS belum terbaca (PDF terpotong) -> DRAFT, wajib dicocokkan =====
  antena_propagasi: { nama: 'Antena dan Propagasi (PEK3209)', sks: 3, waktu: W_PRAKTIK, sumber: 'usulan',
    catatan: 'DRAFT. RPS PEK3209 belum terbaca. Dari RPS hanya diketahui: pokok bahasan diawali "Gelombang ...", membahas prinsip kerja antena, parameter antena, jenis antena, dan propagasi gelombang elektromagnetik.',
    pertemuan: bangunUsulan([
      'Gelombang elektromagnetik dan spektrum frekuensi', 'Prinsip kerja antena', 'Parameter antena: gain, pola radiasi, polarisasi',
      'Antena dipole dan monopole', 'Antena array dan Yagi', 'Antena parabola dan horn', 'Jenis antena lain dan aplikasinya',
      'Propagasi gelombang di berbagai medium', 'Propagasi: gelombang tanah, langit, line-of-sight', 'Redaman lintasan dan link budget',
      'Fading dan multipath', 'Pengukuran antena', 'Latihan komprehensif', 'Presentasi dan laporan']) },

  keamanan_siber: { nama: 'Keamanan Siber (PEK3210)', sks: 3, waktu: W_PRAKTIK, sumber: 'usulan',
    catatan: 'DRAFT. RPS PEK3210 belum terbaca. Seluruh isi adalah usulan, wajib dicocokkan dengan RPS.',
    pertemuan: bangunUsulan([
      'Lanskap ancaman dan prinsip keamanan informasi', 'Jenis ancaman: malware, phishing, DoS', 'Kriptografi dasar',
      'Autentikasi dan manajemen kata sandi', 'Keamanan jaringan: firewall dan IDS/IPS', 'Keamanan jaringan nirkabel', 'Keamanan aplikasi web (risiko umum)',
      'Penilaian kerentanan dasar', 'Hardening sistem operasi', 'Keamanan IoT dan sistem kendali', 'Respons insiden dan forensik dasar',
      'Regulasi dan etika: UU ITE dan perlindungan data pribadi', 'Studi kasus', 'Presentasi']) },
};

// kode MK -> kunci RENCANA
const KODE_MAP = {
  WUD2201: 'agama', WUD2202: 'agama', WUD2203: 'agama', WUD2204: 'agama', WUD2205: 'agama',
  WUD3208: 'bahasa_indonesia', WUD3209: 'bahasa_inggris',
  PD3201: 'etika_kerja', PD3202: 'standardisasi', PD3203: 'matematika_teknik', PD3204: 'perangkat_lunak_aplikasi',
  WUD2206: 'pkn',
  PD3205: 'k3', PD3206: 'aplikasi_komputer', PD3207: 'teknik_pengukuran',
  PD3208: 'peralatan_teknik', PD3209: 'menggambar_teknik', PD3210: 'data_sistem_informasi',
  WUD2207: 'pancasila',
  PEK3201: 'dasar_sistem_tenaga_listrik',
  PEK3202: 'elektronika_digital_instrumentasi', PEK3208: 'elektronika_digital_telekomunikasi',
  PEK3203: 'mikrokontroler', PEK3204: 'rangkaian_elektronika', PEK3205: 'perawatan_perbaikan',
  PEK3206: 'plc', PEK3207: 'komunikasi_data_jaringan', PEK3209: 'antena_propagasi', PEK3210: 'keamanan_siber',
};

const kunci = (kode) => KODE_MAP[String(kode || '').toUpperCase().trim()];

function getRencanaPertemuan(kode) {
  const k = kunci(kode);
  return k ? RENCANA[k].pertemuan : null;
}

function getInfoRencana(kode) {
  const k = kunci(kode);
  if (!k) return null;
  const r = RENCANA[k];
  return { nama: r.nama, sks: r.sks, waktu: r.waktu, sumber: r.sumber, catatan: r.catatan || '' };
}

/**
 * Pekan perkuliahan berjalan (1-16) dari tanggal mulai kuliah (Date / 'YYYY-MM-DD').
 * Return null kalau belum mulai atau sudah lewat 16 pekan.
 */
function hitungPekan(tanggalMulai, hariIni = new Date()) {
  const mulai = new Date(tanggalMulai);
  if (isNaN(mulai)) return null;
  const selisihHari = Math.floor((hariIni - mulai) / 86400000);
  if (selisihHari < 0) return null;
  const pekan = Math.floor(selisihHari / 7) + 1;
  return pekan <= 16 ? pekan : null;
}

module.exports = { RENCANA, KODE_MAP, getRencanaPertemuan, getInfoRencana, hitungPekan };
