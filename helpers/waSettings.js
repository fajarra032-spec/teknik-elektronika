/**
 * helpers/waSettings.js
 * Pengaturan WhatsApp otomatis yang bisa diubah dari halaman admin
 * (Firestore: settings/wa_auto). Prioritas: diatur di web > .env > bawaan kode.
 *
 * Isi dokumen:  { rules: {kunci: bool}, config: {NAMA_ENV: nilai}, templates: {namaTemplate: teks} }
 *
 * Yang SENGAJA tetap hanya di .env (rahasia / infrastruktur):
 *   NOTIFICATION_API_URL, NOTIFICATION_INTERNAL_KEY.
 */
const TTL_MS = 20 * 1000;
const state = { rules: {}, config: {}, templates: {} };
let muatPada = 0;
let sedangMuat = null;
const lazyDb = () => require('../config/firebaseAdmin').db;
const ref = () => lazyDb().collection('settings').doc('wa_auto');

// ---------------------------------------------------------------------------
// Definisi pengaturan yang boleh diubah dari web
// ---------------------------------------------------------------------------
const DEF = [
  // Pengiriman
  { key: 'WA_AUTO_ENABLED', grup: 'Pengiriman', tipe: 'bool', bawaan: 'false', label: 'Kirim notifikasi otomatis ke WhatsApp', bantuan: 'Saklar utama. Mati = tidak ada pesan otomatis sama sekali.', bahaya: true },
  { key: 'WA_AUTO_DRY_RUN', grup: 'Pengiriman', tipe: 'bool', bawaan: 'true', label: 'Mode simulasi (tidak benar-benar mengirim)', bantuan: 'Hidup = pesan hanya dicatat di Riwayat. Matikan bila sudah yakin ingin mengirim sungguhan.', bahaya: false },
  { key: 'WA_SEND_MODE', grup: 'Pengiriman', tipe: 'pilih', pilihan: [['text', 'Teks biasa (isi bisa diubah di tab Template)'], ['template', 'Template resmi Meta (isi tidak bisa diubah)']], bawaan: 'text', label: 'Cara kirim', bantuan: 'Mode template butuh template yang sudah disetujui Meta di Notification API.' },
  { key: 'WA_REQUIRE_OPTIN', grup: 'Pengiriman', tipe: 'bool', bawaan: 'false', label: 'Hanya kirim ke yang sudah opt-in', bantuan: 'Hidup = hanya pengguna dengan waOptIn = true yang dikirimi.' },
  { key: 'WA_SITE_URL', grup: 'Pengiriman', tipe: 'url', bawaan: 'https://elektronika.polidewa.ac.id', label: 'Alamat website untuk tautan di pesan', bantuan: 'Dipakai di {tautan}. Tanpa garis miring di akhir.' },
  // Batas & jadwal
  { key: 'WA_AUTO_MAX_PER_DAY', grup: 'Batas & jadwal', tipe: 'angka', min: 1, max: 50, bawaan: '5', label: 'Maks. pesan per penerima per hari', bantuan: 'Mencegah satu orang kebanjiran pesan. Pengingat kuliah tidak terkena batas ini.', satuan: 'pesan' },
  { key: 'WA_AUTO_GAP_MS', grup: 'Batas & jadwal', tipe: 'angka', min: 500, max: 10000, bawaan: '1500', label: 'Jeda antar pesan', bantuan: 'Jeda antar pengiriman agar nomor tidak dianggap spam.', satuan: 'ms' },
  { key: 'WA_QUIET_START', grup: 'Batas & jadwal', tipe: 'angka', min: 0, max: 23, bawaan: '21', label: 'Jam tenang mulai', bantuan: 'Pesan yang muncul saat jam tenang ditunda sampai selesai. Sama dengan jam selesai = tanpa jam tenang.', satuan: 'WITA' },
  { key: 'WA_QUIET_END', grup: 'Batas & jadwal', tipe: 'angka', min: 0, max: 23, bawaan: '6', label: 'Jam tenang selesai', bantuan: 'Pesan tertunda dikirim sesudah jam ini.', satuan: 'WITA' },
  // Pengingat kuliah
  { key: 'KULIAH_REMINDER_ENABLED', grup: 'Pengingat kuliah', tipe: 'bool', bawaan: 'true', label: 'Pengingat jadwal kuliah/mengajar', bantuan: 'Hanya berjalan bila pengiriman otomatis di atas juga hidup.' },
  { key: 'KULIAH_PAGI_JAM', grup: 'Pengingat kuliah', tipe: 'jam', bawaan: '06:30', label: 'Jam ringkasan pagi', bantuan: 'Ringkasan jadwal hari ini dikirim pada jam ini (06:00–21:00 WITA).', satuan: 'WITA' },
  { key: 'KULIAH_REMINDER_MENIT', grup: 'Pengingat kuliah', tipe: 'angka', min: 0, max: 180, bawaan: '0', label: 'Pengingat sebelum kelas dimulai', bantuan: '0 = tidak ada pengingat sebelum kelas.', satuan: 'menit' },
  { key: 'KULIAH_UNTUK_DOSEN', grup: 'Pengingat kuliah', tipe: 'bool', bawaan: 'true', label: 'Kirim ke dosen' },
  { key: 'KULIAH_UNTUK_MAHASISWA', grup: 'Pengingat kuliah', tipe: 'bool', bawaan: 'true', label: 'Kirim ke mahasiswa' },
  // Notifikasi untuk admin (PMB baru, kunjungan industri baru, pengajuan peminjaman/pengembalian alat)
  { key: 'WA_ADMIN_NUMBERS', grup: 'Notifikasi admin', tipe: 'nomor', bawaan: '', label: 'Nomor WhatsApp admin penerima', bantuan: 'Satu atau beberapa nomor, pisahkan dengan koma (mis. 085242459746). Ditambahkan ke nomor noHp pada akun admin, bila ada.' },
  { key: 'WA_ADMIN_MAX_PER_DAY', grup: 'Notifikasi admin', tipe: 'angka', min: 1, max: 200, bawaan: '30', label: 'Maks. pesan per nomor admin per hari', bantuan: 'Batas terpisah dari penerima lain karena admin menerima pengajuan dari banyak orang.', satuan: 'pesan' },
  { key: 'WA_ADMIN_IGNORE_QUIET', grup: 'Notifikasi admin', tipe: 'bool', bawaan: 'false', label: 'Tetap kirim ke admin saat jam tenang', bantuan: 'Hidup = pesan admin tidak ditunda walau di jam tenang (21.00–06.00 WITA bawaan).' }
];
const DEF_MAP = Object.fromEntries(DEF.map(d => [d.key, d]));

/** 08xx / +62 / 0062 / 8xx -> 628xx (hanya digit). Kembalikan '' bila tidak valid. */
function normalisasiNomor(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^62\d{8,13}$/.test(d) ? d : '';
}

/** Validasi + normalisasi nilai dari form. Lempar Error bila tidak valid. */
function validasi(d, mentah) {
  const v = String(mentah == null ? '' : mentah).trim();
  switch (d.tipe) {
    case 'bool':
      if (!['true', 'false'].includes(v)) throw new Error(`${d.label}: nilai harus hidup/mati`);
      return v;
    case 'pilih':
      if (!d.pilihan.some(p => p[0] === v)) throw new Error(`${d.label}: pilihan tidak valid`);
      return v;
    case 'angka': {
      const n = Number(v);
      if (!Number.isInteger(n) || n < d.min || n > d.max) throw new Error(`${d.label}: isi bilangan bulat ${d.min}–${d.max}`);
      return String(n);
    }
    case 'jam': {
      const m = v.match(/^(\d{1,2})[.:](\d{2})$/);
      if (!m || +m[1] > 21 || +m[1] < 6 || +m[2] > 59 || (+m[1] === 21 && +m[2] > 0)) throw new Error(`${d.label}: isi jam 06:00–21:00`);
      return `${String(+m[1]).padStart(2, '0')}:${m[2]}`;
    }
    case 'nomor': {
      if (!v) return '';                                   // kosong = tidak ada nomor tambahan
      const bagian = v.split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);
      if (bagian.length > 10) throw new Error(`${d.label}: maksimal 10 nomor`);
      const hasil = bagian.map(x => {
        const n = normalisasiNomor(x);
        if (!n) throw new Error(`${d.label}: nomor tidak valid (“${x.slice(0, 20)}”). Contoh: 085242459746`);
        return n;
      });
      return [...new Set(hasil)].join(',');
    }
    case 'url':
      if (!/^https?:\/\/[^\s]+$/i.test(v)) throw new Error(`${d.label}: harus diawali http:// atau https://`);
      return v.replace(/\/+$/, '');
    default: throw new Error('Tipe tidak dikenal');
  }
}

// ---------------------------------------------------------------------------
// Template teks (mode "text")
// ---------------------------------------------------------------------------
const PLACEHOLDER = [
  ['{nama}', 'Nama penerima'],
  ['{judul}', 'Judul notifikasi'],
  ['{isi}', 'Keterangan notifikasi'],
  ['{tautan}', 'Tautan "Buka: …" ke halaman terkait'],
  ['{situs}', 'Alamat website prodi']
];
const TEKS_BAWAAN = '*Prodi Teknik Elektronika*\n{judul}\n{isi}\n\n{tautan}\n\n_Pesan otomatis dari Sistem Informasi Prodi Teknik Elektronika._';
const MAKS_TEKS = 1000;

function validasiTeks(teks) {
  const t = String(teks == null ? '' : teks).replace(/\r\n/g, '\n').trim();
  if (!t) throw new Error('Teks template tidak boleh kosong');
  if (t.length > MAKS_TEKS) throw new Error(`Teks terlalu panjang (maks. ${MAKS_TEKS} karakter)`);
  if (!t.includes('{judul}')) throw new Error('Template harus memuat {judul}');
  const asing = (t.match(/\{[^{}\s]*\}/g) || []).filter(p => !PLACEHOLDER.some(x => x[0] === p));
  if (asing.length) throw new Error(`Kode tidak dikenal: ${[...new Set(asing)].join(', ')}`);
  return t;
}

/** Isi template. Baris yang hanya berisi kode kosong dibuang; baris kosong berturut-turut dirapatkan. */
function isiTemplate(teks, v) {
  const nilai = { '{nama}': v.nama || '', '{judul}': v.judul || '', '{isi}': v.isi || '', '{tautan}': v.tautan || '', '{situs}': v.situs || '' };
  const keluar = [];
  String(teks).replace(/\r\n/g, '\n').split('\n').forEach(baris => {
    const adaKode = /\{(nama|judul|isi|tautan|situs)\}/.test(baris);
    const hasil = baris.replace(/\{(nama|judul|isi|tautan|situs)\}/g, m => nilai[m]);
    if (adaKode && !hasil.trim()) return;      // baris yang isinya kosong dibuang
    keluar.push(hasil.trimEnd());
  });
  return keluar.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------------------
// Muat / simpan
// ---------------------------------------------------------------------------
function segarkan(paksa) {
  if (!paksa && Date.now() - muatPada < TTL_MS) return Promise.resolve();
  if (sedangMuat) return sedangMuat;
  sedangMuat = (async () => {
    try {
      const d = await ref().get();
      const x = d.exists ? d.data() : {};
      const obj = (o) => (o && typeof o === 'object' ? o : {});
      state.rules = obj(x.rules); state.config = obj(x.config); state.templates = obj(x.templates);
    } catch (e) {
      console.error('[WA-Settings] gagal membaca pengaturan:', e.message);
    } finally { muatPada = Date.now(); sedangMuat = null; }
  })();
  return sedangMuat;
}
const segar = () => Date.now() - muatPada < TTL_MS;

async function ubah(bagian, mutator, oleh) {
  const d = await ref().get();
  const x = d.exists ? d.data() : {};
  const salinan = { rules: { ...(x.rules || {}) }, config: { ...(x.config || {}) }, templates: { ...(x.templates || {}) } };
  mutator(salinan[bagian]);
  await ref().set({ ...salinan, updatedAt: new Date().toISOString(), updatedBy: oleh || '' });
  state[bagian] = salinan[bagian]; muatPada = Date.now();
}

/** Nilai gabungan: web > .env > bawaan. Dipakai menggantikan process.env di modul WA. */
function env(k, d) {
  if (state.config[k] !== undefined && state.config[k] !== null) return String(state.config[k]);
  return process.env[k] === undefined || process.env[k] === '' ? d : process.env[k];
}
function sumberConfig(k) {
  if (state.config[k] !== undefined && state.config[k] !== null) return 'web';
  return process.env[k] === undefined || process.env[k] === '' ? 'bawaan' : 'env';
}

/** nilai: string valid | null (kembali ke .env/bawaan) */
async function aturConfig(key, nilai, oleh) {
  const d = DEF_MAP[key];
  if (!d) throw new Error('Pengaturan tidak dikenal');
  const v = nilai === null ? null : validasi(d, nilai);
  await ubah('config', c => { if (v === null) delete c[key]; else c[key] = v; }, oleh);
}
async function aturTemplate(nama, teks, oleh) {
  const { TEMPLATES } = require('./waTemplates');
  if (!TEMPLATES[nama]) throw new Error('Template tidak dikenal');
  const t = teks === null ? null : validasiTeks(teks);
  await ubah('templates', c => { if (t === null) delete c[nama]; else c[nama] = t; }, oleh);
}
async function aturRule(key, nilai, oleh) {
  await ubah('rules', c => { if (nilai === null) delete c[key]; else c[key] = !!nilai; }, oleh);
}

/** Daftar pengaturan + nilai sekarang, untuk ditampilkan di halaman admin. */
function daftarConfig() {
  return DEF.map(d => ({ ...d, nilai: env(d.key, d.bawaan), sumber: sumberConfig(d.key), envAda: process.env[d.key] !== undefined && process.env[d.key] !== '' }));
}
function teksTemplate(nama) { return typeof state.templates[nama] === 'string' && state.templates[nama] ? state.templates[nama] : TEKS_BAWAAN; }
function templateKustom(nama) { return typeof state.templates[nama] === 'string' && !!state.templates[nama]; }

module.exports = {
  state, DEF, PLACEHOLDER, normalisasiNomor, TEKS_BAWAAN, MAKS_TEKS,
  segarkan, segar, env, sumberConfig, aturConfig, aturTemplate, aturRule,
  daftarConfig, teksTemplate, templateKustom, isiTemplate, validasiTeks, validasi
};
