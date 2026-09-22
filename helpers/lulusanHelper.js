/**
 * helpers/lulusanHelper.js
 * Menggabungkan dua sumber data lulusan/tracer study:
 *   1) tracerStudy - isian mandiri mahasiswa/lulusan (perlu ditinjau admin
 *      dan ditandai isPublic sebelum tampil di halaman publik)
 *   2) lulusan - data yang diinput/dikurasi langsung oleh admin (selalu
 *      dianggap publik)
 *
 * Dipakai bersama oleh:
 *   - routes/landing.js (halaman publik /lulusan) - hanya yang isPublic=true
 *   - routes/admin/tracklulusan.js (panel admin) - semua data, termasuk yang
 *     masih menunggu tinjauan, supaya admin melihat SATU daftar lengkap,
 *     bukan dua daftar terpisah yang tidak nyambung.
 */

const { db } = require('../config/firebaseAdmin');

/**
 * Normalisasi status pekerjaan ke satu set nilai baku, karena kedua koleksi
 * sumber memakai istilah yang berbeda-beda (mis. tracerStudy pakai 'kuliah',
 * lulusan pakai 'melanjutkan_studi').
 */
function normalisasiStatus(rawStatus) {
  const map = {
    'kuliah': 'melanjutkan_studi',
    'melanjutkan_studi': 'melanjutkan_studi',
    'belum bekerja': 'belum_bekerja',
    'belum_bekerja': 'belum_bekerja',
    'bekerja': 'bekerja',
    'wirausaha': 'wirausaha'
  };
  return map[rawStatus] || rawStatus || 'belum_bekerja';
}

/**
 * Mengambil daftar gabungan lulusan dari kedua sumber.
 * @param {Object} opsi
 * @param {boolean} [opsi.hanyaPublik=true] - jika true, isian mandiri yang
 *   belum disetujui admin (isPublic != true) tidak diikutkan. Admin butuh
 *   melihat semuanya (hanyaPublik=false), halaman publik hanya yang sudah
 *   disetujui (hanyaPublik=true, default).
 * @returns {Promise<Array>}
 */
async function getGabunganLulusan({ hanyaPublik = true } = {}) {
  let tracerQuery = db.collection('tracerStudy');
  if (hanyaPublik) {
    tracerQuery = tracerQuery.where('isPublic', '==', true);
  }

  const [tracerSnap, lulusanSnap] = await Promise.all([
    tracerQuery.get(),
    db.collection('lulusan').get()
  ]);

  const dariSurvei = tracerSnap.docs.map(doc => {
    const d = doc.data();
    return {
      id: `survei_${doc.id}`,
      rawId: doc.id,
      sumber: 'survei',
      isPublic: d.isPublic === true,
      nama: d.nama || '-',
      nim: d.nim || '-',
      tahunLulus: d.tahunLulus || null,
      status: normalisasiStatus(d.statusPekerjaan),
      pekerjaan: d.pekerjaan || '',
      tempatKerja: d.namaPerusahaan || d.tempatKerja || '',
      alamatKerja: d.alamatKerja || '',
      gaji: d.gaji || '',
      email: '',
      noHp: '',
      foto: d.fotoUrl || null
    };
  });

  const dariAdmin = lulusanSnap.docs.map(doc => {
    const d = doc.data();
    return {
      id: `manual_${doc.id}`,
      rawId: doc.id,
      sumber: 'manual',
      isPublic: true, // data kurasi admin, selalu dianggap publik
      nama: d.nama || '-',
      nim: d.nim || '-',
      tahunLulus: d.tahunLulus || null,
      status: normalisasiStatus(d.status),
      pekerjaan: d.pekerjaan || '',
      tempatKerja: d.tempatKerja || '',
      alamatKerja: d.alamatKerja || '',
      gaji: d.gaji || '',
      email: d.email || '',
      noHp: d.noHp || '',
      foto: d.foto || null
    };
  });

  return [...dariSurvei, ...dariAdmin];
}

module.exports = { normalisasiStatus, getGabunganLulusan };
