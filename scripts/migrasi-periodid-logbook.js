/**
 * scripts/migrasi-periodid-logbook.js
 *
 * Melengkapi field `periodId` pada logbookMagang LAMA (entri baru sudah menyimpannya).
 * Pencocokan: userId + pdkId -> periode milik mahasiswa itu; bila PDK punya >1 periode,
 * dipilih periode yang memegang TANGGAL entri (tanggalMulai terakhir yang <= tanggal).
 * Periode 'cancelled' diabaikan. Entri yang sudah punya periodId tidak disentuh.
 *
 * DEFAULT DRY-RUN. Perlu --confirm untuk menulis. Aman diulang.
 *   node scripts/migrasi-periodid-logbook.js
 *   node scripts/migrasi-periodid-logbook.js --confirm
 * Saran: jalankan scripts/backup-collections.js dulu.
 */
const { db, admin } = require('../config/firebaseAdmin');
const { pilihPeriodeUntukTanggal } = require('../helpers/periodeMagangHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const HALAMAN = 400;

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS' : '🟡 DRY-RUN - hanya simulasi'}\n`);

  const periodeSnap = await db.collection('magangPeriod').get();
  const peta = new Map(); // "mahasiswaId|pdkId" -> [periode]
  periodeSnap.docs.forEach((d) => {
    const p = { id: d.id, ...d.data() };
    if (p.status === 'cancelled') return;
    const k = `${p.mahasiswaId}|${p.pdkId}`;
    if (!peta.has(k)) peta.set(k, []);
    peta.get(k).push(p);
  });
  console.log(`Periode dimuat: ${periodeSnap.size}`);

  const rekap = { dibaca: 0, sudahAda: 0, diisi: 0, tanpaPeriode: 0 };
  const contohTanpa = [];
  let terakhir = null;

  for (;;) {
    let q = db.collection('logbookMagang')
      .orderBy(admin.firestore.FieldPath.documentId())
      .select('userId', 'pdkId', 'tanggal', 'periodId')
      .limit(HALAMAN);
    if (terakhir) q = q.startAfter(terakhir);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let adaTulis = false;
    snap.docs.forEach((doc) => {
      rekap.dibaca++;
      const x = doc.data();
      if (x.periodId) { rekap.sudahAda++; return; }
      const periode = pilihPeriodeUntukTanggal(peta.get(`${x.userId}|${x.pdkId}`) || [], x.tanggal);
      if (!periode) {
        rekap.tanpaPeriode++;
        if (contohTanpa.length < 10) contohTanpa.push(`${doc.id} (user ${x.userId}, pdk ${x.pdkId}, ${x.tanggal})`);
        return;
      }
      rekap.diisi++;
      if (KONFIRMASI) { batch.update(doc.ref, { periodId: periode.id }); adaTulis = true; }
    });
    if (KONFIRMASI && adaTulis) await batch.commit();
    terakhir = snap.docs[snap.docs.length - 1];
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Logbook dibaca             : ${rekap.dibaca}`);
  console.log(`Sudah punya periodId       : ${rekap.sudahAda}`);
  console.log(`${KONFIRMASI ? 'Diisi periodId' : 'Akan diisi periodId'}         : ${rekap.diisi}`);
  console.log(`Tanpa periode cocok        : ${rekap.tanpaPeriode}`);
  contohTanpa.forEach((c) => console.log('   -', c));
  if (!KONFIRMASI) console.log('\nDry-run selesai. Tambahkan --confirm untuk menulis.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
