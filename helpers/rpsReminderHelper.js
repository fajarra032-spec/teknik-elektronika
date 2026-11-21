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

async function hitung(db, dosenId, periodeId) {
  const aktifId = academic.getActivePeriodeId();
  periodeId = periodeId || aktifId;
  const info = academic.generatePeriodeOptions(12, 1).find(p => p.id === periodeId);
  const periodeLabel = info ? info.label : periodeId;
  const isAktif = periodeId === aktifId;

  // Periode aktif: cukup MK yang mirror dosenIds-nya memuat dosen. Periode lain: pengampu lama
  // tidak tercermin di mk.dosenIds, jadi periksa semua MK lewat pengampuPeriode.
  const snap = isAktif
    ? await db.collection('mataKuliah').where('dosenIds', 'array-contains', dosenId).get()
    : await db.collection('mataKuliah').get();

  const rows = await Promise.all(snap.docs.map(async d => {
    const mk = d.data();
    const ref = d.ref;
    let diampu = false;
    const p = await ref.collection('pengampuPeriode').doc(periodeId).get();
    if (p.exists) diampu = (p.data().dosenIds || []).includes(dosenId);
    else diampu = isAktif && mk.periodeAktifId === periodeId;
    if (!diampu) return null;
    const r = await ref.collection('rpsPeriode').doc(periodeId).get();
    const rd = r.exists ? r.data() : null;
    return {
      id: d.id, kode: mk.kode, nama: mk.nama, sks: mk.sks, kelas: mk.kelas || null, semester: mk.semester || null,
      sudah: !!(rd && rd.fileUrl), fileUrl: rd ? rd.fileUrl || null : null, uploadedAt: rd ? rd.uploadedAt || null : null
    };
  }));
  const daftar = rows.filter(Boolean).sort((a, b) => ((a.semester || 0) - (b.semester || 0)) || String(a.kode).localeCompare(String(b.kode)));
  return { periodeId, periodeLabel, isAktif, daftar, belum: daftar.filter(x => !x.sudah), total: daftar.length };
}

function getStatusRpsDosen(db, dosenId, periodeId) {
  const pid = periodeId || academic.getActivePeriodeId();
  return cache.getOrFetch(`${dosenId}|${pid}`, () => hitung(db, dosenId, pid));
}
function resetStatusRps(dosenId) {
  Array.from(cache.store.keys()).forEach(k => { if (String(k).startsWith(`${dosenId}|`)) cache.delete(k); });
}

module.exports = { getStatusRpsDosen, resetStatusRps };
