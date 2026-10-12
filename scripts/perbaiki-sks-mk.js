/**
 * scripts/perbaiki-sks-mk.js
 *
 * Merapikan 3 dokumen mata kuliah yang tidak konsisten, berdasarkan hasil
 * `node scripts/cek-sks-mk.js --rinci`:
 *
 *  1. WUD3208 Bahasa Indonesia, ELK1B  (id MwRH7knBpPrJLimQfd9K)
 *     sks 2  ->  3   (ELK1A = 3, ELK1ON = 3, kurikulum = 3)
 *  2. WUD2204 Pendidikan Agama Hindu, ELK1B   (id eL6zitjz2mTxtBCiNjhs)
 *  3. WUD2204 Pendidikan Agama Hindu, ELK1ON  (id rxtUHzW2AAI1Rtc1ixjX)
 *     sks (kosong) -> 2  dan  semester (kosong) -> 1
 *     (dokumen ELK1A Hindu dan semua kelas agama lain = 2 SKS, semester 1)
 *
 * PENGAMAN
 *  - Hanya menyentuh bidang yang tertulis di PERBAIKAN (sks, semester). Dokumen
 *    lain, dosenIds, jadwal, dan sebagainya TIDAK diubah.
 *  - Sebelum mengubah, kondisi dokumen diperiksa: kode & kelas harus cocok, dan
 *    nilai sekarang harus sama dengan yang diharapkan (nilai lama / kosong).
 *    Kalau berbeda (mis. sudah diedit orang lain), dokumen DILEWATI dengan
 *    peringatan.
 *  - Dry-run secara default. Tambahkan --confirm untuk menulis.
 *  - Hanya melaporkan (tidak mengubah): dokumen nilai (grades) yang sudah
 *    tercatat dengan SKS lama, dan bidang yang ada di dokumen saudara
 *    (ELK1A) tetapi tidak ada di dokumen yang diperbaiki.
 *
 *   node scripts/perbaiki-sks-mk.js            (cek dulu)
 *   node scripts/perbaiki-sks-mk.js --confirm  (jalankan)
 *
 * Catatan: aplikasi menyimpan daftar MK di memori (cache sekitar 10 menit).
 * Setelah --confirm, restart server atau tunggu beberapa menit.
 */
const { db } = require('../config/firebaseAdmin');
const { normalizeKelas } = require('../helpers/academicHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const kosong = (v) => v === undefined || v === null || v === '';

const PERBAIKAN = [
  {
    id: 'MwRH7knBpPrJLimQfd9K', kode: 'WUD3208', kelas: 'ELK1B',
    set: { sks: 3 }, harapSebelum: { sks: 2 },
    alasan: 'ELK1A, ELK1ON, dan kurikulum semuanya 3 SKS',
    saudara: 'CdvRuisRP0O71OYjRpZp',
    cekNilai: { kodeMk: 'WUD3208', sksLama: 2 }
  },
  {
    id: 'eL6zitjz2mTxtBCiNjhs', kode: 'WUD2204', kelas: 'ELK1B',
    set: { sks: 2, semester: 1 }, harapSebelum: { sks: 'KOSONG', semester: 'KOSONG' },
    alasan: 'ELK1A Hindu dan semua kelas agama lain = 2 SKS, semester 1',
    saudara: 'PZv6xa1gcC5sX3w1dqMD'
  },
  {
    id: 'rxtUHzW2AAI1Rtc1ixjX', kode: 'WUD2204', kelas: 'ELK1ON',
    set: { sks: 2, semester: 1 }, harapSebelum: { sks: 'KOSONG', semester: 'KOSONG' },
    alasan: 'ELK1A Hindu dan semua kelas agama lain = 2 SKS, semester 1',
    saudara: 'PZv6xa1gcC5sX3w1dqMD'
  }
];

const tampil = (v) => (v === undefined ? '(kosong)' : JSON.stringify(v));

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - menulis ke database' : '🟡 DRY-RUN - tidak menulis apa pun'}\n`);
  let diubah = 0, sudahBenar = 0, dilewati = 0;
  const gradesDiperiksa = new Set();

  for (const p of PERBAIKAN) {
    console.log(`--- ${p.kode} kelas ${p.kelas}  (id ${p.id}) ---`);
    const ref = db.collection('mataKuliah').doc(p.id);
    const doc = await ref.get();
    if (!doc.exists) { console.log('   ❌ dokumen tidak ditemukan - dilewati\n'); dilewati++; continue; }
    const d = doc.data();
    console.log(`   ${d.nama}  | kode ${d.kode} | kelas ${d.kelas || '-'}`);

    if (d.kode !== p.kode || (normalizeKelas(d.kelas) || d.kelas) !== p.kelas) {
      console.log(`   ⛔ Kode/kelas tidak sesuai harapan (${p.kode}/${p.kelas}) - dilewati demi keamanan\n`); dilewati++; continue;
    }

    // tentukan bidang yang perlu diubah
    const ubah = {};
    let curiga = false;
    for (const [kunci, target] of Object.entries(p.set)) {
      const sekarang = d[kunci];
      const nilaiSekarang = kunci === 'sks' && !kosong(sekarang) && !isNaN(parseFloat(sekarang)) ? parseFloat(sekarang) : sekarang;
      if (nilaiSekarang === target && typeof sekarang === 'number') { console.log(`   ✔️  ${kunci}: sudah ${target}`); continue; }
      const harap = p.harapSebelum[kunci];
      const sesuaiHarapan = harap === 'KOSONG' ? kosong(sekarang) : nilaiSekarang === harap;
      if (nilaiSekarang === target) { // nilainya benar tetapi tersimpan sebagai teks
        console.log(`   🔧 ${kunci}: ${tampil(sekarang)} -> ${target} (rapikan jadi angka)`); ubah[kunci] = target; continue;
      }
      if (sesuaiHarapan) { console.log(`   🔧 ${kunci}: ${tampil(sekarang)} -> ${target}`); ubah[kunci] = target; }
      else { console.log(`   ⚠️  ${kunci}: sekarang ${tampil(sekarang)}, tidak sama dengan yang diharapkan (${harap === 'KOSONG' ? 'kosong' : harap}) - TIDAK diubah`); curiga = true; }
    }
    console.log(`   Alasan: ${p.alasan}`);

    // bidang yang ada di dokumen saudara tetapi tidak di dokumen ini (hanya laporan)
    if (p.saudara) {
      const sdr = await db.collection('mataKuliah').doc(p.saudara).get();
      if (sdr.exists) {
        const hilang = Object.keys(sdr.data()).filter(k => d[k] === undefined && !(k in p.set));
        if (hilang.length > 0) console.log(`   ℹ️  Bidang di dokumen ELK1A yang tidak ada di dokumen ini (tidak diubah): ${hilang.join(', ')}`);
      }
    }

    // dokumen nilai dengan SKS lama (hanya laporan)
    if (p.cekNilai && !gradesDiperiksa.has(p.cekNilai.kodeMk)) {
      gradesDiperiksa.add(p.cekNilai.kodeMk);
      const g = await db.collection('grades').where('kodeMk', '==', p.cekNilai.kodeMk).get();
      const lama = g.docs.filter(x => parseFloat(x.data().sks) === p.cekNilai.sksLama);
      const perSemester = {};
      lama.forEach(x => { const s = x.data().semester || '(tanpa semester)'; perSemester[s] = (perSemester[s] || 0) + 1; });
      console.log(`   ℹ️  Dokumen nilai (grades) ${p.cekNilai.kodeMk} dengan SKS ${p.cekNilai.sksLama}: ${lama.length} dari ${g.size}` +
        (lama.length ? '  -> ' + Object.entries(perSemester).map(([s, n]) => `${s}: ${n}`).join(', ') + '  (TIDAK diubah script ini; kabari bila perlu dirapikan)' : ''));
    }

    if (curiga) { console.log('   ➡️  dilewati karena ada nilai tak terduga\n'); dilewati++; continue; }
    if (Object.keys(ubah).length === 0) { console.log('   ➡️  tidak ada perubahan\n'); sudahBenar++; continue; }

    if (KONFIRMASI) {
      await ref.update({ ...ubah, updatedAt: new Date().toISOString() });
      console.log('   ✅ diperbarui');
    }
    diubah++;
    console.log('');
  }

  console.log(`Ringkasan: ${KONFIRMASI ? 'diperbarui' : 'akan diperbarui'} ${diubah}, sudah benar ${sudahBenar}, dilewati ${dilewati}`);
  if (!KONFIRMASI && diubah > 0) console.log('👉 Ini DRY-RUN. Jalankan ulang dengan --confirm untuk menyimpan.');
  if (KONFIRMASI && diubah > 0) console.log('👉 Cek ulang: node scripts/cek-sks-mk.js   (restart server agar cache MK segar)');
  process.exit(dilewati > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
