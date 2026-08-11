/**
 * scripts/seed-matakuliah-2026.js
 *
 * Mengisi koleksi Firestore `mataKuliah` dengan 32 mata kuliah kurikulum
 * resmi Program Studi Teknik Elektronika (data diberikan langsung oleh
 * admin, BUKAN dari kode di file Excel KHS/Transkrip lama).
 *
 * AMAN DIJALANKAN BERKALI-KALI: sebelum menambah, script ini selalu cek
 * dulu apakah `kode` sudah ada di database - kalau sudah ada, dilewati
 * (skip), TIDAK ditimpa dan TIDAK dibuat dobel. Jadi kalau baru sebagian
 * yang berhasil (mis. koneksi putus di tengah), tinggal jalankan ulang
 * dari awal, aman.
 *
 * Cara pakai (dari root project, di server yang punya akses Firestore):
 *   node scripts/seed-matakuliah-2026.js
 *
 * Setelah ini selesai, mata kuliah baru bisa langsung dilihat/diedit satu
 * per satu lewat menu admin -> Mata Kuliah (halaman itu sendiri sudah
 * punya cek duplikat kode bawaan untuk penambahan manual berikutnya).
 */

const { db } = require('../config/firebaseAdmin');

// ============================================================================
// DATA 32 MATA KULIAH (kode, nama, sks, semester, jenis)
// ============================================================================
const matkulSeed = [
  // --- Semester 1 ---
  { kode: 'WUD2201', nama: 'Pendidikan Agama Islam', sks: 2, semester: 1, jenis: 'Wajib Umum' },
  { kode: 'WUD2202', nama: 'Pendidikan Agama Kristen', sks: 2, semester: 1, jenis: 'Wajib Umum' },
  { kode: 'WUD2203', nama: 'Pendidikan Agama Katolik', sks: 2, semester: 1, jenis: 'Wajib Umum' },
  { kode: 'WUD2204', nama: 'Pendidikan Agama Hindu', sks: 2, semester: 1, jenis: 'Wajib Umum' },
  { kode: 'WUD2205', nama: 'Pendidikan Agama Budha', sks: 2, semester: 1, jenis: 'Wajib Umum' },
  { kode: 'WUD3208', nama: 'Bahasa Indonesia', sks: 3, semester: 1, jenis: 'Wajib Umum' },
  { kode: 'WUD3209', nama: 'Bahasa Inggris', sks: 3, semester: 1, jenis: 'Wajib Umum' },
  { kode: 'PD3201', nama: 'Etika Kerja', sks: 3, semester: 1, jenis: 'Penciri Dewantara' },
  { kode: 'PD3202', nama: 'Standardisasi', sks: 3, semester: 1, jenis: 'Penciri Dewantara' },
  { kode: 'PD3203', nama: 'Matematika Teknik', sks: 3, semester: 1, jenis: 'Penciri Dewantara' },
  { kode: 'PD3204', nama: 'Perangkat Lunak Aplikasi', sks: 3, semester: 1, jenis: 'Penciri Dewantara' },

  // --- Semester 2 ---
  { kode: 'WUD2206', nama: 'Pendidikan Kewarganegaraan', sks: 2, semester: 2, jenis: 'Wajib Umum' },
  { kode: 'PD3205', nama: 'Keselamatan dan Kesehatan Kerja (K3)', sks: 3, semester: 2, jenis: 'Penciri Dewantara' },
  { kode: 'PD3206', nama: 'Aplikasi Komputer', sks: 3, semester: 2, jenis: 'Penciri Dewantara' },
  { kode: 'PD3207', nama: 'Teknik Pengukuran', sks: 3, semester: 2, jenis: 'Penciri Dewantara' },
  { kode: 'PD3208', nama: 'Peralatan Teknik', sks: 3, semester: 2, jenis: 'Penciri Dewantara' },
  { kode: 'PD3209', nama: 'Menggambar Teknik', sks: 3, semester: 2, jenis: 'Penciri Dewantara' },
  { kode: 'PD3210', nama: 'Data dan Sistem Informasi', sks: 3, semester: 2, jenis: 'Penciri Dewantara' },

  // --- Semester 3 ---
  { kode: 'WUD2207', nama: 'Pendidikan Pancasila', sks: 2, semester: 3, jenis: 'Wajib Umum' },
  // Konsentrasi Instrumentasi
  { kode: 'PEK3201', nama: 'Dasar Sistem Tenaga Listrik', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
  { kode: 'PEK3202', nama: 'Elektronika Digital', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
  { kode: 'PEK3203', nama: 'Mikrokontroler', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
  { kode: 'PEK3204', nama: 'Rangkaian Elektronika', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
  { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
  { kode: 'PEK3206', nama: 'Programable Logic Control (PLC)', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
  // Konsentrasi Telekomunikasi (catatan: PEK3208 sengaja bernama sama
  // dengan PEK3202 "Elektronika Digital" - dikonfirmasi admin, ini bukan
  // duplikat data melainkan mata kuliah terpisah untuk konsentrasi Telkom)
  { kode: 'PEK3207', nama: 'Komunikasi Data dan Jaringan', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
  { kode: 'PEK3208', nama: 'Elektronika Digital', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
  { kode: 'PEK3209', nama: 'Antena dan Propagasi', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
  { kode: 'PEK3210', nama: 'Keamanan Siber', sks: 3, semester: 3, jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },

  // --- Semester 4-6: Praktik Dunia Kerja (PKL) ---
  // urutanPDK dibutuhkan oleh routes/admin/emagang.js (sudah ada sebelum
  // saya sentuh) untuk menyusun urutan PDK 1/2/3 mahasiswa.
  { kode: 'WP2021', nama: 'Praktik Dunia Kerja 1', sks: 20, semester: 4, jenis: 'Wajib Polidewa', isPDK: true, urutanPDK: 1 },
  { kode: 'WP2022', nama: 'Praktik Dunia Kerja 2', sks: 20, semester: 5, jenis: 'Wajib Polidewa', isPDK: true, urutanPDK: 2 },
  { kode: 'WP2023', nama: 'Praktik Dunia Kerja 3', sks: 20, semester: 6, jenis: 'Wajib Polidewa', isPDK: true, urutanPDK: 3 }
];

// ============================================================================
// PROSES SEED
// ============================================================================
async function seedMataKuliah() {
  console.log(`Memulai seed ${matkulSeed.length} mata kuliah...\n`);

  let ditambahkan = 0;
  let dilewati = 0;
  let gagal = 0;

  for (const mk of matkulSeed) {
    try {
      const existing = await db.collection('mataKuliah').where('kode', '==', mk.kode).get();
      if (!existing.empty) {
        console.log(`⏭️  Lewati (sudah ada): ${mk.kode} - ${mk.nama}`);
        dilewati++;
        continue;
      }

      const materi = Array.from({ length: 16 }, (_, i) => ({ pertemuan: i + 1, topik: '' }));

      await db.collection('mataKuliah').add({
        kode: mk.kode,
        nama: mk.nama,
        sks: mk.sks,
        semester: mk.semester,
        jenis: mk.jenis,
        isPDK: mk.isPDK || false,
        dosenIds: [],
        jadwal: '',
        materi,
        createdAt: new Date().toISOString()
      });

      console.log(`✅ Ditambahkan: ${mk.kode} - ${mk.nama} (${mk.sks} SKS, Semester ${mk.semester})`);
      ditambahkan++;
    } catch (error) {
      console.error(`❌ Gagal menambahkan ${mk.kode} - ${mk.nama}:`, error.message);
      gagal++;
    }
  }

  console.log('\n=== SELESAI ===');
  console.log(`Ditambahkan : ${ditambahkan}`);
  console.log(`Dilewati    : ${dilewati} (kode sudah ada sebelumnya)`);
  console.log(`Gagal       : ${gagal}`);
  console.log(`Total data  : ${matkulSeed.length}`);

  process.exit(gagal > 0 ? 1 : 0);
}

seedMataKuliah().catch(err => {
  console.error('Gagal menjalankan seed:', err);
  process.exit(1);
});
