/**
 * scripts/rekap-edom-periode.js   (READ-ONLY, tidak mengubah data)
 *
 * Mengambil rekapan EDOM per periode dari Firestore dan menampilkannya di terminal,
 * dengan opsi ekspor ke CSV (bisa dibuka langsung di Excel).
 *
 * Jalankan dari ROOT proyek (C:\Users\ASUS\teknik-elektronika):
 *
 *   node scripts/rekap-edom-periode.js --list                 daftar semua periode + jumlah respon
 *   node scripts/rekap-edom-periode.js                        rekap periode AKTIF (atau terbaru bila tak ada yang aktif)
 *   node scripts/rekap-edom-periode.js --periode=ID_PERIODE   rekap periode tertentu
 *   node scripts/rekap-edom-periode.js --periode=ID --csv     + simpan CSV ke folder exports\
 *   node scripts/rekap-edom-periode.js --periode=ID --dosen=hairia     detail satu dosen (cari sebagian nama)
 *   node scripts/rekap-edom-periode.js --periode=ID --detail  + CSV per respon (satu baris per pengisian)
 *   node scripts/rekap-edom-periode.js --periode=ID --komentar        tampilkan SEMUA komentar teks per dosen (+ --csv untuk CSV komentar)
 *   node scripts/rekap-edom-periode.js --periode=ID --json    keluaran JSON mentah
 *
 * Opsi lain:
 *   --sep=,     pemisah CSV (default ; agar langsung rapi di Excel Windows berlokal Indonesia)
 *   --out=DIR   folder keluaran CSV (default: exports)
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db } = require('../config/firebaseAdmin');
const {
  predikat, ambilKuisionerMap, ambilResponPeriode, hitungRekapPeriode, hitungDetailDosen,
} = require('../helpers/edomRekapHelper');

if (!db) {
  console.error('\nFirebase tidak terinisialisasi. Pastikan salah satu ada:');
  console.error('  - file .env di root proyek berisi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  console.error('  - atau file config\\serviceAccountKey.json');
  process.exit(1);
}

// ---------- argumen ----------
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, def = null) => {
  const a = args.find(x => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3).replace(/^"|"$/g, '') : def;
};
const SEP = opt('sep', ';');
const OUT_DIR = path.resolve(path.join(__dirname, '..'), opt('out', 'exports'));

// ---------- util tampilan ----------
const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
const padL = (s, n) => String(s ?? '').padStart(n).slice(-n);
const garis = '='.repeat(110);

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}
function tulisCsv(namaFile, baris) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, namaFile);
  // BOM supaya Excel membaca UTF-8 dengan benar
  fs.writeFileSync(file, '\uFEFF' + baris.map(r => r.map(csvCell).join(SEP)).join('\r\n'), 'utf8');
  return file;
}
const aman = (s) => String(s).replace(/[^\w.-]+/g, '_');

function tglRespon(r) {
  const t = r.createdAt || r.tanggal || r.submittedAt;
  if (!t) return '';
  const d = typeof t.toDate === 'function' ? t.toDate() : new Date(t);
  return isNaN(d) ? '' : d.toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
}

// ---------- main ----------
(async () => {
  const hari = new Date().toISOString().split('T')[0];
  const periodeSnap = await db.collection('edom_periode').get();
  const semuaPeriode = periodeSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')));

  if (!semuaPeriode.length) {
    console.error('Belum ada periode EDOM di koleksi edom_periode.');
    process.exit(1);
  }

  // --- mode --list ---
  if (flag('list')) {
    const responSnap = await db.collection('edom_respon').get();
    const hitung = {};
    responSnap.docs.forEach(d => { const p = d.data().periodeId || '(tanpa periode)'; hitung[p] = (hitung[p] || 0) + 1; });
    console.log(garis);
    console.log('DAFTAR PERIODE EDOM  (hari ini: ' + hari + ')');
    console.log(garis);
    console.log(pad('ID', 24) + pad('Status', 10) + pad('Mulai', 12) + pad('Selesai', 12) + padL('Respon', 8) + '  Keterangan');
    semuaPeriode.forEach(p => {
      const aktif = p.status === 'active' && p.tanggalMulai <= hari && p.tanggalSelesai >= hari;
      console.log(pad(p.id, 24) + pad(p.status, 10) + pad(p.tanggalMulai, 12) + pad(p.tanggalSelesai, 12)
        + padL(hitung[p.id] || 0, 8) + '  ' + (p.semester || p.nama || '') + (aktif ? '  <- AKTIF' : ''));
    });
    if (hitung['(tanpa periode)']) console.log(`\nCatatan: ${hitung['(tanpa periode)']} respon tidak punya periodeId.`);
    process.exit(0);
  }

  // --- pilih periode ---
  const idArg = opt('periode');
  let periode;
  if (idArg) {
    periode = semuaPeriode.find(p => p.id === idArg);
    if (!periode) {
      console.error(`Periode "${idArg}" tidak ditemukan. Jalankan dengan --list untuk melihat ID yang ada.`);
      process.exit(1);
    }
  } else {
    periode = semuaPeriode.find(p => p.status === 'active' && p.tanggalMulai <= hari && p.tanggalSelesai >= hari)
      || semuaPeriode[0];
    console.log(`(Tanpa --periode: memakai ${periode.id})`);
  }

  const [kuisMap, responList] = await Promise.all([ambilKuisionerMap(), ambilResponPeriode(periode.id)]);
  if (!responList.length) {
    console.log(`Periode ${periode.id} belum punya respon.`);
    process.exit(0);
  }

  // --- mode --dosen (detail satu dosen) ---
  const cari = opt('dosen');
  if (cari) {
    const q = cari.toLowerCase();
    const cocok = new Map();
    responList.forEach(r => { if (String(r.dosenNama || '').toLowerCase().includes(q)) cocok.set(r.dosenId, r.dosenNama); });
    if (!cocok.size) { console.error(`Tidak ada dosen yang namanya mengandung "${cari}" pada periode ini.`); process.exit(1); }
    if (cocok.size > 1) {
      console.error(`"${cari}" cocok dengan ${cocok.size} dosen, perjelas:`);
      cocok.forEach((n, id) => console.error(`   - ${n}  [${id}]`));
      process.exit(1);
    }
    const [dosenId] = cocok.keys();
    const d = hitungDetailDosen(responList, kuisMap, dosenId);

    if (flag('json')) { console.log(JSON.stringify(d, null, 2)); process.exit(0); }

    console.log(garis);
    console.log(`DETAIL EDOM  ${d.dosenNama}   |   periode ${periode.id}`);
    console.log(garis);
    console.log(`Jumlah respon : ${d.count}`);
    console.log(`Rata-rata     : ${d.rataTeks}  (${d.pred.label})`);

    console.log('\n[Per Mata Kuliah]');
    d.mk.forEach(m => console.log(`   ${pad(m.mkKode, 9)}${pad(m.mkNama, 45)} ${padL(m.rataTeks, 5)}  ${pad(m.pred.label, 12)} (${m.count} respon)`));

    console.log('\n[Per Indikator]');
    d.indikator.forEach(i => console.log(`   ${pad(i.nama, 15)} ${padL(i.rataTeks, 5)}  ${predikat(i.rata).label}`));

    console.log('\n[Per Pertanyaan]   (distribusi nilai 1..5)');
    d.pertanyaan.forEach((p, i) => console.log(`   ${padL(i + 1, 2)}. ${padL(p.rataTeks, 5)}  [${p.dist.join(',')}]  ${p.pertanyaan}`));

    if (d.teks.length) {
      console.log('\n[Umpan Balik Teks]');
      d.teks.forEach(t => {
        console.log(`   ${t.pertanyaan}`);
        t.jawaban.forEach(j => console.log(`     - ${j.teks}${j.mk ? `  (${j.mk})` : ''}`));
      });
    }

    if (flag('csv')) {
      const baris = [['No', 'Pertanyaan', 'Indikator', 'Rata-rata', 'Predikat', 'Jml 1', 'Jml 2', 'Jml 3', 'Jml 4', 'Jml 5']];
      d.pertanyaan.forEach((p, i) => baris.push([i + 1, p.pertanyaan, p.indikator || '', p.rataTeks, p.pred.label, ...p.dist]));
      const f = tulisCsv(`edom_${aman(periode.id)}_${aman(d.dosenNama)}.csv`, baris);
      console.log(`\nCSV tersimpan: ${f}`);
    }
    process.exit(0);
  }

  // --- rekap seluruh dosen ---
  const rekap = hitungRekapPeriode(responList, kuisMap);

  if (flag('json')) {
    console.log(JSON.stringify({ periode, ringkasan: rekap.ringkasan, indikator: rekap.indikatorSemua, dosen: rekap.dosen }, null, 2));
    process.exit(0);
  }

  const r = rekap.ringkasan;
  console.log(garis);
  console.log(`REKAP EDOM  periode ${periode.id}  (${periode.semester || periode.nama || ''})  ${periode.tanggalMulai} s/d ${periode.tanggalSelesai}  status=${periode.status}`);
  console.log(garis);
  console.log(`Respon: ${r.jumlahRespon}   Mahasiswa unik: ${r.jumlahMahasiswa}   Dosen: ${r.jumlahDosen}   Rata-rata keseluruhan: ${r.rataSemuaTeks} (${r.pred.label})`);

  console.log('\n[Rata-rata per Indikator]');
  rekap.indikatorSemua.forEach(i => console.log(`   ${pad(i.nama, 15)} ${padL(i.rataTeks, 5)}  ${i.pred.label}`));

  const dosenUrut = [...rekap.dosen].sort((a, b) => b.rata - a.rata);
  const cols = rekap.indikatorAda;
  console.log('\n[Rekap per Dosen]  (urut rata-rata tertinggi)');
  console.log('   ' + pad('No', 4) + pad('Dosen', 38) + padL('Resp', 5) + padL('MK', 4) + padL('Rata', 7) + '  ' + pad('Predikat', 12)
    + cols.map(c => padL(c.slice(0, 11), 12)).join(''));
  dosenUrut.forEach((d, i) => {
    const per = Object.fromEntries(d.indikator.map(x => [x.nama, x.rata]));
    console.log('   ' + pad(i + 1, 4) + pad(d.dosenNama, 38) + padL(d.count, 5) + padL(d.jumlahMk, 4) + padL(d.rataTeks, 7)
      + '  ' + pad(d.pred.label, 12) + cols.map(c => padL(per[c] ? per[c].toFixed(2) : '-', 12)).join(''));
  });

  // --- KOMENTAR (umpan balik teks semua dosen) ---
  if (flag('komentar')) {
    const kom = [];
    responList.forEach(x => {
      (x.jawaban || []).forEach(j => {
        if (j.tipe === 'text' && j.jawabanTeks && String(j.jawabanTeks).trim()) {
          const meta = kuisMap.get(j.pertanyaanId) || {};
          kom.push({
            dosen: x.dosenNama || '(tanpa nama)', mk: x.mkNama || '', kode: x.mkKode || '',
            pertanyaan: j.pertanyaan || meta.pertanyaan || '', teks: String(j.jawabanTeks).trim(), tgl: tglRespon(x),
          });
        }
      });
    });
    kom.sort((a, b) => a.dosen.localeCompare(b.dosen) || a.pertanyaan.localeCompare(b.pertanyaan));

    console.log('\n' + garis);
    console.log(`KOMENTAR / UMPAN BALIK TEKS  (${kom.length} komentar dari ${responList.length} respon)`);
    console.log(garis);
    if (!kom.length) {
      console.log('Tidak ada komentar teks pada periode ini (mahasiswa tidak mengisi kolom teks, atau pertanyaan teks belum aktif).');
    } else {
      let dosenSekarang = null; let pertSekarang = null;
      kom.forEach(k => {
        if (k.dosen !== dosenSekarang) { dosenSekarang = k.dosen; pertSekarang = null; console.log(`\n>> ${k.dosen}`); }
        if (k.pertanyaan !== pertSekarang) { pertSekarang = k.pertanyaan; console.log(`   [${k.pertanyaan}]`); }
        console.log(`     - ${k.teks}${(k.kode || k.mk) ? `  (${[k.kode, k.mk].filter(Boolean).join(' - ')})` : ''}`);
      });
      if (flag('csv')) {
        const b = [['Dosen', 'Kode MK', 'Mata Kuliah', 'Pertanyaan', 'Komentar', 'Tanggal']];
        kom.forEach(k => b.push([k.dosen, k.kode, k.mk, k.pertanyaan, k.teks, k.tgl]));
        console.log(`\nCSV komentar        : ${tulisCsv(`komentar-edom_${aman(periode.id)}.csv`, b)}`);
      }
    }
  }

  // --- CSV ---
  if (flag('csv') || flag('detail')) {
    const stamp = aman(periode.id);

    const head = ['No', 'Dosen', 'Jumlah Respon', 'Jumlah MK', 'Rata-rata', 'Predikat', ...cols.map(c => `Indikator ${c}`),
      ...rekap.pertanyaan.map(p => `${p.no}. ${p.pertanyaan}`)];
    const baris = [head];
    dosenUrut.forEach((d, i) => {
      const per = Object.fromEntries(d.indikator.map(x => [x.nama, x.rata]));
      baris.push([i + 1, d.dosenNama, d.count, d.jumlahMk, d.rataTeks, d.pred.label,
        ...cols.map(c => (per[c] ? per[c].toFixed(2) : '')),
        ...d.nilai.map(n => (n ? n.teks : ''))]);
    });
    console.log(`\nCSV rekap per dosen : ${tulisCsv(`rekap-edom_${stamp}.csv`, baris)}`);

    if (flag('detail')) {
      const pertKeys = rekap.pertanyaan; // urutan kolom
      const h2 = ['No', 'Tanggal', 'Periode', 'Dosen', 'Kode MK', 'Mata Kuliah', 'Mahasiswa ID',
        ...pertKeys.map(p => `${p.no}. ${p.pertanyaan}`), 'Umpan Balik Teks', 'Nilai Akhir'];
      const b2 = [h2];
      responList.forEach((x, i) => {
        const nilaiMap = {}; const teks = [];
        (x.jawaban || []).forEach(j => {
          const key = j.pertanyaanId || j.pertanyaan;
          if (j.tipe === 'rating' && typeof j.nilai === 'number') nilaiMap[key] = j.nilai;
          else if (j.tipe === 'text' && j.jawabanTeks && String(j.jawabanTeks).trim()) teks.push(`${j.pertanyaan}: ${String(j.jawabanTeks).trim()}`);
        });
        b2.push([i + 1, tglRespon(x), periode.id, x.dosenNama || '', x.mkKode || '', x.mkNama || '', x.mahasiswaId || '',
          ...pertKeys.map(p => (nilaiMap[p.key] ?? '')), teks.join(' | '), x.nilaiRata ?? '']);
      });
      console.log(`CSV per respon      : ${tulisCsv(`edom-per-respon_${stamp}.csv`, b2)}`);
    }
  }
  process.exit(0);
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
