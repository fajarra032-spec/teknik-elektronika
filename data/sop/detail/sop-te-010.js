// data/sop/detail/sop-te-010.js - SOP Cuti Akademik dan Aktif Kembali
// Sumber: views/dokumen/pengajuan_cuti.ejs (alur pengajuan cuti, diproses administratif di bagian akademik),
// routes/mahasiswa/surat.js (Surat Keterangan Cuti/Aktif Kembali), helpers/statusMahasiswaHelper.js, routes/admin/mahasiswa.js.
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-010',
  judul: 'Cuti Akademik dan Aktif Kembali',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur pengajuan, persetujuan, pencatatan, dan pengaktifan kembali status mahasiswa yang mengambil cuti akademik.',
    'Menjamin status akademik mahasiswa di sistem sesuai keputusan resmi sehingga KRS, magang, dan layanan lain tidak keliru diproses.'
  ],
  ruangLingkup: [
    'Berlaku untuk mahasiswa D3 Teknik Elektronika yang mengajukan cuti akademik dan aktif kembali setelah cuti.',
    'Pengajuan cuti saat ini diproses administratif di bagian akademik (belum tersedia pengajuan online); Surat Keterangan Cuti/Aktif Kembali diajukan melalui menu Persuratan (SOP-TE-029).'
  ],
  dasarHukum: [
    'Peraturan akademik Politeknik Dewantara tentang cuti akademik. [KONFIRMASI: nomor dokumen dan batas cuti]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Cuti akademik', arti: 'Penghentian sementara kegiatan akademik mahasiswa pada semester tertentu dengan persetujuan prodi.' },
    { istilah: 'Status Cuti', arti: 'Nilai pada data mahasiswa di sistem. Mahasiswa berstatus Cuti atau Keluar dikecualikan dari kegiatan sistem (mis. magang) tetapi tetap tercatat.' },
    { istilah: 'Aktif kembali', arti: 'Pengembalian status mahasiswa menjadi Aktif setelah masa cuti berakhir.' },
    { istilah: 'Bagian akademik/BAAK', arti: 'Unit yang memproses administrasi dan menerbitkan keputusan cuti.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Mengajukan permohonan dengan alasan dan lama cuti, melengkapi persetujuan, dan mengajukan aktif kembali tepat waktu.' },
    { peran: 'Dosen PA (dosen wali)', tanggungJawab: 'Berkonsultasi dengan mahasiswa dan menandatangani formulir cuti.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menyetujui atau menolak permohonan cuti dan aktif kembali.' },
    { peran: 'Bagian akademik / Admin', tanggungJawab: 'Memproses berkas, menerbitkan surat keputusan cuti, dan memperbarui status pada sistem.' }
  ],
  persyaratan: [
    'Mahasiswa berstatus Aktif dan telah berkonsultasi dengan Dosen PA.',
    'Formulir permohonan cuti memuat alasan dan lama cuti.',
    'Persyaratan administrasi dan keuangan sesuai peraturan akademik. [KONFIRMASI]'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Berkonsultasi dengan Dosen PA mengenai alasan dan rencana cuti; konsultasi dicatat pada Lembar Konsultasi.', pelaksana: 'Mahasiswa / Dosen PA', waktu: 'Sebelum periode KRS', output: 'Catatan konsultasi' },
    { no: 2, kegiatan: 'Mengambil dan mengisi formulir permohonan cuti akademik pada bagian akademik, dilengkapi alasan dan lama cuti.', pelaksana: 'Mahasiswa', waktu: 'Sebelum batas pengajuan cuti pada kalender akademik (u)', output: 'Formulir permohonan cuti' },
    { no: 3, kegiatan: 'Menandatangani formulir sebagai dosen wali, lalu Ketua Program Studi menyetujui atau menolak.', pelaksana: 'Dosen PA / Ketua Program Studi', waktu: '3 hari kerja (u)', output: 'Formulir bertanda tangan' },
    { no: 4, kegiatan: 'Menyerahkan formulir yang disetujui kepada bagian akademik untuk diproses dan diterbitkan surat keputusan cuti.', pelaksana: 'Mahasiswa / Bagian akademik', waktu: '5 hari kerja (u)', output: 'Surat keputusan cuti' },
    { no: 5, kegiatan: 'Mengubah status mahasiswa menjadi Cuti pada sistem untuk semester yang diajukan, sebelum KRS semester itu diproses.', pelaksana: 'Admin', waktu: 'Setelah keputusan terbit', output: 'Status Cuti pada sistem' },
    { no: 6, kegiatan: 'Mengajukan Surat Keterangan Cuti Akademik pada menu Persuratan (semester, tahun akademik, tanggal mulai, alasan) bila diperlukan.', pelaksana: 'Mahasiswa / Admin', waktu: 'Sesuai kebutuhan', output: 'Surat keterangan cuti (SOP-TE-029)' },
    { no: 7, kegiatan: 'Selama cuti: mahasiswa tidak mengikuti perkuliahan dan magang; Dosen PA tetap memantau dan mengingatkan rencana aktif kembali.', pelaksana: 'Mahasiswa / Dosen PA', waktu: 'Selama masa cuti', output: 'Catatan pemantauan cuti' },
    { no: 8, kegiatan: 'Mengajukan aktif kembali sebelum periode KRS semester berikutnya (formulir atau Surat Keterangan Aktif Kembali) dan mendapat persetujuan Ketua Program Studi.', pelaksana: 'Mahasiswa / Ketua Program Studi', waktu: 'Sebelum periode KRS (u)', output: 'Persetujuan aktif kembali' },
    { no: 9, kegiatan: 'Mengubah status menjadi Aktif dan mengaktifkan KRS semester terkait sesuai SOP-TE-002.', pelaksana: 'Admin', waktu: 'Sebelum perkuliahan dimulai', output: 'Status Aktif; KRS aktif' },
    { no: 10, kegiatan: 'Mencatat keputusan pada arsip cuti dan melaporkan perubahan status mahasiswa kepada pelaporan akademik institusi. [KONFIRMASI: pelaporan PDDikti]', pelaksana: 'Admin / Bagian akademik', waktu: 'Setiap semester', output: 'Arsip cuti; laporan status' }
  ],
  kasusKhusus: [
    { kasus: 'Cuti saat magang sedang berlangsung', penanganan: 'Mahasiswa tidak diikutkan dalam proses magang pada sistem; kelanjutan magang ditetapkan Ketua Program Studi bersama Kepala Bagian Magang.' },
    { kasus: 'Mahasiswa tidak registrasi dan tidak mengajukan cuti', penanganan: 'Statusnya ditinjau Ketua Program Studi sesuai peraturan akademik. [KONFIRMASI]' },
    { kasus: 'Cuti melebihi batas yang diizinkan', penanganan: 'Ditentukan melalui peraturan akademik; mahasiswa diberi pertimbangan oleh Ketua Program Studi. [KONFIRMASI]' },
    { kasus: 'Mahasiswa mengundurkan diri', penanganan: 'Status diubah menjadi Keluar melalui prosedur pengunduran diri dan dicatat pada arsip. [KONFIRMASI]' }
  ],
  formulir: [
    'Formulir permohonan cuti akademik',
    'Surat keputusan cuti',
    'Surat Keterangan Cuti/Aktif Kembali (menu Persuratan)',
    'Arsip cuti dan aktif kembali'
  ],
  lampiran: [],
  konfirmasi: [
    'Halaman alur cuti menyatakan status mahasiswa otomatis aktif kembali pada semester berikutnya, tetapi saya tidak menemukan proses otomatis itu di kode; saat ini pengaktifan kembali tampaknya manual oleh admin. Tetapkan mana yang berlaku.',
    'Peraturan cuti: batas lama cuti, jumlah semester maksimal, syarat keuangan (SPP selama cuti), dan batas pengajuan.',
    'Siapa yang menerbitkan surat keputusan cuti dan siapa yang mengubah status di sistem.',
    'Perlakuan KRS pada semester cuti (tidak dibuat atau dibatalkan).',
    'Pelaporan status cuti ke PDDikti dan siapa yang menanganinya.',
    'Pengajuan cuti belum tersedia online; pertimbangkan pengajuan melalui sistem.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: [
    { label: 'Alur Pengajuan Cuti Akademik (halaman web)', url: '/dokumen/pengajuan-cuti' }
  ]
};
