// helpers/nilaiMagangHelper.js
// ============================================================================
// NILAI MAGANG - 3 komponen nilai magang (PDK) yang digabung jadi satu
// nilai akhir per mahasiswa per periode magang (pdkId):
//   1. Nilai Laporan   - diisi PEMBIMBING 1, setelah laporan mahasiswa di-ACC
//   2. Nilai Logbook   - diisi PEMBIMBING 2, setelah logbook DIKUNCI
//   3. Nilai Lapangan  - diisi ADMIN (mewakili pembimbing lapangan di
//                        perusahaan, yang tidak punya akses sistem)
// Ketiganya dirata-rata jadi Nilai Akhir Magang, yang lalu dipakai sebagai
// Nilai Akhir MK PDK terkait di Rubrik Penilaian, dan bisa dikunci ke
// transkrip/KHS lewat mekanisme yang sama seperti rubrik non-PDK.
// ============================================================================

const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf, saveGradeFinal } = require('./nilaiHelper');
const { salinNilaiMagangKeGrades } = require('./magangHelper');
const { getMagangPeriodsByMahasiswa, setNilaiMagang } = require('../models/magangPeriodModel');

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
      nilaiLaporan: null, nilaiLaporanOleh: null, nilaiLaporanAt: null,
      logbookDikunci: false, logbookDikunciOleh: null, logbookDikunciAt: null,
      nilaiLogbook: null, nilaiLogbookOleh: null, nilaiLogbookAt: null,
      nilaiLapangan: null, nilaiLapanganOleh: null, nilaiLapanganAt: null
    };
  }
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Ambil nilaiMagang utk BANYAK mahasiswa sekaligus dalam satu PDK (1 query,
 * bukan per-mahasiswa) - dipakai halaman Rubrik & rekap kelas PDK.
 * @returns {Promise<Map<string, Object>>} key: mahasiswaId
 */
async function getNilaiMagangBanyak(pdkId) {
  const snapshot = await db.collection('nilaiMagang').where('pdkId', '==', pdkId).get();
  const map = new Map();
  snapshot.docs.forEach(doc => map.set(doc.data().mahasiswaId, { id: doc.id, ...doc.data() }));
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
 * Simpan Nilai Laporan (Pembimbing 1). Sengaja TIDAK mengecek status ACC di
 * sini (biar helper tetap murni/fleksibel) - pengecekan "laporan sudah
 * di-ACC belum" dilakukan di route pemanggil, supaya pesan errornya lebih
 * spesifik ke konteks halaman laporan.
 */
async function saveNilaiLaporan(mahasiswaId, pdkId, nilai, dosenId) {
  const nilaiAngka = parseFloat(nilai);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiLaporan: nilaiAngka,
    nilaiLaporanOleh: dosenId,
    nilaiLaporanAt: new Date().toISOString()
  });
}

/**
 * Kunci logbook (Pembimbing 2) - setelah ini, nilai logbook baru bisa
 * diisi. Ini KUNCI KESELURUHAN periode magang (beda dari "Setujui 1
 * Minggu" yang cuma menyetujui entri harian) - menandai bahwa pembimbing 2
 * sudah selesai meninjau SELURUH logbook mahasiswa ini utk PDK ini.
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
 * Simpan Nilai Logbook (Pembimbing 2). Route pemanggil WAJIB memvalidasi
 * `logbookDikunci === true` dulu sebelum memanggil ini (helper ini sendiri
 * tidak menolak, supaya tetap murni - validasi ada di layer route).
 */
async function saveNilaiLogbook(mahasiswaId, pdkId, nilai, dosenId) {
  const nilaiAngka = parseFloat(nilai);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiLogbook: nilaiAngka,
    nilaiLogbookOleh: dosenId,
    nilaiLogbookAt: new Date().toISOString()
  });
}

/** Simpan Nilai Lapangan (input Admin, mewakili pembimbing lapangan). */
async function saveNilaiLapangan(mahasiswaId, pdkId, nilai, adminId) {
  const nilaiAngka = parseFloat(nilai);
  return _upsertNilaiMagang(mahasiswaId, pdkId, {
    nilaiLapangan: nilaiAngka,
    nilaiLapanganOleh: adminId,
    nilaiLapanganAt: new Date().toISOString()
  });
}

/**
 * Hitung nilai akhir magang: rata-rata dari 3 komponen, HANYA kalau
 * ketiganya sudah terisi (sama seperti prinsip rubrik non-PDK - tidak
 * menghitung nilai akhir prematur dari data yang belum lengkap).
 */
function hitungNilaiAkhirMagang(nilaiMagang) {
  const { nilaiLaporan, nilaiLogbook, nilaiLapangan } = nilaiMagang;
  const belumLengkap = [];
  if (nilaiLaporan === null || nilaiLaporan === undefined) belumLengkap.push('Nilai Laporan (Pembimbing 1)');
  if (nilaiLogbook === null || nilaiLogbook === undefined) belumLengkap.push('Nilai Logbook (Pembimbing 2)');
  if (nilaiLapangan === null || nilaiLapangan === undefined) belumLengkap.push('Nilai Lapangan (Admin)');

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
 * 86/76/60/50/25/10, BUKAN skala lama 85/75/65/dst - supaya huruf nilai
 * magang konsisten dengan KHS/Transkrip/Rubrik non-PDK. */
function nilaiKeHurufMagang(nilai) {
  if (nilai === null || nilai === undefined) return null;
  return nilaiKeHuruf(nilai).huruf;
}

/**
 * "Kunci" nilai akhir magang (gabungan Laporan+Logbook+Lapangan) ke
 * koleksi `grades` - supaya muncul di KHS/Transkrip mahasiswa. SENGAJA
 * berupa aksi manual yang dipicu admin (bukan otomatis begitu komponen
 * ke-3 terisi), meniru persis pola "Kunci"/"Kunci Semua" di Rubrik
 * Penilaian non-PDK - admin tetap yang berwenang menentukan kapan nilai
 * dianggap final dan resmi masuk transkrip.
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
    'Nilai akhir gabungan: Laporan (Pembimbing 1) + Logbook (Pembimbing 2) + Lapangan (Admin)',
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
  getNilaiMagang,
  getNilaiMagangBanyak,
  saveNilaiLaporan,
  kunciLogbookMagang,
  bukaKunciLogbookMagang,
  saveNilaiLogbook,
  saveNilaiLapangan,
  hitungNilaiAkhirMagang,
  nilaiKeHurufMagang,
  kunciNilaiMagangKeGrades
};
