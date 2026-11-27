/**
 * wa-gateway/server.js
 * Gateway WhatsApp ala "WhatsApp Web" (Baileys): scan QR SEKALI, sesi tersimpan di folder data/auth.
 * API-nya meniru Elektronika Notification API sehingga website TIDAK perlu diubah:
 *   POST /internal/messages                       { to, text }  atau  { to, template:{name,params} }
 *   GET  /internal/conversations
 *   GET  /internal/conversations/:waId/messages
 *   GET  /internal/status
 *   POST /internal/logout
 *   GET  /qr?key=<INTERNAL_KEY>                   halaman scan QR
 * Semua endpoint /internal/* wajib header  x-internal-key: <INTERNAL_KEY>.
 *
 * PERINGATAN: ini memakai protokol WhatsApp Web (tidak resmi). Pakai nomor cadangan, jangan kirim
 * massal agresif. Gateway sudah memberi jeda acak antar pesan & batas harian untuk menekan risiko blokir.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode');
const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys.makeWASocket;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
const { TEMPLATES } = require('./templates');

const PORT = Number(process.env.PORT || 3100);
const INTERNAL_KEY = process.env.INTERNAL_KEY || '';
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const AUTH_DIR = path.join(DATA_DIR, 'auth');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const JEDA_MIN = Number(process.env.GW_JEDA_MIN_MS || 2000);
const JEDA_MAX = Number(process.env.GW_JEDA_MAX_MS || 6000);
const MAKS_PER_HARI = Number(process.env.GW_MAX_PER_DAY || 800);
const MAKS_RIWAYAT = 200;
const log = pino({ level: process.env.LOG_LEVEL || 'info' });

if (!INTERNAL_KEY || INTERNAL_KEY.length < 16) {
  console.error('INTERNAL_KEY wajib diisi (minimal 16 karakter) - samakan dengan NOTIFICATION_INTERNAL_KEY di website.');
  process.exit(1);
}
fs.mkdirSync(AUTH_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Penyimpanan percakapan sederhana (JSON, ditulis tertunda)
// ---------------------------------------------------------------------------
let store = { conversations: {} }; // waId -> { waId, name, updatedAt, lastMessage:{text}, messages:[] }
try { store = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')); } catch (_) { /* baru */ }
let simpanTimer = null;
function simpanNanti() {
  if (simpanTimer) return;
  simpanTimer = setTimeout(() => {
    simpanTimer = null;
    fs.writeFile(STORE_FILE + '.tmp', JSON.stringify(store), (e) => {
      if (e) return log.error({ err: e.message }, 'gagal menyimpan store');
      fs.rename(STORE_FILE + '.tmp', STORE_FILE, () => {});
    });
  }, 2000);
}
function konv(waId) {
  if (!store.conversations[waId]) store.conversations[waId] = { waId, name: '', updatedAt: '', lastMessage: { text: '' }, messages: [] };
  return store.conversations[waId];
}
function catatPesan(waId, pesan, namaKontak) {
  const c = konv(waId);
  if (namaKontak && !c.name) c.name = namaKontak;
  if (pesan.id && c.messages.some(m => m.id === pesan.id)) return;
  c.messages.push(pesan);
  if (c.messages.length > MAKS_RIWAYAT) c.messages.splice(0, c.messages.length - MAKS_RIWAYAT);
  c.updatedAt = pesan.timestamp;
  c.lastMessage = { text: pesan.text };
  simpanNanti();
}
function ubahStatus(waId, id, status, error) {
  const c = store.conversations[waId];
  const m = c && c.messages.find(x => x.id === id);
  if (!m) return;
  m.status = status;
  if (error) m.error = error;
  simpanNanti();
}

// ---------------------------------------------------------------------------
// Koneksi WhatsApp
// ---------------------------------------------------------------------------
const state = { sock: null, connected: false, qr: '', user: null, mulaiUlang: 0 };

function waIdDari(key) {
  let jid = key.remoteJid || '';
  if (jid.endsWith('@lid') && key.remoteJidAlt) jid = key.remoteJidAlt;
  if (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid')) return ''; // abaikan grup, status, newsletter
  return jid.split('@')[0].split(':')[0].replace(/\D/g, '');
}
function teksDari(message) {
  if (!message) return '';
  const m = message.ephemeralMessage ? message.ephemeralMessage.message : message;
  if (!m) return '';
  return m.conversation
    || (m.extendedTextMessage && m.extendedTextMessage.text)
    || (m.imageMessage && ('[Gambar] ' + (m.imageMessage.caption || '')).trim())
    || (m.videoMessage && ('[Video] ' + (m.videoMessage.caption || '')).trim())
    || (m.documentMessage && ('[Dokumen] ' + (m.documentMessage.fileName || '')).trim())
    || (m.audioMessage && '[Pesan suara]')
    || (m.stickerMessage && '[Stiker]')
    || (m.reactionMessage && '')
    || '[Pesan]';
}
const STATUS_ACK = { 0: 'failed', 1: 'queued', 2: 'sent', 3: 'delivered', 4: 'read', 5: 'read' };

async function mulai() {
  const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try { version = (await fetchLatestBaileysVersion()).version; } catch (_) { /* pakai bawaan */ }
  const sock = makeWASocket({
    version,
    auth,
    logger: pino({ level: 'warn' }),
    browser: ['Prodi Elektronika', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });
  state.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    if (u.qr) {
      state.qr = u.qr;
      log.info('QR baru - buka /qr?key=... atau scan dari terminal');
      try { console.log(await QRCode.toString(u.qr, { type: 'terminal', small: true })); } catch (_) {}
    }
    if (u.connection === 'open') {
      state.connected = true; state.qr = ''; state.mulaiUlang = 0;
      state.user = sock.user || null;
      log.info({ user: state.user && state.user.id }, 'WhatsApp terhubung');
    }
    if (u.connection === 'close') {
      state.connected = false;
      const kode = u.lastDisconnect && u.lastDisconnect.error && u.lastDisconnect.error.output && u.lastDisconnect.error.output.statusCode;
      log.warn({ kode }, 'koneksi terputus');
      if (kode === DisconnectReason.loggedOut) {
        // Logout dari ponsel: hapus sesi agar muncul QR baru
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
        state.user = null;
      }
      state.mulaiUlang = Math.min(state.mulaiUlang + 1, 6);
      setTimeout(() => mulai().catch(e => log.error({ err: e.message }, 'gagal menyambung ulang')), Math.min(3000 * state.mulaiUlang, 30000));
    }
  });

  sock.ev.on('messages.upsert', ({ messages }) => {
    for (const msg of messages || []) {
      try {
        const waId = waIdDari(msg.key || {});
        if (!waId || !msg.message) continue;
        const teks = teksDari(msg.message);
        if (msg.message.reactionMessage) continue;
        const ts = new Date(Number(msg.messageTimestamp || Date.now() / 1000) * 1000).toISOString();
        catatPesan(waId, {
          id: msg.key.id, direction: msg.key.fromMe ? 'outbound' : 'inbound', text: teks, timestamp: ts,
          status: msg.key.fromMe ? 'sent' : undefined
        }, msg.key.fromMe ? '' : (msg.pushName || ''));
      } catch (e) { log.error({ err: e.message }, 'gagal mencatat pesan masuk'); }
    }
  });

  sock.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates || []) {
      if (!key || !key.fromMe || update.status === undefined) continue;
      const waId = waIdDari(key);
      if (waId) ubahStatus(waId, key.id, STATUS_ACK[update.status] || 'sent');
    }
  });
}

// ---------------------------------------------------------------------------
// Antrean kirim (serial + jeda acak + batas harian)
// ---------------------------------------------------------------------------
let rantai = Promise.resolve();
let hitungHari = { tgl: '', n: 0 };
const tidur = (ms) => new Promise(r => setTimeout(r, ms));
function cekKuota() {
  const tgl = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  if (hitungHari.tgl !== tgl) hitungHari = { tgl, n: 0 };
  if (hitungHari.n >= MAKS_PER_HARI) { const e = new Error('Batas harian gateway tercapai (' + MAKS_PER_HARI + ' pesan).'); e.http = 429; throw e; }
  hitungHari.n++;
}
function normalisasiNomor(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^\d{8,15}$/.test(d) ? d : '';
}
function teksDariTemplate(t) {
  const p = Array.isArray(t.params) ? t.params.map(String) : [];
  const def = TEMPLATES[t.name];
  if (!def) return p.slice(1).join('. ') || '-';
  return def.body.replace(/\{\{(\d+)\}\}/g, (_, i) => p[Number(i) - 1] || '');
}

function kirim(waId, teks) {
  const tugas = rantai.then(async () => {
    const sock = state.sock;
    if (!state.connected || !sock) { const e = new Error('WhatsApp belum terhubung. Scan QR di /qr.'); e.http = 503; throw e; }
    cekKuota();
    const jid = waId + '@s.whatsapp.net';
    const cek = await sock.onWhatsApp(jid);
    if (!cek || !cek[0] || !cek[0].exists) { const e = new Error('Nomor ' + waId + ' tidak terdaftar di WhatsApp.'); e.http = 422; throw e; }
    const tujuan = cek[0].jid || jid;
    try {
      await sock.sendPresenceUpdate('composing', tujuan);
      await tidur(Math.min(400 + teks.length * 15, 2500));
      await sock.sendPresenceUpdate('paused', tujuan);
    } catch (_) { /* presence opsional */ }
    const hasil = await sock.sendMessage(tujuan, { text: teks });
    catatPesan(waId, { id: hasil.key.id, direction: 'outbound', text: teks, timestamp: new Date().toISOString(), status: 'sent' });
    await tidur(JEDA_MIN + Math.random() * Math.max(0, JEDA_MAX - JEDA_MIN)); // jeda sebelum pesan berikutnya
    return hasil.key.id;
  });
  rantai = tugas.catch(() => {});
  return tugas;
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));

function samaKunci(a) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(INTERNAL_KEY);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const wajibKunci = (req, res, next) => samaKunci(req.get('x-internal-key')) ? next() : res.status(401).json({ error: 'unauthorized' });

app.get('/qr', async (req, res) => {
  if (!samaKunci(req.query.key)) return res.status(401).send('Kunci salah. Buka /qr?key=INTERNAL_KEY');
  res.set('Cache-Control', 'no-store');
  let isi;
  if (state.connected) isi = `<h2>✅ Terhubung</h2><p>Nomor: <b>${(state.user && state.user.id || '').split(':')[0].split('@')[0]}</b></p>`;
  else if (state.qr) isi = `<h2>Scan dengan WhatsApp</h2><p>WhatsApp &gt; Perangkat tertaut &gt; Tautkan perangkat</p><img alt="QR" src="${await QRCode.toDataURL(state.qr, { width: 320, margin: 2 })}">`;
  else isi = '<h2>Menyiapkan koneksi…</h2>';
  res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="5"><title>WA Gateway</title><body style="font-family:system-ui;text-align:center;padding:2rem">${isi}</body>`);
});

app.use('/internal', wajibKunci);

app.get('/internal/status', (req, res) => res.json({ connected: state.connected, user: state.user && state.user.id, needsQr: !state.connected && !!state.qr, sentToday: hitungHari.n }));

app.get('/internal/conversations', (req, res) => {
  const list = Object.values(store.conversations)
    .map(c => ({ waId: c.waId, name: c.name, updatedAt: c.updatedAt, lastMessage: c.lastMessage }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 300);
  res.json({ conversations: list });
});

app.get('/internal/conversations/:waId/messages', (req, res) => {
  const c = store.conversations[String(req.params.waId).replace(/\D/g, '')];
  if (!c) return res.status(404).json({ error: 'belum ada percakapan' });
  res.json({ messages: c.messages });
});

app.post('/internal/messages', async (req, res) => {
  const waId = normalisasiNomor(req.body && req.body.to);
  if (!waId) return res.status(400).json({ success: false, error: 'nomor tujuan tidak valid' });
  let teks = '';
  if (req.body.template && req.body.template.name) teks = teksDariTemplate(req.body.template);
  else teks = String(req.body.text || '').trim();
  if (!teks || teks.length > 4096) return res.status(400).json({ success: false, error: 'isi pesan kosong atau > 4096 karakter' });

  const proses = kirim(waId, teks);
  const lambat = new Promise(r => setTimeout(() => r('lambat'), 12000));
  try {
    const hasil = await Promise.race([proses, lambat]);
    if (hasil === 'lambat') { proses.catch(e => log.error({ err: e.message, waId }, 'kirim (antrean) gagal')); return res.status(202).json({ success: true, queued: true }); }
    res.json({ success: true, messageId: hasil });
  } catch (e) {
    log.error({ err: e.message, waId }, 'kirim gagal');
    res.status(e.http || 500).json({ success: false, error: e.message });
  }
});

app.post('/internal/logout', async (req, res) => {
  try { if (state.sock) await state.sock.logout(); } catch (_) {}
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => log.info('WA Gateway di port ' + PORT));
mulai().catch(e => { log.error({ err: e.message }, 'gagal start'); process.exit(1); });
process.on('unhandledRejection', (e) => log.error({ err: e && e.message }, 'unhandledRejection'));
