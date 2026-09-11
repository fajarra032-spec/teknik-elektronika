/**
 * scripts/buat-kelas-elk1b-4mk.js
 *
 * Membuat 4 dokumen `mataKuliah` untuk Kelas B (ELK1B) yang selama ini
 * belum pernah dibuat, berdasarkan Jadwal Perkuliahan Semester 1 Ganjil
 * 2026/2027 (jadwal resmi menunjukkan 4 MK ini dijadwalkan terpisah per
 * kelas - hari/jam/ruang beda - walau dosennya sama untuk kedua kelas):
 *
 *   - WUD3209 Bahasa Inggris            (dosen: Suardi, S.Pd., M.Pd)
 *   - PD3204  Perangkat Lunak Aplikasi  (dosen: Ariani Amri, Gunawan Tari)
 *   - PD3203  Matematika Teknik         (dosen: Rahman Syam, S.Pd., M.Si)
 *   - PD3202  Standardisasi             (dosen: Ariani Amri, Fajar Ramadhan)
 *
 * Untuk tiap MK: dokumen baru dibuat dengan kode/nama/sks/semester SAMA
 * seperti dokumen Kelas A-nya (jadi kode MK-nya sengaja SAMA, cuma id
 * dokumen & field `kelas` yang beda - `mataKuliah` di sistem ini memang
 * sudah didesain bisa punya >1 dokumen per kode, lihat 7 MK lain yang
 * juga begitu), dan dosenIds DISALIN dari dokumen Kelas A (sesuai jadwal:
 * dosennya sama untuk kedua kelas).
 *
 * ROSTER KELAS B DITENTUKAN OTOMATIS (bukan ditebak manual), dengan cara:
 *   1. Ambil semua mahasiswa angkatan 2026 (NIM diawali '26') yang
 *      role='mahasiswa'.
 *   2. Ambil semua mahasiswa yang SUDAH terdaftar aktif periode ini di
 *      SALAH SATU dari 4 dokumen Kelas A ini -> itu = roster Kelas A.
 *   3. Kelas B = (semua angkatan 2026) MINUS (roster Kelas A).
 * Rosternya DITAMPILKAN DULU di dry-run untuk dicek manual sebelum
 * --confirm - JANGAN langsung --confirm tanpa baca daftar Kelas B di
 * bawah, pastikan memang benar itu anak-anak Kelas B.
 *
 * DEFAULT DRY-RUN. Perlu flag --confirm untuk benar-benar membuat
 * dokumen MK baru & enrollment.
 *
 * Cara pakai:
 *   node scripts/buat-kelas-elk1b-4mk.js            (dry-run, cek roster dulu)
 *   node scripts/buat-kelas-elk1b-4mk.js --confirm  (buat beneran)
 */

const { db } = require('../config/firebaseAdmin');
const { getPeriodeAktif } = require('../helpers/nilaiHelper');

const KONFIRMASI = process.argv.includes('--confirm');
const PERIODE_AKTIF = getPeriodeAktif();
const PREFIX_ANGKATAN = '26';

const KODE_MK_TARGET = ['WUD3209', 'PD3204', 'PD3203', 'PD3202'];

async function ambilMahasiswaAngkatan(prefix) {
  const snapshot = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(u => (u.nim || '').startsWith(prefix));
}

async function main() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MEMBUAT MK BARU & ENROLLMENT' : '🟡 DRY-RUN - cuma simulasi'}`);
  console.log(`Periode aktif: "${PERIODE_AKTIF}"\n`);

  // 1) Ambil dokumen Kelas A untuk 4 kode target, dan enrollment aktifnya.
  const kelasADocs = {};
  const rosterKelasAId = new Set();

  for (const kode of KODE_MK_TARGET) {
    const mkSnapshot = await db.collection('mataKuliah')
      .where('kode', '==', kode)
      .where('kelas', '==', 'ELK1A')
      .limit(1)
      .get();

    if (mkSnapshot.empty) {
      console.log(`❌ Tidak ketemu dokumen Kelas A untuk kode ${kode}. Dilewati.`);
      continue;
    }

    const mkDoc = mkSnapshot.docs[0];
    kelasADocs[kode] = { id: mkDoc.id, ...mkDoc.data() };
    console.log(`✅ [${kode}] ${mkDoc.data().nama} - Kelas A id: ${mkDoc.id}, dosenIds: ${JSON.stringify(mkDoc.data().dosenIds || [])}`);

    const enrollSnapshot = await db.collection('enrollment')
      .where('mkId', '==', mkDoc.id)
      .where('semester', '==', PERIODE_AKTIF)
      .where('status', '==', 'active')
      .get();
    enrollSnapshot.docs.forEach(d => rosterKelasAId.add(d.data().userId));
  }

  console.log(`\nTotal mahasiswa terdeteksi sebagai Kelas A (gabungan dari 4 MK di atas): ${rosterKelasAId.size}`);

  // 2) Ambil semua mahasiswa angkatan 2026, lalu Kelas B = semua - Kelas A.
  const semuaAngkatan26 = await ambilMahasiswaAngkatan(PREFIX_ANGKATAN);
  const rosterKelasB = semuaAngkatan26.filter(u => !rosterKelasAId.has(u.id));
  const rosterKelasAList = semuaAngkatan26.filter(u => rosterKelasAId.has(u.id));

  console.log(`Total mahasiswa angkatan 20${PREFIX_ANGKATAN}         : ${semuaAngkatan26.length}`);
  console.log(`-> Terdeteksi Kelas A (punya enrollment) : ${rosterKelasAList.length}`);
  console.log(`-> Terdeteksi Kelas B (SISANYA, dugaan)   : ${rosterKelasB.length}`);

  console.log('\nDaftar dugaan KELAS A (untuk verifikasi):');
  rosterKelasAList.sort((a, b) => (a.nim || '').localeCompare(b.nim || ''))
    .forEach(u => console.log(`   ${u.nim}  ${u.nama}`));

  console.log('\nDaftar dugaan KELAS B (yang akan di-enroll ke 4 MK baru):');
  rosterKelasB.sort((a, b) => (a.nim || '').localeCompare(b.nim || ''))
    .forEach(u => console.log(`   ${u.nim}  ${u.nama}`));

  if (rosterKelasB.length === 0) {
    console.log('\n⚠️  Tidak ada mahasiswa yang terdeteksi sebagai Kelas B. Berhenti, tidak ada yang dikerjakan.');
    process.exit(1);
  }

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru DRY-RUN. PERIKSA BAIK-BAIK daftar Kelas A & Kelas B di atas -');
    console.log('   pastikan memang benar pembagiannya seperti itu (cocokkan dengan absensi/KRS asli).');
    console.log('   Kalau sudah yakin benar, jalankan ulang dengan --confirm:');
    console.log('   node scripts/buat-kelas-elk1b-4mk.js --confirm');
    process.exit(0);
  }

  // 3) --confirm: buat dokumen MK baru untuk tiap kode, lalu enroll Kelas B.
  console.log('\n--- MEMBUAT DOKUMEN MK KELAS B ---');
  for (const kode of KODE_MK_TARGET) {
    const kelasA = kelasADocs[kode];
    if (!kelasA) continue;

    const dataBaru = {
      kode: kelasA.kode,
      nama: kelasA.nama,
      semester: kelasA.semester,
      sks: kelasA.sks,
      dosenIds: kelasA.dosenIds || [],
      kelas: 'ELK1B',
      materi: [],
      createdAt: new Date().toISOString(),
      catatan: 'Dibuat otomatis oleh scripts/buat-kelas-elk1b-4mk.js untuk melengkapi Kelas B yang belum ada dokumennya, disalin dari dokumen Kelas A (dosen sama, sesuai jadwal resmi Semester 1 Ganjil 2026/2027).'
    };

    const ref = await db.collection('mataKuliah').add(dataBaru);
    console.log(`✅ [${kode}] dokumen Kelas B dibuat, id: ${ref.id}`);

    let jumlahEnroll = 0;
    for (const mhs of rosterKelasB) {
      await db.collection('enrollment').add({
        userId: mhs.id,
        mkId: ref.id,
        semester: PERIODE_AKTIF,
        status: 'active',
        createdAt: new Date().toISOString(),
        approvedBy: null,
        krsId: null,
        catatan: 'Dibuat otomatis oleh scripts/buat-kelas-elk1b-4mk.js melengkapi enrollment Kelas B yang sebelumnya tidak bisa KRS karena dokumen MK Kelas B belum ada.'
      });
      jumlahEnroll++;
    }
    console.log(`   -> ${jumlahEnroll} mahasiswa Kelas B di-enroll ke MK ini.`);
  }

  console.log('\n=== SELESAI ===');
  console.log('4 dokumen MK Kelas B sudah dibuat & mahasiswa Kelas B sudah di-enroll.');
  console.log('Silakan cek halaman dosen terkait untuk memastikan Kelas B sekarang muncul.');
  process.exit(0);
}

main().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
