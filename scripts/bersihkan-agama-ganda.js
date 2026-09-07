/**
 * scripts/bersihkan-agama-ganda.js
 *
 * aktifkanPaketKrs() di helpers/paketKurikulumHelper.js HANYA MENAMBAH mata
 * kuliah, tidak pernah menghapus. Jadi kalau field `agama` mahasiswa pernah
 * diubah SETELAH KRS semester 1-nya pernah diaktifkan (mis. dari default
 * "Islam" dikoreksi ke agama sebenarnya), mata kuliah Pendidikan Agama yang
 * LAMA tetap nyantol aktif di enrollment-nya, ganda dengan yang baru.
 *
 * Script ini mencari SEMUA mahasiswa yang py active enrollment di LEBIH
 * DARI SATU kode Pendidikan Agama (WUD2201-5) sekaligus, lalu:
 * - Menyisakan/mempertahankan yang kodenya SESUAI dengan field `agama`
 *   TERBARU di profil mahasiswa itu.
 * - Menonaktifkan (status: 'dibatalkan', BUKAN dihapus permanen - supaya
 *   tetap ada jejaknya) enrollment mata kuliah agama yang lain.
 *
 * AMAN DIJALANKAN BERKALI-KALI: mahasiswa yang cuma py 1 mata kuliah agama
 * aktif (kondisi normal) tidak disentuh sama sekali.
 *
 * Cara pakai:
 *   node scripts/bersihkan-agama-ganda.js
 */

const { db } = require('../config/firebaseAdmin');
const { KODE_AGAMA, AGAMA_OPTIONS, DEFAULT_AGAMA } = require('../helpers/paketKurikulumHelper');

const KODE_AGAMA_SET = new Set(Object.values(KODE_AGAMA)); // {WUD2201, WUD2202, ..., WUD2205}

async function main() {
  console.log('='.repeat(70));
  console.log('BERSIHKAN ENROLLMENT PENDIDIKAN AGAMA GANDA');
  console.log('='.repeat(70));

  // 1. Ambil semua mataKuliah dengan kode Pendidikan Agama -> map id -> kode
  const mkSnapshot = await db.collection('mataKuliah').get();
  const mkIdKeKode = {};
  mkSnapshot.docs.forEach(doc => {
    const kode = doc.data().kode;
    if (KODE_AGAMA_SET.has(kode)) mkIdKeKode[doc.id] = kode;
  });

  if (Object.keys(mkIdKeKode).length === 0) {
    console.log('Tidak ada mata kuliah Pendidikan Agama ditemukan di collection mataKuliah. Berhenti.');
    process.exit(0);
  }

  // 2. Ambil semua enrollment AKTIF yang mkId-nya salah satu MK agama itu
  const enrollmentSnapshot = await db.collection('enrollment')
    .where('status', '==', 'active')
    .get();

  const enrollmentAgamaPerUser = {}; // userId -> [ {enrollmentDoc, kode} ]
  enrollmentSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const kode = mkIdKeKode[data.mkId];
    if (!kode) return; // bukan MK agama
    if (!enrollmentAgamaPerUser[data.userId]) enrollmentAgamaPerUser[data.userId] = [];
    enrollmentAgamaPerUser[data.userId].push({ doc, kode });
  });

  const userIdGanda = Object.keys(enrollmentAgamaPerUser).filter(uid => enrollmentAgamaPerUser[uid].length > 1);

  if (userIdGanda.length === 0) {
    console.log('✅ Tidak ada mahasiswa dengan enrollment Pendidikan Agama ganda. Aman, tidak ada yang perlu dibersihkan.');
    process.exit(0);
  }

  console.log(`Ditemukan ${userIdGanda.length} mahasiswa dengan enrollment agama ganda:\n`);

  let totalDinonaktifkan = 0;

  for (const userId of userIdGanda) {
    const mhsDoc = await db.collection('users').doc(userId).get();
    if (!mhsDoc.exists) {
      console.log(`⚠️  userId ${userId} tidak ditemukan di collection users - dilewati.`);
      continue;
    }
    const mhsData = mhsDoc.data();
    const agamaProfil = AGAMA_OPTIONS.includes(mhsData.agama) ? mhsData.agama : DEFAULT_AGAMA;
    const kodeBenar = KODE_AGAMA[agamaProfil];

    const daftarEnrollment = enrollmentAgamaPerUser[userId];
    const kodeDipunyai = daftarEnrollment.map(e => e.kode).join(', ');
    console.log(`${mhsData.nim} - ${mhsData.nama} (agama profil: ${agamaProfil}) - punya enrollment: ${kodeDipunyai}`);

    for (const item of daftarEnrollment) {
      if (item.kode === kodeBenar) {
        console.log(`   ✓  Dipertahankan: ${item.kode}`);
        continue;
      }
      await item.doc.ref.update({
        status: 'dibatalkan',
        dibatalkanAt: new Date().toISOString(),
        dibatalkanKarena: `Enrollment agama ganda - digantikan ${kodeBenar} sesuai agama profil terbaru`
      });
      console.log(`   🗑️  Dinonaktifkan: ${item.kode} (tidak sesuai agama profil saat ini)`);
      totalDinonaktifkan++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Mahasiswa yang dibereskan : ${userIdGanda.length}`);
  console.log(`Enrollment dinonaktifkan  : ${totalDinonaktifkan}`);
  console.log('\nSelesai. Cek lagi ELK-Learning mahasiswa yang tadi bermasalah -');
  console.log('sekarang harusnya cuma muncul 1 mata kuliah Pendidikan Agama.');

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
