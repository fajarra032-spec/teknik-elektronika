/**
 * helpers/peminjamanAlatHelper.js
 *
 * Fungsi bersama untuk modul Peminjaman Alat Lab.
 *
 * Koleksi Firestore:
 *  - alatLab        : inventaris alat (dikelola admin)
 *  - peminjamanAlat : pengajuan peminjaman (dibuat mahasiswa, diverifikasi admin)
 *
 * Alur status peminjamanAlat:
 *   diajukan ──(admin setujui)──▶ dipinjam ──(mhs ajukan kembali)──▶ menunggu_verifikasi_kembali
 *      │                            ▲                                        │
 *      ├─(admin tolak)─▶ ditolak    └──────(admin tolak pengembalian)────────┤
 *      └─(mhs batal)──▶ dibatalkan                                           │
 *                                                (admin verifikasi) ─▶ dikembalikan
 *
 * Catatan: admin juga boleh langsung memverifikasi pengembalian dari status
 * "dipinjam" (mis. mahasiswa lupa menekan tombol kembali, alat sudah di meja admin).
 *
 * Invarian stok per alat:  jumlahTotal = jumlahTersedia + jumlahRusak + (sedang dipinjam)
 */

const { createNotification } = require('./notificationHelper');

const KOLEKSI_ALAT = 'alatLab';
const KOLEKSI_PINJAM = 'peminjamanAlat';

const STATUS = {
  DIAJUKAN: 'diajukan',
  DITOLAK: 'ditolak',
  DIBATALKAN: 'dibatalkan',
  DIPINJAM: 'dipinjam',
  MENUNGGU_KEMBALI: 'menunggu_verifikasi_kembali',
  DIKEMBALIKAN: 'dikembalikan'
};

const STATUS_LABEL = {
  diajukan: 'Menunggu Persetujuan',
  ditolak: 'Ditolak',
  dibatalkan: 'Dibatalkan',
  dipinjam: 'Sedang Dipinjam',
  menunggu_verifikasi_kembali: 'Menunggu Verifikasi Pengembalian',
  dikembalikan: 'Sudah Dikembalikan'
};

const KATEGORI_ALAT = [
  'Alat Ukur', 'Sumber Daya / Power Supply', 'Komponen Elektronik', 'Perkakas',
  'Mikrokontroler / Trainer Kit', 'Komputer / Perangkat', 'Lainnya'
];

/** Tanggal hari ini (YYYY-MM-DD) dalam zona waktu WITA - bukan UTC. */
function hariIni() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
}

function tanggalValid(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str).getTime());
}

/** Selisih hari (b - a) untuk dua string YYYY-MM-DD. */
function selisihHari(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

/** Peminjaman masih berjalan & sudah lewat batas rencana kembali? */
function isTerlambat(p) {
  if (!p) return false;
  if (p.status !== STATUS.DIPINJAM && p.status !== STATUS.MENUNGGU_KEMBALI) return false;
  return !!p.tanggalRencanaKembali && p.tanggalRencanaKembali < hariIni();
}

function generateKodePinjam() {
  const ymd = hariIni().replace(/-/g, '');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `PJM/${ymd}/${rand}`;
}

/** Error yang pesannya aman ditampilkan ke pengguna (validasi / aturan bisnis). */
class AturanError extends Error {
  constructor(message) { super(message); this.name = 'AturanError'; }
}

/** Redirect membawa pesan singkat (ditampilkan sebagai alert di halaman tujuan). */
function redirectPesan(res, url, tipe, pesan) {
  const sep = url.includes('?') ? '&' : '?';
  return res.redirect(`${url}${sep}${tipe}=${encodeURIComponent(pesan)}`);
}

/** Baca pesan flash dari query string, aman untuk dipakai di view. */
function pesanDariQuery(req) {
  const potong = (s) => (typeof s === 'string' ? s.slice(0, 300) : '');
  return { ok: potong(req.query.ok), err: potong(req.query.err) };
}

/** Beritahu semua admin (mis. ada pengajuan baru). Tidak pernah melempar error. */
async function notifikasiAdmin(db, data) {
  try {
    const snap = await db.collection('users').where('role', '==', 'admin').get();
    await Promise.all(snap.docs.map(d => createNotification(db, d.id, data)));
  } catch (err) {
    console.error('Gagal kirim notifikasi ke admin:', err.message);
  }
}

/** Beritahu satu pengguna. Tidak pernah melempar error. */
async function notifikasiUser(db, userId, data) {
  try {
    await createNotification(db, userId, data);
  } catch (err) {
    console.error('Gagal kirim notifikasi:', err.message);
  }
}

function tambahRiwayat(p, status, oleh, catatan) {
  const riwayat = Array.isArray(p.riwayat) ? p.riwayat.slice() : [];
  riwayat.push({
    status,
    oleh: oleh || '-',
    catatan: catatan || '',
    waktu: new Date().toISOString()
  });
  return riwayat;
}

module.exports = {
  KOLEKSI_ALAT, KOLEKSI_PINJAM, STATUS, STATUS_LABEL, KATEGORI_ALAT,
  hariIni, tanggalValid, selisihHari, isTerlambat, generateKodePinjam,
  AturanError, redirectPesan, pesanDariQuery,
  notifikasiAdmin, notifikasiUser, tambahRiwayat
};
