// data/sop/detail/sop-te-041.js - SOP Pengendalian Dokumen dan Arsip
// Sumber: modul SOP (Buku Induk, status, versi), pola penomoran SK pada skrip/pedoman, struktur arsip Drive Data WEB.
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-041',
  judul: 'Pengendalian Dokumen dan Arsip',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan cara penomoran, penyusunan, pengesahan, distribusi, revisi, penarikan, dan pengarsipan dokumen mutu Program Studi D3 Teknik Elektronika.',
    'Memastikan hanya versi dokumen yang berlaku yang dipakai dan setiap bukti pelaksanaan tersimpan rapi untuk audit dan akreditasi.'
  ],
  ruangLingkup: [
    'Berlaku untuk dokumen mutu prodi (SOP, pedoman, formulir) dan rekaman pelaksanaan (notulen, berita acara, log, laporan) dalam bentuk digital maupun fisik.',
    'Kebijakan, manual, dan standar SPMI tingkat institusi tetap menjadi kewenangan institusi; SOP ini mengatur dokumen tingkat prodi.'
  ],
  dasarHukum: [
    'Kebijakan dan Manual SPMI serta pedoman pengendalian dokumen Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Dokumen mutu', arti: 'Dokumen yang mengatur pelaksanaan kegiatan prodi: SOP, pedoman, dan formulir.' },
    { istilah: 'Rekaman', arti: 'Bukti bahwa kegiatan telah dilaksanakan, mis. notulen, berita acara, logbook, daftar hadir, laporan.' },
    { istilah: 'Buku Induk SOP', arti: 'Daftar induk seluruh SOP beserta nomor, penanggung jawab, prioritas, status, versi, dan tanggal berlaku (menu admin Buku Induk SOP).' },
    { istilah: 'Nomor dokumen', arti: 'Kode unik dokumen. SOP prodi memakai format SOP-TE-nnn (usulan).' },
    { istilah: 'Versi dan status', arti: 'Versi mengikuti pola 1.0, 1.1, 2.0. Status pada sistem: Belum ada, Ada - perlu diformat, Draf disusun, Menunggu pengesahan, Disahkan.' },
    { istilah: 'Masa retensi', arti: 'Lama dokumen atau rekaman wajib disimpan sebelum dimusnahkan.' }
  ],
  pihak: [
    { peran: 'Ketua Program Studi', tanggungJawab: 'Memeriksa dokumen, mengusulkan pengesahan, dan menetapkan kebijakan arsip prodi.' },
    { peran: 'Pemilik proses (penyusun)', tanggungJawab: 'Menyusun dan merevisi dokumen sesuai praktik nyata dan menyimpan rekaman proses.' },
    { peran: 'Tim Penjaminan Mutu', tanggungJawab: 'Memverifikasi kesesuaian dengan SPMI, memelihara Buku Induk, dan melakukan peninjauan berkala.' },
    { peran: 'Admin sistem', tanggungJawab: 'Memutakhirkan status, versi, dan tanggal berlaku pada sistem serta menjaga penyimpanan dan backup arsip digital.' },
    { peran: 'Pejabat pengesah', tanggungJawab: 'Mengesahkan dokumen sesuai kewenangan institusi. [KONFIRMASI: Direktur atau pejabat lain]' }
  ],
  persyaratan: [
    'Dokumen disusun menggunakan templat SOP baku: nomor dokumen, judul, tujuan, ruang lingkup, dasar hukum, pihak, persyaratan, prosedur dengan waktu, formulir, tanggal berlaku dan riwayat revisi, serta pengesahan.',
    'Nomor dokumen diambil dari Buku Induk SOP.',
    'Isi dokumen sesuai praktik yang berjalan dan selaras dengan dokumen SPMI institusi.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Mengusulkan dokumen baru atau revisi berdasarkan kebutuhan proses, hasil evaluasi, temuan audit, atau perubahan regulasi, lalu mencatatnya pada Buku Induk SOP.', pelaksana: 'Pemilik proses / Tim Penjaminan Mutu', waktu: 'Sesuai kebutuhan', output: 'Usulan pada Buku Induk' },
    { no: 2, kegiatan: 'Menyusun dokumen dengan templat baku, memakai nomor dari Buku Induk dan versi 1.0 berstatus Draf disusun.', pelaksana: 'Pemilik proses', waktu: '2 minggu (u)', output: 'Draf dokumen' },
    { no: 3, kegiatan: 'Memverifikasi isi: kesesuaian dengan praktik dan SPMI, tidak ada duplikasi, butir konfirmasi terselesaikan, dan waktu usulan (u) ditetapkan.', pelaksana: 'Pemilik proses / Tim Penjaminan Mutu', waktu: '1 minggu (u)', output: 'Draf terverifikasi' },
    { no: 4, kegiatan: 'Memeriksa dokumen dan mengubah status menjadi Menunggu pengesahan.', pelaksana: 'Ketua Program Studi / Admin sistem', waktu: '3 hari kerja (u)', output: 'Status Menunggu pengesahan' },
    { no: 5, kegiatan: 'Mengesahkan dokumen sesuai kewenangan institusi; admin mengisi status Disahkan, versi, dan tanggal berlaku pada Buku Induk sehingga halaman SOP tidak lagi menampilkan peringatan draf.', pelaksana: 'Pejabat pengesah / Admin sistem', waktu: 'Sesuai jadwal pengesahan (u)', output: 'Dokumen disahkan; status dan tanggal berlaku tercatat' },
    { no: 6, kegiatan: 'Mendistribusikan dokumen melalui halaman SOP (publik atau internal) dan mensosialisasikannya kepada pelaksana dengan daftar hadir.', pelaksana: 'Ketua Program Studi / Admin sistem', waktu: '1 minggu setelah disahkan (u)', output: 'Dokumen tersedia; daftar hadir sosialisasi' },
    { no: 7, kegiatan: 'Menyimpan rekaman pelaksanaan pada arsip terstruktur (12 kelompok: legalitas, SOP, kurikulum, dosen, mahasiswa, magang, laboratorium, penelitian dan PkM, kerja sama, penjaminan mutu, alumni, akreditasi) dengan penamaan konsisten, mis. SOP-TE-001_Judul_V1.0_2026.pdf.', pelaksana: 'Pemilik proses', waktu: 'Setiap kegiatan selesai', output: 'Rekaman terarsip' },
    { no: 8, kegiatan: 'Meninjau dokumen secara berkala dan saat ada perubahan regulasi, temuan audit, atau perubahan proses; memutuskan tetap, revisi, atau dicabut.', pelaksana: 'Pemilik proses / Tim Penjaminan Mutu', waktu: 'Minimal setahun sekali (u)', output: 'Hasil tinjauan dokumen' },
    { no: 9, kegiatan: 'Merevisi dokumen: menaikkan versi (1.1 untuk perubahan kecil, 2.0 untuk perubahan besar), mengisi riwayat revisi, dan mengulang pengesahan; versi lama ditandai tidak berlaku dan diarsip.', pelaksana: 'Pemilik proses / Admin sistem', waktu: 'Sesuai hasil tinjauan', output: 'Versi baru; arsip versi lama' },
    { no: 10, kegiatan: 'Menarik dokumen yang tidak berlaku dari penayangan dan mengarsipkannya dengan keterangan tanggal dan alasan penarikan.', pelaksana: 'Admin sistem / Tim Penjaminan Mutu', waktu: 'Saat dokumen dicabut', output: 'Dokumen ditarik; catatan penarikan' },
    { no: 11, kegiatan: 'Menyimpan arsip sesuai masa retensi, memasukkan arsip digital pada prosedur backup (SOP-TE-045), dan memusnahkan arsip yang melewati masa retensi dengan berita acara.', pelaksana: 'Admin sistem / Tim Penjaminan Mutu', waktu: 'Sesuai masa retensi', output: 'Arsip terjaga; berita acara pemusnahan' },
    { no: 12, kegiatan: 'Memeriksa kesesuaian Buku Induk dengan dokumen yang beredar dan kelengkapan rekaman tiap semester sebagai bagian audit mutu.', pelaksana: 'Tim Penjaminan Mutu', waktu: 'Tiap semester', output: 'Laporan pemeriksaan dokumen' }
  ],
  kasusKhusus: [
    { kasus: 'Dokumen dipakai sebelum disahkan', penanganan: 'Ditandai Draf dan halaman SOP menampilkan peringatan; pelaksana diberi tahu bahwa isinya belum final.' },
    { kasus: 'Dua versi dokumen beredar', penanganan: 'Hanya versi dengan status Disahkan dan tanggal berlaku terbaru yang dipakai; versi lain ditarik.' },
    { kasus: 'Dokumen atau rekaman hilang', penanganan: 'Dipulihkan dari backup; bila tidak ada, dibuat berita acara dan dipulihkan dari sumber lain.' },
    { kasus: 'Perubahan regulasi mendesak', penanganan: 'Revisi dipercepat atas persetujuan Ketua Program Studi dan pengesahan segera.' },
    { kasus: 'Dokumen tingkat institusi bertentangan dengan dokumen prodi', penanganan: 'Dokumen institusi menjadi acuan; dokumen prodi direvisi.' }
  ],
  formulir: [
    'Buku Induk SOP (menu admin dan hasil ekspor)',
    'Templat SOP baku (Word)',
    'Daftar hadir sosialisasi dokumen',
    'Berita acara pemusnahan arsip'
  ],
  lampiran: [],
  konfirmasi: [
    'Format nomor resmi: nomor SOP-TE-nnn adalah usulan. Contoh penomoran yang saya lihat di proyek adalah nomor SK Ketua Prodi 1814/EK/Polidewa/VII/2025 dan SK Direktur 407/D/Polidewa/II/2026; tetapkan apakah institusi punya penomoran dokumen mutu.',
    'Pejabat pengesah SOP prodi dan tata cara pengesahan (tanda tangan basah atau digital).',
    'Sistem hanya menyimpan status, versi, dan tanggal berlaku terakhir; riwayat revisi dan berkas versi lama belum tersimpan di sistem dan dicatat manual pada dokumen. Pertimbangkan fitur unggah PDF bertanda tangan dan riwayat versi.',
    'Masa retensi tiap jenis arsip dan tata cara pemusnahan.',
    'Cakupan arsip fisik dan lokasi penyimpanan.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
