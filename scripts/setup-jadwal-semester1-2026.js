/**
 * scripts/setup-jadwal-semester1-2026.js
 *
 * Menerapkan jadwal & dosen pengampu semester 1 (Ganjil TA 2026/2027) sesuai
 * dokumen "Jadwal Perkuliahan Semester 1 - Kelas A & Kelas B" ke collection
 * `mataKuliah`, DENGAN memisahkan mata kuliah yang jadwalnya beda antara
 * Kelas A dan Kelas B (supaya ELK-Learning tidak lagi menyamaratakan semua
 * kelas - lihat perbaikan di helpers/paketKurikulumHelper.js sebelumnya).
 *
 * KLASIFIKASI DARI DOKUMEN JADWAL:
 * - GABUNGAN (kelas A & B digabung jadi SATU kelas fisik, dosen & jam SAMA
 *   PERSIS) -> TETAP satu dokumen (kelas: null), cuma di-update jadwal &
 *   dosennya:
 *     - WUD3208 Bahasa Indonesia
 *     - PD3201  Etika Kerja
 *     - WUD2201-5 Pendidikan Agama (ke-5 versi agama)
 * - DIPISAH PER KELAS (dosen sama/beda, tapi HARI/JAM/RUANG beda antara
 *   Kelas A vs Kelas B - berarti pertemuan fisiknya beda, harus dipisah
 *   biar materi/presensi/progress tidak tertukar):
 *     - WUD3209 Bahasa Inggris
 *     - PD3202  Standardisasi
 *     - PD3203  Matematika Teknik
 *     - PD3204  Perangkat Lunak Aplikasi
 *
 * ⚠️ PENTING: dokumen jadwal yang diberikan HANYA mencakup Kelas A dan
 * Kelas B - TIDAK ADA jadwal untuk kelas ELK1ON (Fajar Hariyanto & Fachri
 * Huzain Ilyas). Script ini TIDAK membuat apa pun untuk ELK1ON - kedua
 * mahasiswa itu untuk sementara TIDAK akan bisa ter-enroll ke 4 MK yang
 * "dipisah per kelas" di atas (sistem akan menahan & melaporkan "kelas
 * tidak cocok", BUKAN salah taruh ke kelas A/B) sampai ada kejelasan
 * jadwal mereka. Beri tahu saya nanti mereka mau ikut jadwal A, jadwal B,
 * atau dibuatkan jadwal ELK1ON sendiri.
 *
 * IDENTITAS DOSEN: 3 dosen berikut BELUM punya NIDN/NUPTK di dokumen
 * jadwal ini (Ehlisa, Esron, Izza Fadhlinah Dirham) - akun tetap dibuat
 * supaya bisa login, tapi field nip/nidn dikosongkan dulu. Admin perlu
 * melengkapinya nanti lewat /admin/dosen.
 *
 * AMAN DIJALANKAN BERULANG: dosen yang sudah ada tidak dibuat dobel (pakai
 * pencocokan nama yang dinormalisasi). Mata kuliah yang sudah official-nya
 * dipisah tidak dibuat dobel juga - kalau dokumen (kode+kelas) sudah ada,
 * cuma di-update dosen/jadwalnya.
 *
 * MIGRASI OTOMATIS: kalau kode MK yang seharusnya dipisah TERNYATA masih
 * berupa SATU dokumen gabungan lama (kelas: null, dibuat oleh
 * sync-matakuliah-dari-rps.js sebelum perbaikan ini), dokumen lama itu
 * akan "diubah" jadi versi ELK1A (id-nya tidak berubah), lalu dibuatkan
 * dokumen BARU untuk ELK1B. Semua mahasiswa yang SUDAH ter-enroll ke
 * dokumen lama itu tapi kelasnya ELK1B akan otomatis DIPINDAHKAN
 * (`enrollment.mkId` diarahkan ulang) ke dokumen ELK1B yang baru.
 *
 * Cara pakai:
 *   node scripts/setup-jadwal-semester1-2026.js
 */

const { db, auth } = require('../config/firebaseAdmin');
const academicHelper = require('../helpers/academicHelper');

const PASSWORD_DOSEN_BARU = 'dosenelektronika';

// ============================================================================
// DATA DOSEN (yang belum ada identitasnya di dokumen jadwal dibiarkan null)
// ============================================================================
const DAFTAR_DOSEN = [
  { nama: 'Ariani Amri, S.Pd., M.Pd', identitas: '0918029701' },
  { nama: 'Fajar Ramadhan, S.Pd., M.T', identitas: '8559777678130153' },
  { nama: 'Gunawan Tari, S.T., M.T', identitas: '0908058803' },
  { nama: 'Suardi, S.Pd., M.Pd', identitas: '0905068702' },
  { nama: 'Rahman Syam, S.Pd., M.Si', identitas: '0921129104' },
  { nama: 'Ehlisa, S.Ak., M.Pd.', identitas: null },
  { nama: 'Esron', identitas: null },
  { nama: 'Izza Fadhlinah Dirham', identitas: null },
];

// ============================================================================
// MK GABUNGAN (kelas: null) - cuma update dosen + jadwal, TIDAK dipisah
// ============================================================================
const MK_GABUNGAN = [
  { kode: 'WUD3208', dosen: ['Ehlisa, S.Ak., M.Pd.'], jadwal: 'Senin 09.30-10.30, K102 (Gabungan Kelas A & B)' },
  { kode: 'PD3201', dosen: ['Izza Fadhlinah Dirham'], jadwal: 'Kamis 11.30-12.30, K103 (Gabungan Kelas A & B)' },
  { kode: 'WUD2201', dosen: ['Esron'], jadwal: 'Rabu 11.30-12.30, K202 (Gabungan Kelas A & B)' },
  { kode: 'WUD2202', dosen: ['Esron'], jadwal: 'Rabu 11.30-12.30, K202 (Gabungan Kelas A & B)' },
  { kode: 'WUD2203', dosen: ['Esron'], jadwal: 'Rabu 11.30-12.30, K202 (Gabungan Kelas A & B)' },
  { kode: 'WUD2204', dosen: ['Esron'], jadwal: 'Rabu 11.30-12.30, K202 (Gabungan Kelas A & B)' },
  { kode: 'WUD2205', dosen: ['Esron'], jadwal: 'Rabu 11.30-12.30, K202 (Gabungan Kelas A & B)' },
];

// ============================================================================
// MK DIPISAH PER KELAS - masing-masing kode akan punya 2 dokumen
// (kelas: 'ELK1A' dan kelas: 'ELK1B')
// ============================================================================
const MK_DIPISAH = [
  {
    kode: 'WUD3209',
    dosen: ['Suardi, S.Pd., M.Pd'],
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Sabtu 08.30-09.30, K303' },
      { kelas: 'ELK1B', jadwal: 'Sabtu 09.30-10.30, K303' },
    ]
  },
  {
    kode: 'PD3202',
    dosen: ['Ariani Amri, S.Pd., M.Pd', 'Fajar Ramadhan, S.Pd., M.T'],
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Rabu 09.30-10.30, K103' },
      { kelas: 'ELK1B', jadwal: 'Senin 14.30-15.30, K202' },
    ]
  },
  {
    kode: 'PD3203',
    dosen: ['Rahman Syam, S.Pd., M.Si'],
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Sabtu 14.30-15.30, K201' },
      { kelas: 'ELK1B', jadwal: 'Sabtu 15.30-16.30, K201' },
    ]
  },
  {
    kode: 'PD3204',
    dosen: ['Ariani Amri, S.Pd., M.Pd', 'Gunawan Tari, S.T., M.T'],
    kelasList: [
      { kelas: 'ELK1A', jadwal: 'Kamis 16.30-17.30, LAB 2' },
      { kelas: 'ELK1B', jadwal: 'Rabu 09.30-10.30, LAB 1' },
    ]
  },
];

// ============================================================================
// FUNGSI BANTU DOSEN (pola sama seperti scripts/assign-dosen-pa-*.js)
// ============================================================================

function normalisasiNama(nama) {
  return (nama || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}

function buatEmailDosen(namaLengkap) {
  const namaSaja = namaLengkap.split(',')[0];
  const bersih = namaSaja.replace(/[^a-zA-Z\s]/g, '').trim();
  const slug = bersih.toLowerCase().replace(/\s+/g, '.');
  return `${slug}@elektronika.com`;
}

async function pastikanDosenAda(dosenInfo, semuaDosenSnapshot) {
  const targetNormal = normalisasiNama(dosenInfo.nama);
  const cocok = semuaDosenSnapshot.docs.find(doc => normalisasiNama(doc.data().nama) === targetNormal);

  if (cocok) {
    const data = cocok.data();
    return { id: cocok.id, nama: data.nama, dibuatBaru: false };
  }

  const email = buatEmailDosen(dosenInfo.nama);
  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password: PASSWORD_DOSEN_BARU, displayName: dosenInfo.nama });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  await db.collection('dosen').doc(userRecord.uid).set({
    nama: dosenInfo.nama,
    email,
    nip: dosenInfo.identitas,
    nidn: dosenInfo.identitas,
    role: 'dosen',
    userId: userRecord.uid,
    createdAt: new Date().toISOString(),
  });

  return { id: userRecord.uid, nama: dosenInfo.nama, dibuatBaru: true };
}

// ============================================================================
// FUNGSI BANTU MATA KULIAH
// ============================================================================

function buatMateriKosong() {
  return Array.from({ length: 16 }, (_, i) => ({ pertemuan: i + 1, topik: '' }));
}

async function setPengampuAktif(mkId, dosenIds) {
  const activePeriodeId = academicHelper.getActivePeriodeId();
  const info = academicHelper.generatePeriodeOptions(50, 5).find(p => p.id === activePeriodeId);
  await db.collection('mataKuliah').doc(mkId).collection('pengampuPeriode').doc(activePeriodeId).set({
    periodeId: activePeriodeId,
    label: info ? info.label : activePeriodeId,
    semester: info ? info.semester : null,
    tahunAwal: info ? info.tahunAwal : null,
    tahunAkhir: info ? info.tahunAkhir : null,
    urutan: info ? info.urutan : 0,
    dosenIds,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  await db.collection('mataKuliah').doc(mkId).update({
    dosenIds,
    periodeAktifId: activePeriodeId,
    periodeAktifLabel: info ? info.label : activePeriodeId
  });
}

// ============================================================================
// PROSES UTAMA
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('SETUP JADWAL & DOSEN SEMESTER 1 (GANJIL TA 2026/2027)');
  console.log('='.repeat(70));

  // --- 1. Pastikan semua dosen ada ---
  console.log('\n--- Memproses Dosen ---');
  let semuaDosenSnapshot = await db.collection('dosen').get();
  const dosenMap = {};
  for (const d of DAFTAR_DOSEN) {
    const hasil = await pastikanDosenAda(d, semuaDosenSnapshot);
    dosenMap[d.nama] = hasil;
    if (hasil.dibuatBaru) {
      console.log(`   ✅ Dibuat akun baru: ${hasil.nama} (${buatEmailDosen(hasil.nama)})${d.identitas ? '' : ' - ⚠️ NIDN/NUPTK belum diisi, lengkapi manual lewat /admin/dosen'}`);
      // refresh snapshot supaya dosen yang baru dibuat langsung kebaca kalau namanya dipakai lagi di baris lain
      semuaDosenSnapshot = await db.collection('dosen').get();
    } else {
      console.log(`   ✓  Sudah ada: ${hasil.nama}`);
    }
  }

  function idDosen(namaList) {
    return namaList.map(n => {
      const d = dosenMap[n];
      if (!d) throw new Error(`Dosen "${n}" tidak ditemukan di DAFTAR_DOSEN - cek penulisan nama.`);
      return d.id;
    });
  }

  // --- 2. MK Gabungan: update dosen + jadwal, kelas tetap null ---
  console.log('\n--- Memproses Mata Kuliah GABUNGAN (tidak dipisah per kelas) ---');
  for (const mk of MK_GABUNGAN) {
    const snap = await db.collection('mataKuliah').where('kode', '==', mk.kode).get();
    const dosenIds = idDosen(mk.dosen);

    if (snap.empty) {
      const docRef = await db.collection('mataKuliah').add({
        kode: mk.kode,
        nama: null, // biarkan kosong kalau memang belum pernah disync - seharusnya sudah ada dari sync-matakuliah-dari-rps.js
        kelas: null,
        jadwal: mk.jadwal,
        dosenIds,
        materi: buatMateriKosong(),
        createdAt: new Date().toISOString(),
      });
      await setPengampuAktif(docRef.id, dosenIds);
      console.log(`   ✅ Dibuat baru (belum pernah disync sebelumnya): ${mk.kode}`);
    } else {
      // Kalau ada lebih dari 1 (mestinya tidak, tapi jaga-jaga), pakai yang kelas-nya null/kosong
      const doc = snap.docs.find(d => !d.data().kelas) || snap.docs[0];
      await doc.ref.update({ jadwal: mk.jadwal, updatedAt: new Date().toISOString() });
      await setPengampuAktif(doc.id, dosenIds);
      console.log(`   ✓  Diperbarui: ${mk.kode} - ${doc.data().nama || '(tanpa nama)'} -> jadwal: ${mk.jadwal}`);
    }
  }

  // --- 3. MK Dipisah per kelas ---
  console.log('\n--- Memproses Mata Kuliah YANG DIPISAH PER KELAS ---');
  for (const mk of MK_DIPISAH) {
    const dosenIds = idDosen(mk.dosen);
    const snap = await db.collection('mataKuliah').where('kode', '==', mk.kode).get();

    const dokumenGabunganLama = snap.docs.find(d => !d.data().kelas);
    const dokumenPerKelas = {};
    snap.docs.forEach(d => { if (d.data().kelas) dokumenPerKelas[d.data().kelas] = d; });

    for (let i = 0; i < mk.kelasList.length; i++) {
      const target = mk.kelasList[i];

      if (dokumenPerKelas[target.kelas]) {
        // Sudah ada dokumen resmi untuk kelas ini -> update saja
        const doc = dokumenPerKelas[target.kelas];
        await doc.ref.update({ jadwal: target.jadwal, updatedAt: new Date().toISOString() });
        await setPengampuAktif(doc.id, dosenIds);
        console.log(`   ✓  Diperbarui: ${mk.kode} [${target.kelas}] -> jadwal: ${target.jadwal}`);
      } else if (i === 0 && dokumenGabunganLama) {
        // Dokumen gabungan lama ditemukan -> "ubah" jadi versi kelas pertama (ELK1A),
        // supaya id-nya tetap sama (materi/nilai/dll yang sudah ada tidak hilang)
        await dokumenGabunganLama.ref.update({
          kelas: target.kelas,
          jadwal: target.jadwal,
          updatedAt: new Date().toISOString()
        });
        await setPengampuAktif(dokumenGabunganLama.id, dosenIds);
        console.log(`   🔄 Dokumen gabungan lama ${mk.kode} diubah jadi kelas ${target.kelas} (id tetap sama: ${dokumenGabunganLama.id})`);

        // Migrasi: mahasiswa yang sudah ter-enroll ke dokumen ini tapi
        // kelasnya BUKAN target.kelas harus dipindah ke dokumen kelas lain
        // setelah dokumen itu dibuat (dilakukan di iterasi kelas berikutnya,
        // jadi migrasi untuk mereka ditangani di bawah setelah dokumen baru
        // ada). Tandai di sini supaya diproses setelah loop kelasList selesai.
        dokumenPerKelas[target.kelas] = { id: dokumenGabunganLama.id, ref: dokumenGabunganLama.ref };
      } else {
        // Belum ada dokumen untuk kelas ini -> buat baru
        const docRef = await db.collection('mataKuliah').add({
          kode: mk.kode,
          nama: dokumenGabunganLama ? dokumenGabunganLama.data().nama : null,
          kelas: target.kelas,
          jadwal: target.jadwal,
          dosenIds,
          materi: buatMateriKosong(),
          createdAt: new Date().toISOString(),
        });
        await setPengampuAktif(docRef.id, dosenIds);
        console.log(`   ✅ Dibuat baru: ${mk.kode} [${target.kelas}] (id: ${docRef.id})`);
        dokumenPerKelas[target.kelas] = { id: docRef.id, ref: docRef };
      }
    }

    // --- Migrasi enrollment: kalau ada mahasiswa yang ter-enroll ke dokumen
    // yang TADINYA gabungan (sekarang jadi kelas pertama) tapi kelas
    // mahasiswanya BEDA, pindahkan ke dokumen kelas yang benar.
    if (dokumenGabunganLama) {
      const idLama = dokumenGabunganLama.id;
      const enrollmentSnap = await db.collection('enrollment').where('mkId', '==', idLama).get();
      let dipindah = 0;
      for (const enr of enrollmentSnap.docs) {
        const mhsSnap = await db.collection('users').doc(enr.data().userId).get();
        const kelasMhs = mhsSnap.exists ? (mhsSnap.data().kelas || null) : null;
        const kelasSeharusnya = mk.kelasList[0].kelas; // dokumen lama sekarang = kelas pertama
        if (kelasMhs && kelasMhs !== kelasSeharusnya && dokumenPerKelas[kelasMhs]) {
          await enr.ref.update({ mkId: dokumenPerKelas[kelasMhs].id, updatedAt: new Date().toISOString() });
          dipindah++;
        }
      }
      if (dipindah > 0) {
        console.log(`   📦 ${dipindah} mahasiswa dipindahkan ke dokumen kelas yang sesuai untuk ${mk.kode}.`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SELESAI');
  console.log('='.repeat(70));
  console.log('⚠️  INGAT: kelas ELK1ON (Fajar Hariyanto & Fachri Huzain Ilyas) BELUM');
  console.log('   punya jadwal di dokumen ini - mereka untuk sementara tidak akan');
  console.log('   ter-enroll ke WUD3209/PD3202/PD3203/PD3204 sampai ada kejelasan');
  console.log('   jadwal untuk kelas mereka.');
  console.log('⚠️  3 dosen baru (Ehlisa, Esron, Izza Fadhlinah Dirham) belum ada');
  console.log('   NIDN/NUPTK-nya - lengkapi manual lewat /admin/dosen.');
  console.log('\nLangkah selanjutnya: jalankan ulang node scripts/aktifkan-krs-angkatan2026.js');
  console.log('supaya mahasiswa yang belum ter-KRS masuk ke MK dengan jadwal yang benar.');

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
