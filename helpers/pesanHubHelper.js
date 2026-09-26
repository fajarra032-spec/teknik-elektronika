/**
 * helpers/pesanHubHelper.js
 * Menyatukan tiga jenis obrolan yang tadinya terpisah (Pesan Pribadi, Chat
 * Kelas per mata kuliah, Komunitas satu ruang global) supaya bisa
 * ditampilkan dalam satu sidebar ala Messenger di halaman /pesan.
 *
 * SENGAJA tidak mengubah skema data atau helper lama sama sekali
 * (kelasChatHelper.js, komunitasHelper.js) - file ini cuma "menu" yang
 * memanggil helper-helper itu, supaya Chat Kelas & Komunitas versi lama
 * (di /mahasiswa/kelas-chat, /dosen/kelas-chat, dan halaman komunitas per
 * role) tetap jalan
 * apa adanya sebagai pintu masuk alternatif.
 */

const { getAllMataKuliah } = require('./cache');
const { getPeriodeAktif } = require('./nilaiHelper');

/**
 * Daftar mata kuliah (jadi room Chat Kelas) yang relevan buat user yang
 * login. Admin tidak punya kelas, jadi selalu dapat array kosong.
 */
async function getKelasRoomsForUser(db, user) {
  if (user.role === 'dosen') {
    const dosenId = user.dosenId;
    if (!dosenId) return [];
    const mkList = await getAllMataKuliah(db);
    return mkList
      .filter(mk => Array.isArray(mk.dosenIds) && mk.dosenIds.includes(dosenId))
      .map(mk => ({ mkId: mk.id, kode: mk.kode || '', nama: mk.nama || '(Tanpa nama)' }));
  }

  if (user.role === 'mahasiswa') {
    const periode = getPeriodeAktif();
    const enrollSnap = await db.collection('enrollment')
      .where('userId', '==', user.id)
      .where('semester', '==', periode)
      .where('status', '==', 'active')
      .get();
    if (enrollSnap.empty) return [];
    const mkIds = new Set(enrollSnap.docs.map(d => d.data().mkId));
    const mkList = await getAllMataKuliah(db);
    return mkList
      .filter(mk => mkIds.has(mk.id))
      .map(mk => ({ mkId: mk.id, kode: mk.kode || '', nama: mk.nama || '(Tanpa nama)' }));
  }

  return []; // admin
}

module.exports = { getKelasRoomsForUser };
