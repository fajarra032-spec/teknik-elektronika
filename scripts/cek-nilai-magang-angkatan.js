/**
 * scripts/cek-nilai-magang-angkatan.js
 *
 * Script DIAGNOSTIK (hanya membaca, tidak mengubah apa pun): daftar mahasiswa
 * satu angkatan yang BELUM punya nilai Magang 1 / 2 / 3 di koleksi `grades`
 * (= belum muncul di KHS/Transkrip), beserta penyebab yang terlihat dari
 * periode magang & komponen nilainya.
 *
 * Cara pakai (dari folder proyek):
 *   node scripts/cek-nilai-magang-angkatan.js          -> angkatan 24 (NIM diawali '24')
 *   node scripts/cek-nilai-magang-angkatan.js 25       -> angkatan lain
 *   node scripts/cek-nilai-magang-angkatan.js 24 --semua   -> ikut Cuti/Keluar
 *   node scripts/cek-nilai-magang-angkatan.js 24 --csv     -> + simpan file CSV
 *
 * Magang N = mata kuliah PDK dengan urutanPDK = N (isPDK == true).
 */
const fs = require('fs');
const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf } = require('../helpers/nilaiHelper');
const { getNilaiDosenEfektif } = require('../helpers/nilaiMagangHelper');

const args = process.argv.slice(2);
const prefix = (args.find((a) => /^\d{2}$/.test(a)) || '24');
const SEMUA = args.includes('--semua');
const CSV = args.includes('--csv');

const tengah = (s, n) => String(s ?? '').slice(0, n).padEnd(n);

function penyebab(period, nm) {
  if (!period) return 'belum ada periode magang';
  if (period.status === 'cancelled') return 'periode dibatalkan';
  const dosen = getNilaiDosenEfektif(nm).nilai !== null;
  const lap = nm && nm.nilaiLapangan !== null && nm.nilaiLapangan !== undefined;
  if (period.status === 'completed') return 'periode selesai tapi nilai belum masuk grades (cek manual)';
  const bag = [];
  if (!nm || !nm.logbookDikunci) bag.push('logbook belum dikunci');
  bag.push(`dosen ${dosen ? '✓' : '✗'}`, `lapangan ${lap ? '✓' : '✗'}`);
  if (dosen && lap) bag.push('SIAP DIKUNCI admin');
  return `periode ${period.status}: ${bag.join(', ')}`;
}

async function main() {
  console.log('='.repeat(100));
  console.log(`MAHASISWA ANGKATAN 20${prefix} YANG BELUM MEMILIKI NILAI MAGANG`);
  console.log('='.repeat(100));

  // 1) Mata kuliah PDK -> Magang 1/2/3
  const mkSnap = await db.collection('mataKuliah').where('isPDK', '==', true).get();
  const pdk = mkSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(a.urutanPDK) - Number(b.urutanPDK));
  if (pdk.length === 0) { console.log('Tidak ada mata kuliah PDK (isPDK=true).'); process.exit(0); }
  console.log('MK PDK: ' + pdk.map((p) => `Magang ${p.urutanPDK}=${p.kode}`).join(' | ') + '\n');

  // 2) Mahasiswa angkatan
  const usSnap = await db.collection('users').where('role', '==', 'mahasiswa').get();
  let mhs = usSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => String(m.nim || '').startsWith(prefix))
    .sort((a, b) => String(a.nim).localeCompare(String(b.nim)));
  const total = mhs.length;
  if (!SEMUA) mhs = mhs.filter((m) => !['cuti', 'keluar'].includes(String(m.statusMahasiswa || '').trim().toLowerCase()));
  console.log(`Total mahasiswa NIM '${prefix}*': ${total}; dicek: ${mhs.length}${SEMUA ? '' : ' (Cuti/Keluar dilewati, pakai --semua untuk menyertakan)'}\n`);
  if (mhs.length === 0) process.exit(0);

  // 3) Nilai di grades per kode PDK (1 query per PDK), periode & nilaiMagang (1 query masing-masing)
  const gradesPerPdk = {};
  for (const p of pdk) {
    const g = await db.collection('grades').where('kodeMk', '==', p.kode).get();
    gradesPerPdk[p.id] = new Map();
    g.docs.forEach((d) => { const x = d.data(); if (x.nilai !== undefined && x.nilai !== null) gradesPerPdk[p.id].set(x.userId, x.nilai); });
  }
  const periodeAll = (await db.collection('magangPeriod').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const nmAll = (await db.collection('nilaiMagang').get()).docs.map((d) => d.data());

  const baris = [];
  let belumSemua = 0, sebagian = 0, lengkap = 0;
  for (const m of mhs) {
    const sel = pdk.map((p) => {
      const nilai = gradesPerPdk[p.id].get(m.id);
      const per = periodeAll
        .filter((x) => x.mahasiswaId === m.id && x.pdkId === p.id && x.status !== 'cancelled')
        .sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')))[0] || null;
      const nm = nmAll.find((x) => x.mahasiswaId === m.id && x.pdkId === p.id) || null;
      return { p, nilai, per, nm };
    });
    const ada = sel.filter((s) => s.nilai !== undefined).length;
    if (ada === sel.length) { lengkap++; continue; }
    ada === 0 ? belumSemua++ : sebagian++;
    baris.push({ m, sel, ada });
  }

  baris.forEach(({ m, sel }) => {
    const ringkas = sel.map((s) => s.nilai !== undefined ? `${nilaiKeHuruf(s.nilai).huruf}(${s.nilai})` : '-').join('  ');
    console.log(`${m.nim} ${tengah(m.nama, 28)} [${tengah(m.statusMahasiswa || 'Aktif', 6)}] M1/M2/M3: ${ringkas}`);
    sel.filter((s) => s.nilai === undefined).forEach((s) => {
      console.log(`      - Magang ${s.p.urutanPDK} (${s.p.kode}): ${penyebab(s.per, s.nm)}`);
    });
  });

  console.log('\n' + '-'.repeat(100));
  console.log(`REKAP: belum punya NILAI APAPUN: ${belumSemua} | baru sebagian: ${sebagian} | sudah lengkap 3 nilai: ${lengkap} | dicek: ${mhs.length}`);
  console.log('Keterangan: "-" = belum ada nilai di grades. Kunci nilai dilakukan admin di /admin/emagang (tombol Kunci Nilai).');

  if (CSV) {
    const nama = `belum-nilai-magang-angkatan${prefix}.csv`;
    const kepala = ['NIM', 'Nama', 'Status', ...pdk.map((p) => `Magang ${p.urutanPDK}`), ...pdk.map((p) => `Keterangan Magang ${p.urutanPDK}`)];
    const rows = baris.map(({ m, sel }) => [
      m.nim, m.nama, m.statusMahasiswa || 'Aktif',
      ...sel.map((s) => (s.nilai !== undefined ? s.nilai : '')),
      ...sel.map((s) => (s.nilai !== undefined ? '' : penyebab(s.per, s.nm)))
    ]);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    fs.writeFileSync(nama, '\uFEFF' + [kepala, ...rows].map((r) => r.map(esc).join(',')).join('\n'));
    console.log(`\nCSV disimpan: ${nama}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
