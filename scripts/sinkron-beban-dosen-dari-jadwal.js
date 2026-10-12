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
 * Pilihan SKS (beberapa MK di dokumen jadwal 2026/2027 tertulis 2*, sedangkan
 * SKS kurikulum 3):
 *   --sks=sistem      (DEFAULT) SKS yang tercatat di koleksi `mataKuliah`
 *                     (dicari lewat kode MK; bila ada beberapa dokumen MK
 *                     berkode sama dan SKS-nya berbeda, dipilih yang kelasnya
 *                     cocok dengan sesi). Kode yang tidak ada di sistem
 *                     memakai SKS kurikulum, dan dilaporkan.
 *   --sks=jadwal      angka yang tercetak di dokumen jadwal
 *   --sks=kurikulum   SKS kurikulum resmi (seed-matakuliah-2026.js)
 * Ketiga angka selalu disimpan (sksSistem, sksDokumen, sksKurikulum); ganti
 * pilihan cukup dengan menjalankan ulang script.
 *
 *   node scripts/sinkron-beban-dosen-dari-jadwal.js                 (cek dulu)
 *   node scripts/sinkron-beban-dosen-dari-jadwal.js --confirm       (simpan)
 *   node scripts/sinkron-beban-dosen-dari-jadwal.js --sks=kurikulum --confirm
 */
const { db } = require('../config/firebaseAdmin');
const { SESI, ALIAS_DI_DOKUMEN, PERIODE_IDS } = require('../data/jadwalBebanDosen');
const { kunciNama } = require('../helpers/namaDosen');
const { generatePeriodeOptions, normalizeKelas } = require('../helpers/academicHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const argSks = (process.argv.find(a => a.startsWith('--sks=')) || '--sks=sistem').split('=')[1];
if (!['sistem', 'jadwal', 'kurikulum'].includes(argSks)) {
  console.error('Nilai --sks harus "sistem", "jadwal", atau "kurikulum"'); process.exit(1);
}
const TANDA = 'sinkron-beban-dosen-dari-jadwal';
const round2 = (n) => Math.round(n * 100) / 100;

(async () => {
  console.log(`Mode : ${KONFIRMASI ? '🔴 KONFIRMASI - menulis ke database' : '🟡 DRY-RUN - tidak menulis apa pun'}`);
  console.log(`SKS  : ${{ sistem: 'SKS yang tercatat di sistem (mata kuliah)', jadwal: 'angka di dokumen jadwal', kurikulum: 'SKS kurikulum resmi' }[argSks]}\n`);

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

  // SKS yang tercatat di sistem, per kode MK: kode -> [{ kelas, sks }]
  const mkPerKode = new Map();
  mkSnap.docs.forEach(d => {
    const m = d.data();
    const sks = parseFloat(m.sks);
    if (!m.kode || isNaN(sks)) return;
    if (!mkPerKode.has(m.kode)) mkPerKode.set(m.kode, []);
    mkPerKode.get(m.kode).push({ kelas: normalizeKelas(m.kelas) || '', sks });
  });
  const KODE_ALTERNATIF = { 'WUD2202-5': ['WUD2202-5', 'WUD2202', 'WUD2203', 'WUD2204', 'WUD2205'] };
  const konflikSks = [];   // kode dengan SKS berbeda-beda antar dokumen MK
  const kodeTidakAda = new Set();
  /** SKS sesi menurut sistem, atau null bila kodenya tidak ada. */
  function sksDiSistem(sesi) {
    const kandidat = (KODE_ALTERNATIF[sesi.kodeMk] || [sesi.kodeMk]).flatMap(k => mkPerKode.get(k) || []);
    if (kandidat.length === 0) { kodeTidakAda.add(`${sesi.kodeMk} (${sesi.namaMk})`); return null; }
    const unik = Array.from(new Set(kandidat.map(x => x.sks)));
    if (unik.length === 1) return unik[0];
    // beda-beda antar dokumen: utamakan dokumen yang kelasnya cocok dengan sesi
    const kelasSesi = new Set(sesi.kelas.map(k => normalizeKelas(k) || k));
    const cocokKelas = Array.from(new Set(kandidat.filter(x => kelasSesi.has(x.kelas)).map(x => x.sks)));
    // bila tidak ada satu pun yang pasti: ambil nilai TERBANYAK di antara dokumen MK;
    // seri -> yang sama dengan SKS kurikulum, kalau tidak ada -> yang terbesar
    const hitung = new Map();
    kandidat.forEach(x => hitung.set(x.sks, (hitung.get(x.sks) || 0) + 1));
    const maks = Math.max(...hitung.values());
    let teratas = Array.from(hitung.entries()).filter(([, n]) => n === maks).map(([v]) => v);
    if (teratas.length > 1) teratas = teratas.includes(sesi.sksKurikulum) ? [sesi.sksKurikulum] : [Math.max(...teratas)];
    const dipilih = cocokKelas.length === 1 ? cocokKelas[0] : teratas[0];
    konflikSks.push(`${sesi.kodeMk} ${sesi.namaMk}: SKS di sistem berbeda-beda antar dokumen (${unik.join(' / ')}); dipakai ${dipilih} (${cocokKelas.length === 1 ? 'sesuai kelas' : 'nilai terbanyak'}) - sebaiknya diseragamkan dulu`);
    return dipilih;
  }

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
    const sksSistem = sksDiSistem(s);
    const fallbackKurikulum = s.sksKurikulum !== null ? s.sksKurikulum : s.sksDokumen;
    const sks = argSks === 'sistem' ? (sksSistem !== null ? sksSistem : fallbackKurikulum)
      : argSks === 'kurikulum' ? fallbackKurikulum : s.sksDokumen;
    return {
      id: s.id,
      data: {
        periodeId: s.periodeId, periodeLabel: info.label, urutan: info.urutan,
        kelas: s.kelas, gabungan: s.gabungan, semesterKurikulum: s.semesterKurikulum,
        kodeMk: s.kodeMk, namaMk: s.namaMk,
        sks, sksSistem, sksDokumen: s.sksDokumen, sksKurikulum: s.sksKurikulum,
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
  // ---- ringkasan asal SKS ----
  console.log('\n--- SKS yang dipakai vs sumber lain ---');
  const bandingkan = (judul, getter) => {
    const ringkas = {};
    dokumen.forEach(d => {
      const lain = getter(d.data);
      if (lain === null || lain === undefined || lain === d.data.sks) return;
      const k = `${d.data.namaMk}: dipakai ${d.data.sks} vs ${judul} ${lain}`;
      ringkas[k] = (ringkas[k] || 0) + 1;
    });
    const daftar = Object.entries(ringkas);
    console.log(daftar.length === 0 ? `   (tidak ada perbedaan dengan ${judul})` : `   Berbeda dengan ${judul}:`);
    daftar.forEach(([k, n]) => console.log(`   - ${k}  (${n} sesi)`));
  };
  bandingkan('sistem', x => x.sksSistem);
  bandingkan('dokumen jadwal', x => x.sksDokumen);
  bandingkan('kurikulum', x => x.sksKurikulum);
  konflikSks.forEach(k => console.log(`   ⚠️  ${k}`));
  if (kodeTidakAda.size > 0) {
    console.log(`   ⚠️  Kode MK tidak ditemukan di sistem (dipakai SKS kurikulum): ${Array.from(kodeTidakAda).join('; ')}`);
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
