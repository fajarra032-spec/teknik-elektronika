// data/sop/detail/sop-te-006.js - SOP Pelaporan Nilai dan Revisi Nilai
// Sumber: views/dokumen/sop_pelaporan_nilai.ejs (SOP yang sudah ada), routes/dosen/nilai.js, routes/admin/rubrik.js,
// routes/admin/nilai.js, helpers/nilaiHelper.js (rubrik, bobot default, kunci nilai, skala huruf), routes/admin/khs.js.
// Angka waktu mengikuti halaman SOP yang ada (7/3/1/7 hari); angka bertanda (u) = USULAN.
module.exports = {
  kode: 'SOP-TE-006',
  judul: 'Pelaporan Nilai dan Revisi Nilai',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur penilaian, verifikasi, pengunciannya ke KHS dan transkrip, serta pelaporan nilai akhir mahasiswa secara tepat waktu dan dapat dipertanggungjawabkan.',
    'Menetapkan prosedur penanganan komplain dan revisi nilai setelah nilai dipublikasikan.'
  ],
  ruangLingkup: [
    'Berlaku untuk seluruh mata kuliah teori dan praktik/praktikum Program Studi D3 Teknik Elektronika, mulai dari penyusunan rekap nilai oleh dosen sampai publikasi nilai akhir kepada mahasiswa.',
    'Penilaian Praktik Dunia Kerja (magang) mengikuti SOP-TE-023; koreksi data nilai di luar menu biasa mengikuti SOP-TE-046.',
    'SOP ini menyempurnakan halaman SOP Pelaporan Nilai Mahasiswa yang sudah ada di web prodi.'
  ],
  dasarHukum: [
    'Kontrak kuliah dan RPS setiap mata kuliah.',
    'Kalender akademik Politeknik Dewantara.',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Rubrik penilaian', arti: 'Perhitungan nilai akhir mata kuliah dari komponen kehadiran, tugas, kuis, UTS, UAS, dan LKM (praktikum) dengan bobot per mata kuliah dan periode. Nilai akhir kosong bila ada komponen yang belum lengkap.' },
    { istilah: 'Kunci nilai', arti: 'Penetapan nilai akhir ke koleksi nilai resmi (grades) yang menjadi sumber KHS, transkrip, dan IPK. Satu mahasiswa hanya memiliki satu nilai akhir per mata kuliah per semester; penguncian ulang menimpa nilai sebelumnya.' },
    { istilah: 'Publikasi nilai', arti: 'Tampilnya nilai akhir pada KHS dan transkrip mahasiswa setelah dikunci; mahasiswa menerima notifikasi.' },
    { istilah: 'Komplain nilai', arti: 'Keberatan mahasiswa atas nilai akhir yang dipublikasikan.' },
    { istilah: 'Revisi nilai', arti: 'Perubahan nilai akhir yang sudah dikunci karena kesalahan penilaian atau hasil penanganan komplain.' }
  ],
  pihak: [
    { peran: 'Dosen pengampu', tanggungJawab: 'Melaksanakan dan mendokumentasikan penilaian, menginput komponen nilai, menyusun rekap nilai dan laporan pembelajaran, menjawab komplain.' },
    { peran: 'Ketua Program Studi / Admin', tanggungJawab: 'Memverifikasi kewajaran nilai, mengunci nilai akhir, menyetujui revisi nilai, dan menjaga arsip.' },
    { peran: 'Mahasiswa', tanggungJawab: 'Memeriksa nilai pada KHS dan mengajukan komplain dalam batas waktu bila ada keberatan.' }
  ],
  persyaratan: [
    'Mahasiswa memiliki KRS yang disetujui dan enrollment aktif pada mata kuliah (SOP-TE-002).',
    'Bobot komponen rubrik ditetapkan sesuai RPS sebelum penilaian dimulai.',
    'Seluruh komponen nilai mahasiswa telah terinput agar nilai akhir dapat dihitung.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Melaksanakan dan mendokumentasikan penilaian (tugas, praktik, UTS, UAS) sesuai Kontrak Kuliah dan RPS.', pelaksana: 'Dosen pengampu', waktu: 'Selama semester', output: 'Dokumentasi penilaian' },
    { no: 2, kegiatan: 'Menetapkan bobot komponen rubrik bila berbeda dari bawaan (kehadiran 10, tugas 20, kuis 10, UTS 30, UAS 30, LKM 0) dan sub-bobot kehadiran (kehadiran 50, sikap 25, keaktifan 25).', pelaksana: 'Dosen pengampu', waktu: 'Awal semester (u)', output: 'Bobot rubrik mata kuliah' },
    { no: 3, kegiatan: 'Menginput komponen nilai pada menu Nilai (kehadiran, sikap, keaktifan, kuis, UTS, UAS); nilai tugas dan LKM terhitung dari e-learning.', pelaksana: 'Dosen pengampu', waktu: 'Selama semester', output: 'Komponen nilai pada rubrik' },
    { no: 4, kegiatan: 'Menyusun Rekapitulasi Nilai (dapat diekspor) dan Laporan Pembelajaran akhir semester.', pelaksana: 'Dosen pengampu', waktu: 'Setelah UAS', output: 'Rekap nilai; laporan pembelajaran' },
    { no: 5, kegiatan: 'Menyelesaikan input seluruh nilai akhir paling lambat 7 hari kerja setelah UAS.', pelaksana: 'Dosen pengampu', waktu: '7 hari kerja setelah UAS', output: 'Rubrik lengkap' },
    { no: 6, kegiatan: 'Memverifikasi rekap rubrik tiap mata kuliah pada menu Rekap Rubrik: kelengkapan komponen dan kewajaran nilai.', pelaksana: 'Ketua Program Studi / Admin', waktu: '3 hari kerja', output: 'Hasil verifikasi' },
    { no: 7, kegiatan: 'Mengunci nilai akhir per mahasiswa atau seluruh kelas; mahasiswa yang rubriknya belum lengkap dilewati dan dikembalikan kepada dosen untuk dilengkapi.', pelaksana: 'Ketua Program Studi / Admin', waktu: 'Setelah verifikasi', output: 'Nilai terkunci pada KHS dan transkrip' },
    { no: 8, kegiatan: 'Mempublikasikan nilai melalui KHS dan transkrip; sistem mengirim notifikasi nilai akhir kepada mahasiswa.', pelaksana: 'Sistem / Admin', waktu: '1 hari kerja', output: 'Nilai terlihat oleh mahasiswa' },
    { no: 9, kegiatan: 'Mengajukan komplain nilai kepada dosen pengampu disertai alasan dan bukti; dosen memeriksa dan menjawab tertulis.', pelaksana: 'Mahasiswa / Dosen pengampu', waktu: 'Maksimal 7 hari sejak publikasi; jawaban 5 hari kerja (u)', output: 'Berkas komplain dan jawaban' },
    { no: 10, kegiatan: 'Bila komplain diterima atau ditemukan kesalahan: dosen memperbaiki komponen nilai, Ketua Program Studi menyetujui dan mengunci ulang nilai akhir; koreksi di luar rubrik diproses melalui SOP-TE-046. Berita acara revisi dibuat.', pelaksana: 'Dosen pengampu / Ketua Program Studi', waktu: '3 hari kerja (u)', output: 'Nilai revisi; berita acara revisi' },
    { no: 11, kegiatan: 'Mengarsipkan dokumen penilaian (rekap nilai, soal dan jawaban UTS/UAS, laporan pembelajaran, berkas komplain dan revisi) per semester.', pelaksana: 'Dosen pengampu / Admin', waktu: 'Akhir semester', output: 'Arsip penilaian semester' }
  ],
  kasusKhusus: [
    { kasus: 'Komponen nilai belum lengkap', penanganan: 'Nilai akhir tidak terhitung dan mahasiswa dilewati saat penguncian; dosen melengkapi komponen lalu nilai dikunci ulang.' },
    { kasus: 'Dosen terlambat menginput nilai melewati batas 7 hari kerja', penanganan: 'Ketua Program Studi menindaklanjuti kepada dosen dan menetapkan batas baru. [KONFIRMASI: sanksi atau tindak lanjut]' },
    { kasus: 'Nilai magang', penanganan: 'Dinilai dan dikunci melalui alur magang (SOP-TE-023).' },
    { kasus: 'Angkatan dengan kode mata kuliah lama', penanganan: 'Nilai diambil dari koleksi nilai resmi tanpa duplikasi dengan paket kurikulum baru.' },
    { kasus: 'Nilai yang sudah dipublikasikan keliru', penanganan: 'Direvisi melalui langkah 10 atau SOP-TE-046 dengan persetujuan Ketua Program Studi.' }
  ],
  formulir: [
    'Rekap rubrik dan rekapitulasi nilai (cetak dan ekspor)',
    'Laporan Pembelajaran akhir semester',
    'KHS dan transkrip mahasiswa',
    'Formulir komplain nilai dan jawaban dosen',
    'Berita acara revisi nilai'
  ],
  lampiran: [
    { judul: 'Lampiran 1. Skala konversi nilai angka ke huruf',
      head: ['Huruf', 'Indeks', 'Rentang nilai'],
      rows: [['A','4,0','86 - 100'],['B+','3,5','76 - 85,9'],['B','3,0','60 - 75,9'],['C+','2,5','50 - 59,9'],['C','2,0','25 - 49,9'],['D','1,0','10 - 24,9'],['E','0,0','0 - 9,9']] },
    { judul: 'Lampiran 2. Bobot bawaan rubrik (dapat diubah dosen per mata kuliah)',
      head: ['Komponen', 'Bobot'],
      rows: [['Kehadiran','10'],['Tugas','20'],['Kuis','10'],['UTS','30'],['UAS','30'],['LKM praktikum','0']] }
  ],
  konfirmasi: [
    'Tidak ada modul komplain di sistem (kata komplain hanya ada pada halaman SOP lama). Tetapkan saluran komplain (formulir, surel, atau WhatsApp) dan siapa yang mencatatnya.',
    'Penguncian dan penghapusan nilai hanya mencatat waktu perubahan (updatedAt) tanpa pelaku dan alasan; pertimbangkan riwayat perubahan nilai sebagai bukti audit.',
    'Dokumen SOP lengkap berformat Word (10 langkah) yang ditautkan pada halaman SOP lama tidak ikut pada berkas yang saya terima; samakan isinya dengan SOP ini.',
    'Aturan nilai E, mengulang, perbaikan, ujian susulan, dan semester pendek.',
    'Batasan perubahan bobot rubrik oleh dosen dan siapa yang menyetujuinya.',
    'Apakah batas 7 hari adalah hari kerja atau kalender pada tahap komplain.',
    'Angka waktu bertanda (u) adalah usulan; angka 7, 3, 1, dan 7 hari mengikuti halaman SOP lama.'
  ],
  referensi: [
    { label: 'Halaman SOP Pelaporan Nilai (versi lama)', url: '/dokumen/sop-pelaporan-nilai' }
  ]
};
