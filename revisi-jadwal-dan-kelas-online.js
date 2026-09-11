/**
 * scripts/revisi-jadwal-dan-kelas-online.js
 *
 * Eksekusi revisi jadwal perkuliahan Semester 1 Ganjil 2026/2027
 * berdasarkan jadwal resmi terbaru (Kelas ELK1A, ELK1B, ELK1ON). Mengurus
 * 5 hal sekaligus, urut (tiap tahap independen, tidak saling menjegal):
 *
 * TAHAP 1 - Perbaiki nama dosen "Esron" -> "Erson, S.Pd., M.Pd."
 *   (orang yang sama, cuma salah ketik - dikonfirmasi admin). Id dosen
 *   TIDAK berubah, jadi semua MK yang sudah menunjuk ke id ini otomatis
 *   ikut benar tanpa perlu disentuh.
 *
 * TAHAP 2 - Buat 6 akun dosen baru (kalau belum ada, dicek dulu by nama
 *   supaya tidak dobel kalau script dijalankan ulang):
 *     - Farhan Yustisio            (Etika Kerja, kelas tatap muka)
 *     - Nur Afifah Rustan, S.Pd., M.Pd.       (Bahasa Inggris ELK1ON)
 *     - Sarifuddin Ihsan Al Alim, S.Pd., M.Pd. (Bahasa Indonesia ELK1ON)
 *     - Drs. Salahuddin Abadi AS, M.Si        (Etika Kerja ELK1ON)
 *     - Ir. Irhamni Nuhardin, S.T., M.T., IPP. (Standardisasi ELK1ON)
 *     - Ramlan, S.Kom., M.Si.                 (Perangkat Lunak Aplikasi ELK1ON)
 *   CATATAN: NIP belum ada sumbernya dari jadwal PDF, diisi placeholder
 *   "BELUM_ADA_NIP" - WAJIB dilengkapi manual lewat halaman admin nanti.
 *
 * TAHAP 3 - Alihkan dosenIds MK kelas tatap muka (yang sudah ada
 *   dokumennya, TIDAK membuat dokumen baru - sesuai arahan admin):
 *     - PD3201 Etika Kerja (gabungan A&B)      -> Farhan Yustisio
 *     - WUD2202 Pend. Agama Kristen             -> Gunawan Tari
 *     - WUD2203 Pend. Agama Katolik             -> Gunawan Tari
 *     - WUD2204 Pend. Agama Hindu               -> Gunawan Tari
 *     - WUD2205 Pend. Agama Budha               -> Gunawan Tari
 *   (dosenIds diganti total/replace, bukan ditambahkan, sesuai jadwal
 *   yang cuma menyebut 1 dosen pengampu untuk masing-masing baris ini)
 *
 * TAHAP 4 - Buat dokumen mataKuliah utk Kelas Online (kelas: 'ELK1ON'),
 *   HANYA untuk mata kuliah yang benar-benar dibutuhkan 2 mahasiswa
 *   ELK1ON yang terdeteksi (lihat TAHAP 5) - keduanya sudah diketahui
 *   beragama Islam (dari data enrollment WUD2201 sebelumnya), jadi 4 MK
 *   agama non-Islam TIDAK dibuatkan versi ELK1ON (belum ada yang butuh -
 *   sesuai prinsip "baru muncul kalau ada yang KRS" dari admin):
 *     - PD3203  Matematika Teknik            (dosen: - / kosong, sesuai jadwal)
 *     - WUD3209 Bahasa Inggris               (dosen: Nur Afifah Rustan)
 *     - WUD3208 Bahasa Indonesia             (dosen: Sarifuddin Ihsan Al Alim)
 *     - WUD2201 Pendidikan Agama Islam       (dosen: Erson)
 *     - PD3201  Etika Kerja                  (dosen: Salahuddin Abadi AS)
 *     - PD3202  Standardisasi                (dosen: Irhamni Nuhardin)
 *     - PD3204  Perangkat Lunak Aplikasi     (dosen: Ramlan)
 *   kode & sks disalin dari dokumen kelas tatap muka yang sudah ada
 *   (supaya konsisten dengan kurikulum resmi), cuma kelas & dosenIds
 *   yang beda.
 *
 * TAHAP 5 - Pindahkan mahasiswa kelas ELK1ON (dibaca dari field
 *   `kelas` di dokumen user, BUKAN ditebak - sesuai arahan admin) dari
 *   enrollment lama mereka (di MK tatap muka/ELK1A) ke 7 MK ELK1ON yang
 *   baru dibuat di TAHAP 4. Untuk tiap mahasiswa & tiap kode di atas:
 *   enrollment lama di MK tatap muka (kode yang sama) DIHAPUS, enrollment
 *   baru ke MK ELK1ON dibuat - supaya tidak dobel kelas untuk mapel yang
 *   sama.
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar menulis.
 *
 * Cara pakai:
 *   node scripts/revisi-jadwal-dan-kelas-online.js
 *   node scripts/revisi-jadwal-dan-kelas-online.js --confirm
 */

const { db } = require('../config/firebaseAdmin');
const { getPeriodeAktif } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const PERIODE_AKTIF = getPeriodeAktif();
const SEMESTER_MK = 1;

const DOSEN_BARU = [
  { nip: 'BELUM_ADA_NIP', nama: 'Farhan Yustisio', email: 'farhan.yustisio@elektronika.com' },
  { nip: 'BELUM_ADA_NIP', nama: 'Nur Afifah Rustan, S.Pd., M.Pd.', email: 'nur.afifah.rustan@elektronika.com' },
  { nip: 'BELUM_ADA_NIP', nama: 'Sarifuddin Ihsan Al Alim, S.Pd., M.Pd.', email: 'sarifuddin.ihsan@elektronika.com' },
  { nip: 'BELUM_ADA_NIP', nama: 'Drs. Salahuddin Abadi AS, M.Si', email: 'salahuddin.abadi@elektronika.com' },
  { nip: 'BELUM_ADA_NIP', nama: 'Ir. Irhamni Nuhardin, S.T., M.T., IPP.', email: 'irhamni.nuhardin@elektronika.com' },
  { nip: 'BELUM_ADA_NIP', nama: 'Ramlan, S.Kom., M.Si.', email: 'ramlan@elektronika.com' }
];

// kode MK yg dosennya dialihkan di TAHAP 3 (tatap muka, dokumen sudah ada)
const ALIH_DOSEN_TATAP_MUKA = [
  { kode: 'PD3201', kelasTarget: null, namaDosenBaru: 'Farhan Yustisio' }, // null = dokumen gabungan (field kelas kosong)
  { kode: 'WUD2202', kelasTarget: null, namaDosenBaru: 'Gunawan Tari, S.T., M.T' },
  { kode: 'WUD2203', kelasTarget: null, namaDosenBaru: 'Gunawan Tari, S.T., M.T' },
  { kode: 'WUD2204', kelasTarget: null, namaDosenBaru: 'Gunawan Tari, S.T., M.T' },
  { kode: 'WUD2205', kelasTarget: null, namaDosenBaru: 'Gunawan Tari, S.T., M.T' }
];

// 7 MK utk Kelas Online (TAHAP 4 & 5)
const MK_ONLINE = [
  { kode: 'PD3203', namaDosen: null },
  { kode: 'WUD3209', namaDosen: 'Nur Afifah Rustan, S.Pd., M.Pd.' },
  { kode: 'WUD3208', namaDosen: 'Sarifuddin Ihsan Al Alim, S.Pd., M.Pd.' },
  { kode: 'WUD2201', namaDosen: 'Erson, S.Pd., M.Pd.' },
  { kode: 'PD3201', namaDosen: 'Drs. Salahuddin Abadi AS, M.Si' },
  { kode: 'PD3202', namaDosen: 'Ir. Irhamni Nuhardin, S.T., M.T., IPP.' },
  { kode: 'PD3204', namaDosen: 'Ramlan, S.Kom., M.Si.' }
];

async function cariDosenByNama(nama) {
  const snapshot = await db.collection('dosen').get();
  const found = snapshot.docs.find(d => (d.data().nama || '').trim() === nama.trim());
  return found ? { id: found.id, ...found.data() } : null;
}

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS' : '🟡 DRY-RUN - cuma simulasi'}`);
  console.log(`Periode aktif: "${PERIODE_AKTIF}"\n`);

  // ===== TAHAP 1: perbaiki nama Esron =====
  console.log('=== TAHAP 1: Perbaiki nama "Esron" -> "Erson, S.Pd., M.Pd." ===');
  const esron = await cariDosenByNama('Esron');
  if (!esron) {
    console.log('   ❌ Dosen "Esron" tidak ketemu (mungkin sudah diperbaiki sebelumnya). Dilewati.');
  } else {
    console.log(`   ✅ Ketemu id ${esron.id}, akan diubah namanya jadi "Erson, S.Pd., M.Pd."`);
    if (KONFIRMASI) {
      await db.collection('dosen').doc(esron.id).update({ nama: 'Erson, S.Pd., M.Pd.' });
      console.log('   🖊️  Nama sudah diperbarui.');
    }
  }

  // ===== TAHAP 2: buat dosen baru kalau belum ada =====
  console.log('\n=== TAHAP 2: Buat dosen baru (kalau belum ada) ===');
  const dosenIdMap = {}; // nama -> id (termasuk yg sudah ada sebelumnya)
  for (const d of DOSEN_BARU) {
    const existing = await cariDosenByNama(d.nama);
    if (existing) {
      console.log(`   ⏭️  "${d.nama}" sudah ada (id: ${existing.id}), dilewati.`);
      dosenIdMap[d.nama] = existing.id;
      continue;
    }
    console.log(`   ➕ "${d.nama}" akan dibuat baru (email: ${d.email}, NIP: ${d.nip} - PERLU DILENGKAPI MANUAL).`);
    if (KONFIRMASI) {
      const ref = await db.collection('dosen').add({
        nip: d.nip,
        nama: d.nama,
        kontak: null,
        email: d.email,
        foto: null,
        fotoFileId: null,
        mataKuliahIds: [],
        createdAt: new Date().toISOString()
      });
      dosenIdMap[d.nama] = ref.id;
      console.log(`      dibuat dengan id: ${ref.id}`);
    }
  }
  // Dosen yang sudah ada sebelumnya (Erson/Esron, Gunawan Tari) - pastikan ada di map juga.
  const erson = await cariDosenByNama('Erson') || await cariDosenByNama('Esron');
  if (erson) dosenIdMap['Erson, S.Pd., M.Pd.'] = erson.id;
  const gunawan = await cariDosenByNama('Gunawan Tari, S.T., M.T');
  if (gunawan) dosenIdMap['Gunawan Tari, S.T., M.T'] = gunawan.id;

  // ===== TAHAP 3: alihkan dosen MK tatap muka =====
  console.log('\n=== TAHAP 3: Alihkan dosenIds MK tatap muka (dokumen SUDAH ADA, tidak dibuat baru) ===');
  for (const item of ALIH_DOSEN_TATAP_MUKA) {
    const mkSnapshot = await db.collection('mataKuliah')
      .where('kode', '==', item.kode)
      .where('semester', '==', SEMESTER_MK)
      .get();
    const kandidat = mkSnapshot.docs.filter(d => (d.data().kelas || null) === item.kelasTarget);

    if (kandidat.length !== 1) {
      console.log(`   ❌ [${item.kode}] ditemukan ${kandidat.length} dokumen cocok (kelas: ${item.kelasTarget}) - dilewati, cek manual.`);
      continue;
    }

    const mkDoc = kandidat[0];
    const dosenIdBaru = dosenIdMap[item.namaDosenBaru];
    if (!dosenIdBaru) {
      console.log(`   ❌ [${item.kode}] dosen "${item.namaDosenBaru}" belum punya id (cek TAHAP 1/2) - dilewati.`);
      continue;
    }

    console.log(`   ✅ [${item.kode}] ${mkDoc.data().nama} - dosenIds lama: ${JSON.stringify(mkDoc.data().dosenIds || [])} -> baru: ["${dosenIdBaru}"] (${item.namaDosenBaru})`);
    if (KONFIRMASI) {
      await db.collection('mataKuliah').doc(mkDoc.id).update({ dosenIds: [dosenIdBaru] });
    }
  }

  // ===== TAHAP 4 & 5: Kelas Online =====
  console.log('\n=== TAHAP 4 & 5: Kelas Online (ELK1ON) ===');
  const mhsOnlineSnapshot = await db.collection('users').where('kelas', '==', 'ELK1ON').get();
  const mhsOnline = mhsOnlineSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`Mahasiswa ELK1ON terdeteksi: ${mhsOnline.length}`);
  mhsOnline.forEach(m => console.log(`   ${m.nim}  ${m.nama}`));

  if (mhsOnline.length === 0) {
    console.log('⚠️  Tidak ada mahasiswa ELK1ON, TAHAP 4 & 5 dilewati seluruhnya.');
  } else {
    for (const item of MK_ONLINE) {
      // Cari dokumen dasar (tatap muka) kode ini utk salin nama/sks.
      const dasarSnapshot = await db.collection('mataKuliah')
        .where('kode', '==', item.kode)
        .where('semester', '==', SEMESTER_MK)
        .limit(1)
        .get();
      if (dasarSnapshot.empty) {
        console.log(`\n   ❌ [${item.kode}] dokumen dasar (tatap muka) tidak ketemu - dilewati, tidak bisa salin nama/sks.`);
        continue;
      }
      const dasar = dasarSnapshot.docs[0].data();

      // Cek apakah dokumen ELK1ON utk kode ini sudah ada (idempotent).
      const sudahAdaSnapshot = await db.collection('mataKuliah')
        .where('kode', '==', item.kode)
        .where('kelas', '==', 'ELK1ON')
        .limit(1)
        .get();

      let mkOnlineId;
      let mkOnlineData;
      const dosenIdOnline = item.namaDosen ? dosenIdMap[item.namaDosen] : null;

      if (!sudahAdaSnapshot.empty) {
        mkOnlineId = sudahAdaSnapshot.docs[0].id;
        mkOnlineData = sudahAdaSnapshot.docs[0].data();
        console.log(`\n   ⏭️  [${item.kode}] dokumen ELK1ON sudah ada (id: ${mkOnlineId}), tidak dibuat ulang.`);
      } else {
        console.log(`\n   ➕ [${item.kode}] ${dasar.nama} - akan dibuat dokumen ELK1ON baru, dosen: ${item.namaDosen || '(kosong, sesuai jadwal)'}`);
        if (KONFIRMASI) {
          const ref = await db.collection('mataKuliah').add({
            kode: item.kode,
            nama: dasar.nama,
            semester: SEMESTER_MK,
            sks: dasar.sks,
            dosenIds: dosenIdOnline ? [dosenIdOnline] : [],
            kelas: 'ELK1ON',
            materi: [],
            createdAt: new Date().toISOString(),
            catatan: 'Dibuat otomatis oleh scripts/revisi-jadwal-dan-kelas-online.js untuk Kelas Online ELK1ON.'
          });
          mkOnlineId = ref.id;
          console.log(`      dibuat dengan id: ${ref.id}`);
        }
      }

      if (!mkOnlineId) continue; // dry-run, belum ada id asli

      // TAHAP 5: pindahkan enrollment tiap mahasiswa ELK1ON utk kode ini.
      for (const mhs of mhsOnline) {
        // cari enrollment lama (MK tatap muka kode sama) milik mhs ini
        const mkTatapMukaSnapshot = await db.collection('mataKuliah')
          .where('kode', '==', item.kode)
          .where('semester', '==', SEMESTER_MK)
          .get();
        const idTatapMuka = mkTatapMukaSnapshot.docs.map(d => d.id).filter(id => id !== mkOnlineId);

        for (const mkIdLama of idTatapMuka) {
          const enrollLamaSnapshot = await db.collection('enrollment')
            .where('mkId', '==', mkIdLama)
            .where('userId', '==', mhs.id)
            .where('semester', '==', PERIODE_AKTIF)
            .get();
          for (const eDoc of enrollLamaSnapshot.docs) {
            console.log(`      🗑️  Hapus enrollment lama ${mhs.nim} di mkId ${mkIdLama} (enrollment ${eDoc.id})`);
            if (KONFIRMASI) await db.collection('enrollment').doc(eDoc.id).delete();
          }
        }

        // cek sudah ada enrollment ELK1ON blm (idempotent)
        const sudahOnlineSnapshot = await db.collection('enrollment')
          .where('mkId', '==', mkOnlineId)
          .where('userId', '==', mhs.id)
          .where('semester', '==', PERIODE_AKTIF)
          .get();
        if (!sudahOnlineSnapshot.empty) {
          console.log(`      ⏭️  ${mhs.nim} sudah ter-enroll di ELK1ON MK ini, dilewati.`);
          continue;
        }

        console.log(`      ➕ Enroll ${mhs.nim} ${mhs.nama} ke ELK1ON mkId ${mkOnlineId}`);
        if (KONFIRMASI) {
          await db.collection('enrollment').add({
            userId: mhs.id,
            mkId: mkOnlineId,
            semester: PERIODE_AKTIF,
            status: 'active',
            createdAt: new Date().toISOString(),
            approvedBy: null,
            krsId: null,
            catatan: 'Dibuat otomatis oleh scripts/revisi-jadwal-dan-kelas-online.js - pindah dari kelas tatap muka ke Kelas Online ELK1ON.'
          });
        }
      }
    }
  }

  console.log('\n=== SELESAI ===');
  if (!KONFIRMASI) {
    console.log('👉 Ini baru DRY-RUN. Periksa daftar di atas, lalu jalankan ulang dengan --confirm:');
    console.log('   node scripts/revisi-jadwal-dan-kelas-online.js --confirm');
    console.log('\n⚠️  Setelah --confirm, JANGAN LUPA lengkapi NIP dosen baru lewat halaman admin');
    console.log('   (diisi placeholder "BELUM_ADA_NIP" sementara).');
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
