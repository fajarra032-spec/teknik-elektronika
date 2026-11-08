/**
 * helpers/waTemplates.js
 * Draf template WhatsApp (kategori UTILITY) untuk diajukan ke Meta, serta
 * pemetaan "aturan notifikasi" -> template.
 *
 * Semua template memakai 3 variabel yang sama:
 *   {{1}} nama penerima   {{2}} judul notifikasi   {{3}} keterangan + tautan
 * Template tidak boleh diawali/diakhiri variabel, jadi tiap isi ditutup teks tetap.
 */
const TEMPLATES = {
  nilai_keluar: {
    language: 'id',
    body: 'Halo {{1}}, ada pembaruan nilai di Sistem Informasi Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih. Prodi Teknik Elektronika.',
    contoh: ['Budi', 'Nilai akhir Rangkaian Listrik sudah keluar', 'Nilai: A. Buka: https://elektronika.polidewa.ac.id/mahasiswa/akademik']
  },
  info_magang: {
    language: 'id',
    body: 'Halo {{1}}, informasi magang Anda: {{2}}. {{3}} Terima kasih. Prodi Teknik Elektronika.',
    contoh: ['Budi', 'Laporan magang ke-2 di-ACC', 'Buka: https://elektronika.polidewa.ac.id/mahasiswa/magang']
  },
  pengingat_logbook: {
    language: 'id',
    body: 'Halo {{1}}, pengingat dari Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih.',
    contoh: ['Budi', 'Logbook hari ini masih kosong', 'Buka: https://elektronika.polidewa.ac.id/mahasiswa/magang']
  },
  info_dosen: {
    language: 'id',
    body: 'Yth. {{1}}, informasi dari Sistem Informasi Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih.',
    contoh: ['Bapak/Ibu Dosen', 'Budi mengajukan seminar magang', 'Buka: https://elektronika.polidewa.ac.id/dosen/magang']
  },
  info_layanan: {
    language: 'id',
    body: 'Halo {{1}}, pemberitahuan layanan Prodi Teknik Elektronika: {{2}}. {{3}} Terima kasih.',
    contoh: ['Budi', 'Jadwal seminar magang ditetapkan', 'Tanggal 20 Nov 2026, 09.00 WITA, Lab Elektronika.']
  }
};

/** Bersihkan nilai variabel template sesuai aturan Meta (tanpa baris baru/tab, spasi ganda). */
function bersihkanParam(v, maks = 300) {
  return String(v == null ? '' : v)
    .replace(/[\r\n\t]+/g, ' · ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, maks) || '-';
}

module.exports = { TEMPLATES, bersihkanParam };
