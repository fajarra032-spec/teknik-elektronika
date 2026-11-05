// helpers/konsultasiLogbookHelper.js
// ============================================================================
// KONSULTASI & PERSETUJUAN LOGBOOK PER MINGGU (Dosen PA / Pembimbing)
//
// Satu dokumen per (periode magang, minggu ke-N) di koleksi `konsultasiLogbook`:
//   id        : `${periodId}_${mingguKe}`
//   periodId, pdkId, mahasiswaId, mingguKe
//   status    : 'approved' | 'dicabut'
//   via       : 'WA'
//   noWa      : nomor WA mahasiswa yang dipakai konsultasi (dicatat dosen)
//   tanggalKonsultasi : YYYY-MM-DD
//   catatan   : catatan ketikan dosen pembimbing
//   dosenId, dosenNama, approvedAt, updatedAt
//
// Tidak perlu indeks komposit baru (query hanya satu field: periodId).
// ============================================================================

const { db } = require('../config/firebaseAdmin');

const KOLEKSI = 'konsultasiLogbook';

function docId(periodId, mingguKe) {
  return `${periodId}_${mingguKe}`;
}

/** Rapikan nomor WA ke format 62xxxxxxxxxx (untuk tautan wa.me). */
function normalisasiNoWa(raw) {
  let n = String(raw || '').replace(/[^\d+]/g, '');
  if (!n) return '';
  if (n.startsWith('+')) n = n.substring(1);
  if (n.startsWith('0')) n = '62' + n.substring(1);
  else if (n.startsWith('8')) n = '62' + n;
  return n;
}

/** Semua catatan konsultasi satu periode -> map { [mingguKe]: data }. */
async function getKonsultasiByPeriod(periodId) {
  if (!periodId) return {};
  try {
    const snap = await db.collection(KOLEKSI).where('periodId', '==', periodId).get();
    const map = {};
    snap.docs.forEach((d) => {
      const x = d.data();
      map[x.mingguKe] = { id: d.id, ...x };
    });
    return map;
  } catch (err) {
    console.error('Error getKonsultasiByPeriod:', err);
    return {};
  }
}

/**
 * Lembar minggu dianggap SUDAH konsultasi/disetujui bila:
 *  - ada catatan konsultasi berstatus 'approved', ATAU
 *  - ada entri dan semuanya sudah berstatus 'approved' (persetujuan per-entri lama).
 */
function mingguDisetujui(konsultasi, entries) {
  if (konsultasi && konsultasi.status === 'approved') return true;
  if (!konsultasi && Array.isArray(entries) && entries.length > 0) {
    return entries.every((e) => e.status === 'approved');
  }
  return false;
}

/**
 * Simpan persetujuan minggu + setujui semua entri logbook minggu itu
 * (rentang tanggal awal..akhir, inklusif) yang masih pending.
 */
async function setujuiMinggu({ periodId, pdkId, mahasiswaId, mingguKe, awal, akhir, noWa, tanggalKonsultasi, catatan, dosen }) {
  const now = new Date().toISOString();
  const ref = db.collection(KOLEKSI).doc(docId(periodId, mingguKe));

  await ref.set({
    periodId, pdkId: pdkId || null, mahasiswaId, mingguKe: Number(mingguKe),
    status: 'approved',
    via: 'WA',
    noWa: String(noWa || '').trim(),
    tanggalKonsultasi: tanggalKonsultasi || now.substring(0, 10),
    catatan: String(catatan || '').trim(),
    dosenId: dosen.id, dosenNama: dosen.nama || '',
    approvedAt: now, updatedAt: now
  }, { merge: true });

  // Setujui entri harian minggu ini yang masih pending
  const snap = await db.collection('logbookMagang')
    .where('userId', '==', mahasiswaId)
    .where('pdkId', '==', pdkId)
    .get();
  const target = snap.docs.filter((d) => {
    const x = d.data();
    const t = String(x.tanggal || '').substring(0, 10);
    return x.status === 'pending' && t >= awal && t <= akhir;
  });
  if (target.length) {
    const batch = db.batch();
    target.forEach((d) => batch.update(d.ref, {
      status: 'approved',
      approvedAt: now,
      approvedBy: dosen.id,
      approvedByNama: dosen.nama || '',
      approvedByRole: 'Dosen Pembimbing (PA)',
      catatan: String(catatan || '').trim() || 'Mahasiswa telah konsultasi via WA dan logbook disetujui'
    }));
    await batch.commit();
  }
  return target.length;
}

/** Cabut persetujuan minggu (lembar kembali berwatermark "Belum Konsultasi"). */
async function cabutPersetujuanMinggu({ periodId, pdkId, mahasiswaId, mingguKe, awal, akhir, dosen }) {
  const now = new Date().toISOString();
  await db.collection(KOLEKSI).doc(docId(periodId, mingguKe)).set({
    periodId, pdkId: pdkId || null, mahasiswaId, mingguKe: Number(mingguKe),
    status: 'dicabut', dosenId: dosen.id, dosenNama: dosen.nama || '', updatedAt: now
  }, { merge: true });

  const snap = await db.collection('logbookMagang')
    .where('userId', '==', mahasiswaId)
    .where('pdkId', '==', pdkId)
    .get();
  const target = snap.docs.filter((d) => {
    const x = d.data();
    const t = String(x.tanggal || '').substring(0, 10);
    return x.status === 'approved' && t >= awal && t <= akhir;
  });
  if (target.length) {
    const batch = db.batch();
    target.forEach((d) => batch.update(d.ref, { status: 'pending', approvedAt: null, approvedBy: null, approvedByNama: null, approvedByRole: null }));
    await batch.commit();
  }
  return target.length;
}

module.exports = {
  KOLEKSI, docId, normalisasiNoWa,
  getKonsultasiByPeriod, mingguDisetujui, setujuiMinggu, cabutPersetujuanMinggu
};
