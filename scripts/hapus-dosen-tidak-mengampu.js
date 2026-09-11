/**
 * scripts/hapus-dosen-tidak-mengampu.js
 *
 * Mencari dosen yang TIDAK mengampu mata kuliah apapun (id-nya tidak
 * muncul di `dosenIds` MK manapun), lalu menghapusnya - baik dari
 * Firestore (`dosen`) maupun akun login-nya di Firebase Auth (supaya
 * benar-benar bersih, bukan cuma profilnya).
 *
 * PENGAMAN TAMBAHAN (supaya tidak salah hapus dosen yang masih
 * dibutuhkan walau tidak mengampu MK):
 *   - Dicek juga apakah dosen itu jadi Pembimbing Akademik (PA) siapapun
 *     (field `dosenPaId` di dokumen `users` mahasiswa). Kalau iya, dosen
 *     itu TIDAK dihapus - cukup dilaporkan sebagai "tidak mengampu MK
 *     tapi masih jadi PA X mahasiswa", supaya admin yang putuskan manual.
 *   - Dosen yang mengampu MINIMAL 1 MK (di semester manapun, tidak
 *     dibatasi periode aktif - supaya dosen yang mengajar MK semester
 *     lain/semester depan tidak ikut kehapus) TIDAK disentuh.
 *
 * DEFAULT DRY-RUN (cuma menampilkan siapa yang AKAN dihapus). Perlu
 * flag --confirm untuk benar-benar menghapus.
 *
 * Cara pakai:
 *   node scripts/hapus-dosen-tidak-mengampu.js
 *   node scripts/hapus-dosen-tidak-mengampu.js --confirm
 */

const { db, auth } = require('../config/firebaseAdmin');

const KONFIRMASI = process.argv.includes('--confirm');

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENGHAPUS' : '🟡 DRY-RUN - cuma simulasi, tidak menghapus apa pun'}\n`);

  // 1) Semua dosen
  const dosenSnapshot = await db.collection('dosen').get();
  const semuaDosen = dosenSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Total dosen di sistem: ${semuaDosen.length}`);

  // 2) Kumpulkan semua dosenIds yang dipakai di SEMUA mataKuliah (semester apapun)
  const mkSnapshot = await db.collection('mataKuliah').get();
  const idDosenMengampu = new Set();
  mkSnapshot.docs.forEach(doc => {
    (doc.data().dosenIds || []).forEach(id => idDosenMengampu.add(id));
  });

  // 3) Kumpulkan semua dosenPaId dari users (mahasiswa) - dosen yg jadi PA
  const usersSnapshot = await db.collection('users').where('dosenPaId', '!=', null).get().catch(() => null);
  const paCountMap = {}; // dosenId -> jumlah mahasiswa bimbingan
  if (usersSnapshot) {
    usersSnapshot.docs.forEach(doc => {
      const paId = doc.data().dosenPaId;
      if (paId) paCountMap[paId] = (paCountMap[paId] || 0) + 1;
    });
  } else {
    // fallback kalau query != tidak didukung: ambil semua users, filter manual
    const semuaUsers = await db.collection('users').get();
    semuaUsers.docs.forEach(doc => {
      const paId = doc.data().dosenPaId;
      if (paId) paCountMap[paId] = (paCountMap[paId] || 0) + 1;
    });
  }

  // 4) Klasifikasikan tiap dosen
  const akanDihapus = [];
  const dilewatiKarenaPA = [];
  const mengampu = [];

  for (const d of semuaDosen) {
    const jumlahPA = paCountMap[d.id] || 0;
    if (idDosenMengampu.has(d.id)) {
      mengampu.push(d);
    } else if (jumlahPA > 0) {
      dilewatiKarenaPA.push({ ...d, jumlahPA });
    } else {
      akanDihapus.push(d);
    }
  }

  console.log(`\nMengampu minimal 1 MK (tidak disentuh)      : ${mengampu.length}`);
  console.log(`Tidak mengampu TAPI masih jadi PA (dilewati) : ${dilewatiKarenaPA.length}`);
  dilewatiKarenaPA.forEach(d => console.log(`   ⏭️  ${d.nama} (id: ${d.id}) - PA dari ${d.jumlahPA} mahasiswa`));

  console.log(`\nTidak mengampu MK & bukan PA siapapun (KANDIDAT DIHAPUS): ${akanDihapus.length}`);
  akanDihapus.forEach(d => console.log(`   ❌ ${d.nama}  (id: ${d.id}, email: ${d.email || '-'})`));

  if (akanDihapus.length === 0) {
    console.log('\nTidak ada dosen yang perlu dihapus.');
    process.exit(0);
  }

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru DRY-RUN. Periksa baik-baik daftar "KANDIDAT DIHAPUS" di atas.');
    console.log('   Kalau sudah yakin benar, jalankan ulang dengan --confirm:');
    console.log('   node scripts/hapus-dosen-tidak-mengampu.js --confirm');
    process.exit(0);
  }

  console.log('\n--- MENGHAPUS ---');
  let berhasil = 0, gagal = 0;
  for (const d of akanDihapus) {
    try {
      await db.collection('dosen').doc(d.id).delete();
      try {
        await auth.deleteUser(d.id);
      } catch (authErr) {
        console.log(`   ⚠️  ${d.nama}: dokumen Firestore terhapus, tapi akun Auth gagal/tidak ada (${authErr.message}) - kemungkinan memang tidak punya akun login.`);
      }
      console.log(`   🗑️  ${d.nama} dihapus.`);
      berhasil++;
    } catch (err) {
      console.error(`   ⚠️  Gagal hapus ${d.nama}:`, err.message);
      gagal++;
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Berhasil dihapus : ${berhasil}`);
  console.log(`Gagal            : ${gagal}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
