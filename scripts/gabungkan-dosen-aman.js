/**
 * scripts/gabungkan-dosen-aman.js
 *
 * Menggabungkan dokumen dosen duplikat dengan MEMPERBARUI SEMUA REFERENSI
 * yang kita kenal sebelum dokumen duplikat dihapus:
 *   1. users.dosenPaId / dosenPaNama / dosenPaNidn   (Pembimbing Akademik)
 *   2. mataKuliah.dosenIds                           (pengampu MK)
 *   3. mataKuliah/{id}/pengampuPeriode/*.dosenIds    (pengampu per semester)
 *   4. bebanMengajar.dosen[].id                      (rekap beban dosen)
 * (Script bawaan scripts/gabungkan-dosen-duplikat.js hanya mengerjakan no. 1,
 *  sehingga bila dokumen yang dihapus dipakai sebagai pengampu MK, pengampu
 *  itu hilang.)
 *
 * DAFTAR_GABUNG berisi dua bentuk entri:
 *   - berdasarkan ID    : { simpan: '<id>', hapus: ['<id>', ...] }
 *   - berdasarkan NAMA  : { simpanNama: '...', hapusNama: ['...'] }
 *     (dokumen dicari di koleksi `dosen`; harus ketemu TEPAT satu per nama)
 *
 * PENGAMAN
 *  - Nama kedua dokumen harus sama (kunci nama: tanpa gelar/tanda baca). Bila
 *    sengaja berbeda penulisan (orang yang sama, nama salah ketik/berubah),
 *    entri harus diberi  izinkanNamaBeda: true  - dan kata pertama nama tetap
 *    harus sama (supaya salah ketik id/nama tidak menggabung orang lain).
 *  - DRY-RUN secara default: hanya menghitung berapa referensi yang akan
 *    dipindah. Tambahkan --confirm untuk benar-benar menulis.
 *  - Akun login dokumen yang dihapus (bila ada) DINONAKTIFKAN, bukan dihapus.
 *    Dry-run menampilkan email akun yang akan dinonaktifkan - pastikan dosen
 *    yang bersangkutan memakai akun dari dokumen yang DISIMPAN.
 *  - Aman diulang: dokumen yang sudah tidak ada dilewati.
 *  - Koleksi lain yang mungkin menyimpan id dosen (surat, sk, sertifikat,
 *    edom, magang, dst.) TIDAK dipindai.
 *
 * ENTRI SAAT INI
 *  1. Rismawati, S.Pd., M.Pd. (hasil scripts/cek-dosen-duplikat.js)
 *     - 0WtpvuezA5T5LMyGSZtFImdsBCs1 : punya akun login           -> DISIMPAN
 *     - 5fTSS1BHWo6JOKDliXAT         : tanpa akun login           -> dihapus
 *  2. Sarifuddin: "Sarifuddin Ihsan Al Alim, S.Pd., M.Pd." (nama di jadwal terbaru)
 *     DISIMPAN; "Sarifuddin Islah Al Amin, S.Pd., M.Pd" dihapus. Keduanya orang
 *     yang sama (dikonfirmasi admin). Mau sebaliknya? Tukar isi simpanNama dan
 *     hapusNama di bawah.
 *
 *   node scripts/gabungkan-dosen-aman.js            (cek dulu)
 *   node scripts/gabungkan-dosen-aman.js --confirm  (jalankan)
 */
const { db, auth } = require('../config/firebaseAdmin');
const { kunciNama } = require('../helpers/namaDosen');

const KONFIRMASI = process.argv.includes('--confirm');

const DAFTAR_GABUNG = [
  { simpan: '0WtpvuezA5T5LMyGSZtFImdsBCs1', hapus: ['5fTSS1BHWo6JOKDliXAT'] },
  {
    simpanNama: 'Sarifuddin Ihsan Al Alim, S.Pd., M.Pd.',
    hapusNama: ['Sarifuddin Islah Al Amin, S.Pd., M.Pd'],
    izinkanNamaBeda: true
  }
];

/** Ganti hapusId -> simpanId di array, tanpa duplikat. Mengembalikan array baru atau null bila tak ada perubahan. */
function gantiDiArray(arr, hapusId, simpanId) {
  if (!Array.isArray(arr) || !arr.includes(hapusId)) return null;
  const hasil = [];
  arr.forEach(x => { const v = x === hapusId ? simpanId : x; if (!hasil.includes(v)) hasil.push(v); });
  return hasil;
}

const kataPertama = (nama) => kunciNama(nama).split(' ')[0] || '';

/** Terjemahkan entri (id atau nama) menjadi { simpanId, hapusIds, izin, galat? }. */
function resolusiEntri(item, semuaDosen) {
  if (item.simpan) {
    return { simpanId: item.simpan, hapusIds: item.hapus || [], izin: !!item.izinkanNamaBeda };
  }
  const cari = (nama) => semuaDosen.filter(d => kunciNama(d.data().nama) === kunciNama(nama));
  const daftarKandidat = (arr) => arr.map(d => `${d.id} (${d.data().nama})`).join('; ');

  const s = cari(item.simpanNama);
  if (s.length !== 1) {
    return { galat: s.length === 0
      ? `dokumen "${item.simpanNama}" tidak ditemukan`
      : `ada ${s.length} dokumen bernama "${item.simpanNama}" (${daftarKandidat(s)}) - gunakan entri berdasarkan ID` };
  }
  const hapusIds = [];
  const pesan = [];
  for (const nama of (item.hapusNama || [])) {
    const h = cari(nama);
    if (h.length === 0) { pesan.push(`"${nama}" sudah tidak ada (mungkin sudah digabung) - dilewati`); continue; }
    if (h.length > 1) return { galat: `ada ${h.length} dokumen bernama "${nama}" (${daftarKandidat(h)}) - gunakan entri berdasarkan ID` };
    if (h[0].id !== s[0].id) hapusIds.push(h[0].id);
  }
  return { simpanId: s[0].id, hapusIds, izin: !!item.izinkanNamaBeda, pesan };
}

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - menulis ke database' : '🟡 DRY-RUN - tidak menulis apa pun'}\n`);
  if (DAFTAR_GABUNG.length === 0) { console.log('DAFTAR_GABUNG kosong.'); process.exit(0); }

  // data yang dipindai sekali saja
  const dosenSnap = await db.collection('dosen').get();
  const mkSnap = await db.collection('mataKuliah').get();
  const bebanSnap = await db.collection('bebanMengajar').get();
  const pengampuCache = new Map(); // mkId -> snapshot pengampuPeriode
  for (const mk of mkSnap.docs) pengampuCache.set(mk.id, await db.collection('mataKuliah').doc(mk.id).collection('pengampuPeriode').get());

  const ringkasDosen = async (id, data) => {
    const pa = await db.collection('users').where('dosenPaId', '==', id).get();
    return `${data.nama}\n         id ${id} | email ${data.email || '-'} | nip ${data.nip || data.nidn || data.nuptk || '-'} | userId ${data.userId || '-'} | PA: ${pa.size} mahasiswa`;
  };

  let totalGagal = 0;
  for (const item of DAFTAR_GABUNG) {
    const r = resolusiEntri(item, dosenSnap.docs);
    const judul = item.simpan ? `ID ${item.simpan}` : `"${item.simpanNama}"`;
    console.log(`=== Gabungkan ke ${judul} ===`);
    if (r.galat) { console.log(`   ❌ ${r.galat}`); totalGagal++; console.log(''); continue; }
    (r.pesan || []).forEach(p => console.log(`   ℹ️  ${p}`));

    const simpanDoc = await db.collection('dosen').doc(r.simpanId).get();
    if (!simpanDoc.exists) { console.log('   ❌ dokumen yang disimpan tidak ditemukan - dilewati'); totalGagal++; console.log(''); continue; }
    const simpan = simpanDoc.data();
    console.log(`   Disimpan : ${await ringkasDosen(r.simpanId, simpan)}`);

    for (const hapusId of r.hapusIds) {
      if (hapusId === r.simpanId) { console.log('   ⚠️  id sama dengan yang disimpan - dilewati'); continue; }
      const hapusDoc = await db.collection('dosen').doc(hapusId).get();
      if (!hapusDoc.exists) { console.log(`   ⚠️  ${hapusId} tidak ditemukan (mungkin sudah dibersihkan) - dilewati`); continue; }
      const hapus = hapusDoc.data();
      console.log(`\n   Dihapus  : ${await ringkasDosen(hapusId, hapus)}`);

      // ---- pengaman nama ----
      const samaNama = kunciNama(hapus.nama) === kunciNama(simpan.nama);
      if (!samaNama) {
        if (!r.izin) {
          console.log(`   ⛔ Nama berbeda ("${hapus.nama}" vs "${simpan.nama}") - BUKAN duplikat, tidak digabung.`);
          totalGagal++; continue;
        }
        if (kataPertama(hapus.nama) !== kataPertama(simpan.nama)) {
          console.log(`   ⛔ Diizinkan beda nama, tetapi kata pertama nama berbeda ("${hapus.nama}" vs "${simpan.nama}") - dibatalkan demi keamanan.`);
          totalGagal++; continue;
        }
        console.log(`   ℹ️  Nama berbeda penulisan tetapi digabung atas izin admin (izinkanNamaBeda).`);
      }

      // ---- kumpulkan referensi ----
      const paSnap = await db.collection('users').where('dosenPaId', '==', hapusId).get();

      const mkUbah = [];
      mkSnap.docs.forEach(d => { const baru = gantiDiArray(d.data().dosenIds, hapusId, r.simpanId); if (baru) mkUbah.push({ ref: d.ref, nama: `${d.data().kode} ${d.data().nama} ${d.data().kelas || ''}`.trim(), baru }); });

      const periodeUbah = [];
      mkSnap.docs.forEach(mk => pengampuCache.get(mk.id).docs.forEach(p => {
        const baru = gantiDiArray(p.data().dosenIds, hapusId, r.simpanId);
        if (baru) periodeUbah.push({ ref: p.ref, nama: `${mk.data().kode} ${mk.data().kelas || ''} [${p.id}]`.replace(/\s+/g, ' '), baru });
      }));

      const bebanUbah = [];
      bebanSnap.docs.forEach(d => {
        const dosen = Array.isArray(d.data().dosen) ? d.data().dosen : [];
        if (dosen.some(x => x.id === hapusId)) {
          const baru = dosen.map(x => x.id === hapusId ? { ...x, id: r.simpanId } : x);
          bebanUbah.push({ ref: d.ref, nama: `${d.data().namaMk} ${(d.data().kelas || []).join('+')} [${d.data().periodeId}]`, baru });
        }
      });

      console.log(`   Referensi yang akan dipindahkan ke dokumen yang disimpan:`);
      console.log(`     - mahasiswa (Pembimbing Akademik) : ${paSnap.size}`);
      console.log(`     - mata kuliah (dosenIds)          : ${mkUbah.length}`);
      mkUbah.forEach(x => console.log(`         · ${x.nama}`));
      console.log(`     - pengampu per semester           : ${periodeUbah.length}`);
      periodeUbah.forEach(x => console.log(`         · ${x.nama}`));
      console.log(`     - rekap beban mengajar (sesi)     : ${bebanUbah.length}`);
      bebanUbah.forEach(x => console.log(`         · ${x.nama}`));
      if (hapus.userId && hapus.userId !== simpan.userId) {
        console.log(`   🔒 Akun login yang akan DINONAKTIFKAN: ${hapus.email || '-'} (userId ${hapus.userId}). Dosen sebaiknya login memakai: ${simpan.email || '-'}`);
      }

      if (!KONFIRMASI) continue;

      // ---- tulis ----
      for (const d of paSnap.docs) {
        await d.ref.update({
          dosenPaId: r.simpanId, dosenPaNama: simpan.nama,
          dosenPaNidn: simpan.nidn || simpan.nip || simpan.nuptk || null,
          updatedAt: new Date().toISOString()
        });
      }
      for (const x of mkUbah) await x.ref.update({ dosenIds: x.baru });
      for (const x of periodeUbah) await x.ref.update({ dosenIds: x.baru });
      for (const x of bebanUbah) await x.ref.update({ dosen: x.baru });

      await db.collection('dosen').doc(hapusId).delete();
      console.log(`   🗑️  Dokumen dosen duplikat ${hapusId} dihapus.`);

      if (hapus.userId && hapus.userId !== simpan.userId) {
        try {
          await auth.updateUser(hapus.userId, { disabled: true });
          console.log(`   🔒 Akun login duplikat (${hapus.userId}) dinonaktifkan.`);
        } catch (err) { console.log(`   ⚠️  Gagal menonaktifkan akun duplikat: ${err.message}`); }
      }
    }
    console.log('');
  }

  if (!KONFIRMASI) console.log('👉 Ini DRY-RUN. Jika sudah benar, jalankan ulang dengan --confirm.');
  else console.log('✅ Selesai. Cek ulang: node scripts/cek-dosen-duplikat.js');
  process.exit(totalGagal > 0 ? 1 : 0);
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1); });
