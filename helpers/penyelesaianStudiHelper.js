/**
 * helpers/penyelesaianStudiHelper.js
 *
 * Logika bersama menu "Penyelesaian Studi" (mahasiswa yang mengajukan seminar
 * magang): format tanggal Indonesia, data pejabat penandatangan, dan penyusun
 * data berkas (formulir, surat permohonan ujian, berita acara) yang dipakai
 * BERSAMA oleh halaman cetak (EJS) dan unduhan Word (docx) - supaya isinya
 * selalu sama di kedua format.
 */

const {
  getCurrentAcademicSemester,
  getAngkatanFromNim,
  getStudentCurrentSemester
} = require('./academicHelper');

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Penandatangan: sama dengan yang dipakai surat-surat di menu Persuratan
// (views/admin/surat/*.ejs). Bisa ditimpa lewat env kalau Kaprodi berganti.
const KAPRODI = {
  nama: process.env.KAPRODI_NAMA || 'Fajar Ramadhan, S.Pd., M.T.',
  nuptk: process.env.KAPRODI_NUPTK || '8559777678130153'
};
const KOTA = 'Palopo';
const PRODI = 'Teknik Elektronika';

/**
 * Ubah 'YYYY-MM-DD' / ISO string / Date menjadi Date. 'YYYY-MM-DD' diurai
 * manual (bukan new Date(str)) supaya tidak bergeser sehari karena zona waktu.
 */
function parseTanggal(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

/** '23 Juli 2025' */
function tanggalPanjang(v) {
  const d = parseTanggal(v);
  return d ? `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}` : '';
}

/** { hari:'Rabu', tgl:'23', bulan:'Juli', tahun:'2025' } */
function pecahTanggal(v) {
  const d = parseTanggal(v);
  if (!d) return null;
  return { hari: HARI[d.getDay()], tgl: String(d.getDate()), bulan: BULAN[d.getMonth()], tahun: String(d.getFullYear()) };
}

const bersih = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Susun data berkas dari data mahasiswa + pengajuan seminar.
 * @param {object} p
 * @param {object} p.user        - profil mahasiswa (req.user)
 * @param {object} p.pengajuan   - dokumen permohonanMagang
 * @param {object} [p.pembimbing]- hasil getPembimbingMahasiswa (Dosen PA)
 */
function bangunDataBerkas({ user, pengajuan, pembimbing }) {
  const nim = user.nim || pengajuan.nim || '';
  const angkatan = getAngkatanFromNim(nim);
  const semester = angkatan ? getStudentCurrentSemester(angkatan) : '';

  const lokasi = [1, 2, 3].map((ke) => {
    const item = (pengajuan.lokasiMagang || []).find((x) => Number(x.ke) === ke);
    return { ke, perusahaan: bersih(item && item.perusahaan) };
  });

  const laporan = [1, 2, 3].map((ke) => ({
    ke,
    sudah: !!(pengajuan.laporan && pengajuan.laporan[ke])
  }));

  let jadwal = null;
  if (pengajuan.status === 'approved' && pengajuan.jadwal && pengajuan.jadwal.tanggal) {
    const j = pengajuan.jadwal;
    jadwal = {
      tanggal: j.tanggal,
      tanggalPanjang: tanggalPanjang(j.tanggal),
      bagian: pecahTanggal(j.tanggal),
      waktu: bersih(j.waktu),
      tempat: bersih(j.tempat),
      penguji: bersih(j.penguji)
    };
  }

  const hariIni = new Date();
  const hasil = {
    nama: user.nama || pengajuan.nama || '',
    nim,
    prodi: PRODI,
    semester,
    tahunAkademik: getCurrentAcademicSemester().tahunAkademik,
    kota: KOTA,
    tanggalCetak: tanggalPanjang(hariIni),
    pembimbingNama: bersih(pengajuan.pembimbing) || (pembimbing && pembimbing.nama) || '',
    pembimbingNuptk: (pembimbing && pembimbing.nuptk) || '',
    pendampingLapangan: bersih(pengajuan.pendampingLapangan),
    lokasi,
    laporan,
    pembayaranLunas: !!pengajuan.pembayaranLunas,
    judul: bersih(pengajuan.judul),
    jadwal,
    kaprodi: KAPRODI
  };
  hasil.lokasiBaris = lokasiBaris(hasil); // dipakai templat cetak (EJS)
  return hasil;
}

/** Teks lokasi satu baris per magang, mis. 'Magang 1: PT A' (yang kosong dilewati) */
function lokasiBaris(data) {
  const terisi = data.lokasi.filter((l) => l.perusahaan);
  if (terisi.length === 0) return ['-'];
  return terisi.map((l) => `Magang ${l.ke}: ${l.perusahaan}`);
}

const DOKUMEN = {
  'formulir': { judul: 'Formulir Pengajuan Seminar Magang', berkas: 'Formulir_Pengajuan_Seminar_Magang', butuhJadwal: false },
  'surat-permohonan': { judul: 'Surat Permohonan Ujian Magang', berkas: 'Surat_Permohonan_Ujian_Magang', butuhJadwal: true },
  'berita-acara': { judul: 'Berita Acara Seminar Magang', berkas: 'Berita_Acara_Seminar_Magang', butuhJadwal: true }
};

/** Nama file aman: Surat_Permohonan_Ujian_Magang-NamaMhs-NIM */
function namaBerkas(jenis, data) {
  const aman = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${DOKUMEN[jenis].berkas}-${aman(data.nama)}-${aman(data.nim)}`;
}

module.exports = {
  HARI, BULAN, KAPRODI, KOTA, PRODI, DOKUMEN,
  parseTanggal, tanggalPanjang, pecahTanggal,
  bangunDataBerkas, lokasiBaris, namaBerkas
};
