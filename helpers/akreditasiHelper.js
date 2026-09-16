// helpers/akreditasiHelper.js
//
// Modul pendukung Akreditasi Program Studi (mengacu pada struktur 9 kriteria
// LAM Teknik untuk Program Studi Vokasi - IAPS-AV 2025, yang diturunkan dari
// SN-DIKTI). Dipakai bersama oleh routes/admin/akreditasi.js dan
// routes/dosen/akreditasi.js supaya logika folder Google Drive & progres
// tidak dobel ditulis di kedua tempat.
//
// Catatan: daftar DEFAULT_KRITERIA di bawah adalah TEMPLATE awal yang bisa
// diedit/disesuaikan admin (nama, deskripsi, urutan) setelah dibuat - bukan
// nilai final yang mengunci instrumen resmi LAM Teknik, karena instrumen
// detail (elemen penilaian per kriteria) bisa berbeda antar tahun terbit
// dan perlu dicek ke dokumen resmi LAM Teknik (https://lamteknik.or.id) saat
// prodi benar-benar menyusun LED/LKPS.

const { db } = require('../config/firebaseAdmin');
const drive = require('../config/googleDrive');
const { Readable } = require('stream');

// Folder root Google Drive yang sama dipakai fitur lain (sertifikat, SPMP)
// di aplikasi ini - lihat routes/admin/sertifikat.js & routes/dosen/spmp.js
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

/**
 * 9 kriteria akreditasi Program Studi Vokasi LAM Teknik (template awal).
 * Urutan & kode mengikuti pola umum instrumen APS Vokasi/Akademik LAM Teknik
 * yang diturunkan dari 9 standar SN-DIKTI.
 */
const DEFAULT_KRITERIA = [
  {
    kode: 'I',
    nama: 'Visi, Misi, Tujuan, dan Strategi (Diferensiasi Misi)',
    deskripsi: 'Kejelasan dan kerealistikan visi keilmuan program studi, konsistensi dengan visi keilmuan perguruan tinggi, serta strategi pencapaian tujuan dengan rentang waktu yang jelas.'
  },
  {
    kode: 'II',
    nama: 'Tata Pamong, Tata Kelola, Kerja Sama, dan Keuangan (Akuntabilitas)',
    deskripsi: 'Sistem tata pamong, struktur organisasi, kepemimpinan, penjaminan mutu internal, kerja sama tridarma, serta pengelolaan keuangan UPPS/program studi.'
  },
  {
    kode: 'III',
    nama: 'Mahasiswa',
    deskripsi: 'Kualitas input mahasiswa, sistem seleksi/rekrutmen, layanan kemahasiswaan (bimbingan/konseling, minat-bakat, beasiswa, kesehatan), serta prestasi akademik dan non-akademik mahasiswa.'
  },
  {
    kode: 'IV',
    nama: 'Sumber Daya Manusia',
    deskripsi: 'Kecukupan dan kualifikasi dosen tetap program studi, rekognisi dosen, tenaga kependidikan, serta pengembangan SDM (studi lanjut, sertifikasi kompetensi/profesi).'
  },
  {
    kode: 'V',
    nama: 'Keuangan, Sarana, dan Prasarana',
    deskripsi: 'Kecukupan dan keberlanjutan pembiayaan, ketersediaan dan mutu prasarana (ruang kelas, laboratorium/bengkel praktik) serta sarana pembelajaran yang relevan dengan capaian pembelajaran.'
  },
  {
    kode: 'VI',
    nama: 'Pendidikan',
    deskripsi: 'Kurikulum (capaian pembelajaran, RPS, praktik/PKL/magang industri), proses pembelajaran, suasana akademik, serta sistem penilaian pembelajaran.'
  },
  {
    kode: 'VII',
    nama: 'Penelitian',
    deskripsi: 'Relevansi, produktivitas, dan mutu penelitian dosen tetap program studi, keterlibatan mahasiswa, serta publikasi ilmiah.'
  },
  {
    kode: 'VIII',
    nama: 'Pengabdian kepada Masyarakat',
    deskripsi: 'Relevansi, produktivitas, dan mutu kegiatan pengabdian kepada masyarakat (PkM) dosen tetap program studi serta keterlibatan mahasiswa.'
  },
  {
    kode: 'IX',
    nama: 'Luaran dan Capaian Tridarma',
    deskripsi: 'Capaian pembelajaran lulusan (IPK, masa studi), tingkat/waktu tunggu kerja lulusan, kepuasan pengguna lulusan, luaran penelitian & PkM, serta indikator kinerja tambahan program studi.'
  }
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
 * Membuat 9 kriteria default untuk sebuah periode akreditasi baru, kalau
 * periode itu belum punya kriteria sama sekali (idempotent).
 */
async function seedKriteriaUntukPeriode(periodeId) {
  const existing = await db.collection('akreditasi_kriteria').where('periodeId', '==', periodeId).limit(1).get();
  if (!existing.empty) return;

  const batch = db.batch();
  const kriteriaRefs = [];
  DEFAULT_KRITERIA.forEach((k, idx) => {
    const ref = db.collection('akreditasi_kriteria').doc();
    kriteriaRefs.push(ref);
    batch.set(ref, {
      periodeId,
      urutan: idx + 1,
      kode: k.kode,
      nama: k.nama,
      deskripsi: k.deskripsi,
      status: 'belum', // belum | proses | selesai
      picDosenIds: [],
      targetTanggal: null,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
  });
  await batch.commit();

  // Siapkan checklist proses generik untuk tiap kriteria yang baru dibuat
  for (const ref of kriteriaRefs) {
    await seedChecklistUntukKriteria(periodeId, ref.id);
  }
}

/**
 * Ambil daftar kriteria satu periode, terurut, dilengkapi jumlah dokumen
 * yang sudah diunggah per kriteria (untuk progress bar sederhana).
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

  return kriteriaList.map(k => {
    const chk = checklistPerKriteria[k.id] || { total: 0, selesai: 0 };
    return {
      ...k,
      jumlahDokumen: jumlahDokPerKriteria[k.id] || 0,
      checklistTotal: chk.total,
      checklistSelesai: chk.selesai,
      checklistPersen: chk.total ? Math.round((chk.selesai / chk.total) * 100) : 0
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
  const header = ['Kode', 'Nama Kriteria', 'Status', 'Target Selesai', 'Jumlah Dokumen', 'Checklist Selesai', 'Checklist Total', 'Progres Checklist (%)'];
  const rows = kriteriaList.map(k => [
    k.kode,
    k.nama,
    k.status === 'selesai' ? 'Selesai' : (k.status === 'proses' ? 'Sedang Diproses' : 'Belum Dimulai'),
    k.targetTanggal || '-',
    k.jumlahDokumen,
    k.checklistSelesai,
    k.checklistTotal,
    k.checklistPersen
  ]);
  const lines = [`Rekap Akreditasi - ${periodeNama}`, '', header.map(escapeCsv).join(',')];
  rows.forEach(r => lines.push(r.map(escapeCsv).join(',')));
  return lines.join('\r\n');
}

module.exports = {
  DATA_WEB_FOLDER_ID,
  DEFAULT_KRITERIA,
  DEFAULT_CHECKLIST_ITEMS,
  getOrCreateSubFolder,
  getKriteriaFolder,
  uploadDokumenKriteria,
  hapusFileDrive,
  seedKriteriaUntukPeriode,
  seedChecklistUntukKriteria,
  getKriteriaDenganProgress,
  hitungProgresKeseluruhan,
  isKriteriaTerlambat,
  kriteriaListToCsv
};
