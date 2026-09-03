// models/magangPeriodModel.js
const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf } = require('../helpers/nilaiHelper');

// Konstanta Status
const MAGANG_STATUS = {
  ACTIVE: 'active',      // Magang berjalan
  LOCKED: 'locked',      // Dikunci sementara
  COMPLETED: 'completed', // Selesai
  CANCELLED: 'cancelled'  // Dibatalkan
};

/**
 * Membuat periode magang baru
 * @param {Object} data - Data periode magang
 * @returns {Promise<string>} ID periode magang
 */
async function createMagangPeriod(data) {
  const now = new Date().toISOString();
  
  const periodData = {
    // Identitas
    mahasiswaId: data.mahasiswaId,
    pdkId: data.pdkId,
    pdkKode: data.pdkKode,
    pdkNama: data.pdkNama,
    
    // Periode
    tanggalMulai: data.tanggalMulai,
    tanggalSelesai: data.tanggalSelesai || null,
    status: MAGANG_STATUS.ACTIVE,
    
    // Dosen Pembimbing
    pembimbing1Id: data.pembimbing1Id,
    pembimbing1Nama: data.pembimbing1Nama,
    pembimbing2Id: data.pembimbing2Id || null,
    pembimbing2Nama: data.pembimbing2Nama || null,
    
    // Perusahaan
    perusahaan: {
      nama: data.namaPerusahaan || '',
      alamat: data.alamatPerusahaan || '',
      kontak: data.kontakPerusahaan || '',
      kontakHp: data.kontakHpPerusahaan || '',
      email: data.emailPerusahaan || '',
      website: data.websitePerusahaan || '',
      pembimbingLapangan: data.pembimbingLapangan || '',
      jabatanPembimbingLapangan: data.jabatanPembimbingLapangan || '',
      diisiOleh: data.diisiOleh,
      diisiPada: now
    },
    
    // Nilai
    nilai: {
      angka: null,
      huruf: null,
      komentar: null,
      dinilaiOleh: null,
      dinilaiPada: null,
      komponenNilai: {}
    },
    
    // Ulasan Mahasiswa
    ulasan: {
      isFilled: false,
      deskripsiPerusahaan: '',
      fasilitasMagang: '',
      saranUntukJunior: '',
      pengalamanKerja: '',
      rating: null,
      diisiPada: null,
      diisiOleh: null
    },
    
    // Lock History
    lockHistory: [],
    
    // Timestamps
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    
    // History Perubahan
    history: [{
      action: 'created',
      tanggal: now.split('T')[0],
      catatan: 'Periode magang dibuat',
      oleh: data.diisiOleh
    }]
  };
  
  const docRef = await db.collection('magangPeriod').add(periodData);
  return docRef.id;
}

/**
 * Mendapatkan periode magang berdasarkan ID
 * @param {string} periodId - ID periode magang
 * @returns {Promise<Object|null>}
 */
async function getMagangPeriodById(periodId) {
  const doc = await db.collection('magangPeriod').doc(periodId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/**
 * Mendapatkan semua periode magang mahasiswa
 * @param {string} mahasiswaId - UID mahasiswa
 * @returns {Promise<Array>}
 */
async function getMagangPeriodsByMahasiswa(mahasiswaId) {
  const snapshot = await db.collection('magangPeriod')
    .where('mahasiswaId', '==', mahasiswaId)
    .orderBy('pdkKode', 'asc')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Mendapatkan periode magang aktif mahasiswa
 * @param {string} mahasiswaId - UID mahasiswa
 * @returns {Promise<Array>}
 */
async function getActiveMagangPeriods(mahasiswaId) {
  const snapshot = await db.collection('magangPeriod')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('status', '==', MAGANG_STATUS.ACTIVE)
    .get();
  
  const activePeriods = [];
  const today = new Date().toISOString().split('T')[0];
  
  for (const doc of snapshot.docs) {
    const period = doc.data();
    
    // Cek apakah dalam periode tanggal
    let isInPeriod = true;
    if (period.tanggalMulai && today < period.tanggalMulai) isInPeriod = false;
    if (period.tanggalSelesai && today > period.tanggalSelesai) isInPeriod = false;
    
    if (isInPeriod) {
      activePeriods.push({ id: doc.id, ...period });
    }
  }
  
  return activePeriods;
}

/**
 * Mendapatkan periode magang yang sudah selesai
 * @param {string} mahasiswaId - UID mahasiswa
 * @returns {Promise<Array>}
 */
async function getCompletedMagangPeriods(mahasiswaId) {
  const snapshot = await db.collection('magangPeriod')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('status', '==', MAGANG_STATUS.COMPLETED)
    .orderBy('completedAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Update status periode magang
 * @param {string} periodId - ID periode
 * @param {string} status - Status baru
 * @param {string} reason - Alasan perubahan
 * @param {string} updatedBy - UID yang mengubah
 */
async function updatePeriodStatus(periodId, status, reason = '', updatedBy = '') {
  const periodRef = db.collection('magangPeriod').doc(periodId);
  const periodDoc = await periodRef.get();
  
  if (!periodDoc.exists) {
    throw new Error('Periode magang tidak ditemukan');
  }
  
  const period = periodDoc.data();
  const now = new Date().toISOString();
  
  const updateData = {
    status,
    updatedAt: now,
    history: [
      ...(period.history || []),
      {
        action: status,
        tanggal: now.split('T')[0],
        catatan: reason,
        oleh: updatedBy
      }
    ]
  };
  
  if (status === MAGANG_STATUS.COMPLETED) {
    updateData.completedAt = now;
  }
  
  await periodRef.update(updateData);
}

/**
 * Beri nilai magang
 * @param {string} periodId - ID periode
 * @param {number} nilaiAngka - Nilai angka (0-100)
 * @param {string} komentar - Komentar dosen
 * @param {string} dinilaiOleh - UID dosen
 * @param {Object} komponenNilai - Nilai per komponen (opsional)
 */
async function setNilaiMagang(periodId, nilaiAngka, komentar, dinilaiOleh, komponenNilai = {}) {
  const periodRef = db.collection('magangPeriod').doc(periodId);
  const periodDoc = await periodRef.get();
  
  if (!periodDoc.exists) {
    throw new Error('Periode magang tidak ditemukan');
  }
  
  // Hitung nilai huruf - skala resmi yang sama dengan KHS/Transkrip/Rubrik
  // (helpers/nilaiHelper.js -> nilaiKeHuruf), supaya konsisten di seluruh app.
  const nilaiHuruf = nilaiKeHuruf(nilaiAngka).huruf;
  
  await periodRef.update({
    'nilai.angka': nilaiAngka,
    'nilai.huruf': nilaiHuruf,
    'nilai.komentar': komentar || '',
    'nilai.dinilaiOleh': dinilaiOleh,
    'nilai.dinilaiPada': new Date().toISOString(),
    'nilai.komponenNilai': komponenNilai,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Lock periode magang (hentikan sementara - mahasiswa tidak bisa isi
 * logbook harian baru selama status ini, lihat helpers/magangHelper.js
 * -> canSubmitLogbook). CATATAN: ini BEDA dari "kunci logbook untuk
 * penilaian" (nilaiMagang.logbookDikunci di helpers/nilaiMagangHelper.js)
 * - itu flag terpisah, di collection lain, khusus Pembimbing 2, dan
 * gunanya membuka form Nilai Logbook. Keduanya sama-sama disebut "kunci"
 * tapi tidak saling mempengaruhi.
 * @param {string} periodId - ID periode
 * @param {string} reason - Alasan lock
 * @param {{id: string, nama: string}} actor - Pengguna yang mengunci (dosen atau admin)
 */
async function lockMagangPeriod(periodId, reason, actor) {
  const periodRef = db.collection('magangPeriod').doc(periodId);
  const periodDoc = await periodRef.get();
  
  if (!periodDoc.exists) {
    throw new Error('Periode magang tidak ditemukan');
  }
  
  const period = periodDoc.data();
  if (period.status === MAGANG_STATUS.COMPLETED) {
    throw new Error('Magang sudah selesai, tidak bisa dikunci');
  }
  const now = new Date().toISOString();
  
  const lockHistory = period.lockHistory || [];
  lockHistory.push({
    action: 'locked',
    reason: reason || 'Tidak ada alasan',
    lockedBy: actor.id,
    lockedByNama: actor.nama,
    lockedAt: now
  });
  
  await periodRef.update({
    status: MAGANG_STATUS.LOCKED,
    lockHistory,
    updatedAt: now,
    history: [
      ...(period.history || []),
      {
        action: 'locked',
        tanggal: now.split('T')[0],
        catatan: `Periode magang dikunci oleh ${actor.nama}`,
        reason: reason || 'Tidak ada alasan',
        oleh: actor.id
      }
    ]
  });
  return { mahasiswaId: period.mahasiswaId };
}

/**
 * Unlock periode magang (buka kembali dari status locked ke active).
 * @param {string} periodId - ID periode
 * @param {string} reason - Alasan unlock
 * @param {{id: string, nama: string}} actor - Pengguna yang membuka kunci (dosen atau admin)
 */
async function unlockMagangPeriod(periodId, reason, actor) {
  const periodRef = db.collection('magangPeriod').doc(periodId);
  const periodDoc = await periodRef.get();
  
  if (!periodDoc.exists) {
    throw new Error('Periode magang tidak ditemukan');
  }
  
  const period = periodDoc.data();
  const now = new Date().toISOString();
  
  const lockHistory = period.lockHistory || [];
  lockHistory.push({
    action: 'unlocked',
    reason: reason || 'Tidak ada alasan',
    unlockedBy: actor.id,
    unlockedByNama: actor.nama,
    unlockedAt: now
  });
  
  await periodRef.update({
    status: MAGANG_STATUS.ACTIVE,
    lockHistory,
    updatedAt: now,
    history: [
      ...(period.history || []),
      {
        action: 'unlocked',
        tanggal: now.split('T')[0],
        catatan: `Periode magang dibuka kembali oleh ${actor.nama}`,
        reason: reason || 'Tidak ada alasan',
        oleh: actor.id
      }
    ]
  });
  return { mahasiswaId: period.mahasiswaId };
}

/**
 * Perpanjang periode magang (ubah tanggal selesai).
 * @param {string} periodId - ID periode
 * @param {string} tanggalSelesaiBaru - Tanggal selesai baru
 * @param {string} catatan - Catatan perpanjangan
 * @param {{id: string, nama: string}} actor - Pengguna yang memperpanjang (dosen atau admin)
 */
async function extendMagangPeriod(periodId, tanggalSelesaiBaru, catatan, actor) {
  const periodRef = db.collection('magangPeriod').doc(periodId);
  const periodDoc = await periodRef.get();
  
  if (!periodDoc.exists) {
    throw new Error('Periode magang tidak ditemukan');
  }
  
  const period = periodDoc.data();
  const now = new Date().toISOString();
  
  await periodRef.update({
    tanggalSelesai: tanggalSelesaiBaru,
    updatedAt: now,
    history: [
      ...(period.history || []),
      {
        action: 'extended',
        tanggal: now.split('T')[0],
        oldSelesai: period.tanggalSelesai || '-',
        newSelesai: tanggalSelesaiBaru,
        catatan: catatan || `Perpanjangan periode magang oleh ${actor.nama}`,
        oleh: actor.id
      }
    ]
  });
  return { mahasiswaId: period.mahasiswaId };
}

/**
 * Koreksi tanggal mulai periode magang - BEDA dari extendMagangPeriod
 * yang mengubah tanggal SELESAI. Dipakai kalau tanggal mulai yang
 * diinput waktu "Mulai Periode Baru" ternyata salah/perlu dikoreksi.
 * @param {string} periodId - ID periode
 * @param {string} tanggalMulaiBaru - Tanggal mulai baru
 * @param {string} catatan - Catatan koreksi
 * @param {{id: string, nama: string}} actor - Pengguna yang mengoreksi (dosen atau admin)
 */
async function editTanggalMulaiMagangPeriod(periodId, tanggalMulaiBaru, catatan, actor) {
  const periodRef = db.collection('magangPeriod').doc(periodId);
  const periodDoc = await periodRef.get();

  if (!periodDoc.exists) {
    throw new Error('Periode magang tidak ditemukan');
  }

  const period = periodDoc.data();
  const now = new Date().toISOString();
  const oldMulai = period.tanggalMulai || '-';

  await periodRef.update({
    tanggalMulai: tanggalMulaiBaru,
    updatedAt: now,
    history: [
      ...(period.history || []),
      {
        action: 'edit_tanggal_mulai',
        tanggal: now.split('T')[0],
        oldMulai,
        newMulai: tanggalMulaiBaru,
        catatan: catatan || `Koreksi tanggal mulai oleh ${actor.nama}`,
        oleh: actor.id
      }
    ]
  });
  return { mahasiswaId: period.mahasiswaId };
}

/**
 * Update data perusahaan tempat magang pada satu periode.
 * @param {string} periodId - ID periode
 * @param {Object} perusahaan - { nama, alamat, kontak, kontakHp, email, website, pembimbingLapangan, jabatanPembimbingLapangan }
 * @param {{id: string, nama: string}} actor - Pengguna yang mengubah (dosen atau admin)
 */
async function updatePerusahaanMagangPeriod(periodId, perusahaan, actor) {
  const periodRef = db.collection('magangPeriod').doc(periodId);
  const periodDoc = await periodRef.get();

  if (!periodDoc.exists) {
    throw new Error('Periode magang tidak ditemukan');
  }
  const period = periodDoc.data();

  await periodRef.update({
    'perusahaan.nama': perusahaan.nama,
    'perusahaan.alamat': perusahaan.alamat || '',
    'perusahaan.kontak': perusahaan.kontak || '',
    'perusahaan.kontakHp': perusahaan.kontakHp || '',
    'perusahaan.email': perusahaan.email || '',
    'perusahaan.website': perusahaan.website || '',
    'perusahaan.pembimbingLapangan': perusahaan.pembimbingLapangan || '',
    'perusahaan.jabatanPembimbingLapangan': perusahaan.jabatanPembimbingLapangan || '',
    'perusahaan.diisiOleh': actor.id,
    'perusahaan.diisiPada': new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return { mahasiswaId: period.mahasiswaId };
}

module.exports = {
  MAGANG_STATUS,
  createMagangPeriod,
  getMagangPeriodById,
  getMagangPeriodsByMahasiswa,
  getActiveMagangPeriods,
  getCompletedMagangPeriods,
  updatePeriodStatus,
  setNilaiMagang,
  lockMagangPeriod,
  unlockMagangPeriod,
  extendMagangPeriod,
  editTanggalMulaiMagangPeriod,
  updatePerusahaanMagangPeriod
};