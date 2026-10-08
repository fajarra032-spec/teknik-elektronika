/**
 * scripts/sinkron-beban-dosen-dari-jadwal.js
 *
 * Memasukkan/memperbaiki REKAP BEBAN MENGAJAR DOSEN per semester ke koleksi
 * Firestore `bebanMengajar` (1 dokumen = 1 sesi mengajar), bersumber dari 3
 * dokumen jadwal resmi (lihat data/jadwalBebanDosen.js):
 *   - Ganjil 2025/2026 (28 sesi)   - Genap 2025/2026 (14 sesi)
 *   - Ganjil 2026/2027 (26 sesi)
 *
 * Laporan Awal Semester membaca koleksi ini dan MENGUTAMAKANNYA untuk
 * periode yang punya data di sini; periode lain tetap memakai data pengampu
 * di mata kuliah. Script ini TIDAK mengubah dokumen mataKuliah, enrollment,
 * jadwal, maupun akun dosen - hanya menulis `bebanMengajar`.
 *
 * Yang dilakukan:
 *  1. Mencocokkan nama dosen di jadwal dengan koleksi `dosen` (kunci nama:
 *     tanpa gelar/tanda baca). Yang cocok disimpan id-nya; yang BELUM ADA di
 *     sistem tetap dicatat dengan namanya (dilaporkan, tidak dibuatkan akun -
 *     tambahkan lewat Admin > Dosen, nanti otomatis tertaut tanpa jalankan
 *     ulang script).
 *  2. Upsert tiap sesi dengan id tetap (aman diulang, tidak dobel).
 *  3. Menghapus sesi YANG DIBUAT SCRIPT INI untuk ketiga periode tadi bila
 *     sudah tidak ada di data jadwal (mis. setelah Anda mengoreksi data).
 *     Dokumen buatan orang/script lain tidak disentuh.
 *
 * Pilihan SKS (4 MK semester 1 Ganjil 2026/2027 di dokumen tertulis 2*,
 * sedangkan SKS kurikulum 3):
 *   --sks=jadwal      (default) pakai angka yang tercetak di dokumen jadwal
 *   --sks=kurikulum   pakai SKS kurikulum resmi (seed-matakuliah-2026.js)
 * Kedua angka selalu disimpan (sksDokumen & sksKurikulum); ganti pilihan
 * cukup dengan menjalankan ulang script.
 *
 *   node scripts/sinkron-beban-dosen-dari-jadwal.js                 (cek dulu)
 *   node scripts/sinkron-beban-dosen-dari-jadwal.js --confirm       (simpan)
 *   node scripts/sinkron-beban-dosen-dari-jadwal.js --sks=kurikulum --confirm
 */
const { db } = require('../config/firebaseAdmin');
const { SESI, ALIAS_DI_DOKUMEN, PERIODE_IDS } = require('../data/jadwalBebanDosen');
const { kunciNama } = require('../helpers/namaDosen');
const { generatePeriodeOptions } = require('../helpers/academicHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const argSks = (process.argv.find(a => a.startsWith('--sks=')) || '--sks=jadwal').split('=')[1];
if (!['jadwal', 'kurikulum'].includes(argSks)) {
  console.error('Nilai --sks harus "jadwal" atau "kurikulum"'); process.exit(1);
}
const TANDA = 'sinkron-beban-dosen-dari-jadwal';
const round2 = (n) => Math.round(n * 100) / 100;

(async () => {
  console.log(`Mode : ${KONFIRMASI ? '🔴 KONFIRMASI - menulis ke database' : '🟡 DRY-RUN - tidak menulis apa pun'}`);
  console.log(`SKS  : ${argSks === 'jadwal' ? 'angka di dokumen jadwal' : 'SKS kurikulum resmi'}\n`);

  // ---- info periode (label/urutan) ----
  const infoPeriode = {};
  generatePeriodeOptions(50, 5).forEach(p => { infoPeriode[p.id] = p; });
  for (const pid of PERIODE_IDS) {
    if (!infoPeriode[pid]) { console.error(`Periode ${pid} tidak dikenali academicHelper`); process.exit(1); }
  }

  // ---- cocokkan dosen ----
  const dosenSnap = await db.collection('dosen').get();
  const perKunci = new Map(); // kunci -> [docs]
  dosenSnap.docs.forEach(d => {
    const k = kunciNama(d.data().nama);
    if (!perKunci.has(k)) perKunci.set(k, []);
    perKunci.get(k).push(d);
  });

  // id dosen yang benar-benar dipakai sebagai pengampu di mata kuliah (untuk memilih di antara nama ganda)
  const mkSnap = await db.collection('mataKuliah').get();
  const dosenDipakai = new Set();
  mkSnap.docs.forEach(d => (d.data().dosenIds || []).forEach(id => dosenDipakai.add(id)));

  const namaUnik = Array.from(new Set(SESI.flatMap(s => s.dosen)));
  const pemetaan = new Map(); // nama kanonik -> {id|null, status}
  console.log('--- Pencocokan dosen (' + namaUnik.length + ' nama di jadwal) ---');
  let adaMasalah = false;
  namaUnik.sort().forEach(nama => {
    const cocok = perKunci.get(kunciNama(nama)) || [];
    if (cocok.length === 1) {
      pemetaan.set(nama, { id: cocok[0].id, status: 'cocok' });
      const namaDb = cocok[0].data().nama;
      console.log(`  ✓ ${nama}${namaDb !== nama ? `   (di sistem: "${namaDb}")` : ''}`);
    } else if (cocok.length > 1) {
      const dipakai = cocok.filter(d => dosenDipakai.has(d.id));
      if (dipakai.length === 1) {
        pemetaan.set(nama, { id: dipakai[0].id, status: 'ganda-dipilih' });
        console.log(`  ✓ ${nama}: ada ${cocok.length} dokumen dosen bernama sama; dipilih yang dipakai di mata kuliah (id ${dipakai[0].id})`);
        console.log(`     ℹ️  Sebaiknya digabungkan: scripts/cek-dosen-duplikat.js lalu scripts/gabungkan-dosen-duplikat.js`);
      } else {
        pemetaan.set(nama, { id: null, status: 'ganda' });
        adaMasalah = true;
        console.log(`  ⚠️  ${nama}: ${cocok.length} dosen di sistem berkunci sama dan tidak jelas mana yang dipakai -> TIDAK ditautkan. Jalankan scripts/cek-dosen-duplikat.js lalu scripts/gabungkan-dosen-duplikat.js`);
      }
    } else {
      pemetaan.set(nama, { id: null, status: 'belum-ada' });
      console.log(`  ➕ ${nama}: belum ada di data dosen (dicatat dengan nama; tambahkan lewat Admin > Dosen)`);
    }
  });

  // ---- alias yang dianggap orang sama ----
  console.log('\n--- Penulisan nama di dokumen yang dianggap ORANG YANG SAMA (mohon periksa) ---');
  ALIAS_DI_DOKUMEN.forEach(a => console.log(`  • [${a.dok}] "${a.tertulis}"  =>  ${a.jadiNama}   (${a.alasan})`));

  // ---- bangun dokumen ----
  const dokumen = SESI.map(s => {
    const info = infoPeriode[s.periodeId];
    const sks = argSks === 'kurikulum' && s.sksKurikulum !== null ? s.sksKurikulum : s.sksDokumen;
    return {
      id: s.id,
      data: {
        periodeId: s.periodeId, periodeLabel: info.label, urutan: info.urutan,
        kelas: s.kelas, gabungan: s.gabungan, semesterKurikulum: s.semesterKurikulum,
        kodeMk: s.kodeMk, namaMk: s.namaMk,
        sks, sksDokumen: s.sksDokumen, sksKurikulum: s.sksKurikulum,
        dosen: s.dosen.map(n => ({ nama: n, key: kunciNama(n), id: (pemetaan.get(n) || {}).id || null })),
        keterangan: s.keterangan, sumber: s.sumber,
        dibuatOleh: TANDA, updatedAt: new Date().toISOString()
      }
    };
  });

  // ---- ringkasan per periode ----
  console.log('\n--- Ringkasan beban SKS per dosen (SKS penuh per dosen; sesi gabungan dihitung SEKALI) ---');
  const idsBaru = new Set(dokumen.map(d => d.id));
  for (const pid of PERIODE_IDS) {
    const doks = dokumen.filter(d => d.data.periodeId === pid);
    const total = {};
    doks.forEach(d => d.data.dosen.forEach(x => { total[x.nama] = round2((total[x.nama] || 0) + d.data.sks); }));
    console.log(`\n${infoPeriode[pid].label}: ${doks.length} sesi, ${Object.keys(total).length} dosen`);
    Object.entries(total).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .forEach(([n, v]) => console.log(`   ${String(v).padStart(4)} SKS  ${n}`));
    doks.filter(d => d.data.dosen.length === 0).forEach(d =>
      console.log(`   ⚠️  Sesi TANPA dosen: ${d.data.namaMk} [${d.data.kelas.join('+')}] - ${d.data.keterangan}`));
  }
  const beda = SESI.filter(s => s.sksKurikulum !== null && s.sksKurikulum !== s.sksDokumen);
  if (beda.length > 0) {
    console.log(`\nℹ️  ${beda.length} sesi punya SKS di dokumen berbeda dari kurikulum (dipakai: ${argSks}):`);
    const ringkas = {};
    beda.forEach(s => { const k = `${s.namaMk}: dokumen ${s.sksDokumen} vs kurikulum ${s.sksKurikulum}`; ringkas[k] = (ringkas[k] || 0) + 1; });
    Object.entries(ringkas).forEach(([k, n]) => console.log(`   - ${k}  (${n} sesi)`));
  }

  // ---- sesi lama buatan script ini yang sudah tidak ada ----
  const lama = await db.collection('bebanMengajar').get();
  const usang = lama.docs.filter(d => {
    const x = d.data();
    return x.dibuatOleh === TANDA && PERIODE_IDS.includes(x.periodeId) && !idsBaru.has(d.id);
  });
  const ada = new Set(lama.docs.map(d => d.id));
  const baru = dokumen.filter(d => !ada.has(d.id)).length;
  console.log(`\n--- Rencana penulisan ---\n   dibuat baru: ${baru}   diperbarui: ${dokumen.length - baru}   dihapus (usang): ${usang.length}`);
  usang.forEach(d => console.log(`   🗑️  ${d.id}`));

  if (!KONFIRMASI) {
    console.log('\n👉 Ini DRY-RUN. Jika sudah benar, jalankan ulang dengan --confirm untuk menyimpan.');
    process.exit(0);
  }

  for (const d of dokumen) await db.collection('bebanMengajar').doc(d.id).set(d.data);
  for (const d of usang) await d.ref.delete();
  console.log(`\n✅ Tersimpan: ${dokumen.length} sesi, ${usang.length} dihapus. Buka Admin > Laporan Awal Semester.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
