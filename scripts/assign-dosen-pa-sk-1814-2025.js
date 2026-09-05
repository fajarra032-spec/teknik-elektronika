/**
 * scripts/assign-dosen-pa-sk-1814-2025.js
 *
 * Menetapkan Dosen PA (Pembimbing Akademik) ke mahasiswa Prodi Teknik
 * Elektronika sesuai lampiran SK Ketua Prodi Nomor 1814/EK/Polidewa/VII/2025
 * (Semester Ganjil TA 2025/2026) - 117 mahasiswa, 5 dosen.
 *
 * YANG DILAKUKAN SCRIPT INI, PER BARIS DI DAFTAR_SK DI BAWAH:
 * 1. Cari dosen berdasarkan NAMA persis di collection `dosen`.
 *    - Kalau BELUM ADA -> buat akun baru:
 *        email    : [nama-tanpa-gelar]@elektronika.com
 *        password : lihat PASSWORD_DOSEN_BARU di bawah
 * 2. Cari mahasiswa berdasarkan NIM di collection `users`.
 *    - Kalau BELUM ADA -> buat akun baru:
 *        email    : [nim]@polidewa.elk
 *        password : elektronika + angkatan, mis. NIM diawali "26" -> "elektronika2026"
 *                   (angkatan dihitung dari 2 digit pertama NIM: "20"+2digit)
 * 3. Set field dosenPaId/dosenPaNama/dosenPaNidn pada dokumen mahasiswa itu,
 *    SAMA seperti kalau admin assign lewat /admin/mahasiswa (lihat
 *    routes/admin/mahasiswa.js) - jadi otomatis muncul juga di cetak KRS,
 *    detail mahasiswa, dsb.
 *
 * AMAN DIJALANKAN BERKALI-KALI:
 * - Dosen/mahasiswa yang SUDAH ADA tidak dibuat dobel (dicari dulu sebelum
 *   membuat akun baru).
 * - Assignment dosenPaId ditimpa ulang tiap dijalankan (idempotent) -
 *   jadi kalau lampiran SK direvisi, cukup edit DAFTAR_SK di bawah lalu
 *   jalankan ulang.
 *
 * PERINGATAN DATA SUMBER (harap dicek ke bagian akademik/prodi sebelum
 * menjalankan produksi, JANGAN diabaikan):
 * - NIM 23302048 muncul 2x di lampiran SK dengan nama BERBEDA:
 *     "Rifqu Noperdiansyah" (blok Ariani Amri) dan "Ibra Razak" (blok Nabila
 *     Febriyanti). Salah satu NIM di dokumen aslinya kemungkinan salah ketik.
 * - NIM 23302046 juga muncul 2x dengan nama berbeda: "Srilisa" dan "Dela"
 *   (keduanya di blok Ariani Amri).
 *   Untuk KEDUA kasus di atas, script akan memproses baris sesuai urutan di
 *   DAFTAR_SK - baris yang diproses BELAKANGAN akan menimpa assignment baris
 *   sebelumnya untuk NIM yang sama. Script mencetak PERINGATAN jelas untuk
 *   NIM-NIM ini di awal & akhir proses supaya tidak terlewat.
 *
 * PENTING SEBELUM MENJALANKAN:
 * 1. Cek/ubah PASSWORD_DOSEN_BARU di bawah kalau mau beda dari default.
 * 2. Jalankan dari root project, di server yang punya akses Firebase:
 *      node scripts/assign-dosen-pa-sk-1814-2025.js
 * 3. Setelah jalan, cek ringkasan di akhir - terutama bagian "PERLU DICEK
 *    MANUAL" (mahasiswa/dosen baru dibuat, NIM duplikat, dan NIM yang sama
 *    sekali tidak ditemukan setelah dibuatkan akun pun gagal).
 */

const { db, auth } = require('../config/firebaseAdmin');
const { DEFAULT_AGAMA } = require('../helpers/paketKurikulumHelper');

// ============================================================================
// KONFIGURASI
// ============================================================================

// Password default untuk akun DOSEN yang baru dibuat oleh script ini.
// Ganti di sini kalau perlu format lain - sampaikan ke dosen ybs untuk
// login lalu ganti password sendiri.
const PASSWORD_DOSEN_BARU = 'dosenelektronika';

// ============================================================================
// DATA DOSEN (dari kop & lampiran SK 1814/EK/Polidewa/VII/2025)
// ============================================================================
// `identitas` diisi NIDN kalau ada, kalau tidak ada NIDN dipakai NUPTK -
// disimpan ke field `nip` DAN `nidn` sekaligus di dokumen dosen supaya
// tampil benar baik di form admin standar (/admin/dosen, yang memakai
// field `nip`) maupun di fitur Dosen PA (/admin/mahasiswa, yang memakai
// field `nidn` dengan fallback ke `nip` - lihat getAllDosenPa()).
const DAFTAR_DOSEN = [
  { nama: 'Suardi, S.Pd., M.Pd', identitas: '0905068702' },
  { nama: 'Ariani Amri, S.Pd., M.Pd', identitas: '0918029701' },
  { nama: 'Muh. Fitra Nur Asri, S.Kom., M.Kom', identitas: '1443774675130283' },
  { nama: 'Gunawan Tari, S.T., M.T', identitas: '0908058803' },
  { nama: 'Nabila Febriyanti, S.Pd., M.Pd', identitas: '6550777678230102' },
];

// ============================================================================
// DATA MAHASISWA -> DOSEN PA (dari lampiran SK, urutan sesuai dokumen)
// ============================================================================
// `dosen` di bawah HARUS persis sama dengan salah satu `nama` di DAFTAR_DOSEN
// di atas (dipakai untuk mencocokkan, case-sensitive).
const DAFTAR_SK = [
  { nim: '21302002', nama: 'Asri Dian Perdana Toding', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '21302003', nama: 'Yudi Amar', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '21302021', nama: 'Muh. Rifqi Ardiansyah', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '21302007', nama: 'Adimas Pangestu', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '21302012', nama: 'Randi Dwi Putra', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '21302006', nama: 'Saipul', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '21302009', nama: 'Sanjaya', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302001', nama: 'Syamsul Rijal', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302002', nama: 'Irham Ilyas', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '22302003', nama: 'Ahmad Iswadi', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '22302004', nama: 'Muh. Arif Ikhlasul Amal', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '22302005', nama: 'Sutan', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '22302006', nama: 'Wahyu Farhan', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '22302007', nama: 'Muhaimin Jabir', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '22302008', nama: 'Indriani Sukisman', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '22302010', nama: 'Asriani', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '22302011', nama: 'Akmal Kamaruddin', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '22302012', nama: 'Erin Barira', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '22302013', nama: 'Maulana Syam', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '22302014', nama: 'Hafid', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '22302015', nama: 'Nurhaliza', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '22302016', nama: 'Diwon Girik Allo', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '22302017', nama: 'Jumiati', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '22302018', nama: 'Annisa Diah Farny', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '22302019', nama: 'Devi Permata Sari', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302020', nama: 'Syamsul Bahri', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302021', nama: 'Salvator Olgi Endo', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302022', nama: 'Asa Yunus Rufina', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302023', nama: "Priska Iriany Karoma'", dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302053', nama: 'Erlinda Dahlia', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '22302054', nama: 'Rachmad Alfiandy', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '22302055', nama: 'Resi Pamuso', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '22302056', nama: 'Muh. Raiyhan Hadi Pratama', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '22302057', nama: 'Muhammad Ridwan', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302001', nama: 'Muh. Reski Chalik', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302002', nama: 'Muh. Ibrahim Hasan', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302003', nama: 'Putri Cahaya', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302004', nama: 'Desarmon Tojaya', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302005', nama: 'Rahul Jacson Gati', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302008', nama: 'Juniansa', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302068', nama: 'Hasim Rahman', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302010', nama: 'Fikri Habib', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302011', nama: 'Anwar', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302012', nama: 'Vicky Prasetio', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302014', nama: 'Afdhal', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302015', nama: 'Hairullah Hairuddin', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302016', nama: 'Abdul Jaya', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302022', nama: 'Shabrina Malika Az-Zahra', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302023', nama: 'Erina', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '23302024', nama: 'Faras Nur Anjani', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302025', nama: 'Sulmika', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302026', nama: 'Muhammad Salman', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302028', nama: 'Afandi Jhon Malabi', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302029', nama: 'Ibnu Muarif', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302067', nama: 'Vito Aditya', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302062', nama: 'Muh. Akram', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302031', nama: 'Arbaiyah', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302032', nama: 'Asriyadi', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302033', nama: 'Muhammad Gading Riyanto. R', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302034', nama: 'Nur Fadillah', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '23302035', nama: 'Saania Maharani', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302036', nama: 'Armayanti A', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302038', nama: 'Fiqril', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  // ⚠️ NIM 23302048 muncul lagi di bawah dengan nama berbeda - lihat catatan di atas
  { nim: '23302048', nama: 'Rifqu Noperdiansyah', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  // ⚠️ NIM 23302046 muncul lagi di bawah dengan nama berbeda - lihat catatan di atas
  { nim: '23302046', nama: 'Srilisa', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302039', nama: 'Lira', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302040', nama: 'Muh Rifky', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302042', nama: 'Putri Amelia', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302043', nama: 'Nova Samulung', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302044', nama: 'Anggun', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302046', nama: 'Dela', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302047', nama: 'Saenal', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '23302048', nama: 'Ibra Razak', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302049', nama: 'Indah Pagalla', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302051', nama: 'Ahmad Arifin', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302052', nama: 'Muh. Al-Gasali', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302053', nama: 'Muh. Fariel', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302054', nama: 'Abd Paki', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302055', nama: 'Agung', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302056', nama: 'Sainuddin', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302057', nama: 'Muh Sulsabilah', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302058', nama: 'Muh Adam', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302059', nama: 'Haerul', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302060', nama: 'Ridwan', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '23302061', nama: 'Ummi Kalsum', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '23302063', nama: "Muh. Gerald Rofi'f", dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '23302064', nama: 'Muhammad Faiz Al-Gifari', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '23302065', nama: 'Ahmad Gazali', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '23302066', nama: 'Fendi Kurniawan', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '24302001', nama: 'Wahidin Salim', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '24302002', nama: 'Stanislaus Agung Paborrong', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '24302003', nama: 'Asmunandar', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '24302004', nama: 'Ahmad Arifin', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '24302005', nama: 'Aidil Jalil', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '24302006', nama: 'Aida Pita', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '24302007', nama: 'Aan Alamsyah', dosen: 'Suardi, S.Pd., M.Pd' },
  { nim: '24302008', nama: 'Lukman', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '24302009', nama: 'Muhammad Akbar Ali', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '24302010', nama: 'Muh Ramadhan', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '24302011', nama: 'Andi Reski Utama', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '24302012', nama: 'Ahmad Idul Fitri', dosen: 'Ariani Amri, S.Pd., M.Pd' },
  { nim: '24302013', nama: 'Randi Saputra', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '24302014', nama: 'Muh. Aswan', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '24302015', nama: 'Muh. Amri Saharuddin', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '24302016', nama: 'Nailla Istianna', dosen: 'Gunawan Tari, S.T., M.T' },
  { nim: '24302017', nama: 'Wirya Rusli Lutra', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '24302018', nama: 'Dandi S. Tandiwara', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '24302019', nama: 'Sem Irfan Patabang', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '24302020', nama: 'Musafira Nur Asyiarah', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '24302021', nama: 'Lalu Muhammad Ikhsan Giwana', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '24302022', nama: 'Musliadi', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '24302023', nama: 'Muhammad Samsul', dosen: 'Nabila Febriyanti, S.Pd., M.Pd' },
  { nim: '24302024', nama: 'Ibra pagiling', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '24302025', nama: 'Ariyo Tangdiombo', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '24302026', nama: 'Muh. Akmal Syawal Angkotasan', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '24302027', nama: 'Andri Otniel Satoding', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
  { nim: '24302028', nama: 'Ian Adi Putra', dosen: 'Muh. Fitra Nur Asri, S.Kom., M.Kom' },
];

// ============================================================================
// FUNGSI BANTU
// ============================================================================

/** "Suardi, S.Pd., M.Pd" -> "suardi@elektronika.com" */
function buatEmailDosen(namaLengkap) {
  const namaSaja = namaLengkap.split(',')[0]; // buang gelar setelah koma pertama
  const bersih = namaSaja.replace(/[^a-zA-Z\s]/g, '').trim(); // buang titik dll
  const slug = bersih.toLowerCase().replace(/\s+/g, '.');
  return `${slug}@elektronika.com`;
}

/** "26100200" -> "2026" (2 digit pertama NIM + "20") */
function angkatanDariNim(nim) {
  if (!nim || nim.length < 2) return null;
  return '20' + nim.substring(0, 2);
}

/** "26100200" -> "elektronika2026" */
function buatPasswordMahasiswa(nim) {
  const angkatan = angkatanDariNim(nim);
  return `elektronika${angkatan || ''}`;
}

/**
 * Cari dosen di Firestore berdasarkan nama persis. Kalau tidak ada, buat
 * akun Auth + dokumen `dosen` baru. Return { id, nama, identitas, dibuatBaru }.
 */
function normalisasiNama(nama) {
  return (nama || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function pastikanDosenAda(dosenInfo) {
  // Cocokkan berdasarkan nama yang DINORMALISASI (bukan exact match) supaya
  // tidak bikin dosen dobel gara-gara beda spasi/tanda baca/kapitalisasi
  // dengan data yang sudah ada (mis. diinput manual lewat /admin/dosen).
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
    // Kalau email sudah terdaftar di Auth (mis. sisa percobaan sebelumnya
    // yang gagal setengah jalan) tapi dokumen dosen belum ada, ambil UID-nya
    // dan lanjutkan membuat dokumen dosen-nya saja - supaya script tetap
    // aman dijalankan ulang walau sempat gagal di tengah.
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

/**
 * Cari mahasiswa di Firestore berdasarkan NIM. Kalau tidak ada, buat akun
 * Auth + dokumen `users` + `tagihan` baru. Return { id, nama, dibuatBaru }.
 */
async function pastikanMahasiswaAda(row) {
  const snapshot = await db.collection('users')
    .where('role', '==', 'mahasiswa')
    .where('nim', '==', row.nim)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    const data = doc.data();
    if (data.nama && data.nama.trim().toLowerCase() !== row.nama.trim().toLowerCase()) {
      console.warn(`   ⚠️  NIM ${row.nim}: nama di sistem ("${data.nama}") beda dengan nama di SK ("${row.nama}") - dicek manual ya.`);
    }
    return { id: doc.id, nama: data.nama, dibuatBaru: false };
  }

  const email = `${row.nim}@polidewa.elk`;
  const password = buatPasswordMahasiswa(row.nim);
  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName: row.nama });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }

  await db.collection('users').doc(userRecord.uid).set({
    nim: row.nim,
    nama: row.nama,
    email,
    foto: null,
    fotoFileId: null,
    role: 'mahasiswa',
    semester: null,
    statusMagang: null,
    statusMahasiswa: 'Aktif',
    kelas: null,
    konsentrasi: null,
    agama: DEFAULT_AGAMA,
    createdAt: new Date().toISOString(),
  });

  await db.collection('tagihan').doc(userRecord.uid).set({
    mahasiswaId: userRecord.uid,
    semester: [],
  });

  return { id: userRecord.uid, nama: row.nama, dibuatBaru: true };
}

// ============================================================================
// PROSES UTAMA
// ============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('ASSIGN DOSEN PA - SK 1814/EK/Polidewa/VII/2025');
  console.log('='.repeat(70));

  // --- Peringatan NIM duplikat di data sumber, ditampilkan di awal ---
  const hitungNim = {};
  DAFTAR_SK.forEach(r => { hitungNim[r.nim] = (hitungNim[r.nim] || 0) + 1; });
  const nimDuplikat = Object.keys(hitungNim).filter(nim => hitungNim[nim] > 1);
  if (nimDuplikat.length > 0) {
    console.log('\n⚠️  PERINGATAN: NIM berikut muncul lebih dari sekali di lampiran SK:');
    nimDuplikat.forEach(nim => {
      const namaList = DAFTAR_SK.filter(r => r.nim === nim).map(r => r.nama);
      console.log(`   - NIM ${nim}: ${namaList.join(' / ')} (baris terakhir yang akan berlaku)`);
    });
    console.log('   -> Ini kemungkinan salah ketik NIM di SK asli. Mohon dicek ke prodi.\n');
  }

  // --- 1. Pastikan semua dosen ada ---
  console.log('--- Memproses Dosen ---');
  const dosenMap = {}; // nama -> { id, nama, identitas, dibuatBaru }
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

  // --- 2. Proses tiap baris mahasiswa ---
  console.log('\n--- Memproses Mahasiswa & Assignment Dosen PA ---');
  const mahasiswaBaruDibuat = [];
  const berhasil = [];
  const gagal = [];

  for (const row of DAFTAR_SK) {
    try {
      const dosen = dosenMap[row.dosen];
      if (!dosen) {
        gagal.push({ ...row, alasan: `Nama dosen "${row.dosen}" tidak cocok dengan DAFTAR_DOSEN` });
        continue;
      }

      const mhs = await pastikanMahasiswaAda(row);
      if (mhs.dibuatBaru) {
        mahasiswaBaruDibuat.push({ nim: row.nim, nama: row.nama });
        console.log(`   ✅ Dibuat akun mahasiswa baru: ${row.nim} - ${row.nama}`);
      }

      await db.collection('users').doc(mhs.id).update({
        dosenPaId: dosen.id,
        dosenPaNama: dosen.nama,
        dosenPaNidn: dosen.identitas || null,
        updatedAt: new Date().toISOString(),
      });

      berhasil.push({ nim: row.nim, nama: row.nama, dosen: dosen.nama });
      console.log(`   ✓  ${row.nim} - ${row.nama}  ->  PA: ${dosen.nama}`);
    } catch (err) {
      console.error(`   ❌ Gagal proses NIM ${row.nim} (${row.nama}):`, err.message);
      gagal.push({ ...row, alasan: err.message });
    }
  }

  // --- Ringkasan akhir ---
  console.log('\n' + '='.repeat(70));
  console.log('RINGKASAN');
  console.log('='.repeat(70));
  console.log(`Total baris di SK       : ${DAFTAR_SK.length}`);
  console.log(`Berhasil di-assign      : ${berhasil.length}`);
  console.log(`Gagal                   : ${gagal.length}`);
  console.log(`Dosen baru dibuat       : ${dosenBaruDibuat.length}`);
  console.log(`Mahasiswa baru dibuat   : ${mahasiswaBaruDibuat.length}`);

  if (dosenBaruDibuat.length > 0) {
    console.log('\n📋 Akun DOSEN baru (sampaikan ke ybs untuk login & ganti password):');
    dosenBaruDibuat.forEach(d => {
      console.log(`   - ${d.nama} | email: ${buatEmailDosen(d.nama)} | password awal: ${PASSWORD_DOSEN_BARU}`);
    });
  }

  if (mahasiswaBaruDibuat.length > 0) {
    console.log('\n📋 Akun MAHASISWA baru (sampaikan ke ybs untuk login & ganti password):');
    mahasiswaBaruDibuat.forEach(m => {
      console.log(`   - ${m.nim} - ${m.nama} | email: ${m.nim}@polidewa.elk | password awal: ${buatPasswordMahasiswa(m.nim)}`);
    });
  }

  if (nimDuplikat.length > 0) {
    console.log('\n⚠️  PERLU DICEK MANUAL - NIM duplikat di lampiran SK (lihat peringatan di atas):');
    nimDuplikat.forEach(nim => console.log(`   - ${nim}`));
  }

  if (gagal.length > 0) {
    console.log('\n❌ GAGAL diproses:');
    gagal.forEach(g => console.log(`   - ${g.nim} - ${g.nama}: ${g.alasan}`));
  }

  console.log('\nSelesai.');
  process.exit(0);
}

main().catch(err => {
  console.error('Terjadi error fatal:', err);
  process.exit(1);
});
