/**
 * scripts/pasang-menu-sop.js - memasang modul SOP ke app.js dan menu (aman, bisa diulang).
 * Jalankan dari folder proyek:  node scripts/pasang-menu-sop.js
 * Membuat cadangan *.bak sebelum mengubah file.
 */
const fs = require('fs');
const sisip = [
  { file: 'app.js',
    cari: /(app\.use\('\/dokumen',\s*require\('\.\/routes\/dokumen'\)\);)/,
    tambah: "\n    app.use('/sop', require('./routes/sop'));   // SOP prodi (publik/internal) + unduh .docx",
    penanda: "require('./routes/sop')" },
  { file: 'app.js',
    cari: /(\r?\n[ \t]*)(const adminRoutes = require\('\.\/routes\/admin\/index'\);)/,
    ganti: "$1app.use('/admin/sop', require('./routes/admin/sop'));   // Buku Induk SOP (admin)$1$2",
    penanda: "require('./routes/admin/sop')" },
  { file: 'views/partials/header-landing.ejs',
    cari: /(<li><a class="dropdown-item" href="\/dokumen\/sop-pelaporan-nilai">[\s\S]*?<\/a><\/li>)/,
    tambah: '\n                        <li><a class="dropdown-item" href="/sop"><i class="bi bi-clipboard2-check-fill me-2"></i>Semua SOP Prodi</a></li>',
    penanda: 'href="/sop"' },
  { file: 'views/partials/header.ejs',
    cari: /(<li><a class="dropdown-item" href="\/admin\/akreditasi">[\s\S]*?<\/a><\/li>)/,
    tambah: '\n                                    <li><a class="dropdown-item" href="/admin/sop"><i class="bi bi-clipboard2-check me-2"></i>Buku Induk SOP</a></li>',
    penanda: 'href="/admin/sop"' }
];
for (const s of sisip) {
  if (!fs.existsSync(s.file)) { console.log('LEWAT (tidak ada):', s.file); continue; }
  let isi = fs.readFileSync(s.file, 'utf8');
  if (isi.includes(s.penanda)) { console.log('SUDAH ADA :', s.file, '-', s.penanda); continue; }
  if (!s.cari.test(isi)) { console.log('GAGAL     :', s.file, '- baris acuan tidak ditemukan, pasang manual (lihat CARA-PASANG-SOP.md)'); continue; }
  if (!fs.existsSync(s.file + '.bak')) fs.writeFileSync(s.file + '.bak', isi);
  isi = s.ganti ? isi.replace(s.cari, s.ganti) : isi.replace(s.cari, '$1' + s.tambah);
  fs.writeFileSync(s.file, isi);
  console.log('DIPASANG  :', s.file, '-', s.penanda);
}
