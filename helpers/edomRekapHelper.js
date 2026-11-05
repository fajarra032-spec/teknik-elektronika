// helpers/edomRekapHelper.js
// Agregasi hasil EDOM untuk tampilan admin (rekap per dosen, per indikator,
// per pertanyaan, per mata kuliah, dan umpan balik teks).
const { db } = require('../config/firebaseAdmin');

const INDIKATOR_URUT = ['Kepribadian', 'Pedagogik', 'Profesional', 'Sosial'];

/** Predikat + warna dari rata-rata skala 1-5 */
function predikat(nilai) {
  const n = Number(nilai) || 0;
  if (n >= 4.5) return { label: 'Sangat Baik', warna: 'success', hex: '#16a34a', bg: '#dcfce7', fg: '#166534' };
  if (n >= 3.5) return { label: 'Baik', warna: 'primary', hex: '#2563eb', bg: '#dbeafe', fg: '#1e40af' };
  if (n >= 2.5) return { label: 'Cukup', warna: 'warning', hex: '#d97706', bg: '#fef3c7', fg: '#92400e' };
  if (n > 0) return { label: 'Kurang', warna: 'danger', hex: '#dc2626', bg: '#fee2e2', fg: '#991b1b' };
  return { label: '-', warna: 'secondary', hex: '#94a3b8', bg: '#f1f5f9', fg: '#94a3b8' };
}

const rata = (sum, n) => (n > 0 ? sum / n : 0);
const f2 = (v) => (Number(v) || 0).toFixed(2);

/** id pertanyaan -> { pertanyaan, indikator, urutan, tipe, skala } (SEMUA pertanyaan, termasuk nonaktif) */
async function ambilKuisionerMap() {
  const snap = await db.collection('edom_kuisioner').get();
  const map = new Map();
  snap.docs.forEach(d => {
    const q = d.data();
    map.set(d.id, {
      pertanyaan: q.pertanyaan, indikator: q.indikator || null,
      urutan: q.urutan || 0, tipe: q.tipe || 'rating', skala: q.skala || 5,
    });
  });
  return map;
}

async function ambilResponPeriode(periodeId) {
  const snap = await db.collection('edom_respon').where('periodeId', '==', periodeId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function tambahIndikator(obj, nama, nilai) {
  const k = nama || 'Lainnya';
  if (!obj[k]) obj[k] = { sum: 0, count: 0 };
  obj[k].sum += nilai;
  obj[k].count++;
}

function urutkanIndikator(obj) {
  const nama = Object.keys(obj).sort((a, b) => {
    const ia = INDIKATOR_URUT.indexOf(a), ib = INDIKATOR_URUT.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return nama.map(n => ({ nama: n, rata: rata(obj[n].sum, obj[n].count), count: obj[n].count }));
}

/** Rekap seluruh dosen pada satu periode (termasuk matriks dosen x pernyataan) */
function hitungRekapPeriode(responList, kuisMap) {
  const dosenMap = new Map();
  const mahasiswa = new Set();
  const pertMap = new Map();      // key pertanyaan -> { pertanyaan, indikator, urutan, sum, count }
  const indikatorSemua = {};
  let totalSemua = 0;
  let muncul = 0;

  for (const r of responList) {
    if (r.mahasiswaId) mahasiswa.add(r.mahasiswaId);
    const nilai = Number(r.nilaiRata) || 0;
    totalSemua += nilai;
    if (!dosenMap.has(r.dosenId)) {
      dosenMap.set(r.dosenId, { dosenId: r.dosenId, dosenNama: r.dosenNama || '(tanpa nama)', total: 0, count: 0, mk: new Set(), indikator: {}, pert: {} });
    }
    const e = dosenMap.get(r.dosenId);
    e.total += nilai; e.count++; e.mk.add(r.mkId);
    (r.jawaban || []).forEach(j => {
      if (j.tipe === 'rating' && typeof j.nilai === 'number') {
        const meta = kuisMap.get(j.pertanyaanId) || {};
        const key = j.pertanyaanId || j.pertanyaan;
        tambahIndikator(e.indikator, meta.indikator, j.nilai);
        tambahIndikator(indikatorSemua, meta.indikator, j.nilai);
        if (!pertMap.has(key)) pertMap.set(key, { key, pertanyaan: j.pertanyaan || meta.pertanyaan, indikator: meta.indikator || null, urutan: meta.urutan || (1000 + muncul++), sum: 0, count: 0 });
        const p = pertMap.get(key); p.sum += j.nilai; p.count++;
        if (!e.pert[key]) e.pert[key] = { sum: 0, count: 0 };
        e.pert[key].sum += j.nilai; e.pert[key].count++;
      }
    });
  }

  const pertanyaan = Array.from(pertMap.values()).sort((a, b) => a.urutan - b.urutan).map((p, i) => {
    const rt = rata(p.sum, p.count);
    return { key: p.key, no: i + 1, pertanyaan: p.pertanyaan, indikator: p.indikator, rata: rt, rataTeks: f2(rt), pred: predikat(rt), count: p.count };
  });

  // kelompok indikator berurutan untuk header tabel (colspan)
  const kelompok = [];
  pertanyaan.forEach(p => {
    const nama = p.indikator || 'Lainnya';
    const last = kelompok[kelompok.length - 1];
    if (last && last.nama === nama) last.jumlah++; else kelompok.push({ nama, jumlah: 1 });
  });

  const dosen = Array.from(dosenMap.values()).map(e => {
    const rt = rata(e.total, e.count);
    return {
      dosenId: e.dosenId, dosenNama: e.dosenNama, count: e.count, jumlahMk: e.mk.size,
      rata: rt, rataTeks: f2(rt), pred: predikat(rt), indikator: urutkanIndikator(e.indikator),
      nilai: pertanyaan.map(p => {
        const x = e.pert[p.key];
        if (!x) return null;
        const v = rata(x.sum, x.count);
        return { rata: v, teks: f2(v), pred: predikat(v) };
      }),
    };
  });

  const indikatorAda = [...new Set(dosen.flatMap(d => d.indikator.map(i => i.nama)))]
    .sort((a, b) => (INDIKATOR_URUT.indexOf(a) < 0 ? 99 : INDIKATOR_URUT.indexOf(a)) - (INDIKATOR_URUT.indexOf(b) < 0 ? 99 : INDIKATOR_URUT.indexOf(b)));

  const rataSemua = rata(totalSemua, responList.length);
  return {
    dosen, indikatorAda, pertanyaan, kelompok,
    indikatorSemua: urutkanIndikator(indikatorSemua).map(i => ({ ...i, rataTeks: f2(i.rata), pred: predikat(i.rata) })),
    ringkasan: {
      jumlahRespon: responList.length, jumlahMahasiswa: mahasiswa.size, jumlahDosen: dosen.length,
      rataSemua, rataSemuaTeks: f2(rataSemua), pred: predikat(rataSemua),
    },
  };
}

/** Detail satu dosen: per indikator, per pertanyaan, per MK, dan umpan balik teks */
function hitungDetailDosen(responList, kuisMap, dosenId) {
  const list = responList.filter(r => r.dosenId === dosenId);
  if (!list.length) return null;

  const mkMap = new Map();
  const indikator = {};
  const pertanyaanMap = new Map();
  const teksMap = new Map();
  let total = 0;
  let urutMunculan = 0;

  for (const r of list) {
    const nilai = Number(r.nilaiRata) || 0;
    total += nilai;
    if (!mkMap.has(r.mkId)) mkMap.set(r.mkId, { mkKode: r.mkKode || '', mkNama: r.mkNama || '(tanpa nama)', total: 0, count: 0 });
    const mk = mkMap.get(r.mkId);
    mk.total += nilai; mk.count++;

    (r.jawaban || []).forEach(j => {
      const meta = kuisMap.get(j.pertanyaanId) || {};
      const key = j.pertanyaanId || j.pertanyaan;
      if (j.tipe === 'rating' && typeof j.nilai === 'number') {
        tambahIndikator(indikator, meta.indikator, j.nilai);
        if (!pertanyaanMap.has(key)) {
          pertanyaanMap.set(key, { pertanyaan: j.pertanyaan || meta.pertanyaan, indikator: meta.indikator || null,
            urutan: meta.urutan || (1000 + urutMunculan++), skala: meta.skala || 5, sum: 0, count: 0, dist: [0, 0, 0, 0, 0] });
        }
        const p = pertanyaanMap.get(key);
        p.sum += j.nilai; p.count++;
        if (j.nilai >= 1 && j.nilai <= 5) p.dist[j.nilai - 1]++;
      } else if (j.tipe === 'text' && j.jawabanTeks && String(j.jawabanTeks).trim()) {
        if (!teksMap.has(key)) teksMap.set(key, { pertanyaan: j.pertanyaan || meta.pertanyaan, urutan: meta.urutan || 1000, jawaban: [] });
        teksMap.get(key).jawaban.push({ teks: String(j.jawabanTeks).trim(), mk: r.mkNama || '' });
      }
    });
  }

  const rt = rata(total, list.length);
  return {
    dosenId, dosenNama: list[0].dosenNama || '(tanpa nama)',
    count: list.length, rata: rt, rataTeks: f2(rt), pred: predikat(rt),
    mk: Array.from(mkMap.values()).map(m => ({ ...m, rata: rata(m.total, m.count), rataTeks: f2(rata(m.total, m.count)), pred: predikat(rata(m.total, m.count)) }))
      .sort((a, b) => a.mkNama.localeCompare(b.mkNama)),
    indikator: urutkanIndikator(indikator).map(i => ({ ...i, rataTeks: f2(i.rata), pred: predikat(i.rata) })),
    pertanyaan: Array.from(pertanyaanMap.values()).sort((a, b) => a.urutan - b.urutan)
      .map(p => ({ ...p, rata: rata(p.sum, p.count), rataTeks: f2(rata(p.sum, p.count)), pred: predikat(rata(p.sum, p.count)) })),
    teks: Array.from(teksMap.values()).sort((a, b) => a.urutan - b.urutan),
  };
}

module.exports = { INDIKATOR_URUT, predikat, ambilKuisionerMap, ambilResponPeriode, hitungRekapPeriode, hitungDetailDosen };
