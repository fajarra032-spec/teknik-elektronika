// data/sop/detail/sop-te-016.js - SOP Peminjaman dan Pengembalian Alat
// Sumber: routes/mahasiswa/peminjamanAlat.js, routes/admin/peminjamanAlat.js, routes/admin/alatLab.js,
// helpers/peminjamanAlatHelper.js. Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi.
module.exports = {
  kode: 'SOP-TE-016',
  judul: 'Peminjaman dan Pengembalian Alat Laboratorium',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur baku peminjaman dan pengembalian alat laboratorium oleh mahasiswa, dari pengajuan sampai verifikasi kondisi alat.',
    'Menjaga ketersediaan alat dan akurasi stok inventaris, serta memastikan setiap peminjaman memiliki riwayat yang dapat ditelusuri.'
  ],
  ruangLingkup: [
    'Berlaku untuk alat laboratorium yang terdaftar aktif pada inventaris sistem (alat ukur, sumber daya, komponen, perkakas, mikrokontroler/trainer kit, perangkat komputer, dan lainnya) yang dipinjam mahasiswa D3 Teknik Elektronika.',
    'Penggunaan laboratorium dan praktikum diatur pada SOP-TE-015; keselamatan kerja pada SOP-TE-019; pemeliharaan dan inventarisasi pada SOP-TE-018.'
  ],
  dasarHukum: [
    'Tata tertib penggunaan laboratorium Program Studi D3 Teknik Elektronika. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Kode peminjaman', arti: 'Nomor unik yang dibuat sistem untuk setiap pengajuan peminjaman.' },
    { istilah: 'Stok tersedia', arti: 'Jumlah unit alat yang dapat dipinjam. Berkurang saat peminjaman disetujui dan bertambah saat unit kembali dalam kondisi baik.' },
    { istilah: 'Status peminjaman', arti: 'Diajukan, Ditolak, Dibatalkan, Dipinjam, Menunggu Verifikasi Pengembalian, atau Dikembalikan.' },
    { istilah: 'Verifikasi pengembalian', arti: 'Pemeriksaan fisik alat oleh admin dengan mengisi jumlah unit baik, rusak, dan hilang untuk setiap jenis alat.' },
    { istilah: 'Unit rusak', arti: 'Unit yang tidak dapat dipinjam sampai ditandai selesai diperbaiki.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Mengajukan peminjaman dengan keperluan yang jelas, menjaga alat, dan mengembalikan tepat waktu dalam kondisi baik.' },
    { peran: 'Admin laboratorium', tanggungJawab: 'Menyetujui atau menolak pengajuan, menyerahkan alat, memverifikasi pengembalian, dan memperbarui kondisi inventaris.' },
    { peran: 'Koordinator laboratorium', tanggungJawab: 'Memantau kondisi dan ketersediaan alat serta melaporkannya kepada Ketua Program Studi. [KONFIRMASI: peran ini belum ada di sistem]' }
  ],
  persyaratan: [
    'Mahasiswa memiliki akun dan biodata wajib sudah lengkap.',
    'Alat yang dipinjam berstatus aktif dan stok tersedia mencukupi jumlah yang diminta.',
    'Keperluan peminjaman terisi.',
    'Tanggal pinjam tidak sebelum hari ini dan tanggal rencana kembali tidak sebelum tanggal pinjam.',
    'Satu pengajuan paling banyak 30 jenis alat.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Membuka menu Peminjaman Alat Lab > Ajukan, memilih alat dan jumlah, mengisi keperluan, kegiatan (opsional), tanggal pinjam, dan tanggal rencana kembali. Sistem membuat kode peminjaman berstatus Diajukan dan memberi notifikasi kepada admin.', pelaksana: 'Mahasiswa', waktu: 'Sebelum tanggal pinjam', output: 'Pengajuan Diajukan; kode peminjaman' },
    { no: 2, kegiatan: 'Membatalkan pengajuan bila tidak jadi meminjam (hanya selama status masih Diajukan).', pelaksana: 'Mahasiswa', waktu: 'Sebelum diproses', output: 'Status Dibatalkan' },
    { no: 3, kegiatan: 'Memeriksa pengajuan (kewajaran keperluan dan jumlah) lalu menyetujui atau menolak. Saat disetujui, sistem memeriksa ulang stok dan mengurangi stok tersedia; penolakan wajib disertai alasan. Mahasiswa menerima notifikasi.', pelaksana: 'Admin laboratorium', waktu: '1 hari kerja (u)', output: 'Status Dipinjam atau Ditolak; catatan admin' },
    { no: 4, kegiatan: 'Mengambil alat di laboratorium; admin menyerahkan alat sesuai daftar yang disetujui.', pelaksana: 'Mahasiswa / Admin laboratorium', waktu: 'Sesuai tanggal pinjam', output: 'Alat diserahkan; catatan serah terima' },
    { no: 5, kegiatan: 'Menggunakan alat sesuai ketentuan praktikum dan K3, serta melaporkan kerusakan segera kepada admin laboratorium.', pelaksana: 'Mahasiswa', waktu: 'Selama masa pinjam', output: 'Alat terpakai sesuai keperluan' },
    { no: 6, kegiatan: 'Mengajukan pengembalian pada menu detail peminjaman (catatan kondisi opsional) dan menyerahkan alat fisik kepada admin laboratorium. Status menjadi Menunggu Verifikasi Pengembalian dan admin menerima notifikasi.', pelaksana: 'Mahasiswa', waktu: 'Paling lambat tanggal rencana kembali', output: 'Pengajuan pengembalian' },
    { no: 7, kegiatan: 'Memeriksa fisik alat dan mengisi jumlah baik, rusak, dan hilang tiap jenis (totalnya harus sama dengan jumlah dipinjam). Sistem menambah stok tersedia untuk unit baik, mencatat unit rusak, mengurangi total untuk unit hilang, menghitung hari terlambat, dan memberi notifikasi kepada mahasiswa.', pelaksana: 'Admin laboratorium', waktu: 'Saat alat diserahkan (u)', output: 'Status Dikembalikan; hasil verifikasi' },
    { no: 8, kegiatan: 'Bila alat belum diterima atau tidak sesuai, menolak pengajuan pengembalian dengan alasan; status kembali Dipinjam.', pelaksana: 'Admin laboratorium', waktu: 'Saat pemeriksaan', output: 'Status Dipinjam; alasan' },
    { no: 9, kegiatan: 'Menandai unit rusak yang telah selesai diperbaiki pada menu Inventaris Alat Lab agar kembali ke stok tersedia.', pelaksana: 'Admin laboratorium', waktu: 'Setelah perbaikan', output: 'Stok tersedia diperbarui' },
    { no: 10, kegiatan: 'Memantau peminjaman yang terlambat (ditandai sistem) dan menindaklanjuti kepada mahasiswa; melaporkan rekap peminjaman, kerusakan, dan kehilangan secara berkala kepada Ketua Program Studi.', pelaksana: 'Admin laboratorium / Koordinator laboratorium', waktu: 'Mingguan dan akhir semester (u)', output: 'Rekap peminjaman dan kondisi alat' }
  ],
  kasusKhusus: [
    { kasus: 'Stok tidak mencukupi atau alat dinonaktifkan saat akan disetujui', penanganan: 'Persetujuan ditolak sistem dengan rincian alat yang kurang; mahasiswa mengajukan ulang sesuai stok.' },
    { kasus: 'Dua admin menyetujui pengajuan yang sama', penanganan: 'Hanya satu yang berhasil; yang lain menerima pesan bahwa pengajuan sudah diproses.' },
    { kasus: 'Alat dikembalikan rusak', penanganan: 'Unit dicatat rusak dan tidak dapat dipinjam sampai diperbaiki; tindak lanjut penggantian atau perbaikan mengikuti kebijakan prodi. [KONFIRMASI]' },
    { kasus: 'Alat hilang', penanganan: 'Total inventaris dikurangi dan kasus ditindaklanjuti kepada mahasiswa sesuai kebijakan prodi. [KONFIRMASI]' },
    { kasus: 'Mahasiswa terlambat mengembalikan', penanganan: 'Sistem menghitung hari terlambat saat verifikasi; admin menindaklanjuti sesuai kebijakan prodi. [KONFIRMASI]' }
  ],
  formulir: [
    'Pengajuan peminjaman (kode peminjaman) pada sistem',
    'Riwayat status dan catatan admin pada detail peminjaman',
    'Hasil verifikasi pengembalian (baik, rusak, hilang)',
    'Rekap peminjaman dan kondisi alat'
  ],
  lampiran: [],
  konfirmasi: [
    'Kebijakan penggantian atau sanksi untuk alat rusak dan hilang serta denda keterlambatan tidak ada di kode; tetapkan aturannya.',
    'Batas lama peminjaman dan batas jumlah alat per mahasiswa tidak dicek sistem; tetapkan bila berlaku.',
    'Apakah peminjaman di luar jam praktikum memerlukan persetujuan dosen atau pembimbing, dan apakah dosen juga dapat meminjam.',
    'Berita acara serah terima fisik bertanda tangan belum ada di sistem; tetapkan apakah diperlukan.',
    'Jam layanan laboratorium dan peran Koordinator laboratorium (apakah akun admin yang sama).',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
