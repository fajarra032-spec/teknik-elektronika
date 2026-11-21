/**
 * helpers/rpsReminderHelper.js
 * Status pengumpulan RPS dosen untuk PERIODE AKTIF (wajib tiap semester).
 *
 * Sebuah MK dihitung "diampu semester ini" bila:
 *   - ada mataKuliah/{id}/pengampuPeriode/{periodeAktif} yang memuat dosen, ATAU
 *   - belum ada dokumen itu tapi mk.periodeAktifId == periode aktif dan dosen ada di mk.dosenIds.
 * "Sudah mengumpulkan" = ada dokumen mataKuliah/{id}/rpsPeriode/{periodeAktif} berisi fileUrl
 * (hasil upload scan RPS bertanda tangan di menu RPS Saya). mk.rpsUrl TIDAK dipakai
 * karena nilainya terbawa dari semester sebelumnya.
 */
const { TTLCache } = require('./cache');
const academic = require('./academicHelper');

const cache = new TTLCache(10 * 60 * 1000); // 10 menit per dosen

async function hitung(db, dosenId) {
  const periodeId = academic.getActivePeriodeId();
  const info = academic.generatePeriodeOptions(0, 0).find(p => p.id === periodeId);
  const periodeLabel = info ? info.label : academic.getCurrentAcademicSemester().label;

  const snap = await db.collection('mataKuliah').where('dosenIds', 'array-contains', dosenId).get();
  const rows = await Promise.all(snap.docs.map(async d => {
    const mk = d.data();
    const ref = d.ref;
    let diampu = false;
    const p = await ref.collection('pengampuPeriode').doc(periodeId).get();
    if (p.exists) diampu = (p.data().dosenIds || []).includes(dosenId);
    else diampu = mk.periodeAktifId === periodeId;
    if (!diampu) return null;
    const r = await ref.collection('rpsPeriode').doc(periodeId).get();
    const rd = r.exists ? r.data() : null;
    return {
      id: d.id, kode: mk.kode, nama: mk.nama, kelas: mk.kelas || null, semester: mk.semester || null,
      sudah: !!(rd && rd.fileUrl), fileUrl: rd ? rd.fileUrl || null : null, uploadedAt: rd ? rd.uploadedAt || null : null
    };
  }));
  const daftar = rows.filter(Boolean).sort((a, b) => String(a.kode).localeCompare(String(b.kode)));
  return { periodeId, periodeLabel, daftar, belum: daftar.filter(x => !x.sudah), total: daftar.length };
}

function getStatusRpsDosen(db, dosenId) {
  return cache.getOrFetch(dosenId, () => hitung(db, dosenId));
}
function resetStatusRps(dosenId) { if (dosenId) cache.delete ? cache.delete(dosenId) : cache.store.delete(dosenId); }

module.exports = { getStatusRpsDosen, resetStatusRps };
