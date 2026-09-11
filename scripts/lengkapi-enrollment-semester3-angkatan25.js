/**
 * scripts/lengkapi-enrollment-semester3-angkatan25.js
 *
 * Angkatan 2025 sekarang di Semester 3 (Ganjil 2026/2027), dan menurut
 * jadwal resmi Semester 3 CUMA ADA SATU KELAS (3A) - beda dari kasus
 * Semester 1 (Kelas A & B) yang perlu dokumen MK terpisah. Jadi di sini
 * TIDAK ADA dokumen MK baru yang perlu dibuat - script ini cuma
 * MELENGKAPI `enrollment` yang mungkin belum ada untuk sebagian
 * mahasiswa angkatan 2025 di MK-MK Semester 3, supaya semuanya konsisten
 * masuk ke SATU dokumen MK yang sama per mata kuliah.
 *
 * Cara kerja:
 *   1. Ambil semua mahasiswa angkatan 2025 (NIM diawali '25') role=mahasiswa.
 *   2. Ambil semua dokumen mataKuliah semester=3.
 *      - Kalau ada kode yang punya >1 dokumen (berarti ada pemisahan
 *        kelas juga di semester 3, di luar dugaan) -> DILEWATI & di
 *        laporkan, TIDAK ditebak otomatis, karena itu situasi beda dari
 *        yang diminta admin ("cuma 1 kelas").
 *      - Kode dengan tepat 1 dokumen -> lanjut ke langkah 3.
 *   3. Untuk tiap dokumen itu:
 *      - Kalau MK itu SAMA SEKALI belum ada enrollment (0), DILEWATI -
 *        ini tanda MK tsb bukan yang diambil kelas ini (mis. semester 3
 *        Elektronika ada 2 jalur peminatan - Instrumentasi & Telekomunikasi
 *        - yang MK-nya beda tapi sama-sama "semester 3"; kalau angkatan
 *        ini cuma ambil jalur Instrumentasi, MK jalur Telekomunikasi
 *        wajar 0 enrollment dan TIDAK boleh diisi paksa).
 *      - Kalau MK itu SUDAH ada enrollment (berarti memang MK yang benar
 *        dipakai kelas ini), baru dicek siapa dari angkatan 2025 yang
 *        BELUM punya enrollment aktif di periode ini -> dilengkapi.
 *      Yang SUDAH punya enrollment (mis. dari KRS asli) TIDAK disentuh/
 *      tidak dibuat dobel.
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar menulis.
 *
 * Cara pakai:
 *   node scripts/lengkapi-enrollment-semester3-angkatan25.js
 *   node scripts/lengkapi-enrollment-semester3-angkatan25.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { getPeriodeAktif } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const PERIODE_AKTIF = getPeriodeAktif();
const PREFIX_ANGKATAN = '25';

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS ENROLLMENT' : '🟡 DRY-RUN - cuma simulasi'}`);
  console.log(`Periode aktif: "${PERIODE_AKTIF}"\n`);

  // 1) Mahasiswa angkatan 2025
  const userSnapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();
  const mahasiswa25 = userSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(u => (u.nim || '').startsWith(PREFIX_ANGKATAN));
  console.log(`Total mahasiswa angkatan 20${PREFIX_ANGKATAN}: ${mahasiswa25.length}\n`);

  // 2) MK semester 3, kelompokkan per kode utk deteksi duplikat
  const mkSnapshot = await db.collection('mataKuliah').where('semester', '==', 3).get();
  const byKode = {};
  mkSnapshot.docs.forEach(doc => {
    const mk = { id: doc.id, ...doc.data() };
    if (!byKode[mk.kode]) byKode[mk.kode] = [];
    byKode[mk.kode].push(mk);
  });

  let totalDitambahkan = 0;
  let totalSudahAda = 0;
  let totalDilewati = 0;

  for (const [kode, daftarMk] of Object.entries(byKode)) {
    if (daftarMk.length > 1) {
      console.log(`⚠️  [${kode}] punya ${daftarMk.length} dokumen (dipisah kelas?) - DILEWATI, di luar cakupan script ini.`);
      continue;
    }

    const mk = daftarMk[0];
    const enrollSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mk.id)
      .where('semester', '==', PERIODE_AKTIF)
      .where('status', '==', 'active')
      .get();
    const sudahEnrollId = new Set(enrollSnapshot.docs.map(d => d.data().userId));

    const belum = mahasiswa25.filter(m => !sudahEnrollId.has(m.id));

    // PENTING: kalau MK ini belum ada enrollment SAMA SEKALI, itu tanda
    // MK ini BUKAN yang diambil angkatan ini (mis. jalur peminatan lain
    // yang MK-nya kebetulan sama-sama semester 3 tapi beda track) - jangan
    // di-enroll-kan semua dari nol, cukup lewati. Hanya MK yang SUDAH
    // dipakai (ada minimal 1 enrollment asli) yang boleh "dilengkapi".
    if (sudahEnrollId.size === 0) {
      console.log(`⏭️  [${kode}] ${mk.nama} - belum ada enrollment sama sekali (kemungkinan bukan MK kelas ini, mis. jalur peminatan lain) - DILEWATI, tidak di-enroll-kan.`);
      totalDilewati++;
      continue;
    }

    console.log(`[${kode}] ${mk.nama} - sudah enroll: ${sudahEnrollId.size}, belum: ${belum.length}`);
    if (belum.length > 0 && belum.length <= 10) {
      belum.forEach(m => console.log(`     akan ditambahkan: ${m.nim}  ${m.nama}`));
    } else if (belum.length > 10) {
      belum.slice(0, 5).forEach(m => console.log(`     akan ditambahkan: ${m.nim}  ${m.nama}`));
      console.log(`     ...dan ${belum.length - 5} lainnya`);
    }

    totalSudahAda += sudahEnrollId.size;
    totalDitambahkan += belum.length;

    if (KONFIRMASI) {
      for (const m of belum) {
        await db.collection('enrollment').add({
          userId: m.id,
          mkId: mk.id,
          semester: PERIODE_AKTIF,
          status: 'active',
          createdAt: new Date().toISOString(),
          approvedBy: null,
          krsId: null,
          catatan: 'Dibuat otomatis oleh scripts/lengkapi-enrollment-semester3-angkatan25.js - melengkapi enrollment angkatan 2025 di Semester 3 Kelas 3A (kelas tunggal).'
        });
      }
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`MK dilewati (0 enrollment - dianggap bukan MK kelas ini) : ${totalDilewati}`);
  console.log(`Enrollment sudah ada sebelumnya : ${totalSudahAda}`);
  console.log(`Enrollment ${KONFIRMASI ? 'ditambahkan' : 'AKAN ditambahkan'} : ${totalDitambahkan}`);

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru DRY-RUN. Kalau daftar di atas sudah sesuai, jalankan ulang dengan --confirm:');
    console.log('   node scripts/lengkapi-enrollment-semester3-angkatan25.js --confirm');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
