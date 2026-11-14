// data/sop/detail/sop-te-024.js - SOP Penanganan Masalah Magang
// Sumber: views/sop/magang.ejs (aturan menolak lokasi, pelanggaran berat, perlakuan tidak sesuai norma, atribut dan etika)
// dan alur sistem magang. Langkah penanganan terstruktur adalah PROSEDUR BARU yang perlu disetujui Kaprodi.
module.exports = {
  kode: 'SOP-TE-024',
  judul: 'Penanganan Masalah Magang',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur penanganan masalah selama proses magang: penolakan lokasi, pelanggaran oleh mahasiswa, perlakuan tidak sesuai norma terhadap mahasiswa, dan kendala lain di IDUKA.',
    'Menjaga hak dan keselamatan mahasiswa serta nama baik kampus dan hubungan dengan IDUKA.'
  ],
  ruangLingkup: [
    'Berlaku untuk seluruh mahasiswa magang (dalam dan luar negeri) sejak penetapan lokasi sampai penilaian akhir.'
  ],
  dasarHukum: [
    'Pedoman Magang Politeknik Dewantara (SK Direktur No. 407/D/Polidewa/II/2026).',
    'Kode etik dan tata tertib mahasiswa Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Penolakan lokasi', arti: 'Mahasiswa menolak lokasi magang yang ditetapkan Kepala Bagian Magang.' },
    { istilah: 'Pelanggaran berat', arti: 'Kesalahan mahasiswa yang menyebabkan mahasiswa dipulangkan IDUKA sebelum magang selesai.' },
    { istilah: 'Perlakuan tidak sesuai norma', arti: 'Perlakuan menyimpang terhadap mahasiswa di IDUKA, termasuk pelecehan, kekerasan, eksploitasi, atau pengabaian keselamatan.' },
    { istilah: 'Alasan sah', arti: 'Alasan yang disetujui prodi (mis. kondisi kesehatan atau keamanan) untuk menolak lokasi.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Mematuhi etika dan aturan IDUKA; melaporkan masalah segera.' },
    { peran: 'Dosen PA', tanggungJawab: 'Menerima laporan, memverifikasi, dan mendampingi mahasiswa.' },
    { peran: 'Kepala Bagian Magang', tanggungJawab: 'Berkoordinasi dengan IDUKA, mengelola relokasi, dan mencatat kasus.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Memutuskan penanganan dan status magang.' }
  ],
  persyaratan: [
    'Laporan masalah disampaikan secepatnya oleh mahasiswa, Pendamping Lapangan, atau Dosen PA.',
    'Keputusan didasarkan pada verifikasi kedua pihak dan bukti yang tersedia.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Menerima laporan masalah (melalui WhatsApp, surel, atau tatap muka) dan mencatatnya: tanggal, pelapor, jenis masalah, kronologi, dan bukti.', pelaksana: 'Dosen PA / Kepala Bagian Magang', waktu: 'Seketika, tercatat 1 hari kerja (u)', output: 'Catatan laporan masalah' },
    { no: 2, kegiatan: 'Menilai tingkat urgensi; bila menyangkut keselamatan atau perlakuan tidak sesuai norma, mahasiswa diamankan dan dikoordinasikan pemulangan atau pemindahan segera.', pelaksana: 'Dosen PA / Ketua Program Studi', waktu: 'Segera', output: 'Keputusan penanganan darurat' },
    { no: 3, kegiatan: 'Memverifikasi kronologi dengan mendengar keterangan mahasiswa dan pihak IDUKA serta mengumpulkan bukti.', pelaksana: 'Dosen PA / Kepala Bagian Magang', waktu: '3 hari kerja (u)', output: 'Hasil verifikasi' },
    { no: 4, kegiatan: 'Memutuskan penanganan sesuai jenis masalah: penolakan lokasi tanpa alasan sah dan persetujuan prodi, magang ditunda ke periode berikutnya dan lokasi dialihkan ke mahasiswa lain; penolakan dengan alasan sah, relokasi; pelanggaran berat sampai dipulangkan, dinyatakan tidak lulus magang; perlakuan tidak sesuai norma, mahasiswa dikembalikan ke kampus untuk ditindaklanjuti.', pelaksana: 'Ketua Program Studi', waktu: '3 hari kerja (u)', output: 'Keputusan tertulis' },
    { no: 5, kegiatan: 'Menyampaikan keputusan kepada mahasiswa dan IDUKA serta memperbarui status periode magang di sistem (penundaan, perpanjangan, atau penutupan periode).', pelaksana: 'Dosen PA / Kepala Bagian Magang', waktu: '1 hari kerja setelah keputusan (u)', output: 'Pemberitahuan; status periode diperbarui' },
    { no: 6, kegiatan: 'Memberi pendampingan lanjutan: konseling bagi mahasiswa, relokasi ke IDUKA lain, atau pembinaan sesuai tata tertib.', pelaksana: 'Dosen PA / Ketua Program Studi', waktu: 'Sesuai kebutuhan', output: 'Catatan pendampingan' },
    { no: 7, kegiatan: 'Mengarsipkan kasus pada register masalah magang dan menyampaikannya sebagai bahan evaluasi mitra (SOP-TE-025).', pelaksana: 'Kepala Bagian Magang', waktu: 'Setelah kasus selesai', output: 'Register masalah magang' },
    { no: 8, kegiatan: 'Meninjau seluruh kasus tiap semester dan menetapkan perbaikan seleksi IDUKA, pembekalan, atau pedoman.', pelaksana: 'Ketua Program Studi / Tim Penjaminan Mutu', waktu: 'Akhir semester', output: 'Laporan evaluasi masalah magang' }
  ],
  kasusKhusus: [
    { kasus: 'Mahasiswa mengalami cedera atau kecelakaan kerja di IDUKA', penanganan: 'Mengutamakan pertolongan medis, melapor kepada prodi dan IDUKA, dan mencatat sebagai insiden (SOP-TE-019).' },
    { kasus: 'IDUKA menghentikan magang karena kondisi perusahaan, bukan kesalahan mahasiswa', penanganan: 'Mahasiswa dialihkan ke IDUKA lain atau periode disesuaikan; tidak dinyatakan tidak lulus.' },
    { kasus: 'Mahasiswa meminta pindah lokasi', penanganan: 'Dinilai berdasarkan alasan; bila sah dan disetujui prodi, lokasi dialihkan.' },
    { kasus: 'IDUKA menawarkan kesempatan kerja', penanganan: 'Pedoman membolehkan bila kompetensi sesuai; mahasiswa tetap menyelesaikan kewajiban magang.' },
    { kasus: 'Mahasiswa cuti atau keluar saat magang', penanganan: 'Tidak diikutkan dalam proses magang pada sistem.' }
  ],
  formulir: [
    'Catatan laporan masalah magang',
    'Berita acara verifikasi',
    'Keputusan penanganan masalah magang',
    'Register masalah magang'
  ],
  lampiran: [],
  konfirmasi: [
    'Pedoman hanya mengatur tiga kasus (penolakan lokasi, pelanggaran berat, perlakuan tidak sesuai norma). Langkah verifikasi, pendampingan, pencatatan, dan evaluasi adalah prosedur baru yang saya rumuskan; setujui atau sesuaikan.',
    'Definisi pelanggaran berat dan alasan sah belum dirinci; tetapkan daftar contoh.',
    'Mekanisme banding mahasiswa atas keputusan tidak lulus magang.',
    'Perlindungan dan penanganan laporan pelecehan atau kekerasan, termasuk unit yang berwenang di institusi.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
