/**
 * helpers/logbookPdfHelper.js
 *
 * Satu pintu untuk menampilkan pratinjau cetak logbook (HTML) DAN mengunduhnya
 * sebagai PDF, dipakai bersama oleh rute mahasiswa, dosen PA, dan admin supaya
 * ketiganya konsisten:
 *
 *   GET .../logbook-print?...          -> halaman pratinjau (tombol Cetak / Unduh PDF)
 *   GET .../logbook-print?...&pdf=1    -> berkas PDF (diunduh langsung)
 *
 * PDF dibuat dari HTML yang SAMA dengan pratinjau memakai puppeteer (sudah
 * dipakai di routes/admin/surat.js), sehingga hasil unduhan = hasil cetak.
 * Skrip "paksa muat A4" di template dijalankan dulu sebelum PDF dibuat.
 */
const puppeteer = require('puppeteer');

const VIEW_CETAK = 'mahasiswa/magang/print';
const LOGO_URL = 'https://polidewa.ac.id/wp-content/uploads/2025/11/Desain-tanpa-judul-1.png';

// Logo disematkan sebagai data URI agar PDF tidak bergantung pada internet saat render.
let logoDataUri = null;
async function ambilLogoDataUri() {
  if (logoDataUri) return logoDataUri;
  try {
    const resp = await fetch(LOGO_URL, { signal: AbortSignal.timeout(6000) });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const type = resp.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await resp.arrayBuffer());
    logoDataUri = `data:${type};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn('Logo logbook tidak bisa diambil untuk PDF, memakai URL langsung:', err.message);
  }
  return logoDataUri;
}

function bersihkanNamaFile(teks) {
  return String(teks || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 60) || 'Mahasiswa';
}

/** URL halaman yang sama dengan tambahan pdf=1 (tanpa menggandakan parameter). */
function buatPdfUrl(originalUrl) {
  const [path, query = ''] = String(originalUrl).split('?');
  const params = new URLSearchParams(query);
  params.set('pdf', '1');
  return `${path}?${params.toString()}`;
}

async function htmlKePdf(html) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
    timeout: 60000
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 45000 });
    await page.emulateMediaType('print');
    await page.evaluate(() => (document.fonts && document.fonts.ready) ? document.fonts.ready.then(() => true) : true);
    // jalankan ulang "paksa muat A4" pada kondisi media cetak
    await page.evaluate(() => { if (typeof window.fitAllSheets === 'function') window.fitAllSheets(); });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/**
 * Render pratinjau atau PDF logbook.
 * @param {Request} req
 * @param {Response} res
 * @param {Object} locals - data hasil buildLogbookPrintData + title/user
 * @param {Object} [opt] - { urlKembali }
 */
function tampilkanCetakLogbook(req, res, locals, opt = {}) {
  const mintaPdf = req.query.pdf === '1';
  const data = {
    ...locals,
    pdfMode: mintaPdf,
    pdfUrl: buatPdfUrl(req.originalUrl),
    urlKembali: opt.urlKembali || ''
  };

  res.render(VIEW_CETAK, data, async (err, html) => {
    if (err) {
      console.error('Gagal render cetak logbook:', err);
      return res.status(500).send('Gagal mencetak logbook');
    }
    if (!mintaPdf) return res.send(html);

    try {
      const logo = await ambilLogoDataUri();
      if (logo) html = html.split(LOGO_URL).join(logo);
      const pdf = await htmlKePdf(html);
      const nama = `Logbook_${bersihkanNamaFile(locals.mahasiswa && locals.mahasiswa.nim)}_${bersihkanNamaFile(locals.mahasiswa && locals.mahasiswa.nama)}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nama}"`,
        'Content-Length': pdf.length,
        'Cache-Control': 'no-store'
      });
      res.send(pdf);
    } catch (e) {
      console.error('Gagal membuat PDF logbook:', e);
      res.status(500).send('Gagal membuat PDF. Silakan gunakan tombol Cetak lalu pilih "Simpan sebagai PDF".');
    }
  });
}

module.exports = { tampilkanCetakLogbook, buatPdfUrl };
