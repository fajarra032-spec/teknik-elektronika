// data/sop/detail/sop-te-022.js - SOP Magang Luar Negeri
// Sumber: views/sop/magang.ejs (bagian Syarat Magang Luar Negeri, SK Direktur 407/D/Polidewa/II/2026) dan alur sistem
// magang. Pedoman hanya memuat syarat dan pelaporan; langkah lain mengikuti SOP-TE-021 dan ditandai KONFIRMASI.
module.exports = {
  kode: 'SOP-TE-022',
  judul: 'Magang Luar Negeri',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan persyaratan dan prosedur pelaksanaan magang luar negeri bagi mahasiswa, termasuk pelaporan berkala selama berada di luar negeri.',
    'Memastikan mahasiswa yang magang di luar negeri tetap terbimbing, terdokumentasi, dan dinilai setara dengan magang dalam negeri.'
  ],
  ruangLingkup: [
    'Berlaku untuk mahasiswa yang mengikuti program magang pada IDUKA di luar negeri dengan masa magang satu semester atau lebih.',
    'Tahapan yang sama dengan magang dalam negeri (KRS, periode, logbook, penilaian) mengikuti SOP-TE-021 dan SOP-TE-023 kecuali diatur khusus di sini.'
  ],
  dasarHukum: [
    'Pedoman Magang Politeknik Dewantara (SK Direktur No. 407/D/Polidewa/II/2026, berlaku sejak 12 Februari 2026).',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Magang luar negeri', arti: 'Magang pada IDUKA di luar negeri tanpa kuliah tatap muka paralel.' },
    { istilah: 'Laporan 6 bulanan', arti: 'Laporan kegiatan yang disampaikan setiap enam bulan sesuai kepulangan mahasiswa.' },
    { istilah: 'Dosen PA', arti: 'Dosen pembimbing tunggal magang (pembimbing 1 dan 2 tidak digunakan).' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Memenuhi persyaratan, mengurus kelengkapan keberangkatan, menyampaikan logbook dan laporan berkala.' },
    { peran: 'Dosen PA', tanggungJawab: 'Membimbing dan menilai, menerima logbook dan laporan, memberi umpan balik.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menyetujui KRS magang dan memutuskan kelayakan program luar negeri.' },
    { peran: 'Kepala Bagian Magang', tanggungJawab: 'Verifikasi pendaftaran, pengajuan IDUKA, penetapan lokasi, dan pembekalan.' },
    { peran: 'Pendamping Lapangan', tanggungJawab: 'Mendampingi dan menilai mahasiswa di IDUKA luar negeri.' }
  ],
  persyaratan: [
    'Mahasiswa aktif pada semua program studi.',
    'Lunas SPP semester sebelumnya dan 50% SPP semester berjalan.',
    'Minimal 20 SKS (satu semester).',
    'KRS magang dan form pendaftaran terisi.',
    'Tanpa kuliah tatap muka paralel.',
    'Kesediaan menyampaikan laporan enam bulan sekali.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Memprogram magang pada KRS dan mengisi form pendaftaran, termasuk keterangan IDUKA dan negara tujuan.', pelaksana: 'Mahasiswa', waktu: 'Periode KRS', output: 'KRS magang; form pendaftaran' },
    { no: 2, kegiatan: 'Memeriksa persyaratan (status aktif, SKS, SPP), menilai kelayakan program, lalu menyetujui atau menolak KRS magang.', pelaksana: 'Ketua Program Studi', waktu: '5 hari kerja (u)', output: 'KRS di-ACC atau ditolak' },
    { no: 3, kegiatan: 'Memverifikasi dokumen, mengumumkan peserta, mengajukan IDUKA dan kuota, serta menetapkan lokasi magang.', pelaksana: 'Kepala Bagian Magang', waktu: 'Sebelum keberangkatan (u)', output: 'Penetapan lokasi' },
    { no: 4, kegiatan: 'Memastikan kelengkapan keberangkatan: perjanjian dengan IDUKA, dokumen perjalanan dan izin kerja atau magang, asuransi, dan kontak darurat. [KONFIRMASI: ketentuan rinci]', pelaksana: 'Mahasiswa / Kepala Bagian Magang', waktu: 'Sebelum keberangkatan', output: 'Berkas keberangkatan' },
    { no: 5, kegiatan: 'Melaksanakan pembekalan magang termasuk etika, K3, dan prosedur pelaporan selama di luar negeri.', pelaksana: 'Kepala Bagian Magang', waktu: 'Sebelum keberangkatan', output: 'Daftar hadir pembekalan' },
    { no: 6, kegiatan: 'Mengaktifkan periode magang di sistem (tanggal awal dan akhir) dan mengirim mahasiswa ke IDUKA.', pelaksana: 'Dosen PA / Kepala Bagian Magang', waktu: 'Awal periode', output: 'Periode magang aktif' },
    { no: 7, kegiatan: 'Mengisi logbook secara berkala dan melaporkannya kepada Dosen PA dan Pendamping Lapangan; Dosen PA memberi umpan balik dan memonitor melalui komunikasi daring.', pelaksana: 'Mahasiswa / Dosen PA', waktu: 'Mingguan', output: 'Logbook; umpan balik' },
    { no: 8, kegiatan: 'Menyampaikan laporan enam bulan sekali sesuai kepulangan mahasiswa.', pelaksana: 'Mahasiswa', waktu: 'Setiap 6 bulan', output: 'Laporan enam bulanan' },
    { no: 9, kegiatan: 'Menutup periode, lalu menjalankan laporan akhir dan penilaian sesuai SOP-TE-023.', pelaksana: 'Dosen PA / Mahasiswa / Ketua Program Studi', waktu: 'Setelah periode selesai', output: 'Nilai magang luar negeri' }
  ],
  kasusKhusus: [
    { kasus: 'Mahasiswa tidak dapat melanjutkan magang karena kondisi darurat di negara tujuan', penanganan: 'Dilaporkan segera kepada Dosen PA dan Ketua Program Studi untuk keputusan pemulangan atau penyesuaian. [KONFIRMASI]' },
    { kasus: 'Dipulangkan IDUKA karena kesalahan mahasiswa', penanganan: 'Dinyatakan tidak lulus magang (SOP-TE-024).' },
    { kasus: 'Perbedaan zona waktu mengganggu komunikasi bimbingan', penanganan: 'Dosen PA dan mahasiswa menyepakati jadwal komunikasi tetap.' }
  ],
  formulir: [
    'KRS magang dan form pendaftaran',
    'Berkas keberangkatan dan perjanjian dengan IDUKA',
    'Logbook dan laporan enam bulanan',
    'Form penilaian magang (SOP-TE-023)'
  ],
  lampiran: [],
  konfirmasi: [
    'Pedoman hanya memuat syarat dan pelaporan enam bulanan untuk magang luar negeri. Ketentuan keberangkatan (perjanjian, dokumen perjalanan, asuransi, biaya, pembiayaan SPP) belum diatur dan perlu ditetapkan.',
    'Apakah KRS magang luar negeri juga disetujui Ketua Program Studi dengan syarat tambahan, dan siapa yang mengesahkan IDUKA luar negeri.',
    'Cara memonitor dan memastikan keselamatan mahasiswa di luar negeri serta penanganan keadaan darurat.',
    'Bobot SKS magang luar negeri dan kesetaraannya dengan PDK 1, 2, dan 3.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
