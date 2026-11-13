// data/sop/index.js - gabungan Buku Induk (master.js) + isi SOP (detail/*.js)
const fs = require('fs');
const path = require('path');
const master = require('./master');

const detail = {};
const dir = path.join(__dirname, 'detail');
fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => {
  const d = require(path.join(dir, f));
  detail[d.kode] = d;
});

// SOP yang sudah ada sebagai halaman tersendiri (bukan dari data/sop/detail)
const URL_EKSTERNAL = { 'SOP-TE-006': '/dokumen/sop-pelaporan-nilai' };

function semua() {
  return master.map(m => ({ ...m, tersedia: !!detail[m.kode], urlEksternal: URL_EKSTERNAL[m.kode] || null }));
}
function get(kode) {
  const m = master.find(x => x.kode === kode);
  if (!m) return null;
  return { ...m, isi: detail[kode] || null, urlEksternal: URL_EKSTERNAL[kode] || null };
}
module.exports = { semua, get };
