/**
 * data/rpsDetail/index.js
 *
 * Rincian per pertemuan (judul spesifik, butir materi, Sub-CPMK, indikator) untuk
 * TIAP mata kuliah, dipakai sebagai isi awal tab RPS dosen (helpers/rpsHelper.js).
 * Topik besar, metode, dan bobot tetap dari RPS resmi (data/rencanaPertemuanData.js).
 *
 *   const { getDetailPertemuan } = require('./rpsDetail');
 *   const d = getDetailPertemuan('PD3210');  // { 1: {judul, poin, sub, ind, metode}, ..., 15: {...} } | null
 *
 * Mengubah isi: edit sem1.js / sem2.js / sem3a.js / sem3b.js (butir dasar) dan tambahan1.js / tambahan2.js /
 * tambahan3a.js / tambahan3b.js (butir tambahan + kegiatan). 14 entri per MK, urut P1-7 lalu P9-15.
 */
const { KODE_MAP } = require('../rencanaPertemuanData');

const SEMUA = Object.assign({}, require('./sem1'), require('./sem2'), require('./sem3a'), require('./sem3b'));
const TAMBAHAN = Object.assign({}, require('./tambahan1'), require('./tambahan2'), require('./tambahan3a'), require('./tambahan3b'));
const URUTAN = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];

// Gabungkan butir dasar + tambahan tanpa duplikat: bila dua butir hampir sama
// (kemiripan kata >= 60%), yang dipertahankan adalah yang lebih lengkap.
const kata = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2));
const mirip = (a, b) => {
  const A = kata(a), B = kata(b);
  let irisan = 0; A.forEach(w => { if (B.has(w)) irisan++; });
  const gabung = A.size + B.size - irisan;
  if (A.size > 0 && B.size > 0 && (irisan === A.size || irisan === B.size)) return true; // satu butir sudah tercakup butir lain
  return gabung > 0 && irisan / gabung >= 0.6;
};
function gabungButir(dasar, tambahan) {
  const hasil = [];
  dasar.concat(tambahan).forEach((x) => {
    const i = hasil.findIndex(y => mirip(x, y));
    if (i === -1) hasil.push(x);
    else if (x.length > hasil[i].length) hasil[i] = x;
  });
  return hasil;
}

// Sekali di awal: ubah array 14 entri jadi peta {pertemuan: entri}
const PETA = {};
Object.keys(SEMUA).forEach((kunci) => {
  const arr = SEMUA[kunci];
  if (arr.length !== URUTAN.length) throw new Error(`rpsDetail "${kunci}" harus ${URUTAN.length} entri, dapat ${arr.length}`);
  const tam = TAMBAHAN[kunci];
  if (!tam || tam.length !== URUTAN.length) throw new Error(`rpsDetail tambahan "${kunci}" harus ${URUTAN.length} entri, dapat ${tam ? tam.length : 'tidak ada'}`);
  PETA[kunci] = {};
  arr.forEach((e, i) => {
    // butir dasar (sem*.js) + butir tambahan (tambahan*.js) + baris kegiatan
    PETA[kunci][URUTAN[i]] = Object.assign({}, e, { poin: gabungButir(e.poin, tam[i].extra), keg: tam[i].keg });
  });
});

function getDetailPertemuan(kode) {
  const kunci = KODE_MAP[String(kode || '').toUpperCase().trim()];
  return kunci && PETA[kunci] ? PETA[kunci] : null;
}

module.exports = { getDetailPertemuan, DETAIL: PETA, URUTAN };
