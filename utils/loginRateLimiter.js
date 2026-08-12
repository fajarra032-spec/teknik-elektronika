// ==================== PROTEKSI BRUTE-FORCE DI HALAMAN LOGIN ====================
// Sengaja dibuat sendiri (bukan pakai library seperti express-rate-limit) supaya
// tidak menambah dependency di board Armbian yang RAM-nya terbatas — logikanya
// simpel dan cukup untuk skala sekolah kecil-menengah.
//
// Cara kerja: hitung percobaan GAGAL per alamat IP. Kalau sudah 5x gagal dalam
// 15 menit terakhir, IP itu diblokir sementara (15 menit) dari mencoba login lagi.
// Percobaan yang BERHASIL akan mereset hitungannya.
//
// Catatan: disimpan di memori (bukan database), jadi otomatis reset kalau server
// di-restart — itu perilaku yang wajar & aman untuk kebutuhan ini.
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const BLOCK_MS = 15 * 60 * 1000;  // 15 menit

const attempts = new Map(); // ip -> { count, firstAttemptAt, blockedUntil }

// Bersihkan entri lama secara berkala supaya Map ini tidak membesar terus-menerus
// selama server hidup lama (tiap 30 menit, buang entri yang sudah tidak relevan).
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attempts.entries()) {
    const expired = (!rec.blockedUntil || rec.blockedUntil < now) && (now - rec.firstAttemptAt > WINDOW_MS);
    if (expired) attempts.delete(ip);
  }
}, 30 * 60 * 1000).unref();

function getClientIp(req) {
  // Kalau di belakang reverse proxy (mis. cloudflared/nginx), pakai header
  // x-forwarded-for kalau ada; kalau tidak, pakai req.ip biasa.
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Middleware: taruh SEBELUM handler POST /login. Kalau IP sedang diblokir,
 * langsung redirect balik ke /login dengan pesan jelas (tidak sampai proses
 * cek password sama sekali).
 */
function loginRateLimiter(req, res, next) {
  const ip = getClientIp(req);
  const rec = attempts.get(ip);
  const now = Date.now();

  if (rec && rec.blockedUntil && rec.blockedUntil > now) {
    const minutesLeft = Math.ceil((rec.blockedUntil - now) / 60000);
    return res.redirect('/login?error=' + encodeURIComponent(
      `Terlalu banyak percobaan login gagal. Coba lagi dalam ${minutesLeft} menit.`
    ));
  }
  next();
}

/** Dipanggil setelah tahu hasil login (berhasil/gagal) untuk update hitungan. */
function recordLoginResult(req, success) {
  const ip = getClientIp(req);
  const now = Date.now();

  if (success) {
    attempts.delete(ip); // reset — percobaan berhasil menghapus riwayat gagal sebelumnya
    return;
  }

  const rec = attempts.get(ip);
  if (!rec || now - rec.firstAttemptAt > WINDOW_MS) {
    // Mulai hitungan baru (belum pernah gagal, atau jendela waktu sebelumnya sudah lewat)
    attempts.set(ip, { count: 1, firstAttemptAt: now, blockedUntil: null });
    return;
  }

  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.blockedUntil = now + BLOCK_MS;
  }
  attempts.set(ip, rec);
}

module.exports = { loginRateLimiter, recordLoginResult };
