/**
 * scripts/isi-kontak-dosen.js
 *
 * Mengisi field `kontak` (No. HP) untuk dosen-dosen berikut, dicocokkan
 * berdasarkan nama (dinormalisasi, sama seperti script assign-dosen-pa-*
 * dkk) supaya tidak perlu tahu ID dokumennya:
 *
 *   Esron                      -> +62 852-4215-8262
 *   Farhan (Yustisio)          -> +62 852-3640-1690   (di jadwal disebut "Farhan Calon Dosen")
 *   Ariani Amri                -> +62 812-5471-6367
 *   Gunawan Tari                -> +62 851-4510-0455   ("Pak Gunawan Tari")
 *   Rahman Syam                 -> +62 852-5512-4285
 *   Suardi                      -> +62 812-1476-2546   ("Suardi Dosen Polidewa")
 *
 * Rismawati (disebut "Calon Dosen" - belum jadi dosen tetap/belum
 * mengampu MK apa pun di sistem ini) -> +62 852-5526-3631
 * TIDAK otomatis dibuatkan akun baru oleh script ini (karena statusnya
 * masih "calon", belum ditugaskan mengajar) - cuma DILAPORKAN di akhir
 * kalau memang belum ada datanya di sistem, supaya Anda putuskan sendiri
 * kapan waktunya dibuatkan akun.
 *
 * AMAN DIJALANKAN BERKALI-KALI: cuma menimpa field `kontak`, tidak
 * menyentuh field lain (nama, email, nip/nidn, dll tetap utuh).
 *
 * Cara pakai:
 *   node scripts/isi-kontak-dosen.js
 */

const { db } = require('../config/firebaseAdmin');

const DAFTAR_KONTAK = [
  { nama: 'Esron', kontak: '+62 852-4215-8262' },
  { nama: 'Farhan Yustisio', kontak: '+62 852-3640-1690' },
  { nama: 'Ariani Amri, S.Pd., M.Pd', kontak: '+62 812-5471-6367' },
  { nama: 'Gunawan Tari, S.T., M.T', kontak: '+62 851-4510-0455' },
  { nama: 'Rahman Syam, S.Pd., M.Si', kontak: '+62 852-5512-4285' },
  { nama: 'Suardi, S.Pd., M.Pd', kontak: '+62 812-1476-2546' },
];

// Belum jadi dosen aktif di sistem - cuma dicek, TIDAK dibuatkan akun
const CALON_DOSEN = { nama: 'Rismawati', kontak: '+62 852-5526-3631' };

function normalisasiNama(nama) {
  return (nama || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('='.repeat(70));
  console.log('ISI KONTAK (NO. HP) DOSEN');
  console.log('='.repeat(70));

  const semuaDosenSnapshot = await db.collection('dosen').get();
  let berhasil = 0;
  const tidakKetemu = [];

  for (const item of DAFTAR_KONTAK) {
    const targetNormal = normalisasiNama(item.nama);
    const cocok = semuaDosenSnapshot.docs.find(doc => normalisasiNama(doc.data().nama) === targetNormal);

    if (!cocok) {
      console.log(`❌ "${item.nama}" tidak ditemukan di database dosen - dilewati.`);
      tidakKetemu.push(item.nama);
      continue;
    }

    await cocok.ref.update({ kontak: item.kontak, updatedAt: new Date().toISOString() });
    console.log(`✅ ${cocok.data().nama} -> kontak diisi: ${item.kontak}`);
    berhasil++;
  }

  // Cek Rismawati (calon dosen) - cuma dicek, tidak dibuatkan akun
  const targetNormalCalon = normalisasiNama(CALON_DOSEN.nama);
  const cocokCalon = semuaDosenSnapshot.docs.find(doc => normalisasiNama(doc.data().nama) === targetNormalCalon);
  console.log('\n--- Calon Dosen (belum mengampu MK apa pun) ---');
  if (cocokCalon) {
    await cocokCalon.ref.update({ kontak: CALON_DOSEN.kontak, updatedAt: new Date().toISOString() });
    console.log(`✅ ${cocokCalon.data().nama} (sudah ada di sistem) -> kontak diisi: ${CALON_DOSEN.kontak}`);
    berhasil++;
  } else {
    console.log(`ℹ️  "${CALON_DOSEN.nama}" BELUM ada di database dosen (masih "Calon Dosen", belum ditugaskan mengajar).`);
    console.log(`    Nomornya (${CALON_DOSEN.kontak}) belum disimpan ke mana pun - kalau dia sudah resmi jadi`);
    console.log('    dosen pengampu MK tertentu nanti, beri tahu saya, biar sekaligus dibuatkan akun + kontaknya.');
  }

  console.log('\n' + '='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Berhasil diisi kontaknya : ${berhasil}`);
  if (tidakKetemu.length > 0) {
    console.log(`Tidak ditemukan          : ${tidakKetemu.join(', ')}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
