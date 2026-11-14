// scripts/pasang-master-akreditasi.js
// Memasang 4 baris mount Master Dokumen Akreditasi di app.js (tanpa menimpa file Anda).
// Aman diulang; membuat cadangan app.js.bak-master. Jalankan dari folder proyek:
//   node scripts/pasang-master-akreditasi.js
const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app.js');
let s = fs.readFileSync(file, 'utf8');
if (s.includes('akreditasiMaster')) { console.log('Sudah terpasang, tidak ada perubahan.'); process.exit(0); }
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const anchor = "app.use('/dosen/akreditasi/tabel', dosenAkreditasiTabelRouter);";
const i = s.indexOf(anchor);
if (i < 0) { console.error('Baris acuan tidak ditemukan di app.js. Tambahkan 4 baris mount secara manual (lihat BACA-DULU-INTEGRASI-SOP.txt).'); process.exit(1); }
const end = i + anchor.length;
const add = [
  '', '    // Master Dokumen Prodi (buku induk administrasi untuk akreditasi)',
  "    const adminAkreditasiMasterRouter = require('./routes/admin/akreditasiMaster');",
  "    const dosenAkreditasiMasterRouter = require('./routes/dosen/akreditasiMasterRoute');",
  "    app.use('/admin/akreditasi/master', adminAkreditasiMasterRouter);",
  "    app.use('/dosen/akreditasi/master', dosenAkreditasiMasterRouter);"
].join(eol);
fs.writeFileSync(file + '.bak-master', s);
fs.writeFileSync(file, s.slice(0, end) + add + s.slice(end));
console.log('Terpasang. Cadangan: app.js.bak-master. Restart aplikasi.');
