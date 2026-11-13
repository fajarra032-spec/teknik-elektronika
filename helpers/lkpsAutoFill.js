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
  tabel1: { sumber: 'data Mata Kuliah', diisi: 'semester, kode MK, nama MK, SKS kuliah, status dokumen RPS, unit penyelenggara (Prodi)', manual: 'MK kompetensi inti, SKS seminar, konversi jam' },
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
  const mkSnap = await db.collection('mataKuliah').orderBy('kode').get();
  const ada = new Set((await barisAda(collection, periodeId)).map(r => norm(r.kodeMk)));

  // Satu MK bisa punya beberapa dokumen (per kelas) -> ambil satu per kode.
  const perKode = new Map();
  mkSnap.docs.forEach(d => { const m = d.data(); if (m.kode && !perKode.has(norm(m.kode))) perKode.set(norm(m.kode), { id: d.id, ...m }); });
  const calon = [...perKode.values()].filter(m => !ada.has(norm(m.kode)));

  // Cek RPS tersimpan (dibaca paralel per 100 dokumen)
  const rpsAda = {};
  for (let i = 0; i < calon.length; i += 100) {
    const chunk = calon.slice(i, i + 100);
    const docs = await db.getAll(...chunk.map(m => db.collection('mataKuliah').doc(m.id).collection('rps').doc('utama')));
    docs.forEach((doc, idx) => { rpsAda[chunk[idx].id] = doc.exists; });
  }

  const rows = calon.map(m => ({
    semester: m.semester != null ? Number(m.semester) : null,
    kodeMk: m.kode,
    namaMk: m.nama || '',
    mkKompetensi: false,
    bobotKuliah: m.sks != null ? Number(m.sks) : null,
    bobotSeminar: null,
    konversiJam: null,
    dokumenRps: rpsAda[m.id] ? 'Ada' : 'Tidak Ada',
    unitPenyelenggara: 'Prodi'
  }));
  await simpanBaris(collection, periodeId, rows, 'mataKuliah');
  return { ditambah: rows.length, dilewati: perKode.size - rows.length, catatan: 'Status RPS "Ada" = RPS sudah disimpan dosen di web; selain itu ditandai "Tidak Ada" (periksa lagi).' };
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
