// data/sop/detail/sop-te-023.js - SOP Penilaian, Laporan, dan Seminar Hasil Magang
// Sumber: helpers/nilaiMagangHelper.js, CATATAN-FORMAT-MAGANG-BARU.txt, routes/admin/emagang.js, views/sop/magang.ejs.
module.exports = {
  kode: 'SOP-TE-023',
  judul: 'Penilaian, Laporan, dan Seminar Hasil Magang',
  versi: '1.0 (Draf)',
  tanggalDibuat: '13 November 2026',
  tujuan: [
    'Menetapkan prosedur pelaporan, penilaian, dan penetapan nilai akhir magang secara seragam dan dapat dipertanggungjawabkan.',
    'Memastikan nilai magang tercatat di KHS/Transkrip dengan bukti penilaian dari Dosen PA dan Pendamping Lapangan.'
  ],
  ruangLingkup: [
    'Berlaku untuk seluruh mahasiswa D3 Teknik Elektronika yang telah menutup periode magang PDK 1/2/3 (SOP-TE-021).'
  ],
  dasarHukum: [
    'Pedoman Magang Politeknik Dewantara (SK Direktur No. 407/D/Polidewa/II/2026) dan Form Penilaian Magang Industri (format terbaru).',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Form Dosen Pembimbing', arti: '18 indikator: Laporan (8), Kepribadian (7), Pengetahuan (3); diisi Dosen PA. Menggantikan Nilai Laporan dan Nilai Logbook yang dulu terpisah.' },
    { istilah: 'Form Pendamping Lapangan', arti: '10 indikator: Keterampilan (2), Pengetahuan (2), Sikap Kerja (5), Laporan (1); diinput admin/Kaprodi mewakili Pendamping Lapangan.' },
    { istilah: 'Kunci nilai', arti: 'Penetapan nilai akhir yang menyalin nilai magang ke KHS/Transkrip mahasiswa.' }
  ],
  pihak: [
    { peran: 'Mahasiswa', tanggungJawab: 'Menyusun dan merevisi laporan, tidak melakukan plagiasi, mengisi ulasan dan rating.' },
    { peran: 'Dosen PA', tanggungJawab: 'Meninjau laporan (ACC/Reject), mengisi Form Dosen Pembimbing.' },
    { peran: 'Pendamping Lapangan', tanggungJawab: 'Menilai mahasiswa dan menyetujui laporan dari sisi IDUKA.' },
    { peran: 'Admin / Ketua Program Studi', tanggungJawab: 'Menginput Form Pendamping Lapangan, mengunci nilai akhir.' },
    { peran: 'Kepala Bagian Magang', tanggungJawab: 'Mengesahkan laporan magang.' }
  ],
  persyaratan: [
    'Periode magang telah ditutup dan logbook terkunci.',
    'Minimal satu laporan telah di-ACC Dosen PA sebelum Form Dosen Pembimbing dapat diisi.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Mengunggah laporan magang melalui menu Magang > Laporan.', pelaksana: 'Mahasiswa', waktu: 'Setelah periode ditutup', output: 'Berkas laporan' },
    { no: 2, kegiatan: 'Meninjau laporan: ACC atau Reject disertai komentar; mahasiswa merevisi bila ditolak.', pelaksana: 'Dosen PA / Mahasiswa', waktu: '7 hari kerja (u)', output: 'Status laporan; komentar revisi' },
    { no: 3, kegiatan: 'Laporan disetujui Pendamping Lapangan dan Dosen PA, kemudian disahkan.', pelaksana: 'Pendamping Lapangan / Dosen PA / Kepala Bagian Magang', waktu: 'Setelah laporan di-ACC', output: 'Lembar pengesahan laporan' },
    { no: 4, kegiatan: 'Mengisi Form Penilaian Dosen Pembimbing (nilai 0-100 per indikator) beserta catatan.', pelaksana: 'Dosen PA', waktu: '7 hari kerja (u)', output: 'Form Dosen Pembimbing (dapat dicetak)' },
    { no: 5, kegiatan: 'Menginput Form Penilaian Pendamping Lapangan. Bila belum dinilai, form dicetak kosong untuk diisi Pendamping Lapangan.', pelaksana: 'Admin / Ketua Program Studi', waktu: '7 hari kerja (u)', output: 'Form Pendamping Lapangan (dapat dicetak)' },
    { no: 6, kegiatan: 'Sistem menghitung nilai akhir sebagai rata-rata Dosen Pembimbing dan Pendamping Lapangan dengan bobot 50:50, lalu dikonversi ke huruf.', pelaksana: 'Sistem', waktu: 'Otomatis', output: 'Nilai akhir sementara' },
    { no: 7, kegiatan: 'Memeriksa kewajaran nilai dan mengunci nilai akhir sehingga masuk ke KHS/Transkrip.', pelaksana: 'Ketua Program Studi', waktu: '3 hari kerja (u)', output: 'Nilai magang di KHS/Transkrip' },
    { no: 8, kegiatan: 'Mengisi Ulasan dan Rating (bintang 1-5) tentang pengalaman magang dan IDUKA.', pelaksana: 'Mahasiswa', waktu: 'Setelah nilai terbit', output: 'Ulasan dan rating' },
    { no: 9, kegiatan: 'Mengajukan seminar hasil magang melalui menu Penyelesaian Studi (lihat SOP-TE-012).', pelaksana: 'Mahasiswa / Admin', waktu: 'Sesuai jadwal seminar', output: 'Berita acara seminar' }
  ],
  kasusKhusus: [
    { kasus: 'Data nilai lama (Nilai Laporan dan Nilai Logbook terpisah)', penanganan: 'Komponen Dosen dihitung dari rata-rata keduanya sampai Dosen PA mengisi form baru; nilai yang sudah dikunci ke KHS tidak berubah.' },
    { kasus: 'Nilai Pendamping Lapangan lama (9 indikator)', penanganan: 'Tetap berlaku sampai admin melengkapi indikator Disiplin dan menyimpan ulang dengan form baru.' },
    { kasus: 'Mahasiswa dipulangkan IDUKA karena kesalahan mahasiswa', penanganan: 'Dinyatakan tidak lulus magang (lihat SOP-TE-024).' },
    { kasus: 'Revisi nilai setelah dikunci', penanganan: 'Melalui SOP Koreksi dan Perubahan Data Akademik (disetujui Ketua Program Studi, dengan berita acara).' }
  ],
  formulir: [
    'Form Penilaian Dosen Pembimbing (cetak dari sistem)',
    'Form Penilaian Pendamping Lapangan (cetak dari sistem)',
    'Berita Acara Persentasi Hasil Kegiatan Magang'
  ],
  lampiran: [
    {
      judul: 'Lampiran 1. Konversi nilai angka ke huruf',
      head: ['Huruf', 'Skor', 'Rentang nilai', 'Kategori'],
      rows: [
        ['A', '4,0', '86,0 - 100', 'Istimewa'],
        ['B+', '3,5', '76,0 - 85,9', 'Sangat baik'],
        ['B', '3,0', '60,0 - 75,9', 'Baik'],
        ['C+', '2,5', '50,0 - 59,9', 'Cukup baik'],
        ['C', '2,0', '25,0 - 49,9', 'Cukup'],
        ['D', '1,0', '10,0 - 24,9', 'Kurang'],
        ['E', '0,0', '0,0 - 9,9', 'Sangat kurang']
      ]
    }
  ],
  konfirmasi: [
    'PENTING - bobot nilai akhir: sistem memakai 2 komponen (Dosen PA 50% + Pendamping Lapangan 50%), sedangkan halaman Pedoman Magang publik masih menyebut 3 komponen (pembekalan, pelaksanaan, pelaporan). CATATAN-FORMAT-MAGANG-BARU.txt juga menandai bobot ini untuk dikonfirmasi ke Kaprodi. Putuskan satu aturan, lalu samakan halaman pedoman dan SOP ini.',
    'Pedoman publik menyebut Kaprodi menginput nilai Pendamping Lapangan, sedangkan sistem memberi akses input kepada admin. Tetapkan siapa pelaksananya.',
    'Apakah unggah laporan baru terbuka setelah logbook terkunci (pedoman) atau tidak dibatasi lagi (sistem terbaru).',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
