/**
 * scripts/arsipkan-file-lama.js
 *
 * Memindahkan salinan lama di ROOT proyek (landing.js, display.js, magang1.js) ke
 * folder _arsip_lama/ supaya tidak salah edit. File hanya dipindah bila TIDAK ada
 * require() ke file tsb dari file .js lain dan tidak disebut di package.json.
 *
 * DEFAULT DRY-RUN. Perlu --confirm untuk memindahkan.
 *   node scripts/arsipkan-file-lama.js
 *   node scripts/arsipkan-file-lama.js --confirm
 */
const fs = require('fs');
const path = require('path');

const KONFIRMASI = process.argv.includes('--confirm');
const ROOT = path.resolve(__dirname, '..');
const KANDIDAT = ['landing.js', 'display.js', 'magang1.js'];
const ABAIKAN = new Set(['node_modules', '.git', '_arsip_lama']);

function semuaJs(dir, hasil = []) {
  for (const nama of fs.readdirSync(dir)) {
    if (ABAIKAN.has(nama)) continue;
    const p = path.join(dir, nama);
    const st = fs.statSync(p);
    if (st.isDirectory()) semuaJs(p, hasil);
    else if (nama.endsWith('.js')) hasil.push(p);
  }
  return hasil;
}

function dirujuk(targetAbs, daftarFile) {
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const penunjuk = [];
  for (const f of daftarFile) {
    if (f === targetAbs) continue;
    const isi = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(isi))) {
      if (!m[1].startsWith('.')) continue;
      const abs = path.resolve(path.dirname(f), m[1]);
      if (abs === targetAbs || abs === targetAbs.replace(/\.js$/, '')) { penunjuk.push(path.relative(ROOT, f)); break; }
    }
  }
  return penunjuk;
}

console.log(`Mode: ${KONFIRMASI ? '🔴 KONFIRMASI - AKAN MEMINDAHKAN' : '🟡 DRY-RUN'}\n`);
const daftar = semuaJs(ROOT);
let paketJson = '';
try { paketJson = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'); } catch (e) { /* abaikan */ }

for (const nama of KANDIDAT) {
  const abs = path.join(ROOT, nama);
  if (!fs.existsSync(abs)) { console.log(`- ${nama}: tidak ada di root, dilewati`); continue; }
  const penunjuk = dirujuk(abs, daftar);
  if (penunjuk.length || paketJson.includes(nama)) {
    console.log(`⚠️  ${nama}: MASIH DIPAKAI (${penunjuk.join(', ') || 'package.json'}) - tidak dipindah`);
    continue;
  }
  console.log(`📦 ${nama}: tidak dipakai -> ${KONFIRMASI ? 'dipindah ke' : 'akan dipindah ke'} _arsip_lama/`);
  if (KONFIRMASI) {
    fs.mkdirSync(path.join(ROOT, '_arsip_lama'), { recursive: true });
    fs.renameSync(abs, path.join(ROOT, '_arsip_lama', nama));
  }
}
if (!KONFIRMASI) console.log('\nDry-run selesai. Tambahkan --confirm untuk memindahkan.');
