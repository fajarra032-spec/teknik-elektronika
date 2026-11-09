/**
 * Pembantu ringkas untuk menulis blueprint LKM (lihat views/lkm_blueprint_print.ejs).
 * Tiap fungsi mengembalikan satu "blok" yang dirender oleh template cetak.
 *
 * Jenis blok: tabel, gambar, grid, kode, ruang, tanya, cek, form, alur, foto,
 * rubrik, etiket, baris, rumus, catatan, dua, tiga, osc, hal (pemenggalan paksa).
 */
const tb = (j, cols, o) => Object.assign({ t: 'tabel', j, cols }, o || {});
const gb = (j, h, o) => Object.assign({ t: 'gambar', j, h }, o || {});
const gr = (j, h, x, y, o) => Object.assign({ t: 'grid', j, h, x, y }, o || {});
const kd = (j, h, cap, o) => Object.assign({ t: 'kode', j, h, cap }, o || {});
const ru = (j, n, o) => Object.assign({ t: 'ruang', j, n }, o || {});
const tn = (j, q, n, o) => Object.assign({ t: 'tanya', j, q, n: n || 2 }, o || {});
const ck = (j, items, o) => Object.assign({ t: 'cek', j, items }, o || {});
const fm = (j, f, o) => Object.assign({ t: 'form', j, f }, o || {});
const al = (j, b, h, o) => Object.assign({ t: 'alur', j, b, h }, o || {});
const ft = (j, l, o) => Object.assign({ t: 'foto', j, l }, o || {});
const rb = (j, r, o) => Object.assign({ t: 'rubrik', j, r }, o || {});
const du = (j, a, b, o) => Object.assign({ t: 'dua', j, a, b }, o || {});
const tg = (j, p, o) => Object.assign({ t: 'tiga', j, p }, o || {});
const ba = (j, f, o) => Object.assign({ t: 'baris', j, f }, o || {});
const ru1 = (j, text) => ({ t: 'rumus', j, text });
const HAL = { t: 'hal' };
module.exports = { tb, gb, gr, kd, ru, tn, ck, fm, al, ft, rb, du, tg, ba, ru1, HAL, etiket: (j) => ({ t: 'etiket', j }), osc: (j, rows) => ({ t: 'osc', j, rows }) };
