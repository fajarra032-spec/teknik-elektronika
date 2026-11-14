// scripts/pasang-akreditasi.js
// Memasang SEMUA mount fitur akreditasi di app.js (Master Dokumen, Dokumen Kurikulum, Tim Persiapan)
// tanpa menimpa file Anda. Hanya menambah yang belum ada, membuat cadangan app.js.bak-akreditasi,
// aman diulang. Dari folder proyek: node scripts/pasang-akreditasi.js
const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app.js');
let s = fs.readFileSync(file, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const anchor = "app.use('/dosen/akreditasi/tabel', dosenAkreditasiTabelRouter);";
const i = s.indexOf(anchor);
if (i < 0) { console.error('Baris acuan tidak ditemukan di app.js. Tambahkan mount secara manual (lihat BACA-DULU-TIM.txt).'); process.exit(1); }

const blok = [
  ['akreditasiMaster', ["    // Master Dokumen Prodi (Pusat Data Dokumen)",
    "    app.use('/admin/akreditasi/master', require('./routes/admin/akreditasiMaster'));",
    "    app.use('/dosen/akreditasi/master', require('./routes/dosen/akreditasiMasterRoute'));"]],
  ['akreditasiKurikulum', ["    // Dokumen Kurikulum 2024 (data hardcoded)",
    "    app.use('/admin/akreditasi/kurikulum', require('./routes/admin/akreditasiKurikulum'));",
    "    app.use('/dosen/akreditasi/kurikulum', require('./routes/dosen/akreditasiKurikulumRoute'));"]],
  ['akreditasiTim', ["    // Tim Persiapan Akreditasi (SK 5666/ELK/POLIDEWA/XI/2026)",
    "    app.use('/admin/akreditasi/tim', require('./routes/admin/akreditasiTim'));",
    "    app.use('/dosen/akreditasi/tim', require('./routes/dosen/akreditasiTimRoute'));"]]
];
const tambah = blok.filter(b => !s.includes(b[0])).map(b => ['', ...b[1]].join(eol));
if (!tambah.length) { console.log('Semua sudah terpasang, tidak ada perubahan.'); process.exit(0); }
const end = i + anchor.length;
fs.writeFileSync(file + '.bak-akreditasi', s);
fs.writeFileSync(file, s.slice(0, end) + tambah.join(eol) + s.slice(end));
console.log(`Terpasang ${tambah.length} blok. Cadangan: app.js.bak-akreditasi. Restart aplikasi.`);
