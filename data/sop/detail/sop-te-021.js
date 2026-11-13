// data/sop/detail/sop-te-021.js - SOP Pelaksanaan Magang Dalam Negeri
// Sumber: views/sop/magang.ejs (Pedoman Magang, SK Direktur 407/D/Polidewa/II/2026) + alur di kode sistem
// (routes/dosen/magangPeriod.js, routes/admin/emagang.js, CATATAN-PERUBAHAN-PEMBIMBING.txt).
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-021',
  judul: 'Pelaksanaan Magang Dalam Negeri (Praktik Dunia Kerja)',
  versi: '1.0 (Draf)',
  tanggalDibuat: '13 November 2026',
  tujuan: [
    'Menetapkan langkah baku pelaksanaan magang dalam negeri (PDK 1/2/3) mulai dari pemrograman KRS sampai penutupan periode magang.',
    'Memastikan setiap tahap magang memiliki pelaksana, batas waktu, dan bukti pelaksanaan yang dapat diaudit.'
  ],
  ruangLingkup: [
    'Berlaku untuk mahasiswa D3 Teknik Elektronika yang memprogram mata kuliah PDK 1, PDK 2, atau PDK 3 pada KRS dan melaksanakan magang di IDUKA dalam negeri.',
    'Penilaian dan laporan akhir diatur pada SOP-TE-023. Magang luar negeri diatur pada SOP-TE-022. Penanganan masalah diatur pada SOP-TE-024.'
  ],
  dasarHukum: [
    'Pedoman Magang Politeknik Dewantara (SK Direktur No. 407/D/Polidewa/II/2026, berlaku sejak 12 Februari 2026).',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'IDUKA', arti: 'Industri, dunia usaha, dan dunia kerja tempat mahasiswa magang.' },
    { istilah: 'PDK 1/2/3', arti: 'Mata kuliah Praktik Dunia Kerja tahap 1, 2, dan 3 yang diprogram pada KRS.' },
    { istilah: 'Dosen PA', arti: 'Dosen Pembimbing Akademik mahasiswa; menjadi pembimbing magang tunggal (tidak ada pembimbing 1 dan 2).' },
    { istilah: 'Pendamping Lapangan', arti: 'Pegawai IDUKA yang ditunjuk mendampingi dan menilai mahasiswa selama magang.' },
    { istilah: 'Kepala Bagian Magang', arti: 'Pejabat yang berwenang menetapkan lokasi magang, memberikan pembekalan, dan mengesahkan laporan.' },
    { istilah: 'Periode magang', arti: 'Rentang waktu magang di sistem (4 bulan) yang diaktifkan Dosen PA; logbook terkunci otomatis setelah tanggal akhir.' },
    { istilah: 'Logbook', arti: 'Catatan kegiatan harian/mingguan mahasiswa di sistem; berfungsi sebagai presensi.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Memenuhi persyaratan, memprogram KRS PDK, mengisi logbook, menjaga etika dan nama baik kampus.' },
    { peran: 'Dosen PA (pembimbing)', tanggungJawab: 'Mengaktifkan periode magang, menyetujui/menolak logbook, memberi umpan balik, mencatat bimbingan, memonitor.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menyetujui (ACC) KRS magang, koordinator dan evaluator program magang.' },
    { peran: 'Kepala Bagian Magang', tanggungJawab: 'Verifikasi pendaftaran, pengajuan IDUKA dan kuota, penetapan lokasi, pembekalan.' },
    { peran: 'Pendamping Lapangan (IDUKA)', tanggungJawab: 'Mendampingi di lapangan, menyediakan fasilitas kerja dan K3, memberikan penilaian.' }
  ],
  persyaratan: [
    'Mahasiswa aktif (memiliki KTM).',
    'Lunas SPP semester sebelumnya dan 50% SPP semester berjalan.',
    'Minimal 56 SKS (D3).',
    'Memprogram mata kuliah magang (PDK) pada KRS dan mengisi form pendaftaran.',
    'Tidak mengambil kelas tatap muka selama magang.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Memprogram PDK 1/2/3 pada KRS dan mengisi form pendaftaran magang secara online.', pelaksana: 'Mahasiswa', waktu: 'Periode KRS', output: 'KRS PDK; form pendaftaran' },
    { no: 2, kegiatan: 'Memeriksa persyaratan (status aktif, SKS, SPP) lalu menyetujui atau menolak KRS magang. Menu Magang baru terbuka setelah KRS di-ACC.', pelaksana: 'Ketua Program Studi', waktu: '3 hari kerja (u)', output: 'KRS PDK berstatus ACC' },
    { no: 3, kegiatan: 'Memverifikasi dokumen pendaftaran dan mengumumkan mahasiswa yang lolos.', pelaksana: 'Kepala Bagian Magang', waktu: '5 hari kerja (u)', output: 'Pengumuman peserta' },
    { no: 4, kegiatan: 'Mengajukan IDUKA dan kuota penempatan.', pelaksana: 'Kepala Bagian Magang', waktu: 'Sebelum penempatan', output: 'Daftar IDUKA dan kuota' },
    { no: 5, kegiatan: 'Menetapkan lokasi magang mahasiswa.', pelaksana: 'Kepala Bagian Magang', waktu: 'Sebelum pembekalan', output: 'Penetapan lokasi; surat pengantar magang' },
    { no: 6, kegiatan: 'Melaksanakan pembekalan magang.', pelaksana: 'Kepala Bagian Magang', waktu: 'Sebelum keberangkatan', output: 'Daftar hadir pembekalan' },
    { no: 7, kegiatan: 'Mengaktifkan periode magang di sistem: menetapkan tanggal awal dan akhir (4 bulan) dan perusahaan.', pelaksana: 'Dosen PA', waktu: 'Awal periode magang', output: 'Periode magang aktif' },
    { no: 8, kegiatan: 'Mengirim mahasiswa ke IDUKA; mahasiswa melapor kepada Pendamping Lapangan.', pelaksana: 'Kepala Bagian Magang / Mahasiswa', waktu: 'Awal periode', output: 'Bukti penerimaan IDUKA' },
    { no: 9, kegiatan: 'Mengisi logbook harian/mingguan di sistem dan melaporkannya kepada Dosen PA serta Pendamping Lapangan.', pelaksana: 'Mahasiswa', waktu: 'Harian/mingguan', output: 'Logbook' },
    { no: 10, kegiatan: 'Menyetujui atau menolak logbook, memberi umpan balik, dan mencatat bimbingan pada menu Konsultasi PA kategori Magang.', pelaksana: 'Dosen PA', waktu: '7 hari kerja (u)', output: 'Logbook disetujui; kartu kontrol bimbingan' },
    { no: 11, kegiatan: 'Memonitor mahasiswa melalui WhatsApp atau kunjungan langsung.', pelaksana: 'Dosen PA / Kepala Bagian Magang', waktu: 'Selama periode', output: 'Catatan monitoring' },
    { no: 12, kegiatan: 'Memperpanjang periode magang bila mahasiswa masih magang setelah tanggal akhir.', pelaksana: 'Dosen PA', waktu: 'Sebelum tanggal akhir', output: 'Periode diperpanjang' },
    { no: 13, kegiatan: 'Menutup periode: logbook terkunci otomatis setelah tanggal akhir atau dikunci manual oleh Dosen PA.', pelaksana: 'Sistem / Dosen PA', waktu: 'Akhir periode', output: 'Logbook terkunci' },
    { no: 14, kegiatan: 'Melanjutkan ke proses laporan dan penilaian magang.', pelaksana: 'Mahasiswa / Dosen PA', waktu: 'Setelah periode ditutup', output: 'Lihat SOP-TE-023' }
  ],
  kasusKhusus: [
    { kasus: 'Mahasiswa menolak lokasi magang tanpa alasan sah dan persetujuan prodi', penanganan: 'Magang ditunda ke periode berikutnya; lokasi dialihkan ke mahasiswa lain.' },
    { kasus: 'Mahasiswa dipulangkan IDUKA sebelum selesai karena kesalahan mahasiswa', penanganan: 'Dinyatakan tidak lulus magang.' },
    { kasus: 'Mahasiswa mendapat perlakuan tidak sesuai norma di IDUKA', penanganan: 'Mahasiswa dikembalikan ke kampus untuk ditindaklanjuti.' },
    { kasus: 'Mahasiswa berstatus cuti atau keluar', penanganan: 'Tidak diikutkan dalam proses magang di sistem.' }
  ],
  formulir: [
    'KRS PDK dan form pendaftaran magang',
    'Surat pengantar magang (menu Persuratan)',
    'Logbook magang (cetak dari sistem)',
    'Kartu Kontrol Bimbingan Magang dan Lembar Konsultasi PA'
  ],
  lampiran: [],
  konfirmasi: [
    'Angka waktu bertanda (u) adalah usulan; tetapkan batas waktu resmi.',
    'Pedoman publik menyebut KRS magang di-ACC Ketua Program Studi; pastikan apakah pemeriksaan SKS dan SPP dilakukan manual atau otomatis oleh sistem.',
    'Nomor dokumen SPMI institusi yang menjadi dasar hukum.'
  ],
  referensi: [
    { label: 'Pedoman Magang (infografis)', url: '/sop/magang' }
  ]
};
