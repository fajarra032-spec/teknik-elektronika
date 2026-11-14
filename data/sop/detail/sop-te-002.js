// data/sop/detail/sop-te-002.js - SOP Pengisian, Persetujuan, dan Perubahan KRS
// Sumber: routes/mahasiswa/akademik.js (KRS mahasiswa), routes/admin/krs.js (persetujuan, buat/ubah, periksa),
// helpers/paketKurikulumHelper.js (paket KRS otomatis), routes/admin/mahasiswa.js (pemicu paket otomatis).
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-002',
  judul: 'Pengisian, Persetujuan, dan Perubahan KRS',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur baku penyusunan, persetujuan, dan perubahan Kartu Rencana Studi (KRS) mahasiswa setiap semester.',
    'Memastikan data KRS dan enrollment mata kuliah di sistem akurat sehingga jadwal, e-learning, KHS, dan transkrip mahasiswa sesuai.'
  ],
  ruangLingkup: [
    'Berlaku untuk seluruh mahasiswa aktif D3 Teknik Elektronika pada setiap semester Ganjil dan Genap, baik KRS paket otomatis maupun KRS yang diajukan mahasiswa.',
    'Persyaratan khusus KRS magang (PDK) diatur pada SOP-TE-021.'
  ],
  dasarHukum: [
    'Kurikulum Program Studi D3 Teknik Elektronika yang berlaku dan paket mata kuliah per semester.',
    'Kalender akademik Politeknik Dewantara.',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'KRS', arti: 'Kartu Rencana Studi: daftar mata kuliah yang diprogram mahasiswa pada satu semester. Status KRS: pending, approved, atau rejected.' },
    { istilah: 'Enrollment', arti: 'Data keikutsertaan mahasiswa pada mata kuliah di sistem. Dibuat aktif saat KRS disetujui; dasar tampilnya tugas, nilai, KHS, dan transkrip.' },
    { istilah: 'Paket KRS', arti: 'Kumpulan mata kuliah satu semester kurikulum yang diaktifkan otomatis. Mulai semester 3 paket menurut konsentrasi (Instrumentasi/Telekomunikasi); semester 1 menyesuaikan mata kuliah agama.' },
    { istilah: 'Kelas paralel', arti: 'Mata kuliah yang dipecah per kelas (mis. ELK1B). Mahasiswa hanya melihat mata kuliah gabungan dan mata kuliah kelasnya sendiri.' },
    { istilah: 'Admin', arti: 'Pengguna dengan peran admin (Ketua Program Studi/admin akademik) yang berwenang menyetujui dan mengubah KRS.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Memastikan biodata, NIM, dan kelas benar; memilih mata kuliah; mengunggah dan mencetak KRS.' },
    { peran: 'Admin / Ketua Program Studi', tanggungJawab: 'Menetapkan semester dan status aktif mahasiswa, menyetujui atau menolak KRS, membuat dan mengubah KRS, memeriksa konsistensi KRS.' },
    { peran: 'Dosen PA', tanggungJawab: 'Memberi arahan pemilihan mata kuliah melalui konsultasi PA. [KONFIRMASI: belum ada tahap persetujuan PA di sistem]' }
  ],
  persyaratan: [
    'Mahasiswa berstatus Aktif; mahasiswa cuti atau keluar tidak diproses.',
    'NIM valid (angkatan dapat ditentukan) dan kelas mahasiswa terisi.',
    'Untuk semester 3 ke atas, konsentrasi mahasiswa sudah terisi agar paket KRS dapat ditentukan.',
    'Untuk KRS magang (PDK), terpenuhi syarat pada SOP-TE-021.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Menetapkan progres semester dan status Aktif pada profil mahasiswa (mengisi konsentrasi mulai semester 3). Sistem otomatis membuat KRS berstatus approved dan enrollment aktif sesuai paket semester tersebut.', pelaksana: 'Admin / Ketua Program Studi', waktu: 'Awal semester (u)', output: 'KRS paket otomatis; enrollment aktif' },
    { no: 2, kegiatan: 'Untuk KRS di luar paket: membuka menu Akademik > KRS, memilih mata kuliah (mata kuliah semester berjalan ditandai rekomendasi), lalu menyimpan. Bila sudah ada KRS pending pada semester yang sama, mata kuliah digabung.', pelaksana: 'Mahasiswa', waktu: 'Periode KRS sesuai kalender akademik', output: 'KRS berstatus pending' },
    { no: 3, kegiatan: 'Mengunggah berkas KRS (PDF) pada halaman detail KRS; berkas tersimpan di Drive per angkatan dan per mahasiswa.', pelaksana: 'Mahasiswa', waktu: 'Setelah KRS dibuat', output: 'Berkas KRS di Drive' },
    { no: 4, kegiatan: 'Memeriksa KRS pending (kewajaran mata kuliah dan kelas, kelengkapan berkas) lalu menyetujui atau menolak.', pelaksana: 'Admin / Ketua Program Studi', waktu: '3 hari kerja (u)', output: 'KRS approved atau rejected' },
    { no: 5, kegiatan: 'Saat disetujui, sistem membuat enrollment aktif untuk setiap mata kuliah (tanpa duplikat) dan otomatis menolak KRS pending lain pada semester yang sama.', pelaksana: 'Sistem', waktu: 'Otomatis', output: 'Enrollment aktif' },
    { no: 6, kegiatan: 'Mengubah KRS bila ada perubahan: admin membuka form Buat KRS mahasiswa, menambah atau menghapus centang mata kuliah; mata kuliah yang dihapus dibatalkan dan hilang dari KHS/transkrip.', pelaksana: 'Admin / Ketua Program Studi', waktu: 'Sesuai batas perubahan KRS (u)', output: 'KRS dan enrollment tersinkron' },
    { no: 7, kegiatan: 'Memeriksa konsistensi KRS per angkatan melalui menu Periksa KRS (enrollment tidak sesuai periode atau kelas, penyebab tugas bocor antar angkatan) dan memperbaiki temuan.', pelaksana: 'Admin', waktu: 'Setelah masa KRS ditutup', output: 'Hasil pemeriksaan; perbaikan data' },
    { no: 8, kegiatan: 'Mencetak KRS yang disetujui dan menyimpannya sebagai arsip semester.', pelaksana: 'Mahasiswa / Admin', waktu: 'Setelah KRS disetujui', output: 'KRS cetak (arsip)' }
  ],
  kasusKhusus: [
    { kasus: 'KRS ditolak setelah sebelumnya disetujui', penanganan: 'Enrollment dari KRS tersebut dinonaktifkan sehingga mata kuliah hilang dari KHS dan transkrip.' },
    { kasus: 'NIM tidak valid atau kelas mahasiswa kosong', penanganan: 'Mahasiswa tidak dapat membuat KRS; hubungi admin untuk memperbaiki data induk.' },
    { kasus: 'Konsentrasi belum diisi untuk semester 3 ke atas', penanganan: 'Paket KRS tidak dapat ditentukan; admin mengisi konsentrasi lalu mengaktifkan paket.' },
    { kasus: 'Mata kuliah sudah aktif untuk mahasiswa pada semester yang sama', penanganan: 'Sistem melewati pembuatan enrollment ganda.' },
    { kasus: 'Koreksi KRS semester lalu atau perubahan data akademik lain', penanganan: 'Mengikuti SOP Koreksi dan Perubahan Data Akademik (SOP-TE-046).' }
  ],
  formulir: [
    'KRS (halaman cetak dari sistem)',
    'Berkas KRS unggahan mahasiswa (PDF)',
    'Hasil Periksa KRS per angkatan'
  ],
  lampiran: [],
  konfirmasi: [
    'Peran Dosen PA: persetujuan KRS saat ini hanya oleh admin. Tetapkan apakah PA perlu menyetujui atau hanya mengarahkan.',
    'Batas maksimum SKS per semester dan syarat IPS/IPK: pada kode pengajuan KRS yang saya baca tidak ada pemeriksaan ini. Tentukan aturannya bila berlaku.',
    'Batas tanggal pengisian dan perubahan KRS: tidak dicek sistem; ambil dari kalender akademik.',
    'Penolakan KRS belum menyimpan alasan penolakan; pertimbangkan mewajibkannya.',
    'Apakah akun admin yang menyetujui KRS adalah Ketua Program Studi atau admin akademik.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
