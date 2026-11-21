/**
 * scripts/sinkron-magang-dari-grades.js
 * ============================================================================
 * SINKRONISASI MAGANG (PDK) ANGKATAN 2023 & 2024 DARI NILAI AKHIR YANG SUDAH ADA
 *
 * Untuk mahasiswa yang SUDAH punya nilai akhir PDK (Magang 1/2/3) di koleksi
 * `grades`, skrip ini:
 *   1. MENGISI FORM PENILAIAN (koleksi `nilaiMagang`): seluruh 18 indikator Dosen
 *      Pembimbing dan 10 indikator Pendamping Lapangan diisi angka nilai akhir itu,
 *      sehingga rata-rata kedua komponen = nilai akhir yang sudah ada (huruf sama),
 *      dan logbook ditandai terkunci (prasyarat form dosen).
 *   2. MENYATAKAN MAGANG SELESAI (koleksi `magangPeriod`): status 'completed',
 *      nilai.angka/huruf terisi, riwayat 'completed' ditambahkan.
 *
 * TIDAK mengubah koleksi `grades` (nilai di KHS/Transkrip tetap persis seperti semula).
 *
 * KEAMANAN
 *  - DEFAULT = UJI COBA (dry-run): hanya menampilkan rencana, TIDAK menulis apa pun.
 *    Tambahkan --jalankan untuk benar-benar menulis.
 *  - Sebelum menulis, kondisi lama semua dokumen yang akan diubah disimpan ke
 *    scripts/backup-sinkron-magang-<waktu>.json. Batalkan dengan --rollback=<file>.
 *  - Aman dijalankan berulang: form yang sudah terisi & periode yang sudah selesai dilewati.
 *  - Form yang SUDAH TERISI SEBAGIAN (mis. hanya komponen dosen) dilewati dan dilaporkan,
 *    supaya nilai akhir tidak berubah dari nilai di grades. Pakai --timpa bila memang ingin menimpa.
 *
 * CARA PAKAI (dari root project, di server yang punya akses Firebase)
 *   node scripts/sinkron-magang-dari-grades.js                    uji coba angkatan 23 & 24
 *   node scripts/sinkron-magang-dari-grades.js --jalankan         tulis ke Firestore
 *   node scripts/sinkron-magang-dari-grades.js --angkatan=24      hanya angkatan 24
 *   node scripts/sinkron-magang-dari-grades.js --nim=2330001,2430002   hanya NIM tertentu
 *   node scripts/sinkron-magang-dari-grades.js --buat-periode     buat periode 'selesai' bila mahasiswa
 *                                                                 punya nilai tapi belum punya periode
 *   node scripts/sinkron-magang-dari-grades.js --timpa            timpa form yang sudah terisi
 *   node scripts/sinkron-magang-dari-grades.js --semua            ikut mahasiswa Cuti/Keluar
 *   node scripts/sinkron-magang-dari-grades.js --rollback=scripts/backup-sinkron-magang-XXXX.json
 *
 * Catatan --buat-periode: periode yang dibuat TIDAK punya tanggal mulai/selesai dan nama
 * perusahaan '-' (datanya memang tidak ada). Admin bisa melengkapinya nanti dari halaman
 * detail magang. Periode seperti ini ditandai sumber: 'sinkronisasi-grades'.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf } = require('../helpers/nilaiHelper');
const { ITEM_NILAI_DOSEN, ITEM_PENDAMPING_LAPANGAN } = require('../helpers/nilaiMagangHelper');

const args = process.argv.slice(2);
const arg = (nama) => { const a = args.find((x) => x.startsWith(`--${nama}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const JALANKAN = args.includes('--jalankan');
const TIMPA = args.includes('--timpa');
const BUAT_PERIODE = args.includes('--buat-periode');
const SEMUA = args.includes('--semua');
const ANGKATAN = (arg('angkatan') || '23,24').split(',').map((s) => s.trim().replace(/^20/, '')).filter(Boolean);
const NIM_FILTER = (arg('nim') || '').split(',').map((s) => s.trim()).filter(Boolean);
const ROLLBACK = arg('rollback');
const OLEH = 'sinkronisasi-grades';
const tengah = (s, n) => String(s ?? '').slice(0, n).padEnd(n);

async function commitBertahap(operasi) {
  for (let i = 0; i < operasi.length; i += 400) {
    const batch = db.batch();
    operasi.slice(i, i + 400).forEach((op) => {
      if (op.tipe === 'set') batch.set(op.ref, op.data);
      else if (op.tipe === 'delete') batch.delete(op.ref);
    });
    await batch.commit();
  }
}

// ---------------------------------------------------------------------------
// ROLLBACK
// ---------------------------------------------------------------------------
async function rollback(berkas) {
  const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'));
  console.log(`ROLLBACK dari ${berkas}: ${isi.entri.length} dokumen`);
  const operasi = isi.entri.map((e) => {
    const ref = db.collection(e.koleksi).doc(e.id);
    return e.sebelum === null ? { tipe: 'delete', ref } : { tipe: 'set', ref, data: e.sebelum };
  });
  await commitBertahap(operasi);
  console.log('Selesai. Dokumen yang dibuat skrip dihapus, yang diubah dikembalikan ke kondisi semula.');
}

// ---------------------------------------------------------------------------
// UTAMA
// ---------------------------------------------------------------------------
async function main() {
  if (ROLLBACK) { await rollback(ROLLBACK); return; }

  console.log('='.repeat(100));
  console.log(`SINKRONISASI MAGANG DARI NILAI AKHIR  |  angkatan 20${ANGKATAN.join(', 20')}  |  ${JALANKAN ? 'MODE TULIS (--jalankan)' : 'UJI COBA (tidak menulis)'}`);
  console.log('='.repeat(100));

  const mkSnap = await db.collection('mataKuliah').where('isPDK', '==', true).get();
  const pdk = mkSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => Number(a.urutanPDK) - Number(b.urutanPDK));
  if (!pdk.length) { console.log('Tidak ada mata kuliah PDK (isPDK=true). Berhenti.'); return; }
  console.log('MK PDK: ' + pdk.map((p) => `Magang ${p.urutanPDK}=${p.kode}`).join(' | '));

  const usSnap = await db.collection('users').where('role', '==', 'mahasiswa').get();
  let mhs = usSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => ANGKATAN.some((a) => String(m.nim || '').startsWith(a)))
    .filter((m) => !NIM_FILTER.length || NIM_FILTER.includes(String(m.nim)))
    .sort((a, b) => String(a.nim).localeCompare(String(b.nim)));
  if (!SEMUA) mhs = mhs.filter((m) => !['cuti', 'keluar'].includes(String(m.statusMahasiswa || '').trim().toLowerCase()));
  console.log(`Mahasiswa dicek: ${mhs.length}${SEMUA ? '' : ' (Cuti/Keluar dilewati)'}\n`);
  const idMhs = new Set(mhs.map((m) => m.id));

  // Nilai akhir per PDK (1 query per PDK) - ambil entri terbaru bila ada >1
  const nilaiPdk = {};
  for (const p of pdk) {
    const g = await db.collection('grades').where('kodeMk', '==', p.kode).get();
    const peta = new Map();
    g.docs.map((d) => d.data()).filter((x) => idMhs.has(x.userId) && x.nilai !== undefined && x.nilai !== null && !isNaN(parseFloat(x.nilai)))
      .sort((a, b) => String(a.updatedAt || a.createdAt || '').localeCompare(String(b.updatedAt || b.createdAt || '')))
      .forEach((x) => peta.set(x.userId, parseFloat(x.nilai)));
    nilaiPdk[p.id] = peta;
  }
  const periodeAll = (await db.collection('magangPeriod').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => idMhs.has(x.mahasiswaId));
  const nmAll = (await db.collection('nilaiMagang').get()).docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((x) => idMhs.has(x.mahasiswaId));

  const sekarang = new Date().toISOString();
  const hariIni = sekarang.split('T')[0];
  const operasi = [];                 // penulisan yang akan dilakukan
  const backup = [];                  // kondisi lama untuk rollback
  const ringkas = { diproses: 0, formDiisi: 0, periodeSelesai: 0, periodeDibuat: 0, lewatFormTerisi: 0, lewatSebagian: 0, tanpaPeriode: 0, tanpaNilai: 0 };

  for (const m of mhs) {
    for (const p of pdk) {
      const nilai = nilaiPdk[p.id].get(m.id);
      if (nilai === undefined) { ringkas.tanpaNilai++; continue; }
      const huruf = nilaiKeHuruf(nilai).huruf;
      const label = `${tengah(m.nim, 10)} ${tengah(m.nama, 26)} Magang ${p.urutanPDK}  nilai ${nilai} (${huruf})`;
      const aksi = [];

      const nm = nmAll.find((x) => x.mahasiswaId === m.id && x.pdkId === p.id) || null;
      const per = periodeAll.filter((x) => x.mahasiswaId === m.id && x.pdkId === p.id && x.status !== 'cancelled')
        .sort((a, b) => String(b.tanggalMulai || '').localeCompare(String(a.tanggalMulai || '')))[0] || null;

      // ---- 1. FORM PENILAIAN ----
      const dosenAda = nm && ((nm.nilaiDosen !== null && nm.nilaiDosen !== undefined) ||
        (nm.nilaiLaporan !== null && nm.nilaiLaporan !== undefined && nm.nilaiLogbook !== null && nm.nilaiLogbook !== undefined));
      const lapAda = nm && nm.nilaiLapangan !== null && nm.nilaiLapangan !== undefined;
      let isiForm = true;
      if (dosenAda && lapAda && !TIMPA) { isiForm = false; ringkas.lewatFormTerisi++; aksi.push('form sudah terisi (lewati)'); }
      else if ((dosenAda || lapAda) && !TIMPA) { isiForm = false; ringkas.lewatSebagian++; aksi.push('FORM TERISI SEBAGIAN - dilewati (pakai --timpa jika ingin menimpa)'); }

      if (isiForm) {
        const itemsDosen = {}; ITEM_NILAI_DOSEN.forEach((it) => { itemsDosen[it.key] = nilai; });
        const itemsLap = {}; ITEM_PENDAMPING_LAPANGAN.forEach((it) => { itemsLap[it.key] = nilai; });
        const catatan = `Diisi otomatis dari nilai akhir PDK yang sudah tercatat di sistem (sinkronisasi ${hariIni}).`;
        const ref = nm ? db.collection('nilaiMagang').doc(nm.id) : db.collection('nilaiMagang').doc();
        const { id: _omit, ...nmLama } = nm || {};
        const dataBaru = {
          ...(nm ? nmLama : { mahasiswaId: m.id, pdkId: p.id, createdAt: sekarang }),
          nilaiDosenItems: itemsDosen, nilaiDosen: nilai, nilaiDosenOleh: OLEH, nilaiDosenAt: sekarang, catatanDosen: catatan,
          nilaiLapanganItems: itemsLap, nilaiLapangan: nilai, nilaiLapanganOleh: OLEH, nilaiLapanganAt: sekarang, catatanLapangan: catatan,
          logbookDikunci: true,
          logbookDikunciOleh: (nm && nm.logbookDikunci && nm.logbookDikunciOleh) || OLEH,
          logbookDikunciAt: (nm && nm.logbookDikunci && nm.logbookDikunciAt) || sekarang,
          updatedAt: sekarang
        };
        backup.push({ koleksi: 'nilaiMagang', id: ref.id, sebelum: nm ? nmLama : null });
        operasi.push({ tipe: 'set', ref, data: dataBaru });
        ringkas.formDiisi++;
        aksi.push(nm ? 'form penilaian diperbarui' : 'form penilaian dibuat');
      }

      // ---- 2. PERIODE MAGANG -> SELESAI ----
      const komponen = { nilaiDosen: nilai, nilaiLapangan: nilai };
      if (per && per.status === 'completed' && per.nilai && per.nilai.angka !== null && per.nilai.angka !== undefined) {
        aksi.push('periode sudah selesai (lewati)');
      } else if (per) {
        const ref = db.collection('magangPeriod').doc(per.id);
        const { id: _o, ...perLama } = per;
        const baru = {
          ...perLama,
          status: 'completed',
          tanggalSelesai: per.tanggalSelesai || hariIni,
          completedAt: per.completedAt || sekarang,
          nilai: { ...(per.nilai || {}), angka: nilai, huruf, komentar: 'Disinkronkan dari nilai akhir PDK yang sudah ada', dinilaiOleh: OLEH, dinilaiPada: sekarang, komponenNilai: komponen },
          history: [...(per.history || []), { action: 'completed', tanggal: hariIni, nilai, nilaiHuruf: huruf, catatan: 'Dinyatakan selesai oleh sinkronisasi dari nilai akhir PDK yang sudah tercatat' }],
          updatedAt: sekarang
        };
        backup.push({ koleksi: 'magangPeriod', id: per.id, sebelum: perLama });
        operasi.push({ tipe: 'set', ref, data: baru });
        ringkas.periodeSelesai++;
        aksi.push(`periode ${per.status} -> selesai`);
      } else if (BUAT_PERIODE) {
        const ref = db.collection('magangPeriod').doc();
        const baru = {
          mahasiswaId: m.id, pdkId: p.id, pdkKode: p.kode, pdkNama: p.nama,
          tanggalMulai: null, tanggalSelesai: null, status: 'completed',
          pembimbingId: m.dosenPaId || '', pembimbingNama: m.dosenPaNama || '',
          perusahaan: { nama: '-', alamat: '', kontak: '', kontakHp: '', email: '', website: '', pembimbingLapangan: '', jabatanPembimbingLapangan: '', diisiOleh: OLEH, diisiPada: sekarang },
          nilai: { angka: nilai, huruf, komentar: 'Disinkronkan dari nilai akhir PDK yang sudah ada', dinilaiOleh: OLEH, dinilaiPada: sekarang, komponenNilai: komponen },
          ulasan: { isFilled: false, deskripsiPerusahaan: '', fasilitasMagang: '', saranUntukJunior: '', pengalamanKerja: '', rating: null, diisiPada: null, diisiOleh: null },
          lockHistory: [], createdAt: sekarang, updatedAt: sekarang, completedAt: sekarang,
          sumber: 'sinkronisasi-grades',
          history: [{ action: 'completed', tanggal: hariIni, nilai, nilaiHuruf: huruf, catatan: 'Periode dibuat & dinyatakan selesai oleh sinkronisasi dari nilai akhir PDK yang sudah tercatat (tanpa tanggal)' }]
        };
        backup.push({ koleksi: 'magangPeriod', id: ref.id, sebelum: null });
        operasi.push({ tipe: 'set', ref, data: baru });
        ringkas.periodeDibuat++;
        aksi.push('periode selesai DIBUAT (tanpa tanggal)');
      } else {
        ringkas.tanpaPeriode++;
        aksi.push('BELUM ADA PERIODE (pakai --buat-periode untuk membuatnya)');
      }

      ringkas.diproses++;
      console.log(`${label}\n      -> ${aksi.join(' | ')}`);
    }
  }

  console.log('\n' + '-'.repeat(100));
  console.log(`REKAP: pasangan mahasiswa-PDK bernilai: ${ringkas.diproses} | form diisi/diperbarui: ${ringkas.formDiisi} | periode dinyatakan selesai: ${ringkas.periodeSelesai} | periode dibuat: ${ringkas.periodeDibuat}`);
  console.log(`       dilewati (form sudah terisi): ${ringkas.lewatFormTerisi} | dilewati (form terisi sebagian): ${ringkas.lewatSebagian} | tanpa periode (tidak dibuat): ${ringkas.tanpaPeriode} | (PDK tanpa nilai diabaikan: ${ringkas.tanpaNilai})`);

  if (!JALANKAN) {
    console.log('\nINI UJI COBA - tidak ada yang ditulis. Jalankan ulang dengan --jalankan untuk menerapkan.');
    return;
  }
  if (!operasi.length) { console.log('\nTidak ada yang perlu ditulis.'); return; }

  const berkas = path.join(__dirname, `backup-sinkron-magang-${sekarang.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(berkas, JSON.stringify({ dibuat: sekarang, entri: backup }, null, 2));
  console.log(`\nBackup kondisi lama disimpan: ${berkas}`);
  await commitBertahap(operasi);
  console.log(`SELESAI: ${operasi.length} dokumen ditulis. Untuk membatalkan: node scripts/sinkron-magang-dari-grades.js --rollback=${path.relative(process.cwd(), berkas)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
