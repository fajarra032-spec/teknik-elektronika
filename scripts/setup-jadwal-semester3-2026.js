/**
 * scripts/setup-jadwal-semester3-2026.js
 *
 * Menerapkan jadwal & dosen pengampu semester 3 (Ganjil TA 2026/2027)
 * sesuai dokumen "Jadwal Perkuliahan Semester 3 - Kelas 3A" ke collection
 * `mataKuliah`. BEDA dengan semester 1: Teknik Elektronika cuma punya SATU
 * kelas di semester 3 (3A) - jadi TIDAK ADA pemisahan per kelas di sini,
 * cukup update dosen + jadwal pada dokumen yang sudah ada (kelas: null).
 *
 * Kode-kode di bawah ini adalah varian KONSENTRASI INSTRUMENTASI (cocok
 * dengan mata kuliah di dokumen jadwal Kelas 3A - lihat PAKET_KURIKULUM di
 * helpers/paketKurikulumHelper.js). Kalau nanti ada kelas Telekomunikasi
 * dengan jadwalnya sendiri, beri tahu saya - kodenya beda (PEK3207-3210).
 *
 * AMAN DIJALANKAN BERULANG: dosen yang sudah ada tidak dibuat dobel (pakai
 * pencocokan nama yang dinormalisasi, sama seperti script sebelumnya).
 *
 * Cara pakai:
 *   node scripts/setup-jadwal-semester3-2026.js
 */

const { db, auth } = require('../config/firebaseAdmin');
const academicHelper = require('../helpers/academicHelper');

const PASSWORD_DOSEN_BARU = 'dosenelektronika';

// ============================================================================
// DATA DOSEN
// ============================================================================
const DAFTAR_DOSEN = [
  { nama: 'Ariani Amri, S.Pd., M.Pd', identitas: '0918029701' },
  { nama: 'Fajar Ramadhan, S.Pd., M.T', identitas: '8559777678130153' },
  { nama: 'Gunawan Tari, S.T., M.T', identitas: '0908058803' },
  { nama: 'Rahman Syam, S.Pd., M.Si', identitas: '0921129104' },
  { nama: 'Miftahul Hairia, S.Pd., M.Pd', identitas: '6138777678230143' },
  { nama: 'Chalik Mawardi, S.P., M.Si.', identitas: null }, // belum ada NIDN/NUPTK di dokumen jadwal
];

// ============================================================================
// MATA KULIAH SEMESTER 3 - KELAS 3A (satu-satunya kelas, tidak dipisah)
// ============================================================================
const MK_SEMESTER3 = [
  {
    kode: 'WUD2207', // Pendidikan Pancasila
    dosen: ['Chalik Mawardi, S.P., M.Si.'],
    jadwal: 'Senin 07.30-08.30, AULA LT4 (Gabungan ELK 3A, SPL 3A, SPL 3B, SPL 3C)'
  },
  {
    kode: 'PEK3201', // DSTL (Dasar Sistem Tenaga Listrik)
    dosen: ['Ariani Amri, S.Pd., M.Pd'],
    jadwal: 'Senin 10.30-11.30, K303'
  },
  {
    kode: 'PEK3205', // Perawatan dan Perbaikan
    dosen: ['Miftahul Hairia, S.Pd., M.Pd', 'Gunawan Tari, S.T., M.T'],
    jadwal: 'Senin 11.30-12.30, K303'
  },
  {
    kode: 'PEK3202', // Elektronika Digital
    dosen: ['Rahman Syam, S.Pd., M.Si'],
    jadwal: 'Kamis 09.30-10.30, LAB 3'
  },
  {
    kode: 'PEK3203', // Mikrokontroler
    dosen: ['Fajar Ramadhan, S.Pd., M.T'],
    jadwal: 'Kamis 10.30-11.30, LAB 3'
  },
  {
    kode: 'PEK3204', // Rangkaian Elektronika
    dosen: ['Miftahul Hairia, S.Pd., M.Pd'],
    jadwal: 'Jumat 08.45-09.45, K201'
  },
  {
    kode: 'PEK3206', // PLC (Programmable Logic Controller)
    dosen: ['Fajar Ramadhan, S.Pd., M.T'],
    jadwal: 'Jumat 09.45-10.45, LAB 2'
  },
];

// ============================================================================
// FUNGSI BANTU (pola sama seperti scripts/setup-jadwal-semester1-2026.js)
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
  console.log('SETUP JADWAL & DOSEN SEMESTER 3 - KELAS 3A (GANJIL TA 2026/2027)');
  console.log('='.repeat(70));

  console.log('\n--- Memproses Dosen ---');
  let semuaDosenSnapshot = await db.collection('dosen').get();
  const dosenMap = {};
  for (const d of DAFTAR_DOSEN) {
    const hasil = await pastikanDosenAda(d, semuaDosenSnapshot);
    dosenMap[d.nama] = hasil;
    if (hasil.dibuatBaru) {
      console.log(`   ✅ Dibuat akun baru: ${hasil.nama} (${buatEmailDosen(hasil.nama)})${d.identitas ? '' : ' - ⚠️ NIDN/NUPTK belum diisi, lengkapi manual lewat /admin/dosen'}`);
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

  console.log('\n--- Memproses Mata Kuliah Semester 3 (Kelas 3A) ---');
  for (const mk of MK_SEMESTER3) {
    const dosenIds = idDosen(mk.dosen);
    const snap = await db.collection('mataKuliah').where('kode', '==', mk.kode).get();

    if (snap.empty) {
      const docRef = await db.collection('mataKuliah').add({
        kode: mk.kode,
        nama: null, // seharusnya sudah ada dari sync-matakuliah-dari-rps.js
        kelas: null,
        jadwal: mk.jadwal,
        dosenIds,
        materi: buatMateriKosong(),
        createdAt: new Date().toISOString(),
      });
      await setPengampuAktif(docRef.id, dosenIds);
      console.log(`   ✅ Dibuat baru (belum pernah disync sebelumnya): ${mk.kode}`);
    } else {
      // Semester 3 cuma 1 kelas - pakai dokumen tanpa kelas spesifik kalau
      // ada, kalau semuanya sudah kepalang punya kelas (mis. sisa
      // eksperimen sebelumnya), pakai dokumen pertama saja.
      const doc = snap.docs.find(d => !d.data().kelas) || snap.docs[0];
      await doc.ref.update({ jadwal: mk.jadwal, updatedAt: new Date().toISOString() });
      await setPengampuAktif(doc.id, dosenIds);
      console.log(`   ✓  Diperbarui: ${mk.kode} - ${doc.data().nama || '(tanpa nama)'} -> jadwal: ${mk.jadwal}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SELESAI');
  console.log('='.repeat(70));
  console.log('⚠️  Dosen "Chalik Mawardi, S.P., M.Si." belum ada NIDN/NUPTK -');
  console.log('   lengkapi manual lewat /admin/dosen.');
  console.log('\nLangkah selanjutnya: node scripts/aktifkan-krs-semester3.js');
  console.log('supaya mahasiswa semester 3 yang belum ter-KRS masuk dengan jadwal yang benar.');

  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
