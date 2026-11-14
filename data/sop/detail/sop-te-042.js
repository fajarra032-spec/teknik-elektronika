// data/sop/detail/sop-te-042.js - SOP Pengumpulan Data dan Bukti Akreditasi (LED/LKPS)
// Sumber: routes/admin/akreditasi.js, routes/admin/akreditasiTabel.js, routes/dosen/akreditasiRoute.js,
// helpers/akreditasiHelper.js, helpers/lkpsTabelConfig.js. Angka waktu bertanda (u) = USULAN.
module.exports = {
  kode: 'SOP-TE-042',
  judul: 'Pengumpulan Data dan Bukti Akreditasi (LED dan LKPS)',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur pengumpulan data, bukti, dan penyusunan Laporan Evaluasi Diri (LED) serta Laporan Kinerja Program Studi (LKPS) untuk akreditasi program studi.',
    'Memastikan setiap kriteria memiliki penanggung jawab, bukti pendukung, tenggat, dan jejak pembahasan yang dapat diaudit.'
  ],
  ruangLingkup: [
    'Berlaku untuk periode akreditasi Program Studi D3 Teknik Elektronika pada menu Akreditasi: periode, kriteria, workspace (diskusi, dokumen, checklist), tabel data pendukung LKPS, serta rekap dan ekspor.',
    'Target persiapan akreditasi diarahkan pada September 2027. [KONFIRMASI: jadwal resmi]'
  ],
  dasarHukum: [
    'Peraturan dan instrumen akreditasi LAM Teknik untuk Program Diploma III yang berlaku. [KONFIRMASI: nomor dan versi terbaru]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'LED', arti: 'Laporan Evaluasi Diri: narasi analisis capaian program studi per kriteria.' },
    { istilah: 'LKPS', arti: 'Laporan Kinerja Program Studi: data pendukung dalam bentuk tabel. Pada sistem terdapat 7 tabel: Kurikulum dan Rencana Pembelajaran, Mata Kuliah Basic Science dan Matematika, Capstone Design, Penelitian DTPS, PkM DTPS, Profil Dosen, Prasarana dan Peralatan Utama, serta Masa Studi Lulusan.' },
    { istilah: 'Periode akreditasi', arti: 'Satu siklus penyusunan akreditasi (mis. Akreditasi LAM Teknik 2026); kriteria dan checklist diisi otomatis saat periode dibuat.' },
    { istilah: 'Kriteria', arti: 'Unit kerja penyusunan borang. Sistem menyediakan 9 kriteria template yang dapat disunting. Status: belum, proses, atau selesai.' },
    { istilah: 'PIC', arti: 'Dosen penanggung jawab satu kriteria yang ditetapkan admin.' },
    { istilah: 'Workspace kriteria', arti: 'Ruang kerja satu kriteria berisi diskusi, unggahan dokumen bukti, dan checklist proses.' }
  ],
  pihak: [
    { peran: 'Ketua Program Studi', tanggungJawab: 'Penanggung jawab keseluruhan, menetapkan jadwal, meninjau progres, dan menandatangani hasil akhir.' },
    { peran: 'Admin akreditasi', tanggungJawab: 'Membuat periode, menetapkan PIC dan status kriteria, mengelola tabel LKPS, rekap, dan ekspor.' },
    { peran: 'Dosen PIC dan anggota', tanggungJawab: 'Mengumpulkan data dan bukti, mengunggah dokumen, berdiskusi, dan menyusun narasi LED kriteria terkait.' },
    { peran: 'Tim Penjaminan Mutu', tanggungJawab: 'Melakukan review internal atas LED, LKPS, dan bukti.' }
  ],
  persyaratan: [
    'Instrumen akreditasi resmi LAM Teknik untuk Diploma III yang berlaku sudah diperoleh dan dibandingkan dengan kriteria template pada sistem.',
    'Periode akreditasi sudah dibuat dan PIC tiap kriteria sudah ditetapkan.',
    'Data sumber (kurikulum, KHS, profil dosen, prasarana, tracer, kerja sama) tersedia dan mutakhir.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Mengunduh instrumen resmi LAM Teknik terbaru untuk Diploma III dan mencocokkan kriteria serta elemen penilaiannya dengan template pada sistem; menyunting nama, uraian, atau urutan kriteria bila berbeda.', pelaksana: 'Ketua Program Studi / Admin akreditasi', waktu: 'Awal persiapan (u)', output: 'Daftar kriteria final' },
    { no: 2, kegiatan: 'Membuat periode akreditasi (nama dan tanggal); sistem mengisi kriteria dan checklist enam langkah secara otomatis.', pelaksana: 'Admin akreditasi', waktu: 'Awal persiapan (u)', output: 'Periode, kriteria, dan checklist' },
    { no: 3, kegiatan: 'Menetapkan dosen PIC, tanggal target, dan status awal setiap kriteria.', pelaksana: 'Admin akreditasi / Ketua Program Studi', waktu: '1 minggu setelah periode dibuat (u)', output: 'PIC dan tenggat tiap kriteria' },
    { no: 4, kegiatan: 'Mengumpulkan data dan bukti, lalu mengunggah dokumen (judul dan berkas) pada workspace kriteria; pembahasan dicatat pada kolom diskusi.', pelaksana: 'Dosen PIC dan anggota', waktu: 'Sesuai tenggat kriteria', output: 'Dokumen bukti pada Drive; catatan diskusi' },
    { no: 5, kegiatan: 'Mengisi dan memperbarui tabel LKPS (Tabel 1-6 berupa baris yang dapat ditambah atau disunting; Tabel 7 masa studi untuk dua kohort) dari data sumber.', pelaksana: 'Admin akreditasi / Dosen PIC', waktu: 'Sesuai tenggat kriteria', output: 'Tabel LKPS per periode' },
    { no: 6, kegiatan: 'Menyusun narasi LED setiap kriteria sesuai elemen penilaian dan melampirkan bukti pendukung.', pelaksana: 'Dosen PIC', waktu: 'Sesuai tenggat kriteria', output: 'Draf narasi LED' },
    { no: 7, kegiatan: 'Melakukan review internal atas narasi, tabel, dan bukti, lalu memberi catatan perbaikan.', pelaksana: 'Tim Penjaminan Mutu', waktu: '2 minggu setelah draf (u)', output: 'Catatan review' },
    { no: 8, kegiatan: 'Memperbaiki sesuai catatan review dan memeriksa konsistensi data tabel, bukti, dan data pada sistem serta PDDikti. [KONFIRMASI]', pelaksana: 'Dosen PIC / Admin akreditasi', waktu: '2 minggu (u)', output: 'Dokumen terverifikasi' },
    { no: 9, kegiatan: 'Memfinalisasi dan menandatangani LED dan LKPS; PIC menandai kriteria berstatus selesai.', pelaksana: 'Ketua Program Studi / Pimpinan institusi', waktu: 'Sebelum batas pengajuan (u)', output: 'LED dan LKPS final bertanda tangan' },
    { no: 10, kegiatan: 'Memantau progres pada dashboard dan rekap (persentase kriteria selesai dan penanda kriteria terlambat) dan membahasnya pada rapat prodi.', pelaksana: 'Ketua Program Studi / Admin akreditasi', waktu: 'Bulanan (u)', output: 'Laporan progres akreditasi' },
    { no: 11, kegiatan: 'Mengekspor rekap, mengarsipkan paket bukti per periode, dan mengevaluasi hasil asesmen untuk perbaikan berikutnya.', pelaksana: 'Admin akreditasi / Tim Penjaminan Mutu', waktu: 'Setelah pengajuan dan setelah hasil terbit', output: 'Arsip akreditasi; evaluasi' }
  ],
  kasusKhusus: [
    { kasus: 'Bukti belum tersedia saat tenggat', penanganan: 'Dicatat pada checklist dan diskusi dengan rencana perolehan; kriteria tidak ditandai selesai.' },
    { kasus: 'Dokumen salah unggah', penanganan: 'Admin menghapus dokumen dan PIC mengunggah ulang; dosen tidak memiliki tombol hapus pada workspace.' },
    { kasus: 'Dosen bukan PIC ingin berkontribusi', penanganan: 'Tetap dapat berdiskusi, mengunggah dokumen, dan menandai checklist; tidak dapat mengubah status atau PIC.' },
    { kasus: 'Instrumen atau peraturan akreditasi berubah', penanganan: 'Kriteria diedit, ditambah, atau dihapus oleh admin dan pemetaan bukti disesuaikan.' },
    { kasus: 'Kriteria melewati tanggal target', penanganan: 'Ditandai terlambat pada dashboard; Ketua Program Studi menetapkan tindak lanjut.' }
  ],
  formulir: [
    'Workspace kriteria (diskusi, dokumen, checklist) pada sistem',
    'Tabel LKPS (Tabel 1-7)',
    'Rekap akreditasi dan hasil ekspor',
    'LED dan LKPS final',
    'Catatan review internal'
  ],
  lampiran: [],
  konfirmasi: [
    'Kriteria pada sistem adalah template 9 kriteria (mengacu IAPS-AV 2025), sedangkan dokumen panduan awal Anda menyebut tujuh kriteria utama LAM Teknik. Cocokkan dengan instrumen resmi LAM Teknik Diploma III yang berlaku dan tetapkan satu rujukan; template sistem sendiri menyatakan bukan nilai final.',
    'Tujuh tabel LKPS mengikuti berkas Excel LKPS yang pernah diberikan; periksa apakah masih sama dengan versi terbaru.',
    'Progres keseluruhan dihitung dari jumlah kriteria berstatus selesai, bukan dari checklist; tetapkan apakah perlu memperhitungkan checklist.',
    'Susunan tim akreditasi, pejabat penandatangan LED dan LKPS, serta jadwal resmi September 2027.',
    'Sumber data pembanding (PDDikti) dan siapa yang memverifikasi konsistensinya.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
