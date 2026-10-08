/**
 * data/jadwalBebanDosen.js
 *
 * SUMBER KEBENARAN beban mengajar dosen per semester, ditranskrip dari 3
 * dokumen jadwal resmi yang dikirim admin:
 *   [A] New_JADWAL_PERKULIAHAN_SEMESTER_GANJIL_ELEKTRONIKA_2025-2026.pdf
 *   [B] 1__JADWAL_PERKULIAHAN_SEMESTER_GENAP_ELEKTRONIKA_2025-2026.docx
 *   [C] JADWAL_PERKULIAHAN_SEMESTER_GANJIL_ELEKTRONIKA_2026-2027 (2).docx
 *
 * UNIT = SESI MENGAJAR (bukan dokumen MK per kelas). Satu sesi gabungan
 * kelas (mis. "Bahasa Indonesia - Gabungan Kelas A & B") hanya SATU baris,
 * jadi SKS dosen dihitung SEKALI. Kelas paralel yang jadwalnya terpisah
 * (mis. Standardisasi ELK1A hari Rabu dan ELK1B hari Senin) adalah DUA sesi.
 * Kelas online selalu sesi tersendiri.
 *
 * `sks` = angka yang tercetak di dokumen jadwal. Di dokumen [C] angkanya
 * bertanda bintang (mis. "2*"); untuk 4 MK semester 1 angka di dokumen (2)
 * berbeda dari SKS kurikulum di seed (3) - lihat `sksKurikulum`. Script
 * sinkron memilih salah satunya lewat --sks=jadwal (default) atau
 * --sks=kurikulum.
 */

// ---------------------------------------------------------------------------
// SKS kurikulum resmi (scripts/seed-matakuliah-2026.js)
// ---------------------------------------------------------------------------
const SKS_KURIKULUM = {
  'WUD2201': 2, 'WUD2202-5': 2, 'WUD3208': 3, 'WUD3209': 3, 'PD3201': 3, 'PD3202': 3, 'PD3203': 3, 'PD3204': 3,
  'WUD2206': 2, 'PD3205': 3, 'PD3206': 3, 'PD3207': 3, 'PD3208': 3, 'PD3209': 3, 'PD3210': 3,
  'WUD2207': 2, 'PEK3201': 3, 'PEK3202': 3, 'PEK3203': 3, 'PEK3204': 3, 'PEK3205': 3, 'PEK3206': 3
};

// ---------------------------------------------------------------------------
// DOSEN (nama kanonik). Dicocokkan ke koleksi `dosen` lewat kunciNama().
// ---------------------------------------------------------------------------
const D = {
  ARIANI: 'Ariani Amri, S.Pd., M.Pd',
  ELMA: 'Elma, S.Pd., M.Pd.',
  ISLAH: 'Islah Audziah Putri Beang, S.Mat., M.Mat.',
  RAHMAN: 'Rahman Syam, S.Pd., M.Si',
  NURAQIDAH: 'Nur Aqidah, S.P., M.P.',
  EHLISA: 'Ehlisa Rahmat, S.Ak., M.Pd.',
  SUARDI: 'Suardi, S.Pd., M.Pd',
  BASO: 'Baso Amir, S.P., M.Sc.',
  NABILA: 'Nabila Febriyanti, S.Pd., M.Pd.',
  FITRA: 'Muh. Fitra Nur Asri, S.Kom., M.Kom',
  FAJAR: 'Fajar Ramadhan, S.Pd., M.T',
  GUNAWAN: 'Gunawan Tari, S.T., M.T',
  MIFTAHUL: 'Miftahul Hairia, S.Pd., M.Pd',
  HALUDDIN: 'Dr. Haluddin, S.Pd., M.Pd.',
  TENRI: 'Tenri Ampareng, S.Pd., M.Pd.',
  MUSLIM: 'Muslim Andi Yusuf, S.H., M.H.',
  YUSHAN: 'Dr. A.Muh. Yushan Patawari, S.Pi., M.Si',
  RISMAWATI: 'Rismawati, S.Pd., M.Pd.',
  FARHAN: 'Farhan Yustisio, S.Psi., M.Psi',
  ESRON: 'Esron, S.Pd., M.Pd',
  CHALIK: 'Chalik Mawardi, S.P., M.Si.',
  NURAFIFAH: 'Nur Afifah Rustan, S.Pd., M.Pd.',
  SARIFUDDIN: 'Sarifuddin Ihsan Al Alim, S.Pd., M.Pd.',
  SALAHUDDIN: 'Drs. Salahuddin Abadi AS, M.Si',
  IRHAMNI: 'Ir. Irhamni Nuhardin, S.T., M.T., IPP.',
  RAMLAN: 'Ramlan, S.Kom., M.Si.'
};

/**
 * Penulisan di dokumen yang berbeda dari nama kanonik -> dianggap ORANG YANG
 * SAMA. Dicetak oleh script saat dry-run supaya admin bisa memeriksa.
 */
const ALIAS_DI_DOKUMEN = [
  { tertulis: 'Miiftahul Hairia, S.Pd., M.Pd', dok: 'A', jadiNama: D.MIFTAHUL, alasan: 'salah ketik "Miiftahul"' },
  { tertulis: 'Ehlisa, S.Ak., M.Pd.', dok: 'A', jadiNama: D.EHLISA, alasan: 'di kelas reguler hanya "Ehlisa", di kelas online "Ehlisa Rahmat"' },
  { tertulis: 'Fajar Ramadhan, S.Pd., M.Pd. / M.T..', dok: 'A', jadiNama: D.FAJAR, alasan: 'gelar tertulis M.Pd. di jadwal lab 3A; sistem memakai M.T' },
  { tertulis: 'Erson, S.Pd., M.Pd.', dok: 'C', jadiNama: D.ESRON, alasan: 'salah ketik "Erson" di kelas online' },
  { tertulis: 'Pak Gunawan', dok: 'C', jadiNama: D.GUNAWAN, alasan: 'PAK kelas online; satu-satunya Gunawan di jadwal' }
];

// ---------------------------------------------------------------------------
// PERIODE
// ---------------------------------------------------------------------------
const P_GJ_2526 = 'ganjil-2025-2026';
const P_GN_2526 = 'genap-2025-2026';
const P_GJ_2627 = 'ganjil-2026-2027';

const SUMBER = {
  [P_GJ_2526]: 'New_JADWAL_PERKULIAHAN_SEMESTER_GANJIL_ELEKTRONIKA_2025-2026.pdf',
  [P_GN_2526]: '1__JADWAL_PERKULIAHAN_SEMESTER_GENAP_ELEKTRONIKA_2025-2026.docx',
  [P_GJ_2627]: 'JADWAL_PERKULIAHAN_SEMESTER_GANJIL_ELEKTRONIKA_2026-2027 (2).docx'
};

// ---------------------------------------------------------------------------
// SESI MENGAJAR
// [periode, kelas (label), semesterKurikulum, kodeMk, namaMk, sksDokumen, [dosen], keterangan]
// kelas: array bila sesi gabungan beberapa kelas.
// ---------------------------------------------------------------------------
const R = [
  // ===================== [A] GANJIL 2025/2026 =====================
  // --- Kelas 1A (semester 1) ---
  [P_GJ_2526, ['1A'], 1, 'PD3202', 'Standardisasi', 3, [D.ARIANI, D.ELMA], 'Senin 11.30-12.30 K102'],
  [P_GJ_2526, ['1A'], 1, 'PD3203', 'Matematika Teknik', 3, [D.ISLAH, D.RAHMAN], 'Senin 13.30-14.30 K102'],
  [P_GJ_2526, ['1A'], 1, 'WUD3208', 'Bahasa Indonesia', 3, [D.NURAQIDAH, D.EHLISA], 'Selasa 11.30-12.30 Ruang Kaca'],
  [P_GJ_2526, ['1A'], 1, 'PD3201', 'Etika Kerja', 3, [D.SUARDI, D.BASO], 'Selasa 16.30-17.30 K103'],
  [P_GJ_2526, ['1A'], 1, 'WUD3209', 'Bahasa Inggris', 3, [D.SUARDI], 'Kamis 13.30-14.30 K101'],
  [P_GJ_2526, ['1A'], 1, 'WUD2201', 'PAI', 2, [D.RAHMAN], 'Sabtu 13.30-14.30 K103 (Gab 4)'],
  [P_GJ_2526, ['1A'], 1, 'PD3204', 'Perangkat Lunak Aplikasi', 3, [D.NABILA, D.FITRA], 'Lab: 15-18 Oktober 2025, LAB 1'],
  // --- Kelas Online semester 1 ---
  [P_GJ_2526, ['Online 1'], 1, 'PD3202', 'Standardisasi', 3, [D.FAJAR], 'Sabtu 08.30-09.30'],
  [P_GJ_2526, ['Online 1'], 1, 'PD3203', 'Matematika Teknik', 3, [D.ISLAH], 'Sabtu 09.30-10.30'],
  [P_GJ_2526, ['Online 1'], 1, 'WUD2201', 'PAI', 2, [D.RAHMAN], 'Sabtu 10.30-11.30'],
  [P_GJ_2526, ['Online 1'], 1, 'WUD3208', 'Bahasa Indonesia', 3, [D.NURAQIDAH], 'Minggu 08.30-09.30'],
  [P_GJ_2526, ['Online 1'], 1, 'PD3201', 'Etika Kerja', 3, [D.BASO], 'Minggu 09.30-10.30'],
  [P_GJ_2526, ['Online 1'], 1, 'WUD3209', 'Bahasa Inggris', 3, [D.TENRI], 'Minggu 10.30-11.30'],
  [P_GJ_2526, ['Online 1'], 1, 'PD3204', 'Perangkat Lunak Aplikasi', 3, [D.EHLISA], 'Minggu 13.30-14.30'],
  // --- Kelas 3A (semester 3) ---
  [P_GJ_2526, ['3A'], 3, 'PEK3201', 'DSTL', 3, [D.GUNAWAN, D.ARIANI], 'Senin 14.30-15.30 K101'],
  [P_GJ_2526, ['3A'], 3, 'PEK3204', 'Rangkaian Elektronika', 3, [D.ELMA], 'Senin 15.30-16.30 K102'],
  [P_GJ_2526, ['3A'], 3, 'WUD2207', 'Pancasila', 2, [D.HALUDDIN], 'Rabu 10.30-11.30 K103 (Gab 3)'],
  [P_GJ_2526, ['3A'], 3, 'PEK3205', 'Perawatan dan Perbaikan', 3, [D.MIFTAHUL, D.GUNAWAN], 'Kamis 11.30-12.30 K101'],
  [P_GJ_2526, ['3A'], 3, 'PEK3203', 'Mikrokontroler', 3, [D.GUNAWAN, D.FAJAR], 'Lab: 03-06 Desember 2025, LAB 2'],
  [P_GJ_2526, ['3A'], 3, 'PEK3206', 'PLC', 3, [D.MIFTAHUL, D.FAJAR], 'Lab: 08-11 Desember 2025, LAB 2'],
  [P_GJ_2526, ['3A'], 3, 'PEK3202', 'Elektronika Digital', 3, [D.FAJAR, D.RAHMAN], 'Lab: 17-20 Desember 2025, LAB 1'],
  // --- Kelas Online semester 3 ---
  [P_GJ_2526, ['Online 3'], 3, 'PEK3201', 'DSTL', 3, [D.ARIANI], 'Sabtu 08.30-09.30'],
  [P_GJ_2526, ['Online 3'], 3, 'PEK3204', 'Rangkaian Elektronika', 3, [D.ELMA], 'Sabtu 09.30-10.30'],
  [P_GJ_2526, ['Online 3'], 3, 'WUD2207', 'Pancasila', 2, [D.MUSLIM], 'Sabtu 10.30-11.30'],
  [P_GJ_2526, ['Online 3'], 3, 'PEK3205', 'Perawatan dan Perbaikan', 3, [D.MIFTAHUL], 'Minggu 08.30-09.30'],
  [P_GJ_2526, ['Online 3'], 3, 'PEK3203', 'Mikrokontroler', 3, [D.GUNAWAN], 'Minggu 09.30-10.30'],
  [P_GJ_2526, ['Online 3'], 3, 'PEK3206', 'PLC', 3, [D.FAJAR], 'Minggu 10.30-11.30'],
  [P_GJ_2526, ['Online 3'], 3, 'PEK3202', 'Elektronika Digital', 3, [D.RAHMAN], 'Minggu 13.30-14.30'],

  // ===================== [B] GENAP 2025/2026 =====================
  // --- Kelas 2A ---
  [P_GN_2526, ['2A'], 2, 'WUD2206', 'PKN', 2, [D.MUSLIM], 'Senin 08.30-09.30 AULA'],
  [P_GN_2526, ['2A'], 2, 'PD3208', 'Peralatan Teknik', 3, [D.ARIANI], 'Senin 11.30-12.30 K102'],
  [P_GN_2526, ['2A'], 2, 'PD3207', 'Teknik Pengukuran', 3, [D.RAHMAN], 'Selasa 15.30-16.30 K102'],
  [P_GN_2526, ['2A'], 2, 'PD3209', 'Gambar Teknik', 3, [D.MIFTAHUL, D.GUNAWAN], 'Rabu 09.30-10.30 K202'],
  [P_GN_2526, ['2A'], 2, 'PD3205', 'K3', 3, [D.MIFTAHUL, D.FAJAR], 'Rabu 10.30-11.30 K202'],
  [P_GN_2526, ['2A'], 2, 'PD3206', 'Aplikasi Komputer', 3, [D.MIFTAHUL, D.GUNAWAN], 'Kamis 07.30-09.30 L102'],
  [P_GN_2526, ['2A'], 2, 'PD3210', 'DSI', 3, [D.FAJAR], 'Kamis 15.30-17.30 L101'],
  // --- Kelas 2 Online ---
  [P_GN_2526, ['Online 2'], 2, 'WUD2206', 'PKN', 2, [D.YUSHAN], 'Sabtu 07.30-08.30'],
  [P_GN_2526, ['Online 2'], 2, 'PD3209', 'Gambar Teknik', 3, [D.GUNAWAN], 'Sabtu 08.30-09.30'],
  [P_GN_2526, ['Online 2'], 2, 'PD3205', 'K3', 3, [D.MIFTAHUL], 'Sabtu 09.30-10.30'],
  [P_GN_2526, ['Online 2'], 2, 'PD3208', 'Peralatan Teknik', 3, [D.FAJAR], 'Sabtu 10.30-11.30'],
  [P_GN_2526, ['Online 2'], 2, 'PD3210', 'DSI', 3, [D.FAJAR], 'Minggu 07.30-08.30'],
  [P_GN_2526, ['Online 2'], 2, 'PD3206', 'Aplikasi Komputer', 3, [D.MIFTAHUL], 'Minggu 08.30-09.30'],
  [P_GN_2526, ['Online 2'], 2, 'PD3207', 'Teknik Pengukuran', 3, [D.RAHMAN], 'Minggu 09.30-10.30'],

  // ===================== [C] GANJIL 2026/2027 =====================
  // --- Semester 1: ELK1A, ELK1B (reguler), ELK1ON (online) ---
  [P_GJ_2627, ['ELK1A', 'ELK1B'], 1, 'WUD3208', 'Bahasa Indonesia', 2, [D.RISMAWATI], 'Senin 09.30-10.30 K102 (Gabungan Kelas A & B)'],
  [P_GJ_2627, ['ELK1A'], 1, 'PD3202', 'Standardisasi', 2, [D.ARIANI, D.FAJAR], 'Rabu 08.30-09.30 K303'],
  [P_GJ_2627, ['ELK1B'], 1, 'PD3202', 'Standardisasi', 2, [D.ARIANI, D.FAJAR], 'Senin 14.30-15.30 K202'],
  [P_GJ_2627, ['ELK1A', 'ELK1B'], 1, 'PD3201', 'Etika Kerja', 2, [D.FARHAN], 'Kamis 11.30-12.30 K103 (Gabungan Kelas A & B)'],
  [P_GJ_2627, ['ELK1A'], 1, 'PD3204', 'Perangkat Lunak Aplikasi', 3, [D.ARIANI, D.GUNAWAN], 'Kamis 16.30-17.30 LAB 2'],
  [P_GJ_2627, ['ELK1B'], 1, 'PD3204', 'Perangkat Lunak Aplikasi', 3, [D.ARIANI, D.GUNAWAN], 'Rabu 09.30-10.30 LAB 1'],
  [P_GJ_2627, ['ELK1A', 'ELK1B'], 1, 'WUD3209', 'Bahasa Inggris', 2, [D.SUARDI], 'Jumat 10.45-11.45 K103 (Gabungan Kelas A & B)'],
  [P_GJ_2627, ['ELK1A', 'ELK1B'], 1, 'WUD2202-5', 'Pendidikan Agama Kristen dan Agama Lain', 2, [D.GUNAWAN], 'Jumat 11.45-13.30 K202 (Gabungan Kelas A & B)'],
  [P_GJ_2627, ['ELK1A', 'ELK1B'], 1, 'WUD2201', 'Pendidikan Agama Islam', 2, [D.ESRON], 'Jumat 16.00-17.00 AULA LT 4 (Gabungan Kelas A & B, dan ARS 1.1)'],
  [P_GJ_2627, ['ELK1A'], 1, 'PD3203', 'Matematika Teknik', 3, [D.RAHMAN], 'Sabtu 14.30-15.30 K201'],
  [P_GJ_2627, ['ELK1B'], 1, 'PD3203', 'Matematika Teknik', 3, [D.RAHMAN], 'Sabtu 15.30-16.30 K201'],
  // --- Semester 3: ELK3A ---
  [P_GJ_2627, ['ELK3A'], 3, 'WUD2207', 'Pendidikan Pancasila', 2, [D.CHALIK], 'Senin 07.30-08.30 AULA LT 4 (Gabungan ELK 3A, SPL 3A, SPL 3B, SPL 3C)'],
  [P_GJ_2627, ['ELK3A'], 3, 'PEK3201', 'DSTL', 3, [D.ARIANI], 'Senin 10.30-11.30 K302'],
  [P_GJ_2627, ['ELK3A'], 3, 'PEK3205', 'Perawatan dan Perbaikan', 3, [D.MIFTAHUL, D.GUNAWAN], 'Senin 11.30-12.30 K302'],
  [P_GJ_2627, ['ELK3A'], 3, 'PEK3202', 'Elektronika Digital', 3, [D.RAHMAN], 'Kamis 09.30-10.30 LAB 3'],
  [P_GJ_2627, ['ELK3A'], 3, 'PEK3203', 'Mikrokontroler', 3, [D.FAJAR], 'Kamis 10.30-11.30 LAB 3'],
  [P_GJ_2627, ['ELK3A'], 3, 'PEK3204', 'Rangkaian Elektronika', 3, [D.MIFTAHUL], 'Jumat 08.45-09.45 K201'],
  [P_GJ_2627, ['ELK3A'], 3, 'PEK3206', 'PLC', 3, [D.FAJAR], 'Jumat 09.45-10.45 LAB 2'],
  // --- Semester 1 Online: ELK1ON (jadwal fleksibel) ---
  [P_GJ_2627, ['ELK1ON'], 1, 'PD3203', 'Matematika Teknik', 3, [], 'Fleksibel - DOSEN BELUM DITETAPKAN ("-" di dokumen)'],
  [P_GJ_2627, ['ELK1ON'], 1, 'WUD3209', 'Bahasa Inggris', 2, [D.NURAFIFAH], 'Fleksibel'],
  [P_GJ_2627, ['ELK1ON'], 1, 'WUD3208', 'Bahasa Indonesia', 2, [D.SARIFUDDIN], 'Fleksibel'],
  [P_GJ_2627, ['ELK1ON'], 1, 'WUD2201', 'Pendidikan Agama Islam', 2, [D.ESRON], 'Fleksibel'],
  [P_GJ_2627, ['ELK1ON'], 1, 'WUD2202-5', 'Pendidikan Agama Kristen dan Agama Lain', 2, [D.GUNAWAN], 'Fleksibel'],
  [P_GJ_2627, ['ELK1ON'], 1, 'PD3201', 'Etika Kerja', 2, [D.SALAHUDDIN], 'Fleksibel'],
  [P_GJ_2627, ['ELK1ON'], 1, 'PD3202', 'Standardisasi', 2, [D.IRHAMNI], 'Fleksibel'],
  [P_GJ_2627, ['ELK1ON'], 1, 'PD3204', 'Perangkat Lunak Aplikasi', 3, [D.RAMLAN], 'Fleksibel']
];

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const SESI = R.map(([periodeId, kelas, semesterKurikulum, kodeMk, namaMk, sksDokumen, dosen, keterangan]) => ({
  id: `${periodeId}__${slug(kelas.join('+'))}__${slug(kodeMk)}`,
  periodeId,
  kelas,
  gabungan: kelas.length > 1,
  semesterKurikulum,
  kodeMk,
  namaMk,
  sksDokumen,
  sksKurikulum: SKS_KURIKULUM[kodeMk] !== undefined ? SKS_KURIKULUM[kodeMk] : null,
  dosen,
  keterangan,
  sumber: SUMBER[periodeId]
}));

const { kunciNama } = require('../helpers/namaDosen');

module.exports = { SESI, DOSEN: D, ALIAS_DI_DOKUMEN, SUMBER, SKS_KURIKULUM, kunciNama, PERIODE_IDS: [P_GJ_2526, P_GN_2526, P_GJ_2627] };
