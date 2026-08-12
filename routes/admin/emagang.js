/**
 * routes/admin/emagang.js
 * E‑Magang - Admin/Kaprodi melihat dan mengelola logbook mahasiswa
 * Fitur lengkap: Mulai periode, Edit perusahaan, Lock/Unlock, Extend, Complete & Nilai
 * OPTIMASI: Cache sederhana + Promise.all untuk mengurangi query berulang.
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { nilaiKeHuruf } = require('../../helpers/nilaiHelper');
const { invalidateProgressMagangHarian, salinNilaiMagangKeGrades } = require('../../helpers/magangHelper');
const { ITEM_PENDAMPING_LAPANGAN, getNilaiMagang, savePenilaianPendampingLapangan, hitungNilaiAkhirMagang, kunciNilaiMagangKeGrades } = require('../../helpers/nilaiMagangHelper');

router.use(verifyToken);
router.use(isAdmin);

// ============================================================================
// CACHE SEDERHANA (untuk satu request)
// ============================================================================
const cache = {
  mahasiswa: new Map(),      // userId -> { nama, nim, ... }
  bimbingan: new Map(),      // mahasiswaId -> data bimbingan
  magangPeriods: new Map(),  // mahasiswaId -> array periode
  logbookStats: new Map()     // key "userId_pdkId" -> { total, pending, approved, rejected }
};

function clearCache() {
  cache.mahasiswa.clear();
  cache.bimbingan.clear();
  cache.magangPeriods.clear();
  cache.logbookStats.clear();
}

// ============================================================================
// FUNGSI BANTU (dengan cache)
// ============================================================================

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function getMahasiswa(userId) {
  if (cache.mahasiswa.has(userId)) return cache.mahasiswa.get(userId);
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const data = userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : { id: userId, nama: 'Unknown', nim: '-' };
    cache.mahasiswa.set(userId, data);
    return data;
  } catch (error) {
    console.error('Error getMahasiswa:', error);
    return { id: userId, nama: 'Error', nim: '-' };
  }
}

async function getBimbingan(mahasiswaId) {
  if (cache.bimbingan.has(mahasiswaId)) return cache.bimbingan.get(mahasiswaId);
  try {
    const snapshot = await db.collection('bimbingan')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const data = snapshot.docs[0].data();
    cache.bimbingan.set(mahasiswaId, data);
    return data;
  } catch (error) {
    console.error('Error getBimbingan:', error);
    return null;
  }
}

async function getMagangPeriods(mahasiswaId) {
  if (cache.magangPeriods.has(mahasiswaId)) return cache.magangPeriods.get(mahasiswaId);
  try {
    const snapshot = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .orderBy('pdkKode', 'asc')
      .get();
    const periods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    cache.magangPeriods.set(mahasiswaId, periods);
    return periods;
  } catch (error) {
    console.error('Error getMagangPeriods:', error);
    return [];
  }
}

async function getLogbookStats(mahasiswaId, pdkId = null) {
  const key = pdkId ? `${mahasiswaId}_${pdkId}` : mahasiswaId;
  if (cache.logbookStats.has(key)) return cache.logbookStats.get(key);
  try {
    let query = db.collection('logbookMagang')
      .where('userId', '==', mahasiswaId);
    if (pdkId) query = query.where('pdkId', '==', pdkId);
    const snapshot = await query.get();
    let total = 0, pending = 0, approved = 0, rejected = 0;
    snapshot.forEach(doc => {
      total++;
      const status = doc.data().status;
      if (status === 'pending') pending++;
      else if (status === 'approved') approved++;
      else if (status === 'rejected') rejected++;
    });
    const result = { total, pending, approved, rejected };
    cache.logbookStats.set(key, result);
    return result;
  } catch (error) {
    console.error('Error getLogbookStats:', error);
    return { total: 0, pending: 0, approved: 0, rejected: 0 };
  }
}

// ============================================================================
// RUTE UTAMA – DAFTAR MAHASISWA (OPTIMASI)
// ============================================================================

router.get('/', async (req, res) => {
  try {
    clearCache();
    const { search, angkatan } = req.query;

    // ✅ OPTIMISASI KUOTA: sebelumnya di sini membaca SEMUA enrollment AKTIF
    // DI SELURUH SISTEM (semua mata kuliah, bukan cuma magang/PDK) - lalu
    // baru menyaring mana yang PDK di JS. Data real dari Firebase Query
    // Insights menunjukkan ini salah satu query paling boros di seluruh
    // aplikasi (~234 dokumen dibaca SETIAP kali halaman ini dibuka).
    // Sekarang: cari dulu MK mana saja yang isPDK==true (jumlahnya jauh
    // lebih sedikit, biasanya cuma beberapa PDK per angkatan), baru query
    // enrollment DIBATASI ke mkId-mkId itu saja.
    const pdkMkSnapshot = await db.collection('mataKuliah').where('isPDK', '==', true).get();
    const pdkMkIds = pdkMkSnapshot.docs.map(doc => doc.id);
    const mkMap = new Map();
    pdkMkSnapshot.docs.forEach(doc => mkMap.set(doc.id, doc.data()));

    if (pdkMkIds.length === 0) {
      return res.render('admin/emagang_list', {
        title: 'E‑Magang - Monitoring Magang',
        mahasiswaList: [],
        angkatanList: [],
        filters: { search: search || '', angkatan: angkatan || '' },
        user: req.user
      });
    }

    function chunkArray(arr, size) {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
      return chunks;
    }
    const enrollmentDocsAll = [];
    for (const chunk of chunkArray(pdkMkIds, 10)) {
      const snap = await db.collection('enrollment')
        .where('mkId', 'in', chunk)
        .where('status', '==', 'active')
        .get();
      enrollmentDocsAll.push(...snap.docs);
    }

    // Kelompokkan per mahasiswa
    const userPdkMap = new Map();
    for (const doc of enrollmentDocsAll) {
      const enrollment = doc.data();
      const userId = enrollment.userId;
      const mk = mkMap.get(enrollment.mkId);
      if (mk && mk.isPDK === true) {
        if (!userPdkMap.has(userId)) {
          userPdkMap.set(userId, { pdks: [], mahasiswaData: null });
        }
        userPdkMap.get(userId).pdks.push({
          id: enrollment.mkId,
          kode: mk.kode,
          nama: mk.nama,
          urutan: mk.urutanPDK,
          semester: enrollment.semester
        });
      }
    }

    // Ambil data mahasiswa SEKALIGUS lewat db.getAll() (bukan Promise.all
    // per-doc yang read cost-nya sama tapi round-trip-nya lebih banyak).
    const userIds = Array.from(userPdkMap.keys());
    const mahasiswaDocs = userIds.length > 0
      ? await db.getAll(...userIds.map(id => db.collection('users').doc(id)))
      : [];
    const mahasiswaMap = new Map();
    mahasiswaDocs.forEach((doc, idx) => {
      if (doc.exists && doc.data().role === 'mahasiswa') {
        mahasiswaMap.set(userIds[idx], { id: doc.id, ...doc.data() });
      } else {
        userPdkMap.delete(userIds[idx]);
      }
    });

    // Bangun array mahasiswaList
    let mahasiswaList = [];
    for (const [userId, data] of userPdkMap) {
      const mhs = mahasiswaMap.get(userId);
      if (!mhs) continue;
      data.pdks.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));
      mahasiswaList.push({
        ...mhs,
        enrolledPdks: data.pdks,
        pdkKodes: data.pdks.map(p => p.kode).join(', '),
        pdkUrutans: data.pdks.map(p => `PDK ${p.urutan}`).join(', ')
      });
    }

    // Filter pencarian
    if (search) {
      const searchLower = search.toLowerCase();
      mahasiswaList = mahasiswaList.filter(m =>
        m.nama.toLowerCase().includes(searchLower) || (m.nim && m.nim.includes(search))
      );
    }
    if (angkatan) {
      mahasiswaList = mahasiswaList.filter(m => {
        const nimAngkatan = m.nim ? '20' + m.nim.substring(0, 2) : '';
        return nimAngkatan === angkatan;
      });
    }

    // Ambil statistik logbook untuk semua mahasiswa sekaligus (paralel)
    const statsPromises = mahasiswaList.map(m => getLogbookStats(m.id));
    const statsResults = await Promise.all(statsPromises);
    mahasiswaList.forEach((m, idx) => {
      m.totalLogbook = statsResults[idx].total;
      m.pendingCount = statsResults[idx].pending;
      m.approvedCount = statsResults[idx].approved;
      m.rejectedCount = statsResults[idx].rejected;
      m.role = 'pembimbing2';
    });

    mahasiswaList.sort((a, b) => a.nama.localeCompare(b.nama));
    const angkatanList = [...new Set(mahasiswaList.map(m => m.nim ? '20' + m.nim.substring(0,2) : '').filter(a => a))].sort().reverse();

    res.render('admin/emagang_list', {
      title: 'E‑Magang - Monitoring Magang',
      mahasiswaList,
      angkatanList,
      filters: { search: search || '', angkatan: angkatan || '' },
      user: req.user
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { message: 'Gagal mengambil data logbook' });
  }
});

// ============================================================================
// DETAIL LOGBOOK PER MAHASISWA (OPTIMASI)
// ============================================================================

router.get('/mahasiswa/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId, semester } = req.query;

    clearCache();
    const bimbingan = await getBimbingan(userId);
    const mahasiswa = await getMahasiswa(userId);
    if (!mahasiswa.nama || mahasiswa.nama === 'Unknown') {
      return res.status(404).send('Mahasiswa tidak ditemukan');
    }

    const allPeriods = await getMagangPeriods(userId);
    let selectedPeriod = null;
    if (periodId) selectedPeriod = allPeriods.find(p => p.id === periodId);
    else if (allPeriods.length > 0) selectedPeriod = allPeriods[0];

    // ✅ OPTIMISASI KUOTA: sebelumnya halaman ini membaca koleksi
    // 'logbookMagang' mahasiswa yang SAMA sampai (2 + jumlah periode magang)
    // KALI secara terpisah - sekali utk daftar yang ditampilkan, sekali lagi
    // utk daftar semester, dan sekali lagi PER PERIODE utk statistik per PDK.
    // Sekarang cukup SATU KALI baca semua logbook mahasiswa ini, sisanya
    // (filter tampilan, daftar semester, statistik per PDK) dihitung di JS.
    const semuaLogbookSnapshot = await db.collection('logbookMagang')
      .where('userId', '==', userId)
      .get();
    const semuaLogbook = semuaLogbookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Daftar logbook yang ditampilkan (terapkan filter period/semester + urutkan)
    let logbookList = semuaLogbook.filter(l => {
      if (selectedPeriod && l.pdkId !== selectedPeriod.pdkId) return false;
      if (semester && l.semester !== semester) return false;
      return true;
    });
    logbookList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    logbookList = logbookList.map(data => ({
      ...data,
      tanggalFormatted: formatDate(data.tanggal),
      tanggalWaktuFormatted: formatDateTime(data.tanggal)
    }));

    // Daftar semester unik
    const semesterSet = new Set();
    semuaLogbook.forEach(l => { if (l.semester) semesterSet.add(l.semester); });
    const semesterList = Array.from(semesterSet).sort();

    // Statistik per PDK - dihitung dari data yang sudah ada di memori,
    // BUKAN query baru per periode.
    const pdkStats = allPeriods.map(period => {
      let pending = 0, approved = 0, rejected = 0;
      semuaLogbook.forEach(l => {
        if (l.pdkId !== period.pdkId) return;
        if (l.status === 'pending') pending++;
        else if (l.status === 'approved') approved++;
        else if (l.status === 'rejected') rejected++;
      });
      return {
        id: period.id,
        pdkKode: period.pdkKode,
        pdkNama: period.pdkNama,
        pendingCount: pending,
        approvedCount: approved,
        rejectedCount: rejected,
        status: period.status,
        tanggalMulai: period.tanggalMulai,
        tanggalSelesai: period.tanggalSelesai,
        perusahaan: period.perusahaan
      };
    });

    // Daftar PDK untuk dropdown (satu query)
    const pdkSnapshot = await db.collection('mataKuliah')
      .where('isPDK', '==', true)
      .orderBy('urutanPDK', 'asc')
      .get();
    const pdkList = pdkSnapshot.docs.map(doc => ({
      id: doc.id,
      kode: doc.data().kode,
      nama: doc.data().nama
    }));

    // Nilai Magang 3-komponen (Laporan/Logbook/Lapangan) untuk periode yang
    // sedang dipilih - dipakai form input Nilai Lapangan + tombol Kunci.
    let nilaiMagangInfo = null;
    if (selectedPeriod) {
      const nilaiMagang = await getNilaiMagang(userId, selectedPeriod.pdkId);
      nilaiMagangInfo = { ...nilaiMagang, hasil: hitungNilaiAkhirMagang(nilaiMagang) };
    }

    res.render('admin/emagang_mahasiswa', {
      title: `Logbook - ${mahasiswa.nama}`,
      mahasiswa,
      logbookList,
      semesterList,
      selectedSemester: semester || '',
      allPeriods,
      selectedPeriod,
      pdkStats,
      pdkList,
      bimbingan,
      nilaiMagangInfo,
      ITEM_PENDAMPING_LAPANGAN,
      user: req.user
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', { message: 'Gagal mengambil data logbook' });
  }
});

// ============================================================================
// KELOLA PERIODE MAGANG (TIDAK BERUBAH)
// ============================================================================

router.post('/period/start', async (req, res) => {
  try {
    const { 
      mahasiswaId, pdkId, tanggalMulai, tanggalSelesai,
      namaPerusahaan, alamatPerusahaan, kontakPerusahaan, kontakHpPerusahaan,
      emailPerusahaan, websitePerusahaan, pembimbingLapangan, jabatanPembimbingLapangan
    } = req.body;
    
    if (!mahasiswaId || !pdkId || !tanggalMulai || !namaPerusahaan) {
      req.session.error = 'Data tidak lengkap. Nama perusahaan wajib diisi.';
      return res.redirect('back');
    }
    
    const pdkDoc = await db.collection('mataKuliah').doc(pdkId).get();
    if (!pdkDoc.exists) {
      req.session.error = 'Mata kuliah PDK tidak ditemukan';
      return res.redirect('back');
    }
    const pdk = pdkDoc.data();
    
    const bimbingan = await getBimbingan(mahasiswaId);
    if (!bimbingan) {
      req.session.error = 'Mahasiswa belum memiliki dosen pembimbing';
      return res.redirect('back');
    }
    
    const existing = await db.collection('magangPeriod')
      .where('mahasiswaId', '==', mahasiswaId)
      .where('pdkId', '==', pdkId)
      .where('status', 'in', ['active', 'locked'])
      .get();
    
    if (!existing.empty) {
      req.session.error = `Mahasiswa sudah memiliki periode magang aktif untuk ${pdk.nama}`;
      return res.redirect('back');
    }
    
    const now = new Date().toISOString();
    await db.collection('magangPeriod').add({
      mahasiswaId,
      pdkId,
      pdkKode: pdk.kode,
      pdkNama: pdk.nama,
      tanggalMulai,
      tanggalSelesai: tanggalSelesai || null,
      status: 'active',
      pembimbing1Id: bimbingan.pembimbing1Id,
      pembimbing1Nama: bimbingan.pembimbing1Nama,
      pembimbing2Id: bimbingan.pembimbing2Id || null,
      pembimbing2Nama: bimbingan.pembimbing2Nama || null,
      perusahaan: {
        nama: namaPerusahaan,
        alamat: alamatPerusahaan || '',
        kontak: kontakPerusahaan || '',
        kontakHp: kontakHpPerusahaan || '',
        email: emailPerusahaan || '',
        website: websitePerusahaan || '',
        pembimbingLapangan: pembimbingLapangan || '',
        jabatanPembimbingLapangan: jabatanPembimbingLapangan || '',
        diisiOleh: req.user.id,
        diisiPada: now
      },
      nilai: { angka: null, huruf: null, komentar: null, dinilaiOleh: null, dinilaiPada: null, komponenNilai: {} },
      ulasan: { isFilled: false },
      lockHistory: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      history: [{
        action: 'started',
        tanggal: new Date().toISOString().split('T')[0],
        catatan: `Periode magang ${pdk.nama} di ${namaPerusahaan} dimulai oleh ${req.user.nama || 'Admin'}`
      }]
    });
    
    req.session.success = `Periode magang ${pdk.nama} berhasil dimulai`;
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal memulai periode magang';
    res.redirect('back');
  }
});

router.post('/period/:periodId/update-perusahaan', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { namaPerusahaan, alamatPerusahaan, kontakPerusahaan, kontakHpPerusahaan,
      emailPerusahaan, websitePerusahaan, pembimbingLapangan, jabatanPembimbingLapangan } = req.body;
    
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    if (!periodDoc.exists) {
      req.session.error = 'Periode magang tidak ditemukan';
      return res.redirect('back');
    }
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    
    await periodRef.update({
      'perusahaan.nama': namaPerusahaan,
      'perusahaan.alamat': alamatPerusahaan || '',
      'perusahaan.kontak': kontakPerusahaan || '',
      'perusahaan.kontakHp': kontakHpPerusahaan || '',
      'perusahaan.email': emailPerusahaan || '',
      'perusahaan.website': websitePerusahaan || '',
      'perusahaan.pembimbingLapangan': pembimbingLapangan || '',
      'perusahaan.jabatanPembimbingLapangan': jabatanPembimbingLapangan || '',
      'perusahaan.diisiOleh': req.user.id,
      'perusahaan.diisiPada': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    req.session.success = 'Informasi perusahaan berhasil diupdate';
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal update perusahaan';
    res.redirect('back');
  }
});

router.post('/period/:periodId/lock', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { reason } = req.body;
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    if (!periodDoc.exists) {
      req.session.error = 'Periode magang tidak ditemukan';
      return res.redirect('back');
    }
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    if (period.status === 'completed') {
      req.session.error = 'Magang sudah selesai, tidak bisa dikunci';
      return res.redirect('back');
    }
    const lockHistory = period.lockHistory || [];
    lockHistory.push({
      action: 'locked',
      reason: reason || 'Tidak ada alasan',
      lockedBy: req.user.id,
      lockedByNama: req.user.nama || 'Admin',
      lockedAt: new Date().toISOString()
    });
    await periodRef.update({
      status: 'locked',
      lockHistory,
      updatedAt: new Date().toISOString(),
      history: [
        ...(period.history || []),
        { action: 'locked', catatan: `Periode magang dikunci oleh ${req.user.nama || 'Admin'}`, reason: reason || 'Tidak ada alasan', tanggal: new Date().toISOString().split('T')[0] }
      ]
    });
    req.session.success = 'Periode magang berhasil dikunci';
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal mengunci periode magang';
    res.redirect('back');
  }
});

router.post('/period/:periodId/unlock', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { reason } = req.body;
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    if (!periodDoc.exists) {
      req.session.error = 'Periode magang tidak ditemukan';
      return res.redirect('back');
    }
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    const lockHistory = period.lockHistory || [];
    lockHistory.push({
      action: 'unlocked',
      reason: reason || 'Tidak ada alasan',
      unlockedBy: req.user.id,
      unlockedByNama: req.user.nama || 'Admin',
      unlockedAt: new Date().toISOString()
    });
    await periodRef.update({
      status: 'active',
      lockHistory,
      updatedAt: new Date().toISOString(),
      history: [
        ...(period.history || []),
        { action: 'unlocked', catatan: `Periode magang dibuka kembali oleh ${req.user.nama || 'Admin'}`, reason: reason || 'Tidak ada alasan', tanggal: new Date().toISOString().split('T')[0] }
      ]
    });
    req.session.success = 'Periode magang berhasil dibuka';
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal membuka kunci periode magang';
    res.redirect('back');
  }
});

router.post('/period/:periodId/extend', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { tanggalSelesaiBaru, catatan } = req.body;
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    if (!periodDoc.exists) {
      req.session.error = 'Periode magang tidak ditemukan';
      return res.redirect('back');
    }
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    const oldSelesai = period.tanggalSelesai || '-';
    await periodRef.update({
      tanggalSelesai: tanggalSelesaiBaru,
      updatedAt: new Date().toISOString(),
      history: [
        ...(period.history || []),
        { action: 'extended', tanggal: new Date().toISOString().split('T')[0], oldSelesai, newSelesai: tanggalSelesaiBaru, catatan: catatan || `Perpanjangan periode magang oleh ${req.user.nama || 'Admin'}` }
      ]
    });
    req.session.success = 'Periode magang berhasil diperpanjang';
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal memperpanjang periode magang';
    res.redirect('back');
  }
});

router.post('/period/:periodId/complete', async (req, res) => {
  try {
    const { periodId } = req.params;
    const { nilaiAngka, komentarNilai, nilaiKehadiran, nilaiLogbook, nilaiLaporan, nilaiSikap, nilaiPresentasi } = req.body;
    const periodRef = db.collection('magangPeriod').doc(periodId);
    const periodDoc = await periodRef.get();
    if (!periodDoc.exists) {
      req.session.error = 'Periode magang tidak ditemukan';
      return res.redirect('back');
    }
    const period = periodDoc.data();
    const mahasiswaId = period.mahasiswaId;
    // Hitung nilai huruf - skala resmi yang sama dengan KHS/Transkrip/Rubrik
    // (helpers/nilaiHelper.js -> nilaiKeHuruf), supaya konsisten di seluruh app.
    const nilaiHuruf = nilaiKeHuruf(nilaiAngka).huruf;
    await periodRef.update({
      status: 'completed',
      tanggalSelesai: new Date().toISOString().split('T')[0],
      'nilai.angka': parseFloat(nilaiAngka),
      'nilai.huruf': nilaiHuruf,
      'nilai.komentar': komentarNilai || '',
      'nilai.dinilaiOleh': req.user.id,
      'nilai.dinilaiPada': new Date().toISOString(),
      'nilai.komponenNilai': {
        kehadiran: nilaiKehadiran ? parseFloat(nilaiKehadiran) : null,
        logbook: nilaiLogbook ? parseFloat(nilaiLogbook) : null,
        laporan: nilaiLaporan ? parseFloat(nilaiLaporan) : null,
        sikap: nilaiSikap ? parseFloat(nilaiSikap) : null,
        presentasi: nilaiPresentasi ? parseFloat(nilaiPresentasi) : null
      },
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [
        ...(period.history || []),
        { action: 'completed', tanggal: new Date().toISOString().split('T')[0], nilai: nilaiAngka, nilaiHuruf, catatan: `Magang selesai dan dinilai oleh ${req.user.nama || 'Admin'}` }
      ]
    });

    // Jembatan ke KHS/Transkrip - lihat helpers/magangHelper.js -> salinNilaiMagangKeGrades
    await salinNilaiMagangKeGrades(period, nilaiAngka);

    req.session.success = `Magang ${period.pdkKode} berhasil diselesaikan dengan nilai ${nilaiHuruf} (${nilaiAngka})`;
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal menyelesaikan magang';
    res.redirect('back');
  }
});

// ============================================================================
// NILAI MAGANG 3-KOMPONEN (Laporan/Logbook/Lapangan) - lihat
// helpers/nilaiMagangHelper.js untuk penjelasan lengkap sistemnya. Ini
// PENGGANTI dari '/period/:periodId/complete' di atas (yang masih
// dipertahankan untuk kompatibilitas data lama / input cepat satu nilai).
// ============================================================================

/**
 * POST /admin/emagang/mahasiswa/:userId/nilai-lapangan
 * Admin input Nilai Lapangan (mewakili pembimbing lapangan di perusahaan,
 * yang tidak punya akses ke sistem).
 */
/**
 * POST /admin/emagang/mahasiswa/:userId/nilai-lapangan
 * Admin input Nilai Pendamping Lapangan (mewakili pendamping lapangan di
 * IDUKA, yang tidak punya akses ke sistem) - 9 indikator, lihat
 * ITEM_PENDAMPING_LAPANGAN.
 */
router.post('/mahasiswa/:userId/nilai-lapangan', async (req, res) => {
  try {
    const { userId } = req.params;
    const { pdkId } = req.body;
    if (!pdkId) {
      req.session.error = 'Pilih periode magang (PDK) dulu';
      return res.redirect('back');
    }

    const itemScores = {};
    for (const it of ITEM_PENDAMPING_LAPANGAN) {
      const v = req.body.item ? req.body.item[it.key] : undefined;
      const angka = parseFloat(v);
      if (v === undefined || v === '' || isNaN(angka) || angka < 0 || angka > 100) {
        req.session.error = `Isi semua ${ITEM_PENDAMPING_LAPANGAN.length} indikator dengan angka 0-100 (indikator "${it.label}" belum valid).`;
        return res.redirect('back');
      }
      itemScores[it.key] = angka;
    }

    await savePenilaianPendampingLapangan(userId, pdkId, itemScores, req.user.id);
    req.session.success = 'Nilai Pendamping Lapangan berhasil disimpan';
    res.redirect(`/admin/emagang/mahasiswa/${userId}?periodId=${req.body.periodId || ''}`);
  } catch (error) {
    console.error('Error menyimpan Nilai Pendamping Lapangan:', error);
    req.session.error = 'Gagal menyimpan Nilai Pendamping Lapangan: ' + error.message;
    res.redirect('back');
  }
});

/**
 * POST /admin/emagang/mahasiswa/:userId/kunci-nilai-magang
 * Kunci nilai akhir magang (gabungan 3 komponen) ke koleksi grades/KHS.
 * Ditolak kalau salah satu dari 3 komponen belum terisi.
 */
router.post('/mahasiswa/:userId/kunci-nilai-magang', async (req, res) => {
  try {
    const { userId } = req.params;
    const { pdkId, periodId } = req.body;
    if (!pdkId) {
      req.session.error = 'PDK tidak diketahui';
      return res.redirect('back');
    }
    const hasil = await kunciNilaiMagangKeGrades(userId, pdkId, req.user.id);
    req.session.success = `Nilai akhir magang berhasil dikunci: ${hasil.huruf} (${hasil.nilaiAkhir}) - sudah masuk ke KHS/Transkrip mahasiswa.`;
    res.redirect(`/admin/emagang/mahasiswa/${userId}?periodId=${periodId || ''}`);
  } catch (error) {
    console.error('Error kunci nilai magang:', error);
    req.session.error = 'Gagal mengunci nilai: ' + error.message;
    res.redirect('back');
  }
});


// ============================================================================
// APPROVE/REJECT LOGBOOK
// ============================================================================

router.post('/logbook/:id/approve', async (req, res) => {
  try {
    const logbookId = req.params.id;
    const logbookDoc = await db.collection('logbookMagang').doc(logbookId).get();
    if (!logbookDoc.exists) {
      req.session.error = 'Logbook tidak ditemukan';
      return res.redirect('back');
    }
    const logbook = logbookDoc.data();
    const mahasiswaId = logbook.userId;
    await logbookDoc.ref.update({
      status: 'approved',
      approvedAt: new Date().toISOString(),
      approvedBy: req.user.id,
      approvedByNama: req.user.nama || 'Admin',
      approvedByRole: 'Admin'
    });
    invalidateProgressMagangHarian(mahasiswaId, logbook.pdkId);
    req.session.success = 'Logbook berhasil disetujui';
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal menyetujui logbook';
    res.redirect('back');
  }
});

router.post('/logbook/:id/reject', async (req, res) => {
  try {
    const logbookId = req.params.id;
    const { alasan } = req.body;
    const logbookDoc = await db.collection('logbookMagang').doc(logbookId).get();
    if (!logbookDoc.exists) {
      req.session.error = 'Logbook tidak ditemukan';
      return res.redirect('back');
    }
    const logbook = logbookDoc.data();
    const mahasiswaId = logbook.userId;
    await logbookDoc.ref.update({
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.user.id,
      rejectedByNama: req.user.nama || 'Admin',
      rejectedByRole: 'Admin',
      rejectionReason: alasan || 'Tidak ada alasan'
    });
    invalidateProgressMagangHarian(mahasiswaId, logbook.pdkId);
    req.session.success = 'Logbook berhasil ditolak';
    res.redirect(`/admin/emagang/mahasiswa/${mahasiswaId}`);
  } catch (error) {
    console.error('Error:', error);
    req.session.error = 'Gagal menolak logbook';
    res.redirect('back');
  }
});

// ============================================================================
// SETUJUI LOGBOOK 1 MINGGU SEKALIGUS (Admin)
// ============================================================================
// Sama seperti versi dosen (routes/dosen/magang.js) - menyetujui semua
// logbook 'pending' mahasiswa ini dalam 7 hari terakhir sekaligus, supaya
// admin tidak perlu klik "Setujui" satu per satu untuk tiap entri harian.
router.post('/mahasiswa/:userId/setujui-minggu', async (req, res) => {
  try {
    const { userId } = req.params;
    const { periodId } = req.body;

    let pdkId = null;
    if (periodId) {
      const periodDoc = await db.collection('magangPeriod').doc(periodId).get();
      if (!periodDoc.exists) {
        req.session.error = 'Periode magang tidak ditemukan';
        return res.redirect(`/admin/emagang/mahasiswa/${userId}`);
      }
      pdkId = periodDoc.data().pdkId;
    }

    // Rentang 7 hari terakhir (hari ini mundur 6 hari), format YYYY-MM-DD.
    const hariIni = new Date();
    const tujuhHariLalu = new Date(hariIni);
    tujuhHariLalu.setDate(hariIni.getDate() - 6);
    const tanggalAkhir = hariIni.toISOString().split('T')[0];
    const tanggalAwal = tujuhHariLalu.toISOString().split('T')[0];

    let query = db.collection('logbookMagang')
      .where('userId', '==', userId)
      .where('status', '==', 'pending');
    if (pdkId) query = query.where('pdkId', '==', pdkId);
    const pendingSnapshot = await query.get();

    const docsMingguIni = pendingSnapshot.docs.filter(doc => {
      const tgl = doc.data().tanggal;
      return tgl && tgl >= tanggalAwal && tgl <= tanggalAkhir;
    });

    if (docsMingguIni.length === 0) {
      req.session.error = 'Tidak ada logbook pending dalam 7 hari terakhir untuk disetujui';
      return res.redirect(`/admin/emagang/mahasiswa/${userId}${periodId ? `?periodId=${periodId}` : ''}`);
    }

    const now = new Date().toISOString();
    const catatan = 'Mahasiswa telah konsultasi dan logbook disetujui';
    const batch = db.batch();
    docsMingguIni.forEach(doc => {
      batch.update(doc.ref, {
        status: 'approved',
        approvedAt: now,
        approvedBy: req.user.id,
        approvedByNama: req.user.nama || 'Admin',
        approvedByRole: 'Admin',
        catatan
      });
    });
    await batch.commit();

    const pdkIdUntukInvalidasi = pdkId
      ? [pdkId]
      : [...new Set(docsMingguIni.map(doc => doc.data().pdkId).filter(Boolean))];
    pdkIdUntukInvalidasi.forEach(pid => invalidateProgressMagangHarian(userId, pid));

    req.session.success = `${docsMingguIni.length} logbook (7 hari terakhir) berhasil disetujui sekaligus`;
    res.redirect(`/admin/emagang/mahasiswa/${userId}${periodId ? `?periodId=${periodId}` : ''}`);
  } catch (error) {
    console.error('Error setujui logbook per minggu (admin):', error);
    req.session.error = 'Gagal menyetujui logbook per minggu';
    res.redirect('back');
  }
});

// ============================================================================
// CETAK LOGBOOK (OPTIMASI)
// ============================================================================

router.get('/print', async (req, res) => {
  try {
    const { userId, periodId, semester } = req.query;
    let query = db.collection('logbookMagang').orderBy('tanggal', 'asc');
    if (userId) query = query.where('userId', '==', userId);
    if (periodId) {
      const periodDoc = await db.collection('magangPeriod').doc(periodId).get();
      if (periodDoc.exists) query = query.where('pdkId', '==', periodDoc.data().pdkId);
    }
    if (semester) query = query.where('semester', '==', semester);
    const snapshot = await query.get();
    const logbookList = [];
    const uniqueUserIds = new Set();
    snapshot.docs.forEach(doc => uniqueUserIds.add(doc.data().userId));
    const mahasiswaMap = new Map();
    await Promise.all(Array.from(uniqueUserIds).map(async uid => {
      const m = await getMahasiswa(uid);
      mahasiswaMap.set(uid, m);
    }));
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const mahasiswa = mahasiswaMap.get(data.userId);
      logbookList.push({ ...data, mahasiswa, tanggalFormatted: formatDate(data.tanggal) });
    }
    let grouped = {};
    if (!userId) {
      logbookList.forEach(item => {
        if (!grouped[item.userId]) grouped[item.userId] = { mahasiswa: item.mahasiswa, entries: [] };
        grouped[item.userId].entries.push(item);
      });
      for (let key in grouped) {
        grouped[key].totalDurasi = grouped[key].entries.reduce((sum, e) => sum + (parseFloat(e.durasi) || 0), 0);
      }
    }
    const filterInfo = [];
    if (userId) {
      const m = mahasiswaMap.get(userId);
      filterInfo.push(`Mahasiswa: ${m?.nama || userId}`);
    }
    if (periodId) filterInfo.push(`Periode: ${periodId}`);
    if (semester) filterInfo.push(`Semester: ${semester}`);
    let pdkInfo = null;
    if (periodId) {
      const periodDoc = await db.collection('magangPeriod').doc(periodId).get();
      if (periodDoc.exists) pdkInfo = periodDoc.data();
    }
    res.render('admin/emagang_print', {
      title: 'Cetak Logbook',
      grouped,
      logbookList: userId ? logbookList : null,
      filterInfo: filterInfo.join(' | ') || 'Semua data',
      pdkInfo,
      generatedAt: formatDateTime(new Date().toISOString()),
      user: req.user
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Gagal mencetak logbook');
  }
});

// ============================================================================
// API ENDPOINT
// ============================================================================

router.get('/api/mahasiswa', async (req, res) => {
  try {
    const snapshot = await db.collection('users').where('role', '==', 'mahasiswa').orderBy('nama').get();
    res.json({ success: true, data: snapshot.docs.map(doc => ({ id: doc.id, nama: doc.data().nama, nim: doc.data().nim })) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/api/periods/:userId', async (req, res) => {
  try {
    const periods = await getMagangPeriods(req.params.userId);
    res.json({ success: true, data: periods });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;