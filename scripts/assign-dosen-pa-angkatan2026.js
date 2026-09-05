/**
 * scripts/assign-dosen-pa-angkatan2026.js
 *
 * Membagi Dosen PA (Pembimbing Akademik) untuk 44 mahasiswa angkatan 2026
 * ke 6 dosen secara merata, dengan SATU pengecualian: Rhapid Wahidan
 * ditetapkan khusus ke Fajar Ramadhan (di luar pembagian rata).
 *
 * Dosen (3 di antaranya sudah ada di sistem dari SK 1814/EK sebelumnya,
 * 3 lainnya baru - script ini akan membuatkan akunnya kalau belum ada,
 * dengan pola yang sama seperti scripts/assign-dosen-pa-sk-1814-2025.js):
 *   - Ariani Amri, S.Pd., M.Pd   (NIDN 0918029701)      - sudah ada
 *   - Fajar Ramadhan, S.Pd., M.T (NUPTK 8559777678130153) - baru
 *   - Gunawan Tari, S.T., M.T    (NIDN 0908058803)       - sudah ada
 *   - Miftahul Hairia, S.Pd., M.Pd (NUPTK 6138777678230143) - baru
 *   - Rahman Syam, S.Pd., M.Si  (NIDN 0921129104)        - baru
 *   - Suardi, S.Pd., M.Pd       (NIDN 0905068702)        - sudah ada
 *
 * PENTING: mahasiswa di sini HARUS SUDAH ADA akunnya (dibuat lewat
 * scripts/seed-mahasiswa-angkatan2026.js atau sejenisnya) - script ini
 * TIDAK membuat akun mahasiswa baru, cuma menetapkan dosenPa-nya. Kalau
 * ada NIM yang belum ketemu, akan dilaporkan di ringkasan akhir tanpa
 * menghentikan proses baris lain.
 *
 * AMAN DIJALANKAN BERKALI-KALI: dosen yang sudah ada tidak dibuat dobel,
 * assignment dosenPaId ditimpa ulang tiap dijalankan.
 *
 * Cara pakai (dari root project, di server yang punya akses Firebase):
 *   node scripts/assign-dosen-pa-angkatan2026.js
 */

const { db, auth } = require('../config/firebaseAdmin');

const PASSWORD_DOSEN_BARU = 'dosenelektronika';

// ============================================================================
// DATA DOSEN
// ============================================================================
const DAFTAR_DOSEN = [
  { nama: 'Ariani Amri, S.Pd., M.Pd', identitas: '0918029701' },
  { nama: 'Fajar Ramadhan, S.Pd., M.T', identitas: '8559777678130153' },
  { nama: 'Gunawan Tari, S.T., M.T', identitas: '0908058803' },
  { nama: 'Miftahul Hairia, S.Pd., M.Pd', identitas: '6138777678230143' },
  { nama: 'Rahman Syam, S.Pd., M.Si', identitas: '0921129104' },
  { nama: 'Suardi, S.Pd., M.Pd', identitas: '0905068702' },
];

// ============================================================================
// PEMBAGIAN MAHASISWA (44 mahasiswa dibagi rata ke 6 dosen di atas, urut
// NIM, ukuran kelompok 8/8/7/7/7/7 - sisa dibulatkan ke kelompok pertama).
// Rhapid Wahidan DIKECUALIKAN dari pembagian rata ini dan ditetapkan
// khusus ke Fajar Ramadhan (lihat PENGECUALIAN di bawah).
// ============================================================================

const PA_ARIANI_AMRI = [
  ['26302001', 'Alfira'], ['26302002', 'Muhammad Reham'], ['26302003', 'Elmi'],
  ['26302004', 'Akbar Harun'], ['26302005', 'Suriansyah'], ['26302006', 'Ahmad Syafiq Sholehan'],
  ['26302007', 'M. Ezzar Syahfiril'], ['26302008', 'Rayzha Putri Hikma'],
];

const PA_FAJAR_RAMADHAN = [
  ['26302009', 'Baso Kahar'], ['26302010', 'Pramudia Ananta Tribahari'], ['26302011', 'Harmawan'],
  ['26302012', 'Fajar Hariyanto'], ['26302013', 'Rahmaniar'], ['26302014', 'Fachri Huzain Ilyas'],
  ['26302015', 'Dwi Ariyanto Jatmiko'], ['26302016', 'Muh Asmin'],
  // PENGECUALIAN: Rhapid Wahidan (26302043) sengaja dimasukkan ke sini
  // (bukan ke Suardi seperti pembagian rata) sesuai permintaan eksplisit.
  ['26302043', 'Rhapid Wahidan'],
];

const PA_GUNAWAN_TARI = [
  ['26302017', 'Sulkarnain'], ['26302018', 'Anisa Daniel Tudang'], ['26302019', 'Salfiah Sakinah'],
  ['26302020', 'Andre Kondolele'], ['26302021', 'Febrianty Anton'], ['26302022', 'Triversa'],
  ['26302023', 'Jumadil Alisman'],
];

const PA_MIFTAHUL_HAIRIA = [
  ['26302024', 'Aidil Jaya'], ['26302025', 'Riyani'], ['26302026', 'Andi Alifya Annisa S'],
  ['26302027', 'Davin Putra Emmanuel'], ['26302028', 'Indira Ramadani'], ['26302029', 'Ahmad Muflih'],
  ['26302030', 'Muh.Farrel'],
];

const PA_RAHMAN_SYAM = [
  ['26302031', 'Ainun Muhammad'], ['26302032', 'Muh. Jeyhan Jufri'], ['26302033', 'Deden Hardin'],
  ['26302034', 'Muh.Mufli Wahid M.Akil'], ['26302035', 'Ghifson Jasthin Ravael'], ['26302036', 'Rehan'],
  ['26302037', 'Herianto Parante'],
];

const PA_SUARDI = [
  ['26302038', 'Evan Dores'], ['26302039', 'Laurensya Parammangan'], ['26302040', 'Syariah Irawan'],
  ['26302041', 'Alga'], ['26302042', 'Muh. Ishak'],
  // NIM 26302043 (Rhapid Wahidan) SENGAJA TIDAK di sini - lihat PA_FAJAR_RAMADHAN.
  ['26302044', 'Rania'],
];

const DAFTAR_ASSIGNMENT = [
  { dosen: 'Ariani Amri, S.Pd., M.Pd', anggota: PA_ARIANI_AMRI },
  { dosen: 'Fajar Ramadhan, S.Pd., M.T', anggota: PA_FAJAR_RAMADHAN },
  { dosen: 'Gunawan Tari, S.T., M.T', anggota: PA_GUNAWAN_TARI },
  { dosen: 'Miftahul Hairia, S.Pd., M.Pd', anggota: PA_MIFTAHUL_HAIRIA },
  { dosen: 'Rahman Syam, S.Pd., M.Si', anggota: PA_RAHMAN_SYAM },
  { dosen: 'Suardi, S.Pd., M.Pd', anggota: PA_SUARDI },
];

// ============================================================================
// FUNGSI BANTU (pola sama dengan scripts/assign-dosen-pa-sk-1814-2025.js)
// ============================================================================

function buatEmailDosen(namaLengkap) {
  const namaSaja = namaLengkap.split(',')[0];
  const bersih = namaSaja.replace(/[^a-zA-Z\s]/g, '').trim();
  const slug = bersih.toLowerCase().replace(/\s+/g, '.');
  return `${slug}@elektronika.com`;
}

function normalisasiNama(nama) {
  return (nama || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '') // buang titik, koma, dll (gelar tidak berubah arti pencocokan)
    .replace(/\s+/g, ' ')
    .trim();
}

async function pastikanDosenAda(dosenInfo) {
  // Cocokkan berdasarkan nama yang DINORMALISASI (bukan exact match) supaya
  // tidak bikin dosen dobel gara-gara beda spasi/tanda baca/kapitalisasi
  // dengan data yang sudah ada (mis. dosen yang diinput manual sebelumnya
  // lewat /admin/dosen). Ambil semua dosen sekali lalu bandingkan di kode -
  // collection dosen biasanya kecil (puluhan), jadi ini murah.
  const semuaDosenSnapshot = await db.collection('dosen').get();
  const targetNormal = normalisasiNama(dosenInfo.nama);
  const cocok = semuaDosenSnapshot.docs.find(doc => normalisasiNama(doc.data().nama) === targetNormal);

  if (cocok) {
    const data = cocok.data();
    return {
      id: cocok.id,
      nama: data.nama,
      identitas: data.nidn || data.nip || data.nuptk || dosenInfo.identitas,
      dibuatBaru: false
    };
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

  return { id: userRecord.uid, nama: dosenInfo.nama, identitas: dosenInfo.identitas, dibuatBaru: true };
}

// ============================================================================
// PROSES UTAMA
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('ASSIGN DOSEN PA - ANGKATAN 2026');
  console.log('='.repeat(70));

  // Sanity check: pastikan tidak ada NIM dobel antar kelompok dosen
  const semuaBaris = DAFTAR_ASSIGNMENT.flatMap(g => g.anggota.map(a => ({ nim: a[0], nama: a[1], dosen: g.dosen })));
  const hitung = {};
  semuaBaris.forEach(b => { hitung[b.nim] = (hitung[b.nim] || 0) + 1; });
  const dup = Object.keys(hitung).filter(n => hitung[n] > 1);
  if (dup.length > 0) {
    console.log('⚠️  NIM berikut ada di lebih dari satu kelompok dosen - dibetulkan dulu:', dup);
    process.exit(1);
  }
  console.log(`Total mahasiswa akan diproses: ${semuaBaris.length}\n`);

  // --- 1. Pastikan semua dosen ada ---
  console.log('--- Memproses Dosen ---');
  const dosenMap = {};
  const dosenBaruDibuat = [];
  for (const d of DAFTAR_DOSEN) {
    const hasil = await pastikanDosenAda(d);
    dosenMap[d.nama] = hasil;
    if (hasil.dibuatBaru) {
      dosenBaruDibuat.push(hasil);
      console.log(`   ✅ Dibuat akun baru: ${hasil.nama} (${buatEmailDosen(hasil.nama)})`);
    } else {
      console.log(`   ✓  Sudah ada: ${hasil.nama}`);
    }
  }

  // --- 2. Assign tiap mahasiswa ---
  console.log('\n--- Assignment Dosen PA ---');
  const berhasil = [];
  const tidakDitemukan = [];

  for (const grup of DAFTAR_ASSIGNMENT) {
    const dosen = dosenMap[grup.dosen];
    console.log(`\n-- PA: ${grup.dosen} (${grup.anggota.length} mahasiswa) --`);
    for (const [nim, namaHarapan] of grup.anggota) {
      const snapshot = await db.collection('users')
        .where('role', '==', 'mahasiswa')
        .where('nim', '==', nim)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log(`   ❌ NIM ${nim} (${namaHarapan}) tidak ditemukan di sistem - dilewati.`);
        tidakDitemukan.push({ nim, nama: namaHarapan, dosen: grup.dosen });
        continue;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      if (data.nama && data.nama.trim().toLowerCase() !== namaHarapan.trim().toLowerCase()) {
        console.log(`   ⚠️  NIM ${nim}: nama di sistem ("${data.nama}") beda dengan daftar ("${namaHarapan}") - dicek manual ya.`);
      }

      await doc.ref.update({
        dosenPaId: dosen.id,
        dosenPaNama: dosen.nama,
        dosenPaNidn: dosen.identitas || null,
        updatedAt: new Date().toISOString(),
      });

      console.log(`   ✓  ${nim} - ${data.nama || namaHarapan}  ->  PA: ${dosen.nama}`);
      berhasil.push({ nim, nama: data.nama || namaHarapan, dosen: dosen.nama });
    }
  }

  // --- Ringkasan ---
  console.log('\n' + '='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Total di daftar       : ${semuaBaris.length}`);
  console.log(`Berhasil di-assign    : ${berhasil.length}`);
  console.log(`Tidak ditemukan       : ${tidakDitemukan.length}`);
  console.log(`Dosen baru dibuat     : ${dosenBaruDibuat.length}`);

  console.log('\n📊 Jumlah mahasiswa per dosen:');
  DAFTAR_ASSIGNMENT.forEach(g => {
    const jumlahBerhasil = berhasil.filter(b => b.dosen === g.dosen).length;
    console.log(`   - ${g.dosen}: ${jumlahBerhasil} mahasiswa`);
  });

  if (dosenBaruDibuat.length > 0) {
    console.log('\n📋 Akun DOSEN baru (sampaikan ke ybs untuk login & ganti password):');
    dosenBaruDibuat.forEach(d => {
      console.log(`   - ${d.nama} | email: ${buatEmailDosen(d.nama)} | password awal: ${PASSWORD_DOSEN_BARU}`);
    });
  }

  if (tidakDitemukan.length > 0) {
    console.log('\n❌ NIM yang TIDAK ditemukan di sistem:');
    tidakDitemukan.forEach(t => console.log(`   - ${t.nim} - ${t.nama} (harusnya PA: ${t.dosen})`));
    console.log('\nPastikan akun-akun ini sudah dibuat, lalu jalankan ulang script ini.');
  }

  console.log('\nSelesai.');
  process.exit(tidakDitemukan.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
