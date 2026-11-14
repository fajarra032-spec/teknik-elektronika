// scripts/pasang-kurikulum-akreditasi.js
// Memasang 2 baris mount Dokumen Kurikulum 2024 di app.js (tanpa menimpa file Anda). Aman diulang,
// membuat cadangan app.js.bak-kurikulum. Jalankan dari folder proyek: node scripts/pasang-kurikulum-akreditasi.js
const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'app.js');
let s = fs.readFileSync(file, 'utf8');
if (s.includes('akreditasiKurikulum')) { console.log('Sudah terpasang, tidak ada perubahan.'); process.exit(0); }
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const anchor = "app.use('/dosen/akreditasi/tabel', dosenAkreditasiTabelRouter);";
const i = s.indexOf(anchor);
if (i < 0) { console.error('Baris acuan tidak ditemukan. Tambahkan 2 baris mount secara manual (lihat BACA-DULU-KURIKULUM.txt).'); process.exit(1); }
const end = i + anchor.length;
const add = [
  '', '    // Dokumen Kurikulum 2024 (data hardcoded) untuk workspace akreditasi',
  "    app.use('/admin/akreditasi/kurikulum', require('./routes/admin/akreditasiKurikulum'));",
  "    app.use('/dosen/akreditasi/kurikulum', require('./routes/dosen/akreditasiKurikulumRoute'));"
].join(eol);
fs.writeFileSync(file + '.bak-kurikulum', s);
fs.writeFileSync(file, s.slice(0, end) + add + s.slice(end));
console.log('Terpasang. Cadangan: app.js.bak-kurikulum. Restart aplikasi.');
