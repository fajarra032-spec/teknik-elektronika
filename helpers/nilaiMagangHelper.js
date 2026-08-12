// helpers/nilaiMagangHelper.js
// ============================================================================
// NILAI MAGANG - mengikuti Lampiran 3 "Format Penilaian" pada Pedoman
// Magang Mahasiswa Politeknik Dewantara (SK Direktur No.
// 407/D/Polidewa/II/2026). Sesuai keputusan Kaprodi, HANYA 3 pihak yang
// memberi nilai (form Kepala Bagian Magang di panduan TIDAK dipakai di
// sistem ini):
//   1. PEMBIMBING 1 - menilai LAPORAN (13 indikator: 8 Laporan + 3
//      Pengetahuan + 2 Presentasi Magang), setelah laporan di-ACC.
//   2. PEMBIMBING 2 - menilai LOGBOOK/sikap (11 indikator: 7 Laporan/Sikap
//      + 2 Pengetahuan + 2 Presentasi Magang), setelah logbook DIKUNCI.
//   3. PENDAMPING LAPANGAN (IDUKA) - diinput ADMIN mewakili pendamping
//      lapangan yang tidak punya akses sistem (9 indikator: 2 Keterampilan
//      + 2 Pengetahuan + 4 Sikap Kerja + 1 Logbook).
//
// Setiap indikator diisi ANGKA 0-100 (kolom huruf A/B+/B/C+/C/D/E di form
// kertas cuma penanda rentang - lihat helpers/nilaiHelper.js->nilaiKeHuruf
// untuk batasannya, sudah konsisten dipakai di seluruh aplikasi).
// Nilai rata-rata per pihak = rata-rata semua indikatornya. Nilai Akhir
// Magang = rata-rata dari 3 nilai rata-rata pihak tsb (P1, P2, Pendamping
// Lapangan diberi bobot SAMA, masing-masing 1/3 - bukan dirata dari total
// seluruh indikator, supaya adil walau jumlah indikator per pihak beda).
// ============================================================================

const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf, saveGradeFinal } = require('./nilaiHelper');
const { salinNilaiMagangKeGrades } = require('./magangHelper');
const { getMagangPeriodsByMahasiswa, setNilaiMagang } = require('../models/magangPeriodModel');

// ----------------------------------------------------------------------------
// DAFTAR INDIKATOR (persis Lampiran 3 Pedoman Magang, minus form Kepala
// Bagian Magang yang tidak dipakai di sistem ini)
// ----------------------------------------------------------------------------

const ITEM_PEMBIMBING1 = [
  { kategori: 'Laporan', key: 'sistematika', label: 'Sistematika Laporan' },
  { kategori: 'Laporan', key: 'pendahuluan', label: 'Pendahuluan' },
  { kategori: 'Laporan', key: 'deskripsiIduka', label: 'Deskripsi Iduka' },
  { kategori: 'Laporan', key: 'deskripsiKegiatan', label: 'Deskripsi Kegiatan Magang' },
  { kategori: 'Laporan', key: 'deskripsiCapaian', label: 'Deskripsi Capaian Kompetensi' },
  { kategori: 'Laporan', key: 'kesimpulan', label: 'Kesimpulan' },
  { kategori: 'Laporan', key: 'rekomendasi', label: 'Rekomendasi' },
  { kategori: 'Laporan', key: 'konsultasi', label: 'Konsultasi' },
  { kategori: 'Pengetahuan', key: 'penguasaanLaporan', label: 'Kemampuan/Penguasaan Laporan' },
  { kategori: 'Pengetahuan', key: 'penyelesaianMasalah', label: 'Kemampuan Menyelesaikan Masalah' },
  { kategori: 'Pengetahuan', key: 'pemahamanTugas', label: 'Pemahaman Tugas Yang Diberikan' },
  { kategori: 'Presentasi Magang', key: 'presentasi', label: 'Kemampuan Menyampaikan/Mempresentasikan Laporan Magang' },
  { kategori: 'Presentasi Magang', key: 'menjawabPertanyaan', label: 'Kemampuan Menjawab Pertanyaan' }
];

const ITEM_PEMBIMBING2 = [
  { kategori: 'Laporan', key: 'kejujuran', label: 'Kejujuran' },
  { kategori: 'Laporan', key: 'kedisiplinan', label: 'Kedisiplinan' },
  { kategori: 'Laporan', key: 'komunikasi', label: 'Komunikasi' },
  { kategori: 'Laporan', key: 'sopanSantun', label: 'Sopan Santun/Kepatuhan' },
  { kategori: 'Laporan', key: 'kemandirian', label: 'Kemandirian' },
  { kategori: 'Laporan', key: 'inisiatif', label: 'Inisiatif' },
  { kategori: 'Laporan', key: 'tanggungJawab', label: 'Tanggung Jawab' },
  { kategori: 'Pengetahuan', key: 'penyelesaianMasalah', label: 'Kemampuan Menyelesaikan Masalah' },
  { kategori: 'Pengetahuan', key: 'pemahamanTugas', label: 'Pemahaman Tugas Yang Diberikan' },
  { kategori: 'Presentasi Magang', key: 'presentasi', label: 'Kemampuan Menyampaikan/Mempresentasikan Laporan Magang' },
  { kategori: 'Presentasi Magang', key: 'menjawabPertanyaan', label: 'Kemampuan Menjawab Pertanyaan' }
];

const ITEM_PENDAMPING_LAPANGAN = [
  { kategori: 'Keterampilan', key: 'keterampilanTeknik', label: 'Keterampilan Teknik' },
  { kategori: 'Keterampilan', key: 'kualitasHasilKerja', label: 'Kualitas/Mutu Hasil Kerja' },
  { kategori: 'Pengetahuan', key: 'penyelesaianMasalah', label: 'Kemampuan Menyelesaikan Masalah' },
  { kategori: 'Pengetahuan', key: 'pemahamanTugas', label: 'Pemahaman Tugas Yang Diberikan' },
  { kategori: 'Sikap Kerja', key: 'keselamatanKerja', label: 'Keselamatan Kerja' },
  { kategori: 'Sikap Kerja', key: 'kerjaSama', label: 'Kerja Sama' },
  { kategori: 'Sikap Kerja', key: 'mandiri', label: 'Mandiri' },
  { kategori: 'Sikap Kerja', key: 'mampuBeradaptasi', label: 'Mampu Beradaptasi' },
  { kategori: 'Logbook', key: 'logbook', label: 'Logbook' }
];

/** Hitung rata-rata dari satu set item (hanya kalau SEMUA item terisi). */
function hitungRataItem(items, daftarItem) {
  if (!items) return null;
  const nilaiTerisi = [];
  for (const it of daftarItem) {
    const v = items[it.key];
    if (v === undefined || v === null || v === '' || isNaN(parseFloat(v))) return null; // belum lengkap
    nilaiTerisi.push(parseFloat(v));
  }
  const total = nilaiTerisi.reduce((a, b) => a + b, 0);
  return Math.round((total / daftarItem.length) * 100) / 100;
}

/**
 * Ambil dokumen nilaiMagang untuk satu mahasiswa+PDK. Kalau belum ada,
 * kembalikan struktur kosong (bukan null) supaya pemanggil tidak perlu
 * cek null terus-menerus.
 */
async function getNilaiMagang(mahasiswaId, pdkId) {
  const snapshot = await db.collection('nilaiMagang')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('pdkId', '==', pdkId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      id: null,
      mahasiswaId, pdkId,
      nilaiLaporanItems: {}, nilaiLaporan: null, nilaiLaporanOleh: null, nilaiLaporanAt: null,
      logbookDikunci: false, logbookDikunciOleh: null, logbookDikunciAt: null,
      nilaiLogbookItems: {}, nilaiLogbook: null, nilaiLogbookOleh: null, nilaiLogbookAt: null,
      nilaiLapanganItems: {}, nilaiLapangan: null, nilaiLapanganOleh: null, nilaiLapanganAt: null
    };
  }
  const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  data.nilaiLaporanItems = data.nilaiLaporanItems || {};
  data.nilaiLogbookItems = data.nilaiLogbookItems || {};
  data.nilaiLapanganItems = data.nilaiLapanganItems || {};
  return data;
}

/**
 * Ambil nilaiMagang utk BANYAK mahasiswa sekaligus dalam satu PDK (1 query,
 * bukan per-mahasiswa) - dipakai halaman Rubrik & rekap kelas PDK.
 * @returns {Promise<Map<string, Object>>} key: mahasiswaId
 */
async function getNilaiMagangBanyak(pdkId) {
  const snapshot = await db.collection('nilaiMagang').where('pdkId', '==', pdkId).get();
  const map = new Map();
  snapshot.docs.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    data.nilaiLaporanItems = data.nilaiLaporanItems || {};
    data.nilaiLogbookItems = data.nilaiLogbookItems || {};
    data.nilaiLapanganItems = data.nilaiLapanganItems || {};
    map.set(data.mahasiswaId, data);
  });
  return map;
}

async function _upsertNilaiMagang(mahasiswaId, pdkId, patch) {
  const now = new Date().toISOString();
  const snapshot = await db.collection('nilaiMagang')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('pdkId', '==', pdkId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    const docRef = await db.collection('nilaiMagang').add({
      mahasiswaId, pdkId, createdAt: now, updatedAt: now, ...patch
    });
    return docRef.id;
  } else {
    await snapshot.docs[0].ref.update({ ...patch, updatedAt: now });
    return snapshot.docs[0].id;
  }
}

/**
 * Simpan Nilai Laporan (Pembimbing 1) - 13 indikator, lihat ITEM_PEMBIMBING1.
 * @param {Object} itemScores - { sistematika: 85, pendahuluan: 80, ... }
 * Sengaja TIDAK mengecek status ACC laporan di sini (biar helper tetap
 * murni) - pengecekan itu ada di route pemanggil.
 */
async function savePenilaianPembimbing1(mahasiswaId, pdkId, itemScores, dosenId) {
  const rataRata = hitungRataItem(itemScores, ITEM_PEMBIMBING1);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiLaporanItems: itemScores,
    nilaiLaporan: rataRata,
    nilaiLaporanOleh: dosenId,
    nilaiLaporanAt: new Date().toISOString()
  });
}

/**
 * Kunci logbook (Pembimbing 2) - setelah ini, form nilai baru bisa diisi.
 * Ini KUNCI KESELURUHAN periode magang (beda dari "Setujui 1 Minggu" yang
 * cuma menyetujui entri harian).
 */
async function kunciLogbookMagang(mahasiswaId, pdkId, dosenId) {
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    logbookDikunci: true,
    logbookDikunciOleh: dosenId,
    logbookDikunciAt: new Date().toISOString()
  });
}

/** Buka kunci logbook lagi (kalau pembimbing 2 perlu koreksi). */
async function bukaKunciLogbookMagang(mahasiswaId, pdkId) {
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    logbookDikunci: false,
    logbookDikunciOleh: null,
    logbookDikunciAt: null
  });
}

/**
 * Simpan Nilai Logbook/Sikap (Pembimbing 2) - 11 indikator, lihat
 * ITEM_PEMBIMBING2. Route pemanggil WAJIB memvalidasi `logbookDikunci ===
 * true` dulu sebelum memanggil ini.
 */
async function savePenilaianPembimbing2(mahasiswaId, pdkId, itemScores, dosenId) {
  const rataRata = hitungRataItem(itemScores, ITEM_PEMBIMBING2);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiLogbookItems: itemScores,
    nilaiLogbook: rataRata,
    nilaiLogbookOleh: dosenId,
    nilaiLogbookAt: new Date().toISOString()
  });
}

/**
 * Simpan Nilai Pendamping Lapangan (diinput Admin, mewakili pendamping
 * lapangan IDUKA yang tidak punya akses sistem) - 9 indikator, lihat
 * ITEM_PENDAMPING_LAPANGAN.
 */
async function savePenilaianPendampingLapangan(mahasiswaId, pdkId, itemScores, adminId) {
  const rataRata = hitungRataItem(itemScores, ITEM_PENDAMPING_LAPANGAN);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiLapanganItems: itemScores,
    nilaiLapangan: rataRata,
    nilaiLapanganOleh: adminId,
    nilaiLapanganAt: new Date().toISOString()
  });
}

/**
 * Hitung nilai akhir magang: rata-rata dari 3 nilai pihak (Pembimbing 1,
 * Pembimbing 2, Pendamping Lapangan), HANYA kalau ketiganya sudah lengkap
 * (semua indikator masing-masing terisi).
 */
function hitungNilaiAkhirMagang(nilaiMagang) {
  const { nilaiLaporan, nilaiLogbook, nilaiLapangan } = nilaiMagang;
  const belumLengkap = [];
  if (nilaiLaporan === null || nilaiLaporan === undefined) belumLengkap.push('Nilai Laporan (Pembimbing 1)');
  if (nilaiLogbook === null || nilaiLogbook === undefined) belumLengkap.push('Nilai Logbook (Pembimbing 2)');
  if (nilaiLapangan === null || nilaiLapangan === undefined) belumLengkap.push('Nilai Pendamping Lapangan (Admin)');

  if (belumLengkap.length > 0) {
    return { nilaiAkhir: null, huruf: null, keterangan: null, belumLengkap };
  }

  const nilaiAkhir = Math.round(((nilaiLaporan + nilaiLogbook + nilaiLapangan) / 3) * 100) / 100;
  return {
    nilaiAkhir,
    huruf: nilaiKeHurufMagang(nilaiAkhir),
    keterangan: nilaiAkhir >= 45 ? 'LULUS' : 'TIDAK LULUS',
    belumLengkap: []
  };
}

/** Konversi huruf - SAMA PERSIS dengan skema resmi seluruh aplikasi
 * (nilaiKeHuruf di helpers/nilaiHelper.js): A/B+/B/C+/C/D/E berbasis
 * 86/76/60/50/25/10 - konsisten dengan skala di Lampiran 3 Pedoman Magang
 * (A=86-100, B+=76-85, B=60-75, C+=50-59, C=25-49, D=10-24, E=<10) DAN
 * dengan KHS/Transkrip/Rubrik non-PDK. */
function nilaiKeHurufMagang(nilai) {
  if (nilai === null || nilai === undefined) return null;
  return nilaiKeHuruf(nilai).huruf;
}

/**
 * "Kunci" nilai akhir magang (gabungan Laporan+Logbook+Lapangan) ke
 * koleksi `grades` - supaya muncul di KHS/Transkrip mahasiswa. SENGAJA
 * berupa aksi manual yang dipicu admin (bukan otomatis begitu komponen
 * ke-3 terisi), meniru persis pola "Kunci"/"Kunci Semua" di Rubrik
 * Penilaian non-PDK.
 *
 * @param {string} mahasiswaId
 * @param {string} pdkId
 * @param {string} dikunciOleh - userId admin yang mengunci
 * @returns {Promise<{nilaiAkhir: number, huruf: string}>}
 * @throws {Error} kalau salah satu dari 3 komponen belum terisi, atau
 *   periode magang untuk mahasiswa+PDK ini tidak ditemukan
 */
async function kunciNilaiMagangKeGrades(mahasiswaId, pdkId, dikunciOleh) {
  const nilaiMagang = await getNilaiMagang(mahasiswaId, pdkId);
  const hasil = hitungNilaiAkhirMagang(nilaiMagang);

  if (hasil.nilaiAkhir === null) {
    throw new Error(`Belum bisa dikunci - komponen belum lengkap: ${hasil.belumLengkap.join(', ')}`);
  }

  const semuaPeriode = await getMagangPeriodsByMahasiswa(mahasiswaId);
  const period = semuaPeriode.find(p => p.pdkId === pdkId);
  if (!period) {
    throw new Error('Periode magang untuk mahasiswa dan PDK ini tidak ditemukan');
  }

  // 1) Catat nilai akhir gabungan di dokumen magangPeriod-nya sendiri
  // (field nilai.* - dipakai halaman-halaman yang masih baca dari sana)
  await setNilaiMagang(
    period.id,
    hasil.nilaiAkhir,
    'Nilai akhir gabungan: Laporan (Pembimbing 1) + Logbook (Pembimbing 2) + Pendamping Lapangan (Admin)',
    dikunciOleh,
    {
      nilaiLaporan: nilaiMagang.nilaiLaporan,
      nilaiLogbook: nilaiMagang.nilaiLogbook,
      nilaiLapangan: nilaiMagang.nilaiLapangan
    }
  );
  await db.collection('magangPeriod').doc(period.id).update({
    status: 'completed',
    tanggalSelesai: period.tanggalSelesai || new Date().toISOString().split('T')[0],
    completedAt: new Date().toISOString(),
    history: [
      ...(period.history || []),
      {
        action: 'completed',
        tanggal: new Date().toISOString().split('T')[0],
        nilai: hasil.nilaiAkhir,
        nilaiHuruf: hasil.huruf,
        catatan: `Dikunci dari gabungan 3 komponen nilai magang oleh admin`
      }
    ]
  });

  // 2) Salin ke koleksi 'grades' - sumber data KHS/Transkrip mahasiswa
  await salinNilaiMagangKeGrades(period, hasil.nilaiAkhir);

  return hasil;
}

module.exports = {
  ITEM_PEMBIMBING1,
  ITEM_PEMBIMBING2,
  ITEM_PENDAMPING_LAPANGAN,
  hitungRataItem,
  getNilaiMagang,
  getNilaiMagangBanyak,
  savePenilaianPembimbing1,
  kunciLogbookMagang,
  bukaKunciLogbookMagang,
  savePenilaianPembimbing2,
  savePenilaianPendampingLapangan,
  hitungNilaiAkhirMagang,
  nilaiKeHurufMagang,
  kunciNilaiMagangKeGrades
};
