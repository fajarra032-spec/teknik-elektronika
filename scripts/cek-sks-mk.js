/**
 * scripts/cek-sks-mk.js
 *
 * DIAGNOSTIK (READ-ONLY, tidak mengubah data): menampilkan semua mata kuliah
 * di koleksi `mataKuliah` per KODE, dengan SKS di sistem, lalu membandingkan
 * dengan SKS kurikulum (seed-matakuliah-2026.js) dan SKS yang tercetak di
 * dokumen jadwal (data/jadwalBebanDosen.js). Tujuannya menemukan SKS yang
 * tidak konsisten sebelum rekap beban dosen disimpan.
 *
 * Yang diperiksa:
 *   1. SKS BERBEDA ANTAR DOKUMEN pada kode MK yang sama (mis. ELK1A=3, ELK1B=2)
 *   2. SKS di sistem BEDA dengan SKS kurikulum
 *   3. SKS kosong / bukan angka / tersimpan sebagai teks (mis. "3" atau "3 SKS")
 *   4. Kode di jadwal yang TIDAK ADA di sistem
 *   5. Kode di sistem yang tidak dikenal kurikulum/jadwal (info)
 *   6. Kode kosong, atau nama sama tetapi kode berbeda
 *
 *   node scripts/cek-sks-mk.js            (tampil di terminal)
 *   node scripts/cek-sks-mk.js --rinci    (tampilkan juga SEMUA dokumen tiap kode)
 *   node scripts/cek-sks-mk.js --csv      (simpan juga ke cek-sks-mk.csv)
 */
const fs = require('fs');
const { db } = require('../config/firebaseAdmin');
const { SESI, SKS_KURIKULUM } = require('../data/jadwalBebanDosen');
const { normalizeKelas } = require('../helpers/academicHelper');

const RINCI = process.argv.includes('--rinci');
const CSV = process.argv.includes('--csv');

// kode agama WUD2202..WUD2205 diwakili satu baris kurikulum 'WUD2202-5'
const kunciKurikulum = (kode) => (/^WUD220[2-5]$/.test(kode) ? 'WUD2202-5' : kode);
const fmt = (v) => (Number.isInteger(v) ? String(v) : String(v));
const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const tampil = (v) => (v === undefined ? '(kosong)' : JSON.stringify(v));

/** Ubah nilai sks mentah menjadi { angka|null, masalah|null } */
function bacaSks(mentah) {
  if (mentah === undefined || mentah === null || mentah === '') return { angka: null, masalah: 'kosong' };
  if (typeof mentah === 'number') return { angka: Number.isFinite(mentah) ? mentah : null, masalah: Number.isFinite(mentah) ? null : 'bukan angka' };
  const teks = String(mentah).trim();
  if (/^\d+(\.\d+)?$/.test(teks)) return { angka: parseFloat(teks), masalah: 'tersimpan sebagai teks "' + teks + '"' };
  const dalam = teks.match(/\d+(\.\d+)?/);
  return { angka: dalam ? parseFloat(dalam[0]) : null, masalah: 'format tidak baku "' + teks + '"' };
}

(async () => {
  const snap = await db.collection('mataKuliah').get();
  console.log('='.repeat(100));
  console.log('CEK MATA KULIAH & SKS (read-only)');
  console.log('='.repeat(100));
  console.log(`Total dokumen di koleksi mataKuliah: ${snap.size}\n`);

  // ---- kelompokkan per kode ----
  const perKode = new Map();
  const tanpaKode = [];
  snap.docs.forEach(d => {
    const m = d.data();
    const item = { id: d.id, kode: m.kode || '', nama: m.nama || '(tanpa nama)', kelas: normalizeKelas(m.kelas) || (m.kelas || ''), semester: m.semester, sks: bacaSks(m.sks), mentah: m.sks };
    if (!item.kode) { tanpaKode.push(item); return; }
    if (!perKode.has(item.kode)) perKode.set(item.kode, []);
    perKode.get(item.kode).push(item);
  });

  // ---- SKS di dokumen jadwal per kode (nilai unik) ----
  const jadwalPerKode = new Map();
  SESI.forEach(s => {
    const k = kunciKurikulum(s.kodeMk);
    if (!jadwalPerKode.has(k)) jadwalPerKode.set(k, new Set());
    jadwalPerKode.get(k).add(s.sksDokumen);
  });

  const temuan = { antarDokumen: [], bedaKurikulum: [], formatSks: [], tidakAdaDiSistem: [], tidakDikenal: [], namaSamaKodeBeda: [] };
  const baris = [];

  Array.from(perKode.keys()).sort().forEach(kode => {
    const docs = perKode.get(kode);
    const angkaUnik = Array.from(new Set(docs.map(d => d.sks.angka).filter(a => a !== null))).sort((a, b) => a - b);
    const kur = SKS_KURIKULUM[kunciKurikulum(kode)];
    const jad = jadwalPerKode.get(kunciKurikulum(kode));
    const statusList = [];

    if (angkaUnik.length > 1) {
      statusList.push('BEDA ANTAR DOKUMEN');
      temuan.antarDokumen.push({ kode, nama: docs[0].nama, docs });
    }
    if (angkaUnik.length >= 1 && kur !== undefined && angkaUnik.some(a => a !== kur)) {
      statusList.push('BEDA KURIKULUM');
      temuan.bedaKurikulum.push({ kode, nama: docs[0].nama, sistem: angkaUnik, kurikulum: kur });
    }
    docs.filter(d => d.sks.masalah).forEach(d => temuan.formatSks.push({ kode, nama: d.nama, kelas: d.kelas, id: d.id, masalah: d.sks.masalah }));
    if (docs.some(d => d.sks.masalah)) statusList.push('FORMAT/KOSONG');
    if (kur === undefined && !jad) {
      statusList.push('TIDAK DIKENAL');
      temuan.tidakDikenal.push({ kode, nama: docs[0].nama });
    }
    baris.push({
      kode, nama: docs[0].nama, jumlah: docs.length,
      sistem: angkaUnik.length ? angkaUnik.map(fmt).join(' / ') : '-',
      kurikulum: kur !== undefined ? fmt(kur) : '-',
      jadwal: jad ? Array.from(jad).sort((a, b) => a - b).map(fmt).join(' / ') : '-',
      status: statusList.length ? statusList.join(', ') : 'OK',
      docs
    });
  });

  // ---- tabel utama ----
  console.log(pad('KODE', 11) + pad('MATA KULIAH', 36) + pad('DOK', 4) + pad('SKS SISTEM', 11) + pad('KURIKULUM', 10) + pad('JADWAL', 9) + 'STATUS');
  console.log('-'.repeat(100));
  baris.forEach(b => {
    console.log(pad(b.kode, 11) + pad(b.nama, 36) + pad(b.jumlah, 4) + pad(b.sistem, 11) + pad(b.kurikulum, 10) + pad(b.jadwal, 9) + (b.status === 'OK' ? 'OK' : (b.status === 'TIDAK DIKENAL' ? 'ℹ️  ' : '⚠️  ') + b.status));
    if (RINCI || b.status !== 'OK') {
      b.docs.forEach(d => console.log(`      · kelas ${pad(d.kelas || '-', 8)} smt ${pad(d.semester ?? '-', 3)} sks=${pad(tampil(d.mentah), 10)} id=${d.id}`));
    }
  });

  // ---- kode di jadwal yang tidak ada di sistem ----
  const kodeSistem = new Set(Array.from(perKode.keys()).map(kunciKurikulum));
  const kodeJadwal = new Map();
  SESI.forEach(s => { if (!kodeJadwal.has(s.kodeMk)) kodeJadwal.set(s.kodeMk, s.namaMk); });
  kodeJadwal.forEach((nama, kode) => { if (!kodeSistem.has(kunciKurikulum(kode))) temuan.tidakAdaDiSistem.push({ kode, nama }); });

  // ---- nama sama, kode berbeda ----
  const perNama = new Map();
  perKode.forEach((docs, kode) => docs.forEach(d => {
    const k = d.nama.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!perNama.has(k)) perNama.set(k, new Set());
    perNama.get(k).add(kode);
  }));
  perNama.forEach((kodes, nama) => { if (kodes.size > 1) temuan.namaSamaKodeBeda.push({ nama, kodes: Array.from(kodes).sort() }); });

  // ---- ringkasan temuan ----
  console.log('\n' + '='.repeat(100));
  console.log('RINGKASAN TEMUAN');
  console.log('='.repeat(100));
  const bagian = (judul, arr, cetak, info = false) => {
    console.log(`\n${arr.length === 0 ? '✅' : (info ? 'ℹ️ ' : '⚠️ ')} ${judul}: ${arr.length}`);
    arr.forEach(cetak);
  };
  bagian('1. SKS berbeda antar dokumen pada kode yang sama', temuan.antarDokumen, t => {
    console.log(`   ${t.kode}  ${t.nama}`);
    t.docs.forEach(d => console.log(`        kelas ${pad(d.kelas || '-', 8)} sks=${tampil(d.mentah)}  (id ${d.id})`));
  });
  bagian('2. SKS di sistem berbeda dengan SKS kurikulum', temuan.bedaKurikulum, t =>
    console.log(`   ${pad(t.kode, 10)} ${pad(t.nama, 34)} sistem ${t.sistem.join('/')}  vs  kurikulum ${t.kurikulum}`));
  bagian('3. SKS kosong / tersimpan sebagai teks / format tidak baku', temuan.formatSks, t =>
    console.log(`   ${pad(t.kode, 10)} ${pad(t.nama, 34)} kelas ${pad(t.kelas || '-', 8)} -> ${t.masalah}  (id ${t.id})`));
  bagian('4. Kode di dokumen jadwal yang TIDAK ADA di sistem', temuan.tidakAdaDiSistem, t =>
    console.log(`   ${pad(t.kode, 10)} ${t.nama}`));
  bagian('5. Kode di sistem yang tidak dikenal kurikulum/jadwal (info)', temuan.tidakDikenal, t =>
    console.log(`   ${pad(t.kode, 10)} ${t.nama}`), true);
  bagian('6a. Dokumen MK tanpa kode', tanpaKode, t =>
    console.log(`   ${t.nama}  kelas ${t.kelas || '-'}  sks=${tampil(t.mentah)}  (id ${t.id})`));
  bagian('6b. Nama sama tetapi kode berbeda', temuan.namaSamaKodeBeda, t =>
    console.log(`   "${t.nama}" -> ${t.kodes.join(', ')}`), true);

  // ---- SKS di jadwal yang tidak sama dengan SKS sistem (per kode) ----
  const bedaJadwal = baris.filter(b => b.jadwal !== '-' && b.sistem !== '-' && b.jadwal !== b.sistem);
  console.log(`\n${bedaJadwal.length === 0 ? '✅' : 'ℹ️ '} 7. SKS di dokumen jadwal berbeda dari SKS sistem: ${bedaJadwal.length}`);
  bedaJadwal.forEach(b => console.log(`   ${pad(b.kode, 10)} ${pad(b.nama, 34)} jadwal ${b.jadwal}  vs  sistem ${b.sistem}`));

  console.log('\n' + '-'.repeat(100));
  console.log('Catatan: script ini tidak menulis apa pun. Kirim salinan seluruh output ini bila ingin saya analisis.');
  console.log('Script sinkron beban dosen (--sks=sistem) memakai kolom "SKS SISTEM" di atas; bila ada BEDA ANTAR DOKUMEN,');
  console.log('perbaiki dulu di Admin > Mata Kuliah (atau minta saya buatkan script perapi SKS) sebelum --confirm.');

  if (CSV) {
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const rows = [['kode', 'nama', 'kelas', 'semester', 'sks_mentah', 'sks_angka', 'sks_kurikulum', 'sks_jadwal', 'status_kode', 'id']];
    baris.forEach(b => b.docs.forEach(d => rows.push([b.kode, d.nama, d.kelas, d.semester, JSON.stringify(d.mentah), d.sks.angka, b.kurikulum, b.jadwal, b.status, d.id])));
    fs.writeFileSync('cek-sks-mk.csv', '\ufeff' + rows.map(r => r.map(esc).join(',')).join('\n'));
    console.log('\n💾 Disimpan ke cek-sks-mk.csv');
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
