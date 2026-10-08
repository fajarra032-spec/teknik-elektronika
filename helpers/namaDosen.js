/**
 * helpers/namaDosen.js
 * Kunci pencocokan nama dosen yang tahan perbedaan gelar & tanda baca:
 * ambil bagian sebelum koma pertama, buang gelar depan (Dr./Drs./Ir./Prof./H.),
 * lalu hanya huruf kecil.  Contoh:
 *   'Esron, S.Pd., M.Pd'                -> 'esron'      (= 'Esron' di sistem)
 *   'Dr. Haluddin, S.Pd.,M.Pd.'         -> 'haluddin'
 *   'Miiftahul Hairia, S.Pd., M.Pd'     -> 'miiftahul hairia' (BEDA dg 'miftahul hairia'; ditangani lewat alias)
 */
function kunciNama(nama) {
  const depan = String(nama || '').split(',')[0].toLowerCase().replace(/[^a-z\s.]/g, ' ');
  return depan
    .replace(/\b(dr|drs|ir|prof|h|hj)\./g, ' ')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
module.exports = { kunciNama };
