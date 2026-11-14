// data/sop/detail/sop-te-046.js - SOP Koreksi dan Perubahan Data Akademik
// Sumber: folder scripts/ (60 skrip: diagnostik cek-*, perubahan, backup-collections.js), alur nilai terkunci pada
// routes/admin/emagang.js. Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi.
module.exports = {
  kode: 'SOP-TE-046',
  judul: 'Koreksi dan Perubahan Data Akademik',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur koreksi dan perubahan data akademik yang dilakukan di luar menu biasa (langsung ke basis data, umumnya melalui skrip) agar terotorisasi, tercatat, dan dapat dipulihkan.',
    'Menjaga keabsahan data nilai, KRS, dan data induk yang menjadi dasar KHS, transkrip, dan laporan akreditasi.'
  ],
  ruangLingkup: [
    'Berlaku untuk perubahan data pada nilai (grades), KRS dan enrollment, data mahasiswa dan akun, data dosen dan pengampu, mata kuliah, jadwal, serta logbook magang, baik lewat skrip pada folder scripts/ maupun perintah langsung ke basis data.',
    'Berlaku juga untuk revisi nilai yang sudah terkunci ke KHS atau transkrip (mis. nilai magang).',
    'Operasi rutin melalui menu admin (mis. persetujuan KRS) tidak termasuk dan diatur pada SOP masing-masing.'
  ],
  dasarHukum: [
    'Kebijakan keamanan dan pengelolaan data Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Koreksi data', arti: 'Perubahan atau penghapusan data yang sudah tersimpan karena kesalahan, duplikasi, atau data yang belum lengkap.' },
    { istilah: 'Skrip diagnostik', arti: 'Skrip yang hanya membaca data (umumnya berawalan cek-) untuk memeriksa kondisi tanpa mengubah apa pun.' },
    { istilah: 'Skrip perubahan', arti: 'Skrip yang menulis atau menghapus data (mis. input nilai, penggabungan data ganda, penetapan Dosen PA, pembersihan data).' },
    { istilah: 'Mode simulasi', arti: 'Menjalankan skrip tanpa menyimpan perubahan untuk melihat jumlah dan isi data yang akan terdampak.' },
    { istilah: 'Backup', arti: 'Salinan data koleksi dalam berkas JSON yang dibuat dengan scripts/backup-collections.js ke folder backup-<tanggal-waktu> sebelum perubahan.' },
    { istilah: 'Berita acara koreksi', arti: 'Dokumen persetujuan yang memuat data lama, data baru, alasan, bukti, dan penandatangan.' }
  ],
  pihak: [
    { peran: 'Pemohon', tanggungJawab: 'Mengajukan permintaan koreksi tertulis beserta bukti sumber data yang benar.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Memeriksa dan menyetujui koreksi, serta menyetujui pemulihan bila hasil tidak sesuai.' },
    { peran: 'Admin sistem', tanggungJawab: 'Menjalankan skrip diagnostik, backup, simulasi, perubahan, dan verifikasi; mencatat log pelaksanaan.' },
    { peran: 'Tim Penjaminan Mutu', tanggungJawab: 'Meninjau register koreksi data secara berkala dan menindaklanjuti penyebab yang berulang.' }
  ],
  persyaratan: [
    'Permintaan koreksi tertulis memuat jenis data, subjek (NIM, dosen, atau mata kuliah), data lama dan baru, alasan, dan bukti.',
    'Bukti sumber tersedia (mis. rekap nilai dosen, berita acara, SK, atau daftar resmi).',
    'Persetujuan Ketua Program Studi sebelum perubahan dijalankan.',
    'Backup koleksi terkait berhasil dibuat sebelum perubahan.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Mengajukan permintaan koreksi tertulis beserta bukti kepada Ketua Program Studi dan admin sistem.', pelaksana: 'Pemohon', waktu: 'Sesuai temuan', output: 'Formulir permintaan koreksi; bukti' },
    { no: 2, kegiatan: 'Menjalankan skrip diagnostik (read-only) untuk memastikan kondisi data saat ini dan menyimpan hasilnya sebagai bukti kondisi awal.', pelaksana: 'Admin sistem', waktu: '1 hari kerja (u)', output: 'Hasil diagnostik awal' },
    { no: 3, kegiatan: 'Memeriksa kesesuaian permintaan, bukti, dan hasil diagnostik, lalu menyetujui atau menolak serta menandatangani berita acara koreksi.', pelaksana: 'Ketua Program Studi', waktu: '2 hari kerja (u)', output: 'Berita acara koreksi bertanda tangan' },
    { no: 4, kegiatan: 'Membuat backup koleksi yang akan terdampak dengan node scripts/backup-collections.js dan mencatat nama folder backup.', pelaksana: 'Admin sistem', waktu: 'Sebelum perubahan', output: 'Folder backup; catatan lokasi' },
    { no: 5, kegiatan: 'Menjalankan skrip perubahan dalam mode simulasi bila tersedia dan memeriksa jumlah serta isi data yang terdampak.', pelaksana: 'Admin sistem', waktu: 'Sebelum perubahan', output: 'Hasil simulasi' },
    { no: 6, kegiatan: 'Menjalankan perubahan sebenarnya dan mencatat tanggal, nama skrip, parameter, pelaksana, dan jumlah data yang berubah.', pelaksana: 'Admin sistem', waktu: 'Setelah persetujuan', output: 'Log pelaksanaan' },
    { no: 7, kegiatan: 'Memverifikasi hasil dengan skrip diagnostik (mis. membandingkan transkrip dengan data nilai) dan tampilan sistem (KHS, transkrip); pemohon mengonfirmasi.', pelaksana: 'Admin sistem / Pemohon', waktu: '1 hari kerja (u)', output: 'Hasil verifikasi; konfirmasi pemohon' },
    { no: 8, kegiatan: 'Mengarsipkan berita acara, bukti, log, dan hasil verifikasi, serta mencatat koreksi pada register koreksi data.', pelaksana: 'Admin sistem', waktu: 'Setelah verifikasi', output: 'Register koreksi data; arsip' },
    { no: 9, kegiatan: 'Memulihkan data dari backup atas persetujuan Ketua Program Studi bila hasil perubahan tidak sesuai.', pelaksana: 'Admin sistem / Ketua Program Studi', waktu: 'Segera (u)', output: 'Data pulih; catatan pemulihan' },
    { no: 10, kegiatan: 'Meninjau register koreksi tiap semester (jumlah, jenis, dan penyebab) dan menetapkan perbaikan sistem atau prosedur agar koreksi serupa tidak berulang.', pelaksana: 'Tim Penjaminan Mutu / Ketua Program Studi', waktu: 'Akhir semester', output: 'Laporan evaluasi koreksi data' }
  ],
  kasusKhusus: [
    { kasus: 'Revisi nilai yang sudah terkunci ke KHS atau transkrip', penanganan: 'Wajib bukti sumber dan persetujuan Ketua Program Studi; dilakukan hanya melalui prosedur ini dan dicatat pada register.' },
    { kasus: 'Penggabungan data ganda (mis. dosen duplikat)', penanganan: 'Gunakan skrip yang memperbarui seluruh referensi sebelum data ganda dihapus (mis. gabungkan-dosen-aman), bukan skrip yang hanya memindahkan sebagian referensi.' },
    { kasus: 'Penghapusan data (dosen tanpa pengampu, logbook ganda, mata kuliah cacat)', penanganan: 'Backup wajib dan simulasi dijalankan lebih dulu; daftar data yang dihapus disimpan pada arsip.' },
    { kasus: 'Input nilai massal angkatan lama (legacy) atau alih kredit', penanganan: 'Bersumber dari arsip nilai resmi; diperiksa dua orang sebelum dijalankan dan diverifikasi sesudahnya.' },
    { kasus: 'Reset kata sandi massal', penanganan: 'Hanya atas persetujuan Ketua Program Studi dan disertai pemberitahuan kepada pengguna.' },
    { kasus: 'Kesalahan data mendesak yang mengganggu layanan', penanganan: 'Dapat dikoreksi segera atas persetujuan lisan Ketua Program Studi; dokumen dilengkapi paling lambat 2 hari kerja (u).' }
  ],
  formulir: [
    'Formulir Permintaan Koreksi Data',
    'Berita Acara Koreksi Data',
    'Folder backup dan log pelaksanaan skrip',
    'Register Koreksi Data'
  ],
  lampiran: [],
  konfirmasi: [
    'Register koreksi data belum ada di sistem; tetapkan bentuknya (lembar kerja atau modul web) dan penanggung jawabnya.',
    'Di folder scripts/ terdapat 60 skrip, 12 di antaranya diagnostik (cek-). Menurut pencarian kata kunci saya, sekitar 21 skrip penulis belum memiliki mode simulasi; periksa satu per satu dan tambahkan mode simulasi sebelum dipakai ulang.',
    'Saya belum memeriksa apakah setiap skrip mencatat pelaku dan waktu perubahan pada data; pastikan agar ada jejak audit.',
    'Lokasi, masa simpan, dan keamanan folder backup tidak ditetapkan; daftar koleksi pada backup-collections.js perlu mencakup nilai, KRS, enrollment, pengguna, dosen, mata kuliah, dan magang.',
    'Siapa yang menjadi admin sistem dan siapa pemeriksa kedua untuk input nilai massal.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
