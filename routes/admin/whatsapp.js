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
const { TEMPLATES, bersihkanParam } = require('../../helpers/waTemplates');

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


// ---- Direktori kontak (mahasiswa & dosen) untuk memulai chat manual ----
// Sumber: koleksi 'users' (role mahasiswa/dosen) + koleksi 'dosen'.
// Di-cache 5 menit agar pencarian cepat dan hemat pembacaan Firestore.
const KONTAK_TTL_MS = 45 * 60 * 1000;   // kontak jarang berubah -> cache lama
const KONTAK_REFRESH_MIN_MS = 60 * 1000; // jeda minimal antar muat-ulang paksa
const FIELD_NOMOR = ['noHp', 'noHP', 'nohp', 'whatsapp', 'noWa', 'noWA', 'telepon', 'kontak'];
let kontakCache = { t: 0, list: [] };
let kontakLoading = null; // promise sedang berjalan -> cegah baca ganda bersamaan

function ambilNomor(o) {
  if (!o) return '';
  for (const f of FIELD_NOMOR) {
    if (o[f]) {
      const n = waNotifier.normalisasiNomor(o[f]);
      if (n) return n;
    }
  }
  return '';
}

async function muatKontak(force = false) {
  const umur = Date.now() - kontakCache.t;
  const segar = umur < KONTAK_TTL_MS && kontakCache.list.length;
  // force hanya dihormati bila cache sudah lebih tua dari jeda minimal
  if (segar && (!force || umur < KONTAK_REFRESH_MIN_MS)) return kontakCache.list;
  if (kontakLoading) return kontakLoading;
  kontakLoading = bacaKontakDariFirestore().finally(() => { kontakLoading = null; });
  return kontakLoading;
}

/** Hanya memakai cache yang sudah ada (walau agak lama). Baca Firestore HANYA bila cache belum pernah terisi. */
async function kontakHemat() {
  if (kontakCache.list.length) return kontakCache.list;
  return muatKontak();
}

async function bacaKontakDariFirestore() {

  const [usersSnap, dosenSnap] = await Promise.all([
    db.collection('users').where('role', 'in', ['mahasiswa', 'dosen']).get(),
    db.collection('dosen').get()
  ]);

  const dosenByUser = new Map();
  const dosenDocs = [];
  dosenSnap.docs.forEach(d => {
    const x = d.data();
    dosenDocs.push({ id: d.id, ...x });
    if (x.userId) dosenByUser.set(x.userId, { id: d.id, ...x });
  });

  const list = [];
  const userDosenTerpakai = new Set();

  usersSnap.docs.forEach(d => {
    const u = d.data();
    if (u.role === 'mahasiswa') {
      list.push({ id: d.id, role: 'mahasiswa', nama: u.nama || '', sub: u.nim || '', waId: ambilNomor(u) });
    } else if (u.role === 'dosen') {
      const dd = dosenByUser.get(d.id);
      if (dd) userDosenTerpakai.add(dd.id);
      list.push({
        id: d.id, role: 'dosen',
        nama: u.nama || (dd && dd.nama) || '',
        sub: (dd && dd.nip) || u.nip || '',
        waId: ambilNomor(u) || ambilNomor(dd)
      });
    }
  });
  // Dosen yang hanya ada di koleksi 'dosen' (belum punya akun users)
  dosenDocs.forEach(dd => {
    if (userDosenTerpakai.has(dd.id)) return;
    list.push({ id: 'dosen:' + dd.id, role: 'dosen', nama: dd.nama || '', sub: dd.nip || '', waId: ambilNomor(dd) });
  });

  list.sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  kontakCache = { t: Date.now(), list };
  return list;
}

async function cariKontakByWa(waId) {
  if (!waId) return null;
  const list = await kontakHemat();
  return list.find(k => k.waId === waId) || null;
}

// POST /admin/whatsapp/kontak/refresh - muat ulang daftar kontak (dibatasi 1x/menit)
router.post('/kontak/refresh', async (req, res) => {
  try {
    const umur = Date.now() - kontakCache.t;
    if (kontakCache.list.length && umur < KONTAK_REFRESH_MIN_MS) {
      return res.json({ ok: true, jumlah: kontakCache.list.length, dimuatUlang: false, pesan: 'Daftar kontak masih sangat baru (kurang dari 1 menit).' });
    }
    const list = await muatKontak(true);
    res.json({ ok: true, jumlah: list.length, dimuatUlang: true });
  } catch (e) {
    console.error('[WhatsApp Center] Gagal refresh kontak:', e.message);
    res.status(500).json({ ok: false, error: 'Gagal memuat ulang kontak.' });
  }
});

// GET /admin/whatsapp/kontak?q=nama|nim|nomor&role=mahasiswa|dosen  -> JSON
router.get('/kontak', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const role = ['mahasiswa', 'dosen'].includes(req.query.role) ? req.query.role : '';
    if (q.length < 2) return res.json({ items: [] });
    const qDigit = q.replace(/\D/g, '');
    const list = await muatKontak();
    const items = list
      .filter(k => !role || k.role === role)
      .filter(k =>
        k.nama.toLowerCase().includes(q) ||
        String(k.sub).toLowerCase().includes(q) ||
        (qDigit.length >= 4 && k.waId.includes(qDigit))
      )
      .slice(0, 20)
      .map(k => ({ nama: k.nama, role: k.role, sub: k.sub, waId: k.waId }));
    res.json({ items });
  } catch (e) {
    console.error('[WhatsApp Center] Gagal memuat kontak:', e.message);
    res.status(500).json({ items: [], error: 'Gagal memuat daftar kontak.' });
  }
});

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
      try {
        const messageResult = await notificationRequest(
          `/internal/conversations/${encodeURIComponent(selectedWaId)}/messages`
        );
        messages = unwrapArray(messageResult, ['messages', 'items', 'results']);
      } catch (messageError) {
        if (messageError.status === 404) {
          console.warn('[WhatsApp Center] Riwayat belum tersedia untuk percakapan:', selectedWaId);
          messages = [];
        } else {
          throw messageError;
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp Center] Gagal memuat data:', error.message);
    apiError = renderError(error);
  }

  // Kenali nomor sebagai mahasiswa/dosen (gagal memuat kontak tidak boleh merusak inbox)
  let kontak = null;
  try {
    const daftar = await kontakHemat();
    const peta = new Map(daftar.filter(k => k.waId).map(k => [k.waId, k]));
    conversations.forEach(c => {
      const ph = String(c.waId || c.phone || c.id || '').replace(/\D/g, '');
      const k = peta.get(ph);
      if (k && !(c.name || c.profileName)) c.name = k.nama + (k.role === 'dosen' ? ' (Dosen)' : '');
    });
    if (selectedWaId) kontak = peta.get(selectedWaId) || null;
  } catch (e) {
    console.error('[WhatsApp Center] Gagal mengenali kontak:', e.message);
  }

  const pesanError = {
    'tpl': 'Mode template: judul wajib diisi dan isi pesan maksimal 300 karakter.',
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
    kontak,
    templates: Object.keys(TEMPLATES),
    apiError,
    success: req.query.success === '1' ? 'Pesan berhasil dikirim.' : '',
    sendError: pesanError[req.query.error] || ''
  });
});


// ---- Cache hasil query berat dashboard (per proses) ----
const DASH_TTL_MS = 5 * 60 * 1000;
const dashCache = new Map(); // key -> { t, v, p }
async function dariCache(key, fn, force = false) {
  const c = dashCache.get(key);
  const umur = c ? Date.now() - c.t : Infinity;
  if (c && c.v !== undefined && umur < DASH_TTL_MS && !(force && umur > 30 * 1000)) return c.v;
  if (c && c.p) return c.p; // sedang dimuat oleh permintaan lain
  const p = fn().then(v => { dashCache.set(key, { t: Date.now(), v }); return v; })
                .catch(e => { dashCache.delete(key); throw e; });
  dashCache.set(key, { t: c ? c.t : 0, v: c ? c.v : undefined, p });
  return p;
}

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
    logs = await dariCache('wa_logs30', async () => {
      const sejak = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const snap = await db.collection(LOG_COLLECTION)
        .where('createdAt', '>=', sejak)
        .orderBy('createdAt', 'desc')
        .limit(2000)
        .get();
      return snap.docs.map(d => d.data());
    }, req.query.segar === '1');
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
    const autoRows = await dariCache('wa_auto_logs30', async () => {
      const sejak = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const snap = await db.collection(AUTO_COLLECTION)
        .where('createdAt', '>=', sejak)
        .orderBy('createdAt', 'desc')
        .limit(3000)
        .get();
      return snap.docs.map(d => d.data());
    }, req.query.segar === '1');
    const perRule = {}, alasan = {};
    autoRows.forEach(l => {
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

// GET /admin/whatsapp/otomatis - aturan notifikasi otomatis website -> WhatsApp
router.get('/otomatis', (req, res) => {
  let cfg, kuliah;
  try {
    cfg = waNotifier.status();
  } catch (e) {
    console.error('[WhatsApp Center] Gagal membaca status waNotifier:', e.message);
    cfg = { enabled: false, dryRun: true, mode: 'text', maxPerDay: 0, quiet: '-', antrean: 0, rules: [] };
  }
  try {
    kuliah = kuliahReminder.info();
  } catch (e) {
    console.error('[WhatsApp Center] Gagal membaca info kuliahReminder:', e.message);
    kuliah = { aktif: false, berjalan: false, pagi: '-', sebelumMenit: 0, dosen: false, mahasiswa: false };
  }
  res.render('admin/whatsapp/otomatis', {
    title: 'Notifikasi Otomatis WhatsApp',
    user: req.user,
    cfg,
    kuliah
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
// mode=text (bawaan)  : teks bebas, hanya sukses dalam jendela layanan 24 jam.
// mode=template       : kirim template Meta (judul + isi) untuk memulai percakapan di luar 24 jam.
router.post('/send', async (req, res) => {
  const to = safeWaId(req.body.to);
  const message = String(req.body.message || '').trim();
  const mode = req.body.mode === 'template' ? 'template' : 'text';
  const judul = String(req.body.judul || '').trim();
  const back = (flag) => `/admin/whatsapp?waId=${encodeURIComponent(to)}&${flag}`;

  if (!to || !message || message.length > 4096) return res.redirect(back('error=1'));
  if (mode === 'template' && (!judul || message.length > 300)) return res.redirect(back('error=tpl'));

  const adminId = (req.user && (req.user.id || req.user.uid)) || 'admin';
  const logText = mode === 'template' ? `[template] ${judul} | ${message}` : message;

  if (kenaRateLimit(adminId)) {
    await tulisLog(req, { to, text: logText, status: 'ditolak', error: 'rate limit' });
    return res.redirect(back('error=rate'));
  }
  if (pesanGanda(to, logText)) {
    await tulisLog(req, { to, text: logText, status: 'ditolak', error: 'pesan ganda' });
    return res.redirect(back('error=dup'));
  }

  try {
    let body;
    if (mode === 'template') {
      let k = null;
      try { k = await cariKontakByWa(to); } catch (_) { /* nama opsional */ }
      const tplKey = TEMPLATES[req.body.tpl] ? req.body.tpl : (k && k.role === 'dosen' ? 'info_dosen' : 'info_layanan');
      const nama = (k && k.nama) || (k && k.role === 'dosen' ? 'Bapak/Ibu Dosen' : 'Mahasiswa');
      body = {
        to,
        template: {
          name: tplKey,
          language: TEMPLATES[tplKey].language || 'id',
          params: [bersihkanParam(nama, 60), bersihkanParam(judul, 120), bersihkanParam(message, 300)]
        }
      };
    } else {
      body = { to, text: message };
    }
    await notificationRequest('/internal/messages', { method: 'POST', body: JSON.stringify(body) });
    await tulisLog(req, { to, text: logText, status: 'terkirim' });
    return res.redirect(back('success=1'));
  } catch (error) {
    console.error('[WhatsApp Center] Gagal mengirim pesan:', error.message);
    await tulisLog(req, { to, text: logText, status: 'gagal', error: error.message });
    return res.redirect(back('error=1'));
  }
});

module.exports = router;
