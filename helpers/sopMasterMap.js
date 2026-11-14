// helpers/sopMasterMap.js
//
// Menghubungkan 53 item SOP di Master Dokumen Prodi (kelompok B) dengan 47 SOP di Buku Induk SOP
// (data/sop/master.js, status di koleksi Firestore sop_status). Banyak item Master dilebur menjadi
// satu SOP di Buku Induk (mis. Pengisian KRS + Perubahan KRS -> SOP-TE-002), jadi pemetaannya
// banyak-ke-satu. Status item Master yang terpetakan DIAMBIL LANGSUNG dari Buku Induk SOP
// (sumber kebenaran tunggal), tidak disalin, sehingga tidak bisa selisih.

const { db } = require('../config/firebaseAdmin');
let sopData = null;
try { sopData = require('../data/sop'); } catch (e) { /* modul SOP belum terpasang: pemetaan dilewati */ }

// judul item Master (persis sama dengan helpers/masterDokumenConfig.js) -> kode SOP Buku Induk
const PETA = {
  // Akademik
  'SOP Penyusunan dan Penetapan Jadwal Kuliah': 'SOP-TE-001',
  'SOP Pengisian KRS': 'SOP-TE-002',
  'SOP Perubahan KRS': 'SOP-TE-002',
  'SOP Pelaksanaan Perkuliahan': 'SOP-TE-003',
  'SOP Presensi Mahasiswa': 'SOP-TE-003',
  'SOP Presensi Dosen': 'SOP-TE-003',
  'SOP Perubahan Jadwal Kuliah': 'SOP-TE-003',
  'SOP Perkuliahan Pengganti': 'SOP-TE-003',
  'SOP Penyusunan dan Evaluasi RPS': 'SOP-TE-004',
  'SOP Pelaksanaan UTS dan UAS': 'SOP-TE-005',
  'SOP Penginputan dan Perbaikan Nilai': 'SOP-TE-006',
  'SOP Evaluasi Hasil Belajar': 'SOP-TE-007',
  'SOP Pembimbingan Akademik': 'SOP-TE-009',
  'SOP Cuti Akademik dan Aktif Kembali': 'SOP-TE-010',
  'SOP Monitoring Masa Studi Mahasiswa': 'SOP-TE-009',
  // Praktikum dan laboratorium
  'SOP Penggunaan Laboratorium': 'SOP-TE-015',
  'SOP Peminjaman Alat dan Bahan': 'SOP-TE-016',
  'SOP Pengembalian Alat': 'SOP-TE-016',
  'SOP Pelaksanaan Praktikum': 'SOP-TE-015',
  'SOP Keselamatan dan Kesehatan Kerja (K3)': 'SOP-TE-019',
  'SOP Penanganan Kerusakan Alat': 'SOP-TE-017',
  'SOP Pemeliharaan dan Kalibrasi Alat': 'SOP-TE-018',
  'SOP Inventarisasi Peralatan': 'SOP-TE-018',
  'SOP Penanganan Kecelakaan Laboratorium': 'SOP-TE-019',
  'SOP Pengelolaan Limbah Elektronik': 'SOP-TE-019',
  // Magang dan kerja sama industri
  'SOP Pemetaan dan Penetapan Mitra Magang': 'SOP-TE-025',
  'SOP Pendaftaran Magang': 'SOP-TE-021',
  'SOP Pembekalan Magang': 'SOP-TE-021',
  'SOP Penempatan Mahasiswa Magang': 'SOP-TE-021',
  'SOP Penunjukan Dosen Pembimbing': 'SOP-TE-021',
  'SOP Monitoring dan Evaluasi Magang': 'SOP-TE-021',
  'SOP Penilaian Magang': 'SOP-TE-023',
  'SOP Penyusunan Laporan Magang': 'SOP-TE-023',
  'SOP Seminar Hasil Magang': 'SOP-TE-023',
  'SOP Penanganan Permasalahan Mahasiswa di Industri': 'SOP-TE-024',
  // Layanan mahasiswa
  'SOP Pelayanan Administrasi Akademik': 'SOP-TE-029',
  'SOP Konsultasi Mahasiswa': 'SOP-TE-009',
  'SOP Penanganan Keluhan Mahasiswa': 'SOP-TE-031',
  'SOP Bimbingan dan Konseling': 'SOP-TE-031',
  'SOP Surat Keterangan Mahasiswa': 'SOP-TE-029',
  'SOP Rekomendasi Beasiswa': 'SOP-TE-031',
  'SOP Penanganan Pelanggaran Akademik': 'SOP-TE-031',
  'SOP Pengajuan Kegiatan Kemahasiswaan': 'SOP-TE-032',
  // Pengelolaan dosen dan mutu
  'SOP Penugasan Mengajar Dosen': 'SOP-TE-033',
  'SOP Monitoring Kinerja Dosen': 'SOP-TE-035',
  'SOP Evaluasi Dosen oleh Mahasiswa': 'SOP-TE-035',
  'SOP Evaluasi RPS dan Pembelajaran': 'SOP-TE-004',
  'SOP Evaluasi Kurikulum': 'SOP-TE-013',
  'SOP Rapat Evaluasi Prodi': 'SOP-TE-040',
  'SOP Audit Mutu Internal': 'SOP-TE-039',
  'SOP Tindak Lanjut Hasil Evaluasi': 'SOP-TE-039',
  'SOP Pengelolaan Dokumen Mutu': 'SOP-TE-041',
  'SOP Evaluasi Kepuasan Pengguna Lulusan': 'SOP-TE-043'
};

// status Buku Induk SOP -> status item Master Dokumen
const STATUS_KE_MASTER = {
  'Belum ada': 'belum',
  'Ada - perlu diformat': 'draft',
  'Draf disusun': 'draft',
  'Menunggu pengesahan': 'ada',
  'Disahkan': 'disahkan'
};

/** Peta judul item Master -> info SOP terkini. Kosong bila modul SOP tidak terpasang. */
async function infoSopPerJudul() {
  if (!sopData) return {};
  const snap = await db.collection('sop_status').get();
  const st = {};
  snap.forEach(d => { st[d.id] = d.data(); });
  const perKode = {};
  sopData.semua().forEach(s => {
    const o = st[s.kode] || {};
    const status = o.status || (s.tersedia ? 'Draf disusun' : s.statusAwal);
    perKode[s.kode] = {
      kode: s.kode, judul: s.judul, status, statusMaster: STATUS_KE_MASTER[status] || 'belum',
      versi: o.versi || '', url: s.tersedia || s.urlEksternal ? (s.urlEksternal || `/sop/${s.kode}`) : ''
    };
  });
  const out = {};
  Object.keys(PETA).forEach(j => { if (perKode[PETA[j]]) out[j] = perKode[PETA[j]]; });
  // SOP Buku Induk yang belum punya item di Master: item yang ditambah manual dengan judul sama
  // persis ("Kunjungan Industri" atau "SOP Kunjungan Industri") otomatis ikut terhubung.
  Object.values(perKode).forEach(s => {
    if (!out[s.judul]) out[s.judul] = s;
    if (!out['SOP ' + s.judul]) out['SOP ' + s.judul] = s;
  });
  return out;
}

module.exports = { PETA, STATUS_KE_MASTER, infoSopPerJudul };
