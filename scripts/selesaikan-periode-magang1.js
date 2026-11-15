/**
 * scripts/selesaikan-periode-magang1.js
 *
 * Untuk mahasiswa satu angkatan yang SUDAH punya nilai Magang 1 di `grades`,
 * tandai periode Magang 1-nya (koleksi `magangPeriod`) sebagai 'completed' dan
 * catat nilai akhirnya di periode itu (nilai.angka/huruf = nilai di grades).
 *
 * TIDAK mengubah `grades`, logbook, laporan, maupun komponen nilai Dosen/Lapangan
 * (untuk mengisi komponen itu pakai scripts/sinkron-nilai-magang-dari-grades.js).
 * Periode 'cancelled' diabaikan; yang sudah 'completed' dilewati; mahasiswa
 * tanpa periode Magang 1 hanya dilaporkan (periode harus dibuat dulu oleh admin).
 *
 * Cara pakai (dari folder proyek):
 *   node scripts/selesaikan-periode-magang1.js 24            -> DRY-RUN (hanya tampilkan)
 *   node scripts/selesaikan-periode-magang1.js 24 --apply    -> terapkan
 *   Opsi: --semua (ikut mahasiswa Cuti/Keluar)
 * Aman dijalankan ulang.
 */
const { db } = require('../config/firebaseAdmin');
const { updatePeriodStatus, setNilaiMagang } = require('../models/magangPeriodModel');

const args = process.argv.slice(2);
const prefix = args.find((a) => /^\d{2}$/.test(a)) || '24';
const APPLY = args.includes('--apply');
const SEMUA = args.includes('--semua');
const OLEH = 'selesaikan-periode-magang1';

async function main() {
  console.log('='.repeat(96));
  console.log(`SELESAIKAN PERIODE MAGANG 1 - ANGKATAN 20${prefix} - ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(96));

  const pdk = (await db.collection('mataKuliah').where('isPDK', '==', true).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(a.urutanPDK) - Number(b.urutanPDK))[0];
  if (!pdk) { console.log('Tidak ada mata kuliah PDK.'); process.exit(0); }
  console.log(`Magang 1 = ${pdk.kode} (${pdk.nama || '-'})\n`);

  let mhs = (await db.collection('users').where('role', '==', 'mahasiswa').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => String(m.nim || '').startsWith(prefix))
    .sort((a, b) => String(a.nim).localeCompare(String(b.nim)));
  if (!SEMUA) mhs = mhs.filter((m) => !['cuti', 'keluar'].includes(String(m.statusMahasiswa || '').trim().toLowerCase()));

  const nilai = {};
  (await db.collection('grades').where('kodeMk', '==', pdk.kode).get()).docs.forEach((d) => {
    const g = d.data();
    if (g.nilai === null || g.nilai === undefined || isNaN(Number(g.nilai))) return;
    const t = String(g.updatedAt || g.createdAt || '');
    if (!nilai[g.userId] || t > nilai[g.userId].t) nilai[g.userId] = { v: Number(g.nilai), t };
  });
  const periodeAll = (await db.collection('magangPeriod').where('pdkId', '==', pdk.id).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }));

  const r = { selesai: 0, sudah: 0, tanpaPeriode: 0, tanpaNilai: 0 };
  for (const m of mhs) {
    const g = nilai[m.id];
    if (!g) { r.tanpaNilai++; continue; }
    const p = periodeAll
      .filter((x) => x.mahasiswaId === m.id && x.status !== 'cancelled')
      .sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')))[0];
    const nama = String(m.nama || '').slice(0, 28).padEnd(28);
    if (!p) { r.tanpaPeriode++; console.log(`${m.nim} ${nama} nilai ${g.v}: [!] belum ada periode Magang 1 - buat dulu di /admin/emagang`); continue; }
    if (p.status === 'completed') { r.sudah++; continue; }

    console.log(`${m.nim} ${nama} nilai ${g.v}: periode ${p.status} -> completed`);
    r.selesai++;
    if (APPLY) {
      const nilaiSudahAda = p.nilai && p.nilai.angka !== null && p.nilai.angka !== undefined;
      if (!nilaiSudahAda) await setNilaiMagang(p.id, g.v, 'Nilai akhir dari Input Nilai admin (grades)', OLEH, {});
      await updatePeriodStatus(p.id, 'completed', 'Periode Magang 1 diselesaikan (mahasiswa sudah punya nilai akhir di grades)', OLEH);
    }
  }

  console.log('\n' + '-'.repeat(96));
  console.log(`REKAP: ${APPLY ? 'diselesaikan' : 'akan diselesaikan'}: ${r.selesai} | sudah completed: ${r.sudah} | belum ada periode Magang 1: ${r.tanpaPeriode} | belum punya nilai Magang 1 (dilewati): ${r.tanpaNilai}`);
  if (!APPLY) console.log('\nINI DRY-RUN - belum ada yang ditulis. Tambahkan --apply untuk menerapkan.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
