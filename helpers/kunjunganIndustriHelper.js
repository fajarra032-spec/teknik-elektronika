/**
 * helpers/kunjunganIndustriHelper.js
 * Modul Pengajuan Kunjungan Industri (publik -> admin -> surat otomatis).
 *
 * Koleksi Firestore: kunjunganIndustri
 * Status: diajukan -> disetujui (admin mengisi nomor surat -> surat terbit) | ditolak
 */
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const { TTLCache } = require('./cache');

const KOLEKSI = 'kunjunganIndustri';
const STATUS = { DIAJUKAN: 'diajukan', DISETUJUI: 'disetujui', DITOLAK: 'ditolak' };
const STATUS_LABEL = { diajukan: 'Menunggu Verifikasi Admin', disetujui: 'Disetujui', ditolak: 'Ditolak' };

const KAPRODI = { nama: 'Fajar Ramadhan, S.Pd., M.T.', nuptk: '8559777678130153', jabatan: 'Ketua Program Studi' };
const DATA_WEB_FOLDER_ID = '17Z02_5zOImG1GYfi_5gvWL97-p6dW5t0';

// ---------------------------------------------------------------------------
// Tanggal & format
// ---------------------------------------------------------------------------
function hariIni() { return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }); }
function tanggalValid(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z').getTime()); }
function waktuValid(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }
const fmt = (s, opt) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...opt }).format(new Date(s + 'T00:00:00Z'));
const tanggalPanjang = (s) => (tanggalValid(s) ? fmt(s, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const hariTanggal = (s) => (tanggalValid(s) ? fmt(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** "Senin, 3 November 2026" atau "Senin, 3 November 2026 s.d. Rabu, 5 November 2026" */
function rentangHari(mulai, selesai) {
  if (!tanggalValid(mulai)) return '';
  if (!tanggalValid(selesai) || selesai === mulai) return hariTanggal(mulai);
  return `${hariTanggal(mulai)} s.d. ${hariTanggal(selesai)}`;
}
/** "08.00 WITA s.d. 12.00 WITA" / "08.00 WITA s.d. selesai" / "Menyesuaikan" */
function rentangWaktu(mulai, selesai) {
  const f = (w) => w.replace(':', '.') + ' WITA';
  if (!waktuValid(mulai)) return 'Menyesuaikan jadwal dari pihak perusahaan';
  return waktuValid(selesai) ? `${f(mulai)} s.d. ${f(selesai)}` : `${f(mulai)} s.d. selesai`;
}

// ---------------------------------------------------------------------------
// Kode
// ---------------------------------------------------------------------------
function generateKodePengajuan() {
  const ymd = hariIni().replace(/-/g, '');
  const r = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `KI-${ymd}-${r}`;
}
function generateKodeValidasi() {
  return `ELK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Anti-spam untuk form publik: batas kiriman per IP (in-memory, per proses)
// ---------------------------------------------------------------------------
const kiriman = new Map();
const MAKS_PER_JAM = 5;
const SATU_JAM = 60 * 60 * 1000;
const terkini = (ip, sekarang) => (kiriman.get(ip) || []).filter(t => sekarang - t < SATU_JAM);
/** Masih boleh mengirim? (tidak mencatat). Hanya pengajuan yang BERHASIL dihitung,
 *  supaya pengguna sah yang salah ketik berkali-kali tidak ikut terblokir. */
function lolosBatasKiriman(ip, sekarang = Date.now()) { return terkini(ip, sekarang).length < MAKS_PER_JAM; }
function catatKiriman(ip, sekarang = Date.now()) { const d = terkini(ip, sekarang); d.push(sekarang); kiriman.set(ip, d); }
function resetBatasKiriman() { kiriman.clear(); }

// ---------------------------------------------------------------------------
// Validasi form pengajuan (publik & edit admin)
// ---------------------------------------------------------------------------
const bersih = (v, max) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const bersihBaris = (v, max) => String(v === undefined || v === null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const angka = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : NaN; };

/**
 * @param {object} b  req.body
 * @param {Map<string,object>} mkMap  id -> {id, kode, nama, semester, sks}
 * @param {{izinkanLampau?: boolean}} opsi
 * @returns {{error:string}|{data:object}}
 */
function validasiPengajuan(b, mkMap, opsi = {}) {
  const d = {
    namaPengaju: bersih(b.namaPengaju, 100),
    jabatanPengaju: bersih(b.jabatanPengaju, 100),
    noHp: bersih(b.noHp, 20),
    email: bersih(b.email, 100),
    namaPerusahaan: bersih(b.namaPerusahaan, 150),
    alamatPerusahaan: bersih(b.alamatPerusahaan, 300),
    tanggalKunjungan: bersih(b.tanggalKunjungan, 10),
    tanggalSelesai: bersih(b.tanggalSelesai, 10),
    waktuMulai: bersih(b.waktuMulai, 5),
    waktuSelesai: bersih(b.waktuSelesai, 5),
    jumlahMahasiswa: angka(b.jumlahMahasiswa),
    jumlahPendamping: b.jumlahPendamping === '' || b.jumlahPendamping === undefined ? 0 : angka(b.jumlahPendamping),
    keterkaitan: bersihBaris(b.keterkaitan, 1500),
    tujuan: bersihBaris(b.tujuan, 1000)
  };
  if (!d.namaPengaju) return { error: 'Nama pengaju wajib diisi.' };
  if (!d.noHp || !/^[0-9+\-\s()]{8,20}$/.test(d.noHp)) return { error: 'Nomor HP/WhatsApp wajib diisi dengan benar.' };
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return { error: 'Format email tidak valid.' };
  if (!d.namaPerusahaan) return { error: 'Nama perusahaan tujuan wajib diisi.' };
  if (!d.alamatPerusahaan) return { error: 'Alamat perusahaan wajib diisi.' };
  if (!tanggalValid(d.tanggalKunjungan)) return { error: 'Tanggal kunjungan wajib diisi.' };
  if (!opsi.izinkanLampau && d.tanggalKunjungan < hariIni()) return { error: 'Tanggal kunjungan tidak boleh sebelum hari ini.' };
  if (d.tanggalSelesai) {
    if (!tanggalValid(d.tanggalSelesai)) return { error: 'Tanggal selesai tidak valid.' };
    if (d.tanggalSelesai < d.tanggalKunjungan) return { error: 'Tanggal selesai tidak boleh sebelum tanggal kunjungan.' };
  }
  if (d.waktuMulai && !waktuValid(d.waktuMulai)) return { error: 'Jam mulai tidak valid.' };
  if (d.waktuSelesai && !waktuValid(d.waktuSelesai)) return { error: 'Jam selesai tidak valid.' };
  if (d.waktuMulai && d.waktuSelesai && d.waktuSelesai <= d.waktuMulai && (!d.tanggalSelesai || d.tanggalSelesai === d.tanggalKunjungan)) {
    return { error: 'Jam selesai harus setelah jam mulai.' };
  }
  if (!Number.isFinite(d.jumlahMahasiswa) || d.jumlahMahasiswa < 1 || d.jumlahMahasiswa > 500) return { error: 'Jumlah mahasiswa peserta harus 1 - 500.' };
  if (!Number.isFinite(d.jumlahPendamping) || d.jumlahPendamping > 50) return { error: 'Jumlah dosen pendamping tidak valid (maks. 50).' };

  const idMk = [].concat(b.mkIds || []).map(x => String(x)).filter(Boolean);
  const unik = [...new Set(idMk)];
  if (!unik.length) return { error: 'Pilih minimal satu mata kuliah terkait.' };
  if (unik.length > 10) return { error: 'Maksimal 10 mata kuliah terkait.' };
  d.mataKuliah = [];
  for (const id of unik) {
    const mk = mkMap.get(id);
    if (!mk) return { error: 'Ada mata kuliah yang tidak dikenali. Muat ulang halaman lalu pilih lagi.' };
    d.mataKuliah.push({ id: mk.id, kode: mk.kode || '', nama: mk.nama || '', semester: mk.semester || '', sks: mk.sks || '' });
  }
  if (!d.keterkaitan || d.keterkaitan.length < 20) return { error: 'Jelaskan keterkaitan perusahaan dengan mata kuliah (minimal 20 karakter).' };
  return { data: d };
}

// ---------------------------------------------------------------------------
// Cache daftar "Pengajuan yang Disetujui" (publik)
// ---------------------------------------------------------------------------
const cacheDisetujui = new TTLCache(2 * 60 * 1000);
async function getDisetujuiPublik(db) {
  return cacheDisetujui.getOrFetch('disetujui', async () => {
    const snap = await db.collection(KOLEKSI).where('status', '==', STATUS.DISETUJUI).get();
    return snap.docs.map(x => ({ id: x.id, ...x.data() }))
      .sort((a, b) => (b.disetujuiAt || '').localeCompare(a.disetujuiAt || ''))
      .slice(0, 50)
      .map(x => ({  // hanya field aman untuk publik (tanpa HP/email/IP)
        id: x.id, nomorSurat: x.nomorSurat, namaPerusahaan: x.namaPerusahaan,
        tanggalKunjungan: x.tanggalKunjungan, tanggalSelesai: x.tanggalSelesai || '',
        mataKuliah: x.mataKuliah || [], namaPengaju: x.namaPengaju,
        tanggalSurat: x.tanggalSurat, adaPdf: !!x.pdfUrl
      }));
  });
}
function invalidateDisetujui() { cacheDisetujui.clear(); }

// ---------------------------------------------------------------------------
// Data untuk template surat
// ---------------------------------------------------------------------------
function dataSurat(p) {
  return {
    nomorSurat: p.nomorSurat,
    tanggalSuratFormatted: tanggalPanjang(p.tanggalSurat),
    namaPerusahaan: p.namaPerusahaan,
    alamatPerusahaan: p.alamatPerusahaan,
    hariTanggal: rentangHari(p.tanggalKunjungan, p.tanggalSelesai),
    waktu: rentangWaktu(p.waktuMulai, p.waktuSelesai),
    jumlahMahasiswa: p.jumlahMahasiswa,
    jumlahPendamping: p.jumlahPendamping || 0,
    mataKuliah: p.mataKuliah || [],
    keterkaitan: p.keterkaitan,
    tujuan: p.tujuan || '',
    namaPengaju: p.namaPengaju,
    jabatanPengaju: p.jabatanPengaju || '',
    kodeValidasi: p.kodeValidasi,
    kaprodi: KAPRODI
  };
}

// ---------------------------------------------------------------------------
// PDF: render EJS -> Chromium (puppeteer) -> simpan di Google Drive
// Dipanggil sekali saat admin menerbitkan surat (bukan tiap unduhan), jadi
// publik tidak bisa membebani server dengan menjalankan Chromium berulang kali.
// ---------------------------------------------------------------------------
function renderEjs(app, view, data) {
  return new Promise((resolve, reject) => app.render(view, data, (err, html) => (err ? reject(err) : resolve(html))));
}
function inlineGambar(html) {
  for (const [nama, mime] of [['logo.png', 'image/png'], ['ttd.png', 'image/png']]) {
    const f = path.join(__dirname, '../public/images', nama);
    if (fs.existsSync(f)) {
      const b64 = fs.readFileSync(f).toString('base64');
      html = html.split(`src="/images/${nama}"`).join(`src="data:${mime};base64,${b64}"`);
    }
  }
  return html;
}
async function htmlKePdf(html) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new', timeout: 60000 });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' } }));
  } finally { await browser.close(); }
}
async function folderDrive(drive, parentId, nama) {
  const q = await drive.files.list({
    q: `'${parentId}' in parents and name='${nama}' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)'
  });
  if (q.data.files.length) return q.data.files[0].id;
  const f = await drive.files.create({ resource: { name: nama, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' });
  return f.data.id;
}
async function simpanPdfDrive(buffer, namaFile, tahun) {
  const drive = require('../config/googleDrive');
  const induk = await folderDrive(drive, DATA_WEB_FOLDER_ID, 'Surat Kunjungan Industri');
  const folder = await folderDrive(drive, induk, String(tahun));
  const r = await drive.files.create({ resource: { name: namaFile, parents: [folder] }, media: { mimeType: 'application/pdf', body: Readable.from(buffer) }, fields: 'id' });
  await drive.permissions.create({ fileId: r.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  return { pdfUrl: `https://drive.google.com/uc?export=download&id=${r.data.id}`, pdfFileId: r.data.id };
}
async function hapusFileDrive(fileId) {
  if (!fileId) return;
  try { await require('../config/googleDrive').files.delete({ fileId }); } catch (e) { console.error('Gagal hapus PDF di Drive:', e.message); }
}
/** @returns {Promise<{pdfUrl:string,pdfFileId:string}>} - melempar error bila gagal */
async function buatDanSimpanPdf(app, p, deps = {}) {
  const html = inlineGambar(await renderEjs(app, 'dokumen/surat_kunjungan_industri', { ...dataSurat(p), mode: 'pdf' }));
  const buffer = await (deps.htmlKePdf || htmlKePdf)(html);
  const nama = `Surat_Kunjungan_${String(p.nomorSurat).replace(/[^a-zA-Z0-9]+/g, '_')}_${p.kodeValidasi}.pdf`;
  return (deps.simpanPdfDrive || simpanPdfDrive)(buffer, nama, (p.tanggalSurat || hariIni()).slice(0, 4));
}

module.exports = {
  KOLEKSI, STATUS, STATUS_LABEL, KAPRODI,
  hariIni, tanggalValid, tanggalPanjang, hariTanggal, rentangHari, rentangWaktu,
  generateKodePengajuan, generateKodeValidasi,
  lolosBatasKiriman, catatKiriman, resetBatasKiriman,
  validasiPengajuan, getDisetujuiPublik, invalidateDisetujui,
  dataSurat, buatDanSimpanPdf, hapusFileDrive
};
