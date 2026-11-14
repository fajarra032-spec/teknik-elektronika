// data/sop/detail/sop-te-029.js - SOP Persuratan Mahasiswa
// Sumber: routes/mahasiswa/surat.js (pengajuan), routes/admin/surat.js (generate, unggah, tolak, kirim ke mahasiswa).
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-029',
  judul: 'Persuratan Mahasiswa',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur baku pengajuan, penerbitan, penolakan, dan pengarsipan surat untuk mahasiswa melalui menu Persuratan.',
    'Memastikan setiap surat yang terbit memiliki riwayat proses, kode validasi, dan arsip yang dapat ditelusuri.'
  ],
  ruangLingkup: [
    'Berlaku untuk surat yang diajukan mahasiswa: Aktif Kuliah, Permohonan Kebijakan SPP, Keterangan Lulus Sementara (SKL sementara), Keterangan Berkelakuan Baik, Rekomendasi, Keterangan Cuti/Aktif Kembali, Keterangan Dosen PA, Pengantar Magang/PKL, dan Bukti Lulus Masuk Perguruan Tinggi.',
    'Juga berlaku untuk surat yang dibuat atau dikirim langsung oleh prodi kepada mahasiswa (mis. undangan magang dan surat lainnya yang diunggah admin).',
    'Surat untuk dosen (izin, surat tugas) diatur pada SOP-TE-034.'
  ],
  dasarHukum: [
    'Kebijakan tata persuratan dan kearsipan Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Pengajuan surat', arti: 'Permohonan mahasiswa melalui form Persuratan. Status: pending (menunggu), completed (surat terbit), atau rejected (ditolak dengan alasan).' },
    { istilah: 'Generate otomatis', arti: 'Pembuatan surat PDF dari template sistem (kop dan tanda tangan Ketua Program Studi) memakai data mahasiswa.' },
    { istilah: 'Unggah manual', arti: 'Admin mengunggah surat PDF yang dibuat di luar sistem (maksimal 5 MB, hanya PDF).' },
    { istilah: 'Kode validasi', arti: 'Kode unik pada surat yang terbit untuk memeriksa keaslian surat.' },
    { istilah: 'Arsip surat', arti: 'Folder Drive Surat/<tahun akademik>/<NIM> tempat PDF surat tersimpan.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Mengajukan surat dengan data benar dan lengkap, mengunduh surat yang terbit, memperbaiki pengajuan yang ditolak.' },
    { peran: 'Admin akademik', tanggungJawab: 'Memeriksa pengajuan, menerbitkan atau menolak surat, mengunggah surat manual, menjaga arsip.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Penandatangan surat; memutuskan pengajuan yang memerlukan kebijakan (mis. cuti, kebijakan SPP, rekomendasi).' }
  ],
  persyaratan: [
    'Mahasiswa memiliki akun dan biodata wajib sudah lengkap.',
    'Surat Aktif Kuliah: keperluan, tempat lahir, dan tanggal lahir terisi.',
    'Surat Keterangan Cuti/Aktif Kembali: jenis pengajuan, semester, tahun akademik, tanggal mulai, dan alasan terisi (tanggal selesai opsional).',
    'Surat Keterangan Dosen PA: Dosen PA mahasiswa sudah terdaftar di sistem dan keperluan terisi.',
    'Surat Pengantar Magang/PKL: nama dan alamat perusahaan serta tanggal mulai dan selesai terisi.',
    'Permohonan Kebijakan SPP: minimal satu rincian pembayaran (jenis, jumlah, waktu) terisi.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Memilih jenis surat pada menu Persuratan, mengisi form, dan mengirim. Sistem mencatat pengajuan berstatus pending beserta riwayatnya.', pelaksana: 'Mahasiswa', waktu: 'Kapan saja', output: 'Pengajuan pending' },
    { no: 2, kegiatan: 'Memeriksa pengajuan pada daftar surat: kebenaran data mahasiswa, kelengkapan, dan kewajaran keperluan. Pengajuan yang butuh kebijakan (cuti, kebijakan SPP, rekomendasi) dikonsultasikan kepada Ketua Program Studi.', pelaksana: 'Admin akademik / Ketua Program Studi', waktu: '2 hari kerja (u)', output: 'Keputusan terbit atau tolak' },
    { no: 3, kegiatan: 'Menerbitkan surat dengan generate otomatis dari template (Surat Aktif Kuliah wajib diberi nomor surat), atau mengunggah PDF manual untuk jenis yang tidak didukung generate.', pelaksana: 'Admin akademik', waktu: '3 hari kerja (u)', output: 'Surat PDF' },
    { no: 4, kegiatan: 'Sistem menyimpan PDF ke arsip Drive per tahun akademik dan NIM, mengubah status menjadi completed, dan mencatat riwayat.', pelaksana: 'Sistem', waktu: 'Otomatis', output: 'Arsip surat; status completed' },
    { no: 5, kegiatan: 'Mengunduh atau mencetak surat dari daftar surat.', pelaksana: 'Mahasiswa', waktu: 'Setelah terbit', output: 'Surat bertanda tangan' },
    { no: 6, kegiatan: 'Menolak pengajuan bila data tidak benar atau tidak memenuhi syarat dengan mengisi alasan penolakan (wajib); mahasiswa memperbaiki dan mengajukan ulang.', pelaksana: 'Admin akademik / Mahasiswa', waktu: '2 hari kerja (u)', output: 'Status rejected; alasan' },
    { no: 7, kegiatan: 'Untuk surat inisiatif prodi (undangan magang, surat lain): membuat surat atau mengunggah PDF melalui menu kirim ke mahasiswa dengan mengisi mahasiswa, jenis, keperluan, dan file.', pelaksana: 'Admin akademik', waktu: 'Sesuai kebutuhan', output: 'Surat terkirim; arsip' },
    { no: 8, kegiatan: 'Memeriksa arsip surat per semester dan melengkapi nomor surat pada register persuratan prodi. [KONFIRMASI: register nomor]', pelaksana: 'Admin akademik', waktu: 'Akhir semester', output: 'Register surat' }
  ],
  kasusKhusus: [
    { kasus: 'Biodata wajib mahasiswa belum lengkap', penanganan: 'Mahasiswa diarahkan melengkapi biodata sebelum dapat memakai menu mahasiswa.' },
    { kasus: 'Dosen PA belum terdaftar', penanganan: 'Surat Keterangan Dosen PA tidak dapat diajukan; mahasiswa menghubungi admin untuk penetapan PA.' },
    { kasus: 'File unggahan bukan PDF atau lebih dari 5 MB', penanganan: 'Ditolak sistem; admin mengunggah ulang dengan PDF yang sesuai.' },
    { kasus: 'Surat Aktif Kuliah tanpa nomor surat', penanganan: 'Ditolak sistem; admin mengisi nomor surat lalu mengulang.' },
    { kasus: 'Jenis surat yang belum didukung generate otomatis', penanganan: 'Diterbitkan lewat unggah manual.' },
    { kasus: 'Surat salah terbit atau perlu direvisi', penanganan: 'Dihapus dan diterbitkan ulang oleh admin; perubahan dicatat sesuai SOP Koreksi dan Perubahan Data Akademik (SOP-TE-046).' }
  ],
  formulir: [
    'Form pengajuan surat per jenis (di menu Persuratan)',
    'Surat PDF bertanda tangan dengan kode validasi',
    'Riwayat proses surat pada sistem',
    'Register nomor surat prodi'
  ],
  lampiran: [],
  konfirmasi: [
    'Format dan register penomoran surat: sistem hanya meminta nomor surat untuk Surat Aktif Kuliah (input manual). Tetapkan format nomor dan siapa pencatatnya.',
    'Penandatangan pada template surat dan gambar tanda tangan (/images/ttd.png): pastikan sesuai pejabat saat ini, terutama setelah pergantian Ketua Program Studi.',
    'Syarat substansi tiap jenis surat belum diatur sistem (mis. cuti mengikuti SOP-TE-010; kebijakan SPP perlu verifikasi keuangan; rekomendasi dan berkelakuan baik).',
    'Masa berlaku Surat Aktif Kuliah dan SKL sementara.',
    'Apakah mahasiswa dapat membatalkan pengajuan pending (tidak terlihat di kode yang saya baca).',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
