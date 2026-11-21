/**
 * scripts/cek-status-magang-angkatan.js
 * ============================================================================
 * PEMERIKSA (HANYA MEMBACA, tidak menulis apa pun): status magang per mahasiswa
 * angkatan 2023 & 2024 - nilai di `grades`, status periode, kelengkapan form
 * penilaian, dan masuk tab mana di Monitoring Magang admin.
 *
 * Menandai ketidaksesuaian:
 *   - NILAI ADA, TANPA PERIODE            : ada nilai di grades, tidak ada periode magang
 *   - NILAI ADA, PERIODE BELUM SELESAI    : ada nilai, periode masih active/locked
 *   - PERIODE SELESAI, NILAI BELUM DI GRADES
 *   - PERIODE AKTIF, TANGGAL SELESAI LEWAT : active tetapi tanggalSelesai sudah lewat
 *   - FORM BELUM LENGKAP                  : periode selesai/ada nilai tetapi form dosen/lapangan kosong
 *
 * Cara pakai:
 *   node scripts/cek-status-magang-angkatan.js                 angkatan 23 & 24, hanya yang bermasalah
 *   node scripts/cek-status-magang-angkatan.js --semua         tampilkan semua mahasiswa
 *   node scripts/cek-status-magang-angkatan.js --angkatan=23   satu angkatan
 *   node scripts/cek-status-magang-angkatan.js --nim=23302013  satu mahasiswa
 */
const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf } = require('../helpers/nilaiHelper');
const { getNilaiDosenEfektif } = require('../helpers/nilaiMagangHelper');

const args = process.argv.slice(2);
const arg = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const SEMUA = args.includes('--semua');
const ANGKATAN = (arg('angkatan') || '23,24').split(',').map((s) => s.trim().replace(/^20/, '')).filter(Boolean);
const NIM = (arg('nim') || '').split(',').map((s) => s.trim()).filter(Boolean);
const tengah = (s, n) => String(s ?? '').slice(0, n).padEnd(n);
const hariIni = new Date(Date.now() + 8 * 3600000).toISOString().substring(0, 10);   // WITA

async function main() {
  const pdk = (await db.collection('mataKuliah').where('isPDK', '==', true).get()).docs
    .map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(a.urutanPDK) - Number(b.urutanPDK));
  const mhs = (await db.collection('users').where('role', '==', 'mahasiswa').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => ANGKATAN.some((a) => String(m.nim || '').startsWith(a)))
    .filter((m) => !NIM.length || NIM.includes(String(m.nim)))
    .filter((m) => !['cuti', 'keluar'].includes(String(m.statusMahasiswa || '').trim().toLowerCase()))
    .sort((a, b) => String(a.nim).localeCompare(String(b.nim)));
  const ids = new Set(mhs.map((m) => m.id));

  const nilai = {};
  for (const p of pdk) {
    const g = await db.collection('grades').where('kodeMk', '==', p.kode).get();
    nilai[p.id] = new Map();
    g.docs.map((d) => d.data()).filter((x) => ids.has(x.userId) && !isNaN(parseFloat(x.nilai)))
      .sort((a, b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')))
      .forEach((x) => nilai[p.id].set(x.userId, parseFloat(x.nilai)));
  }
  const periode = (await db.collection('magangPeriod').get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => ids.has(x.mahasiswaId));
  const nm = (await db.collection('nilaiMagang').get()).docs.map((d) => d.data()).filter((x) => ids.has(x.mahasiswaId));

  const masalah = { total: 0 };
  const hitungMasalah = (k) => { masalah[k] = (masalah[k] || 0) + 1; masalah.total++; };
  const tabCount = { aktif: 0, selesai: 0, krs: 0 };

  for (const m of mhs) {
    const semuaP = periode.filter((x) => x.mahasiswaId === m.id && x.status !== 'cancelled');
    const tab = semuaP.some((p) => p.status === 'active' || p.status === 'locked') ? 'aktif'
      : (semuaP.some((p) => p.status === 'completed') ? 'selesai' : 'krs');
    tabCount[tab]++;

    const baris = []; const isu = [];
    for (const p of pdk) {
      const n = nilai[p.id].get(m.id);
      const pers = semuaP.filter((x) => x.pdkId === p.id).sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')));
      const per = pers[0] || null;
      const f = nm.find((x) => x.mahasiswaId === m.id && x.pdkId === p.id) || null;
      const formOk = !!f && getNilaiDosenEfektif(f).nilai !== null && f.nilaiLapangan !== null && f.nilaiLapangan !== undefined;
      if (n === undefined && !per) continue;                               // PDK ini belum disentuh sama sekali
      baris.push(`M${p.urutanPDK}: nilai ${n !== undefined ? `${nilaiKeHuruf(n).huruf}(${n})` : '-'} | periode ${per ? per.status : '-'}${per && per.tanggalSelesai ? ' s.d. ' + per.tanggalSelesai : ''} | form ${formOk ? 'lengkap' : (f ? 'sebagian' : '-')}`);
      if (pers.length > 1) isu.push(`M${p.urutanPDK}: ${pers.length} periode (cek duplikat)`);
      if (n !== undefined && !per) { isu.push(`M${p.urutanPDK}: NILAI ADA, TANPA PERIODE`); hitungMasalah('nilai tanpa periode'); }
      else if (n !== undefined && per && per.status !== 'completed') { isu.push(`M${p.urutanPDK}: NILAI ADA, PERIODE BELUM SELESAI (${per.status})`); hitungMasalah('nilai, periode belum selesai'); }
      if (n === undefined && per && per.status === 'completed') { isu.push(`M${p.urutanPDK}: PERIODE SELESAI, NILAI BELUM DI GRADES`); hitungMasalah('periode selesai tanpa nilai di grades'); }
      if (per && per.status === 'active' && per.tanggalSelesai && per.tanggalSelesai < hariIni && n === undefined) { isu.push(`M${p.urutanPDK}: PERIODE AKTIF, TANGGAL SELESAI SUDAH LEWAT (${per.tanggalSelesai})`); hitungMasalah('aktif, tanggal selesai lewat'); }
      if ((n !== undefined || (per && per.status === 'completed')) && !formOk) { isu.push(`M${p.urutanPDK}: FORM PENILAIAN BELUM LENGKAP`); hitungMasalah('form belum lengkap'); }
    }
    if (SEMUA || isu.length) {
      console.log(`${m.nim} ${tengah(m.nama, 28)} -> tab admin: ${tab === 'aktif' ? 'Magang Aktif' : tab === 'selesai' ? 'Magang Selesai' : 'Sudah KRS'}`);
      baris.forEach((b) => console.log('     ' + b));
      isu.forEach((s) => console.log('     !! ' + s));
    }
  }

  console.log('\n' + '-'.repeat(90));
  console.log(`Mahasiswa dicek: ${mhs.length} | tab Magang Aktif: ${tabCount.aktif} | Magang Selesai: ${tabCount.selesai} | Sudah KRS: ${tabCount.krs}`);
  console.log(`Temuan: ${masalah.total}` + Object.entries(masalah).filter(([k]) => k !== 'total').map(([k, v]) => ` | ${k}: ${v}`).join(''));
  console.log('Catatan: satu mahasiswa masuk SATU tab (aktif > selesai > KRS). Mahasiswa dengan Magang 1 selesai tetapi Magang 2 aktif tampil di "Magang Aktif".');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
