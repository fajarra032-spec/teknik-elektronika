/**
 * scripts/input-nilai-alih-kredit-25407245.js
 *
 * Memasukkan HASIL KONVERSI NILAI / ALIH KREDIT mahasiswa pindahan
 *   Asila Aswin (NIM 25407245), Teknik Elektronika, Semester 3
 *   asal: Teknologi Rekayasa Metalurgi - Politeknik Dewantara
 * ke koleksi Firestore `grades` (+ `enrollment`), 14 MK / 40 SKS.
 *
 * CARA KERJA & KEAMANAN (mengikuti pola scripts/input-nilai-angkatan25-*.js)
 * - Mahasiswa dicari lewat NIM (exact match), BUKAN nama. Kalau tidak ketemu
 *   script berhenti - buat dulu akunnya lewat Admin > Mahasiswa > Tambah.
 *   Nama di database juga dibandingkan dengan nama di dokumen konversi; kalau
 *   beda, hanya diberi peringatan (tidak menghentikan).
 * - Nilai disimpan lewat saveGradeFinal() (upsert per userId+kodeMk+semester),
 *   jadi aman dijalankan berulang, tidak akan dobel.
 * - `grades` hanya menyimpan nilai ANGKA 0-100, sedangkan dokumen konversi
 *   hanya punya HURUF. Karena itu huruf diubah ke angka representatif lewat
 *   HURUF_KE_ANGKA di bawah. Angka itu dicek ulang dengan nilaiKeHuruf()
 *   (skala resmi: A>=86, B+>=76) - kalau tidak kembali ke huruf yang sama,
 *   script berhenti sebelum menulis apa pun. Huruf asli disimpan juga di
 *   field `nilaiHuruf` pada dokumen grades (beserta jenis 'alih-kredit' dan
 *   asal prodi) supaya jelas ini nilai konversi, bukan nilai hasil kuliah.
 * - "WUD2201-5" di dokumen = rentang kode Pendidikan Agama (2201 Islam,
 *   2202 Kristen, 2203 Katolik, 2204 Hindu, 2205 Budha). Kode yang dipakai
 *   diambil dari field `agama` di profil mahasiswa. Kalau kosong/tidak valid,
 *   script berhenti (isi dulu agamanya, atau set AGAMA_OVERRIDE).
 * - Tiap MK ditempatkan di semester sesuai kurikulum (semester 1 -> Ganjil
 *   2025/2026, semester 2 -> Genap 2025/2026) supaya KHS per semester dan
 *   IPK/transkrip tampil rapi. Ubah SEMESTER_LABEL kalau kebijakan prodi beda.
 * - Sekaligus membuat `enrollment` (status 'active', krsId null) per MK, sama
 *   seperti script input nilai historis lainnya.
 * - DEFAULT DRY-RUN: hanya menampilkan rencana, TIDAK menulis apa pun sampai
 *   dijalankan dengan --confirm.
 *
 * PRASYARAT: scripts/seed-matakuliah-2026.js sudah pernah dijalankan (semua
 * kode MK di bawah harus ada di koleksi mataKuliah).
 *
 * Cara pakai:
 *   1) node scripts/input-nilai-alih-kredit-25407245.js            (cek dulu)
 *   2) node scripts/input-nilai-alih-kredit-25407245.js --confirm  (simpan)
 */

const { db } = require('../config/firebaseAdmin');
const { saveGradeFinal, nilaiKeHuruf } = require('../helpers/nilaiHelper');
const { KODE_AGAMA, AGAMA_OPTIONS } = require('../helpers/paketKurikulumHelper');

const KONFIRMASI = process.argv.includes('--confirm');

// ============================================================================
// DATA MAHASISWA & ASAL NILAI
// ============================================================================
const NIM = '25407245';
const NAMA_DI_DOKUMEN = 'Asila Aswin';
const ASAL_PRODI = 'Teknologi Rekayasa Metalurgi';
const ASAL_PT = 'Politeknik Dewantara';

// Isi mis. 'Islam' kalau field `agama` di profil mahasiswa masih kosong.
// null = ambil dari profil.
const AGAMA_OVERRIDE = null;

// Huruf konversi -> angka representatif (harus jatuh di rentang huruf yang
// sama menurut nilaiKeHuruf: A >= 86, B+ 76-85.99). Ubah di sini bila prodi
// punya angka konversi baku.
const HURUF_KE_ANGKA = { 'A': 90, 'B+': 80 };

// Semester kurikulum (angka) -> label periode yang dipakai di `grades`/`enrollment`
const SEMESTER_LABEL = {
  1: 'Ganjil 2025/2026',
  2: 'Genap 2025/2026'
};

// ============================================================================
// TABEL KONVERSI (sesuai dokumen). kode 'AGAMA' = WUD2201-5 (lihat catatan atas)
// ============================================================================
const KONVERSI = [
  { no: 1,  kode: 'AGAMA',   nama: 'Pendidikan Agama',                    sks: 2, huruf: 'A',  smt: 1 },
  { no: 2,  kode: 'WUD3208', nama: 'Bahasa Indonesia',                    sks: 3, huruf: 'B+', smt: 1 },
  { no: 3,  kode: 'WUD3209', nama: 'Bahasa Inggris',                      sks: 3, huruf: 'A',  smt: 1 },
  { no: 4,  kode: 'PD3201',  nama: 'Etika Kerja',                         sks: 3, huruf: 'B+', smt: 1 },
  { no: 5,  kode: 'PD3202',  nama: 'Standardisasi',                       sks: 3, huruf: 'A',  smt: 1 },
  { no: 6,  kode: 'PD3203',  nama: 'Matematika Teknik',                   sks: 3, huruf: 'B+', smt: 1 },
  { no: 7,  kode: 'PD3204',  nama: 'Perangkat Lunak Aplikasi',            sks: 3, huruf: 'B+', smt: 1 },
  { no: 8,  kode: 'WUD2206', nama: 'Pendidikan Kewarganegaraan',          sks: 2, huruf: 'A',  smt: 2 },
  { no: 9,  kode: 'PD3205',  nama: 'Keselamatan dan Kesehatan Kerja (K3)', sks: 3, huruf: 'A',  smt: 2 },
  { no: 10, kode: 'PD3206',  nama: 'Aplikasi Komputer',                   sks: 3, huruf: 'A',  smt: 2 },
  { no: 11, kode: 'PD3207',  nama: 'Teknik Pengukuran',                   sks: 3, huruf: 'B+', smt: 2 },
  { no: 12, kode: 'PD3208',  nama: 'Peralatan Teknik',                    sks: 3, huruf: 'B+', smt: 2 },
  { no: 13, kode: 'PD3209',  nama: 'Menggambar Teknik',                   sks: 3, huruf: 'B+', smt: 2 },
  { no: 14, kode: 'PD3210',  nama: 'Data dan Sistem Informasi',           sks: 3, huruf: 'A',  smt: 2 }
];

const TOTAL_MK_DOKUMEN = 14;
const TOTAL_SKS_DOKUMEN = 40;

// ============================================================================
// VALIDASI DATA (jalan sebelum menyentuh database)
// ============================================================================
function validasiData() {
  const totalSks = KONVERSI.reduce((s, k) => s + k.sks, 0);
  if (KONVERSI.length !== TOTAL_MK_DOKUMEN || totalSks !== TOTAL_SKS_DOKUMEN) {
    throw new Error(`Data tidak sesuai dokumen: ${KONVERSI.length} MK / ${totalSks} SKS (seharusnya ${TOTAL_MK_DOKUMEN} MK / ${TOTAL_SKS_DOKUMEN} SKS)`);
  }
  KONVERSI.forEach(k => {
    const angka = HURUF_KE_ANGKA[k.huruf];
    if (angka === undefined) throw new Error(`Huruf "${k.huruf}" (${k.nama}) belum punya angka di HURUF_KE_ANGKA`);
    if (!SEMESTER_LABEL[k.smt]) throw new Error(`Semester ${k.smt} (${k.nama}) belum punya label di SEMESTER_LABEL`);
    const balik = nilaiKeHuruf(angka).huruf;
    if (balik !== k.huruf) {
      throw new Error(`Angka ${angka} untuk huruf ${k.huruf} ternyata terbaca sebagai ${balik} oleh nilaiKeHuruf(). Perbaiki HURUF_KE_ANGKA.`);
    }
  });
}

// ============================================================================
// FUNGSI BANTU DATABASE
// ============================================================================
async function cariUserByNim(nim) {
  const snap = await db.collection('users').where('nim', '==', nim).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function cariMkByKode(kode) {
  const snap = await db.collection('mataKuliah').where('kode', '==', kode).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function pastikanEnrollment(userId, mkId, semester) {
  const existing = await db.collection('enrollment')
    .where('userId', '==', userId)
    .where('mkId', '==', mkId)
    .where('semester', '==', semester)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (!existing.empty) return 'sudah-ada';

  await db.collection('enrollment').add({
    userId,
    mkId,
    semester,
    status: 'active',
    createdAt: new Date().toISOString(),
    approvedBy: null,
    krsId: null,
    catatan: `Alih kredit dari ${ASAL_PRODI} (${ASAL_PT}) - dibuat otomatis oleh scripts/input-nilai-alih-kredit-25407245.js, tidak ada pengajuan KRS asli.`
  });
  return 'dibuat';
}

// ============================================================================
// UTAMA
// ============================================================================
async function jalankan() {
  console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MENULIS KE DATABASE' : '🟡 DRY-RUN - cuma simulasi, tidak menulis apa pun'}`);
  validasiData();
  console.log(`✅ Data sesuai dokumen: ${KONVERSI.length} MK / ${TOTAL_SKS_DOKUMEN} SKS, konversi huruf->angka valid.\n`);

  // 1) Mahasiswa
  const user = await cariUserByNim(NIM);
  if (!user) {
    console.log(`⛔ NIM ${NIM} tidak ada di koleksi users. Buat dulu akun mahasiswanya (Admin > Mahasiswa > Tambah), lalu jalankan ulang.`);
    process.exit(1);
  }
  console.log(`👤 ${user.nim} - ${user.nama || '(tanpa nama)'}  (userId: ${user.id})`);
  if (String(user.nama || '').trim().toLowerCase() !== NAMA_DI_DOKUMEN.toLowerCase()) {
    console.log(`⚠️  Nama di database "${user.nama}" berbeda dengan di dokumen "${NAMA_DI_DOKUMEN}". Pastikan NIM ini memang orang yang sama.`);
  }
  if (user.role && user.role !== 'mahasiswa') {
    console.log(`⛔ User ini role-nya "${user.role}", bukan mahasiswa. Berhenti.`);
    process.exit(1);
  }

  // 2) Tentukan kode Pendidikan Agama
  const agama = AGAMA_OVERRIDE || user.agama;
  if (!AGAMA_OPTIONS.includes(agama)) {
    console.log(`⛔ Field agama mahasiswa ini "${agama || '(kosong)'}" tidak valid. Isi dulu lewat Edit Mahasiswa (pilihan: ${AGAMA_OPTIONS.join(', ')}) atau set AGAMA_OVERRIDE di script.`);
    process.exit(1);
  }
  const kodeAgama = KODE_AGAMA[agama];
  console.log(`🕌 Agama: ${agama} -> Pendidikan Agama memakai kode ${kodeAgama}\n`);

  // 3) Pastikan semua MK ada di database (sebelum menulis apa pun)
  const daftar = KONVERSI.map(k => ({ ...k, kodeFinal: k.kode === 'AGAMA' ? kodeAgama : k.kode }));
  const mkMap = {};
  let adaMkHilang = false;
  for (const k of daftar) {
    const mk = await cariMkByKode(k.kodeFinal);
    if (!mk) {
      console.log(`❌ Mata kuliah ${k.kodeFinal} (${k.nama}) BELUM ADA di database.`);
      adaMkHilang = true;
      continue;
    }
    mkMap[k.kodeFinal] = mk;
    if (parseFloat(mk.sks) !== k.sks) {
      console.log(`⚠️  SKS ${k.kodeFinal} di database (${mk.sks}) beda dengan dokumen (${k.sks}). Yang dipakai: SKS dokumen (${k.sks}).`);
    }
  }
  if (adaMkHilang) {
    console.log('\n⛔ Berhenti. Jalankan dulu: node scripts/seed-matakuliah-2026.js');
    process.exit(1);
  }

  // 4) Tampilkan / tulis
  console.log('No  Kode      Mata Kuliah                              SKS  Huruf  Angka  Semester');
  console.log('--  --------  ---------------------------------------  ---  -----  -----  -----------------');
  let berhasil = 0, gagal = 0, baru = 0, diperbarui = 0, enrollBaru = 0, enrollAda = 0;
  let sksTotal = 0, bobotTotal = 0;

  for (const k of daftar) {
    const angka = HURUF_KE_ANGKA[k.huruf];
    const semester = SEMESTER_LABEL[k.smt];
    const namaMk = mkMap[k.kodeFinal].nama || k.nama;
    sksTotal += k.sks;
    bobotTotal += k.sks * nilaiKeHuruf(angka).indeks;

    console.log(
      `${String(k.no).padEnd(2)}  ${k.kodeFinal.padEnd(8)}  ${namaMk.slice(0, 39).padEnd(39)}  ${String(k.sks).padEnd(3)}  ${k.huruf.padEnd(5)}  ${String(angka).padEnd(5)}  ${semester}`
    );

    if (!KONFIRMASI) continue;
    try {
      const { id, isNew } = await saveGradeFinal({
        userId: user.id, kodeMk: k.kodeFinal, namaMk, sks: k.sks, nilai: angka, semester
      });
      await db.collection('grades').doc(id).update({
        jenis: 'alih-kredit',
        nilaiHuruf: k.huruf,
        asalProdi: ASAL_PRODI,
        asalPerguruanTinggi: ASAL_PT
      });
      isNew ? baru++ : diperbarui++;
      berhasil++;

      const hasil = await pastikanEnrollment(user.id, mkMap[k.kodeFinal].id, semester);
      hasil === 'dibuat' ? enrollBaru++ : enrollAda++;
    } catch (err) {
      console.error(`   ⚠️  Gagal simpan ${k.kodeFinal}:`, err.message);
      gagal++;
    }
  }

  const ipk = sksTotal > 0 ? (bobotTotal / sksTotal).toFixed(2) : '0.00';
  console.log('\n=== RINGKASAN ===');
  console.log(`Mata kuliah : ${daftar.length}   |   Total SKS : ${sksTotal}   |   IPK dari nilai konversi : ${ipk}`);

  if (!KONFIRMASI) {
    console.log('\n👉 Ini baru DRY-RUN. Kalau semua sudah benar, jalankan ulang dengan --confirm:');
    console.log('   node scripts/input-nilai-alih-kredit-25407245.js --confirm');
  } else {
    console.log(`Nilai disimpan : ${berhasil} (baru ${baru}, diperbarui ${diperbarui})   |   Gagal : ${gagal}`);
    console.log(`Enrollment     : dibuat ${enrollBaru}, sudah ada ${enrollAda}`);
    console.log('Cek hasilnya di Admin > Nilai > Nilai per Mahasiswa.');
  }
  process.exit(gagal > 0 ? 1 : 0);
}

jalankan().catch(err => {
  console.error('Gagal menjalankan script:', err);
  process.exit(1);
});
