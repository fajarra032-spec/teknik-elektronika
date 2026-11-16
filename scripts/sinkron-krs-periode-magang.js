/**
 * scripts/sinkron-krs-periode-magang.js
 *
 * Menyusulkan KRS + enrollment untuk periode magang yang SUDAH TERLANJUR
 * dimulai (status active/locked) sebelum fitur "KRS otomatis saat mulai
 * periode" dipasang.
 *
 * Aturan (aman, bisa dijalankan berulang):
 *   - Untuk tiap magangPeriod berstatus active/locked, cek enrollment mahasiswa
 *     untuk PDK (mkId = pdkId).
 *   - Sudah ada enrollment 'active'                      -> dilewati.
 *   - Ada enrollment status lain selain 'dibatalkan'
 *     (mis. selesai/lulus)                               -> dilewati & dilaporkan
 *                                                           (tidak ditebak).
 *   - Belum ada sama sekali / hanya 'dibatalkan'         -> dibuatkan KRS approved
 *     + enrollment aktif, semester akademik dihitung dari tanggal periode dibuat.
 *   - Mahasiswa Cuti/Keluar tidak diubah (hanya dilaporkan).
 *
 * DEFAULT DRY-RUN. Perlu --confirm untuk benar-benar menulis.
 *
 *   node scripts/sinkron-krs-periode-magang.js
 *   node scripts/sinkron-krs-periode-magang.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { createKrsDanEnrollment } = require('../helpers/paketKurikulumHelper');
const { getSemesterForDate } = require('../helpers/academicHelper');
const { isIdTidakIkut } = require('../helpers/statusMahasiswaHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const ACTOR = 'sistem-sinkron-magang';

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS KRS/ENROLLMENT' : '🟡 DRY-RUN - cuma simulasi'}\n`);

  const snap = await db.collection('magangPeriod')
    .where('status', 'in', ['active', 'locked'])
    .get();
  console.log(`Periode magang active/locked: ${snap.size}\n`);

  const ringkas = { sudahAda: 0, dibuat: 0, dilewatiStatusLain: 0, dilewatiTidakIkut: 0, error: 0 };

  for (const doc of snap.docs) {
    const p = doc.data();
    const label = `${p.pdkKode || p.pdkId} | mhs ${p.mahasiswaId}`;
    try {
      if (await isIdTidakIkut(db, p.mahasiswaId)) {
        console.log(`⏭  ${label}: mahasiswa Cuti/Keluar - dilewati`);
        ringkas.dilewatiTidakIkut++;
        continue;
      }

      const enrSnap = await db.collection('enrollment')
        .where('userId', '==', p.mahasiswaId)
        .where('mkId', '==', p.pdkId)
        .get();
      const statuses = enrSnap.docs.map(d => d.data().status);

      if (statuses.includes('active')) {
        ringkas.sudahAda++;
        continue;
      }
      if (statuses.some(s => s !== 'dibatalkan')) {
        console.log(`⚠️  ${label}: ada enrollment berstatus [${statuses.join(', ')}] - dilewati, cek manual`);
        ringkas.dilewatiStatusLain++;
        continue;
      }

      const academicLabel = getSemesterForDate(p.createdAt || p.tanggalMulai || new Date()).label;
      console.log(`➕ ${label}: ${p.pdkNama || ''} -> KRS ${academicLabel}`);
      if (KONFIRMASI) {
        await createKrsDanEnrollment(db, p.mahasiswaId, [p.pdkId], academicLabel, ACTOR, {
          dibuatOlehSistem: true,
          catatan: `KRS disusulkan otomatis (sinkron periode magang ${p.pdkNama || ''})`
        });
      }
      ringkas.dibuat++;
    } catch (e) {
      console.error(`❌ ${label}:`, e.message);
      ringkas.error++;
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Sudah punya KRS/enrollment aktif : ${ringkas.sudahAda}`);
  console.log(`${KONFIRMASI ? 'KRS dibuat' : 'Akan dibuat KRS'}                  : ${ringkas.dibuat}`);
  console.log(`Dilewati (status lain, cek manual): ${ringkas.dilewatiStatusLain}`);
  console.log(`Dilewati (Cuti/Keluar)           : ${ringkas.dilewatiTidakIkut}`);
  console.log(`Error                            : ${ringkas.error}`);
  if (!KONFIRMASI) console.log('\nDry-run selesai. Tambahkan --confirm untuk menulis.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
