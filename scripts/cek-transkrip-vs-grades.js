/**
 * scripts/cek-transkrip-vs-grades.js
 *
 * Script DIAGNOSTIK (read-only, tidak mengubah apa pun). Untuk satu atau
 * beberapa NIM, membandingkan:
 *   A. Data MENTAH di collection `grades` (apa yang sungguhan tersimpan)
 *   B. Hasil pemanggilan LANGSUNG ke helpers/nilaiHelper.js -> getTranskripMahasiswa()
 *      (fungsi PERSIS yang sama dipakai halaman Transkrip & KHS mahasiswa)
 *
 * Kalau A dan B beda (ada nilai di grades tapi TIDAK muncul di hasil B),
 * berarti ada bug spesifik di fungsi transkrip untuk kasus itu - dan script
 * ini akan menyebutkan persis kodeMk/semester mana yang "hilang" beserta
 * dugaan sebabnya (duplikat kode MK di grades untuk semester yang sama,
 * mis.), supaya tidak perlu menebak-nebak.
 *
 * Kalau A dan B SAMA (semua nilai di grades muncul juga di hasil transkrip),
 * berarti datanya baik-baik saja di level backend - kalau tetap "kelihatan
 * hilang" di web, kemungkinan besar mahasiswa/admin sedang melihat
 * dropdown semester yang salah di halaman KHS/Transkrip (bukan "Semua").
 *
 * Cara pakai:
 *   node scripts/cek-transkrip-vs-grades.js 23302001 24302005 25302001
 *   (bisa satu atau banyak NIM sekaligus, dipisah spasi)
 */

const { db } = require('../config/firebaseAdmin');
const { getTranskripMahasiswa } = require('../helpers/nilaiHelper');

const nimList = process.argv.slice(2);

if (nimList.length === 0) {
  console.log('Cara pakai: node scripts/cek-transkrip-vs-grades.js <NIM1> <NIM2> ...');
  console.log('Contoh    : node scripts/cek-transkrip-vs-grades.js 23302001 24302005');
  process.exit(1);
}

async function cekSatuMahasiswa(nim) {
  console.log('\n' + '='.repeat(70));
  console.log(`NIM: ${nim}`);
  console.log('='.repeat(70));

  const userSnap = await db.collection('users').where('nim', '==', nim).limit(1).get();
  if (userSnap.empty) {
    console.log('❌ User dengan NIM ini tidak ditemukan di database.');
    return;
  }
  const userId = userSnap.docs[0].id;
  const nama = userSnap.docs[0].data().nama;
  console.log(`Nama: ${nama}  (userId: ${userId})`);

  // A. Data mentah di 'grades'
  const gradesSnapshot = await db.collection('grades').where('userId', '==', userId).get();
  const gradesMentah = gradesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`\nA) Data mentah di collection 'grades': ${gradesMentah.length} dokumen`);
  gradesMentah
    .sort((a, b) => String(a.semester).localeCompare(String(b.semester)))
    .forEach(g => console.log(`   - [${g.semester}] ${g.kodeMk} - ${g.namaMk || '(tanpa nama)'}: nilai ${g.nilai}`));

  // B. Hasil fungsi getTranskripMahasiswa() yang SESUNGGUHNYA dipakai halaman Transkrip/KHS
  const { items } = await getTranskripMahasiswa(userId);
  console.log(`\nB) Hasil getTranskripMahasiswa() (yang tampil di web): ${items.length} baris`);
  items
    .sort((a, b) => String(a.semester).localeCompare(String(b.semester)))
    .forEach(it => console.log(`   - [${it.semester}] ${it.kodeMk} - ${it.namaMk}: nilai ${it.nilai === null ? '(belum ada)' : it.nilai}`));

  // Selisih: kunci "semester|kodeMk" yang ada di A tapi TIDAK ada di B
  const kunciB = new Set(items.map(it => `${it.semester}|${it.kodeMk}`));
  const hilang = gradesMentah.filter(g => !kunciB.has(`${g.semester}|${g.kodeMk}`));

  if (hilang.length === 0) {
    console.log('\n✅ COCOK - semua nilai di grades muncul juga di hasil transkrip.');
    console.log('   Kalau di web kelihatan "hilang", kemungkinan besar dropdown semester');
    console.log('   di halaman KHS/Transkrip sedang memilih semester lain (bukan yang ini).');
  } else {
    console.log(`\n❌ ADA ${hilang.length} NILAI DI GRADES YANG TIDAK MUNCUL DI TRANSKRIP:`);
    hilang.forEach(g => {
      // Cek dugaan sebab: apakah ada grade LAIN dengan semester+kodeMk PERSIS SAMA
      // (kalau ya, salah satu "ketiban"/ketimpa yang lain di gradeMap)
      const kembar = gradesMentah.filter(g2 => g2.semester === g.semester && g2.kodeMk === g.kodeMk && g2.id !== g.id);
      console.log(`   - [${g.semester}] ${g.kodeMk} - ${g.namaMk} (docId grades: ${g.id})`);
      if (kembar.length > 0) {
        console.log(`     ⚠️  Dugaan sebab: ada ${kembar.length} dokumen grades LAIN dengan semester+kodeMk PERSIS SAMA`);
        console.log(`         (docId: ${kembar.map(k => k.id).join(', ')}) - salah satunya "ketimpa" saat digabung.`);
      } else {
        console.log(`     ⚠️  Tidak ada duplikat kodeMk - kemungkinan mataKuliah dengan kode ini`);
        console.log(`         sudah tidak ada lagi / berubah kode di collection mataKuliah saat ini.`);
      }
    });
  }
}

async function main() {
  for (const nim of nimList) {
    await cekSatuMahasiswa(nim);
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
