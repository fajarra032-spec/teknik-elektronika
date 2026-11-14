// data/sop/detail/sop-te-015.js - SOP Penggunaan Laboratorium, Pelaksanaan Praktikum, dan Modul Praktikum/LKM
// Sumber: data/modulPraktikumData.js (90 modul LKM), helpers/modulPraktikumHelper.js, helpers/lkmRubrikHelper.js,
// routes/dosen/mk.js (modul dan kumpulan LKM), routes/mahasiswa/elearning.js (kumpul LKM).
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-015',
  judul: 'Penggunaan Laboratorium, Pelaksanaan Praktikum, dan Modul Praktikum/LKM',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur baku penyiapan modul praktikum (LKM), penggunaan laboratorium, pelaksanaan praktikum, dan penilaian hasil praktikum.',
    'Memastikan praktikum berjalan aman, sesuai modul, dan menghasilkan bukti pelaksanaan dan nilai LKM yang dapat ditelusuri.'
  ],
  ruangLingkup: [
    'Berlaku untuk mata kuliah praktik pada Program Studi D3 Teknik Elektronika yang memakai modul praktikum di sistem: Elektronika Digital, Mikrokontroler, PLC, Perangkat Lunak Aplikasi, Aplikasi Komputer, Data dan Sistem Informasi, Rangkaian Elektronika, Teknik Pengukuran, dan Menggambar Teknik.',
    'Peminjaman alat diatur pada SOP-TE-016, keselamatan kerja pada SOP-TE-019, dan presensi serta jurnal perkuliahan pada SOP-TE-003.'
  ],
  dasarHukum: [
    'RPS mata kuliah praktik dan kurikulum Program Studi D3 Teknik Elektronika yang berlaku.',
    'Tata tertib penggunaan laboratorium. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Modul praktikum (LKM)', arti: 'Lembar Kerja Mahasiswa berisi judul, tujuan, alat dan bahan, dasar teori, langkah kerja, tugas laporan, estimasi waktu, dan catatan K3. Sistem menyediakan 90 modul template.' },
    { istilah: 'Publikasi modul', arti: 'Pengaktifan modul praktikum suatu mata kuliah agar tampil bagi mahasiswa pada e-learning; dapat diatur per modul.' },
    { istilah: 'Kumpulan LKM', arti: 'Daftar berkas LKM yang dikumpulkan mahasiswa dan diperiksa dosen (status dikumpulkan, diperiksa).' },
    { istilah: 'Nilai LKM', arti: 'Rata-rata nilai semua LKM yang sudah diperiksa dan bernilai pada modul yang dipublikasikan; menjadi komponen LKM pada rubrik penilaian.' },
    { istilah: 'Koordinator laboratorium', arti: 'Penanggung jawab kondisi, jadwal, dan ketertiban laboratorium.' }
  ],
  pihak: [
    { peran: 'Dosen pengampu praktikum', tanggungJawab: 'Menyesuaikan dan mempublikasikan modul, mengawasi praktikum, memeriksa dan menilai LKM.' },
    { peran: 'Koordinator laboratorium / teknisi', tanggungJawab: 'Menyiapkan laboratorium, alat, dan bahan, serta menjaga ketertiban dan keselamatan.' },
    { peran: 'Mahasiswa', tanggungJawab: 'Mempersiapkan diri, mengikuti aturan K3 dan tata tertib, melaksanakan modul, dan mengumpulkan LKM tepat waktu.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menetapkan kebijakan penggunaan laboratorium dan memantau pelaksanaan praktikum.' }
  ],
  persyaratan: [
    'Mata kuliah praktik terdaftar pada sistem dengan dosen pengampu pada periode berjalan.',
    'Modul praktikum tersedia (template atau modul tambahan dosen) dan telah dipublikasikan.',
    'Mahasiswa terdaftar pada mata kuliah (KRS disetujui) dan telah mengikuti pengarahan K3.',
    'Alat dan bahan sesuai daftar alat dan bahan pada modul tersedia.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Memeriksa modul template mata kuliah pada menu Modul Praktikum, menyesuaikannya dengan RPS dan ketersediaan alat: mengaktifkan atau menonaktifkan modul, menambahkan catatan dan tanggal pelaksanaan, mengunggah job sheet sendiri, atau menambah modul baru.', pelaksana: 'Dosen pengampu', waktu: 'Sebelum semester berjalan (u)', output: 'Modul praktikum siap' },
    { no: 2, kegiatan: 'Mempublikasikan modul praktikum mata kuliah kepada mahasiswa.', pelaksana: 'Dosen pengampu', waktu: 'Sebelum praktikum pertama (u)', output: 'Modul tampil di e-learning' },
    { no: 3, kegiatan: 'Menyusun jadwal penggunaan laboratorium dan menyiapkan alat serta bahan sesuai daftar pada modul; alat yang dipinjam diproses melalui SOP-TE-016.', pelaksana: 'Koordinator laboratorium / Dosen pengampu', waktu: '3 hari kerja sebelum praktikum (u)', output: 'Jadwal lab; alat dan bahan siap' },
    { no: 4, kegiatan: 'Mempelajari modul dan mencetak LKM (tersedia fitur cetak) sebelum praktikum.', pelaksana: 'Mahasiswa', waktu: 'Sebelum praktikum', output: 'LKM tercetak; mahasiswa siap' },
    { no: 5, kegiatan: 'Membuka praktikum: mencatat kehadiran, menyampaikan pengarahan K3 sesuai catatan K3 pada modul dan SOP-TE-019, serta membagi kelompok.', pelaksana: 'Dosen pengampu / Teknisi', waktu: 'Awal praktikum', output: 'Presensi; catatan pengarahan K3' },
    { no: 6, kegiatan: 'Melaksanakan langkah kerja pada modul dengan pengawasan; kerusakan atau kejadian tidak biasa segera dilaporkan.', pelaksana: 'Mahasiswa / Dosen pengampu', waktu: 'Sesuai estimasi waktu modul', output: 'Hasil percobaan; catatan kejadian' },
    { no: 7, kegiatan: 'Mengumpulkan LKM (unggah berkas) pada menu e-learning mata kuliah dan memperbaikinya bila dosen meminta revisi.', pelaksana: 'Mahasiswa', waktu: 'Sesuai tenggat dosen (u)', output: 'Berkas LKM dikumpulkan' },
    { no: 8, kegiatan: 'Memeriksa setiap LKM pada halaman Kumpulan LKM, mengisi nilai praktikum dan catatan, sehingga status menjadi diperiksa.', pelaksana: 'Dosen pengampu', waktu: '7 hari kerja setelah dikumpulkan (u)', output: 'Nilai dan catatan LKM' },
    { no: 9, kegiatan: 'Sistem menghitung nilai LKM sebagai rata-rata LKM yang sudah diperiksa dan bernilai, lalu memasukkannya ke komponen LKM pada rubrik; LKM yang belum dikumpulkan atau belum diperiksa tidak dihitung sebagai nol.', pelaksana: 'Sistem', waktu: 'Otomatis', output: 'Komponen LKM pada rubrik' },
    { no: 10, kegiatan: 'Menutup praktikum: alat dikembalikan dan diperiksa (SOP-TE-016), laboratorium dirapikan dan dikunci, kegiatan didokumentasikan, serta kendala praktikum dilaporkan pada evaluasi akhir semester.', pelaksana: 'Dosen pengampu / Koordinator laboratorium', waktu: 'Akhir praktikum (u)', output: 'Dokumentasi; laporan kendala praktikum' }
  ],
  kasusKhusus: [
    { kasus: 'Mata kuliah praktik tidak memiliki modul template', penanganan: 'Dosen menambahkan modul sendiri pada menu Modul Praktikum (judul, deskripsi, berkas job sheet).' },
    { kasus: 'Alat tidak mencukupi untuk seluruh kelompok', penanganan: 'Praktikum dilaksanakan bergiliran atau modul disesuaikan; keputusan dicatat dosen.' },
    { kasus: 'Mahasiswa tidak hadir saat praktikum', penanganan: 'Mengikuti kebijakan praktikum pengganti prodi. [KONFIRMASI]' },
    { kasus: 'Kerusakan alat saat praktikum', penanganan: 'Dilaporkan kepada teknisi; unit rusak dicatat pada verifikasi pengembalian (SOP-TE-016) dan perbaikan diatur pada SOP-TE-017.' },
    { kasus: 'LKM belum diperiksa atau diperiksa tanpa nilai', penanganan: 'Tidak ikut dihitung pada nilai LKM; dosen melengkapi nilai sebelum finalisasi nilai.' }
  ],
  formulir: [
    'Modul praktikum/LKM (cetak dari sistem)',
    'Presensi dan jurnal praktikum',
    'Berkas LKM mahasiswa dan Kumpulan LKM',
    'Dokumentasi kegiatan praktikum',
    'Jadwal penggunaan laboratorium'
  ],
  lampiran: [],
  konfirmasi: [
    'Jadwal penggunaan laboratorium, kapasitas ruang, dan penggunaan lab di luar jam praktikum tidak ada pada sistem; tetapkan cara pengelolaannya.',
    'Tata tertib laboratorium tertulis, rasio mahasiswa terhadap alat, dan aturan penggunaan lab oleh mahasiswa tanpa dosen.',
    'Kebijakan praktikum pengganti dan batas ketidakhadiran praktikum.',
    'Modul template baru mencakup 9 jenis mata kuliah praktik; mata kuliah praktik lain perlu modul tambahan.',
    'Siapa koordinator laboratorium dan teknisi, serta tenggat standar pengumpulan LKM.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
