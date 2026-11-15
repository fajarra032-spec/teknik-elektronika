// scripts/migrasi-laporan-pdk.js
// ----------------------------------------------------------------------------
// Melengkapi dokumen `laporanMagang` lama dengan pdkId / pdkKode / periodId
// (Laporan N -> periode Magang N, lihat helpers/laporanPdkHelper.js) dan
// memperbaiki judul OTOMATIS yang terlanjur memakai perusahaan periode lain.
//
// Pemakaian (dari folder proyek):
//   node scripts/migrasi-laporan-pdk.js            -> DRY-RUN (hanya menampilkan rencana)
//   node scripts/migrasi-laporan-pdk.js --apply    -> benar-benar menulis ke Firestore
//
// Aman dijalankan ulang. Tidak menyentuh status, komentar, file, maupun judul
// yang diedit manual (hanya judul berpola "Laporan Magang N [di X]").
// ----------------------------------------------------------------------------
const { db } = require('../config/firebaseAdmin');
const { getPeriodePerNomor } = require('../helpers/laporanPdkHelper');

const APPLY = process.argv.includes('--apply');
const POLA = /^Laporan Magang \d+( di .+)?$/;

(async () => {
  const snap = await db.collection('laporanMagang').get();
  console.log(`${snap.size} dokumen laporanMagang ditemukan. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const cachePeriode = {};
  let ubah = 0, tanpaPeriode = 0, skip = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const ke = Number(d.laporanKe);
    if (!d.userId || ![1, 2, 3].includes(ke)) { skip++; continue; }

    if (!cachePeriode[d.userId]) cachePeriode[d.userId] = await getPeriodePerNomor(d.userId);
    const periode = cachePeriode[d.userId][ke];
    if (!periode) {
      tanpaPeriode++;
      console.log(`  [!] ${doc.id}: belum ada periode Magang ${ke} - dilewati`);
      continue;
    }

    const patch = {};
    if (d.pdkId !== periode.pdkId) patch.pdkId = periode.pdkId;
    if ((d.pdkKode || null) !== (periode.pdkKode || null)) patch.pdkKode = periode.pdkKode || null;
    if (d.periodId !== periode.id) patch.periodId = periode.id;

    const nama = periode.perusahaan && periode.perusahaan.nama ? String(periode.perusahaan.nama).trim().replace(/\s+/g, ' ') : '';
    if (nama) {
      const judulBenar = `Laporan Magang ${ke} di ${nama}`;
      if (d.judul && POLA.test(d.judul) && d.judul !== judulBenar) patch.judul = judulBenar;
      // judulPublik (ELK Library) hanya diganti bila masih sama dengan judul otomatis lama
      if (d.judulPublik && POLA.test(d.judulPublik) && d.judulPublik !== judulBenar) patch.judulPublik = judulBenar;
    }

    if (Object.keys(patch).length === 0) continue;
    ubah++;
    console.log(`  ${doc.id}: ${JSON.stringify(patch)}`);
    if (APPLY) await doc.ref.update(patch);
  }

  console.log(`\nSelesai. Diubah: ${ubah}, tanpa periode: ${tanpaPeriode}, dilewati: ${skip}.`);
  if (!APPLY) console.log('Ini DRY-RUN. Tambahkan --apply untuk menulis perubahan.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
