/**
 * scripts/masukkan-mk-lama-ke-periode.js
 *
 * Memasukkan MK "lama / belum ber-periode" ke satu periode tertentu
 * (default: Genap 2025/2026) dengan membuat dokumen
 *   mataKuliah/{id}/pengampuPeriode/{periodeId}
 * berisi dosenIds yang saat ini tertulis di mk.dosenIds.
 *
 * MK yang diproses = dosenIds tidak kosong, TIDAK terdaftar di periode aktif
 * (tidak ada pengampuPeriode periode aktif dan periodeAktifId bukan periode
 * aktif), dan belum punya pengampuPeriode untuk periode tujuan.
 * Field lain di dokumen mataKuliah TIDAK diubah.
 *
 * DEFAULT DRY-RUN. Perlu --confirm untuk benar-benar menulis.
 *
 * Cara pakai (Command Prompt / PowerShell, dari folder proyek):
 *   node scripts/masukkan-mk-lama-ke-periode.js
 *   node scripts/masukkan-mk-lama-ke-periode.js --confirm
 * Opsi:
 *   --periode=genap-2025-2026   periode tujuan (default seperti ini)
 *   --kode=ELK101,PLC202        batasi hanya kode MK tertentu
 *   --dosen=<uid>               batasi hanya MK yang diampu dosen ini
 */

const { db } = require('../config/firebaseAdmin');
const academic = require('../helpers/academicHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const arg = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=').trim();
const periodeId = arg('periode') || 'genap-2025-2026';
const kodeFilter = arg('kode') ? arg('kode').split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : null;
const dosenFilter = arg('dosen') || null;

async function main() {
  console.log(`Mode: ${KONFIRMASI ? 'KONFIRMASI - AKAN MENULIS' : 'DRY-RUN - hanya simulasi'}`);

  const info = academic.generatePeriodeOptions(50, 5).find(p => p.id === periodeId);
  if (!info) {
    console.error(`Periode "${periodeId}" tidak dikenali. Contoh: genap-2025-2026, ganjil-2025-2026`);
    process.exit(1);
  }
  const aktifId = academic.getActivePeriodeId();
  if (periodeId === aktifId) {
    console.error('Periode tujuan sama dengan periode aktif - dibatalkan agar MK aktif tidak tertimpa.');
    process.exit(1);
  }
  console.log(`Periode tujuan: ${info.label} (${periodeId}) | periode aktif: ${aktifId}\n`);

  const snap = await db.collection('mataKuliah').get();
  let ok = 0, lewat = 0;

  for (const doc of snap.docs) {
    const mk = doc.data();
    const dosenIds = Array.isArray(mk.dosenIds) ? mk.dosenIds.filter(Boolean) : [];
    if (!dosenIds.length) continue;
    if (kodeFilter && !kodeFilter.includes(String(mk.kode || '').toUpperCase())) continue;
    if (dosenFilter && !dosenIds.includes(dosenFilter)) continue;

    const aktifDoc = await doc.ref.collection('pengampuPeriode').doc(aktifId).get();
    const terdaftarAktif = aktifDoc.exists || mk.periodeAktifId === aktifId;
    if (terdaftarAktif) continue; // MK periode berjalan - jangan disentuh

    const tujuanDoc = await doc.ref.collection('pengampuPeriode').doc(periodeId).get();
    if (tujuanDoc.exists) {
      console.log(`- [${mk.kode}] ${mk.nama} (kelas ${mk.kelas || '-'}) : sudah ada di ${info.label}, dilewati`);
      lewat++;
      continue;
    }

    console.log(`+ [${mk.kode}] ${mk.nama} (kelas ${mk.kelas || '-'}) id=${doc.id} -> ${info.label}, dosenIds=${dosenIds.length}`);
    if (KONFIRMASI) {
      await doc.ref.collection('pengampuPeriode').doc(periodeId).set({
        periodeId,
        label: info.label,
        semester: info.semester,
        tahunAwal: info.tahunAwal,
        tahunAkhir: info.tahunAkhir,
        urutan: info.urutan,
        dosenIds,
        updatedAt: new Date().toISOString()
      });
    }
    ok++;
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`${KONFIRMASI ? 'Dimasukkan' : 'AKAN dimasukkan'} ke ${info.label}: ${ok} MK | dilewati: ${lewat}`);
  if (!KONFIRMASI && ok > 0) {
    console.log('\nBaru DRY-RUN. Jika daftar sudah sesuai, jalankan:');
    console.log('   node scripts/masukkan-mk-lama-ke-periode.js --confirm');
  }
  process.exit(0);
}

main().catch(err => { console.error('Gagal menjalankan script:', err); process.exit(1); });
