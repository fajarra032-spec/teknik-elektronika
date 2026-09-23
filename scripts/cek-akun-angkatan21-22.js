/**
 * scripts/cek-akun-angkatan21-22.js
 *
 * Script DIAGNOSTIK (READ-ONLY). Mengecek dari daftar NIM angkatan 2021
 * (21 mahasiswa) dan angkatan 2022 (28 mahasiswa) di Excel sumber, mana
 * yang SUDAH punya akun di koleksi `users` dan mana yang BELUM - untuk
 * menjelaskan kenapa halaman admin "Daftar Mahasiswa" tampil sedikit
 * untuk kedua angkatan ini (kemungkinan besar: akunnya memang belum ada,
 * sama seperti kasus 11 mahasiswa angkatan 2023 sebelumnya).
 *
 * Cara pakai:
 *   node scripts/cek-akun-angkatan21-22.js
 */

const { db } = require('../config/firebaseAdmin');

const DAFTAR_21 = [
  { nim: '21302001', nama: 'Serliadi' },
  { nim: '21302002', nama: 'Asri Dian Perdana T' },
  { nim: '21302003', nama: 'Yudi Ahmar' },
  { nim: '21302004', nama: 'Hendra' },
  { nim: '21302005', nama: 'Wilfani Tosampe' },
  { nim: '21302006', nama: 'Saipul' },
  { nim: '21302007', nama: 'Adimas Pangestu' },
  { nim: '21302008', nama: 'Ifan' },
  { nim: '21302009', nama: 'Sanjaya' },
  { nim: '21302010', nama: 'Rifaldhy Saputra' },
  { nim: '21302011', nama: 'Suwandi Supu' },
  { nim: '21302012', nama: 'Randi Dwi Putra' },
  { nim: '21302013', nama: 'Wanda Meylani Putri' },
  { nim: '21302014', nama: 'Muh Arqha' },
  { nim: '21302015', nama: 'Muh. Arafat Rifaldy Muslimin' },
  { nim: '21302016', nama: 'Serlina' },
  { nim: '21302017', nama: 'Harmiati' },
  { nim: '21302018', nama: 'Yatno Mangnga' },
  { nim: '21302019', nama: 'Rifky Alamsyah' },
  { nim: '21302020', nama: 'Widya Anggraeni' },
  { nim: '21302021', nama: 'Muh. Rifqi Ariansyah' }
];

const DAFTAR_22 = [
  { nim: '22302001', nama: 'Syamsul Rijal' },
  { nim: '22302002', nama: 'Irham Ilyas' },
  { nim: '22302003', nama: 'Ahmad Iswadi' },
  { nim: '22302004', nama: 'Muh. Arif Ikhlasul Amal' },
  { nim: '22302005', nama: 'Sutan' },
  { nim: '22302006', nama: 'Wahyu Farhan' },
  { nim: '22302007', nama: 'Muhaimin Jabir' },
  { nim: '22302008', nama: 'Indriani Sukisman' },
  { nim: '22302009', nama: 'Muh. Azhar Nur' },
  { nim: '22302010', nama: 'Asriani' },
  { nim: '22302011', nama: 'Akmal Kamaruddin' },
  { nim: '22302012', nama: 'Erin Barira' },
  { nim: '22302013', nama: 'Maulana Syam' },
  { nim: '22302014', nama: 'Hafid' },
  { nim: '22302015', nama: 'Nurhaliza' },
  { nim: '22302016', nama: 'Diwon Girik Allo' },
  { nim: '22302017', nama: 'Jumiati' },
  { nim: '22302018', nama: 'Annisa Diah Farny' },
  { nim: '22302019', nama: 'Devi Permata Sari' },
  { nim: '22302020', nama: 'Syamsul Bahri' },
  { nim: '22302021', nama: 'Salvator Olgi Endo' },
  { nim: '22302022', nama: 'Asa Yunus Rufina' },
  { nim: '22302023', nama: "Priska Iriany Karoma'" },
  { nim: '22302054', nama: 'Rachmad Alfiandy' },
  { nim: '22302055', nama: 'Resi Pamuso' },
  { nim: '22302056', nama: 'Muh. Raiyhan Hadi Pratama' },
  { nim: '22302053', nama: 'Erlinda Dahlia' },
  { nim: '22302057', nama: 'Muh. Ridwan' }
];

async function cek(daftar, label) {
  console.log(`\n=== Angkatan ${label} (${daftar.length} mahasiswa di Excel) ===`);
  let ada = 0, tidakAda = 0;
  const tidakAdaList = [];
  for (const m of daftar) {
    const snap = await db.collection('users').where('nim', '==', m.nim).limit(1).get();
    if (snap.empty) {
      tidakAda++;
      tidakAdaList.push(m);
      console.log(`   \u274c TIDAK ADA akun: ${m.nim}  ${m.nama}`);
    } else {
      ada++;
      const data = snap.docs[0].data();
      console.log(`   \u2705 ada  (statusMahasiswa: ${data.statusMahasiswa || '(kosong)'})  ${m.nim}  ${m.nama}`);
    }
  }
  console.log(`   -> Ada akun: ${ada} / ${daftar.length}, TIDAK ADA akun: ${tidakAda} / ${daftar.length}`);
  return tidakAdaList;
}

async function main() {
  const tidakAda21 = await cek(DAFTAR_21, '2021');
  const tidakAda22 = await cek(DAFTAR_22, '2022');

  console.log('\n' + '='.repeat(78));
  console.log('RINGKASAN');
  console.log('='.repeat(78));
  console.log(`Angkatan 2021: ${tidakAda21.length} dari ${DAFTAR_21.length} NIM BELUM punya akun.`);
  console.log(`Angkatan 2022: ${tidakAda22.length} dari ${DAFTAR_22.length} NIM BELUM punya akun.`);
  if (tidakAda21.length + tidakAda22.length > 0) {
    console.log('\nInilah kemungkinan besar penyebab "sedikit" yang tampil di halaman admin -');
    console.log('mahasiswa yang belum punya akun otomatis tidak akan muncul di Daftar Mahasiswa');
    console.log('(halaman itu membaca dari koleksi `users`, bukan dari Excel).');
    console.log('\nKalau mau, saya bisa buatkan script utk membuat akun-akun yang belum ada ini,');
    console.log('mengikuti pola yang sama seperti 11 mahasiswa angkatan 2023 kemarin.');
  } else {
    console.log('\nSemua NIM sudah punya akun - kalau di web masih kelihatan "sedikit", berarti');
    console.log('penyebabnya BUKAN akun yang belum ada, perlu dicek dari sisi lain (mis. filter');
    console.log('statusMahasiswa di halaman admin, atau halaman mana persis yang dimaksud).');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
