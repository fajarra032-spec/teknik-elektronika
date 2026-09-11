/**
 * scripts/cek-enrollment-semester1-aktif.js
 *
 * Script DIAGNOSTIK (READ-ONLY - tidak mengubah apa pun). Beda dari
 * scripts/cek-enrollment-per-mk.js yang fokus 1 MK dan tampilkan SEMUA
 * enrollment-nya, script ini SAPU SEMUA mata kuliah Semester 1 sekaligus,
 * dan HANYA menampilkan enrollment yang BENAR-BENAR akan muncul di roster
 * dosen SAAT INI (status='active' DAN semester === periode aktif sekarang)
 * - supaya cepat ketahuan MK semester 1 mana yang masih kemasukan
 * mahasiswa "nyasar" (mahasiswa lama yang harusnya sudah lewat semester 1).
 *
 * Heuristik tambahan: periode aktif sekarang mestinya diisi mahasiswa BARU
 * (angkatan tahun ini) untuk MK semester 1. Kalau ada NIM yang PREFIX
 * angkatannya beda dari yang diharapkan (mis. NIM 23xxx atau 24xxx muncul
 * padahal semester 1 tahun ini harusnya angkatan terbaru), baris itu
 * ditandai ⚠️ supaya gampang dipindai. ini cuma PETUNJUK, bukan vonis
 * pasti - tetap perlu dicek manual (bisa saja memang mahasiswa mengulang/
 * pindahan).
 *
 * Cara pakai:
 *   node scripts/cek-enrollment-semester1-aktif.js
 *   node scripts/cek-enrollment-semester1-aktif.js 26   (kasih tahu 2 digit
 *     prefix NIM angkatan yang diharapkan utk semester 1 periode ini, kalau
 *     tidak diisi script akan coba tebak dari tahun di label periode aktif)
 */

const { db } = require('../config/firebaseAdmin');
const { getPeriodeAktif } = require('../helpers/nilaiHelper');

async function main() {
  const periodeAktif = getPeriodeAktif();

  // Coba tebak prefix NIM angkatan yang "wajar" untuk semester 1 periode
  // ini dari label periode aktif, mis. "Ganjil 2026/2027" -> prefix '26'.
  // Bisa dioverride lewat argumen CLI kalau tebakan ini salah.
  let prefixDiharapkan = process.argv[2] || null;
  if (!prefixDiharapkan) {
    const m = periodeAktif.match(/(\d{4})/);
    if (m) prefixDiharapkan = m[1].slice(2); // '2026' -> '26'
  }

  console.log('='.repeat(78));
  console.log('CEK MK SEMESTER 1 - SIAPA SAJA YANG MUNCUL DI ROSTER SEKARANG');
  console.log(`Periode aktif sekarang     : "${periodeAktif}"`);
  console.log(`Prefix NIM angkatan baru (tebakan/diisi manual): "${prefixDiharapkan || '(tidak diketahui)'}"`);
  console.log('='.repeat(78));

  const mkSnapshot = await db.collection('mataKuliah').where('semester', '==', 1).get();
  console.log(`\nDitemukan ${mkSnapshot.size} mata kuliah Semester 1 di database.\n`);

  let totalMuncul = 0;
  let totalMencurigakan = 0;

  for (const mkDoc of mkSnapshot.docs) {
    const mk = mkDoc.data();

    const enrollSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkDoc.id)
      .where('semester', '==', periodeAktif)
      .where('status', '==', 'active')
      .get();

    if (enrollSnapshot.empty) {
      console.log(`[${mk.kode}] ${mk.nama} - kosong, tidak ada yang muncul di roster sekarang.`);
      continue;
    }

    const userIds = enrollSnapshot.docs.map(d => d.data().userId).filter(Boolean);
    const userDocs = userIds.length > 0
      ? await db.getAll(...userIds.map(uid => db.collection('users').doc(uid)))
      : [];
    const userMap = {};
    userDocs.forEach(uDoc => { if (uDoc.exists) userMap[uDoc.id] = uDoc.data(); });

    console.log(`\n[${mk.kode}] ${mk.nama}  ->  ${enrollSnapshot.size} mahasiswa muncul di roster SEKARANG:`);

    const rows = enrollSnapshot.docs.map(doc => {
      const e = doc.data();
      const u = userMap[e.userId] || {};
      const nim = u.nim || '(user tidak ketemu)';
      const prefixNim = nim.slice(0, 2);
      const mencurigakan = prefixDiharapkan && prefixNim !== prefixDiharapkan && /^\d{2}$/.test(prefixNim);
      return { enrollmentId: doc.id, nim, nama: u.nama || '-', mencurigakan, catatan: e.catatan || '' };
    }).sort((a, b) => a.nim.localeCompare(b.nim));

    rows.forEach(r => {
      totalMuncul++;
      const tanda = r.mencurigakan ? '⚠️  KEMUNGKINAN NYASAR (angkatan lama)' : '';
      if (r.mencurigakan) totalMencurigakan++;
      const sumberScript = r.catatan.includes('Dibuat otomatis dari input nilai historis') ? '  [dari script input-nilai-* kita]' : '';
      console.log(`    NIM ${r.nim.padEnd(12)} ${r.nama.padEnd(32)} ${tanda}${sumberScript}`);
    });
  }

  console.log('\n' + '='.repeat(78));
  console.log(`Total baris muncul di roster semester-1 sekarang : ${totalMuncul}`);
  console.log(`Ditandai ⚠️  mencurigakan (prefix NIM beda)        : ${totalMencurigakan}`);
  if (totalMencurigakan > 0) {
    console.log('\nUntuk tiap yang ditandai ⚠️  di atas, jalankan:');
    console.log('   node scripts/cek-enrollment-per-mk.js <kodeMk> <nim>');
    console.log('supaya lihat detail dokumen enrollment-nya (createdAt, catatan, dsb)');
    console.log('sebelum diputuskan mau dihapus/diubah statusnya.');
  } else {
    console.log('\nTidak ada yang ditandai mencurigakan otomatis - kalau masih ada laporan');
    console.log('mahasiswa nyasar, coba jalankan ulang dengan prefix manual, mis:');
    console.log('   node scripts/cek-enrollment-semester1-aktif.js 26');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
