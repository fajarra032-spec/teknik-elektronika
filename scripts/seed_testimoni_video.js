/**
 * scripts/seed_testimoni_video.js
 *
 * Sekali-jalan (opsional): mengisi koleksi Firestore `testimoniAlumni` dan
 * `videoKonten` dengan konten yang SEBELUMNYA hardcode di
 * views/landing/index.ejs, supaya section "Apa Kata Alumni?" dan "Video
 * Konten" di landing page tidak kosong begitu update ini di-deploy.
 *
 * Setelah dijalankan sekali, admin bisa kelola datanya lewat:
 *   - /admin/testimoni
 *   - /admin/video-konten
 *
 * Cara pakai (dari root project):
 *   node scripts/seed_testimoni_video.js
 *
 * Aman dijalankan berkali-kali? TIDAK - script ini akan menambah dokumen
 * baru setiap dijalankan. Jalankan HANYA SEKALI setelah deploy pertama.
 */

const { db } = require('../config/firebaseAdmin');

const testimoniSeed = [
  {
    nama: 'Nana',
    role: 'Bekerja di Dokter Finance',
    tahunLulus: '2020',
    testimoni: 'Pendidikan di Teknik Elektronika sangat aplikatif dan dosen-dosennya berpengalaman. Saya langsung siap kerja setelah lulus.',
    foto: 'https://i.ibb.co.com/6xf2WTj/Untitled-design.png',
    urutan: 1,
    aktif: true
  },
  {
    nama: 'Muhammad Dani',
    role: 'Engineer di PT. Sari Roti',
    tahunLulus: '2021',
    testimoni: 'Dosennya Intelektual dan sering ada pelatihan dari industri. Sangat membantu karir saya.',
    foto: 'https://i.ibb.co.com/6c2MJzg9/image.png',
    urutan: 2,
    aktif: true
  },
  {
    nama: 'Asmunandar',
    role: 'Wirausaha',
    tahunLulus: '2022',
    testimoni: 'Ilmu yang didapat sangat mendukung saya dalam memulai bisnis di bidang elektronik.',
    foto: 'https://i.ibb.co.com/4g3rv2ZQ/image.png',
    urutan: 3,
    aktif: true
  }
];

const videoSeed = [
  {
    judul: 'Testimoni Mahasiswa Elektronika',
    deskripsi: 'Ibnu Muarif Mahasiswa ELK-2023 bekerja di PT.GNI',
    videoUrl: '/videos/video1.mp4',
    urutan: 1,
    aktif: true
  },
  {
    judul: 'Kunjungan Industri',
    deskripsi: 'PT Charoend Phokphand Makassar',
    videoUrl: '/videos/video2.mp4',
    urutan: 2,
    aktif: true
  },
  {
    judul: 'Kunjungan Industri',
    deskripsi: 'PT. Darma Karya Elektrik Makassar',
    videoUrl: '/videos/video3.mp4',
    urutan: 3,
    aktif: true
  },
  {
    judul: 'Pengabdian Kepada Masyarakat 4',
    deskripsi: 'Program C4S-ELECTRO CARE di desa Cimpu Kec.Suli',
    videoUrl: '/videos/video4.mp4',
    urutan: 4,
    aktif: true
  }
];

async function seed() {
  console.log('Mengisi koleksi testimoniAlumni...');
  for (const item of testimoniSeed) {
    const ref = await db.collection('testimoniAlumni').add({
      ...item,
      createdAt: new Date().toISOString()
    });
    console.log(`  + ${item.nama} (${ref.id})`);
  }

  console.log('Mengisi koleksi videoKonten...');
  for (const item of videoSeed) {
    const ref = await db.collection('videoKonten').add({
      ...item,
      createdAt: new Date().toISOString()
    });
    console.log(`  + ${item.judul} (${ref.id})`);
  }

  console.log('Selesai. Kelola datanya di /admin/testimoni dan /admin/video-konten.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Gagal seeding:', err);
  process.exit(1);
});
