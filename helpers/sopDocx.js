/**
 * helpers/sopDocx.js - membuat berkas Word (.docx) SOP dari data/sop/detail/*.js
 * Memakai package 'docx' (sudah ada di package.json). Format: kop teks, tabel identitas
 * dokumen, bagian-bagian SOP baku, tabel prosedur, lampiran, kolom pengesahan.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ShadingType, Header, Footer, PageNumber, VerticalAlign
} = require('docx');

const FONT = 'Arial';
const GARIS = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
const BORDERS = { top: GARIS, bottom: GARIS, left: GARIS, right: GARIS };
const LEBAR = 9360; // DXA, lebar isi A4 dgn margin 1" (portrait ~ 9026) -> dipakai 9360 dgn margin 0.9"

const run = (text, o = {}) => new TextRun({ text: String(text), font: FONT, size: o.size || 20, bold: o.bold, italics: o.italics, color: o.color });
const para = (text, o = {}) => new Paragraph({
  alignment: o.align, spacing: { before: o.before || 0, after: o.after == null ? 80 : o.after },
  keepNext: o.keepNext, children: Array.isArray(text) ? text : [run(text, o)]
});
const judulBagian = (t) => para(t, { bold: true, size: 22, before: 220, after: 100, keepNext: true });

function sel(text, { w, bold, fill, align, span } = {}) {
  return new TableCell({
    borders: BORDERS, width: { size: w, type: WidthType.DXA }, columnSpan: span,
    verticalAlign: VerticalAlign.TOP,
    shading: fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text == null ? '' : text).split('\n').map(t => new Paragraph({ alignment: align, spacing: { after: 20 }, children: [run(t, { size: 18, bold })] }))
  });
}
function tabel(lebar, head, rows) {
  const jumlah = lebar.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: jumlah, type: WidthType.DXA }, columnWidths: lebar,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => sel(h, { w: lebar[i], bold: true, fill: 'D9E2F3', align: AlignmentType.CENTER })) }),
      ...rows.map(r => new TableRow({ cantSplit: true, children: r.map((c, i) => sel(c, { w: lebar[i], align: i === 0 && String(c).length < 4 ? AlignmentType.CENTER : undefined })) }))
    ]
  });
}
const daftar = (items) => items.map((t, i) => para(`${i + 1}. ${t}`, { after: 60 }));

async function buatSopDocx(sop, status) {
  const d = sop.isi;
  const nomorTotal = sop.kode;
  const label = status && status.status ? status.status : 'Draf disusun';
  const versi = (status && status.versi) || d.versi;
  const berlaku = (status && status.tanggalBerlaku) || '................';
  const anak = [];

  // identitas dokumen
  anak.push(new Table({
    width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [1900, 3200, 1700, 2560],
    rows: [
      new TableRow({ children: [
        new TableCell({ borders: BORDERS, columnSpan: 2, width: { size: 5100, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            para('POLITEKNIK DEWANTARA', { bold: true, size: 22, align: AlignmentType.CENTER, after: 20 }),
            para('PROGRAM STUDI D3 TEKNIK ELEKTRONIKA', { bold: true, size: 20, align: AlignmentType.CENTER, after: 0 })
          ] }),
        new TableCell({ borders: BORDERS, columnSpan: 2, width: { size: 4260, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [
            para('STANDAR OPERASIONAL PROSEDUR', { bold: true, size: 20, align: AlignmentType.CENTER, after: 20 }),
            para(d.judul.toUpperCase(), { bold: true, size: 18, align: AlignmentType.CENTER, after: 0 })
          ] })
      ] }),
      new TableRow({ children: [sel('Nomor Dokumen', { w: 1900, bold: true }), sel(nomorTotal, { w: 3200 }), sel('Tanggal Dibuat', { w: 1700, bold: true }), sel(d.tanggalDibuat, { w: 2560 })] }),
      new TableRow({ children: [sel('Versi / Status', { w: 1900, bold: true }), sel(`${versi} - ${label}`, { w: 3200 }), sel('Tanggal Berlaku', { w: 1700, bold: true }), sel(berlaku, { w: 2560 })] }),
      new TableRow({ children: [sel('Disahkan oleh', { w: 1900, bold: true }), sel('Direktur / pejabat berwenang sesuai SPMI [KONFIRMASI]', { w: 7460, span: 3 })] })
    ]
  }));

  anak.push(judulBagian('A. Tujuan')); anak.push(...daftar(d.tujuan));
  anak.push(judulBagian('B. Ruang Lingkup')); anak.push(...daftar(d.ruangLingkup));
  anak.push(judulBagian('C. Dasar Hukum')); anak.push(...daftar(d.dasarHukum));
  anak.push(judulBagian('D. Definisi')); anak.push(tabel([2400, 6960], ['Istilah', 'Pengertian'], d.definisi.map(x => [x.istilah, x.arti])));
  anak.push(judulBagian('E. Pihak yang Bertanggung Jawab')); anak.push(tabel([2800, 6560], ['Pihak', 'Tanggung jawab'], d.pihak.map(x => [x.peran, x.tanggungJawab])));
  anak.push(judulBagian('F. Persyaratan')); anak.push(...daftar(d.persyaratan));
  anak.push(judulBagian('G. Prosedur'));
  anak.push(tabel([560, 3700, 1750, 1350, 2000], ['No.', 'Kegiatan', 'Pelaksana', 'Waktu', 'Output / bukti'], d.prosedur.map(p => [p.no, p.kegiatan, p.pelaksana, p.waktu, p.output])));
  anak.push(para('(u) = usulan waktu, ditetapkan Ketua Program Studi saat pengesahan.', { size: 16, italics: true, before: 60 }));
  if (d.kasusKhusus && d.kasusKhusus.length) {
    anak.push(judulBagian('H. Penanganan Kasus Khusus'));
    anak.push(tabel([3600, 5760], ['Kasus', 'Penanganan'], d.kasusKhusus.map(k => [k.kasus, k.penanganan])));
  }
  anak.push(judulBagian('I. Formulir dan Rekaman')); anak.push(...daftar(d.formulir));
  (d.lampiran || []).forEach(l => {
    anak.push(judulBagian(l.judul));
    const n = l.head.length; const w = Math.floor(LEBAR / n);
    anak.push(tabel(l.head.map(() => w), l.head, l.rows));
  });
  anak.push(judulBagian('Riwayat Revisi'));
  anak.push(tabel([1100, 2200, 6060], ['Versi', 'Tanggal', 'Perubahan'], [[d.versi, d.tanggalDibuat, 'Penyusunan awal (draf)']]));

  anak.push(para('', { before: 300 }));
  anak.push(new Table({
    width: { size: LEBAR, type: WidthType.DXA }, columnWidths: [3120, 3120, 3120],
    rows: [
      new TableRow({ children: ['Disusun oleh', 'Diperiksa oleh', 'Disahkan oleh'].map(t => sel(t, { w: 3120, bold: true, fill: 'D9E2F3', align: AlignmentType.CENTER })) }),
      new TableRow({ height: { value: 1300, rule: 'atLeast' }, children: ['Ketua Program Studi', 'Tim Penjaminan Mutu', 'Direktur / pejabat berwenang'].map(t => sel('\n\n\n' + t, { w: 3120, align: AlignmentType.CENTER })) })
    ]
  }));

  const doc = new Document({
    creator: 'Prodi D3 Teknik Elektronika', title: `${sop.kode} ${d.judul}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1273, right: 1273 } } },
      headers: { default: new Header({ children: [para(`${sop.kode} | ${label}`, { size: 16, align: AlignmentType.RIGHT, color: '808080' })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        run('Halaman ', { size: 16 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 }),
        run(' dari ', { size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16 })
      ] })] }) },
      children: anak
    }]
  });
  return Packer.toBuffer(doc);
}
module.exports = { buatSopDocx };
