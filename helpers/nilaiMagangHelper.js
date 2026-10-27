// helpers/nilaiMagangHelper.js
// ============================================================================
// NILAI MAGANG - mengikuti FORMAT PENILAIAN TERBARU Politeknik Dewantara
// ("FORM PENILAIAN MAGANG INDUSTRI"), terdiri dari DUA form:
//   1. Form Dosen Pembimbing (= Dosen PA mahasiswa, lihat helpers/pembimbingHelper.js)
//      18 indikator: Laporan (8) + Kepribadian (7) + Pengetahuan (3).
//      Presentasi Magang TIDAK ada lagi di format baru. Satu form tunggal,
//      menggantikan Nilai Laporan + Nilai Logbook yang dulu terpisah.
//   2. Form Pendamping Lapangan (IDUKA) - diinput ADMIN mewakili pendamping
//      yang tidak punya akses sistem. 10 indikator: Keterampilan (2) +
//      Pengetahuan (2) + Sikap Kerja (5) + Laporan (1).
//
// Setiap indikator diisi ANGKA 0-100. Pada form kertas, angka diletakkan di
// kolom huruf (A/B+/B/C+/C/D/E) sesuai rentangnya (A=86-100, B+=76-85,
// B=60-75, C+=50-59, C=25-49, D=10-24, E=<10) - lihat nilaiKeHuruf di
// helpers/nilaiHelper.js. Kolom "Nilai Rata-rata" dihitung PER KATEGORI,
// "Total" = jumlah seluruh indikator, "Rata-rata Nilai Akhir" = Total / jumlah
// indikator.
//
// NILAI AKHIR MAGANG = rata-rata 2 komponen (Dosen Pembimbing & Pendamping
// Lapangan), bobot sama 50:50.
//
// KOMPATIBILITAS DATA LAMA (koleksi `nilaiMagang`):
//   - Field baru: nilaiDosenItems, nilaiDosen, nilaiDosenOleh, nilaiDosenAt.
//   - Field lama nilaiLaporan/nilaiLogbook TIDAK dihapus. Kalau nilaiDosen belum
//     ada tapi nilaiLaporan & nilaiLogbook lama sudah terisi, komponen Dosen
//     dihitung dari rata-rata keduanya (lihat getNilaiDosenEfektif).
//   - nilaiLapanganItems dipakai ulang. Data lama (9 indikator, kunci
//     `logbook`, tanpa `disiplin`) tetap terbaca; nilaiLapangan lama tetap
//     dipakai sampai admin menyimpan ulang dengan form baru.
// ============================================================================

const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf, saveGradeFinal } = require('./nilaiHelper');
const { salinNilaiMagangKeGrades } = require('./magangHelper');
const { getMagangPeriodsByMahasiswa, setNilaiMagang } = require('../models/magangPeriodModel');

// ----------------------------------------------------------------------------
// DAFTAR INDIKATOR (persis Lampiran 3 Pedoman Magang, minus form Kepala
// Bagian Magang yang tidak dipakai di sistem ini)
// ----------------------------------------------------------------------------

// FORM DOSEN PEMBIMBING - 18 indikator (urutan & label persis form kertas)
const ITEM_NILAI_DOSEN = [
  { kategori: 'Laporan', key: 'sistematika', label: 'Sistematika Laporan' },
  { kategori: 'Laporan', key: 'pendahuluan', label: 'Pendahuluan' },
  { kategori: 'Laporan', key: 'deskripsiIduka', label: 'Deskripsi Iduka' },
  { kategori: 'Laporan', key: 'deskripsiKegiatan', label: 'Deskripsi Kegiatan Magang' },
  { kategori: 'Laporan', key: 'deskripsiCapaian', label: 'Deskripsi Capaian Kompetensi' },
  { kategori: 'Laporan', key: 'kesimpulan', label: 'Kesimpulan' },
  { kategori: 'Laporan', key: 'rekomendasi', label: 'Rekomendasi' },
  { kategori: 'Laporan', key: 'konsultasi', label: 'Konsultasi' },
  { kategori: 'Kepribadian', key: 'kejujuran', label: 'Kejujuran' },
  { kategori: 'Kepribadian', key: 'kedisiplinan', label: 'Kedisiplinan' },
  { kategori: 'Kepribadian', key: 'komunikasi', label: 'Komunikasi' },
  { kategori: 'Kepribadian', key: 'sopanSantun', label: 'Sopan Santun/Kepatuhan' },
  { kategori: 'Kepribadian', key: 'kemandirian', label: 'Kemandirian' },
  { kategori: 'Kepribadian', key: 'inisiatif', label: 'Inisiatif' },
  { kategori: 'Kepribadian', key: 'tanggungJawab', label: 'Tanggung Jawab' },
  { kategori: 'Pengetahuan', key: 'penguasaanLaporan', label: 'Kemampuan/Penguasaan Laporan' },
  { kategori: 'Pengetahuan', key: 'penyelesaianMasalah', label: 'Kemampuan Menyelesaikan Masalah' },
  { kategori: 'Pengetahuan', key: 'pemahamanTugas', label: 'Pemahaman Tugas Yang Diberikan' }
];

// FORM PENDAMPING LAPANGAN (IDUKA) - 10 indikator
const ITEM_PENDAMPING_LAPANGAN = [
  { kategori: 'Keterampilan', key: 'keterampilanTeknik', label: 'Keterampilan Teknik' },
  { kategori: 'Keterampilan', key: 'kualitasHasilKerja', label: 'Kualitas/Mutu Hasil Kerja' },
  { kategori: 'Pengetahuan', key: 'penyelesaianMasalah', label: 'Kemampuan Menyelesaikan Masalah' },
  { kategori: 'Pengetahuan', key: 'pemahamanTugas', label: 'Pemahaman Tugas Yang Diberikan' },
  { kategori: 'Sikap Kerja', key: 'keselamatanKerja', label: 'Keselamatan Kerja' },
  { kategori: 'Sikap Kerja', key: 'kerjaSama', label: 'Kerja Sama' },
  { kategori: 'Sikap Kerja', key: 'disiplin', label: 'Disiplin' },
  { kategori: 'Sikap Kerja', key: 'mandiri', label: 'Mandiri' },
  { kategori: 'Sikap Kerja', key: 'mampuBeradaptasi', label: 'Mampu Beradaptasi' },
  { kategori: 'Laporan', key: 'laporan', label: 'Laporan' }
];

/** Urutan kategori unik sesuai daftar item (untuk render form & cetak). */
function daftarKategori(daftarItem) {
  const out = [];
  daftarItem.forEach(it => { if (!out.includes(it.kategori)) out.push(it.kategori); });
  return out;
}

/**
 * Rincian satu form: rata-rata per kategori, total, dan rata-rata akhir.
 * @returns {{perKategori: Object<string, number|null>, total: number|null, rataAkhir: number|null}}
 *   null kalau ada indikator yang belum terisi.
 */
function hitungRincian(items, daftarItem) {
  const perKategori = {};
  let total = 0;
  let lengkap = !!items;
  daftarKategori(daftarItem).forEach(kat => {
    const dalam = daftarItem.filter(it => it.kategori === kat);
    const angka = dalam.map(it => (items ? parseFloat(items[it.key]) : NaN));
    if (angka.some(n => isNaN(n))) { perKategori[kat] = null; lengkap = false; return; }
    const jml = angka.reduce((a, b) => a + b, 0);
    total += jml;
    perKategori[kat] = Math.round((jml / angka.length) * 100) / 100;
  });
  return {
    perKategori,
    total: lengkap ? Math.round(total * 100) / 100 : null,
    rataAkhir: lengkap ? Math.round((total / daftarItem.length) * 100) / 100 : null
  };
}

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

/** Pastikan semua map item ada (dokumen lama tidak punya nilaiDosenItems). */
function normalisasiNilai(data) {
  data.nilaiDosenItems = data.nilaiDosenItems || {};
  data.nilaiLaporanItems = data.nilaiLaporanItems || {};
  data.nilaiLogbookItems = data.nilaiLogbookItems || {};
  data.nilaiLapanganItems = data.nilaiLapanganItems || {};
  if (data.nilaiDosen === undefined) data.nilaiDosen = null;
  return data;
}

/**
 * Komponen Dosen Pembimbing yang berlaku:
 *  - form baru (nilaiDosen) kalau sudah diisi,
 *  - kalau belum tapi Nilai Laporan & Nilai Logbook lama sudah ada,
 *    rata-rata keduanya (data sebelum format baru),
 *  - selain itu null.
 * @returns {{nilai: number|null, sumber: 'baru'|'lama'|null}}
 */
function getNilaiDosenEfektif(nilaiMagang) {
  if (!nilaiMagang) return { nilai: null, sumber: null };
  if (nilaiMagang.nilaiDosen !== null && nilaiMagang.nilaiDosen !== undefined) {
    return { nilai: nilaiMagang.nilaiDosen, sumber: 'baru' };
  }
  const { nilaiLaporan, nilaiLogbook } = nilaiMagang;
  if (nilaiLaporan !== null && nilaiLaporan !== undefined && nilaiLogbook !== null && nilaiLogbook !== undefined) {
    return { nilai: Math.round(((nilaiLaporan + nilaiLogbook) / 2) * 100) / 100, sumber: 'lama' };
  }
  return { nilai: null, sumber: null };
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
      nilaiDosenItems: {}, nilaiDosen: null, nilaiDosenOleh: null, nilaiDosenAt: null,
      // field lama (sebelum format baru) - hanya dibaca untuk kompatibilitas
      nilaiLaporanItems: {}, nilaiLaporan: null, nilaiLaporanOleh: null, nilaiLaporanAt: null,
      logbookDikunci: false, logbookDikunciOleh: null, logbookDikunciAt: null,
      nilaiLogbookItems: {}, nilaiLogbook: null, nilaiLogbookOleh: null, nilaiLogbookAt: null,
      nilaiLapanganItems: {}, nilaiLapangan: null, nilaiLapanganOleh: null, nilaiLapanganAt: null
    };
  }
  const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  return normalisasiNilai(data);
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
    const data = normalisasiNilai({ id: doc.id, ...doc.data() });
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
 * Simpan Penilaian Dosen Pembimbing (Dosen PA) - 18 indikator, lihat
 * ITEM_NILAI_DOSEN. Pengecekan prasyarat (laporan di-ACC & logbook dikunci)
 * ada di route pemanggil supaya helper ini tetap murni.
 * @param {Object} itemScores - { sistematika: 85, pendahuluan: 80, ... }
 * @param {string} [catatan] - kotak "Catatan Dosen Pembimbing" di form kertas
 */
async function savePenilaianDosen(mahasiswaId, pdkId, itemScores, dosenId, catatan) {
  const rataRata = hitungRataItem(itemScores, ITEM_NILAI_DOSEN);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiDosenItems: itemScores,
    nilaiDosen: rataRata,
    nilaiDosenOleh: dosenId,
    nilaiDosenAt: new Date().toISOString(),
    catatanDosen: String(catatan || '').trim().slice(0, 1000)
  });
}

/**
 * Kunci logbook (Dosen Pembimbing/PA) - salah satu prasyarat form penilaian Dosen Pembimbing.
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

/** Buka kunci logbook lagi (kalau dosen pembimbing perlu koreksi). */
async function bukaKunciLogbookMagang(mahasiswaId, pdkId) {
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    logbookDikunci: false,
    logbookDikunciOleh: null,
    logbookDikunciAt: null
  });
}

/**
 * Simpan Nilai Pendamping Lapangan (diinput Admin, mewakili pendamping
 * lapangan IDUKA yang tidak punya akses sistem) - 10 indikator, lihat
 * ITEM_PENDAMPING_LAPANGAN.
 */
async function savePenilaianPendampingLapangan(mahasiswaId, pdkId, itemScores, adminId, catatan) {
  const rataRata = hitungRataItem(itemScores, ITEM_PENDAMPING_LAPANGAN);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiLapanganItems: itemScores,
    nilaiLapangan: rataRata,
    nilaiLapanganOleh: adminId,
    nilaiLapanganAt: new Date().toISOString(),
    catatanLapangan: String(catatan || '').trim().slice(0, 1000)
  });
}

/**
 * Hitung nilai akhir magang: rata-rata 2 komponen (Dosen Pembimbing &
 * Pendamping Lapangan), HANYA kalau keduanya sudah lengkap.
 */
function hitungNilaiAkhirMagang(nilaiMagang) {
  const dosen = getNilaiDosenEfektif(nilaiMagang);
  const { nilaiLapangan } = nilaiMagang;
  const belumLengkap = [];
  if (dosen.nilai === null) belumLengkap.push('Penilaian Dosen Pembimbing');
  if (nilaiLapangan === null || nilaiLapangan === undefined) belumLengkap.push('Penilaian Pendamping Lapangan (Admin)');

  if (belumLengkap.length > 0) {
    return { nilaiAkhir: null, huruf: null, keterangan: null, belumLengkap };
  }

  const nilaiAkhir = Math.round(((dosen.nilai + nilaiLapangan) / 2) * 100) / 100;
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
 * "Kunci" nilai akhir magang (gabungan Dosen Pembimbing + Pendamping Lapangan) ke
 * koleksi `grades` - supaya muncul di KHS/Transkrip mahasiswa. SENGAJA
 * berupa aksi manual yang dipicu admin (bukan otomatis begitu komponen
 * ke-3 terisi), meniru persis pola "Kunci"/"Kunci Semua" di Rubrik
 * Penilaian non-PDK.
 *
 * @param {string} mahasiswaId
 * @param {string} pdkId
 * @param {string} dikunciOleh - userId admin yang mengunci
 * @returns {Promise<{nilaiAkhir: number, huruf: string}>}
 * @throws {Error} kalau salah satu dari 2 komponen belum terisi, atau
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
    'Nilai akhir gabungan: Dosen Pembimbing + Pendamping Lapangan (Admin)',
    dikunciOleh,
    {
      nilaiDosen: getNilaiDosenEfektif(nilaiMagang).nilai,
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
        catatan: `Dikunci dari gabungan 2 komponen nilai magang (Dosen Pembimbing + Pendamping Lapangan) oleh admin`
      }
    ]
  });

  // 2) Salin ke koleksi 'grades' - sumber data KHS/Transkrip mahasiswa
  await salinNilaiMagangKeGrades(period, hasil.nilaiAkhir);

  return hasil;
}

module.exports = {
  ITEM_NILAI_DOSEN,
  ITEM_PENDAMPING_LAPANGAN,
  daftarKategori,
  hitungRataItem,
  hitungRincian,
  getNilaiDosenEfektif,
  getNilaiMagang,
  getNilaiMagangBanyak,
  savePenilaianDosen,
  kunciLogbookMagang,
  bukaKunciLogbookMagang,
  savePenilaianPendampingLapangan,
  hitungNilaiAkhirMagang,
  nilaiKeHurufMagang,
  kunciNilaiMagangKeGrades
};
