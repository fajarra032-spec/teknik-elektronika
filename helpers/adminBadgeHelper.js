/**
 * helpers/adminBadgeHelper.js
 * Jumlah pekerjaan admin yang menunggu tindakan (untuk badge di navbar &
 * dashboard admin). Di-cache 30 detik karena dipakai di SETIAP halaman admin;
 * memakai count() agregasi sehingga tidak membaca dokumen satu per satu.
 */
const { TTLCache } = require('./cache');

const cache = new TTLCache(30 * 1000);
const KEY = 'admin-pending';

async function hitung(db, koleksi, field, op, nilai) {
  return (await db.collection(koleksi).where(field, op, nilai).count().get()).data().count;
}

/** @returns {Promise<{kunjungan:number, peminjaman:number, seminar:number, total:number}>} */
async function getAdminPending(db) {
  return cache.getOrFetch(KEY, async () => {
    const [kunjungan, peminjaman, seminar] = await Promise.all([
      hitung(db, 'kunjunganIndustri', 'status', '==', 'diajukan'),
      hitung(db, 'peminjamanAlat', 'status', 'in', ['diajukan', 'menunggu_verifikasi_kembali']),
      hitung(db, 'permohonanMagang', 'status', '==', 'pending')
    ]);
    return { kunjungan, peminjaman, seminar, total: kunjungan + peminjaman + seminar };
  });
}

function invalidateAdminPending() { cache.delete(KEY); }

module.exports = { getAdminPending, invalidateAdminPending };
