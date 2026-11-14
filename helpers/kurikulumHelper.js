// helpers/kurikulumHelper.js
// Perhitungan di atas data hardcoded data/kurikulum/kurikulum2024.js: struktur per konsentrasi,
// pengecekan SKS, cakupan CPL per konsentrasi, serta peta item Master Dokumen -> Dokumen Kurikulum.
// Murni fungsi (tanpa akses database).

const D = require('../data/kurikulum/kurikulum2024');

const mkKonsentrasi = k => D.MK.filter(m => !m.konsentrasi || m.konsentrasi === k);
const jenisSks = mk => ({ WUD: 0, PD: 0, PEK: 0, WP: 0, ...mk.reduce((a, m) => { a[m.jenis] = (a[m.jenis] || 0) + m.sks; return a; }, {}) });

function perSemester(k) {
  const mk = mkKonsentrasi(k);
  return [1, 2, 3, 4, 5, 6].map(s => {
    const list = mk.filter(m => m.semester === s);
    return { semester: s, mk: list, teori: list.reduce((a, m) => a + m.teori, 0), praktik: list.reduce((a, m) => a + m.praktik, 0), sks: list.reduce((a, m) => a + m.sks, 0) };
  });
}

/** Cakupan CPL pada satu konsentrasi: MK pendukung per CPL (per jenis) dan MK yang tidak punya CPL. */
function cakupanCpl(k) {
  const kode = new Set(mkKonsentrasi(k).map(m => m.kode));
  const byKode = Object.fromEntries(D.MK.map(m => [m.kode, m]));
  const baris = D.cpl.map(c => {
    const mk = (D.MATRIKS[c.kode] || []).filter(x => kode.has(x)).map(x => byKode[x]);
    return { cpl: c.kode, jumlah: mk.length, perJenis: { WUD: mk.filter(m => m.jenis === 'WUD').length, PD: mk.filter(m => m.jenis === 'PD').length, PEK: mk.filter(m => m.jenis === 'PEK').length, WP: mk.filter(m => m.jenis === 'WP').length }, mk };
  });
  const terpetakan = new Set(Object.values(D.MATRIKS).flat());
  return { baris, tanpaCpl: mkKonsentrasi(k).filter(m => !terpetakan.has(m.kode)) };
}

/** Matriks siap tampil: kolom = MK konsentrasi (urut semester), baris = CPL. */
function matriks(k) {
  const mk = mkKonsentrasi(k);
  return { kolom: mk, baris: D.cpl.map(c => ({ cpl: c.kode, ringkas: c.ringkas, tanda: mk.map(m => (D.MATRIKS[c.kode] || []).includes(m.kode)) })) };
}

/** Pengecekan konsistensi angka kurikulum (otomatis, dari data). */
function pemeriksaan() {
  const out = [];
  D.KONSENTRASI.forEach(k => {
    const sem = perSemester(k), total = sem.reduce((a, s) => a + s.sks, 0), j = jenisSks(mkKonsentrasi(k));
    out.push({ ok: total === D.identitas.totalSks, teks: `Konsentrasi ${k}: total ${total} SKS (target ${D.identitas.totalSks}).` });
    out.push({ ok: sem.every(s => s.sks === 20), teks: `Konsentrasi ${k}: SKS per semester ${sem.map(s => s.sks).join(' / ')} (target 20 tiap semester).` });
    out.push({ ok: j.WUD === 12 && j.PD === 30 && j.PEK === 18 && j.WP === 60, teks: `Konsentrasi ${k}: WUD ${j.WUD}, PD ${j.PD}, PEK ${j.PEK}, WP ${j.WP} (dokumen: 12 / 30 / 18 / 60).` });
    const c = cakupanCpl(k);
    out.push({ ok: c.baris.every(b => b.jumlah > 0), teks: `Konsentrasi ${k}: semua CPL didukung minimal satu mata kuliah.` });
    out.push({ ok: c.tanpaCpl.length === 0, teks: c.tanpaCpl.length ? `Konsentrasi ${k}: MK tanpa CPL: ${c.tanpaCpl.map(m => m.kode).join(', ')}.` : `Konsentrasi ${k}: setiap mata kuliah terhubung ke minimal satu CPL.` });
  });
  out.push({ ok: D.penilaianMagang.reduce((a, p) => a + p.bobot, 0) === 100, teks: 'Bobot penilaian magang di kurikulum berjumlah 100%.' });
  return out;
}

/** Item Master Dokumen yang isinya sudah ada di Dokumen Kurikulum -> status awal dan bagian halaman. */
const PETA_MASTER = {
  'Visi, misi, tujuan dan strategi (VMTS)': { status: 'ada', bagian: 'identitas', ket: 'VMTS ada di Dokumen Kurikulum 2024 (Bab II)' },
  'Dokumen Kurikulum': { status: 'ada', bagian: 'struktur', ket: 'Dokumen Kurikulum 2024, SK 1182/D/Polidewa/VIII/2024' },
  'Profil Lulusan': { status: 'ada', bagian: 'cpl', ket: 'Profil Lulusan ada di Dokumen Kurikulum 2024 (Bab III)' },
  'CPL': { status: 'ada', bagian: 'cpl', ket: 'CPL-1 sampai CPL-6 ada di Dokumen Kurikulum 2024 (Bab IV)' },
  'Matriks CPL dan Mata Kuliah': { status: 'ada', bagian: 'matriks', ket: 'Matriks CPL-MK ada di Dokumen Kurikulum 2024 (Tabel 11-15)' },
  'Peta kurikulum': { status: 'ada', bagian: 'struktur', ket: 'Sebaran MK per semester ada di Dokumen Kurikulum 2024 (Tabel 4-10)' }
};

module.exports = { D, mkKonsentrasi, jenisSks, perSemester, cakupanCpl, matriks, pemeriksaan, PETA_MASTER };
