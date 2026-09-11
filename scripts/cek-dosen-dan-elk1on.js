/**
 * scripts/cek-dosen-dan-elk1on.js
 *
 * Script DIAGNOSTIK (READ-ONLY). Sebelum eksekusi revisi jadwal (ganti
 * dosen Etika Kerja, perbaiki nama Esron->Erson, alihkan dosen 4 MK
 * agama, dan siapkan Kelas Online ELK1ON), kita perlu tahu data
 * PERSISNYA dulu:
 *
 *   1. Semua dokumen di koleksi `dosen` - nama persis & id-nya. Supaya
 *      ketahuan: apakah "Esron" sudah ada persis begitu, apakah "Farhan
 *      Yustisio", "Gunawan Tari", dan 5 dosen kelas online (Nur Afifah
 *      Rustan, Sarifuddin Ihsan Al Alim, Drs. Salahuddin Abadi AS,
 *      Ir. Irhamni Nuhardin, Ramlan) SUDAH ADA akunnya atau belum.
 *   2. Semua user (mahasiswa) dengan field `kelas` == 'ELK1ON' - supaya
 *      ketahuan siapa saja yang perlu di-enroll-kan ke MK kelas online.
 *   3. Semua dokumen `mataKuliah` yang `kelas` == 'ELK1ON' - jaga-jaga
 *      kalau sebagian sudah pernah dibuat (baik yang sehat maupun cacat
 *      seperti kasus ELK1B kemarin).
 *
 * Cara pakai:
 *   node scripts/cek-dosen-dan-elk1on.js
 */

const { db } = require('../config/firebaseAdmin');

async function main() {
  console.log('='.repeat(78));
  console.log('1) SEMUA DOKUMEN DI KOLEKSI `dosen`');
  console.log('='.repeat(78));

  const dosenSnapshot = await db.collection('dosen').get();
  const semuaDosen = dosenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  semuaDosen.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
  semuaDosen.forEach(d => {
    console.log(`   id: ${d.id}  |  nama: "${d.nama}"  |  nidn: ${d.nidn || d.nidk || '-'}  |  email: ${d.email || '-'}`);
  });
  console.log(`\nTotal dosen: ${semuaDosen.length}`);

  // Highlight nama-nama yang relevan dengan revisi ini
  const namaDicek = [
    'Esron', 'Erson', 'Farhan Yustisio', 'Izza Fadhlinah', 'Gunawan Tari',
    'Nur Afifah Rustan', 'Sarifuddin Ihsan', 'Salahuddin Abadi', 'Irhamni Nuhardin', 'Ramlan'
  ];
  console.log('\n--- Pencarian cepat nama-nama yang relevan dengan revisi ---');
  for (const target of namaDicek) {
    const cocok = semuaDosen.filter(d => (d.nama || '').toLowerCase().includes(target.toLowerCase()));
    if (cocok.length === 0) {
      console.log(`   ❌ "${target}" - TIDAK ADA di koleksi dosen.`);
    } else {
      cocok.forEach(d => console.log(`   ✅ "${target}" -> ketemu: id=${d.id}, nama persis="${d.nama}"`));
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log("2) MAHASISWA DENGAN kelas == 'ELK1ON'");
  console.log('='.repeat(78));

  const userSnapshot = await db.collection('users').where('kelas', '==', 'ELK1ON').get();
  const mhsOnline = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  mhsOnline.sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));
  console.log(`\nTotal mahasiswa kelas ELK1ON: ${mhsOnline.length}`);
  mhsOnline.forEach(m => console.log(`   ${m.nim}  ${m.nama}  (id: ${m.id})`));

  if (mhsOnline.length === 0) {
    console.log('\n⚠️  Tidak ada satupun user dengan field kelas="ELK1ON" persis.');
    console.log('   Coba juga cek kemungkinan variasi penulisan lain:');
    for (const variasi of ['elk1on', 'ELK1-ON', 'ELK 1 ON', 'Online', 'ELK1 Online']) {
      const cek = await db.collection('users').where('kelas', '==', variasi).get();
      console.log(`   kelas="${variasi}": ${cek.size} user`);
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log("3) DOKUMEN mataKuliah DENGAN kelas == 'ELK1ON'");
  console.log('='.repeat(78));

  const mkOnlineSnapshot = await db.collection('mataKuliah').where('kelas', '==', 'ELK1ON').get();
  console.log(`\nTotal dokumen mataKuliah kelas ELK1ON: ${mkOnlineSnapshot.size}`);
  mkOnlineSnapshot.docs.forEach(doc => {
    const mk = doc.data();
    console.log(`   id: ${doc.id}  kode: ${mk.kode}  nama: ${mk.nama}  semester: ${mk.semester}  sks: ${mk.sks}  dosenIds: ${JSON.stringify(mk.dosenIds || [])}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
