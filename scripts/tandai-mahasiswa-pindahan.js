/**
 * scripts/tandai-mahasiswa-pindahan.js
 *
 * Menandai mahasiswa PINDAHAN di users: jenisMasuk = 'Pindahan' + asalKampus
 * + asalProdi, supaya terhitung (dan terinci asalnya) di Laporan Awal Semester.
 *
 * Daftar di bawah (DAFTAR_PINDAHAN) berisi 2 mahasiswa pindahan:
 *   1. Asila Aswin   - pindahan dari prodi lain, KAMPUS SAMA
 *                      (Teknologi Rekayasa Metalurgi, Politeknik Dewantara)
 *   2. Intan Rianita - pindahan dari KAMPUS LAIN (ATIM Makassar)
 *
 * Mahasiswa dicari lewat NIM bila diisi; kalau tidak, lewat NAMA (persis,
 * tanpa peduli huruf besar/kecil). Bila nama ditemukan lebih dari satu orang
 * atau tidak ketemu, script BERHENTI untuk orang itu dan meminta NIM diisi -
 * tidak pernah menebak.
 *
 * Hanya menulis field yang terisi di daftar (field kosong tidak menimpa data
 * yang sudah ada). Aman diulang. Tidak mengubah status, kelas, atau nilai.
 *
 *   node scripts/tandai-mahasiswa-pindahan.js            (cek dulu, tidak menulis)
 *   node scripts/tandai-mahasiswa-pindahan.js --confirm  (simpan)
 */
const { db } = require('../config/firebaseAdmin');

const KONFIRMASI = process.argv.includes('--confirm');

// ============================================================================
// DAFTAR PINDAHAN - sesuaikan bila ada koreksi penulisan
// ============================================================================
const DAFTAR_PINDAHAN = [
  {
    nim: '25407245',
    nama: 'Asila Aswin',
    asalKampus: 'Politeknik Dewantara',
    asalProdi: 'Teknologi Rekayasa Metalurgi'
  },
  {
    nim: null,                       // isi NIM bila nama ganda / tidak ketemu
    nama: 'Intan Rianita',
    asalKampus: 'ATIM Makassar',     // tulis nama resmi kampusnya bila perlu
    asalProdi: ''                    // belum diketahui - isi bila ada
  }
];

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

async function cariMahasiswa(p, cacheSemuaMhs) {
  if (p.nim) {
    const snap = await db.collection('users').where('nim', '==', p.nim).limit(1).get();
    return snap.empty ? [] : [snap.docs[0]];
  }
  // lewat nama: coba persis dulu (murah), lalu bandingkan ter-normalisasi
  const persis = await db.collection('users').where('nama', '==', p.nama).get();
  let hasil = persis.docs.filter(d => !d.data().role || d.data().role === 'mahasiswa');
  if (hasil.length === 0) {
    if (!cacheSemuaMhs.docs) {
      const semua = await db.collection('users').where('role', '==', 'mahasiswa').get();
      cacheSemuaMhs.docs = semua.docs;
    }
    hasil = cacheSemuaMhs.docs.filter(d => norm(d.data().nama) === norm(p.nama));
  }
  return hasil;
}

(async () => {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - menulis ke database' : '🟡 DRY-RUN - tidak menulis apa pun'}\n`);
  const cache = {};
  let ditandai = 0, sudahSesuai = 0, bermasalah = 0;

  for (const p of DAFTAR_PINDAHAN) {
    const label = `${p.nama}${p.nim ? ' (' + p.nim + ')' : ''}`;
    const ditemukan = await cariMahasiswa(p, cache);

    if (ditemukan.length === 0) {
      console.log(`❌ ${label}: tidak ditemukan. Isi 'nim' di DAFTAR_PINDAHAN lalu jalankan ulang.`);
      bermasalah++; continue;
    }
    if (ditemukan.length > 1) {
      console.log(`⚠️  ${label}: ada ${ditemukan.length} mahasiswa bernama sama -> isi 'nim' supaya tidak salah orang:`);
      ditemukan.forEach(d => console.log(`     - NIM ${d.data().nim}  ${d.data().nama}  (kelas ${d.data().kelas || '-'})`));
      bermasalah++; continue;
    }

    const doc = ditemukan[0];
    const u = doc.data();
    if (u.role && u.role !== 'mahasiswa') {
      console.log(`⛔ ${label}: role "${u.role}", bukan mahasiswa. Dilewati.`);
      bermasalah++; continue;
    }

    const update = { jenisMasuk: 'Pindahan' };
    if (p.asalKampus) update.asalKampus = p.asalKampus;
    if (p.asalProdi) update.asalProdi = p.asalProdi;
    const berubah = Object.entries(update).filter(([k, v]) => u[k] !== v);

    console.log(`👤 ${u.nim} - ${u.nama}  [status: ${u.statusMahasiswa || '-'}]`);
    if (berubah.length === 0) {
      console.log('   ✔️  sudah sesuai, tidak ada perubahan');
      sudahSesuai++; continue;
    }
    berubah.forEach(([k, v]) => console.log(`   ${k}: ${u[k] === undefined ? '(kosong)' : JSON.stringify(u[k])}  ->  ${JSON.stringify(v)}`));
    if (!p.asalProdi) console.log('   ℹ️  asalProdi belum diisi (dilewati)');

    if (KONFIRMASI) await doc.ref.update(update);
    ditandai++;
  }

  console.log(`\nRingkasan: ditandai ${ditandai}, sudah sesuai ${sudahSesuai}, bermasalah ${bermasalah}`);
  if (!KONFIRMASI && ditandai > 0) console.log('👉 Jalankan ulang dengan --confirm untuk menyimpan.');
  process.exit(bermasalah > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
