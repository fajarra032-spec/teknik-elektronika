/**
 * scripts/cek-mk-per-kelas.js
 *
 * Script DIAGNOSTIK (READ-ONLY). Mengecek, untuk setiap KODE mata kuliah
 * semester tertentu (default: 1), apakah ada LEBIH DARI SATU dokumen
 * `mataKuliah` dengan kode yang sama (biasanya karena dipisah per kelas,
 * mis. "PD3203" untuk ELK1A dan "PD3203" untuk ELK1B sebagai 2 dokumen
 * beda id). Untuk tiap dokumen ditampilkan: field `kelas`, `dosenIds`
 * (sudah di-resolve ke nama dosen), dan jumlah mahasiswa yang muncul di
 * roster periode aktif sekarang.
 *
 * Ini untuk memastikan dugaan: dosen cuma ditugaskan (dosenIds) di
 * dokumen kelas ELK1A, sehingga dokumen kelas ELK1B (kalau ada,
 * terpisah) tidak pernah muncul di "MK Saya" milik dosen itu - BUKAN
 * soal query enrollment/semester (itu sudah beres).
 *
 * Cara pakai:
 *   node scripts/cek-mk-per-kelas.js         (default semester 1)
 *   node scripts/cek-mk-per-kelas.js 2       (semester lain)
 */

const { db } = require('../config/firebaseAdmin');
const { getPeriodeAktif } = require('../helpers/nilaiHelper');

async function main() {
  const semesterCek = parseInt(process.argv[2] || '1', 10);
  const periodeAktif = getPeriodeAktif();

  console.log('='.repeat(78));
  console.log(`CEK DUPLIKASI mataKuliah PER KELAS - Semester ${semesterCek}`);
  console.log(`Periode aktif sekarang: "${periodeAktif}"`);
  console.log('='.repeat(78));

  const mkSnapshot = await db.collection('mataKuliah').where('semester', '==', semesterCek).get();

  // Kelompokkan per kode
  const byKode = {};
  mkSnapshot.docs.forEach(doc => {
    const mk = { id: doc.id, ...doc.data() };
    if (!byKode[mk.kode]) byKode[mk.kode] = [];
    byKode[mk.kode].push(mk);
  });

  // Kumpulkan semua dosenId yang perlu di-resolve namanya
  const semuaDosenId = new Set();
  Object.values(byKode).flat().forEach(mk => (mk.dosenIds || []).forEach(id => semuaDosenId.add(id)));
  const dosenIdArr = [...semuaDosenId];
  const dosenDocs = dosenIdArr.length > 0
    ? await db.getAll(...dosenIdArr.map(id => db.collection('dosen').doc(id)))
    : [];
  const dosenNamaMap = {};
  dosenDocs.forEach(d => { if (d.exists) dosenNamaMap[d.id] = d.data().nama; });

  let adaDuplikat = 0;

  for (const [kode, daftarMk] of Object.entries(byKode)) {
    const tandaDuplikat = daftarMk.length > 1 ? `  ⚠️  ADA ${daftarMk.length} DOKUMEN untuk kode ini!` : '';
    if (daftarMk.length > 1) adaDuplikat++;

    console.log(`\n[${kode}] ${daftarMk[0].nama}${tandaDuplikat}`);

    for (const mk of daftarMk) {
      const enrollSnapshot = await db.collection('enrollment')
        .where('mkId', '==', mk.id)
        .where('semester', '==', periodeAktif)
        .where('status', '==', 'active')
        .count()
        .get();
      const jumlahMhs = enrollSnapshot.data().count;

      const namaDosen = (mk.dosenIds || []).map(id => dosenNamaMap[id] || `(dosen id ${id} tidak ketemu)`);

      console.log(`    id: ${mk.id}`);
      console.log(`    kelas       : ${mk.kelas || '(tidak diisi - berarti dianggap gabungan semua kelas)'}`);
      console.log(`    dosenIds    : ${namaDosen.length > 0 ? namaDosen.join(', ') : '⚠️  KOSONG, tidak ada dosen ditugaskan sama sekali!'}`);
      console.log(`    mahasiswa aktif periode ini: ${jumlahMhs}`);
    }
  }

  console.log('\n' + '='.repeat(78));
  console.log(`Total kode MK semester ${semesterCek}     : ${Object.keys(byKode).length}`);
  console.log(`Kode yang punya >1 dokumen (dipisah kelas): ${adaDuplikat}`);
  if (adaDuplikat > 0) {
    console.log('\nUntuk kode yang ⚠️ di atas: cek apakah SEMUA dokumennya (tiap kelas)');
    console.log('sudah punya dosenIds yang benar. Kalau salah satu kelasnya dosenIds-nya');
    console.log('kosong atau isinya dosen yang salah, itu sebabnya dosen bersangkutan tidak');
    console.log('melihat kelas itu di "MK Saya" - perlu diperbaiki lewat halaman admin');
    console.log('Mata Kuliah (assign dosen ke dokumen kelas yang masih kosong itu).');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
