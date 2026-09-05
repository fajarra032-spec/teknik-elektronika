/**
 * helpers/biodataHelper.js
 *
 * Daftar TUNGGAL field "Biodata Lengkap" mahasiswa (di luar field akademik
 * yang dikelola admin seperti semester/status/kelas/konsentrasi) + fungsi
 * untuk mengecek kelengkapannya. Dipakai bersama oleh:
 * - middleware/auth.js (gate: paksa mahasiswa lengkapi biodata dulu sebelum
 *   bisa akses menu lain, lihat requireBiodataLengkap di bawah)
 * - routes/mahasiswa/biodata.js + views/mahasiswa/biodata/* (form isi/edit
 *   biodata sendiri oleh mahasiswa)
 * - routes/admin/mahasiswa.js + views/admin/mahasiswa_list.ejs /
 *   mahasiswa_detail.ejs (supaya admin bisa lihat status & isi biodata
 *   lengkap tiap mahasiswa)
 *
 * PENTING: field `agama` SUDAH ADA sebelumnya (lihat paketKurikulumHelper.js
 * - dipakai untuk memilih otomatis mata kuliah Pendidikan Agama semester 1).
 * Field itu ditaruh juga di sini (grup "pribadi") supaya mahasiswa bisa
 * mengoreksi sendiri kalau default/isian admin salah - BUKAN field baru.
 *
 * Untuk menambah/mengubah field biodata di masa depan, cukup ubah array
 * BIODATA_FIELDS di bawah - form, gate, dan tampilan admin otomatis ikut
 * berubah karena semuanya membaca dari sini (tidak ada daftar field yang
 * di-duplikasi di tempat lain).
 */

const { AGAMA_OPTIONS } = require('./paketKurikulumHelper');

const JENIS_KELAMIN_OPTIONS = ['Laki-laki', 'Perempuan'];

// group: 'pribadi' | 'alamat' | 'ortu' | 'sekolah'
// wajib: true kalau field ini WAJIB diisi supaya biodata dianggap "lengkap"
//   (menentukan lolos/tidaknya gate requireBiodataLengkap)
const BIODATA_FIELDS = [
  // ---- Data Pribadi ----
  { key: 'nik', label: 'NIK (KTP)', group: 'pribadi', wajib: true, type: 'text',
    hint: '16 digit sesuai KTP' },
  { key: 'tempatLahir', label: 'Tempat Lahir', group: 'pribadi', wajib: true, type: 'text' },
  { key: 'tanggalLahir', label: 'Tanggal Lahir', group: 'pribadi', wajib: true, type: 'date' },
  { key: 'jenisKelamin', label: 'Jenis Kelamin', group: 'pribadi', wajib: true, type: 'select', options: JENIS_KELAMIN_OPTIONS },
  { key: 'agama', label: 'Agama', group: 'pribadi', wajib: true, type: 'select', options: AGAMA_OPTIONS,
    hint: 'Menentukan mata kuliah Pendidikan Agama semester 1' },
  { key: 'noHp', label: 'No. HP/WhatsApp', group: 'pribadi', wajib: true, type: 'text' },

  // ---- Alamat Domisili ----
  { key: 'alamatJalan', label: 'Alamat (Jalan/Dusun, No. Rumah)', group: 'alamat', wajib: true, type: 'text' },
  { key: 'alamatRtRw', label: 'RT/RW', group: 'alamat', wajib: false, type: 'text', hint: 'contoh: 001/002' },
  { key: 'alamatKelurahan', label: 'Kelurahan/Desa', group: 'alamat', wajib: true, type: 'text' },
  { key: 'alamatKecamatan', label: 'Kecamatan', group: 'alamat', wajib: true, type: 'text' },
  { key: 'alamatKabupaten', label: 'Kabupaten/Kota', group: 'alamat', wajib: true, type: 'text' },
  { key: 'alamatProvinsi', label: 'Provinsi', group: 'alamat', wajib: true, type: 'text' },
  { key: 'alamatKodePos', label: 'Kode Pos', group: 'alamat', wajib: false, type: 'text' },

  // ---- Data Orang Tua/Wali ----
  { key: 'namaAyah', label: 'Nama Ayah', group: 'ortu', wajib: true, type: 'text' },
  { key: 'pekerjaanAyah', label: 'Pekerjaan Ayah', group: 'ortu', wajib: true, type: 'text' },
  { key: 'namaIbu', label: 'Nama Ibu', group: 'ortu', wajib: true, type: 'text' },
  { key: 'pekerjaanIbu', label: 'Pekerjaan Ibu', group: 'ortu', wajib: true, type: 'text' },
  { key: 'noHpOrtu', label: 'No. HP Orang Tua/Wali', group: 'ortu', wajib: true, type: 'text' },

  // ---- Data Asal Sekolah ----
  { key: 'nisn', label: 'NISN', group: 'sekolah', wajib: true, type: 'text' },
  { key: 'asalSekolah', label: 'Asal Sekolah (SMA/SMK/MA)', group: 'sekolah', wajib: true, type: 'text' },
  { key: 'jurusanSekolah', label: 'Jurusan di Sekolah Asal', group: 'sekolah', wajib: true, type: 'text' },
  { key: 'tahunLulusSekolah', label: 'Tahun Lulus Sekolah', group: 'sekolah', wajib: true, type: 'text' },
];

const GROUP_LABELS = {
  pribadi: 'Data Pribadi',
  alamat: 'Alamat Domisili',
  ortu: 'Data Orang Tua/Wali',
  sekolah: 'Data Asal Sekolah'
};

const FIELD_KEYS_WAJIB = BIODATA_FIELDS.filter(f => f.wajib).map(f => f.key);

/**
 * Cek format NIK: harus persis 16 digit angka. Return true kalau kosong
 * (validasi "kosong/tidak" ditangani terpisah di getBiodataKosong) supaya
 * fungsi ini murni soal FORMAT.
 */
function isNikFormatValid(nik) {
  if (!nik) return true;
  return /^\d{16}$/.test(String(nik).trim());
}

/**
 * Daftar label field yang masih kosong/belum valid untuk data mahasiswa
 * (dari collection `users`) yang diberikan. Array kosong = biodata lengkap.
 */
function getBiodataKosong(userData) {
  const data = userData || {};
  const kosong = [];

  for (const field of BIODATA_FIELDS) {
    if (!field.wajib) continue;
    const value = data[field.key];
    if (value === undefined || value === null || String(value).trim() === '') {
      kosong.push(field.label);
    }
  }

  if (data.nik && !isNikFormatValid(data.nik)) {
    kosong.push('NIK (formatnya harus 16 digit angka)');
  }

  return kosong;
}

/**
 * True kalau semua field wajib di BIODATA_FIELDS sudah terisi (dan NIK,
 * kalau diisi, formatnya valid).
 */
function isBiodataLengkap(userData) {
  return getBiodataKosong(userData).length === 0;
}

module.exports = {
  BIODATA_FIELDS,
  GROUP_LABELS,
  JENIS_KELAMIN_OPTIONS,
  FIELD_KEYS_WAJIB,
  isNikFormatValid,
  getBiodataKosong,
  isBiodataLengkap
};
