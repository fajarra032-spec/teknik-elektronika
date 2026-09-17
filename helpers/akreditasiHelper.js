// helpers/akreditasiHelper.js
//
// Modul pendukung Akreditasi Program Studi, mengikuti struktur RESMI LAM
// Teknik - LKPS Perpanjangan AVP 2025 (7 kriteria I-VII + 20 indikator
// 1.0-20.0 di bawahnya, lihat DEFAULT_KRITERIA/DEFAULT_INDIKATOR di bawah).
// Dipakai bersama oleh routes/admin/akreditasi.js dan
// routes/dosen/akreditasiRoute.js supaya logika folder Google Drive &
// progres tidak dobel ditulis di kedua tempat.

const { db } = require('../config/firebaseAdmin');
const drive = require('../config/googleDrive');
const { Readable } = require('stream');

// Folder root Google Drive yang sama dipakai fitur lain (sertifikat, SPMP)
// di aplikasi ini - lihat routes/admin/sertifikat.js & routes/dosen/spmp.js
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

/**
 * Struktur kriteria & indikator berikut diambil dari instrumen RESMI LAM
 * Teknik - "Lembar Kinerja Program Studi (LKPS) Perpanjangan AVP 2025"
 * (Akreditasi Vokasi Perpanjangan), sesuai file yang diberikan pengguna:
 * 7 kriteria utama (I-VII) dan 20 indikator (1.0-20.0) di bawahnya, dengan
 * teks nama/deskripsi/instruksi pengisian disalin apa adanya dari kolom
 * "Kriteria", "Indikator", dan "Instruksi Pengisian Deskripsi" pada sheet
 * "Instrumen Perpanjangan AVP 2025". Field "keterangan" mencatat program
 * mana yang wajib mengisi indikator tersebut dan Tabel pendukung (Tabel
 * 1-7) yang wajib dilampirkan - tabel-tabel itu sendiri (roster dosen,
 * daftar prasarana, dsb) TIDAK dibuatkan formulir terpisah di sini; cara
 * pakainya adalah melampirkan file Tabel yang sudah diisi lewat fitur
 * unggah dokumen yang sudah ada di setiap kriteria.
 *
 * Kalau LAM Teknik merevisi instrumen di kemudian hari, edit array
 * DEFAULT_KRITERIA/DEFAULT_INDIKATOR di bawah ini (atau edit langsung
 * lewat halaman Kelola Kriteria/Indikator di admin setelah periode
 * dibuat - keduanya tetap bisa diedit per-periode tanpa mengubah kode).
 */
const DEFAULT_KRITERIA = [
  { kode: 'I', nama: "Diferensiasi Misi (Visi, Misi, Tujuan, dan Strategi)" },
  { kode: 'II', nama: "Akuntabilitas" },
  { kode: 'III', nama: "Relevansi Pendidikan, Penelitian, dan PkM" },
  { kode: 'IV', nama: "Sumber Daya Manusia" },
  { kode: 'V', nama: "Sarana dan Prasarana" },
  { kode: 'VI', nama: "Mahasiswa" },
  { kode: 'VII', nama: "Sistem Penjaminan Mutu" },
];

const DEFAULT_INDIKATOR = [
  {
    kode: '1.0',
    kriteriaKode: 'I',
    nama: "Kekhasan VMTS",
    deskripsi: "Pernyataan VMTS Perguruan Tinggi (PT) dan Unit Pengelola Program Studi (UPPS) yang unik dan spesifik sebagai identitas PT maupun UPPS, serta pernyataan visi keilmuan program studi sebagai keunggulan kompetitif yang didukung dengan renstra dan kurikulum yang memadai.",
    instruksi: "Paparkan bahwa Visi, Misi, Tujuan, dan Sasaran (VMTS) Unit Pengelola Program STudi (UPPS) dan visi keilmuan program studi telah disusun dengan mempertimbangkan: \n(1) Linearitas visi Perguruan Tinggi (PT) yang diturunkan ke VMTS UPPS sebagai identitas UPPS; \n(2) Kesesuaian VMTS UPPS dengan Rencana Strategis (RENSTRA); \n(3) Kesesuaian visi keilmuan program studi dengan kurikulum; dan\n(4) Tinjau ulang VMTS UPPS dan visi keilmuan prodi secara periodik.",
    keterangan: "Diisi oleh semua program.\n\nLampirkan Surat Keputusan yang bersesuaian."
  },
  {
    kode: '2.0',
    kriteriaKode: 'I',
    nama: "Mekanisme penyusunan VMTS",
    deskripsi: "Mekanisme dan keterlibatan pemangku kepentingan dalam penyusunan VMTS UPPS dan tujuan utama yang ingin dicapai dalam penyusunan visi keilmuan program studi  dengan mempertimbangkan kebutuhan masyarakat dan tantangan global.",
    instruksi: "Paparkan bahwa mekanisme dalam penyusunan dan penetapan VMTS UPPS telah mempertimbangkan aspek: \n(1) Keterlibatan pemangku kepentingan internal yang terdiri dari dosen, mahasiswa, dan tenaga kependidikan; serta\n(2) Pemangku kepentingan eksternal yang terdiri dari lulusan, pengguna lulusan, dan pakar.",
    keterangan: "Diisi oleh semua program."
  },
  {
    kode: '3.0',
    kriteriaKode: 'II',
    nama: "Sistem tata pamong",
    deskripsi: "I. Kelengkapan struktur organisasi dan kebijakan operasional yang berpedoman pada statuta Perguruan Tinggi yang digunakan. \n II. Pimpinan UPPS memiliki komitmen pada: \n(1) Visi dan tujuan organisasi; \n(2) Integritas dan transparansi; \n(3) Pengembangan sumber daya.",
    instruksi: "Paparkan bahwa sistem tata pamong UPPS telah mencakup: \n(1) Tersedianya statuta Perguruan Tinggi yang mengatur struktur organisasi dan kebijakan operasional;  \n(2) Tersedianya kewenangan dan tugas yang dijalankan secara efektif; \n(3) Bukti sahih pelaksanaan struktur organisasi dan kebijakan operasional;  serta\n(4) Aras kewenangan organ pokok dijalankan secara efektif untuk mendukung perkembangan jangka panjang. \n Paparkan bahwa pimpinan UPPS memiliki komitmen pada: \n(1) Visi dan tujuan organisasi; \n(2) Integritas dan transparansi; serta\n(3) Pengembangan sumber daya.",
    keterangan: "Diisi oleh semua program.\n\nLampirkan Statuta Perguruan Tinggi (PT) dan Surat Keputusan (SK) yang bersesuaian."
  },
  {
    kode: '4.0',
    kriteriaKode: 'III',
    nama: "Pemutakhiran kurikulum",
    deskripsi: "Keterlibatan pemangku kepentingan dalam proses evaluasi dan pemutakhiran kurikulum.",
    instruksi: "Paparkan bahwa evaluasi dan pemutakhiran kurikulum program studi telah dilakukan secara berkala setiap 4 s.d. 5 tahun yang melibatkan pemangku kepentingan internal dan eksternal, direview oleh pakar bidang ilmu program studi, serta sesuai perkembangan iptek dan kebutuhan pengguna.",
    keterangan: "Diisi oleh semua program."
  },
  {
    kode: '5.0',
    kriteriaKode: 'III',
    nama: "Profil lulusan dan CPL.",
    deskripsi: "I. Profil lulusan yang ditetapkan oleh Program Studi. \n II. Kesesuaian Profil lulusan dengan capaian pembelajaran (CPL).",
    instruksi: "Paparkan bahwa program studi telah menetapkan profil lulusan dengan mempertimbangkan visi UPPS dan visi keilmuan program studi, kebutuhan pengguna, sumber daya yang dimiliki, serta kepentingan lokal, nasional, dan global. \n Paparkan bahwa CPL telah diturunkan dari profil lulusan yang mencakup: \n(1) Kesesuaian dengan kebutuhan pengguna; \n(2) Mengikuti perkembangan iptek dan industri; \n(3) Memiliki kompetensi dalam menghadapi persaingan global; dan\n(4) Dilakukan pengukuran dan ditinjau secara rutin.",
    keterangan: "Diisi oleh semua program."
  },
  {
    kode: '6.0',
    kriteriaKode: 'III',
    nama: "Rencana Proses Pembelajaran (RPS)",
    deskripsi: "I. Ketersediaan dan kelengkapan dokumen RPS.",
    instruksi: "Paparkan bahwa program studi telah menyediakan dokumen RPS untuk semua mata kuliah secara lengkap yang terdiri dari:\n1. Nama program studi, nama dan kode mata kuliah, semester, sks, nama dosen pengampu;\n2. Capaian pembelajaran lulusan yang dibebankan pada capaian pembelajaran mata kuliah;\n3. Kemampuan akhir yang direncanakan pada tiap tahap pembelajaran untuk memenuhi capaian pembelajaran lulusan;\n4. Bahan kajian yang terkait dengan kemampuan yang akan dicapai;\n5. Metode pembelajaran;\n6. Waktu yang disediakan untuk mencapai kemampuan pada tiap tahap pembelajaran;\n7. Pengalaman belajar mahasiswa yang diwujudkan dalam deskripsi tugas yang harus dikerjakan oleh mahasiswa selama satu semester;\n8. Kriteria, indikator, dan bobot penilaian; dan\n9. Daftar referensi yang digunakan. \n Paparkan bahwa program studi telah melakukan proses tinjauan rutin terhadap RPS secara berkala untuk memastikan relevansi, kesesuaian dengan CPL dan perkembangan keilmuan terbaru yang mencakup: \n(1) Analisis CPL; \n(2) Evaluasi kesesuaian materi dan metode pembelajaran; \n(3) Peninjauan metode penilaian; dan\n(4) Penyesuaian kurikulum dan pembaruan materi.",
    keterangan: "Diisi oleh semua program.\n\nTabel 1. Kurikulum dan Rencana Pembelajaran wajib diisi.\n\nLampirkan semua dokumen RPS."
  },
  {
    kode: '7.0',
    kriteriaKode: 'III',
    nama: "Proses Pembelajaran",
    deskripsi: "I. Proses pembelajaran untuk memastikan efektivitas, kualitas, dan keberhasilan pencapaian CPL. \n II. Tinjauan rutin proses pembelajaran.",
    instruksi: "Paparkan bahwa program studi telah melaksanakan proses pembelajaran yang efektif dalam mencapai CPL dengan mempertimbangkan: \n(1) Metode pembelajaran; \n(2) Media dan sumber belajar; \n(3) Interaksi dosen dan mahasiswa; dan \n(4) Peningkatan daya analisis kritis. \n Paparkan bahwa program studi telah memiliki sistem dan melaksanakan pemantauan proses pembelajaran secara berkala untuk memastikan kesesuaian dengan RPS, yang mencakup:\n(1) Peninjauan kesesuaian dengan RPS; \n(2) Evaluasi metode pembelajaran; \n(3) Identifikasi peluang perbaikan; dan \n(4) Tindakan perbaikan.",
    keterangan: "Diisi oleh semua program."
  },
  {
    kode: '8.0',
    kriteriaKode: 'III',
    nama: "Basic sciences dan matematika",
    deskripsi: "Ketersediaan mata kuliah basic sciences dan matematika.",
    instruksi: "Paparkan bahwa program studi telah menyediakan mata kuliah basic sciences dan matematika yang mencukupi.",
    keterangan: "Diisi oleh program studi pada program Sarjana dan Sarjana Terapan.\n\nTabel 2. Mata Kuliah Basic Science dan Matematika dalam Proses Pembelajaran wajib diisi.\n\nLampirkan RPS mata kuliah basic science  dan matematika."
  },
  {
    kode: '9.0',
    kriteriaKode: 'III',
    nama: "Proyek rekayasa penciri bidang prodi (Capstone design)",
    deskripsi: "Terselenggaranya mata kuliah capstone design.",
    instruksi: "Paparkan bahwa program studi telah menyelenggarakan mata kuliah capstone design yang memiliki:\n(1) Panduan pelaksanaan,\n(2) Memiliki rumusan capaian pembelajaran mata kuliah,\n(3) Menggunakan standar-standar keteknikan dan batasan-batasan realistis berdasarkan pada pengetahuan dan keterampilan yang telah diperoleh di perkuliahan sebelumnya, dan\n(4) Mempunyai bukti sahih pelaksanaan.",
    keterangan: "Diisi oleh program studi pada program Sarjana dan Sarjana Terapan.\n\nTabel 3. Capstone Design dalam Proses Pembelajaran wajib diisi.\n\nLampirkan bukti-bukti sahih pelaksanaannya."
  },
  {
    kode: '10.0',
    kriteriaKode: 'III',
    nama: "Penelitian dan PkM",
    deskripsi: "Kegiatan penelitian dan PkM Dosen Tetap Program Studi (DTPS).",
    instruksi: "Sebutkan persentase kegiatan penelitian dan PkM DTPS yang sesuai dengan peta jalan penelitian dan PkM yang mendukung VMTS UPPS dan visi keilmuan program studi.",
    keterangan: "Diisi oleh semua program.\n\nTabel 4.a. Penelitian DTPS dan Tabel 4.b. Pengabdian kepada Masyarakat DTPS.\n\nLampirkan bukti-bukti sahih pendukungnya."
  },
  {
    kode: '11.0',
    kriteriaKode: 'IV',
    nama: "Profil Dosen",
    deskripsi: "Kecukupan dosen homebase (DHB)",
    instruksi: "Sebutkan para dosen yang ditugaskan sebagai dosen homebase program studi yang diakreditasi pada saat TS yang mengacu ke data di PDDikti.",
    keterangan: "Diisi oleh semua program.\n\nTabel 5. Profil Dosen wajib diisi.\n\nLampirkan Surat Keputusan (SK)."
  },
  {
    kode: '12.0',
    kriteriaKode: 'IV',
    nama: "Dosen pembagi rasio untuk disesuaikan sebagai DTPS.",
    deskripsi: "Dosen pembagi rasio untuk disesuaikan sebagai DTPS.",
    instruksi: "Sebutkan para dosen yang ditugaskan sebagai pengampu mata kuliah di program studi yang diakreditasi pada saat TS yang mengacu ke data dosen pembagi rasio di PDDikti. Sesuaikan data dosen pembagi rasio di PDDikti menjadi data Dosen Tetap Program Studi (DTPS) sesuai dengan definisi LAM Teknik*.\n\n*DTPS adalah Dosen Tetap Perguruan Tinggi yang ditugaskan sebagai pengampu mata kuliah dengan bidang keahlian yang sesuai dengan kompetensi inti program studi yang diakreditasi. DTPS yang diakui berasal dari kelompok eksakta yang ditunjukkan dengan bukti kompetensi dosen yang mengajar Body of Knowledge (BoK) dan terlibat dalam tridharma. BoK dapat merujuk pada dokumen panduan yang dikeluarkan asosiasi Prodi atau profesi.",
    keterangan: "Diisi oleh semua program.\n\nTabel 5. Profil Dosen wajib diisi."
  },
  {
    kode: '13.0',
    kriteriaKode: 'IV',
    nama: "Kualifikasi akademik DTPS.",
    deskripsi: "Kualifikasi akademik DTPS.",
    instruksi: "Paparkan jabatan akademik DTPS (data DTPS mengacu ke kriteria 12).",
    keterangan: "Diisi oleh program studi pada program Diploma 1, Diploma 2, Diploma 3, Sarjana, Sarjana Terapan, dan Program Profesi Insinyur.\n\nTabel 5. Profil Dosen wajib diisi."
  },
  {
    kode: '14.0',
    kriteriaKode: 'IV',
    nama: "Jabatan akademik DTPS.",
    deskripsi: "Jabatan akademik DTPS.",
    instruksi: "",
    keterangan: "Diisi oleh program studi pada program Diploma 1, Diploma 2, Diploma 3, Sarjana, Sarjana Terapan, Magister, Magister Terapan, Doktor, dan Doktor Terapan.\n\nTabel 5. Profil Dosen wajib diisi."
  },
  {
    kode: '15.0',
    kriteriaKode: 'V',
    nama: "Sarana dan Prasarana",
    deskripsi: "Kecukupan dan mutu sarana dan prasaran.",
    instruksi: "Paparkan bahwa sarana dan prasarana yang disediakan telah mencukupi, baik kuantitas maupun kualitas (mutu), untuk mendukung kegiatan akademik yang meliputi: \n(1) Ketersediaan media pembelajaran, perangkat elektronik, alat praktik laboratorium; \n(2) Ketersediaan ruang kelas, laboratorium sesuai dengan panduan asosiasi penyelenggara program studi, dan perpustakaan; \n(3) Kelayakan sarana dan prasarana; serta\n(4) Kemudahan akses sarana prasarana.",
    keterangan: "Diisi oleh semua program.\n\nTabel 6. Prasarana dan Peralatan Utama Ruang Kelas/Ruang Diskusi / Laboratorium di UPPS yang digunakan oleh PS yang Diakreditasi wajib diisi."
  },
  {
    kode: '16.0',
    kriteriaKode: 'VI',
    nama: "Masa studi",
    deskripsi: "Masa studi.",
    instruksi: "Paparkan rerata masa studi mahasiswa program studi yang diakreditasi.",
    keterangan: "Diisi oleh semua program.\n\nTabel 7. Masa Studi Lulusan wajib diisi."
  },
  {
    kode: '17.0',
    kriteriaKode: 'VI',
    nama: "Persentase lulusan Tepat waktu",
    deskripsi: "Persentase kelulusan tepat waktu (PTW).",
    instruksi: "Paparkan rerata kelulusan tepat waktu mahasiswa program studi yang diakreditasi.",
    keterangan: "Diisi oleh semua program.\n\nTabel 7. Masa Studi Lulusan wajib diisi."
  },
  {
    kode: '18.0',
    kriteriaKode: 'VII',
    nama: "Keberadaan unit penjaminan mutu dan komitmen pimpinan",
    deskripsi: "Keberadaan unit penjaminan mutu UPPS. \n II. Ketersediaan perangkat Sistem Penjaminan Mutu Internal (SPMI).",
    instruksi: "Paparkan keberadaan unit penjaminan mutu di tingkat UPPS dan komitmen pimpinan dengan keberadaan 4 dokumen berikut: \n(1) Dokumen legal pembentukan unsur pelaksana penjaminan mutu; \n(2) Dokumen legal bahwa auditor bersifat independen; \n(3) Dokumen pelaksanaan audit mutu internal; \n(4) Dokumen Rapat Tinjauan Manajemen (RTM). \n Paparkan ketersediaan perangkat SPMI yang minimal mencakup: 1. Kebijakan SPMI; 2. Pedoman penerapan siklus PPEPP standar pendidikan tinggi dalam SPMI; 3. Standar dan/atau kriteria, norma, acuan mutu penyelenggaraan pendidikan dan pengelolaan perguruan tinggi; dan 4. Tata cara pendokumentasian implementasi SPMI, serta sistem penjaminan mutu memiliki pengakuan mutu dari lembaga audit eksternal, lembaga akreditasi, dan lembaga sertifikasi.",
    keterangan: "Diisi oleh semua program."
  },
  {
    kode: '19.0',
    kriteriaKode: 'VII',
    nama: "Indikator Kinerja Tambahan (IKT)",
    deskripsi: "Keberadaan Indikator Kinerja Tambahan (IKT).",
    instruksi: "IKT disusun sesuai dengan unsur: \n(1) Tujuan strategis organisasi; \n(2) Memberikan dampak positif dan terukur; \n(3) Menunjukkan daya saing internasional; \n(4) Telah diukur dan dianalisis untuk perbaikan UPPS dan Program studi.",
    keterangan: "Diisi oleh semua program."
  },
  {
    kode: '20.0',
    kriteriaKode: 'VII',
    nama: "Keterlaksanaan Penjaminan Mutu dan Audit Mutu Internal",
    deskripsi: "Keterlaksanaan Sistem Penjaminan Mutu Internal (SPMI).",
    instruksi: "Paparkan bahwa Sistem Penjaminan Mutu Internal (SPMI) yang dilaksanakan telah memenuhi aspek berikut: \n(1) Tersedianya dokumen IKU dan IKT Pendidikan, Penelitian dan PkM; \n(2)Terlaksananya siklus penjaminan mutu (siklus PPEPP); \n(3) Bukti sahih efektivitas pelaksanaan penjaminan mutu; dan\n(4) Tersedianya bukti peningkatan standar.",
    keterangan: "Diisi oleh semua program."
  },
];

/**
 * Template checklist proses generik yang berlaku untuk kriteria apapun -
 * langkah standar penyusunan borang akreditasi (LED/LKPS) per kriteria.
 * Dibuat otomatis setiap kriteria baru dibuat, lalu bisa ditambah/dihapus
 * manual sesuai kebutuhan tiap kriteria.
 */
const DEFAULT_CHECKLIST_ITEMS = [
  'Kumpulkan data & bukti pendukung (LKPS) untuk kriteria ini',
  'Susun narasi Laporan Evaluasi Diri (LED) sesuai elemen penilaian',
  'Lampirkan dokumen bukti (SK, laporan, notulen, dsb.)',
  'Review internal oleh Tim Penjaminan Mutu / SPMI',
  'Perbaikan sesuai hasil review internal',
  'Finalisasi & tanda tangan pimpinan prodi/fakultas'
];

async function seedChecklistUntukKriteria(periodeId, kriteriaId) {
  const batch = db.batch();
  DEFAULT_CHECKLIST_ITEMS.forEach((item, idx) => {
    const ref = db.collection('akreditasi_checklist').doc();
    batch.set(ref, {
      periodeId,
      kriteriaId,
      item,
      urutan: idx + 1,
      selesai: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });
  await batch.commit();
}

async function getOrCreateSubFolder(parentId, name) {
  const query = await drive.files.list({
    q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });
  if (query.data.files.length > 0) {
    return query.data.files[0].id;
  }
  const folder = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return folder.data.id;
}

/**
 * Folder Drive: DATA_WEB_FOLDER_ID / Akreditasi / <periodeId> / <kodeKriteria>
 */
async function getKriteriaFolder(periodeId, kodeKriteria) {
  const root = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Akreditasi');
  const periodeFolder = await getOrCreateSubFolder(root, periodeId);
  return getOrCreateSubFolder(periodeFolder, `Kriteria_${kodeKriteria}`);
}

/**
 * Upload buffer file (dari multer memoryStorage) ke folder kriteria, jadikan
 * bisa dibaca lewat link, lalu kembalikan info file untuk disimpan di
 * koleksi akreditasi_dokumen.
 */
async function uploadDokumenKriteria({ periodeId, kodeKriteria, file }) {
  const folderId = await getKriteriaFolder(periodeId, kodeKriteria);
  const fileName = `${Date.now()}_${file.originalname}`;
  const fileMetadata = { name: fileName, parents: [folderId] };
  const media = { mimeType: file.mimetype, body: Readable.from(file.buffer) };
  const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
  await drive.permissions.create({
    fileId: response.data.id,
    requestBody: { role: 'reader', type: 'anyone' }
  });
  return {
    fileId: response.data.id,
    fileUrl: `https://drive.google.com/file/d/${response.data.id}/view`,
    fileName: file.originalname
  };
}

async function hapusFileDrive(fileId) {
  if (!fileId) return;
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    console.error('Gagal menghapus file dari Drive (mungkin sudah terhapus):', err.message);
  }
}

/**
 * Membuat 7 kriteria (I-VII) dan 20 indikator (1.0-20.0) default untuk
 * sebuah periode akreditasi baru, sesuai instrumen resmi LAM Teknik yang
 * dilampirkan pengguna - kalau periode itu belum punya kriteria sama
 * sekali (idempotent, aman dipanggil berulang).
 */
async function seedKriteriaUntukPeriode(periodeId) {
  const existing = await db.collection('akreditasi_kriteria').where('periodeId', '==', periodeId).limit(1).get();
  if (!existing.empty) return;

  const batch = db.batch();
  const kriteriaRefByKode = {};
  DEFAULT_KRITERIA.forEach((k, idx) => {
    const ref = db.collection('akreditasi_kriteria').doc();
    kriteriaRefByKode[k.kode] = ref;
    batch.set(ref, {
      periodeId,
      urutan: idx + 1,
      kode: k.kode,
      nama: k.nama,
      status: 'belum', // belum | proses | selesai
      picDosenIds: [],
      targetTanggal: null,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
  });

  // 20 indikator LKPS resmi, masing-masing ditautkan ke kriteria (I-VII)
  // induknya lewat kriteriaKode -> kriteriaId.
  DEFAULT_INDIKATOR.forEach((it, idx) => {
    const kriteriaRef = kriteriaRefByKode[it.kriteriaKode];
    if (!kriteriaRef) return;
    const indikatorRef = db.collection('akreditasi_indikator').doc();
    batch.set(indikatorRef, {
      periodeId,
      kriteriaId: kriteriaRef.id,
      urutan: idx + 1,
      kode: it.kode,
      nama: it.nama,
      deskripsi: it.deskripsi,
      instruksi: it.instruksi,
      keterangan: it.keterangan,
      uraianJawaban: '',
      buktiSahihUrl: '',
      status: 'belum', // belum | terisi
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
  });

  await batch.commit();

  // Siapkan checklist proses generik untuk tiap kriteria yang baru dibuat
  for (const ref of Object.values(kriteriaRefByKode)) {
    await seedChecklistUntukKriteria(periodeId, ref.id);
  }
}

/**
 * Ambil daftar indikator LKPS milik satu kriteria, terurut sesuai urutan
 * di instrumen resmi.
 */
async function getIndikatorKriteria(kriteriaId) {
  const snapshot = await db.collection('akreditasi_indikator')
    .where('kriteriaId', '==', kriteriaId)
    .get();
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
}

/**
 * Ambil daftar kriteria satu periode, terurut, dilengkapi jumlah dokumen,
 * progres checklist, dan progres indikator LKPS per kriteria (untuk
 * progress bar di dashboard/rekap).
 */
async function getKriteriaDenganProgress(periodeId) {
  const snapshot = await db.collection('akreditasi_kriteria')
    .where('periodeId', '==', periodeId)
    .orderBy('urutan', 'asc')
    .get();
  const kriteriaList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  const dokSnapshot = await db.collection('akreditasi_dokumen').where('periodeId', '==', periodeId).get();
  const jumlahDokPerKriteria = {};
  dokSnapshot.docs.forEach(d => {
    const kId = d.data().kriteriaId;
    jumlahDokPerKriteria[kId] = (jumlahDokPerKriteria[kId] || 0) + 1;
  });

  const checklistSnapshot = await db.collection('akreditasi_checklist').where('periodeId', '==', periodeId).get();
  const checklistPerKriteria = {};
  checklistSnapshot.docs.forEach(d => {
    const data = d.data();
    if (!checklistPerKriteria[data.kriteriaId]) checklistPerKriteria[data.kriteriaId] = { total: 0, selesai: 0 };
    checklistPerKriteria[data.kriteriaId].total += 1;
    if (data.selesai) checklistPerKriteria[data.kriteriaId].selesai += 1;
  });

  const indikatorSnapshot = await db.collection('akreditasi_indikator').where('periodeId', '==', periodeId).get();
  const indikatorPerKriteria = {};
  indikatorSnapshot.docs.forEach(d => {
    const data = d.data();
    if (!indikatorPerKriteria[data.kriteriaId]) indikatorPerKriteria[data.kriteriaId] = { total: 0, terisi: 0 };
    indikatorPerKriteria[data.kriteriaId].total += 1;
    if (data.uraianJawaban && data.uraianJawaban.trim()) indikatorPerKriteria[data.kriteriaId].terisi += 1;
  });

  return kriteriaList.map(k => {
    const chk = checklistPerKriteria[k.id] || { total: 0, selesai: 0 };
    const ind = indikatorPerKriteria[k.id] || { total: 0, terisi: 0 };
    return {
      ...k,
      jumlahDokumen: jumlahDokPerKriteria[k.id] || 0,
      checklistTotal: chk.total,
      checklistSelesai: chk.selesai,
      checklistPersen: chk.total ? Math.round((chk.selesai / chk.total) * 100) : 0,
      indikatorTotal: ind.total,
      indikatorTerisi: ind.terisi,
      indikatorPersen: ind.total ? Math.round((ind.terisi / ind.total) * 100) : 0
    };
  });
}
function hitungProgresKeseluruhan(kriteriaList) {
  if (!kriteriaList.length) return 0;
  const selesai = kriteriaList.filter(k => k.status === 'selesai').length;
  return Math.round((selesai / kriteriaList.length) * 100);
}

/**
 * Kriteria dianggap terlambat kalau punya targetTanggal, tanggal itu sudah
 * lewat hari ini, dan statusnya belum 'selesai'.
 */
function isKriteriaTerlambat(kriteria) {
  if (!kriteria.targetTanggal || kriteria.status === 'selesai') return false;
  const hariIni = new Date().toISOString().split('T')[0];
  return kriteria.targetTanggal < hariIni;
}

/**
 * Ubah daftar kriteria (hasil getKriteriaDenganProgress) jadi teks CSV
 * sederhana untuk rekap/ekspor - tanpa dependency tambahan (xlsx dsb).
 */
function kriteriaListToCsv(kriteriaList, periodeNama) {
  const escapeCsv = (val) => `"${String(val === undefined || val === null ? '' : val).replace(/"/g, '""')}"`;
  const header = ['Kode', 'Nama Kriteria', 'Status', 'Target Selesai', 'Jumlah Dokumen', 'Indikator Terisi', 'Indikator Total', 'Progres Indikator (%)', 'Checklist Selesai', 'Checklist Total'];
  const rows = kriteriaList.map(k => [
    k.kode,
    k.nama,
    k.status === 'selesai' ? 'Selesai' : (k.status === 'proses' ? 'Sedang Diproses' : 'Belum Dimulai'),
    k.targetTanggal || '-',
    k.jumlahDokumen,
    k.indikatorTerisi,
    k.indikatorTotal,
    k.indikatorPersen,
    k.checklistSelesai,
    k.checklistTotal
  ]);
  const lines = [`Rekap Akreditasi - ${periodeNama}`, '', header.map(escapeCsv).join(',')];
  rows.forEach(r => lines.push(r.map(escapeCsv).join(',')));
  return lines.join('\r\n');
}

module.exports = {
  DATA_WEB_FOLDER_ID,
  DEFAULT_KRITERIA,
  DEFAULT_INDIKATOR,
  DEFAULT_CHECKLIST_ITEMS,
  getOrCreateSubFolder,
  getKriteriaFolder,
  uploadDokumenKriteria,
  hapusFileDrive,
  seedKriteriaUntukPeriode,
  seedChecklistUntukKriteria,
  getIndikatorKriteria,
  getKriteriaDenganProgress,
  hitungProgresKeseluruhan,
  isKriteriaTerlambat,
  kriteriaListToCsv
};
