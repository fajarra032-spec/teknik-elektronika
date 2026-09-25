/**
 * scripts/fix-permission-foto-mahasiswa.js
 *
 * PERBAIKAN SEKALI JALAN (one-off): foto mahasiswa (foto profil) & foto
 * yudisium yang di-upload SEBELUM perbaikan di routes/admin/mahasiswa.js
 * (POST '/', POST '/:id/update', POST '/:id/yudisium') tersimpan di Google
 * Drive TANPA izin publik - jadi meskipun linknya benar, browser gagal
 * memuatnya di halaman publik (403), fotonya sama sekali tidak tampil.
 *
 * Script ini menelusuri SEMUA dokumen mahasiswa (koleksi 'users', role
 * 'mahasiswa') yang punya fotoFileId dan/atau fotoYudisiumFileId, lalu
 * memberi izin "reader, anyone with link" ke masing-masing file - PERSIS
 * langkah yang sekarang otomatis dijalankan saat upload baru.
 *
 * AMAN dijalankan berkali-kali: kalau file sudah publik, Drive API akan
 * menolak permintaan duplikat dengan error yang di-skip (dicatat, bukan
 * dianggap gagal fatal) - jadi tidak akan error walau dijalankan ulang.
 *
 * DEFAULT DRY-RUN: hanya MENAMPILKAN file mana saja yang akan diubah,
 * TIDAK benar-benar mengubah apa pun, sampai dijalankan ulang dengan
 * flag --confirm.
 *
 * Cara pakai:
 *   node scripts/fix-permission-foto-mahasiswa.js            # dry-run
 *   node scripts/fix-permission-foto-mahasiswa.js --confirm   # beneran jalan
 */

const { db } = require('../config/firebaseAdmin');
const drive = require('../config/googleDrive');

const DRY_RUN = !process.argv.includes('--confirm');

async function jadikanPublik(fileId, label) {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    console.log(`  [OK] ${label} (fileId: ${fileId})`);
    return 'sukses';
  } catch (error) {
    // Kalau errornya "sudah ada izin serupa", ini bukan kegagalan -
    // anggap sudah beres, tidak perlu diulang.
    const pesan = error.message || '';
    if (pesan.toLowerCase().includes('already') || error.code === 409) {
      console.log(`  [SKIP] ${label} - sudah publik sebelumnya (fileId: ${fileId})`);
      return 'sudah_publik';
    }
    console.error(`  [GAGAL] ${label} (fileId: ${fileId}):`, pesan);
    return 'gagal';
  }
}

async function main() {
  console.log(DRY_RUN
    ? '=== DRY RUN (tidak mengubah apa pun - tambahkan --confirm untuk benar-benar menjalankan) ===\n'
    : '=== MODE KONFIRMASI - akan benar-benar mengubah izin file di Google Drive ===\n');

  const snapshot = await db.collection('users').where('role', '==', 'mahasiswa').get();

  const daftarFile = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    const nama = d.nama || doc.id;
    if (d.fotoFileId) daftarFile.push({ fileId: d.fotoFileId, label: `Foto profil - ${nama}` });
    if (d.fotoYudisiumFileId) daftarFile.push({ fileId: d.fotoYudisiumFileId, label: `Foto yudisium - ${nama}` });
  });

  console.log(`Ditemukan ${daftarFile.length} file untuk diperiksa/diperbaiki izinnya.\n`);

  if (DRY_RUN) {
    daftarFile.forEach(f => console.log(`  (akan diproses) ${f.label} (fileId: ${f.fileId})`));
    console.log('\nJalankan ulang dengan --confirm untuk benar-benar mengubah izin di Drive.');
    return;
  }

  const ringkasan = { sukses: 0, sudah_publik: 0, gagal: 0 };
  for (const f of daftarFile) {
    const hasil = await jadikanPublik(f.fileId, f.label);
    ringkasan[hasil] += 1;
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Berhasil dijadikan publik : ${ringkasan.sukses}`);
  console.log(`Sudah publik sebelumnya   : ${ringkasan.sudah_publik}`);
  console.log(`Gagal                     : ${ringkasan.gagal}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script berhenti karena error:', error);
    process.exit(1);
  });
