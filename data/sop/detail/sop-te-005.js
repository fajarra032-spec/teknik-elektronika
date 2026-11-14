// data/sop/detail/sop-te-005.js - SOP Pelaksanaan UTS dan UAS
// Sumber: data/rencanaPertemuanData.js (P8 = UTS, P16 = UAS), routes/dosen/rubrik.js dan helpers/nilaiHelper.js (komponen
// UTS/UAS, bobot bawaan 30:30), routes/admin/jadwalpenting.js (agenda). CATATAN: sistem belum mengelola penyelenggaraan
// ujian (jadwal ujian, soal, daftar hadir ujian); langkah penyelenggaraan adalah PROSEDUR BARU yang perlu disetujui Kaprodi.
module.exports = {
  kode: 'SOP-TE-005',
  judul: 'Pelaksanaan UTS dan UAS',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur penyelenggaraan Ujian Tengah Semester (UTS) dan Ujian Akhir Semester (UAS) yang tertib, adil, dan terdokumentasi.',
    'Memastikan hasil ujian dinilai tepat waktu dan masuk ke penilaian akhir sesuai SOP-TE-006.'
  ],
  ruangLingkup: [
    'Berlaku untuk UTS (pertemuan ke-8) dan UAS (pertemuan ke-16) pada seluruh mata kuliah Program Studi D3 Teknik Elektronika, termasuk ujian praktik dan ujian berbasis proyek.',
    'Penilaian akhir dan komplain diatur pada SOP-TE-006; pelanggaran akademik pada SOP-TE-031.'
  ],
  dasarHukum: [
    'Kalender akademik dan RPS setiap mata kuliah (UTS pertemuan 8, UAS pertemuan 16).',
    'Peraturan akademik dan tata tertib ujian Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'UTS dan UAS', arti: 'Ujian tengah dan akhir semester; pada rubrik masing-masing menjadi satu komponen nilai (bobot bawaan 30 dan 30 dari 100).' },
    { istilah: 'Jadwal Penting', arti: 'Menu agenda prodi untuk mengumumkan tanggal, waktu, tempat, dan kategori kegiatan.' },
    { istilah: 'Ujian susulan', arti: 'Ujian pengganti bagi mahasiswa yang berhalangan dengan alasan sah dan bukti.' },
    { istilah: 'Berita acara ujian', arti: 'Catatan pelaksanaan ujian: peserta hadir, kejadian, dan pelanggaran bila ada.' }
  ],
  pihak: [
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menetapkan jadwal dan kebijakan ujian, memeriksa kesiapan, dan memutuskan kasus khusus.' },
    { peran: 'Dosen pengampu', tanggungJawab: 'Menyusun dan menilai ujian, mengawasi, dan menginput nilai.' },
    { peran: 'Pengawas ujian', tanggungJawab: 'Menjaga ketertiban dan membuat berita acara.' },
    { peran: 'Mahasiswa', tanggungJawab: 'Memenuhi syarat peserta, hadir tepat waktu, dan mematuhi tata tertib.' },
    { peran: 'Admin akademik', tanggungJawab: 'Mengumumkan jadwal dan menyiapkan daftar peserta dan ruang.' }
  ],
  persyaratan: [
    'Mahasiswa terdaftar pada mata kuliah (KRS disetujui) dan berstatus Aktif.',
    'Syarat kehadiran dan administrasi untuk mengikuti ujian. [KONFIRMASI]',
    'Soal atau instrumen ujian telah disusun dan diperiksa.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Menetapkan pekan UTS dan UAS pada kalender akademik dan mengumumkan jadwal, ruang, dan pengawas melalui Jadwal Penting.', pelaksana: 'Ketua Program Studi / Admin akademik', waktu: '2 minggu sebelum ujian (u)', output: 'Jadwal ujian diumumkan' },
    { no: 2, kegiatan: 'Menyusun kisi-kisi dan soal atau instrumen ujian sesuai RPS dan capaian pembelajaran mata kuliah; ujian praktik disiapkan bersama laboratorium (SOP-TE-015).', pelaksana: 'Dosen pengampu', waktu: '1 minggu sebelum ujian (u)', output: 'Soal, kunci, dan rubrik penilaian ujian' },
    { no: 3, kegiatan: 'Memeriksa kesesuaian soal dengan RPS dan tingkat kesulitan sebelum dipakai. [KONFIRMASI: pemeriksa]', pelaksana: 'Ketua Program Studi / Tim kurikulum', waktu: '3 hari sebelum ujian (u)', output: 'Soal terverifikasi' },
    { no: 4, kegiatan: 'Menyiapkan ruang, daftar hadir ujian, dan daftar peserta yang memenuhi syarat; mahasiswa cuti atau keluar tidak diikutkan.', pelaksana: 'Admin akademik', waktu: '2 hari sebelum ujian (u)', output: 'Daftar peserta dan daftar hadir ujian' },
    { no: 5, kegiatan: 'Melaksanakan ujian: pemeriksaan identitas (KTM), pembacaan tata tertib, pengawasan, dan pengumpulan lembar jawaban.', pelaksana: 'Dosen pengampu / Pengawas ujian', waktu: 'Sesuai jadwal', output: 'Lembar jawaban; daftar hadir terisi' },
    { no: 6, kegiatan: 'Mencatat kejadian dan dugaan pelanggaran pada berita acara ujian; pelanggaran ditindaklanjuti melalui SOP-TE-031.', pelaksana: 'Pengawas ujian', waktu: 'Saat ujian', output: 'Berita acara ujian' },
    { no: 7, kegiatan: 'Melaksanakan ujian susulan bagi mahasiswa berhalangan dengan alasan sah dan bukti, atas persetujuan Ketua Program Studi.', pelaksana: 'Dosen pengampu / Ketua Program Studi', waktu: 'Paling lambat 7 hari setelah ujian (u)', output: 'Hasil ujian susulan' },
    { no: 8, kegiatan: 'Memeriksa lembar jawaban dan menginput nilai UTS atau UAS pada komponen rubrik di menu Nilai.', pelaksana: 'Dosen pengampu', waktu: 'UAS: selesai dalam 7 hari kerja setelah ujian (SOP-TE-006)', output: 'Nilai komponen UTS atau UAS' },
    { no: 9, kegiatan: 'Memberikan umpan balik hasil ujian kepada mahasiswa (pembahasan atau tinjauan lembar jawaban). [KONFIRMASI]', pelaksana: 'Dosen pengampu', waktu: 'Setelah nilai diinput (u)', output: 'Catatan umpan balik' },
    { no: 10, kegiatan: 'Mengarsipkan soal, kunci, daftar hadir, berita acara, dan lembar jawaban (atau rekap) selama masa simpan; mengevaluasi pelaksanaan ujian.', pelaksana: 'Dosen pengampu / Admin akademik', waktu: 'Akhir semester', output: 'Arsip ujian; catatan evaluasi' }
  ],
  kasusKhusus: [
    { kasus: 'Mahasiswa sakit atau berhalangan dengan alasan sah', penanganan: 'Mengajukan dengan bukti; ujian susulan dengan persetujuan Ketua Program Studi.' },
    { kasus: 'Dugaan kecurangan saat ujian', penanganan: 'Dicatat pada berita acara dan ditindaklanjuti melalui SOP-TE-031 dengan memberi kesempatan mahasiswa menjelaskan.' },
    { kasus: 'Ujian praktik membutuhkan alat laboratorium', penanganan: 'Alat dipinjam dan disiapkan mengikuti SOP-TE-016 dan keselamatan mengikuti SOP-TE-019.' },
    { kasus: 'Ujian berbasis proyek atau portofolio', penanganan: 'Ditetapkan pada RPS dengan rubrik penilaian; penyerahan dan penilaian dicatat dosen.' },
    { kasus: 'Gangguan listrik atau jaringan saat ujian', penanganan: 'Ujian ditunda atau diulang atas keputusan dosen dan Ketua Program Studi, dicatat pada berita acara.' }
  ],
  formulir: [
    'Jadwal ujian (Jadwal Penting)',
    'Soal, kunci, dan rubrik ujian',
    'Daftar hadir ujian',
    'Berita acara ujian',
    'Rekap nilai UTS dan UAS pada rubrik'
  ],
  lampiran: [],
  konfirmasi: [
    'PENTING - Sistem hanya mencatat nilai UTS dan UAS pada rubrik dan menyediakan Jadwal Penting; penyelenggaraan ujian (jadwal ujian, penyimpanan soal, daftar hadir ujian, berita acara) belum ada di sistem. Langkah 1 sampai 7, 9, dan 10 adalah prosedur baru yang saya rumuskan; setujui atau sesuaikan.',
    'Syarat kehadiran minimal untuk mengikuti ujian dan sanksi bila tidak terpenuhi.',
    'Aturan ujian susulan dan remedial, termasuk batas waktu dan pembatasan nilai.',
    'Apakah ujian dapat dilaksanakan daring melalui e-learning; sistem saat ini tidak memiliki fitur ujian daring.',
    'Masa simpan lembar jawaban dan pemeriksa kelayakan soal.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
