/**
 * scripts/ganti-pertanyaan-edom.js
 *
 * Mengganti kuisioner EDOM menjadi versi Semester Genap T.A 2025/2026
 * (15 pernyataan rating sesuai tabel indikator Kepribadian/Pedagogik/Profesional/Sosial):
 *   - 15 pertanyaan rating (skala 1-5, bobot 1)
 *   - 2 pertanyaan teks (Umpan Balik Mahasiswa)
 *
 * Cara kerja (aman):
 *   - Pertanyaan LAMA yang masih aktif -> dinonaktifkan (aktif:false), TIDAK dihapus,
 *     supaya respon lama tetap utuh. Tambahkan --hapus kalau memang ingin dihapus.
 *   - Pertanyaan BARU ditambahkan. Kalau teksnya sudah ada di koleksi, dokumen itu
 *     dipakai ulang (diaktifkan & diurutkan ulang) -> aman dijalankan berulang.
 *
 *   node scripts/ganti-pertanyaan-edom.js              (dry-run, tidak mengubah apa pun)
 *   node scripts/ganti-pertanyaan-edom.js --confirm    (terapkan)
 *   node scripts/ganti-pertanyaan-edom.js --confirm --hapus   (hapus permanen yang lama)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { db } = require('../config/firebaseAdmin');

if (!db) {
  console.error('Firebase tidak terinisialisasi (cek .env / config/serviceAccountKey.json).');
  process.exit(1);
}

const CONFIRM = process.argv.includes('--confirm');
const HAPUS = process.argv.includes('--hapus');

// [pernyataan, indikator] - sesuai tabel "Pernyataan EDOM"
const RATING = [
  ['Dosen hadir mengajar sesuai jadwal perkuliahan', 'Kepribadian'],
  ['Dosen memulai perkuliahan tepat waktu', 'Kepribadian'],
  ['Dosen mengakhiri perkuliahan tepat waktu', 'Kepribadian'],
  ['Dosen berpenampilan rapi saat mengajar', 'Kepribadian'],
  ['Dosen menjelaskan materi dengan jelas dan mudah dipahami', 'Pedagogik'],
  ['Dosen memberikan kesempatan kepada mahasiswa untuk bertanya', 'Pedagogik'],
  ['Dosen merespon pertanyaan mahasiswa dengan baik', 'Pedagogik'],
  ['Dosen menggunakan metode pembelajaran yang menarik', 'Pedagogik'],
  ['Dosen memberikan tugas yang sesuai dengan materi perkuliahan', 'Pedagogik'],
  ['Dosen memberikan motivasi yang baik selama perkuliahan', 'Pedagogik'],
  ['Dosen menguasai materi yang diajarkan', 'Profesional'],
  ['Dosen mengaitkan materi kuliah dengan contoh atau penerapan nyata', 'Profesional'],
  ['Dosen memberikan penilaian secara transparan', 'Profesional'],
  ['Dosen mampu menjawab pertanyaan mahasiswa dengan baik', 'Profesional'],
  ['Dosen berkomunikasi dengan baik kepada mahasiswa', 'Sosial'],
];
const TEKS = [
  'Hal-hal yang baik pada dosen ini dan perlu dipertahankan',
  'Hal-hal negatif pada dosen ini dan perlu perbaikan',
];

const BARU = [
  ...RATING.map(([t, ind], i) => ({ pertanyaan: t, indikator: ind, tipe: 'rating', skala: 5, bobot: 1, urutan: i + 1 })),
  ...TEKS.map((t, i) => ({ pertanyaan: t, indikator: null, tipe: 'text', skala: null, bobot: null, urutan: RATING.length + i + 1 })),
];
const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

(async () => {
  const snap = await db.collection('edom_kuisioner').get();
  const semua = snap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
  const peta = new Map(semua.map(q => [norm(q.pertanyaan) + '|' + q.tipe, q]));

  // pasangkan pertanyaan baru dengan dokumen yang sudah ada (jika teks & tipe sama)
  const rencana = BARU.map(b => ({ ...b, ada: peta.get(norm(b.pertanyaan) + '|' + b.tipe) || null }));
  const idDipakai = new Set(rencana.filter(r => r.ada).map(r => r.ada.id));
  const lama = semua.filter(q => !idDipakai.has(q.id) && (HAPUS || q.aktif === true));

  console.log('='.repeat(90));
  console.log(CONFIRM ? 'GANTI PERTANYAAN EDOM  [MODE TERAPKAN]' : 'GANTI PERTANYAAN EDOM  [DRY-RUN - tidak mengubah apa pun]');
  console.log('='.repeat(90));

  console.log(`\nPertanyaan LAMA yang akan ${HAPUS ? 'DIHAPUS' : 'DINONAKTIFKAN'} (${lama.length}):`);
  lama.forEach(q => console.log(`   - [${q.aktif ? 'aktif' : 'nonaktif'}] ${q.pertanyaan}`));
  if (!lama.length) console.log('   (tidak ada)');

  console.log(`\nPertanyaan BARU (${rencana.length}):`);
  rencana.forEach(r => console.log(`   ${String(r.urutan).padStart(2)}. [${r.tipe.padEnd(6)}] ${(r.indikator || '-').padEnd(11)} ${r.ada ? '(pakai ulang) ' : '(baru)        '}${r.pertanyaan}`));

  // peringatan respon pada periode aktif
  const hari = new Date().toISOString().split('T')[0];
  const per = (await db.collection('edom_periode').where('status', '==', 'active').get()).docs
    .find(d => d.data().tanggalMulai <= hari && d.data().tanggalSelesai >= hari);
  if (per) {
    const n = (await db.collection('edom_respon').where('periodeId', '==', per.id).get()).size;
    console.log(`\nPeriode aktif: ${per.id} - sudah ada ${n} respon.`);
    if (n > 0) console.log('   PERHATIAN: respon lama menyimpan jawaban per ID pertanyaan lama; rekap per-pertanyaan\n   periode ini tidak akan menampilkannya. Nilai rata-rata (nilaiRata) per respon tetap aman.');
  } else {
    console.log('\nTidak ada periode aktif hari ini.');
  }

  if (!CONFIRM) {
    console.log('\nDry-run selesai. Jalankan lagi dengan --confirm untuk menerapkan.');
    process.exit(0);
  }

  const batch = db.batch();
  const now = new Date().toISOString();
  lama.forEach(q => HAPUS ? batch.delete(q.ref) : batch.update(q.ref, { aktif: false, updatedAt: now }));
  rencana.forEach(r => {
    const data = { pertanyaan: r.pertanyaan, indikator: r.indikator, tipe: r.tipe, skala: r.skala, bobot: r.bobot, urutan: r.urutan, aktif: true, updatedAt: now };
    if (r.ada) batch.update(r.ada.ref, data);
    else batch.set(db.collection('edom_kuisioner').doc(), { ...data, createdAt: now });
  });
  await batch.commit();
  console.log('\nSELESAI. Pertanyaan EDOM sudah diganti. Cek hasilnya: node scripts/cek-edom-aktif.js');
  process.exit(0);
})().catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
