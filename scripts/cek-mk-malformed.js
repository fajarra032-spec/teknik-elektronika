/**
 * scripts/cek-mk-malformed.js
 *
 * Script DIAGNOSTIK (READ-ONLY). Mencari dokumen `mataKuliah` yang CACAT
 * (field `semester` atau `sks` kosong/undefined) - dugaan ini adalah
 * dokumen yang ke-buat otomatis oleh sistem KRS mahasiswa waktu mereka
 * coba KRS ke mata kuliah yang saat itu dokumennya belum ada (mis. kasus
 * WUD3209 Kelas B kemarin: 21 mahasiswa KRS duluan sebelum dokumen Kelas
 * B resmi dibuat, sistem malah bikin dokumen baru yang cacat).
 *
 * Untuk tiap dokumen cacat yang ketemu, ditampilkan juga: siapa saja yang
 * enroll di situ, dan APAKAH mereka JUGA sudah terdaftar di dokumen LAIN
 * dengan kode yang sama (indikasi dobel-KRS akibat bug ini).
 *
 * Cara pakai:
 *   node scripts/cek-mk-malformed.js
 */

const { db } = require('../config/firebaseAdmin');

async function main() {
  console.log('='.repeat(78));
  console.log('CEK DOKUMEN mataKuliah YANG CACAT (semester/sks kosong)');
  console.log('='.repeat(78));

  const semuaMkSnapshot = await db.collection('mataKuliah').get();
  const semuaMk = semuaMkSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const cacat = semuaMk.filter(mk => mk.semester === undefined || mk.semester === null || mk.sks === undefined || mk.sks === null);

  console.log(`\nTotal dokumen mataKuliah di database : ${semuaMk.length}`);
  console.log(`Dokumen CACAT (semester/sks kosong)   : ${cacat.length}\n`);

  if (cacat.length === 0) {
    console.log('Tidak ada dokumen cacat ditemukan. Aman.');
    process.exit(0);
  }

  // Kelompokkan mataKuliah SEHAT by kode, untuk cek silang dobel-enroll.
  const sehatByKode = {};
  semuaMk.filter(mk => !cacat.includes(mk)).forEach(mk => {
    if (!sehatByKode[mk.kode]) sehatByKode[mk.kode] = [];
    sehatByKode[mk.kode].push(mk);
  });

  for (const mk of cacat) {
    console.log(`\n--- DOKUMEN CACAT: ${mk.id} ---`);
    console.log(`    kode: ${mk.kode || '(kosong)'} | nama: ${mk.nama || '(kosong)'} | semester: ${mk.semester} | sks: ${mk.sks}`);
    console.log(`    kelas: ${mk.kelas || '(kosong)'} | dosenIds: ${JSON.stringify(mk.dosenIds || [])}`);
    console.log(`    createdAt: ${mk.createdAt || '-'}`);

    const enrollSnapshot = await db.collection('enrollment').where('mkId', '==', mk.id).get();
    console.log(`    Jumlah enrollment di dokumen cacat ini: ${enrollSnapshot.size}`);

    if (enrollSnapshot.empty) continue;

    const userIds = enrollSnapshot.docs.map(d => d.data().userId).filter(Boolean);
    const userDocs = userIds.length > 0
      ? await db.getAll(...userIds.map(uid => db.collection('users').doc(uid)))
      : [];
    const userMap = {};
    userDocs.forEach(uDoc => { if (uDoc.exists) userMap[uDoc.id] = uDoc.data(); });

    // Dokumen sehat lain dengan kode yang sama, untuk cek dobel.
    const kandidatSehat = sehatByKode[mk.kode] || [];

    for (const doc of enrollSnapshot.docs) {
      const e = doc.data();
      const u = userMap[e.userId] || {};
      const nim = u.nim || '(user tidak ketemu)';

      // Cek apakah user ini JUGA punya enrollment di dokumen sehat kode yang sama.
      let dobelDi = [];
      for (const mkSehat of kandidatSehat) {
        const cekSnapshot = await db.collection('enrollment')
          .where('mkId', '==', mkSehat.id)
          .where('userId', '==', e.userId)
          .get();
        if (!cekSnapshot.empty) {
          dobelDi.push(`${mkSehat.id} (kelas: ${mkSehat.kelas || '-'})`);
        }
      }

      const tandaDobel = dobelDi.length > 0 ? `  ⚠️ DOBEL - juga terdaftar di: ${dobelDi.join(', ')}` : '';
      console.log(`      [enrollment ${doc.id}] NIM ${nim}  ${u.nama || '-'}  semester enrollment="${e.semester}"${tandaDobel}`);
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log('Selesai. Untuk NIM yang ditandai ⚠️ DOBEL: mahasiswa itu punya 2 catatan');
  console.log('enrollment untuk MK yang sama (satu di dokumen cacat, satu di dokumen sehat).');
  console.log('Belum ada apa pun yang diubah/dihapus - ini murni laporan.');
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
