/**
 * scripts/cek-edom-aktif.js   (READ-ONLY, tidak mengubah data)
 *
 * Menampilkan kondisi EDOM saat ini:
 *   1. Periode EDOM (mana yang AKTIF hari ini: status 'active' + tanggal di rentang)
 *   2. Semua pertanyaan di koleksi edom_kuisioner (aktif & nonaktif), urut 'urutan'
 *   3. Jumlah respon per periode (agar tahu dampak kalau pertanyaan diganti)
 *
 *   node scripts/cek-edom-aktif.js
 *   node scripts/cek-edom-aktif.js --json    (keluaran JSON mentah)
 */
// Muat .env dari ROOT proyek (bukan dari folder tempat perintah dijalankan)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { db } = require('../config/firebaseAdmin');

if (!db) {
  console.error('\nFirebase tidak terinisialisasi. Pastikan salah satu ada:');
  console.error('  - file .env di root proyek berisi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  console.error('  - atau file config/serviceAccountKey.json');
  process.exit(1);
}

const JSON_MODE = process.argv.includes('--json');
const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);

(async () => {
  const hari = new Date().toISOString().split('T')[0];

  const [periodeSnap, kuisSnap, responSnap] = await Promise.all([
    db.collection('edom_periode').get(),
    db.collection('edom_kuisioner').get(),
    db.collection('edom_respon').get(),
  ]);

  const periode = periodeSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pertanyaan = kuisSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

  const perPeriode = {};
  responSnap.docs.forEach(d => {
    const p = d.data().periodeId || '(tanpa periode)';
    perPeriode[p] = (perPeriode[p] || 0) + 1;
  });

  const periodeAktif = periode.find(p =>
    p.status === 'active' && p.tanggalMulai <= hari && p.tanggalSelesai >= hari);

  if (JSON_MODE) {
    console.log(JSON.stringify({ hari, periodeAktif: periodeAktif || null, periode, pertanyaan, responPerPeriode: perPeriode }, null, 2));
    process.exit(0);
  }

  const garis = '='.repeat(100);
  console.log(garis);
  console.log(`CEK EDOM  (hari ini: ${hari})`);
  console.log(garis);

  // 1. PERIODE
  console.log('\n[1] PERIODE EDOM');
  if (!periode.length) console.log('   (belum ada periode)');
  periode.forEach(p => {
    const aktif = periodeAktif && periodeAktif.id === p.id;
    console.log(`   ${aktif ? '>> AKTIF ' : '          '}${pad(p.id, 22)} status=${pad(p.status, 9)} ${p.tanggalMulai} s/d ${p.tanggalSelesai}  ${p.semester || p.nama || ''}  (respon: ${perPeriode[p.id] || 0})`);
  });
  console.log(periodeAktif
    ? `\n   Periode aktif sekarang : ${periodeAktif.id}`
    : '\n   TIDAK ADA periode yang aktif hari ini (status bukan "active" atau di luar rentang tanggal).');

  // 2. PERTANYAAN
  const aktif = pertanyaan.filter(q => q.aktif === true);
  const nonaktif = pertanyaan.filter(q => q.aktif !== true);
  console.log(`\n[2] PERTANYAAN AKTIF (${aktif.length})  — inilah yang tampil ke mahasiswa/dosen`);
  console.log('   ' + pad('No', 4) + pad('Urut', 6) + pad('Tipe', 9) + pad('Skala', 7) + pad('Bobot', 7) + 'Pertanyaan  [id]');
  aktif.forEach((q, i) => console.log('   ' + pad(i + 1, 4) + pad(q.urutan, 6) + pad(q.tipe, 9) + pad(q.skala, 7) + pad(q.bobot, 7) + `${q.pertanyaan}  [${q.id}]`));
  if (!aktif.length) console.log('   (tidak ada pertanyaan aktif)');

  console.log(`\n[3] PERTANYAAN NONAKTIF (${nonaktif.length})`);
  nonaktif.forEach(q => console.log(`   - urut ${pad(q.urutan, 4)} ${q.pertanyaan}  [${q.id}]`));
  if (!nonaktif.length) console.log('   (tidak ada)');

  // 3. PERINGATAN
  const totalRespon = periodeAktif ? (perPeriode[periodeAktif.id] || 0) : 0;
  console.log('\n' + garis);
  if (totalRespon > 0) {
    console.log(`PERHATIAN: periode aktif sudah punya ${totalRespon} respon. Mengganti/menghapus pertanyaan`);
    console.log('sekarang membuat rekap periode ini tidak seragam. Lebih aman: NONAKTIFKAN pertanyaan lama');
    console.log('(jangan dihapus) lalu tambah pertanyaan baru, atau buat periode baru.');
  } else {
    console.log('Periode aktif belum punya respon: aman untuk mengganti/menambah pertanyaan.');
  }
  console.log(garis);
  process.exit(0);
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
