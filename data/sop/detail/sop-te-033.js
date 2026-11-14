// data/sop/detail/sop-te-033.js - SOP Penugasan Mengajar dan Penerbitan SK
// Sumber: routes/admin/sk.js (SK dosen, SK Mengajar), routes/admin/bimbingan.js (rilis SK PA),
// helpers/skPaHelper.js, helpers/skDistribusiHelper.js, routes/dosen/sk.js.
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-033',
  judul: 'Penugasan Mengajar dan Penerbitan SK',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur penugasan dosen pengampu mata kuliah per periode dan penerbitan SK Mengajar, SK Pembimbing Akademik, serta SK dosen lainnya.',
    'Memastikan setiap penugasan memiliki dasar tertulis, nomor SK, dan bukti distribusi kepada dosen.'
  ],
  ruangLingkup: [
    'Berlaku untuk dosen D3 Teknik Elektronika pada setiap semester: SK Mengajar, SK Penetapan Dosen Pembimbing Akademik (SK PA), dan SK lain yang diunggah admin (kategori SK dosen).',
    'Pembimbingan magang mengikuti penetapan Dosen PA (SOP-TE-021).'
  ],
  dasarHukum: [
    'Kalender akademik dan kurikulum Program Studi D3 Teknik Elektronika yang berlaku.',
    'Kebijakan SDM dan beban kerja dosen Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Pengampu periode', arti: 'Dosen pengampu mata kuliah pada satu periode (semester); riwayat per periode disimpan terpisah sehingga SK periode lama tidak berubah.' },
    { istilah: 'Tim teaching', arti: 'Mata kuliah yang diampu lebih dari satu dosen; SKS dibagi rata sesuai jumlah pengampu (SKS efektif).' },
    { istilah: 'SK Mengajar', arti: 'Surat keputusan penugasan mengajar dosen pada satu periode, dibuat per dosen dari data pengampu.' },
    { istilah: 'SK PA', arti: 'Surat keputusan penetapan dosen pembimbing akademik, berisi lampiran daftar mahasiswa dan Dosen PA-nya.' },
    { istilah: 'Rilis dan Kirim', arti: 'Fitur pembuatan PDF SK, penyimpanan di Drive, pencatatan pada daftar SK dosen, dan pengiriman notifikasi ke dosen.' }
  ],
  pihak: [
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menetapkan pengampu mata kuliah, memeriksa isi SK, dan menjadi penandatangan SK.' },
    { peran: 'Admin akademik', tanggungJawab: 'Menyiapkan, mencetak, merilis, dan mengirim SK; mengunggah SK lain; menjaga arsip.' },
    { peran: 'Dosen', tanggungJawab: 'Memeriksa SK yang diterima, mengunduh, dan melaporkan bila ada kekeliruan.' }
  ],
  persyaratan: [
    'Pengampu setiap mata kuliah pada periode terkait sudah ditetapkan di sistem.',
    'Data dosen terhubung dengan akun pengguna agar notifikasi SK dapat diterima.',
    'Untuk SK PA: Dosen PA setiap mahasiswa sudah ditetapkan.',
    'Nomor SK sudah tersedia dari penomoran institusi.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Menetapkan dosen pengampu setiap mata kuliah (dan kelas paralel) untuk periode yang akan berjalan pada menu Mata Kuliah.', pelaksana: 'Ketua Program Studi / Admin', waktu: 'Sebelum perkuliahan dimulai (u)', output: 'Pengampu per periode' },
    { no: 2, kegiatan: 'Membuka Kelola SK > SK Mengajar, memilih periode, dan memeriksa daftar dosen beserta mata kuliah, kelas, dan SKS efektif (tim teaching dibagi rata).', pelaksana: 'Admin / Ketua Program Studi', waktu: '2 hari kerja (u)', output: 'Daftar beban mengajar terverifikasi' },
    { no: 3, kegiatan: 'Mencentang dosen yang akan diterbitkan SK, mengisi nomor SK (mode berurutan atau sama), tanggal, kota, dan tanggal rapat, lalu mencetak pratinjau.', pelaksana: 'Admin', waktu: '2 hari kerja (u)', output: 'Pratinjau SK' },
    { no: 4, kegiatan: 'Memeriksa isi SK dan menyetujui penerbitannya atas nama Ketua Program Studi.', pelaksana: 'Ketua Program Studi', waktu: '2 hari kerja (u)', output: 'Persetujuan penerbitan' },
    { no: 5, kegiatan: 'Menjalankan Rilis dan Kirim: sistem membuat PDF per dosen, menyimpannya di Drive, mencatat pada daftar SK dosen (menggantikan SK mengajar periode yang sama), dan mengirim notifikasi. Dosen yang tidak mengampu pada periode tersebut dilewati.', pelaksana: 'Admin / Sistem', waktu: 'Otomatis', output: 'SK Mengajar terkirim' },
    { no: 6, kegiatan: 'Menetapkan Dosen PA mahasiswa pada Kelola Mahasiswa, lalu merilis SK PA dari menu Bimbingan > SK dengan nomor SK; SK bernomor sama yang pernah dikirim diganti.', pelaksana: 'Admin / Ketua Program Studi', waktu: 'Awal semester (u)', output: 'SK PA terkirim' },
    { no: 7, kegiatan: 'Mengunggah SK dosen lain (kategori, judul, dan PDF) pada Kelola SK Dosen.', pelaksana: 'Admin', waktu: 'Sesuai kebutuhan', output: 'SK pada daftar SK dosen' },
    { no: 8, kegiatan: 'Memeriksa dan mengunduh SK pada menu SK dosen; melaporkan kekeliruan kepada admin.', pelaksana: 'Dosen', waktu: '3 hari kerja setelah diterima (u)', output: 'SK diterima dosen' },
    { no: 9, kegiatan: 'Memperbaiki SK yang keliru dengan menerbitkan ulang pada periode dan nomor yang sama, atau menghapus SK yang salah unggah.', pelaksana: 'Admin', waktu: 'Sesuai temuan', output: 'SK perbaikan' }
  ],
  kasusKhusus: [
    { kasus: 'Dosen tidak mengampu mata kuliah pada periode terpilih', penanganan: 'SK Mengajar tidak dibuat untuk dosen tersebut dan namanya dicatat sebagai dilewati.' },
    { kasus: 'Mata kuliah diampu lebih dari satu dosen', penanganan: 'SKS efektif dibagi rata sesuai jumlah pengampu pada SK masing-masing dosen.' },
    { kasus: 'SK dikirim ulang pada periode atau nomor yang sama', penanganan: 'File dan entri lama diganti; file lama yang tidak dipakai dihapus dari Drive.' },
    { kasus: 'Dosen belum terhubung ke akun pengguna', penanganan: 'Notifikasi tidak terkirim; admin menghubungkan data dosen dengan akun lalu memberi tahu dosen.' },
    { kasus: 'Penggantian Ketua Program Studi', penanganan: 'Identitas penandatangan SK Mengajar dan gambar tanda tangan diperbarui sebelum SK berikutnya diterbitkan.' }
  ],
  formulir: [
    'SK Mengajar per dosen (PDF)',
    'SK Penetapan Dosen Pembimbing Akademik beserta lampiran',
    'Daftar SK dosen pada sistem',
    'Notulen rapat penetapan pengampu'
  ],
  lampiran: [],
  konfirmasi: [
    'Penandatangan SK Mengajar tersimpan di kode (routes/admin/sk.js) atas nama Fajar Ramadhan, S.Pd., M.T. Perbarui bila Ketua Program Studi saat ini berbeda, dan periksa juga gambar tanda tangan.',
    'Sistem tidak mencatat rapat penetapan pengampu; tetapkan apakah notulen rapat menjadi bukti wajib sebelum SK terbit.',
    'Nomor SK diisi manual tanpa register; tetapkan sumber dan format penomoran.',
    'Batas minimum dan maksimum beban SKS dosen tidak dicek sistem; tetapkan bila berlaku.',
    'SK lain yang diwajibkan prodi (koordinator laboratorium, tim kurikulum, tim penjaminan mutu, pembimbing magang) dan kategorinya pada unggah SK.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
