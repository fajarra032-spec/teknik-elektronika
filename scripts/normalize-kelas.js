/**
 * scripts/normalize-kelas.js
 *
 * MASALAH:
 * Field `kelas` (di collection `users` untuk mahasiswa, dan di collection
 * `mataKuliah` untuk kelas paralel) dulunya cuma dinormalisasi dengan
 * `.trim().toUpperCase()` - artinya spasi DI TENGAH teks (mis. "ELK 1B")
 * tetap ikut tersimpan apa adanya. Kalau ada dua tempat yang menulis kelas
 * yang "sama" tapi salah satunya kepencet spasi ("ELK 1B" vs "ELK1B"),
 * sistem menganggap itu DUA kelas yang beda:
 *   - Mahasiswa dengan kelas "ELK 1B" tidak akan pernah cocok dengan
 *     mata kuliah kelas paralel yang kelasnya "ELK1B" -> paket KRS gagal
 *     dicocokkan, gejalanya "kelas tidak terbaca/tidak ditemukan".
 *   - Di halaman roster dosen, filter/badge kelas juga tidak akan
 *     mengelompokkan mahasiswa itu dengan benar.
 *
 * Kode aplikasi (routes/admin/mahasiswa.js, routes/admin/matakuliah.js,
 * helpers/paketKurikulumHelper.js) SUDAH diperbaiki supaya data BARU selalu
 * dinormalisasi konsisten (helpers/academicHelper.js -> normalizeKelas()).
 * Tapi itu tidak mengubah data yang SUDAH terlanjur tersimpan sebelumnya -
 * script inilah yang membereskan data lama itu.
 *
 * APA YANG DILAKUKAN SCRIPT INI:
 * - Membaca semua dokumen `users` (role mahasiswa) dan `mataKuliah`.
 * - Untuk tiap dokumen yang punya field `kelas`, hitung versi ternormalisasi
 *   (trim + uppercase + hapus SEMUA spasi, mis. "elk 1b " -> "ELK1B").
 * - Kalau nilainya beda dari yang tersimpan, TAMPILKAN dulu (dry-run).
 * - Hanya benar-benar MENULIS ke Firestore kalau dijalankan dengan flag
 *   --apply.
 *
 * AMAN DIJALANKAN BERKALI-KALI: cuma menimpa field `kelas` itu sendiri,
 * tidak menyentuh field lain.
 *
 * Cara pakai (dari root project, di server yang punya akses Firestore):
 *   node scripts/normalize-kelas.js            (dry-run, cuma menampilkan)
 *   node scripts/normalize-kelas.js --apply    (benar-benar menyimpan)
 */

const { db } = require('../config/firebaseAdmin');
const { normalizeKelas } = require('../helpers/academicHelper');

const APPLY = process.argv.includes('--apply');

async function prosesCollection(namaCollection, filterFn) {
  console.log(`\n=== Collection: ${namaCollection} ===`);
  const snapshot = await db.collection(namaCollection).get();
  let jumlahDicek = 0;
  let jumlahBerubah = 0;
  const perubahan = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (filterFn && !filterFn(data)) continue;
    if (!('kelas' in data) || data.kelas === undefined) continue;

    jumlahDicek++;
    const lama = data.kelas;
    const baru = normalizeKelas(lama);

    // Bandingkan sebagai string supaya null vs null tidak dianggap "berubah"
    if (String(lama || '') !== String(baru || '')) {
      jumlahBerubah++;
      const label = data.nama || data.kode || doc.id;
      perubahan.push({ id: doc.id, label, lama, baru });
      console.log(`  [${namaCollection}] ${label} (${doc.id}): "${lama}" -> "${baru === null ? '(kosong)' : baru}"`);

      if (APPLY) {
        await db.collection(namaCollection).doc(doc.id).update({ kelas: baru });
      }
    }
  }

  console.log(`Dicek: ${jumlahDicek} dokumen, perlu diubah: ${jumlahBerubah} dokumen.`);
  return perubahan;
}

async function main() {
  console.log(APPLY
    ? 'MODE: --apply (perubahan akan DISIMPAN ke Firestore)'
    : 'MODE: dry-run (cuma menampilkan, TIDAK menyimpan apa pun - tambahkan --apply untuk benar-benar menyimpan)');

  const perubahanUsers = await prosesCollection('users', (data) => data.role === 'mahasiswa');
  const perubahanMk = await prosesCollection('mataKuliah');

  const totalBerubah = perubahanUsers.length + perubahanMk.length;
  console.log(`\n=== RINGKASAN ===`);
  console.log(`Total dokumen yang ${APPLY ? 'sudah' : 'akan'} diubah: ${totalBerubah}`);

  if (!APPLY && totalBerubah > 0) {
    console.log('\nIni baru dry-run. Kalau daftar di atas sudah sesuai, jalankan ulang dengan:');
    console.log('  node scripts/normalize-kelas.js --apply');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Gagal menjalankan script:', err);
    process.exit(1);
  });
