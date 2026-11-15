/**
 * scripts/sinkron-nilai-magang-dari-grades.js
 *
 * Menyinkronkan NILAI MAGANG yang sudah diinput langsung admin sebagai nilai
 * akhir (menu Input Nilai -> koleksi `grades`) ke dua komponen e-Magang:
 * Nilai Dosen Pembimbing (PA) dan Nilai Pendamping Lapangan (koleksi `nilaiMagang`).
 *
 * Aturan:
 *  - Kedua komponen KOSONG   -> keduanya diisi = nilai akhir (mis. 90 -> PA 90, Lapangan 90).
 *  - Salah satu sudah ada    -> yang sudah ada TIDAK diubah; yang kosong diisi supaya
 *                               rata-rata 50:50 = nilai akhir (hasil dibatasi 0-100).
 *  - Keduanya sudah ada      -> dilewati.
 *  - Semua indikator form diisi dengan angka yang sama, sehingga rata-ratanya persis nilai tsb.
 *  - Nilai di `grades` TIDAK diubah sama sekali.
 *
 * Cara pakai (dari folder proyek):
 *   node scripts/sinkron-nilai-magang-dari-grades.js 24                      -> DRY-RUN angkatan 24
 *   node scripts/sinkron-nilai-magang-dari-grades.js 24 --apply              -> tulis ke Firestore
 *   node scripts/sinkron-nilai-magang-dari-grades.js 24 --apply --tandai-selesai
 *        -> sekaligus menandai periode magang terkait 'completed' (supaya lolos
 *           syarat Penyelesaian Studi & tidak perlu "Kunci Nilai" lagi)
 *   Opsi lain: --semua (ikut mahasiswa Cuti/Keluar)
 * Aman dijalankan ulang.
 */
const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf } = require('../helpers/nilaiHelper');
const {
  getNilaiDosenEfektif, savePenilaianDosen, savePenilaianPendampingLapangan,
  ITEM_NILAI_DOSEN, ITEM_PENDAMPING_LAPANGAN
} = require('../helpers/nilaiMagangHelper');
const { updatePeriodStatus, setNilaiMagang } = require('../models/magangPeriodModel');

const args = process.argv.slice(2);
const prefix = args.find((a) => /^\d{2}$/.test(a)) || '24';
const APPLY = args.includes('--apply');
const SEMUA = args.includes('--semua');
const TANDAI_SELESAI = args.includes('--tandai-selesai');
const OLEH = 'sinkron-nilai-akhir';

const bulat2 = (n) => Math.round(n * 100) / 100;
const adaNilai = (v) => v !== null && v !== undefined && !isNaN(Number(v));
const semuaItem = (daftar, v) => Object.fromEntries(daftar.map((it) => [it.key, v]));

async function main() {
  console.log('='.repeat(100));
  console.log(`SINKRON NILAI MAGANG (grades -> Dosen PA & Pendamping Lapangan) - ANGKATAN 20${prefix} - ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(100));

  const pdk = (await db.collection('mataKuliah').where('isPDK', '==', true).get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(a.urutanPDK) - Number(b.urutanPDK));
  if (!pdk.length) { console.log('Tidak ada mata kuliah PDK.'); process.exit(0); }

  let mhs = (await db.collection('users').where('role', '==', 'mahasiswa').get()).docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => String(m.nim || '').startsWith(prefix))
    .sort((a, b) => String(a.nim).localeCompare(String(b.nim)));
  if (!SEMUA) mhs = mhs.filter((m) => !['cuti', 'keluar'].includes(String(m.statusMahasiswa || '').trim().toLowerCase()));
  console.log(`Mahasiswa dicek: ${mhs.length}\n`);

  // nilai akhir terbaru per (user, kodeMk)
  const nilaiAkhir = {};
  for (const p of pdk) {
    const snap = await db.collection('grades').where('kodeMk', '==', p.kode).get();
    snap.docs.forEach((d) => {
      const g = d.data();
      if (!adaNilai(g.nilai)) return;
      const k = `${g.userId}|${p.id}`;
      const t = String(g.updatedAt || g.createdAt || '');
      if (!nilaiAkhir[k] || t > nilaiAkhir[k].t) nilaiAkhir[k] = { nilai: Number(g.nilai), t };
    });
  }
  const nmAll = (await db.collection('nilaiMagang').get()).docs.map((d) => d.data());
  const periodeAll = (await db.collection('magangPeriod').get()).docs.map((d) => ({ id: d.id, ...d.data() }));

  const rekap = { isiKeduanya: 0, isiSatu: 0, lengkap: 0, tanpaNilai: 0, periodeDitandai: 0, tanpaPeriode: 0, dibatasi: 0 };

  for (const m of mhs) {
    for (const p of pdk) {
      const g = nilaiAkhir[`${m.id}|${p.id}`];
      if (!g) { rekap.tanpaNilai++; continue; }
      const G = g.nilai;

      const nm = nmAll.find((x) => x.mahasiswaId === m.id && x.pdkId === p.id) || null;
      const dosenAda = nm ? getNilaiDosenEfektif({ ...nm }).nilai : null;
      const lapAda = nm && adaNilai(nm.nilaiLapangan) ? Number(nm.nilaiLapangan) : null;
      const period = periodeAll
        .filter((x) => x.mahasiswaId === m.id && x.pdkId === p.id && x.status !== 'cancelled')
        .sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')))[0] || null;

      let dosenBaru = null, lapBaru = null, catatanClamp = '';
      if (dosenAda === null && lapAda === null) { dosenBaru = G; lapBaru = G; }
      else if (dosenAda === null) { dosenBaru = bulat2(2 * G - lapAda); }
      else if (lapAda === null) { lapBaru = bulat2(2 * G - dosenAda); }

      const batas = (v) => Math.min(100, Math.max(0, v));
      if (dosenBaru !== null && batas(dosenBaru) !== dosenBaru) { dosenBaru = batas(dosenBaru); catatanClamp = ' (dibatasi 0-100, rata-rata tidak persis sama)'; rekap.dibatasi++; }
      if (lapBaru !== null && batas(lapBaru) !== lapBaru) { lapBaru = batas(lapBaru); catatanClamp = ' (dibatasi 0-100, rata-rata tidak persis sama)'; rekap.dibatasi++; }

      const perluPeriode = TANDAI_SELESAI && period && period.status !== 'completed';
      if (dosenBaru === null && lapBaru === null && !perluPeriode) { rekap.lengkap++; continue; }

      const ket = [];
      if (dosenBaru !== null) ket.push(`PA ${dosenAda ?? '-'} -> ${dosenBaru}`);
      if (lapBaru !== null) ket.push(`Lapangan ${lapAda ?? '-'} -> ${lapBaru}`);
      if (perluPeriode) ket.push(`periode ${period.status} -> completed`);
      if (TANDAI_SELESAI && !period) { ket.push('(tidak ada periode untuk ditandai)'); rekap.tanpaPeriode++; }
      console.log(`${m.nim} ${String(m.nama || '').slice(0, 26).padEnd(26)} Magang ${p.urutanPDK} nilai akhir ${G} (${nilaiKeHuruf(G).huruf}): ${ket.join(' | ')}${catatanClamp}`);

      if (dosenBaru !== null && lapBaru !== null) rekap.isiKeduanya++;
      else if (dosenBaru !== null || lapBaru !== null) rekap.isiSatu++;
      if (perluPeriode) rekap.periodeDitandai++;

      if (APPLY) {
        const cat = `Disinkronkan otomatis dari nilai akhir ${G} (input admin di Input Nilai).`;
        if (dosenBaru !== null) await savePenilaianDosen(m.id, p.id, semuaItem(ITEM_NILAI_DOSEN, dosenBaru), OLEH, cat);
        if (lapBaru !== null) await savePenilaianPendampingLapangan(m.id, p.id, semuaItem(ITEM_PENDAMPING_LAPANGAN, lapBaru), OLEH, cat);
        if (perluPeriode) {
          await setNilaiMagang(period.id, G, 'Disinkronkan dari nilai akhir (Input Nilai admin)', OLEH, { nilaiDosen: dosenBaru ?? dosenAda, nilaiLapangan: lapBaru ?? lapAda });
          await updatePeriodStatus(period.id, 'completed', 'Ditandai selesai oleh sinkron nilai akhir (grades)', OLEH);
        }
      }
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`REKAP: kedua komponen diisi: ${rekap.isiKeduanya} | satu komponen diisi: ${rekap.isiSatu} | sudah lengkap: ${rekap.lengkap} | belum ada nilai akhir (dilewati): ${rekap.tanpaNilai}`);
  if (TANDAI_SELESAI) console.log(`Periode ditandai selesai: ${rekap.periodeDitandai} | tanpa periode: ${rekap.tanpaPeriode}`);
  if (rekap.dibatasi) console.log(`Dibatasi 0-100: ${rekap.dibatasi} (periksa manual)`);
  if (!APPLY) console.log('\nINI DRY-RUN - belum ada yang ditulis. Tambahkan --apply untuk menerapkan.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
