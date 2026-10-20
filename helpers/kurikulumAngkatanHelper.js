/**
 * helpers/kurikulumAngkatanHelper.js
 *
 * Penentu angkatan mana yang MASIH PAKAI KODE MATA KULIAH LAMA (kurikulum lama).
 *
 * Latar belakang: koleksi `mataKuliah` sekarang berisi kode kurikulum BARU
 * (WUD3208, PD3201, PEK3201, WP2021, dst). Angkatan 2023 masih memakai
 * kurikulum lama - nilainya sudah diinput dengan KODE LAMA (CA302, WU219,
 * PE301, WA210, dst, lihat scripts/input-nilai-angkatan23-legacy.js) langsung
 * di koleksi `grades`, tanpa enrollment.
 *
 * Kalau angkatan ini ikut mendapat paket KRS/enrollment kurikulum baru, mata
 * kuliah yang sama tampil DUA KALI di KHS/Transkrip: sekali dengan kode lama
 * (ada nilainya) dan sekali dengan kode baru (status "Belum Ada Nilai").
 * Karena itu untuk angkatan di daftar ini:
 *   - paket KRS kurikulum baru tidak diterapkan otomatis (aktifkanPaketKrs), dan
 *   - KHS/Transkrip hanya membaca nilai ber-kode-lama dari `grades`
 *     (getTranskripMahasiswa).
 *
 * Kalau nanti ada angkatan lain yang juga harus pakai kode lama, cukup
 * tambahkan tahunnya ke ANGKATAN_KODE_LAMA di bawah ini.
 */

const ANGKATAN_KODE_LAMA = ['2023'];

/** "233020xx" -> "2023". Kembalikan '' kalau NIM tidak valid. */
function angkatanDariNim(nim) {
  const s = String(nim || '').trim();
  return /^\d{2}/.test(s) ? '20' + s.substring(0, 2) : '';
}

/** true bila mahasiswa (berdasarkan NIM) termasuk angkatan yang memakai kode lama. */
function pakaiKodeLama(nim) {
  return ANGKATAN_KODE_LAMA.includes(angkatanDariNim(nim));
}

module.exports = { ANGKATAN_KODE_LAMA, angkatanDariNim, pakaiKodeLama };
