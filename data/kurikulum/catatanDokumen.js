// data/kurikulum/catatanDokumen.js
// Temuan pemeriksaan Dokumen Kurikulum 2024 (PDF) untuk persiapan akreditasi. Hanya tampil untuk admin.
// tingkat: tinggi | sedang | rendah. Edit/hapus butir bila sudah diperbaiki.
module.exports = [
  { tingkat: 'tinggi', judul: 'Dasar hukum sudah dicabut',
    isi: 'Kata Pengantar, SK (Mengingat no. 4), Bab III, Bab IV, dan Lampiran 3 merujuk Permendikbudristek No. 53 Tahun 2023. Peraturan itu dicabut oleh Permendiktisaintek No. 39 Tahun 2025 (berlaku 2 September 2025). Saat SK terbit (Agustus 2024) acuan itu masih berlaku, tetapi untuk akreditasi sebaiknya dokumen direvisi atau diberi addendum yang merujuk peraturan terbaru.',
    sumber: 'peraturan.bpk.go.id/Details/265158 (status: dicabut oleh Permendikti Saintek 39/2025)' },
  { tingkat: 'tinggi', judul: 'Diktum SK menetapkan "Panduan Penyusunan Kurikulum", bukan kurikulum prodi',
    isi: 'Judul SK 1182/D/Polidewa/VIII/2024 adalah "Kurikulum Teknik Elektronika", tetapi diktum "Menetapkan - Pertama" berbunyi "Panduan Penyusunan Kurikulum Politeknik Dewantara". Asesor bisa menilai kurikulum prodi belum ditetapkan secara tegas. Selain itu ada dua diktum yang sama-sama bernomor "Kedua".' },
  { tingkat: 'sedang', judul: 'Penulisan nama Direktur berbeda',
    isi: 'Kata Pengantar: "Dr. Suaedi, M.Si."; SK: "Dr. Sueadi, S.Pd., M.Pd.". Samakan nama dan gelar.' },
  { tingkat: 'sedang', judul: 'Tahun kurikulum tidak konsisten',
    isi: 'Sampul, Kata Pengantar, dan SK menyebut 2024, sedangkan Bab IX Penutup menyebut "Tahun 2026". Halaman publik /dokumen/kurikulum di web saat ini menampilkan "2026" (variabel tahunKurikulum).' },
  { tingkat: 'sedang', judul: 'Identitas prodi belum lengkap',
    isi: 'No. dan tanggal SK Pembukaan PS, No. SK Akreditasi, dan masa berlaku akreditasi masih kosong; kolom Akreditasi berisi "Baik" tanpa nomor SK. Lengkapi sesuai SK yang sebenarnya karena data ini dipakai di LED dan LKPS.' },
  { tingkat: 'sedang', judul: 'Bobot penilaian magang berbeda dengan sistem',
    isi: 'Kurikulum (Tabel 19/21): laporan harian 15%, laporan akhir 25%, pembimbing industri 30%, seminar 30%. Sistem nilai magang di web menghitung nilai akhir dari 2 komponen (dosen pembimbing dan pendamping lapangan) dengan bobot 50:50. Putuskan satu aturan, lalu samakan di kurikulum/pedoman magang dan SOP-TE-023.' },
  { tingkat: 'rendah', judul: 'Kesalahan format dokumen',
    isi: 'Daftar Isi memuat 3 entri "Error! Bookmark not defined."; Daftar Tabel mencantumkan 18 tabel padahal badan dokumen sampai Tabel 21 dengan nomor tidak cocok; ada salah ketik "Dewantaraindustri" (hal. 12) dan karakter "s" nyasar (hal. 22).' },
  { tingkat: 'rendah', judul: 'Pertimbangan substansi matriks CPL',
    isi: 'Matriks hanya berupa centang, belum ada tingkat capaian (mis. I/R/M) maupun CPMK per mata kuliah, sehingga pengukuran CPL belum bisa ditelusuri. Pada konsentrasi Telekomunikasi, CPL-4 hanya didukung 2 MK inti (PEK3208 dan PEK3206) dan tidak ada MK Mikrokontroler, padahal Standar Kompetensi Lulusan no. 5 menyebut mikrokontroler dan PLC.' }
];
