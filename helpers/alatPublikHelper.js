/**
 * helpers/alatPublikHelper.js
 * Data alat lab untuk halaman PUBLIK (landing & /peralatan-lab).
 *
 * - Hanya alat aktif; hanya field yang aman ditampilkan ke publik
 *   (tanpa fotoFileId, tanpa rincian stok internal seperti jumlah rusak/dipinjam).
 * - Di-cache 2 menit supaya kunjungan landing tidak membaca Firestore terus-menerus.
 *   Cache dibuang otomatis saat admin mengubah inventaris atau stok berubah.
 */
const { TTLCache } = require('./cache');

const cache = new TTLCache(2 * 60 * 1000);
const KEY = 'alat-publik';

async function getAlatPublik(db) {
  return cache.getOrFetch(KEY, async () => {
    const snap = await db.collection('alatLab').orderBy('nama').get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a => a.aktif !== false)
      .map(a => ({
        id: a.id,
        kode: a.kode || '',
        nama: a.nama || '',
        kategori: a.kategori || 'Lainnya',
        merk: a.merk || '',
        lokasi: a.lokasi || '',
        keterangan: a.keterangan || '',
        fotoUrl: a.fotoUrl || '',
        jumlahTotal: a.jumlahTotal || 0,
        tersedia: (a.jumlahTersedia || 0) > 0
      }));
  });
}

function invalidateAlatPublik() { cache.delete(KEY); }

module.exports = { getAlatPublik, invalidateAlatPublik };
