/**
 * scripts/sync-matakuliah-dari-rps.js
 *
 * Mengisi/menyamakan koleksi Firestore `mataKuliah` berdasarkan daftar
 * nama + kode mata kuliah yang tampil di halaman publik RPS
 * (routes/landing.js -> GET /dokumen/rps -> variabel `rpsSemester`,
 * dirender di views/landing/dokumen/rps.ejs).
 *
 * Kenapa perlu script terpisah (bukan langsung baca file routes/landing.js
 * saat runtime): data di sana didefinisikan LANGSUNG di dalam route
 * handler (bukan di-export sebagai modul terpisah), jadi tidak bisa
 * di-`require` begitu saja dari script ini. Data di bawah ini adalah
 * SALINAN dari `rpsSemester` di routes/landing.js per tanggal script ini
 * dibuat - KALAU daftar mata kuliah di halaman RPS itu diubah/ditambah
 * nanti, sesuaikan juga daftar `matkulDariRps` di bawah ini supaya tetap
 * sinkron.
 *
 * CATATAN KHUSUS "WUD2201-5": di halaman RPS, mata kuliah agama semester 1
 * ditulis sebagai SATU baris kode gabungan 'WUD2201-5' (untuk keperluan
 * tampilan saja - link ke 1 halaman PDF yang sama). Tapi itu BUKAN kode
 * mata kuliah yang sesungguhnya - di data akademik yang asli, agama punya
 * 5 KODE TERPISAH menurut agama masing-masing (lihat juga perbaikan yang
 * sama di helpers/paketKurikulumHelper.js). Jadi script ini otomatis
 * memecah 'WUD2201-5' jadi 5 mata kuliah asli: WUD2201-WUD2205.
 *
 * AMAN DIJALANKAN BERKALI-KALI: sebelum menambah, script ini selalu cek
 * dulu apakah `kode` sudah ada di database - kalau sudah ada, DILEWATI
 * (skip), TIDAK ditimpa dan TIDAK dibuat dobel.
 *
 * Cara pakai (dari root project, di server yang punya akses Firestore):
 *   node scripts/sync-matakuliah-dari-rps.js
 */

const { db } = require('../config/firebaseAdmin');

// ============================================================================
// SKS tiap mata kuliah - TIDAK ada di halaman RPS (halaman itu cuma
// menampilkan kode + nama + jenis), jadi dilengkapi manual di sini sesuai
// data kurikulum resmi. Kalau ada kode baru di halaman RPS yang belum
// masuk daftar SKS ini, script akan memberi peringatan & pakai SKS
// default (lihat SKS_DEFAULT_FALLBACK) supaya tetap bisa disimpan, tapi
// SEBAIKNYA dicek/dikoreksi manual dulu.
// ============================================================================
const SKS_MAP = {
  WUD2201: 2, WUD2202: 2, WUD2203: 2, WUD2204: 2, WUD2205: 2, // Pendidikan Agama (5 agama)
  WUD3208: 3, WUD3209: 3,
  PD3201: 3, PD3202: 3, PD3203: 3, PD3204: 3,
  WUD2206: 2,
  PD3205: 3, PD3206: 3, PD3207: 3, PD3208: 3, PD3209: 3, PD3210: 3,
  WUD2207: 2,
  PEK3201: 3, PEK3202: 3, PEK3203: 3, PEK3204: 3, PEK3205: 3, PEK3206: 3,
  PEK3207: 3, PEK3208: 3, PEK3209: 3, PEK3210: 3,
  WP2021: 20, WP2022: 20, WP2023: 20,
};
const SKS_DEFAULT_FALLBACK = 3;

// Nama resmi mata kuliah agama per agama (dipakai untuk memecah 'WUD2201-5')
const NAMA_AGAMA = {
  WUD2201: 'Pendidikan Agama Islam',
  WUD2202: 'Pendidikan Agama Kristen',
  WUD2203: 'Pendidikan Agama Katolik',
  WUD2204: 'Pendidikan Agama Hindu',
  WUD2205: 'Pendidikan Agama Budha',
};

// ============================================================================
// SALINAN daftar mata kuliah dari halaman RPS (routes/landing.js -> GET
// /dokumen/rps -> `rpsSemester`). Struktur sengaja dibuat sama persis
// (semester -> matkul[], atau semester -> varian[] -> matkul[] untuk
// semester yang beda paket per konsentrasi).
// ============================================================================
const rpsSemester = [
  {
    semester: 1,
    matkul: [
      { kode: 'WUD2201-5', nama: 'Pendidikan Agama', jenis: 'Wajib Umum' },
      { kode: 'WUD3208', nama: 'Bahasa Indonesia', jenis: 'Wajib Umum' },
      { kode: 'WUD3209', nama: 'Bahasa Inggris', jenis: 'Wajib Umum' },
      { kode: 'PD3201', nama: 'Etika Kerja', jenis: 'Penciri Dewantara' },
      { kode: 'PD3202', nama: 'Standardisasi', jenis: 'Penciri Dewantara' },
      { kode: 'PD3203', nama: 'Matematika Teknik', jenis: 'Penciri Dewantara' },
      { kode: 'PD3204', nama: 'Perangkat Lunak Aplikasi', jenis: 'Penciri Dewantara' },
    ],
  },
  {
    semester: 2,
    matkul: [
      { kode: 'WUD2206', nama: 'Pendidikan Kewarganegaraan', jenis: 'Wajib Umum' },
      { kode: 'PD3205', nama: 'Keselamatan dan Kesehatan Kerja (K3)', jenis: 'Penciri Dewantara' },
      { kode: 'PD3206', nama: 'Aplikasi Komputer', jenis: 'Penciri Dewantara' },
      { kode: 'PD3207', nama: 'Teknik Pengukuran', jenis: 'Penciri Dewantara' },
      { kode: 'PD3208', nama: 'Peralatan Teknik', jenis: 'Penciri Dewantara' },
      { kode: 'PD3209', nama: 'Menggambar Teknik', jenis: 'Penciri Dewantara' },
      { kode: 'PD3210', nama: 'Data dan Sistem Informasi', jenis: 'Penciri Dewantara' },
    ],
  },
  {
    semester: 3,
    varian: [
      {
        nama: 'Instrumentasi',
        matkul: [
          { kode: 'WUD2207', nama: 'Pendidikan Pancasila', jenis: 'Wajib Umum' },
          { kode: 'PEK3201', nama: 'Dasar Sistem Tenaga Listrik', jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
          { kode: 'PEK3202', nama: 'Elektronika Digital', jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
          { kode: 'PEK3203', nama: 'Mikrokontroler', jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
          { kode: 'PEK3204', nama: 'Rangkaian Elektronika', jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
          { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
          { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', jenis: 'Pilihan Teknik Elektronika (Instrumentasi)' },
        ],
      },
      {
        nama: 'Telekomunikasi',
        matkul: [
          { kode: 'WUD2207', nama: 'Pendidikan Pancasila', jenis: 'Wajib Umum' },
          { kode: 'PEK3207', nama: 'Komunikasi Data dan Jaringan', jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
          { kode: 'PEK3208', nama: 'Elektronika Digital', jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
          { kode: 'PEK3209', nama: 'Antena dan Propagasi', jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
          { kode: 'PEK3210', nama: 'Keamanan Siber', jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
          { kode: 'PEK3205', nama: 'Perawatan dan Perbaikan', jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
          { kode: 'PEK3206', nama: 'Programmable Logic Control (PLC)', jenis: 'Pilihan Teknik Elektronika (Telekomunikasi)' },
        ],
      },
    ],
  },
  {
    semester: 4,
    matkul: [{ kode: 'WP2021', nama: 'Praktik Dunia Kerja 1', jenis: 'Wajib Polidewa', isPDK: true, urutanPDK: 1 }],
  },
  {
    semester: 5,
    matkul: [{ kode: 'WP2022', nama: 'Praktik Dunia Kerja 2', jenis: 'Wajib Polidewa', isPDK: true, urutanPDK: 2 }],
  },
  {
    semester: 6,
    matkul: [{ kode: 'WP2023', nama: 'Praktik Dunia Kerja 3', jenis: 'Wajib Polidewa', isPDK: true, urutanPDK: 3 }],
  },
];

// ============================================================================
// Ratakan struktur di atas jadi 1 daftar flat siap-simpan, sekalian
// memecah kode gabungan 'WUD2201-5' jadi 5 kode agama asli.
// ============================================================================
function ratakanDaftarMatkul() {
  const hasil = [];
  const sudahDitambahkan = new Set(); // cegah dobel kalau 1 kode muncul di 2 varian (mis. WUD2207, PEK3205, PEK3206)

  for (const semesterEntry of rpsSemester) {
    const kelompokMatkul = semesterEntry.varian
      ? semesterEntry.varian.map(v => ({ matkul: v.matkul, konsentrasi: v.nama }))
      : [{ matkul: semesterEntry.matkul, konsentrasi: null }];

    for (const { matkul, konsentrasi } of kelompokMatkul) {
      for (const mk of matkul) {
        if (mk.kode === 'WUD2201-5') {
          // Pecah jadi 5 mata kuliah agama asli
          for (const kodeAgama of Object.keys(NAMA_AGAMA)) {
            if (sudahDitambahkan.has(kodeAgama)) continue;
            sudahDitambahkan.add(kodeAgama);
            hasil.push({
              kode: kodeAgama,
              nama: NAMA_AGAMA[kodeAgama],
              jenis: mk.jenis,
              semester: semesterEntry.semester,
              sks: SKS_MAP[kodeAgama],
            });
          }
          continue;
        }

        if (sudahDitambahkan.has(mk.kode)) continue; // sudah ditambahkan dari varian lain
        sudahDitambahkan.add(mk.kode);

        const entry = {
          kode: mk.kode,
          nama: mk.nama,
          jenis: mk.jenis,
          semester: semesterEntry.semester,
          sks: SKS_MAP[mk.kode] !== undefined ? SKS_MAP[mk.kode] : SKS_DEFAULT_FALLBACK,
        };
        if (mk.isPDK) { entry.isPDK = true; entry.urutanPDK = mk.urutanPDK; }
        hasil.push(entry);
      }
    }
  }

  return hasil;
}

// ============================================================================
// PROSES
// ============================================================================
async function sync() {
  const daftarMatkul = ratakanDaftarMatkul();
  console.log(`Memulai sinkronisasi ${daftarMatkul.length} mata kuliah dari data RPS...\n`);

  let ditambahkan = 0;
  let dilewati = 0;
  let gagal = 0;
  const peringatanSks = [];

  for (const mk of daftarMatkul) {
    try {
      if (SKS_MAP[mk.kode] === undefined && !NAMA_AGAMA[mk.kode]) {
        peringatanSks.push(`${mk.kode} - ${mk.nama} (pakai SKS default ${SKS_DEFAULT_FALLBACK}, cek manual)`);
      }

      const existing = await db.collection('mataKuliah').where('kode', '==', mk.kode).get();
      if (!existing.empty) {
        console.log(`⏭  Lewati (sudah ada): ${mk.kode} - ${mk.nama}`);
        dilewati++;
        continue;
      }

      await db.collection('mataKuliah').add({
        kode: mk.kode,
        nama: mk.nama,
        sks: mk.sks,
        semester: mk.semester,
        jenis: mk.jenis,
        ...(mk.isPDK ? { isPDK: true, urutanPDK: mk.urutanPDK } : {}),
        createdAt: new Date().toISOString(),
      });
      console.log(`✅ Ditambahkan: ${mk.kode} - ${mk.nama} (Semester ${mk.semester}, ${mk.sks} SKS)`);
      ditambahkan++;
    } catch (error) {
      console.error(`❌ Gagal: ${mk.kode} - ${mk.nama}: ${error.message}`);
      gagal++;
    }
  }

  console.log('\n=== RINGKASAN ===');
  console.log(`Ditambahkan : ${ditambahkan}`);
  console.log(`Dilewati (sudah ada) : ${dilewati}`);
  console.log(`Gagal : ${gagal}`);
  if (peringatanSks.length > 0) {
    console.log('\n⚠️  Kode berikut belum ada di SKS_MAP, dicek manual setelah ini:');
    peringatanSks.forEach(p => console.log(' - ' + p));
  }

  process.exit(gagal > 0 ? 1 : 0);
}

sync();
