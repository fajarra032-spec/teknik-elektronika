// data/sop/detail/sop-te-009.js - SOP Pembimbingan Akademik dan Monitoring Masa Studi
// Sumber: routes/dosen/mahasiswaPa.js, routes/mahasiswa/konsultasiPa.js, helpers/konsultasiPaHelper.js,
// routes/admin/bimbingan.js, helpers/statusMahasiswaHelper.js, helpers/skPaHelper.js.
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-009',
  judul: 'Pembimbingan Akademik dan Monitoring Masa Studi',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur pembimbingan akademik oleh Dosen Pembimbing Akademik (PA) dan pemantauan perkembangan serta masa studi mahasiswa.',
    'Memastikan setiap mahasiswa memiliki PA, setiap konsultasi tercatat, dan mahasiswa yang berisiko terlambat atau putus studi ditangani lebih awal.'
  ],
  ruangLingkup: [
    'Berlaku untuk seluruh mahasiswa D3 Teknik Elektronika berstatus Aktif, Cuti, atau Keluar yang masih tercatat dalam bimbingan PA, dan untuk seluruh dosen yang ditetapkan sebagai PA.',
    'Dosen PA juga menjadi pembimbing tunggal magang (SOP-TE-021); penetapan dan SK PA diatur pada SOP-TE-033.'
  ],
  dasarHukum: [
    'SK Penetapan Dosen Pembimbing Akademik yang berlaku.',
    'Kurikulum dan kalender akademik Program Studi D3 Teknik Elektronika.',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Dosen PA', arti: 'Dosen yang ditetapkan sebagai pembimbing akademik mahasiswa; tercatat pada data mahasiswa dan menjadi pembimbing tunggal magang.' },
    { istilah: 'Lembar Konsultasi', arti: 'Catatan setiap pertemuan konsultasi: tanggal, kategori, topik, uraian, saran, dan semester. Dosen PA dapat mencatat, mengubah, menghapus, dan mencetak; mahasiswa dapat melihat dan mencetak.' },
    { istilah: 'Kategori konsultasi', arti: 'KRS/Rencana Studi, Nilai dan Prestasi, Kehadiran dan Disiplin, Magang, Kendala Pribadi/Keluarga, Beasiswa dan Biaya Kuliah, atau Lainnya.' },
    { istilah: 'Perlu ditindak', arti: 'Penanda pada halaman Dosen PA untuk mahasiswa yang memiliki logbook magang menunggu persetujuan atau laporan magang belum ditinjau.' },
    { istilah: 'Mahasiswa berisiko', arti: 'Mahasiswa dengan indikasi terlambat atau putus studi (mis. capaian rendah, tidak mengambil KRS, masa studi mendekati batas). Kriteria ditetapkan prodi. [KONFIRMASI]' }
  ],
  pihak: [
    { peran: 'Dosen PA', tanggungJawab: 'Membimbing, mencatat konsultasi, memantau perkembangan mahasiswa, dan menindaklanjuti kendala.' },
    { peran: 'Mahasiswa', tanggungJawab: 'Menemui Dosen PA secara berkala dan sebelum menyusun KRS, serta menyampaikan kendala secara terbuka.' },
    { peran: 'Ketua Program Studi / Admin', tanggungJawab: 'Menetapkan Dosen PA, memantau cakupan dan kinerja PA, serta mengambil keputusan bagi mahasiswa berisiko.' }
  ],
  persyaratan: [
    'Dosen PA setiap mahasiswa sudah ditetapkan di sistem (mahasiswa tanpa PA tidak dapat mengisi logbook dan laporan magang).',
    'SK PA sudah terbit untuk semester berjalan.',
    'Dosen PA memiliki akses ke halaman Mahasiswa PA pada menu dosen.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Menetapkan Dosen PA untuk mahasiswa baru dan mahasiswa yang belum memiliki PA pada menu Mahasiswa (tetapkan Dosen PA, dapat massal); memeriksa daftar mahasiswa tanpa PA pada menu Bimbingan.', pelaksana: 'Admin / Ketua Program Studi', waktu: 'Awal semester (u)', output: 'Dosen PA tercatat untuk seluruh mahasiswa aktif' },
    { no: 2, kegiatan: 'Menerbitkan dan mendistribusikan SK Penetapan Dosen PA.', pelaksana: 'Admin / Ketua Program Studi', waktu: 'Awal semester (u)', output: 'SK PA terkirim (SOP-TE-033)' },
    { no: 3, kegiatan: 'Menghubungi mahasiswa bimbingan pada awal semester: perkenalan, tinjauan capaian semester lalu, dan arahan rencana studi sebelum KRS disusun.', pelaksana: 'Dosen PA', waktu: 'Sebelum periode KRS (u)', output: 'Catatan konsultasi awal semester' },
    { no: 4, kegiatan: 'Melaksanakan konsultasi sesuai kebutuhan dan jadwal (minimal 3 kali per semester (u)) dan mencatatnya pada Lembar Konsultasi dengan kategori, topik, uraian, dan saran.', pelaksana: 'Dosen PA / Mahasiswa', waktu: 'Sepanjang semester', output: 'Lembar Konsultasi terisi' },
    { no: 5, kegiatan: 'Memantau perkembangan mahasiswa: nilai dan KHS (IPS dan IPK), kehadiran, status (Aktif, Cuti, Keluar), serta pelaksanaan magang; menindaklanjuti mahasiswa yang diberi penanda perlu ditindak.', pelaksana: 'Dosen PA', waktu: 'Bulanan (u)', output: 'Catatan pemantauan' },
    { no: 6, kegiatan: 'Menindaklanjuti kendala mahasiswa: arahan akademik, rujukan ke layanan konseling atau beasiswa (SOP-TE-031), dan pelaporan kepada Ketua Program Studi bila perlu.', pelaksana: 'Dosen PA', waktu: 'Segera setelah kendala diketahui', output: 'Rencana tindak lanjut' },
    { no: 7, kegiatan: 'Memantau masa studi per angkatan tiap semester: jumlah mahasiswa aktif, cuti, keluar, lulus, capaian IPK, dan tahap magang; mengidentifikasi mahasiswa berisiko terlambat atau putus studi.', pelaksana: 'Ketua Program Studi / Admin', waktu: 'Tiap semester', output: 'Laporan perkembangan mahasiswa per angkatan' },
    { no: 8, kegiatan: 'Menangani mahasiswa berisiko: pemanggilan oleh Dosen PA dan Ketua Program Studi, penyusunan rencana pemulihan studi, dan pencatatan hasilnya.', pelaksana: 'Dosen PA / Ketua Program Studi', waktu: '2 minggu setelah teridentifikasi (u)', output: 'Rencana pemulihan studi' },
    { no: 9, kegiatan: 'Mencetak Lembar Konsultasi pada akhir semester, ditandatangani, dan diarsipkan.', pelaksana: 'Dosen PA / Admin', waktu: 'Akhir semester', output: 'Lembar Konsultasi cetak (arsip)' },
    { no: 10, kegiatan: 'Mengevaluasi pelaksanaan bimbingan akademik (cakupan, frekuensi konsultasi, tindak lanjut) pada rapat evaluasi prodi.', pelaksana: 'Ketua Program Studi / Tim Penjaminan Mutu', waktu: 'Akhir semester', output: 'Hasil evaluasi bimbingan akademik' }
  ],
  kasusKhusus: [
    { kasus: 'Mahasiswa tidak merespons ajakan konsultasi', penanganan: 'Dosen PA menghubungi hingga 3 kali melalui kanal berbeda (u), lalu melaporkan kepada Ketua Program Studi.' },
    { kasus: 'Dosen PA berhalangan jangka panjang (cuti, tugas belajar)', penanganan: 'Admin menetapkan PA pengganti dan menerbitkan SK baru; catatan konsultasi tetap dapat dilihat.' },
    { kasus: 'Mahasiswa berstatus Cuti atau Keluar', penanganan: 'Tetap tampil pada daftar PA tetapi tanpa tindakan magang; PA tetap memantau rencana aktif kembali.' },
    { kasus: 'Konsultasi menyangkut masalah pribadi atau keluarga', penanganan: 'Dicatat seperlunya pada kategori Kendala Pribadi/Keluarga dan dijaga kerahasiaannya; rujukan konseling bila diperlukan.' },
    { kasus: 'Mahasiswa meminta pergantian Dosen PA', penanganan: 'Diajukan kepada Ketua Program Studi; bila disetujui, admin mengubah penetapan PA dan menerbitkan SK perubahan.' }
  ],
  formulir: [
    'Lembar Konsultasi bimbingan akademik (cetak dari sistem)',
    'Kartu Kontrol Bimbingan Magang',
    'SK Penetapan Dosen PA',
    'Laporan perkembangan mahasiswa per angkatan'
  ],
  lampiran: [],
  konfirmasi: [
    'Frekuensi minimal konsultasi dan batas respons (angka 3 kali pada langkah 4 adalah usulan).',
    'Kriteria mahasiswa berisiko (batas IPK, jumlah KRS, masa studi maksimal D3) dan bentuk peringatan akademik; sistem belum memberi peringatan otomatis.',
    'Rasio mahasiswa per Dosen PA dan beban PA.',
    'Aturan kerahasiaan catatan konsultasi pribadi.',
    'Apakah mahasiswa yang sudah Lulus masih ditampilkan pada daftar PA (saat ini tidak ditampilkan).',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
