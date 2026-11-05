/**
 * scripts/buat-periode-edom.js
 *
 * Membuat PERIODE EDOM BARU (Semester Genap T.A 2025/2026) dan menutup periode
 * yang sedang aktif (status -> 'closed'; data & respon lama TIDAK dihapus).
 * Karena pengecekan "sudah mengisi" berlaku per periode, semua mahasiswa bisa
 * mengisi ulang dengan pertanyaan baru.
 *
 *   node scripts/buat-periode-edom.js                                  (dry-run)
 *   node scripts/buat-periode-edom.js --mulai=2026-11-06 --selesai=2026-11-20
 *   node scripts/buat-periode-edom.js --mulai=2026-11-06 --selesai=2026-11-20 --confirm
 *
 * Opsi:
 *   --mulai=YYYY-MM-DD     default: hari ini
 *   --selesai=YYYY-MM-DD   default: 14 hari setelah tanggal mulai
 *   --semester="Genap 2025/2026"
 *   --nama="EDOM Semester Genap T.A 2025/2026"
 *   --confirm              terapkan (tanpa ini hanya dry-run)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { db } = require('../config/firebaseAdmin');

if (!db) {
  console.error('Firebase tidak terinisialisasi (cek .env / config/serviceAccountKey.json).');
  process.exit(1);
}

const arg = (k, def) => {
  const a = process.argv.find(x => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : def;
};
const CONFIRM = process.argv.includes('--confirm');
const isoHari = (d) => d.toISOString().split('T')[0];
const valid = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s));

const hari = isoHari(new Date());
const mulai = arg('mulai', hari);
const selesai = arg('selesai', isoHari(new Date(new Date(mulai).getTime() + 14 * 86400000)));
const semester = arg('semester', 'Genap 2025/2026');
const nama = arg('nama', 'EDOM Semester Genap T.A 2025/2026');

(async () => {
  if (!valid(mulai) || !valid(selesai)) { console.error('Format tanggal harus YYYY-MM-DD.'); process.exit(1); }
  if (new Date(mulai) > new Date(selesai)) { console.error('Tanggal mulai tidak boleh setelah tanggal selesai.'); process.exit(1); }

  const [perSnap, kuisSnap] = await Promise.all([
    db.collection('edom_periode').get(),
    db.collection('edom_kuisioner').where('aktif', '==', true).get(),
  ]);
  const periode = perSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const aktifLama = periode.filter(p => p.status === 'active');
  const kembar = periode.find(p => p.nama === nama && p.semester === semester);

  console.log('='.repeat(90));
  console.log(CONFIRM ? 'BUAT PERIODE EDOM BARU  [MODE TERAPKAN]' : 'BUAT PERIODE EDOM BARU  [DRY-RUN - tidak mengubah apa pun]');
  console.log('='.repeat(90));
  console.log(`\nPeriode baru : ${nama}`);
  console.log(`Semester     : ${semester}`);
  console.log(`Tanggal      : ${mulai} s/d ${selesai}   (hari ini: ${hari})`);
  console.log(`Status       : active`);

  console.log(`\nPeriode yang akan DITUTUP (status -> closed): ${aktifLama.length}`);
  for (const p of aktifLama) {
    const n = (await db.collection('edom_respon').where('periodeId', '==', p.id).get()).size;
    console.log(`   - ${p.nama || p.id} (${p.tanggalMulai} s/d ${p.tanggalSelesai}) - ${n} respon tetap tersimpan`);
  }
  if (!aktifLama.length) console.log('   (tidak ada)');

  console.log(`\nPertanyaan aktif saat ini: ${kuisSnap.size}`);
  if (kuisSnap.size !== 17) {
    console.log('   PERHATIAN: kuisioner baru seharusnya 17 pertanyaan aktif (15 rating + 2 teks).');
    console.log('   Jalankan dulu: node scripts/ganti-pertanyaan-edom.js --confirm');
  }
  if (new Date(mulai) > new Date(hari)) {
    console.log(`\nCatatan: tanggal mulai (${mulai}) belum tiba, jadi mahasiswa baru bisa mengisi mulai tanggal itu.`);
  }
  if (kembar) {
    console.log(`\nBERHENTI: periode dengan nama & semester yang sama sudah ada (id ${kembar.id}). Tidak dibuat ganda.`);
    process.exit(1);
  }

  if (!CONFIRM) {
    console.log('\nDry-run selesai. Tambahkan --confirm untuk menerapkan.');
    process.exit(0);
  }

  const now = new Date().toISOString();
  const batch = db.batch();
  aktifLama.forEach(p => batch.update(p.ref, { status: 'closed', updatedAt: now }));
  const ref = db.collection('edom_periode').doc();
  batch.set(ref, { nama, tanggalMulai: mulai, tanggalSelesai: selesai, semester, status: 'active', createdAt: now, updatedAt: now });
  await batch.commit();

  console.log(`\nSELESAI. Periode baru dibuat (id ${ref.id}). Cek: node scripts/cek-edom-aktif.js`);
  process.exit(0);
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
