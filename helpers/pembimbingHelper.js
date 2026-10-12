// helpers/pembimbingHelper.js
// ============================================================================
// PEMBIMBING MAGANG = DOSEN PEMBIMBING AKADEMIK (PA)
//
// REVISI: sebelumnya magang punya 2 pembimbing (Pembimbing 1 menilai laporan,
// Pembimbing 2 mengurus logbook) yang ditetapkan admin lewat koleksi
// `bimbingan`. Sekarang Pembimbing 1 & 2 DITIADAKAN. Hanya ada SATU
// pembimbing, yaitu Dosen PA mahasiswa (field `dosenPaId` / `dosenPaNama` /
// `dosenPaNidn` pada dokumen users mahasiswa - diatur lewat /admin/mahasiswa
// atau script assign-dosen-pa-*). Dosen PA inilah yang:
//   - menyetujui / menolak logbook & mengunci logbook,
//   - mengisi Nilai Logbook,
//   - meninjau / ACC laporan & mengisi Nilai Laporan,
//   - mengelola periode magang mahasiswa PA-nya.
//
// Koleksi `bimbingan` TIDAK dipakai lagi untuk otorisasi. Data lama di
// koleksi itu dibiarkan (tidak dihapus) supaya bisa diaudit.
// ============================================================================

const { db } = require('../config/firebaseAdmin');

const ROLE_PEMBIMBING = 'pembimbing';

/**
 * Pembimbing (Dosen PA) seorang mahasiswa.
 * @param {string|Object} mahasiswa - ID mahasiswa, atau dokumen user yang sudah dimuat
 *   (kalau sudah ada, tidak perlu baca ulang dari Firestore).
 * @returns {Promise<{id:string, nama:string, nidn:string, nuptk:string}|null>}
 */
async function getPembimbingMahasiswa(mahasiswa) {
  try {
    let data = mahasiswa;
    if (typeof mahasiswa === 'string') {
      const doc = await db.collection('users').doc(mahasiswa).get();
      if (!doc.exists) return null;
      data = doc.data();
    }
    if (!data || !data.dosenPaId) return null;

    let nama = data.dosenPaNama || '';
    let nidn = data.dosenPaNidn || '';
    let nuptk = '';
    // Nama/NIDN terbaru diambil dari dokumen dosen (denormalisasi di users bisa basi)
    const dosenDoc = await db.collection('dosen').doc(data.dosenPaId).get();
    if (dosenDoc.exists) {
      const d = dosenDoc.data();
      nama = d.nama || nama;
      nidn = d.nidn || nidn;
      nuptk = d.nuptk || d.nip || d.nidn || '';
    }
    return {
      id: data.dosenPaId,
      nama: nama || '-',
      nidn: nidn || '-',
      nuptk: nuptk || nidn || '-'
    };
  } catch (error) {
    console.error('Error getPembimbingMahasiswa:', error);
    return null;
  }
}

/**
 * Apakah dosen ini pembimbing (Dosen PA) dari mahasiswa tsb?
 * @returns {Promise<{isBimbingan:boolean, role:string|null}>}
 */
async function isPembimbingMahasiswa(dosenId, mahasiswaId) {
  try {
    const doc = await db.collection('users').doc(mahasiswaId).get();
    if (!doc.exists) return { isBimbingan: false, role: null };
    const ok = !!dosenId && doc.data().dosenPaId === dosenId;
    return { isBimbingan: ok, role: ok ? ROLE_PEMBIMBING : null };
  } catch (error) {
    console.error('Error isPembimbingMahasiswa:', error);
    return { isBimbingan: false, role: null };
  }
}

/**
 * Daftar mahasiswa AKTIF yang Dosen PA-nya adalah dosen ini.
 * Mahasiswa non-aktif (lulus, cuti, DO, dll.) tidak ikut.
 * @returns {Promise<Array<Object>>} dokumen user (id + data)
 */
async function getMahasiswaBimbinganPa(dosenId) {
  const snapshot = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .where('dosenPaId', '==', dosenId)
    .get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(m => !m.statusMahasiswa || m.statusMahasiswa === 'Aktif');
}

module.exports = {
  ROLE_PEMBIMBING,
  getPembimbingMahasiswa,
  isPembimbingMahasiswa,
  getMahasiswaBimbinganPa
};
