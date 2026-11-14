// data/sop/detail/sop-te-043.js - SOP Tracer Study dan Kepuasan Pengguna Lulusan
// Sumber: routes/mahasiswa/tracer.js, routes/admin/tracklulusan.js, helpers/lulusanHelper.js, views/landing/lulusan/*.
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-043',
  judul: 'Tracer Study dan Kepuasan Pengguna Lulusan',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur pengumpulan, peninjauan, penayangan, dan pemanfaatan data keberkerjaan lulusan (tracer study) serta kepuasan pengguna lulusan.',
    'Menyediakan data lulusan yang akurat sebagai bukti akreditasi dan masukan evaluasi kurikulum.'
  ],
  ruangLingkup: [
    'Berlaku untuk lulusan Program Studi D3 Teknik Elektronika yang mengisi survei tracer study melalui akun di sistem, serta data lulusan yang dikelola admin pada menu Track Lulusan.',
    'Survei kepuasan pengguna lulusan (mitra industri) termasuk dalam SOP ini sebagai langkah yang dijalankan di luar sistem sampai instrumennya tersedia.'
  ],
  dasarHukum: [
    'Instrumen akreditasi LAM Teknik Program Diploma III yang berlaku. [KONFIRMASI: butir dan nomor peraturan]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Ketentuan pelindungan data pribadi yang berlaku di institusi. [KONFIRMASI]'
  ],
  definisi: [
    { istilah: 'Tracer study', arti: 'Survei penelusuran lulusan mengenai pekerjaan, tempat kerja, status, bidang, tanggal mulai kerja, dan kisaran gaji.' },
    { istilah: 'Survei tracer (tracerStudy)', arti: 'Isian mandiri lulusan; satu isian per akun. Setelah disimpan, berstatus belum tayang publik sampai ditinjau admin.' },
    { istilah: 'Data lulusan (lulusan)', arti: 'Data yang dikelola admin (nama, NIM, tahun lulus, pekerjaan, tempat kerja, status, kontak, foto); dianggap tayang publik.' },
    { istilah: 'Status tayang publik', arti: 'Penanda bahwa isian survei boleh ditampilkan pada halaman publik Lulusan; dapat dinyalakan atau dimatikan admin.' },
    { istilah: 'Pengguna lulusan', arti: 'Perusahaan atau instansi tempat lulusan bekerja yang menilai kinerja lulusan.' }
  ],
  pihak: [
    { peran: 'Lulusan', tanggungJawab: 'Mengisi survei dengan benar dan memperbarui data bila berubah.' },
    { peran: 'Admin tracer', tanggungJawab: 'Mengelola data lulusan, meninjau survei, mengatur status tayang publik, dan menyiapkan rekap.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menetapkan periode dan sasaran, menyetujui kebijakan data yang ditayangkan, dan menindaklanjuti hasil.' },
    { peran: 'Tim Penjaminan Mutu', tanggungJawab: 'Menelaah laporan tracer sebagai bagian evaluasi mutu dan akreditasi.' }
  ],
  persyaratan: [
    'Lulusan memiliki akun di sistem dan data NIM serta tahun lulus yang benar.',
    'Isian wajib survei: pekerjaan, tempat kerja, status pekerjaan, dan tahun lulus.',
    'Data lulusan yang ditambahkan admin memuat nama, NIM, dan tahun lulus.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Menetapkan periode tracer tahunan, angkatan sasaran, dan jadwal pengumpulan data.', pelaksana: 'Ketua Program Studi / Tim Penjaminan Mutu', waktu: 'Awal tahun akademik (u)', output: 'Jadwal dan sasaran tracer' },
    { no: 2, kegiatan: 'Memperbarui data lulusan pada menu Track Lulusan: menambah lulusan baru, memperbaiki data, dan mengunggah foto.', pelaksana: 'Admin tracer', waktu: 'Setelah yudisium dan wisuda (u)', output: 'Data lulusan terbaru' },
    { no: 3, kegiatan: 'Mengajak lulusan mengisi survei melalui kanal komunikasi prodi dan mengingatkan yang belum mengisi.', pelaksana: 'Admin tracer / Dosen PA', waktu: 'Selama periode; pengingat paling banyak 2 kali (u)', output: 'Pengumuman dan catatan pengingat' },
    { no: 4, kegiatan: 'Mengisi survei pada menu Tracer Study (pekerjaan, tempat kerja, alamat, status, bidang, perusahaan, tanggal mulai, kisaran gaji, tahun lulus); dapat mengunggah foto tempat kerja dan mengedit isian.', pelaksana: 'Lulusan', waktu: 'Selama periode', output: 'Isian survei tersimpan' },
    { no: 5, kegiatan: 'Sistem menyimpan satu isian per akun dengan status belum tayang publik.', pelaksana: 'Sistem', waktu: 'Otomatis', output: 'Isian berstatus belum tayang' },
    { no: 6, kegiatan: 'Meninjau isian pada menu Tinjau Survei (filter publik dan menunggu): memeriksa kewajaran, kelengkapan, dan kelayakan tayang (data sensitif seperti kisaran gaji, alamat kerja, dan foto), lalu menyalakan status tayang publik untuk data yang layak.', pelaksana: 'Admin tracer', waktu: '5 hari kerja setelah isian masuk (u)', output: 'Isian layak tayang diaktifkan' },
    { no: 7, kegiatan: 'Menyusun rekap tahunan: jumlah responden terhadap jumlah lulusan, proporsi bekerja, melanjutkan studi, dan wirausaha, waktu tunggu kerja, serta kesesuaian bidang. [KONFIRMASI: perhitungan belum otomatis di sistem]', pelaksana: 'Admin tracer / Tim Penjaminan Mutu', waktu: 'Setelah periode ditutup (u)', output: 'Rekap tracer tahunan' },
    { no: 8, kegiatan: 'Menjalankan survei kepuasan pengguna lulusan kepada mitra industri dengan instrumen prodi dan merekap hasilnya. [KONFIRMASI: instrumen belum ada di sistem]', pelaksana: 'Ketua Program Studi / Kepala Bagian Magang', waktu: 'Tahunan (u)', output: 'Rekap kepuasan pengguna lulusan' },
    { no: 9, kegiatan: 'Membahas laporan tracer dan kepuasan pengguna pada rapat evaluasi prodi, lalu menyalurkan temuan ke evaluasi kurikulum dan rencana tindak lanjut.', pelaksana: 'Ketua Program Studi / Tim Penjaminan Mutu', waktu: 'Setelah rekap selesai (u)', output: 'Notulen rapat; rencana tindak lanjut' },
    { no: 10, kegiatan: 'Mengarsipkan rekap, notulen, dan ekspor data per tahun sebagai bukti LED dan LKPS.', pelaksana: 'Admin tracer', waktu: 'Akhir tahun akademik', output: 'Arsip tracer tahunan' }
  ],
  kasusKhusus: [
    { kasus: 'Lulusan belum bekerja atau melanjutkan studi', penanganan: 'Mengisi status pekerjaan yang sesuai; data tetap dihitung sebagai responden pada rekap.' },
    { kasus: 'Lulusan tidak merespons setelah pengingat', penanganan: 'Dicatat sebagai tidak merespons dan dilaporkan pada rekap.' },
    { kasus: 'Lulusan meminta data dihapus atau disembunyikan dari halaman publik', penanganan: 'Admin mematikan status tayang publik atau menghapus isian atas permintaan tertulis, dicatat pada arsip.' },
    { kasus: 'Isian tidak wajar atau diduga tidak benar', penanganan: 'Tidak ditayangkan sampai lulusan mengonfirmasi atau memperbaiki.' },
    { kasus: 'Lulusan perlu mengubah isian setelah tayang', penanganan: 'Lulusan mengedit isian; admin meninjau ulang sebelum tetap ditayangkan.' }
  ],
  formulir: [
    'Isian survei tracer study pada sistem',
    'Data lulusan pada menu Track Lulusan',
    'Rekap tracer tahunan',
    'Instrumen dan rekap kepuasan pengguna lulusan',
    'Notulen rapat evaluasi tracer'
  ],
  lampiran: [],
  konfirmasi: [
    'Kisaran gaji tampil pada halaman detail lulusan publik setelah isian ditayangkan, dan data lulusan kurasi admin selalu dianggap tayang. Tetapkan apakah gaji disembunyikan dan apakah diperlukan persetujuan tayang secara eksplisit; formulir saat ini hanya memberi tahu bahwa data ditinjau admin sebelum tampil.',
    'Survei saat ini tidak menanyakan kepuasan pengguna lulusan, dan waktu tunggu serta kesesuaian bidang belum dihitung otomatis, padahal indikator tersebut tercantum pada daftar kebutuhan akreditasi. Tentukan instrumen dan perhitungannya.',
    'Target tingkat respons, jadwal pasti, dan siapa yang menjadi admin tracer.',
    'Kanal pengingat kepada lulusan (belum ada pengingat otomatis yang saya temukan di kode).',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
