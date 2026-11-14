// data/sop/detail/sop-te-012.js - SOP Penyelesaian Studi (Seminar Hasil Magang), SKL, Transkrip
// Sumber: routes/mahasiswa/penyelesaianStudi.js, routes/admin/seminar.js, helpers/penyelesaianStudiHelper.js,
// views/admin/surat/skl_sementara.ejs. Yudisium dan ijazah belum ada di sistem: lihat bagian konfirmasi.
module.exports = {
  kode: 'SOP-TE-012',
  judul: 'Penyelesaian Studi: Seminar Hasil Magang, SKL Sementara, dan Transkrip',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur pengajuan, persetujuan, dan pelaksanaan seminar hasil magang sebagai tahap penyelesaian studi mahasiswa D3.',
    'Memastikan kelengkapan berkas penyelesaian studi (surat permohonan ujian, berita acara, transkrip, bukti pembayaran) dan penerbitan SKL sementara tercatat dan dapat diaudit.'
  ],
  ruangLingkup: [
    'Berlaku untuk mahasiswa D3 Teknik Elektronika yang telah menyelesaikan magang PDK 1, 2, dan 3 dan mengajukan seminar hasil magang melalui menu Penyelesaian Studi.',
    'Penilaian magang diatur pada SOP-TE-023. Yudisium dan penerbitan ijazah di luar cakupan SOP ini sampai alurnya ditetapkan.'
  ],
  dasarHukum: [
    'Pedoman Magang Politeknik Dewantara (SK Direktur No. 407/D/Polidewa/II/2026).',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Seminar hasil magang', arti: 'Presentasi hasil kegiatan Magang 1, 2, dan 3 (satu pengajuan: Seminar Hasil Magang 1, 2, dan 3).' },
    { istilah: 'Pengajuan seminar', arti: 'Data permohonan jadwal seminar. Status: pending, approved, rejected, atau dibatalkan. Hanya satu pengajuan aktif (pending atau approved) per mahasiswa.' },
    { istilah: 'Jadwal Penting', arti: 'Agenda sistem; jadwal seminar yang disetujui otomatis masuk dan terlihat pada dashboard.' },
    { istilah: 'SKL sementara', arti: 'Surat Keterangan Lulus sementara yang diterbitkan melalui menu Persuratan.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Mengisi formulir pengajuan dengan benar, melengkapi berkas, dan mengikuti seminar sesuai jadwal.' },
    { peran: 'Dosen PA (pembimbing)', tanggungJawab: 'Ditetapkan sebagai pembimbing pada pengajuan; wajib sudah ditetapkan sebelum mahasiswa mengajukan.' },
    { peran: 'Admin / Ketua Program Studi', tanggungJawab: 'Menyetujui atau menolak pengajuan, menetapkan hari, waktu, tempat, dan penguji, menerbitkan SKL sementara.' },
    { peran: 'Bagian Keuangan', tanggungJawab: 'Menerbitkan bukti pembayaran yang disyaratkan.' }
  ],
  persyaratan: [
    'Dosen PA mahasiswa sudah ditetapkan di sistem.',
    'Lokasi Magang 1 terisi pada formulir (lokasi 2 dan 3 sesuai magang yang dijalani).',
    'Status laporan magang tercatat (dicek otomatis dari sistem saat pengajuan).',
    'Tidak sedang memiliki pengajuan seminar lain yang berstatus pending atau approved.',
    'Pernyataan pembayaran lunas pada formulir dan bukti pembayaran dari Bagian Keuangan.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Mengisi formulir pengajuan jadwal seminar pada menu Penyelesaian Studi: lokasi magang 1-3, pendamping lapangan, pernyataan pembayaran lunas, dan catatan.', pelaksana: 'Mahasiswa', waktu: 'Setelah laporan magang disiapkan', output: 'Pengajuan berstatus pending' },
    { no: 2, kegiatan: 'Memeriksa pengajuan (kelengkapan, status laporan, pembimbing) dan menyetujui dengan menetapkan tanggal, waktu, tempat, dan penguji, atau menolak disertai alasan.', pelaksana: 'Admin / Ketua Program Studi', waktu: '3 hari kerja (u)', output: 'Pengajuan approved atau rejected' },
    { no: 3, kegiatan: 'Saat disetujui, sistem memasukkan jadwal ke Jadwal Penting dan mengirim notifikasi ke mahasiswa; saat ditolak, mahasiswa menerima alasan dan dapat memperbaiki lalu mengajukan kembali.', pelaksana: 'Sistem', waktu: 'Otomatis', output: 'Jadwal Penting; notifikasi' },
    { no: 4, kegiatan: 'Membatalkan pengajuan bila perlu (hanya saat status pending).', pelaksana: 'Mahasiswa', waktu: 'Sebelum disetujui', output: 'Status dibatalkan' },
    { no: 5, kegiatan: 'Setelah jadwal disetujui, mengunduh atau mencetak Surat Permohonan Ujian Magang dan Berita Acara Persentasi Hasil Kegiatan Magang; formulir pengajuan dapat dicetak sejak pending.', pelaksana: 'Mahasiswa', waktu: 'Sebelum hari seminar', output: 'Surat permohonan; berita acara (Word/cetak)' },
    { no: 6, kegiatan: 'Melengkapi berkas: Transkrip Nilai dari menu Transkrip dan Bukti Pembayaran dari Bagian Keuangan.', pelaksana: 'Mahasiswa', waktu: 'Sebelum hari seminar', output: 'Transkrip; bukti pembayaran' },
    { no: 7, kegiatan: 'Melaksanakan seminar sesuai jadwal; Dosen PA dan penguji hadir dan menandatangani berita acara.', pelaksana: 'Mahasiswa / Dosen PA / Penguji', waktu: 'Hari seminar', output: 'Berita acara seminar bertanda tangan' },
    { no: 8, kegiatan: 'Mengajukan Surat Keterangan Lulus sementara melalui menu Persuratan setelah seluruh kewajiban akademik terpenuhi. [KONFIRMASI: syarat penerbitan]', pelaksana: 'Mahasiswa / Admin', waktu: '3 hari kerja (u)', output: 'SKL sementara' },
    { no: 9, kegiatan: 'Mengarsipkan berkas seminar (pengajuan, berita acara, bukti pembayaran) pada arsip prodi.', pelaksana: 'Admin', waktu: 'Setelah seminar', output: 'Arsip berkas penyelesaian studi' }
  ],
  kasusKhusus: [
    { kasus: 'Dosen PA belum ditetapkan', penanganan: 'Pengajuan tidak dapat dibuat; mahasiswa menghubungi admin prodi untuk penetapan PA.' },
    { kasus: 'Pengajuan ditolak', penanganan: 'Mahasiswa memperbaiki sesuai alasan penolakan dan mengajukan kembali; jadwal pada Jadwal Penting dihapus.' },
    { kasus: 'Pengajuan sudah disetujui lalu perlu dibatalkan atau dijadwal ulang', penanganan: 'Dikoordinasikan dengan admin; jadwal pada Jadwal Penting disesuaikan. [KONFIRMASI: prosedur resmi]' },
    { kasus: 'Mahasiswa sudah memiliki pengajuan aktif', penanganan: 'Pengajuan baru ditolak sistem sampai pengajuan sebelumnya selesai atau dibatalkan.' }
  ],
  formulir: [
    'Formulir Pengajuan Pembuatan Undangan Seminar Magang',
    'Surat Permohonan Ujian Magang',
    'Berita Acara Persentasi Hasil Kegiatan Magang',
    'Transkrip Nilai dan Bukti Pembayaran',
    'SKL sementara (menu Persuratan)'
  ],
  lampiran: [],
  konfirmasi: [
    'Sistem hanya mencakup seminar hasil magang, SKL sementara, dan transkrip. Alur yudisium, ijazah, dan transkrip akhir belum ada di sistem; tetapkan apakah dimasukkan ke SOP ini.',
    'Syarat penerbitan SKL sementara (mis. seluruh nilai lengkap, bebas pinjaman alat/pustaka) belum terlihat di kode.',
    'Apakah seminar dihadiri penguji selain Dosen PA dan siapa penguji menurut aturan prodi.',
    'Prosedur resmi penjadwalan ulang seminar setelah disetujui.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
