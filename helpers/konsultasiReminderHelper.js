// helpers/konsultasiReminderHelper.js
// ============================================================================
// PENGINGAT KONSULTASI LOGBOOK MINGGUAN (mahasiswa)
//
// Dipicu bila logbook satu minggu sudah TERPENUHI tetapi belum dikonsultasikan /
// disetujui Dosen PA. Muncul sebagai: banner, notifikasi lonceng, dan baris
// "Perlu tindakan" di pop up login.
//
// "Terpenuhi" = semua hari kerja (Senin-Jumat) pada minggu itu, di dalam
// rentang periode magang, sudah punya logbook. Minggu = jendela 7 hari dihitung
// dari tanggalMulai periode (sama dengan status konsultasi di halaman Magang).
// Ubah ambang: env KONSULTASI_MIN_HARI (mis. 4 = cukup 4 hari terisi). Kosong = semua hari kerja.
//
// Hemat kuota Firestore: hasil di-cache 10 menit per mahasiswa, notifikasi lonceng
// memakai ID dokumen deterministik per minggu (tidak dobel).
// ============================================================================

const { TTLCache } = require('./cache');
const { getActiveMagangPeriods } = require('../models/magangPeriodModel');
const { getKonsultasiByPeriod, mingguDisetujui, normalisasiNoWa } = require('./konsultasiLogbookHelper');
const { getPembimbingMahasiswa } = require('./pembimbingHelper');
const { createNotificationOnce } = require('./notificationHelper');

const cacheStatus = new TTLCache(10 * 60 * 1000);
const cacheNotif = new TTLCache(60 * 60 * 1000);
const MAKS_NOTIF = 3;                       // paling banyak 3 minggu terbaru dibuatkan notifikasi lonceng
const MIN_HARI = parseInt(process.env.KONSULTASI_MIN_HARI, 10) || 0;
const LINK = '/mahasiswa/magang';

const DAY = 86400000;
const todayWITA = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
const iso = (ms) => new Date(ms).toISOString().substring(0, 10);
const ms = (tgl) => new Date(tgl + 'T00:00:00Z').getTime();
const tglPendek = (tgl) => new Date(tgl + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });

async function hitung(db, user) {
  const kosong = { perlu: false, tanggal: todayWITA(), periodId: '', daftar: [], link: LINK, waLink: '' };
  const periods = await getActiveMagangPeriods(user.id);
  const period = periods[0];
  if (!period || !period.tanggalMulai) return kosong;

  const hariIni = todayWITA();
  const mulai = ms(period.tanggalMulai);
  const selesai = period.tanggalSelesai ? ms(period.tanggalSelesai) : Infinity;
  const mingguSekarang = Math.floor((ms(hariIni) - mulai) / (7 * DAY)) + 1;
  if (mingguSekarang < 1) return kosong;

  const [snap, konsMap] = await Promise.all([
    db.collection('logbookMagang').where('userId', '==', user.id).where('pdkId', '==', period.pdkId).get(),
    getKonsultasiByPeriod(period.id)
  ]);
  const logs = snap.docs.map((d) => d.data()).filter((x) => {
    const t = String(x.tanggal || '').substring(0, 10);
    return t >= period.tanggalMulai && (!period.tanggalSelesai || t <= period.tanggalSelesai);
  });
  const perTanggal = new Map();               // tanggal -> [entri]
  logs.forEach((x) => {
    const t = String(x.tanggal).substring(0, 10);
    if (!perTanggal.has(t)) perTanggal.set(t, []);
    perTanggal.get(t).push(x);
  });

  const daftar = [];
  for (let n = mingguSekarang; n >= 1; n--) {
    const awal = mulai + (n - 1) * 7 * DAY;
    const hariKerja = [];
    for (let i = 0; i < 7; i++) {
      const t = awal + i * DAY;
      const dow = new Date(t).getUTCDay();
      if (dow >= 1 && dow <= 5 && t >= mulai && t <= selesai) hariKerja.push(iso(t));
    }
    if (!hariKerja.length) continue;

    const terisi = hariKerja.filter((t) => perTanggal.has(t));
    const target = MIN_HARI > 0 ? Math.min(MIN_HARI, hariKerja.length) : hariKerja.length;
    if (terisi.length < target) continue;     // logbook minggu ini belum terpenuhi

    const entries = [].concat(...terisi.map((t) => perTanggal.get(t)));
    if (mingguDisetujui(konsMap[n] || null, entries)) continue;   // sudah dikonsultasikan
    daftar.push({ mingguKe: n, awal: iso(awal), akhir: iso(awal + 6 * DAY), jumlahHari: terisi.length });
  }

  if (!daftar.length) return { ...kosong, periodId: period.id };

  let waLink = '';
  try {
    const pembimbing = await getPembimbingMahasiswa(user.dosenPaId ? user : user.id);
    const no = pembimbing && pembimbing.kontak ? normalisasiNoWa(pembimbing.kontak) : '';
    if (no) {
      const teks = `Assalamualaikum Bapak/Ibu, saya ${user.nama || ''} ingin konsultasi logbook magang minggu ke-${daftar[daftar.length - 1].mingguKe}.`;
      waLink = `https://wa.me/${no}?text=${encodeURIComponent(teks)}`;
    }
  } catch (e) { /* tombol WA opsional */ }

  return { perlu: true, tanggal: hariIni, periodId: period.id, daftar, link: LINK, waLink };
}

/** Ringkasan untuk banner & pop up login (res.locals.navMhsKonsultasi). */
async function cekKonsultasiMingguan(db, user) {
  if (!user || user.role !== 'mahasiswa' || !user.id) return { perlu: false };
  const cached = cacheStatus.get(user.id);
  if (cached && cached.tanggal === todayWITA()) return cached;
  const hasil = await hitung(db, user);
  cacheStatus.set(user.id, hasil);
  return hasil;
}

/** Notifikasi lonceng: satu per minggu yang terpenuhi tapi belum dikonsultasikan. */
async function cekPengingatKonsultasi(db, user) {
  if (!user || user.role !== 'mahasiswa' || !user.id) return;
  const kunci = `${user.id}_${todayWITA()}`;
  if (cacheNotif.get(kunci)) return;
  const s = await cekKonsultasiMingguan(db, user);
  if (!s.perlu) return;                       // tidak di-cache: dicek lagi nanti
  for (const m of s.daftar.slice(0, MAKS_NOTIF)) {
    await createNotificationOnce(db, user.id, `konsultasi-mingguan-${user.id}-${s.periodId}-${m.mingguKe}`, {
      type: 'konsultasi-mingguan',
      title: `Logbook minggu ke-${m.mingguKe} sudah lengkap, saatnya konsultasi 💬`,
      message: `Logbook ${tglPendek(m.awal)} – ${tglPendek(m.akhir)} sudah terisi lengkap. Yuk konsultasikan ke Dosen PA via WhatsApp supaya lembar mingguanmu disetujui.`,
      link: s.link
    });
  }
  cacheNotif.set(kunci, true);
}

/** Panggil saat dosen menyetujui/mencabut minggu: banner segar & lonceng ditandai dibaca. */
function konsultasiBerubah(db, mahasiswaId, periodId, mingguKe, tandaiDibaca) {
  cacheStatus.delete(mahasiswaId);
  cacheNotif.delete(`${mahasiswaId}_${todayWITA()}`);
  if (tandaiDibaca) {
    db.collection('notifications').doc(`konsultasi-mingguan-${mahasiswaId}-${periodId}-${mingguKe}`)
      .update({ read: true }).catch(() => {});
  }
}

module.exports = { cekKonsultasiMingguan, cekPengingatKonsultasi, konsultasiBerubah };
