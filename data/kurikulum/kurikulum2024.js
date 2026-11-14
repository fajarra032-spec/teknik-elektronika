// data/kurikulum/kurikulum2024.js
//
// DATA HARDCODED dari dokumen "Kurikulum Teknik Elektronika Tahun 2024, Politeknik Dewantara"
// (SK Direktur No. 1182/D/Polidewa/VIII/2024, 18 Agustus 2024). Dipakai oleh workspace akreditasi
// (halaman Dokumen Kurikulum, Master Dokumen, isi otomatis Tabel 1). Jika kurikulum direvisi,
// cukup ubah file ini. Matriks CPL ditulis sebagai daftar kode MK yang bertanda centang (v) pada
// Tabel 11-15 dokumen asli.

const identitas = {
  unitPengelola: 'Politeknik Dewantara', jenjang: 'Diploma III (D3)', namaProdi: 'Teknik Elektronika',
  gelar: 'A.Md.T. (Ahli Madya Teknik)', alamat: 'Jl. K.H. Ahmad Razak Lr. 2 No. 7, Kel. Binturu, Kec. Wara Selatan, Kota Palopo, Sulawesi Selatan 91911',
  telepon: '081239108105', email: 'elektronika@polidewa.ac.id', website: 'polidewa.ac.id',
  skPendirianPT: '334/D/OT/2023', tglSkPendirianPT: '30 November 2023',
  skPembukaanPS: '', tglSkPembukaanPS: '', akreditasi: 'Baik', skAkreditasi: '', masaBerlakuAkreditasi: '',
  skKurikulum: '1182/D/Polidewa/VIII/2024', tglSkKurikulum: '18 Agustus 2024',
  totalSks: 120, totalSemester: 6, pendekatan: 'Outcome-Based Education (OBE)'
};

const visi = 'Menjadi program studi yang unggul dan inovatif dalam bidang teknik elektronika terapan yang adaptif terhadap perkembangan teknologi, kebutuhan industri, dan kearifan lokal pada tahun 2030.';

const cpl = [
  { kode: 'CPL-1', ringkas: 'Konsep matematika teknik, fisika terapan, dan dasar elektro-elektronika untuk analisis masalah teknis sederhana.' },
  { kode: 'CPL-2', ringkas: 'Membaca, memahami, dan mendokumentasikan komponen, skema, diagram kelistrikan, gambar teknik; memakai perangkat lunak teknik dan peralatan lab.' },
  { kode: 'CPL-3', ringkas: 'Mengidentifikasi, menganalisis, dan memperbaiki kerusakan perangkat elektronika, instrumentasi, kelistrikan/otomasi (termasuk PLC) dengan K3.' },
  { kode: 'CPL-4', ringkas: 'Merancang dan mengimplementasikan sistem elektronika sederhana (mikrokontroler, PLC, atau rangkaian diskrit), serta menguji dan mengevaluasinya.' },
  { kode: 'CPL-5', ringkas: 'Berkomunikasi lisan/tulisan, menyusun laporan teknis, bekerja sama dalam tim, dan merencanakan-mengevaluasi tugas dengan etika profesi.' },
  { kode: 'CPL-6', ringkas: 'Mengakses dan memanfaatkan sumber belajar untuk pengembangan diri mandiri dan berkelanjutan, adaptif terhadap teknologi dan kebutuhan industri.' }
];

const profilLulusan = ['Teknisi Elektronika-Listrik Terpadu', 'Praktisi Instrumentasi dan Kendali Industri', 'Teknisi Pemeliharaan Perangkat Elektronik', 'Wirausaha Bidang Elektronika'];

// jenis: WUD = Wajib Umum, PD = Penciri Dewantara, PEK = Inti Keahlian, WP = Wajib Polidewa (Magang)
// teori/praktik = nilai pada kolom Teori/Praktik di dokumen (WP: praktik 20). konsentrasi: '' = semua
const MK = [
  { kode: 'WUD2201-5', nama: 'Pendidikan Agama', semester: 1, teori: 1, praktik: 1, sks: 2, jenis: 'WUD', konsentrasi: '' },
  { kode: 'WUD3208', nama: 'Bahasa Indonesia', semester: 1, teori: 1, praktik: 2, sks: 3, jenis: 'WUD', konsentrasi: '' },
  { kode: 'WUD3209', nama: 'Bahasa Inggris', semester: 1, teori: 1, praktik: 2, sks: 3, jenis: 'WUD', konsentrasi: '' },
  { kode: 'PD3201', nama: 'Etika Kerja', semester: 1, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3202', nama: 'Standardisasi', semester: 1, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3203', nama: 'Matematika Teknik', semester: 1, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3204', nama: 'Perangkat Lunak Aplikasi', semester: 1, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'WUD2206', nama: 'Pendidikan Kewarganegaraan', semester: 2, teori: 2, praktik: 0, sks: 2, jenis: 'WUD', konsentrasi: '' },
  { kode: 'PD3205', nama: 'Keselamatan dan Kesehatan Kerja (K3)', semester: 2, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3206', nama: 'Aplikasi Komputer', semester: 2, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3207', nama: 'Teknik Pengukuran', semester: 2, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3208', nama: 'Peralatan Teknik', semester: 2, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3209', nama: 'Menggambar Teknik', semester: 2, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'PD3210', nama: 'Data dan Sistem Informasi', semester: 2, teori: 1, praktik: 2, sks: 3, jenis: 'PD', konsentrasi: '' },
  { kode: 'WUD2207', nama: 'Pendidikan Pancasila', semester: 3, teori: 2, praktik: 0, sks: 2, jenis: 'WUD', konsentrasi: '' },
  { kode: 'PEK3201', nama: 'Dasar Sistem Tenaga Listrik', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Instrumentasi' },
  { kode: 'PEK3202', nama: 'Elektronika Digital', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Instrumentasi' },
  { kode: 'PEK3203', nama: 'Mikrokontroler', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Instrumentasi' },
  { kode: 'PEK3204', nama: 'Rangkaian Elektronika', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Instrumentasi' },
  { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: '' },
  { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: '' },
  { kode: 'PEK3207', nama: 'Komunikasi Data dan Jaringan', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Telekomunikasi' },
  { kode: 'PEK3208', nama: 'Elektronika Digital', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Telekomunikasi' },
  { kode: 'PEK3209', nama: 'Antena dan Propagasi', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Telekomunikasi' },
  { kode: 'PEK3210', nama: 'Keamanan Siber', semester: 3, teori: 1, praktik: 2, sks: 3, jenis: 'PEK', konsentrasi: 'Telekomunikasi' },
  { kode: 'WP2021', nama: 'Praktik Dunia Kerja I', semester: 4, teori: 0, praktik: 20, sks: 20, jenis: 'WP', konsentrasi: '' },
  { kode: 'WP2022', nama: 'Praktik Dunia Kerja II', semester: 5, teori: 0, praktik: 20, sks: 20, jenis: 'WP', konsentrasi: '' },
  { kode: 'WP2023', nama: 'Praktik Dunia Kerja III', semester: 6, teori: 0, praktik: 20, sks: 20, jenis: 'WP', konsentrasi: '' }
];

const JENIS = { WUD: 'Wajib Umum', PD: 'Penciri Dewantara', PEK: 'Inti Keahlian', WP: 'Wajib Polidewa (Magang)' };
const KONSENTRASI = ['Instrumentasi', 'Telekomunikasi'];

// Matriks CPL -> kode MK bertanda centang (Tabel 11-15 dokumen).
const MATRIKS = {
  'CPL-1': ['PD3202', 'PD3203', 'PD3204', 'PEK3201', 'PEK3202', 'PEK3203', 'PEK3204', 'PEK3207', 'PEK3208', 'PEK3209'],
  'CPL-2': ['PD3202', 'PD3204', 'PD3206', 'PD3207', 'PD3208', 'PD3209', 'PD3210',
            'PEK3201', 'PEK3202', 'PEK3203', 'PEK3204', 'PEK3205', 'PEK3206', 'PEK3207', 'PEK3208', 'PEK3209', 'PEK3210', 'WP2021', 'WP2022', 'WP2023'],
  'CPL-3': ['PD3205', 'PD3207', 'PD3208', 'PEK3201', 'PEK3202', 'PEK3203', 'PEK3204', 'PEK3205', 'PEK3206', 'PEK3208', 'PEK3210', 'WP2021', 'WP2022', 'WP2023'],
  'CPL-4': ['PEK3202', 'PEK3203', 'PEK3204', 'PEK3206', 'PEK3208', 'WP2022', 'WP2023'],
  'CPL-5': ['WUD2201-5', 'WUD2206', 'WUD2207', 'WUD3208', 'WUD3209', 'PD3201', 'PD3202', 'WP2021', 'WP2022', 'WP2023'],
  'CPL-6': ['WUD3208', 'WUD3209', 'PD3202', 'PD3206', 'PD3210', 'WP2021', 'WP2022', 'WP2023']
};

const rekognisiPdk = [
  { kegiatan: 'Magang I', semester: 4, sks: 20, fokus: 'Observasi lingkungan kerja dan proses operasional' },
  { kegiatan: 'Magang II', semester: 5, sks: 20, fokus: 'Keterlibatan aktif, diagnosis, dan perbaikan sederhana' },
  { kegiatan: 'Magang III', semester: 6, sks: 20, fokus: 'Proyek mandiri, laporan akhir, dan seminar magang' }
];
const penilaianMagang = [
  { komponen: 'Laporan Harian', bobot: 15, indikator: 'Ketepatan waktu, kelengkapan catatan kegiatan, dan kualitas observasi' },
  { komponen: 'Laporan Akhir Magang', bobot: 25, indikator: 'Sistematika penulisan, kelengkapan data, analisis, kesimpulan, dan kerapian' },
  { komponen: 'Penilaian Pembimbing Industri', bobot: 30, indikator: 'Kedisiplinan, tanggung jawab, keterampilan teknis, etika kerja, dan kerja sama' },
  { komponen: 'Presentasi Seminar Magang', bobot: 30, indikator: 'Kualitas presentasi, penguasaan materi, kemampuan menjawab pertanyaan, dan sikap' }
];
const penilaianUmum = [
  { komponen: 'Sikap, kehadiran, dan keaktifan', bobot: '10-20%' },
  { komponen: 'Tugas dan praktikum (formatif)', bobot: '20-30%' },
  { komponen: 'Ujian Tengah Semester (UTS)', bobot: '20-25%' },
  { komponen: 'Ujian Akhir Semester (UAS) / Proyek Akhir', bobot: '25-35%' }
];

const deskripsiMk = {
  'WUD2201-5': 'Menginternalisasi nilai keagamaan, beriman dan bertakwa kepada Tuhan Yang Maha Esa, serta menerapkan ajaran agama dalam kehidupan bermasyarakat, berbangsa, dan bernegara.',
  'WUD2206': 'Memahami hubungan warga negara dengan negara dan pendidikan pendahuluan bela negara.',
  'WUD2207': 'Memahami tindakan cerdas dan bertanggung jawab dalam kehidupan bermasyarakat, berbangsa, dan bernegara berdasarkan nilai-nilai Pancasila.',
  'WUD3208': 'Terampil menggunakan Bahasa Indonesia keilmuan dan menyusun karya ilmiah sesuai kaidah akademik.',
  'WUD3209': 'Menerapkan komunikasi dasar bahasa Inggris, memahami bacaan sesuai bidang keahlian, dan menguasai kosakata teknis secara mandiri.',
  'PD3201': 'Memahami etika, moral, dan tanggung jawab profesi teknik serta menerapkannya dalam perilaku kerja profesional.',
  'PD3202': 'Memahami tujuan standar, organisasi standardisasi, SNI, akreditasi, sertifikasi, serta standardisasi komponen dan jasa teknik elektronika.',
  'PD3203': 'Memahami dan menerapkan konsep integral serta persamaan diferensial dasar pada bidang teknik elektronika.',
  'PD3204': 'Memahami penggunaan perangkat lunak teknik, simulasi, desain, pengolahan data, dan aplikasi pendukung pekerjaan elektronika.',
  'PD3205': 'Memahami filosofi, prinsip, dan penerapan K3 di laboratorium dan lingkungan kerja teknik elektronika.',
  'PD3206': 'Menggunakan aplikasi perkantoran, pengolahan data, grafik, presentasi, dan aplikasi komputer dasar untuk kebutuhan akademik dan teknis.',
  'PD3207': 'Menggunakan alat ukur elektronika dan melakukan pengukuran besaran listrik maupun nonlistrik secara benar.',
  'PD3208': 'Memahami penggunaan alat-alat dasar teknik elektronika dan mengembangkan keterampilan psikomotorik dengan perangkat teknik.',
  'PD3209': 'Terampil menggambar skema rangkaian, diagram kelistrikan, dan layout PCB secara manual maupun dengan perangkat lunak.',
  'PD3210': 'Memahami konsep sistem informasi, tahapan pengolahan data, serta penggunaan perangkat lunak pengolah data.',
  'PEK3201': 'Memahami sistem tenaga listrik, komponen pembangkit, transmisi, distribusi, panel distribusi, serta instalasi dan pengukuran sistem 1 fasa dan 3 fasa dengan K3.',
  'PEK3202': 'Mengaplikasikan sistem bilangan, gerbang logika, flip-flop, counter, register, dan rangkaian digital sederhana.',
  'PEK3203': 'Memahami arsitektur mikrokontroler, pemrograman C/C++, integrasi sensor-aktuator, serta komunikasi data sederhana.',
  'PEK3204': 'Memahami rangkaian analog, dioda, transistor, op-amp, catu daya, penguat sederhana, pengukuran, dan troubleshooting rangkaian.',
  'PEK3205': 'Memahami perawatan perangkat elektronika, diagnosis kerusakan, perbaikan dasar, dan efisiensi waktu perawatan.',
  'PEK3206': 'Memahami otomasi industri, arsitektur PLC, pemrograman ladder diagram, timer, counter, sequencer, dan sistem kendali sederhana.',
  'PEK3207': 'Memahami komunikasi data, OSI, TCP/IP, media transmisi, encoding, modulasi, jaringan komputer, dan protokol komunikasi.',
  'PEK3208': 'Mengaplikasikan sistem bilangan, gerbang logika, flip-flop, counter, register, dan rangkaian digital sederhana.',
  'PEK3209': 'Memahami prinsip kerja antena, parameter antena, jenis antena, serta propagasi gelombang elektromagnetik.',
  'PEK3210': 'Memahami konsep keamanan siber, ancaman sistem informasi dan IoT, celah keamanan, serta perlindungan dasar.',
  'WP2021': 'Praktik kerja profesional: pengenalan lingkungan kerja, budaya perusahaan, dan pengamatan proses operasional.',
  'WP2022': 'Terlibat aktif dalam pekerjaan teknis, diagnosis kerusakan, dan perbaikan sederhana di industri.',
  'WP2023': 'Menyelesaikan proyek teknis mandiri, menyusun laporan akhir, dan mempresentasikan hasil magang.'
};

module.exports = { identitas, visi, cpl, profilLulusan, MK, JENIS, KONSENTRASI, MATRIKS, rekognisiPdk, penilaianMagang, penilaianUmum, deskripsiMk };
