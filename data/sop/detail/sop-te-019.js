// data/sop/detail/sop-te-019.js - SOP K3, Penanganan Kecelakaan, dan Pengelolaan Limbah Elektronik
// Sumber: catatan K3 pada data/modulPraktikumData.js, formulir inspeksi instalasi listrik (views/mahasiswa/inspeksi/form.ejs).
// CATATAN: sistem belum memiliki catatan insiden, sarana K3, atau limbah. Langkah-langkah berikut adalah PROSEDUR BARU
// yang perlu divalidasi pihak kompeten K3 sebelum disahkan. Angka waktu bertanda (u) = USULAN.
module.exports = {
  kode: 'SOP-TE-019',
  judul: 'K3, Penanganan Kecelakaan, dan Pengelolaan Limbah Elektronik',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur keselamatan dan kesehatan kerja (K3) pada laboratorium, praktikum, dan kegiatan lapangan, termasuk penanganan kecelakaan dan pengelolaan limbah elektronik.',
    'Mencegah kecelakaan, memastikan respons yang cepat dan terdokumentasi, serta mengelola limbah elektronik secara bertanggung jawab.'
  ],
  ruangLingkup: [
    'Berlaku untuk dosen, teknisi, dan mahasiswa yang berkegiatan di laboratorium dan praktikum Program Studi D3 Teknik Elektronika.',
    'Berlaku juga untuk kegiatan lapangan prodi bersama masyarakat (mis. inspeksi instalasi listrik dan layanan servis alat elektronik rumah tangga).',
    'K3 di tempat magang mengikuti ketentuan IDUKA dan dipantau melalui SOP-TE-021.'
  ],
  dasarHukum: [
    'Ketentuan K3 dan pengelolaan limbah yang berlaku di Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Instrumen akreditasi LAM Teknik (aspek sarana prasarana dan K3L). [KONFIRMASI: butir yang berlaku]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'K3', arti: 'Keselamatan dan Kesehatan Kerja: upaya mencegah kecelakaan dan gangguan kesehatan pada kegiatan praktik.' },
    { istilah: 'Catatan K3 pada LKM', arti: 'Peringatan keselamatan yang tertulis pada setiap modul praktikum (mis. matikan catu daya sebelum mengubah rangkaian dan periksa polaritas sebelum menyalakan).' },
    { istilah: 'APD', arti: 'Alat pelindung diri yang dipakai sesuai risiko kegiatan.' },
    { istilah: 'Insiden dan nyaris celaka', arti: 'Kejadian yang mengakibatkan cedera atau kerusakan, atau hampir mengakibatkannya.' },
    { istilah: 'Limbah elektronik', arti: 'Sisa komponen, papan rangkaian, kabel, baterai, dan perangkat rusak dari kegiatan laboratorium.' }
  ],
  pihak: [
    { peran: 'Koordinator laboratorium', tanggungJawab: 'Menjaga sarana K3, memeriksa kelayakan lab dan alat, menerima laporan insiden, dan mengelola limbah.' },
    { peran: 'Dosen pengampu dan teknisi', tanggungJawab: 'Memberi pengarahan K3, mengawasi praktikum, dan melaporkan insiden.' },
    { peran: 'Mahasiswa', tanggungJawab: 'Mematuhi aturan K3, memakai APD, dan segera melapor bila terjadi insiden atau kondisi berbahaya.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menetapkan kebijakan K3 prodi, menindaklanjuti laporan insiden, dan mengoordinasikan dengan unit K3 institusi.' }
  ],
  persyaratan: [
    'Sarana K3 tersedia dan layak: alat pemadam api ringan, kotak P3K, rambu, jalur evakuasi, dan pemutus listrik utama.',
    'Dosen dan teknisi memahami prosedur darurat dan pertolongan pertama.',
    'Mahasiswa telah mengikuti pengarahan K3 sebelum praktikum pertama.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Mengidentifikasi bahaya laboratorium (listrik, solder dan panas, bahan kimia pengetsaan, bagian bergerak, kebakaran) dan menilai risiko tiap jenis praktikum; menetapkan pengendalian dan APD.', pelaksana: 'Koordinator laboratorium / Dosen pengampu', waktu: 'Awal semester (u)', output: 'Daftar bahaya dan pengendalian' },
    { no: 2, kegiatan: 'Memeriksa dan memelihara sarana K3 (alat pemadam, P3K, rambu, jalur evakuasi, pemutus listrik, grounding) dan mencatat hasil pemeriksaan.', pelaksana: 'Koordinator laboratorium', waktu: 'Bulanan (u)', output: 'Catatan pemeriksaan sarana K3' },
    { no: 3, kegiatan: 'Memberi pengarahan K3 sebelum praktikum dengan memakai catatan K3 pada modul LKM dan aturan umum laboratorium, serta mencatat kehadiran peserta.', pelaksana: 'Dosen pengampu / Teknisi', waktu: 'Setiap awal praktikum', output: 'Catatan pengarahan K3' },
    { no: 4, kegiatan: 'Melaksanakan praktikum sesuai aturan K3 dengan APD yang ditetapkan; dosen atau teknisi mengawasi dan menghentikan kegiatan yang berbahaya.', pelaksana: 'Mahasiswa / Dosen pengampu / Teknisi', waktu: 'Selama praktikum', output: 'Praktikum berjalan aman' },
    { no: 5, kegiatan: 'Melaporkan segera setiap insiden atau nyaris celaka kepada dosen atau teknisi, memberi pertolongan pertama sesuai pelatihan, dan menghubungi layanan medis bila diperlukan.', pelaksana: 'Mahasiswa / Dosen / Teknisi', waktu: 'Seketika', output: 'Laporan awal; pertolongan pertama' },
    { no: 6, kegiatan: 'Menangani kecelakaan listrik dengan memutus sumber listrik lebih dahulu sebelum menolong korban, lalu mengikuti prosedur darurat yang divalidasi pihak K3. [KONFIRMASI: prosedur rinci]', pelaksana: 'Dosen / Teknisi', waktu: 'Seketika', output: 'Korban tertangani' },
    { no: 7, kegiatan: 'Mencatat insiden pada formulir laporan (waktu, tempat, kronologi, korban, tindakan) dan melaporkannya kepada Koordinator laboratorium dan Ketua Program Studi.', pelaksana: 'Dosen / Teknisi', waktu: '1 hari kerja (u)', output: 'Formulir laporan insiden' },
    { no: 8, kegiatan: 'Menyelidiki penyebab insiden, menetapkan tindakan korektif, dan memeriksa pelaksanaannya.', pelaksana: 'Koordinator laboratorium / Ketua Program Studi', waktu: '7 hari kerja (u)', output: 'Laporan investigasi; tindakan korektif' },
    { no: 9, kegiatan: 'Mengelola limbah elektronik: memilah (baterai, papan rangkaian, komponen, kabel), menyimpan sementara di wadah berlabel, mencatat jumlahnya, dan menyerahkannya kepada pengelola limbah berizin. [KONFIRMASI: pengelola]', pelaksana: 'Koordinator laboratorium / Teknisi', waktu: 'Penyerahan tiap semester (u)', output: 'Catatan limbah; bukti penyerahan' },
    { no: 10, kegiatan: 'Menerapkan K3 pada kegiatan lapangan: pengarahan sebelum berangkat, APD, alat ukur dalam kondisi layak, dan pendampingan dosen; pada inspeksi instalasi listrik mengikuti formulir inspeksi, termasuk acuan tegangan 198 sampai 242 volt (220 V plus minus 10 persen).', pelaksana: 'Dosen pendamping / Mahasiswa', waktu: 'Setiap kegiatan lapangan', output: 'Catatan pengarahan; formulir inspeksi' },
    { no: 11, kegiatan: 'Mengevaluasi K3 tiap semester: rekap insiden dan nyaris celaka, hasil pemeriksaan sarana, dan kebutuhan pelatihan; menetapkan perbaikan.', pelaksana: 'Koordinator laboratorium / Tim Penjaminan Mutu', waktu: 'Akhir semester', output: 'Laporan evaluasi K3' }
  ],
  kasusKhusus: [
    { kasus: 'Kebakaran kecil di laboratorium', penanganan: 'Putuskan listrik bila aman, gunakan alat pemadam sesuai pelatihan, evakuasi bila tidak terkendali, dan hubungi bantuan darurat.' },
    { kasus: 'Sengatan listrik', penanganan: 'Putuskan sumber listrik sebelum menyentuh korban, panggil bantuan medis, dan laporkan sebagai insiden.' },
    { kasus: 'Luka bakar akibat solder atau komponen panas', penanganan: 'Beri pertolongan pertama sesuai pelatihan P3K, rujuk medis bila perlu, dan catat insiden.' },
    { kasus: 'Alat atau instalasi tidak layak dan berbahaya', penanganan: 'Dihentikan pemakaiannya, diberi tanda tidak layak pakai, dan dilaporkan untuk perbaikan (SOP-TE-017).' },
    { kasus: 'Mahasiswa sakit saat praktikum', penanganan: 'Dihentikan dari kegiatan, ditemani, dan dibantu mendapat penanganan; tindak lanjut dicatat.' }
  ],
  formulir: [
    'Catatan pengarahan K3 tiap praktikum',
    'Formulir laporan insiden dan nyaris celaka',
    'Catatan pemeriksaan sarana K3',
    'Catatan limbah elektronik dan bukti penyerahan',
    'Formulir inspeksi instalasi listrik (kegiatan lapangan)'
  ],
  lampiran: [],
  konfirmasi: [
    'PENTING - Sistem belum memiliki catatan insiden, pemeriksaan sarana K3, atau pengelolaan limbah. Langkah 1 sampai 9 dan 11 adalah prosedur baru yang saya rumuskan; validasi dengan pihak kompeten K3 (unit K3 institusi atau ahli K3) sebelum disahkan, terutama langkah 6 (kecelakaan listrik).',
    'Ketersediaan dan kondisi alat pemadam, P3K, APD, rambu, dan jalur evakuasi di laboratorium tidak tercatat pada inventaris yang saya baca; lakukan pendataan.',
    'Pengelola limbah elektronik berizin dan tata cara penyerahannya.',
    'Unit K3 di institusi, pelatihan K3 bagi dosen dan teknisi, serta asuransi atau penanganan medis mahasiswa saat praktik.',
    'Catatan K3 pada LKM baru ada pada 9 jenis mata kuliah praktik; mata kuliah praktik lain perlu dilengkapi.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
