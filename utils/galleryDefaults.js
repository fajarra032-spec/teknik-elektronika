// ==================== GALERI: DATA DEFAULT (FALLBACK) ====================
// Dipakai kalau koleksi Firestore "gallery" masih kosong (belum ada admin yang
// menambah foto), supaya halaman utama tetap tampil menarik dari awal alih-alih
// kosong melompong. Begitu admin menambah item lewat /admin/gallery, data dari
// Firestore yang dipakai, bukan lagi array ini.
const DEFAULT_GALLERY = [
  {
    id: 'default-1',
    mediaType: 'foto',
    mediaUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c7f1?w=800&q=80',
    caption: '📸 Kelas Interaktif',
    altText: 'Siswa belajar kelompok',
    featured: true,
    order: 1
  },
  {
    id: 'default-2',
    mediaType: 'video',
    mediaUrl: 'https://cdn.coverr.co/videos/coverr-students-working-on-laptops-in-a-library-1583790571991/1080p.mp4',
    caption: '🎬 Belajar Digital',
    altText: 'Siswa belajar dengan laptop',
    featured: false,
    order: 2
  },
  {
    id: 'default-3',
    mediaType: 'foto',
    mediaUrl: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&q=80',
    caption: '💬 Diskusi Seru',
    altText: 'Diskusi kelas',
    featured: false,
    order: 3
  },
  {
    id: 'default-4',
    mediaType: 'foto',
    mediaUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&q=80',
    caption: '📖 Fokus Belajar',
    altText: 'Siswa fokus belajar',
    featured: false,
    order: 4
  },
  {
    id: 'default-5',
    mediaType: 'foto',
    mediaUrl: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600&q=80',
    caption: '🤝 Bimbingan Tutor',
    altText: 'Interaksi tutor',
    featured: false,
    order: 5
  },
  {
    id: 'default-6',
    mediaType: 'video',
    mediaUrl: 'https://cdn.coverr.co/videos/coverr-students-walking-in-a-university-hallway-1587416971678/1080p.mp4',
    caption: '🏫 Suasana Kampus',
    altText: 'Suasana kampus',
    featured: false,
    order: 6
  }
];

module.exports = { DEFAULT_GALLERY };
