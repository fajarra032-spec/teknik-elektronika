/**
 * scripts/verifikasi-sebelum-pasang.js
 * ============================================================================
 * VERIFIKASI READ-ONLY - TIDAK MENGUBAH APA PUN DI FIRESTORE.
 *
 * Skrip ini memeriksa database ASLI Anda untuk 3 masalah spesifik yang
 * ditemukan & diperbaiki selama pengerjaan pembaruan rubrik/magang:
 *   1. Dokumen 'nilai' duplikat (mahasiswaId+mkId+tipe sama, >1 dokumen)
 *   2. Dokumen 'tugas' yang label periode-nya kemungkinan salah/drift
 *      (dihitung ulang dari tanggal deadline/createdAt-nya sendiri)
 *   3. Dokumen 'tugas' dengan kode MK sama tapi mkId berbeda ("salah MK")
 *
 * Skrip ini HANYA MEMBACA (tidak pernah .update()/.delete()/.add()), jadi
 * 100% aman dijalankan kapan saja, sebelum ATAU sesudah memasang pembaruan -
 * untuk melihat kondisi data yang sebenarnya, bukan cuma simulasi.
 *
 * CARA PAKAI:
 *   node scripts/verifikasi-sebelum-pasang.js
 *
 * Jalankan SEBELUM memasang file baru untuk melihat seberapa besar masalah
 * yang ada (kalau hasilnya nol/sedikit, berarti risikonya kecil). Jalankan
 * LAGI SESUDAH memasang untuk memastikan angka-angka ini mengecil/nol.
 * ============================================================================
 */

const { db } = require('../config/firebaseAdmin');

// --- Salinan mandiri logika semester (supaya skrip ini tetap jalan normal
// walau file helpers/academicHelper.js Anda belum diperbarui) ---
function getSemesterForDate(dateInput) {
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let semester, tahunAwal, tahunAkhir;
  if (month >= 2 && month <= 8) {
    semester = 'Genap'; tahunAwal = year - 1; tahunAkhir = year;
  } else if (month >= 9 && month <= 12) {
    semester = 'Ganjil'; tahunAwal = year; tahunAkhir = year + 1;
  } else {
    semester = 'Ganjil'; tahunAwal = year - 1; tahunAkhir = year;
  }
  return `${semester} ${tahunAwal}/${tahunAkhir}`;
}

async function cekNilaiDuplikat() {
  console.log('\n[1/3] Mengecek dokumen nilai duplikat (mahasiswaId + mkId + tipe sama)...');
  const snapshot = await db.collection('nilai').get();
  const grup = new Map(); // key: mahasiswaId|mkId|tipe -> [doc, doc, ...]
  snapshot.docs.forEach(doc => {
    const d = doc.data();
    const key = `${d.mahasiswaId}|${d.mkId}|${d.tipe}`;
    if (!grup.has(key)) grup.set(key, []);
    grup.get(key).push({ id: doc.id, ...d });
  });

  const duplikat = [];
  grup.forEach((docs, key) => {
    if (docs.length > 1) duplikat.push({ key, jumlah: docs.length, docs });
  });

  console.log(`   Total dokumen nilai diperiksa: ${snapshot.size}`);
  console.log(`   Kombinasi (mahasiswa+MK+tipe) yang punya LEBIH DARI 1 dokumen: ${duplikat.length}`);
  if (duplikat.length > 0) {
    console.log('   Contoh (maks 5 ditampilkan):');
    duplikat.slice(0, 5).forEach(d => {
      console.log(`     - ${d.key} -> ${d.jumlah} dokumen: [${d.docs.map(x => `${x.id}(nilai=${x.nilai},periode=${x.periode})`).join(', ')}]`);
    });
    console.log('   ⚠️  Ini kemungkinan penyebab nilai yang "tertimpa balik"/tidak konsisten.');
    console.log('      Setelah pasang saveNilai()/saveKomponenRubrik() yang baru, duplikat baru');
    console.log('      tidak akan terbentuk lagi, dan yang sudah ada otomatis dibersihkan saat');
    console.log('      dokumen itu diakses/dinilai ulang lewat aplikasi.');
  } else {
    console.log('   ✅ Tidak ada duplikat ditemukan.');
  }
  return duplikat.length;
}

async function cekTugasDrift() {
  console.log('\n[2/3] Mengecek dokumen tugas yang label periode-nya kemungkinan salah/drift...');
  const snapshot = await db.collection('tugas').get();
  let drift = 0;
  const contoh = [];
  snapshot.docs.forEach(doc => {
    const d = doc.data();
    const tanggalAcuan = d.deadline || d.createdAt;
    if (!tanggalAcuan) return; // tidak ada tanggal acuan, lewati
    const periodeSeharusnya = getSemesterForDate(tanggalAcuan);
    if (d.periode && d.periode !== periodeSeharusnya) {
      drift++;
      if (contoh.length < 5) {
        contoh.push({ id: doc.id, judul: d.judul, periodeTersimpan: d.periode, periodeSeharusnya, tanggalAcuan });
      }
    }
  });

  console.log(`   Total dokumen tugas diperiksa: ${snapshot.size}`);
  console.log(`   Yang label periode-nya TIDAK COCOK dengan tanggal aslinya: ${drift}`);
  if (drift > 0) {
    console.log('   Contoh (maks 5 ditampilkan):');
    contoh.forEach(c => {
      console.log(`     - "${c.judul}" (${c.id}): tersimpan "${c.periodeTersimpan}", seharusnya "${c.periodeSeharusnya}" (dari tanggal ${c.tanggalAcuan})`);
    });
    console.log('   ⚠️  Ini tugas yang mungkin "hilang" dari Daftar Tugas/Rubrik di periode yang salah.');
    console.log('      Setelah pasang getTugasByMkId() yang baru, ini otomatis diperbaiki begitu');
    console.log('      diakses lewat aplikasi (self-heal) - skrip ini TIDAK memperbaikinya sendiri.');
  } else {
    console.log('   ✅ Tidak ada drift periode ditemukan.');
  }
  return drift;
}

async function cekTugasSalahMk() {
  console.log('\n[3/3] Mengecek dokumen tugas dengan kode MK sama tapi mkId berbeda ("salah MK")...');
  const snapshot = await db.collection('tugas').get();
  const perKode = new Map(); // mkKode -> Set of mkId
  snapshot.docs.forEach(doc => {
    const d = doc.data();
    if (!d.mkKode || !d.mkId) return;
    if (!perKode.has(d.mkKode)) perKode.set(d.mkKode, new Set());
    perKode.get(d.mkKode).add(d.mkId);
  });

  const bermasalah = [];
  perKode.forEach((mkIdSet, mkKode) => {
    if (mkIdSet.size > 1) bermasalah.push({ mkKode, mkIds: Array.from(mkIdSet) });
  });

  console.log(`   Total kode MK unik pada dokumen tugas: ${perKode.size}`);
  console.log(`   Kode MK yang muncul dengan LEBIH DARI 1 mkId berbeda: ${bermasalah.length}`);
  if (bermasalah.length > 0) {
    console.log('   Detail:');
    bermasalah.forEach(b => {
      console.log(`     - Kode "${b.mkKode}" -> mkId berbeda: [${b.mkIds.join(', ')}]`);
    });
    console.log('   ⚠️  Kemungkinan ada 2 dokumen mataKuliah "kembar" untuk kelas yang sama.');
    console.log('      Ini TIDAK diperbaiki otomatis oleh aplikasi - perlu ditinjau manual mana');
    console.log('      mkId yang benar dipakai, lalu tugas yang salah dipindahkan ke situ.');
  } else {
    console.log('   ✅ Tidak ada indikasi MK kembar dari data tugas.');
  }
  return bermasalah.length;
}

async function main() {
  console.log('============================================================');
  console.log('  VERIFIKASI DATA (READ-ONLY - tidak mengubah apa pun)');
  console.log('============================================================');

  const jumlahDuplikat = await cekNilaiDuplikat();
  const jumlahDrift = await cekTugasDrift();
  const jumlahSalahMk = await cekTugasSalahMk();

  console.log('\n============================================================');
  console.log('  RINGKASAN');
  console.log('============================================================');
  console.log(`  Nilai duplikat        : ${jumlahDuplikat}`);
  console.log(`  Tugas periode drift   : ${jumlahDrift}`);
  console.log(`  Tugas salah MK        : ${jumlahSalahMk}`);
  console.log('');
  if (jumlahDuplikat + jumlahDrift + jumlahSalahMk === 0) {
    console.log('  ✅ Tidak ada masalah terdeteksi - aman untuk memasang pembaruan.');
  } else {
    console.log('  ℹ️  Ada beberapa hal ditemukan (lihat detail di atas). Ini BUKAN error');
    console.log('     yang berbahaya - pembaruan yang dibuat justru dirancang utk memperbaiki');
    console.log('     hal-hal ini secara otomatis & aman saat diakses lewat aplikasi.');
  }
  console.log('');
}

main().catch(error => {
  console.error('Verifikasi gagal:', error);
  process.exitCode = 1;
});
