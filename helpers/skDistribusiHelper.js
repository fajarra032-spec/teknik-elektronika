/**
 * helpers/skDistribusiHelper.js
 * Bagian bersama untuk "Rilis & Kirim SK ke Dosen" (SK Pembimbing Akademik dan
 * SK Mengajar): HTML -> PDF (puppeteer, pola sama dengan Surat Tugas), unggah
 * ke Google Drive, dan pemetaan dosen -> akun user untuk notifikasi.
 *
 * puppeteer di-require LAZY supaya kalau belum terpasang hanya fitur ini yang
 * gagal, bukan seluruh aplikasi.
 */
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

/** Ganti src gambar kop & TTD menjadi data URI (page.setContent tidak punya base URL). */
function inlineGambarSurat(html) {
  const base = path.join(__dirname, '../public/images');
  const ganti = (nama) => {
    const p = path.join(base, nama);
    if (!fs.existsSync(p)) return;
    const b64 = fs.readFileSync(p).toString('base64');
    const re = new RegExp(`src="/images/${nama.replace('.', '\\.')}"`, 'g');
    html = html.replace(re, `src="data:image/png;base64,${b64}"`);
  };
  ganti('ttd.png');
  ganti('logo.png');
  return html;
}

async function bukaBrowser() {
  const puppeteer = require('puppeteer');
  return puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: 'new', timeout: 60000 });
}

/** Render satu dokumen HTML ke PDF A4 (mengikuti @page di CSS dokumen). */
async function htmlKePdf(browser, html) {
  const page = await browser.newPage();
  try {
    await page.setContent(inlineGambarSurat(html), { waitUntil: 'networkidle0', timeout: 60000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** Unggah PDF ke folder Drive dan bagikan (reader/anyone). */
async function unggahPdf(drive, folderId, namaFile, buffer) {
  const up = await drive.files.create({
    resource: { name: namaFile, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id'
  });
  const fileId = up.data.id;
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
  return { fileId, fileUrl: `https://drive.google.com/uc?export=view&id=${fileId}` };
}

/** Hapus file Drive hanya bila tidak dipakai entri sk_dosen mana pun. */
async function hapusFileBilaYatim(db, drive, fileId) {
  if (!fileId) return;
  try {
    const masih = await db.collection('sk_dosen').where('fileId', '==', fileId).limit(1).get();
    if (masih.empty) await drive.files.delete({ fileId });
  } catch (e) { console.error('Gagal membersihkan file SK lama:', e.message); }
}

/** dosenId -> id akun user (dipakai notifikasi navbar, yang membaca req.user.id). */
async function petaUserPerDosen(db) {
  const snap = await db.collection('users').where('role', '==', 'dosen').get();
  const peta = {};
  snap.docs.forEach(u => { const dId = u.data().dosenId; if (dId) peta[dId] = u.id; });
  return peta;
}

const amanNama = (v) => String(v).replace(/[^\w.-]+/g, '_');

module.exports = { inlineGambarSurat, bukaBrowser, htmlKePdf, unggahPdf, hapusFileBilaYatim, petaUserPerDosen, amanNama };
