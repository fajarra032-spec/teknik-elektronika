/**
 * helpers/waNotifier.js
 * Meneruskan notifikasi lonceng website ke WhatsApp (lewat Elektronika
 * Notification API). Dipanggil dari helpers/notificationHelper.js SETIAP kali
 * notifikasi lonceng dibuat; tidak ada route lain yang perlu diubah.
 *
 * Prinsip:
 *  - AMAN BAWAAN: mati kecuali WA_AUTO_ENABLED=true. Mode WA_AUTO_DRY_RUN=true
 *    hanya mencatat log "simulasi" tanpa mengirim apa pun.
 *  - Tidak pernah melempar error & tidak pernah menunda halaman (fire-and-forget).
 *  - Antrean berurutan dengan jeda, batas harian per penerima, jam tenang WITA.
 *  - Setiap keputusan (terkirim/gagal/dilewati/simulasi) dicatat di koleksi
 *    Firestore 'wa_auto_logs'.
 *
 * Variabel .env (semua opsional kecuali dua yang pertama):
 *   NOTIFICATION_API_URL, NOTIFICATION_INTERNAL_KEY   (sudah dipakai WhatsApp Center)
 *   WA_AUTO_ENABLED=false        true = aktifkan
 *   WA_AUTO_DRY_RUN=true         true = hanya simulasi/log
 *   WA_SEND_MODE=text            text | template  (template: butuh dukungan di Notification API)
 *   WA_SITE_URL=https://elektronika.polidewa.ac.id
 *   WA_AUTO_MAX_PER_DAY=5        batas pesan otomatis per penerima per hari
 *   WA_AUTO_GAP_MS=1500          jeda antar pengiriman
 *   WA_QUIET_START=21  WA_QUIET_END=6   jam tenang WITA (pesan ditunda sampai selesai)
 *   WA_REQUIRE_OPTIN=false       true = hanya kirim ke users yang waOptIn === true
 *   WA_AUTO_RULES_ON=nilai_tugas,...    aktifkan aturan yang default-nya mati
 *   WA_AUTO_RULES_OFF=alat,...          matikan aturan yang default-nya hidup
 */
const { TEMPLATES, bersihkanParam } = require('./waTemplates');

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const bool = (k, d) => String(env(k, d)).toLowerCase() === 'true';
const num = (k, d) => { const n = Number(env(k, d)); return Number.isFinite(n) ? n : d; };
const list = (k) => String(env(k, '')).split(',').map(s => s.trim()).filter(Boolean);

const LOG_COLLECTION = 'wa_auto_logs';
const WITA_MS = 8 * 3600 * 1000;
const MAX_QUEUE = 1000;
const MAX_DEFERRED = 300;

// ---------------------------------------------------------------------------
// Katalog aturan: jenis notifikasi website -> apakah/ke siapa/template apa.
// Urutan penting: aturan pertama yang cocok dipakai.
// ---------------------------------------------------------------------------
const MHS = ['mahasiswa'];
const DSN = ['dosen'];
const RULES = [
  // Nilai
  { key: 'nilai_akhir',      type: 'nilai', title: /^Nilai akhir/i,                 roles: MHS, template: 'nilai_keluar', on: true,  label: 'Nilai akhir mata kuliah keluar' },
  { key: 'nilai_tugas',      type: 'nilai', title: /(sudah dinilai|diperiksa)/i,    roles: MHS, template: 'nilai_keluar', on: false, label: 'Tugas dinilai / LKM diperiksa' },
  { key: 'nilai_magang',     type: 'nilai-magang',                                 roles: MHS, template: 'nilai_keluar', on: true,  label: 'Nilai magang keluar' },
  // Laporan magang
  { key: 'laporan_komentar', type: 'laporan-magang', title: /komentar/i,            roles: MHS, template: 'info_magang',  on: false, label: 'Komentar baru di laporan magang' },
  { key: 'laporan_review',   type: 'laporan-magang',                               roles: MHS, template: 'info_magang',  on: true,  label: 'Laporan magang di-ACC / perlu revisi' },
  { key: 'laporan_masuk',    type: 'laporan-masuk',                                roles: DSN, template: 'info_dosen',   on: true,  label: 'Mahasiswa mengunggah laporan magang' },
  // Seminar
  { key: 'seminar_diajukan', type: 'seminar-diajukan',                             roles: DSN, template: 'info_dosen',   on: true,  label: 'Mahasiswa mengajukan seminar magang' },
  { key: 'seminar_jadwal',   type: 'seminar',                                      roles: MHS, template: 'info_layanan', on: true,  label: 'Jadwal seminar ditetapkan/diubah, atau pengajuan ditolak' },
  // Logbook
  { key: 'logbook_kosong',   type: 'logbook-hari-ini',                             roles: MHS, template: 'pengingat_logbook', on: true, label: 'Pengingat logbook hari ini kosong' },
  { key: 'logbook_ditolak',  type: 'logbook-ditolak',                              roles: MHS, template: 'info_magang',  on: true,  label: 'Logbook perlu diperbaiki / persetujuan ditarik' },
  { key: 'logbook_disetujui',type: 'logbook-disetujui',                            roles: MHS, template: 'info_magang',  on: false, label: 'Logbook disetujui' },
  { key: 'logbook_kunci',    type: 'logbook-kunci',                                roles: MHS, template: 'info_magang',  on: true,  label: 'Logbook dikunci / kunci dibuka' },
  { key: 'logbook_menunggu', type: 'logbook-menunggu',                             roles: DSN, template: 'info_dosen',   on: true,  label: 'Logbook mahasiswa menunggu persetujuan dosen' },
  // Periode magang
  { key: 'magang_periode',   type: 'magang-periode',                               roles: MHS, template: 'info_magang',  on: true,  label: 'Magang dimulai / dikunci / dibuka / diperpanjang' },
  { key: 'magang_berakhir',  type: 'magang-berakhir',                              roles: ['mahasiswa', 'dosen'], template: 'info_magang', on: true, label: 'Masa magang segera berakhir (H-7/H-3/H-1)' },
  // Dosen
  { key: 'sk_dosen',         type: 'sk',                                           roles: DSN, template: 'info_dosen',   on: true,  label: 'SK Mengajar / SK Pembimbing Akademik terbit' },
  { key: 'tugas_belum_dinilai', type: 'tugas-belum-dinilai',                       roles: DSN, template: 'info_dosen',   on: true,  label: 'Ringkasan tugas belum dinilai' },
  { key: 'jadwal_mengajar',  type: 'jadwal-mengajar',                              roles: DSN, template: 'info_dosen',   on: false, label: 'Pengingat jadwal mengajar hari ini' },
  // Pengingat kuliah (dibuat oleh helpers/kuliahReminderHelper.js)
  { key: 'kuliah_pagi',    type: 'kuliah-pagi',    roles: ['mahasiswa', 'dosen'], template: 'pengingat_kuliah', on: true, bypassKuota: true, label: 'Ringkasan jadwal kuliah/mengajar hari ini (pagi)' },
  { key: 'kuliah_sebelum', type: 'kuliah-sebelum', roles: ['mahasiswa', 'dosen'], template: 'pengingat_kuliah', on: true, bypassKuota: true, label: 'Pengingat N menit sebelum kelas dimulai' },
  // Layanan
  { key: 'alat',             type: 'peminjaman_alat',                              roles: MHS, template: 'info_layanan', on: true,  label: 'Status peminjaman alat lab (ke mahasiswa)' },
  { key: 'pesan',            type: 'pesan',                                        roles: ['mahasiswa', 'dosen'], template: 'info_layanan', on: false, label: 'Pesan baru di chat website' }
];

function ruleAktif(rule) {
  if (list('WA_AUTO_RULES_OFF').includes(rule.key)) return false;
  if (list('WA_AUTO_RULES_ON').includes(rule.key)) return true;
  return rule.on;
}
function cariRule(data) {
  if (!data) return null;
  const title = String(data.title || '');
  return RULES.find(r => r.type === data.type && (!r.title || r.title.test(title))) || null;
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------
/** 08xx / +62 / 0062 / 8xx -> 628xx (hanya digit). Kembalikan '' bila tidak valid. */
function normalisasiNomor(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^62\d{8,13}$/.test(d) ? d : '';
}
const witaNow = () => new Date(Date.now() + WITA_MS);
const tglWita = () => witaNow().toISOString().slice(0, 10);
const jamWita = () => witaNow().getUTCHours();

function msSampaiJamTenangSelesai() {
  const mulai = num('WA_QUIET_START', 21), akhir = num('WA_QUIET_END', 6);
  if (mulai === akhir) return 0;
  const h = jamWita();
  const tenang = mulai > akhir ? (h >= mulai || h < akhir) : (h >= mulai && h < akhir);
  if (!tenang) return 0;
  const w = witaNow();
  const target = new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), akhir, 5, 0));
  if (target <= w) target.setUTCDate(target.getUTCDate() + 1);
  return target - w;
}

function potong(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function tautan(link) {
  if (typeof link !== 'string' || !/^\/(?!\/)/.test(link)) return '';
  return env('WA_SITE_URL', 'https://elektronika.polidewa.ac.id').replace(/\/+$/, '') + link;
}

function susunTeks(data, nama) {
  const url = tautan(data.link);
  return [
    '*Prodi Teknik Elektronika*',
    data.title,
    data.message || '',
    url ? `\nBuka: ${url}` : '',
    '\n_Pesan otomatis dari Sistem Informasi Prodi Teknik Elektronika._'
  ].filter(x => x !== '').join('\n');
}

function susunTemplate(rule, data, nama) {
  const tpl = TEMPLATES[rule.template];
  const url = tautan(data.link);
  const detail = [data.message, url ? `Buka: ${url}` : ''].filter(Boolean).join(' ');
  return {
    name: rule.template,
    language: tpl ? tpl.language : 'id',
    params: [bersihkanParam(nama, 60), bersihkanParam(data.title, 120), bersihkanParam(detail || 'Silakan buka sistem informasi prodi.', 300)]
  };
}

// ---------------------------------------------------------------------------
// Penerima (nomor, role, nama) dengan cache 10 menit
// ---------------------------------------------------------------------------
const penerimaCache = new Map();
const CACHE_MS = 10 * 60 * 1000;
const FIELD_NOMOR = ['noHp', 'noHP', 'nohp', 'whatsapp', 'noWa', 'noWA', 'telepon'];
const ambilNomor = (o) => { for (const f of FIELD_NOMOR) if (o && o[f]) return o[f]; return ''; };

async function cariPenerima(db, userId) {
  const c = penerimaCache.get(userId);
  if (c && Date.now() - c.t < CACHE_MS) return c.v;

  let role = null, nama = '', nomor = '', optOut = false, optIn = false;
  const u = await db.collection('users').doc(userId).get();
  if (u.exists) {
    const d = u.data();
    role = d.role || null; nama = d.nama || ''; nomor = ambilNomor(d);
    optOut = d.waOptOut === true; optIn = d.waOptIn === true;
  }
  if (!nomor || !role || role === 'dosen') {
    const s = await db.collection('dosen').where('userId', '==', userId).limit(1).get();
    if (!s.empty) {
      const d = s.docs[0].data();
      role = role || 'dosen';
      nama = nama || d.nama || '';
      nomor = nomor || ambilNomor(d);
    }
  }
  const v = { role, nama, nomor: normalisasiNomor(nomor), optOut, optIn };
  penerimaCache.set(userId, { t: Date.now(), v });
  return v;
}

// ---------------------------------------------------------------------------
// Pengiriman ke Notification API
// ---------------------------------------------------------------------------
async function panggilApi(body) {
  const base = env('NOTIFICATION_API_URL', '').replace(/\/+$/, '');
  const key = env('NOTIFICATION_INTERNAL_KEY', '');
  if (!base || !key) throw new Error('NOTIFICATION_API_URL / NOTIFICATION_INTERNAL_KEY belum diisi');
  const res = await fetch(`${base}/internal/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) {
    const e = new Error(`Notification API HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
}
async function kirimDenganUlang(body) {
  try { return await panggilApi(body); }
  catch (e) {
    const sementara = !e.status || e.status >= 500;
    if (!sementara) throw e;
    await new Promise(r => setTimeout(r, 3000));
    return panggilApi(body);
  }
}

// ---------------------------------------------------------------------------
// Log
// ---------------------------------------------------------------------------
async function catat(db, job, status, alasan, extra = {}) {
  try {
    await db.collection(LOG_COLLECTION).add({
      userId: job.userId,
      rule: job.rule.key,
      type: job.data.type,
      title: potong(job.data.title, 150),
      to: extra.to || null,
      status, // terkirim | gagal | dilewati | simulasi
      alasan: alasan || null,
      mode: env('WA_SEND_MODE', 'text'),
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[WA-Auto] Gagal menulis log:', e.message);
  }
}

// ---------------------------------------------------------------------------
// Antrean
// ---------------------------------------------------------------------------
const antrean = [];
let berjalan = false;
let tertunda = 0;
const kuotaHarian = new Map(); // `${userId}|${tgl}` -> jumlah
const baruSaja = new Map();    // `${userId}|${title}` -> ts (cegah ganda 2 menit)

function bersihkanMap() {
  const now = Date.now();
  for (const [k, t] of baruSaja) if (now - t > 120000) baruSaja.delete(k);
  const hari = tglWita();
  for (const k of kuotaHarian.keys()) if (!k.endsWith('|' + hari)) kuotaHarian.delete(k);
}

async function proses(job) {
  const { db, userId, data, rule } = job;

  const p = await cariPenerima(db, userId);
  if (!p.role || !rule.roles.includes(p.role)) return catat(db, job, 'dilewati', `peran ${p.role || '?'} tidak termasuk aturan`);
  if (p.optOut) return catat(db, job, 'dilewati', 'pengguna menolak (waOptOut)');
  if (bool('WA_REQUIRE_OPTIN', 'false') && !p.optIn) return catat(db, job, 'dilewati', 'belum opt-in');
  if (!p.nomor) return catat(db, job, 'dilewati', 'nomor WhatsApp kosong/tidak valid');

  const dupKey = `${userId}|${data.title}`;
  if (baruSaja.has(dupKey)) return catat(db, job, 'dilewati', 'notifikasi identik baru saja diproses', { to: p.nomor });
  baruSaja.set(dupKey, Date.now());

  const kKey = `${userId}|${tglWita()}`;
  const terpakai = kuotaHarian.get(kKey) || 0;
  // Pengingat kuliah punya pembatas sendiri (1 ringkasan/hari + opsional per kelas) -> tidak memakai kuota harian umum.
  if (!rule.bypassKuota && terpakai >= num('WA_AUTO_MAX_PER_DAY', 5)) return catat(db, job, 'dilewati', 'batas harian penerima tercapai', { to: p.nomor });

  if (bool('WA_AUTO_DRY_RUN', 'true')) {
    if (!rule.bypassKuota) kuotaHarian.set(kKey, terpakai + 1);
    return catat(db, job, 'simulasi', 'dry-run: tidak dikirim', { to: p.nomor });
  }

  const mode = env('WA_SEND_MODE', 'text');
  const body = mode === 'template'
    ? { to: p.nomor, template: susunTemplate(rule, data, p.nama || (p.role === 'dosen' ? 'Bapak/Ibu Dosen' : 'Mahasiswa')) }
    : { to: p.nomor, text: susunTeks(data, p.nama) };
  try {
    await kirimDenganUlang(body);
    if (!rule.bypassKuota) kuotaHarian.set(kKey, terpakai + 1);
    await catat(db, job, 'terkirim', null, { to: p.nomor });
  } catch (e) {
    await catat(db, job, 'gagal', potong(e.message, 200), { to: p.nomor });
  }
}

async function kuras() {
  if (berjalan) return;
  berjalan = true;
  try {
    while (antrean.length) {
      const job = antrean.shift();
      const tunda = msSampaiJamTenangSelesai();
      if (tunda > 0) {
        if (tertunda >= MAX_DEFERRED) { await catat(job.db, job, 'dilewati', 'jam tenang & antrean tunda penuh'); continue; }
        tertunda++;
        const t = setTimeout(() => { tertunda--; antrean.push(job); kuras(); }, tunda);
        if (t.unref) t.unref();
        continue;
      }
      try { await proses(job); } catch (e) { console.error('[WA-Auto] Gagal memproses:', e.message); }
      await new Promise(r => setTimeout(r, num('WA_AUTO_GAP_MS', 1500)));
      bersihkanMap();
    }
  } finally { berjalan = false; }
}

/**
 * Titik masuk. Panggil TANPA await dari notificationHelper.
 * @param {Firestore} db  @param {string} userId  @param {{type,title,message,link}} data
 */
function enqueue(db, userId, data) {
  try {
    if (!bool('WA_AUTO_ENABLED', 'false')) return;
    if (!db || !userId || !data) return;
    const rule = cariRule(data);
    if (!rule || !ruleAktif(rule)) return;
    if (antrean.length >= MAX_QUEUE) { console.error('[WA-Auto] Antrean penuh, notifikasi dilewati'); return; }
    antrean.push({ db, userId, data: { type: data.type, title: data.title, message: data.message || '', link: data.link || null }, rule });
    setImmediate(kuras);
  } catch (e) {
    console.error('[WA-Auto] enqueue gagal:', e.message);
  }
}

function status() {
  return {
    enabled: bool('WA_AUTO_ENABLED', 'false'),
    dryRun: bool('WA_AUTO_DRY_RUN', 'true'),
    mode: env('WA_SEND_MODE', 'text'),
    maxPerDay: num('WA_AUTO_MAX_PER_DAY', 5),
    quiet: `${num('WA_QUIET_START', 21)}:00–${num('WA_QUIET_END', 6)}:00 WITA`,
    antrean: antrean.length,
    rules: RULES.map(r => ({ key: r.key, label: r.label, aktif: ruleAktif(r), roles: r.roles, template: r.template }))
  };
}

module.exports = { enqueue, status, RULES, normalisasiNomor, _test: { normalisasiNomor, cariRule, susunTeks, susunTemplate, proses, cariPenerima, penerimaCache, antrean } };
