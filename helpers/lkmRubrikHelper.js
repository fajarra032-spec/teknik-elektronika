// helpers/lkmRubrikHelper.js
//
// Menghubungkan nilai LKM praktikum (koleksi 'lkmPengumpulan', diisi dosen di
// halaman "Kumpulan LKM") ke RUBRIK penilaian (komponen 'LKM' di koleksi
// 'nilai', dihitung di hitungRubrik() - helpers/nilaiHelper.js).
//
// Aturan hitung (sama semangatnya dengan "Rata Tugas"):
//  - Nilai LKM rubrik = RATA-RATA nilai semua LKM yang SUDAH DIPERIKSA dan
//    BERNILAI (angka) pada modul praktikum yang saat ini dipublikasikan.
//  - LKM yang belum dikumpulkan / belum diperiksa / diperiksa tanpa nilai
//    tidak ikut dihitung (bukan dianggap 0).
//  - Kalau belum ada satupun LKM bernilai, komponen LKM dihapus dari rubrik
//    (supaya tidak ada angka basi setelah dosen mengosongkan nilai).
//
// Komponen ini baru ikut Nilai Akhir kalau bobot LKM (rubrikBobot.bobot.lkm)
// > 0; default 0 sehingga rubrik mata kuliah yang sudah berjalan TIDAK berubah.

const { db } = require('../config/firebaseAdmin');
const { saveKomponenRubrik, getPeriodeAktif } = require('./nilaiHelper');
const { getPublishedModulPraktikum } = require('./modulPraktikumHelper');

const TIPE_LKM = 'LKM';

/** Rata-rata (dibulatkan 2 desimal) dari daftar dokumen lkmPengumpulan yang layak dihitung; null kalau tidak ada. */
function rataLkm(docs, modulIdSet) {
  const nilai = [];
  docs.forEach(d => {
    if (d.status !== 'diperiksa') return;
    if (modulIdSet && !modulIdSet.has(d.modulId)) return;
    if (d.nilaiPraktikum === null || d.nilaiPraktikum === undefined || d.nilaiPraktikum === '') return;
    const n = Number(d.nilaiPraktikum);
    if (Number.isFinite(n)) nilai.push(n);
  });
  if (nilai.length === 0) return null;
  return Math.round((nilai.reduce((a, b) => a + b, 0) / nilai.length) * 100) / 100;
}

async function getModulIdSetPublished(mkId) {
  const mkDoc = await db.collection('mataKuliah').doc(mkId).get();
  if (!mkDoc.exists) return null;
  const mk = { id: mkId, ...mkDoc.data() };
  if (mk.praktikumPublished !== true) return new Set();
  return new Set(getPublishedModulPraktikum(mk).modulList.map(m => m.id));
}

async function hapusKomponenLkm(mahasiswaId, mkId) {
  const snap = await db.collection('nilai')
    .where('mahasiswaId', '==', mahasiswaId)
    .where('mkId', '==', mkId)
    .where('tipe', '==', TIPE_LKM)
    .get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

/** Sinkronkan nilai LKM SATU mahasiswa di satu MK ke rubrik. */
async function sinkronLkmMahasiswa(mkId, mahasiswaId, periode = getPeriodeAktif(), modulIdSetOpsional = null) {
  const modulIdSet = modulIdSetOpsional || await getModulIdSetPublished(mkId);
  if (!modulIdSet) return { status: 'mk_tidak_ada' };
  const snap = await db.collection('lkmPengumpulan')
    .where('mkId', '==', mkId)
    .where('mahasiswaId', '==', mahasiswaId)
    .get();
  const rata = rataLkm(snap.docs.map(d => d.data()), modulIdSet);
  if (rata === null) {
    await hapusKomponenLkm(mahasiswaId, mkId);
    return { status: 'dihapus', nilai: null };
  }
  await saveKomponenRubrik(mahasiswaId, mkId, TIPE_LKM, rata, periode);
  return { status: 'tersimpan', nilai: rata };
}

/** Sinkronkan SEMUA mahasiswa di satu MK (dipakai saat bobot LKM dinyalakan / tombol sinkron manual). */
async function sinkronLkmSatuMk(mkId, periode = getPeriodeAktif()) {
  const modulIdSet = await getModulIdSetPublished(mkId);
  if (!modulIdSet) return { jumlah: 0 };
  const snap = await db.collection('lkmPengumpulan').where('mkId', '==', mkId).get();
  const perMahasiswa = new Map();
  snap.docs.forEach(doc => {
    const d = doc.data();
    if (!d.mahasiswaId) return;
    if (!perMahasiswa.has(d.mahasiswaId)) perMahasiswa.set(d.mahasiswaId, []);
    perMahasiswa.get(d.mahasiswaId).push(d);
  });

  let jumlah = 0;
  const ids = [...perMahasiswa.keys()];
  const BATCH = 10; // bertahap supaya tidak menembak Firestore ratusan permintaan sekaligus
  for (let i = 0; i < ids.length; i += BATCH) {
    await Promise.all(ids.slice(i, i + BATCH).map(async mid => {
      const rata = rataLkm(perMahasiswa.get(mid), modulIdSet);
      if (rata === null) await hapusKomponenLkm(mid, mkId);
      else { await saveKomponenRubrik(mid, mkId, TIPE_LKM, rata, periode); jumlah++; }
    }));
  }
  return { jumlah };
}

module.exports = { TIPE_LKM, rataLkm, sinkronLkmMahasiswa, sinkronLkmSatuMk };
