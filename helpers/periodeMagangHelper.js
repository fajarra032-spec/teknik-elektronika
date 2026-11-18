// helpers/periodeMagangHelper.js
// ============================================================================
// PEMISAHAN LOGBOOK ANTAR PERIODE MAGANG (Magang 1 / 2 / 3)
//
// Aturan:
//  1. Periode yang tanggalSelesai-nya sudah lewat dianggap SUDAH BERAKHIR
//     (walau status dokumennya masih 'active' sampai admin menutup/menilai).
//     Periode berakhir tidak lagi menjadi periode default; tetap terarsip.
//  2. Periode default (yang dibuka otomatis) = periode yang sedang berjalan,
//     bukan sekadar urutan kode PDK.
//  3. Rekap/hitungan logbook SELALU per periode, tidak dijumlah antar Magang.
//  4. Bila ada >1 periode memakai PDK yang sama (mis. dimulai ulang), logbook
//     dipisah lewat TANGGAL: tiap periode memegang logbook dari tanggal
//     mulainya sampai sehari sebelum periode berikutnya dimulai. Tanpa
//     migrasi data dan tanpa indeks Firestore baru.
// ============================================================================

const MS_HARI = 86400000;

/** Tanggal hari ini (WITA) format YYYY-MM-DD. */
function hariIniWITA() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().substring(0, 10);
}

function tambahHari(tgl, n) {
  const d = new Date(String(tgl).substring(0, 10) + 'T00:00:00Z');
  return new Date(d.getTime() + n * MS_HARI).toISOString().substring(0, 10);
}

/** Sudah berakhir: status completed/cancelled, atau tanggalSelesai sudah lewat. */
function periodeSudahBerakhir(period, today) {
  if (!period) return false;
  if (period.status === 'completed' || period.status === 'cancelled') return true;
  today = today || hariIniWITA();
  return !!(period.tanggalSelesai && today > String(period.tanggalSelesai).substring(0, 10));
}

/**
 * Pilih periode default dari daftar periode mahasiswa.
 *  0) active/locked, sudah mulai, belum berakhir  (terbaru dulu)
 *  1) active/locked, belum mulai                  (terdekat dulu)
 *  2) selebihnya (sudah berakhir / selesai)        (terbaru dulu)
 * Periode 'cancelled' diabaikan (kecuali semuanya cancelled).
 */
function pilihPeriodeDefault(periods, today) {
  const semua = Array.isArray(periods) ? periods : [];
  if (semua.length === 0) return null;
  today = today || hariIniWITA();
  const kandidat = semua.filter((p) => p.status !== 'cancelled');
  if (kandidat.length === 0) return semua[0];

  const mulai = (p) => String(p.tanggalMulai || '');
  const rank = (p) => {
    if (periodeSudahBerakhir(p, today)) return 2;
    if (p.status !== 'active' && p.status !== 'locked') return 2;
    return mulai(p) && mulai(p) > today ? 1 : 0;
  };
  return kandidat.slice().sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const cmp = ra === 1 ? mulai(a).localeCompare(mulai(b)) : mulai(b).localeCompare(mulai(a));
    return cmp || String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  })[0];
}

/**
 * Rentang tanggal logbook milik satu periode: { awal, akhir } (string atau null).
 * Hanya membatasi bila ada periode lain (tidak dibatalkan) dengan PDK yang sama.
 */
function rentangLogbookPeriode(period, allPeriods) {
  const kosong = { awal: null, akhir: null };
  if (!period || !period.pdkId || !period.tanggalMulai) return kosong;
  const saudara = (allPeriods || [])
    .filter((p) => p.pdkId === period.pdkId && p.status !== 'cancelled' && p.tanggalMulai)
    .sort((a, b) =>
      String(a.tanggalMulai).localeCompare(String(b.tanggalMulai)) ||
      String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  if (saudara.length <= 1) return kosong;
  const idx = saudara.findIndex((p) => p.id === period.id);
  if (idx < 0) return kosong;
  return {
    awal: idx === 0 ? null : String(period.tanggalMulai).substring(0, 10),
    akhir: idx === saudara.length - 1 ? null : tambahHari(saudara[idx + 1].tanggalMulai, -1)
  };
}

/** Tambahkan batas tanggal ke query Firestore (pakai indeks userId+pdkId+tanggal yang sudah ada). */
function terapkanRentang(query, rentang) {
  if (rentang && rentang.awal) query = query.where('tanggal', '>=', rentang.awal);
  if (rentang && rentang.akhir) query = query.where('tanggal', '<=', rentang.akhir);
  return query;
}

/** Apakah tanggal (string/ISO) berada dalam rentang? */
function dalamRentang(tanggal, rentang) {
  if (!rentang) return true;
  const t = String(tanggal || '').substring(0, 10);
  if (rentang.awal && t < rentang.awal) return false;
  if (rentang.akhir && t > rentang.akhir) return false;
  return true;
}

/** Ambil semua periode (selain cancelled) untuk banyak mahasiswa: Map(mahasiswaId -> [periode]). */
async function ambilPeriodePerMahasiswa(db, ids) {
  const peta = new Map();
  const unik = Array.from(new Set(ids || []));
  for (let i = 0; i < unik.length; i += 10) {
    const chunk = unik.slice(i, i + 10);
    const snap = await db.collection('magangPeriod').where('mahasiswaId', 'in', chunk).get();
    snap.docs.forEach((d) => {
      const p = { id: d.id, ...d.data() };
      if (!peta.has(p.mahasiswaId)) peta.set(p.mahasiswaId, []);
      peta.get(p.mahasiswaId).push(p);
    });
  }
  return peta;
}

/**
 * Statistik logbook SATU periode: { total, pending, approved, rejected }.
 * Tanpa rentang: 4 query count() (murah). Dengan rentang (kasus PDK sama
 * dimulai >1 kali): baca status saja lalu hitung di JS (tanpa indeks baru).
 */
async function statistikLogbookPeriode(db, mahasiswaId, period, allPeriods) {
  if (!period) return { total: 0, pending: 0, approved: 0, rejected: 0 };
  const rentang = rentangLogbookPeriode(period, allPeriods);
  const dasar = db.collection('logbookMagang')
    .where('userId', '==', mahasiswaId)
    .where('pdkId', '==', period.pdkId);

  if (rentang.awal || rentang.akhir) {
    const snap = await terapkanRentang(dasar, rentang).select('status').get();
    const hasil = { total: snap.size, pending: 0, approved: 0, rejected: 0 };
    snap.docs.forEach((d) => {
      const s = d.get('status');
      if (hasil[s] !== undefined) hasil[s]++;
    });
    return hasil;
  }

  const hitung = async (q) => {
    try { return (await q.count().get()).data().count; }
    catch (e) { return (await q.get()).size; }
  };
  const [total, pending, approved, rejected] = await Promise.all([
    hitung(dasar),
    hitung(dasar.where('status', '==', 'pending')),
    hitung(dasar.where('status', '==', 'approved')),
    hitung(dasar.where('status', '==', 'rejected'))
  ]);
  return { total, pending, approved, rejected };
}

/**
 * Periode yang memegang sebuah TANGGAL (untuk foto/entri lama): periode dengan
 * tanggalMulai terakhir yang <= tanggal; bila tanggal sebelum semuanya, yang paling awal.
 */
function pilihPeriodeUntukTanggal(periods, tanggal) {
  const daftar = (periods || [])
    .filter((p) => p.status !== 'cancelled' && p.tanggalMulai)
    .sort((a, b) => String(a.tanggalMulai).localeCompare(String(b.tanggalMulai)));
  if (daftar.length === 0) return (periods || []).find((p) => p.status !== 'cancelled') || null;
  const t = String(tanggal || '').substring(0, 10);
  let hasil = daftar[0];
  daftar.forEach((p) => { if (t && String(p.tanggalMulai).substring(0, 10) <= t) hasil = p; });
  return hasil;
}

/** Jumlah logbook 'approved' milik SATU periode (1 count() bila tanpa rentang). */
async function hitungApprovedPeriode(db, mahasiswaId, period, allPeriods) {
  if (!period) return 0;
  const rentang = rentangLogbookPeriode(period, allPeriods);
  const dasar = db.collection('logbookMagang')
    .where('userId', '==', mahasiswaId)
    .where('pdkId', '==', period.pdkId);
  if (rentang.awal || rentang.akhir) {
    const snap = await terapkanRentang(dasar, rentang).select('status').get();
    return snap.docs.filter((d) => d.get('status') === 'approved').length;
  }
  const q = dasar.where('status', '==', 'approved');
  try { return (await q.count().get()).data().count; }
  catch (e) { return (await q.get()).size; }
}

const FORMAT_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const TANPA_BATAS = '9999-12-31';

/**
 * Validasi sebelum memulai periode magang baru. Mengembalikan teks galat (string)
 * atau null bila lolos. Dipakai bersama oleh rute admin dan dosen.
 *  1. Format tanggal valid, tanggal selesai tidak lebih awal dari tanggal mulai.
 *  2. Tidak tumpang tindih dengan periode lain milik mahasiswa yang sama
 *     (periode dibatalkan diabaikan; periode aktif tanpa tanggal selesai dianggap
 *     masih berjalan).
 *  3. Urutan PDK: Magang N tidak boleh dimulai lebih awal dari Magang N-1.
 *     Bila Magang N-1 tidak ada di sistem (mis. data lama), tidak dihalangi.
 *     Dimatikan dengan env PDK_URUTAN=off.
 * opsi.urutanMap { pdkId: urutan } hanya untuk pengujian.
 */
async function validasiMulaiPeriode(db, data, opsi) {
  const { mahasiswaId, pdkId } = data;
  const mulai = String(data.tanggalMulai || '').substring(0, 10);
  const selesai = data.tanggalSelesai ? String(data.tanggalSelesai).substring(0, 10) : '';

  if (!FORMAT_TANGGAL.test(mulai)) return 'Format tanggal mulai tidak valid.';
  if (selesai && !FORMAT_TANGGAL.test(selesai)) return 'Format tanggal selesai tidak valid.';
  if (selesai && selesai < mulai) return 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.';

  const snap = await db.collection('magangPeriod').where('mahasiswaId', '==', mahasiswaId).get();
  const periode = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status !== 'cancelled');

  const akhirBaru = selesai || TANPA_BATAS;
  for (const q of periode) {
    if (!q.tanggalMulai) continue;
    const awalQ = String(q.tanggalMulai).substring(0, 10);
    let akhirQ = q.tanggalSelesai ? String(q.tanggalSelesai).substring(0, 10) : '';
    if (!akhirQ) akhirQ = q.status === 'completed' ? (String(q.completedAt || awalQ).substring(0, 10)) : TANPA_BATAS;
    // strict (<): periode berikutnya boleh mulai tepat di tanggal selesai periode sebelumnya
    if (mulai < akhirQ && awalQ < akhirBaru) {
      const rentangQ = `${awalQ} s/d ${q.tanggalSelesai ? String(q.tanggalSelesai).substring(0, 10) : 'belum ditentukan'}`;
      return `Tanggal bertabrakan dengan periode ${q.pdkNama || 'magang lain'} (${rentangQ}). Tutup atau ubah periode tersebut terlebih dahulu.`;
    }
  }

  if (String(process.env.PDK_URUTAN || '').toLowerCase() !== 'off') {
    let urutanMap = opsi && opsi.urutanMap;
    if (!urutanMap) urutanMap = await require('./laporanPdkHelper').getUrutanPdkMap();
    const n = urutanMap[pdkId];
    if (Number.isFinite(n) && n > 1) {
      const sebelumnya = periode.filter((p) => urutanMap[p.pdkId] === n - 1 && p.tanggalMulai);
      if (sebelumnya.length > 0) {
        const awalTerakhir = sebelumnya.map((p) => String(p.tanggalMulai).substring(0, 10)).sort().pop();
        if (mulai < awalTerakhir) {
          return `Magang ${n} tidak boleh dimulai lebih awal dari Magang ${n - 1} (dimulai ${awalTerakhir}).`;
        }
      }
    }
  }
  return null;
}

/**
 * Periode berstatus 'active' yang tanggal selesainya sudah lewat (belum ditutup/dinilai).
 * Dibaca dari semua periode active (jumlahnya kecil), disaring di JS: tanpa indeks baru.
 */
async function ambilPeriodeBerakhirBelumDitutup(db, today) {
  today = today || hariIniWITA();
  const snap = await db.collection('magangPeriod')
    .where('status', '==', 'active')
    .select('mahasiswaId', 'pdkNama', 'tanggalSelesai', 'status')
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => periodeSudahBerakhir(p, today))
    .map((p) => ({
      id: p.id, mahasiswaId: p.mahasiswaId, pdkNama: p.pdkNama || '', tanggalSelesai: p.tanggalSelesai,
      hariLewat: Math.round((new Date(today + 'T00:00:00Z') - new Date(String(p.tanggalSelesai).substring(0, 10) + 'T00:00:00Z')) / MS_HARI)
    }))
    .sort((a, b) => b.hariLewat - a.hariLewat);
}

/** Durasi standar magang (bulan). Bisa diubah lewat env DURASI_MAGANG_BULAN. */
const DURASI_MAGANG_BULAN = parseInt(process.env.DURASI_MAGANG_BULAN, 10) > 0
  ? parseInt(process.env.DURASI_MAGANG_BULAN, 10) : 4;

/**
 * Tanggal selesai otomatis = tanggal mulai + N bulan (tanggal yang sama N bulan kemudian).
 * Contoh (4 bulan): 2026-09-01 -> 2027-01-01, 2026-09-15 -> 2027-01-15.
 * Bila tanggal tujuan tidak ada (mis. 31 Okt + 4 bln), dipakai akhir bulan tujuan.
 * Mengembalikan null bila format tanggal mulai tidak valid.
 */
function hitungTanggalSelesaiMagang(tanggalMulai, bulan) {
  bulan = bulan || DURASI_MAGANG_BULAN;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(tanggalMulai || '').substring(0, 10));
  if (!m) return null;
  const y = +m[1], bln = +m[2] - 1, hari = +m[3];
  const total = bln + bulan;
  const ty = y + Math.floor(total / 12), tm = total % 12;
  const hariTerakhir = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const tujuan = new Date(Date.UTC(ty, tm, Math.min(hari, hariTerakhir)));
  return tujuan.toISOString().substring(0, 10);
}

module.exports = {
  DURASI_MAGANG_BULAN,
  hitungTanggalSelesaiMagang,
  validasiMulaiPeriode,
  ambilPeriodeBerakhirBelumDitutup,
  pilihPeriodeUntukTanggal,
  hitungApprovedPeriode,
  hariIniWITA,
  periodeSudahBerakhir,
  pilihPeriodeDefault,
  rentangLogbookPeriode,
  terapkanRentang,
  dalamRentang,
  ambilPeriodePerMahasiswa,
  statistikLogbookPeriode
};
