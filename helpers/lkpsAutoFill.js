// helpers/lkpsAutoFill.js
//
// Isi otomatis Tabel LKPS dari data yang SUDAH ada di sistem:
//   tabel1 <- koleksi mataKuliah (+ cek RPS tersimpan di mataKuliah/{id}/rps/utama)
//   tabel5 <- koleksi dosen (+ MK yang diampu, dari mataKuliah.dosenIds & dosen.mataKuliahIds)
//   tabel6 <- koleksi alatLab (alat aktif)
//
// Aturan aman: HANYA MENAMBAH baris yang belum ada (cocokkan lewat kunci per tabel),
// tidak pernah menimpa/menghapus baris yang sudah ada atau sudah diedit manual.
// Kolom yang datanya tidak ada di sistem sengaja dibiarkan kosong (jangan ditebak).
// Baris hasil isi otomatis diberi tanda autoSumber untuk penelusuran.

const { db } = require('../config/firebaseAdmin');

const AUTO_INFO = {
  tabel1: { sumber: 'Dokumen Kurikulum 2024 (+ cek RPS di data Mata Kuliah)', diisi: 'semester, kode, nama, SKS (total teori + praktik), MK inti keahlian, status dokumen RPS, unit penyelenggara (Prodi)', manual: 'SKS seminar, konversi jam, dan pemisahan SKS kuliah vs praktik bila instrumen meminta' },
  tabel5: { sumber: 'data Dosen', diisi: 'nama, NIP/NIDN, MK yang diampu', manual: 'kategori dosen, pendidikan, bidang keahlian, jabatan akademik, sertifikat, homebase PDDikti' },
  tabel6: { sumber: 'Inventaris Alat Lab', diisi: 'nama alat, lokasi (prasarana), jumlah, kondisi baik/rusak', manual: 'jumlah prasarana, kepemilikan, logbook penggunaan, rata-rata jam/minggu' }
};

const norm = v => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');

async function barisAda(collection, periodeId) {
  const snap = await db.collection(collection).where('periodeId', '==', periodeId).get();
  return snap.docs.map(d => d.data());
}

async function simpanBaris(collection, periodeId, rows, sumber) {
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += 400) {
    const batch = db.batch();
    rows.slice(i, i + 400).forEach(r => {
      batch.set(db.collection(collection).doc(), { periodeId, ...r, autoSumber: sumber, createdAt: now, updatedAt: now });
    });
    await batch.commit();
  }
}

async function isiTabel1(periodeId, collection) {
  // Sumber: Dokumen Kurikulum 2024 yang di-hardcode (data/kurikulum/kurikulum2024.js), bukan koleksi mataKuliah,
  // supaya daftar MK mengikuti kurikulum resmi. Koleksi mataKuliah hanya dipakai untuk mengecek RPS tersimpan.
  const kur = require('../data/kurikulum/kurikulum2024');
  const ada = new Set((await barisAda(collection, periodeId)).map(r => norm(r.kodeMk)));
  const agamaSudahAda = ['WUD2201', 'WUD2202', 'WUD2203', 'WUD2204', 'WUD2205'].some(k => ada.has(norm(k))); // baris lama dari DB

  const mkSnap = await db.collection('mataKuliah').get();
  const idPerKode = {};
  mkSnap.docs.forEach(d => { const k = norm(d.data().kode); if (k) (idPerKode[k] = idPerKode[k] || []).push(d.id); });
  const kodeRps = k => (k === 'WUD2201-5' ? ['WUD2201', 'WUD2202', 'WUD2203', 'WUD2204', 'WUD2205'] : [k]);

  const calon = kur.MK.filter(m => !ada.has(norm(m.kode)) && !(m.kode === 'WUD2201-5' && agamaSudahAda));
  const punyaRps = {};
  for (const m of calon) {
    const ids = kodeRps(m.kode).flatMap(k => idPerKode[norm(k)] || []);
    if (!ids.length) { punyaRps[m.kode] = false; continue; }
    const docs = await db.getAll(...ids.map(id => db.collection('mataKuliah').doc(id).collection('rps').doc('utama')));
    punyaRps[m.kode] = docs.some(d => d.exists);
  }

  const rows = calon.map(m => ({
    semester: m.semester,
    kodeMk: m.kode,
    namaMk: m.konsentrasi ? `${m.nama} (Konsentrasi ${m.konsentrasi})` : m.nama,
    mkKompetensi: m.jenis === 'PEK',
    bobotKuliah: m.sks,
    bobotSeminar: null,
    konversiJam: null,
    dokumenRps: punyaRps[m.kode] ? 'Ada' : 'Tidak Ada',
    unitPenyelenggara: 'Prodi'
  }));
  await simpanBaris(collection, periodeId, rows, 'kurikulum2024');
  return { ditambah: rows.length, dilewati: kur.MK.length - rows.length, catatan: 'Daftar MK dari Dokumen Kurikulum 2024. "Dokumen RPS" = Ada hanya jika RPS sudah disimpan dosen di web; SKS diisi total (teori + praktik).' };
}

async function isiTabel5(periodeId, collection) {
  const [dosenSnap, mkSnap] = await Promise.all([db.collection('dosen').orderBy('nama').get(), db.collection('mataKuliah').get()]);
  const ada = new Set((await barisAda(collection, periodeId)).map(r => norm(r.namaDosen)));

  const mkById = {};
  mkSnap.docs.forEach(d => { mkById[d.id] = d.data(); });
  const mkPerDosen = {}; // dosenId -> Set nama MK
  const tambah = (dosenId, mk) => { if (!dosenId || !mk) return; (mkPerDosen[dosenId] = mkPerDosen[dosenId] || new Set()).add(mk.nama || mk.kode); };
  mkSnap.docs.forEach(d => (d.data().dosenIds || []).forEach(did => tambah(did, d.data())));
  dosenSnap.docs.forEach(d => (d.data().mataKuliahIds || []).forEach(mid => tambah(d.id, mkById[mid])));

  const rows = [];
  dosenSnap.docs.forEach(d => {
    const x = d.data();
    if (!x.nama || ada.has(norm(x.nama))) return;
    rows.push({
      namaDosen: x.nama,
      nidn: x.nip || '',
      mkDiampu: mkPerDosen[d.id] ? [...mkPerDosen[d.id]].join(', ') : ''
    });
  });
  await simpanBaris(collection, periodeId, rows, 'dosen');
  return { ditambah: rows.length, dilewati: dosenSnap.size - rows.length, catatan: 'Kolom NIDN/NIDK/NUPTK diisi dari NIP di data dosen; pastikan sesuai. Kategori dosen dan kolom lain perlu dilengkapi manual.' };
}

async function isiTabel6(periodeId, collection) {
  const snap = await db.collection('alatLab').orderBy('nama').get();
  const ada = new Set((await barisAda(collection, periodeId)).map(r => `${norm(r.namaPrasarana)}|${norm(r.namaSarana)}`));
  const aktif = snap.docs.map(d => d.data()).filter(a => a.aktif !== false);
  const rows = [];
  aktif.forEach(a => {
    const namaSarana = a.merk ? `${a.nama} (${a.merk})` : (a.nama || '');
    const key = `${norm(a.lokasi)}|${norm(namaSarana)}`;
    if (!namaSarana || ada.has(key)) return;
    ada.add(key);
    const total = Number(a.jumlahTotal) || 0, rusak = Number(a.jumlahRusak) || 0;
    rows.push({
      namaPrasarana: a.lokasi || '',
      jumlahPrasarana: null,
      namaSarana,
      jumlahAlat: total,
      kepemilikan: '',
      kondisi: rusak ? `${total - rusak} baik, ${rusak} rusak` : 'Baik',
      logbook: false,
      rataWaktu: null
    });
  });
  await simpanBaris(collection, periodeId, rows, 'alatLab');
  return { ditambah: rows.length, dilewati: aktif.length - rows.length, catatan: 'Hanya alat berstatus aktif. Kepemilikan, logbook, dan jam penggunaan perlu dilengkapi manual.' };
}

const HANDLER = { tabel1: isiTabel1, tabel5: isiTabel5, tabel6: isiTabel6 };

async function isiOtomatis(tableKey, periodeId, collection) {
  const fn = HANDLER[tableKey];
  if (!fn) return null;
  return fn(periodeId, collection);
}

module.exports = { AUTO_INFO, isiOtomatis };
