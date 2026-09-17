// helpers/lkpsTabelConfig.js
//
// Konfigurasi 7 "Tabel" data pendukung LKPS (Lembar Kinerja Program Studi)
// LAM Teknik - Perpanjangan AVP 2025, diambil dari struktur kolom asli file
// Excel yang diberikan pengguna (sheet "Tabel 1" s/d "Tabel 7").
//
// Setiap tabel di sini disajikan sebagai daftar baris yang bisa
// ditambah/diedit/dihapus lewat web (bukan re-upload Excel), lalu bisa
// diekspor lagi ke CSV kapan saja dari halaman rekap. Field per kolom
// mengikuti header resmi di Excel; pilihan dropdown (select) diambil dari
// data-validation list yang ada di file Excel tersebut.
//
// Tabel 7 (Masa Studi Lulusan) strukturnya beda - bukan daftar baris bebas,
// tapi form tetap 2 baris (kohort TS-1 dan TS), jadi ditandai fixedRows.

const TABEL_CONFIG = {
  tabel1: {
    key: 'tabel1',
    judul: 'Tabel 1. Kurikulum dan Rencana Pembelajaran',
    deskripsi: 'Daftar mata kuliah pada kurikulum program studi yang diakreditasi beserta bobot sks dan ketersediaan RPS.',
    collection: 'akreditasi_tabel1',
    kolom: [
      { key: 'semester', label: 'Semester', type: 'number' },
      { key: 'kodeMk', label: 'Kode MK', type: 'text' },
      { key: 'namaMk', label: 'Nama Mata Kuliah', type: 'text', lebar: true },
      { key: 'mkKompetensi', label: 'MK Kompetensi Inti?', type: 'checkbox' },
      { key: 'bobotKuliah', label: 'SKS Kuliah/Responsi/Tutorial', type: 'number' },
      { key: 'bobotSeminar', label: 'SKS Seminar', type: 'number' },
      { key: 'konversiJam', label: 'Konversi ke Jam', type: 'number' },
      { key: 'dokumenRps', label: 'Dokumen RPS', type: 'select', options: ['Ada', 'Tidak Ada'] },
      { key: 'unitPenyelenggara', label: 'Unit Penyelenggara', type: 'select', options: ['Universitas', 'Fakultas', 'Prodi'] }
    ]
  },
  tabel2: {
    key: 'tabel2',
    judul: 'Tabel 2. Mata Kuliah Basic Science dan Matematika',
    deskripsi: 'Khusus untuk program Sarjana/Sarjana Terapan - daftar mata kuliah dasar sains & matematika dalam kurikulum.',
    collection: 'akreditasi_tabel2',
    kolom: [
      { key: 'namaMk', label: 'Nama Mata Kuliah', type: 'text', lebar: true },
      { key: 'semester', label: 'Semester', type: 'number' },
      { key: 'jumlahSks', label: 'Jumlah SKS', type: 'number' }
    ]
  },
  tabel3: {
    key: 'tabel3',
    judul: 'Tabel 3. Capstone Design dalam Proses Pembelajaran',
    deskripsi: 'Mata kuliah pendukung dan mata kuliah capstone design (proyek rekayasa penciri prodi).',
    collection: 'akreditasi_tabel3',
    kolom: [
      { key: 'namaMkPendukung', label: 'MK Pendukung Capstone', type: 'text', lebar: true },
      { key: 'sksPendukung', label: 'SKS MK Pendukung', type: 'number' },
      { key: 'namaMkCapstone', label: 'MK Capstone Design', type: 'text', lebar: true },
      { key: 'sksCapstone', label: 'SKS MK Capstone', type: 'number' },
      { key: 'semester', label: 'Semester', type: 'number' },
      { key: 'cakupanBahasan', label: 'Cakupan Bahasan', type: 'textarea' }
    ]
  },
  tabel4a: {
    key: 'tabel4a',
    judul: 'Tabel 4.a. Penelitian DTPS',
    deskripsi: 'Jumlah judul penelitian Dosen Tetap Program Studi (DTPS) 3 tahun terakhir (TS-2, TS-1, TS), dan yang sesuai VMTS.',
    collection: 'akreditasi_tabel4a',
    kolom: [
      { key: 'sumberPembiayaan', label: 'Sumber Pembiayaan', type: 'select', options: ['Perguruan Tinggi', 'Mandiri', 'Lembaga dalam negeri (diluar PT)', 'Lembaga luar negeri'] },
      { key: 'judulTS2', label: 'Jumlah Judul TS-2', type: 'number' },
      { key: 'judulTS1', label: 'Jumlah Judul TS-1', type: 'number' },
      { key: 'judulTS', label: 'Jumlah Judul TS', type: 'number' },
      { key: 'vmtsTS2', label: 'Sesuai VMTS TS-2', type: 'number' },
      { key: 'vmtsTS1', label: 'Sesuai VMTS TS-1', type: 'number' },
      { key: 'vmtsTS', label: 'Sesuai VMTS TS', type: 'number' }
    ]
  },
  tabel4b: {
    key: 'tabel4b',
    judul: 'Tabel 4.b. Pengabdian kepada Masyarakat (PkM) DTPS',
    deskripsi: 'Jumlah judul PkM Dosen Tetap Program Studi (DTPS) 3 tahun terakhir (TS-2, TS-1, TS), dan yang sesuai VMTS.',
    collection: 'akreditasi_tabel4b',
    kolom: [
      { key: 'sumberPembiayaan', label: 'Sumber Pembiayaan', type: 'select', options: ['Perguruan Tinggi', 'Mandiri', 'Lembaga dalam negeri (diluar PT)', 'Lembaga luar negeri'] },
      { key: 'judulTS2', label: 'Jumlah Judul TS-2', type: 'number' },
      { key: 'judulTS1', label: 'Jumlah Judul TS-1', type: 'number' },
      { key: 'judulTS', label: 'Jumlah Judul TS', type: 'number' },
      { key: 'vmtsTS2', label: 'Sesuai VMTS TS-2', type: 'number' },
      { key: 'vmtsTS1', label: 'Sesuai VMTS TS-1', type: 'number' },
      { key: 'vmtsTS', label: 'Sesuai VMTS TS', type: 'number' }
    ]
  },
  tabel5: {
    key: 'tabel5',
    judul: 'Tabel 5. Profil Dosen',
    deskripsi: 'Profil lengkap dosen tetap/tidak tetap/industri program studi: pendidikan, jabatan akademik, sertifikasi, dan MK yang diampu.',
    collection: 'akreditasi_tabel5',
    kolom: [
      { key: 'namaDosen', label: 'Nama Dosen', type: 'text', lebar: true },
      { key: 'nidn', label: 'NIDN/NIDK/NUPTK', type: 'text' },
      { key: 'kategoriDosen', label: 'Kategori Dosen', type: 'select', options: ['Dosen Tetap', 'Dosen Tidak Tetap', 'Dosen Industri'] },
      { key: 'homebasePddikti', label: 'Homebase PDDikti Sesuai?', type: 'checkbox' },
      { key: 'pendidikanSarjana', label: 'Prodi S1/D4 Asal', type: 'text' },
      { key: 'pendidikanMagister', label: 'Prodi S2 Asal', type: 'text' },
      { key: 'pendidikanDoktor', label: 'Prodi S3 Asal', type: 'text' },
      { key: 'bidangKeahlian', label: 'Bidang Keahlian', type: 'text', lebar: true },
      { key: 'perusahaanIndustri', label: 'Perusahaan/Industri (Dosen Industri)', type: 'text' },
      { key: 'kesesuaianKompetensi', label: 'Sesuai Kompetensi Inti PS?', type: 'checkbox' },
      { key: 'jabatanAkademik', label: 'Jabatan Akademik', type: 'select', options: ['Tenaga Pengajar', 'Asisten Ahli', 'Lektor', 'Lektor Kepala', 'Guru Besar'] },
      { key: 'nomorSertifikatPendidik', label: 'No. Sertifikat Pendidik Profesional', type: 'text' },
      { key: 'sertifikatKompetensiBidang', label: 'Bidang Sertifikat Kompetensi/Profesi/Industri', type: 'text' },
      { key: 'sertifikatKompetensiLembaga', label: 'Lembaga Penerbit Sertifikat', type: 'text' },
      { key: 'sertifikatKeinsinyuran', label: 'Sertifikat Keinsinyuran', type: 'select', options: ['', 'IPM', 'IPU'] },
      { key: 'mkDiampu', label: 'MK yang Diampu di PS Ini', type: 'textarea' },
      { key: 'kesesuaianBidangMk', label: 'Bidang Keahlian Sesuai MK Diampu?', type: 'checkbox' },
      { key: 'mkDiampuProdiLain', label: 'MK yang Diampu di Prodi Lain', type: 'textarea' }
    ]
  },
  tabel6: {
    key: 'tabel6',
    judul: 'Tabel 6. Prasarana dan Peralatan Utama',
    deskripsi: 'Prasarana (ruang kelas/lab) dan sarana/alat/peraga utama di UPPS yang digunakan program studi.',
    collection: 'akreditasi_tabel6',
    kolom: [
      { key: 'namaPrasarana', label: 'Nama Prasarana', type: 'text', lebar: true },
      { key: 'jumlahPrasarana', label: 'Jumlah Prasarana', type: 'number' },
      { key: 'namaSarana', label: 'Nama Sarana/Alat/Peraga', type: 'text', lebar: true },
      { key: 'jumlahAlat', label: 'Jumlah Alat', type: 'number' },
      { key: 'kepemilikan', label: 'Kepemilikan', type: 'text' },
      { key: 'kondisi', label: 'Kondisi', type: 'text' },
      { key: 'logbook', label: 'Ada Logbook Penggunaan?', type: 'checkbox' },
      { key: 'rataWaktu', label: 'Rata-rata Penggunaan (Jam/Minggu)', type: 'number' }
    ]
  }
};

/** Field konfigurasi khusus Tabel 7 (fixed 2 baris: TS-1 dan TS). */
const TABEL7_CONFIG = {
  key: 'tabel7',
  judul: 'Tabel 7. Masa Studi Lulusan',
  deskripsi: 'Jumlah mahasiswa masuk dan lulus tepat waktu, per kohort tahun masuk (TS-1 dan TS).',
  collection: 'akreditasi_tabel7',
  baris: ['TS-1', 'TS'],
  kolom: [
    { key: 'jumlahMasuk', label: 'Jumlah Mahasiswa Masuk', type: 'number' },
    { key: 'lulusMs05', label: 'Lulus, MS \u2264 0,5 Tahun Lebih Cepat', type: 'number' },
    { key: 'lulusMs15', label: 'Lulus, 0,5 < MS \u2264 1,5', type: 'number' },
    { key: 'lulusMs2', label: 'Lulus, 1,5 < MS \u2264 2', type: 'number' }
  ]
};

function getTabelConfig(tableKey) {
  return TABEL_CONFIG[tableKey] || null;
}

function getSemuaTabelConfig() {
  return Object.values(TABEL_CONFIG);
}

module.exports = { TABEL_CONFIG, TABEL7_CONFIG, getTabelConfig, getSemuaTabelConfig };
