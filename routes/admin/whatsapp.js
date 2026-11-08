// routes/admin/whatsapp.js
// WhatsApp Center: proxy aman ke Elektronika Notification API.
// Router ini dipasang di bawah /admin; autentikasi admin diwarisi dari
// routes/admin/index.js (verifyToken + isAdmin).
//
// Versi 2: + audit log (koleksi Firestore 'wa_logs'), pencegah kirim ganda,
// pembatasan frekuensi per admin, halaman riwayat pengiriman.

const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebaseAdmin');
const waNotifier = require('../../helpers/waNotifier');
const kuliahReminder = require('../../helpers/kuliahReminderHelper');

const API_BASE = (process.env.NOTIFICATION_API_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.NOTIFICATION_INTERNAL_KEY || '';
const LOG_COLLECTION = 'wa_logs';
const AUTO_COLLECTION = 'wa_auto_logs';

// ---- Pembatasan frekuensi & pencegah kirim ganda (in-memory, per proses) ----
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;            // maks. 20 pesan / menit / admin
const DUP_WINDOW_MS = 15 * 1000; // pesan identik ke nomor sama dalam 15 dtk dianggap ganda
const sendTimes = new Map();    // adminId -> [timestamp]
const recentSends = new Map();  // `${to}|${text}` -> timestamp

function kenaRateLimit(adminId) {
  const now = Date.now();
  const arr = (sendTimes.get(adminId) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) { sendTimes.set(adminId, arr); return true; }
  arr.push(now);
  sendTimes.set(adminId, arr);
  return false;
}
function pesanGanda(to, text) {
  const now = Date.now();
  for (const [k, t] of recentSends) if (now - t > DUP_WINDOW_MS) recentSends.delete(k);
  const key = `${to}|${text}`;
  if (recentSends.has(key)) return true;
  recentSends.set(key, now);
  return false;
}

// ---- Util ----
function unwrapArray(payload, candidates) {
  if (Array.isArray(payload)) return payload;
  for (const key of candidates) {
    if (Array.isArray(payload && payload[key])) return payload[key];
  }
  if (payload && payload.data) {
    if (Array.isArray(payload.data)) return payload.data;
    for (const key of candidates) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
  }
  return [];
}

async function notificationRequest(endpoint, options = {}) {
  if (!API_BASE || !API_KEY) {
    const error = new Error('Konfigurasi Notification API belum diisi di environment website.');
    error.code = 'NOTIFICATION_CONFIG';
    throw error;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-internal-key': API_KEY,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { message: 'Notification API mengembalikan respons yang tidak valid.' };
  }

  if (!response.ok) {
    const error = new Error(
      response.status === 401
        ? 'Autentikasi ke Notification API ditolak. Periksa konfigurasi API Key.'
        : `Notification API merespons HTTP ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

function safeWaId(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^\d{8,15}$/.test(digits) ? digits : '';
}

function renderError(error) {
  if (error && error.code === 'NOTIFICATION_CONFIG') return error.message;
  if (error && error.status === 401) return error.message;
  return 'Tidak dapat terhubung ke layanan WhatsApp. Periksa koneksi API dan log server.';
}

/** Catat audit log; kegagalan mencatat TIDAK boleh menggagalkan alur utama. */
async function tulisLog(req, { to, text, status, error }) {
  try {
    await db.collection(LOG_COLLECTION).add({
      adminId: (req.user && (req.user.id || req.user.uid)) || null,
      adminNama: (req.user && (req.user.nama || req.user.email)) || 'admin',
      to,
      textPreview: String(text || '').slice(0, 500),
      textLength: String(text || '').length,
      status, // 'terkirim' | 'gagal' | 'ditolak'
      error: error ? String(error).slice(0, 300) : null,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[WhatsApp Center] Gagal menulis audit log:', e.message);
  }
}

// GET /admin/whatsapp
router.get('/', async (req, res) => {
  let conversations = [];
  let messages = [];
  const selectedWaId = safeWaId(req.query.waId);
  let apiError = '';

  try {
    const result = await notificationRequest('/internal/conversations');
    conversations = unwrapArray(result, ['conversations', 'items', 'results']);

    // Kompatibilitas jika API mengembalikan objek berkunci.
    if (!conversations.length && result && result.conversations && !Array.isArray(result.conversations)) {
      conversations = Object.values(result.conversations);
    }

    if (selectedWaId) {
      const messageResult = await notificationRequest(
        `/internal/conversations/${encodeURIComponent(selectedWaId)}/messages`
      );
      messages = unwrapArray(messageResult, ['messages', 'items', 'results']);
    }
  } catch (error) {
    console.error('[WhatsApp Center] Gagal memuat data:', error.message);
    apiError = renderError(error);
  }

  const pesanError = {
    '1': 'Pesan gagal dikirim. Periksa nomor, jendela layanan WhatsApp, template, dan koneksi API.',
    'rate': 'Terlalu banyak pesan dalam waktu singkat. Tunggu sebentar lalu coba lagi.',
    'dup': 'Pesan identik baru saja dikirim ke nomor ini. Diabaikan agar tidak terkirim ganda.'
  };

  res.render('admin/whatsapp/index', {
    title: 'WhatsApp Center',
    user: req.user,
    conversations,
    messages,
    selectedWaId,
    apiError,
    success: req.query.success === '1' ? 'Pesan berhasil dikirim.' : '',
    sendError: pesanError[req.query.error] || ''
  });
});


// ---- Util dashboard ----
const WITA_MS = 8 * 60 * 60 * 1000; // Makassar (UTC+8)
function tglWita(iso) { return new Date(new Date(iso).getTime() + WITA_MS).toISOString().slice(0, 10); }
function keMs(v) {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v);
    return n < 1e12 ? n * 1000 : n; // detik (Meta) atau milidetik
  }
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// GET /admin/whatsapp/dashboard
router.get('/dashboard', async (req, res) => {
  const now = Date.now();
  const HARI = 14;
  const peringatan = [];

  // 1) Status API (/health tidak butuh key)
  const api = { ok: false, ms: null, configured: !!(API_BASE && API_KEY) };
  if (API_BASE) {
    const t0 = Date.now();
    try {
      const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
      api.ok = r.ok;
      api.ms = Date.now() - t0;
    } catch (e) { api.ok = false; }
  }
  if (!api.configured) peringatan.push('NOTIFICATION_API_URL / NOTIFICATION_INTERNAL_KEY belum diisi di .env website.');

  // 2) Percakapan dari Notification API
  let conversations = [];
  let convError = false;
  if (api.configured) {
    try {
      const result = await notificationRequest('/internal/conversations');
      conversations = unwrapArray(result, ['conversations', 'items', 'results']);
      if (!conversations.length && result && result.conversations && !Array.isArray(result.conversations)) {
        conversations = Object.values(result.conversations);
      }
    } catch (e) {
      convError = true;
      console.error('[WhatsApp Center] Dashboard: gagal ambil percakapan:', e.message);
    }
  }
  const aktif24 = conversations.filter(c => {
    const ms = keMs(c.updatedAt || c.lastMessageAt || c.timestamp || c.lastInboundAt);
    return ms && now - ms < 24 * 3600 * 1000;
  }).length;
  const aktif7 = conversations.filter(c => {
    const ms = keMs(c.updatedAt || c.lastMessageAt || c.timestamp || c.lastInboundAt);
    return ms && now - ms < 7 * 24 * 3600 * 1000;
  }).length;
  const unread = conversations.reduce((n, c) => n + (Number(c.unreadCount || c.unread || 0) || 0), 0);
  const adaUnread = conversations.some(c => c.unreadCount !== undefined || c.unread !== undefined);

  // 2b) Percakapan terbaru
  const terbaru = conversations
    .map(c => ({
      phone: String(c.waId || c.phone || c.id || '').replace(/\D/g, ''),
      nama: c.name || c.profileName || '',
      ms: keMs(c.updatedAt || c.lastMessageAt || c.timestamp || c.lastInboundAt),
      preview: (() => {
        const last = c.lastMessage || c.last_message || {};
        return typeof last === 'string' ? last : (last.text || last.message || c.lastText || '');
      })()
    }))
    .filter(c => c.phone)
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6);

  // 3) Statistik pengiriman dari audit log (30 hari)
  let logs = [];
  try {
    const sejak = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const snap = await db.collection(LOG_COLLECTION)
      .where('createdAt', '>=', sejak)
      .orderBy('createdAt', 'desc')
      .limit(2000)
      .get();
    logs = snap.docs.map(d => d.data());
  } catch (e) {
    console.error('[WhatsApp Center] Dashboard: gagal baca wa_logs:', e.message);
    peringatan.push('Riwayat pengiriman (wa_logs) tidak dapat dibaca.');
  }

  const hariIni = tglWita(new Date(now).toISOString());
  const batas7 = now - 7 * 24 * 3600 * 1000;
  const stat = { hariIni: 0, tujuh: 0, tigaPuluh: 0, terkirim30: 0, gagal30: 0, ditolak30: 0 };
  const perAdmin = {};
  const perHari = {};
  for (let i = HARI - 1; i >= 0; i--) {
    perHari[tglWita(new Date(now - i * 24 * 3600 * 1000).toISOString())] = { terkirim: 0, gagal: 0 };
  }
  logs.forEach(l => {
    const ms = new Date(l.createdAt).getTime();
    if (l.status === 'terkirim') {
      stat.terkirim30++;
      stat.tigaPuluh++;
      if (ms >= batas7) stat.tujuh++;
      if (tglWita(l.createdAt) === hariIni) stat.hariIni++;
      perAdmin[l.adminNama || 'admin'] = (perAdmin[l.adminNama || 'admin'] || 0) + 1;
    } else if (l.status === 'gagal') stat.gagal30++;
    else stat.ditolak30++;
    const k = tglWita(l.createdAt);
    if (perHari[k]) {
      if (l.status === 'terkirim') perHari[k].terkirim++;
      else if (l.status === 'gagal') perHari[k].gagal++;
    }
  });
  const percobaan = stat.terkirim30 + stat.gagal30;
  const successRate = percobaan ? Math.round((stat.terkirim30 / percobaan) * 100) : null;
  const grafik = Object.entries(perHari).map(([tgl, v]) => ({ tgl, ...v }));
  const adminTop = Object.entries(perAdmin).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const gagalTerbaru = logs.filter(l => l.status === 'gagal').slice(0, 5);

  // 4) Notifikasi otomatis (wa_auto_logs, 30 hari)
  const auto = { cfg: waNotifier.status(), terkirim: 0, gagal: 0, dilewati: 0, simulasi: 0, perRule: [], alasanTop: [], hariIni: 0 };
  try {
    const sejak = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const snap = await db.collection(AUTO_COLLECTION)
      .where('createdAt', '>=', sejak)
      .orderBy('createdAt', 'desc')
      .limit(3000)
      .get();
    const perRule = {}, alasan = {};
    snap.docs.forEach(d => {
      const l = d.data();
      if (auto[l.status] !== undefined) auto[l.status]++;
      if (l.status === 'terkirim') {
        perRule[l.rule] = (perRule[l.rule] || 0) + 1;
        if (tglWita(l.createdAt) === hariIni) auto.hariIni++;
      }
      if (l.status === 'dilewati' && l.alasan) alasan[l.alasan] = (alasan[l.alasan] || 0) + 1;
    });
    const label = Object.fromEntries(auto.cfg.rules.map(r => [r.key, r.label]));
    auto.perRule = Object.entries(perRule).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => ({ label: label[k] || k, n }));
    auto.alasanTop = Object.entries(alasan).sort((a, b) => b[1] - a[1]).slice(0, 4);
  } catch (e) {
    console.error('[WhatsApp Center] Dashboard: gagal baca wa_auto_logs:', e.message);
  }

  res.render('admin/whatsapp/dashboard', {
    title: 'Dashboard WhatsApp',
    user: req.user,
    api, convError, peringatan,
    totalConv: conversations.length, aktif24, aktif7, unread, adaUnread,
    terbaru, stat, successRate, grafik, adminTop, gagalTerbaru, auto,
    maxGrafik: Math.max(1, ...grafik.map(g => g.terkirim + g.gagal))
  });
});

// GET /admin/whatsapp/riwayat  - riwayat pengiriman dari dashboard
router.get('/riwayat', async (req, res) => {
  let logs = [];
  let error = '';
  try {
    const snap = await db.collection(LOG_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[WhatsApp Center] Gagal memuat riwayat:', e.message);
    error = 'Gagal memuat riwayat pengiriman.';
  }
  let autoLogs = [];
  try {
    const snap = await db.collection(AUTO_COLLECTION).orderBy('createdAt', 'desc').limit(100).get();
    autoLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('[WhatsApp Center] Gagal memuat riwayat otomatis:', e.message);
  }
  res.render('admin/whatsapp/riwayat', { title: 'Riwayat WhatsApp', user: req.user, logs, autoLogs, error });
});

// POST /admin/whatsapp/send
router.post('/send', async (req, res) => {
  const to = safeWaId(req.body.to);
  const message = String(req.body.message || '').trim();
  const back = (flag) => `/admin/whatsapp?waId=${encodeURIComponent(to)}&${flag}`;

  if (!to || !message || message.length > 4096) return res.redirect(back('error=1'));

  const adminId = (req.user && (req.user.id || req.user.uid)) || 'admin';
  if (kenaRateLimit(adminId)) {
    await tulisLog(req, { to, text: message, status: 'ditolak', error: 'rate limit' });
    return res.redirect(back('error=rate'));
  }
  if (pesanGanda(to, message)) {
    await tulisLog(req, { to, text: message, status: 'ditolak', error: 'pesan ganda' });
    return res.redirect(back('error=dup'));
  }

  try {
    await notificationRequest('/internal/messages', {
      method: 'POST',
      body: JSON.stringify({ to, text: message })
    });
    await tulisLog(req, { to, text: message, status: 'terkirim' });
    return res.redirect(back('success=1'));
  } catch (error) {
    console.error('[WhatsApp Center] Gagal mengirim pesan:', error.message);
    await tulisLog(req, { to, text: message, status: 'gagal', error: error.message });
    return res.redirect(back('error=1'));
  }
});

module.exports = router;
