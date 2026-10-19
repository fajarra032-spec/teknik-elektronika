/**
 * helpers/penyelesaianStudiDocx.js
 *
 * Membuat berkas Word (.docx) untuk menu "Penyelesaian Studi" dengan MENGISI
 * berkas contoh resmi yang ada di templates/penyelesaian-studi/ :
 *   - formulir.docx          Formulir Pengajuan Pembuatan Undangan Seminar Magang
 *   - surat-permohonan.docx  Surat Permohonan Ujian Magang
 *   - berita-acara.docx      Berita Acara Persentasi Hasil Kegiatan Magang
 *
 * Kop (gambar di header), font, tabel, kotak centang, dan tata letak TIDAK
 * dibuat ulang - berkas contoh dibuka, lalu hanya teks isiannya yang diganti.
 * Jadi hasil unduhan sama persis dengan format yang dipakai prodi. Kalau format
 * di Word berubah, cukup timpa berkas di folder templates/ (selama urutan
 * paragraf/tabelnya sama).
 *
 * Butuh package 'jszip' (sudah ikut ter-install sebagai dependensi 'docx').
 */

const fs = require('fs');
const path = require('path');
const { lokasiBaris } = require('./penyelesaianStudiHelper');

const DIR_TEMPLATE = path.join(__dirname, '../templates/penyelesaian-studi');
const BERKAS = {
  'formulir': 'formulir.docx',
  'surat-permohonan': 'surat-permohonan.docx',
  'berita-acara': 'berita-acara.docx'
};

function muatJsZip() {
  try { return require('jszip'); } catch (e) { /* coba lewat lokasi package 'docx' */ }
  try {
    // jszip ikut ter-install sebagai dependensi 'docx'; kalau tidak ter-hoist ke
    // node_modules paling atas, cari dari folder 'docx' itu sendiri.
    return require(require.resolve('jszip', { paths: [path.dirname(require.resolve('docx'))] }));
  } catch (e) {
    throw new Error("Package 'jszip' tidak ditemukan. Jalankan: npm install jszip");
  }
}

// ------------------------------------------------------------ alat bantu XML
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const RE_PARA = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const RE_RUN = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;

/** Pecah isi <w:body> menjadi blok tingkat-atas: paragraf (p), tabel (tbl), sectPr */
function pecahBlok(body) {
  const blok = [];
  const pola = /<(\/?)w:(p|tbl|sectPr)\b[^>]*?(\/?)>/g;
  let kedalaman = 0, mulai = 0, jenis = null, m;
  while ((m = pola.exec(body))) {
    const [, tutup, tag, mandiri] = m;
    if (!tutup && !mandiri) {
      if (kedalaman === 0) { mulai = m.index; jenis = tag; }
      if (tag === jenis) kedalaman++;
    } else if (tutup && tag === jenis) {
      if (--kedalaman === 0) blok.push({ jenis, xml: body.slice(mulai, pola.lastIndex) });
    } else if (mandiri && kedalaman === 0) {
      blok.push({ jenis: tag, xml: body.slice(m.index, pola.lastIndex) });
    }
  }
  return blok;
}

/** Teks polos sebuah paragraf (gabungan semua run) */
function teksParagraf(p) {
  return (p.match(RE_RUN) || [])
    .map((r) => (r.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))
    .join('');
}

/**
 * Ganti seluruh teks paragraf dengan `teks`, memakai format (rPr) run pertama
 * yang berisi teks. Properti paragraf (rata, indent, tab, penomoran) tetap.
 */
function setTeks(p, teks) {
  const runs = p.match(RE_RUN) || [];
  const acuan = runs.find((r) => /<w:t[\s>]/.test(r)) || runs[0] || '';
  const rPr = (acuan.match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
  const baru = `<w:r>${rPr}<w:t xml:space="preserve">${esc(teks)}</w:t></w:r>`;
  let sudah = false;
  let hasil = p.replace(RE_RUN, () => (sudah ? '' : (sudah = true, baru)));
  hasil = hasil.replace(/<w:proofErr\b[^>]*\/>/g, '');
  if (!sudah) hasil = hasil.replace('</w:p>', baru + '</w:p>');
  return hasil;
}

/** Tambahkan run teks di akhir paragraf (format = run teks terakhir) */
function tambahTeks(p, teks) {
  const runs = (p.match(RE_RUN) || []).filter((r) => /<w:t[\s>]/.test(r));
  const rPr = ((runs[runs.length - 1] || '').match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0];
  return p.replace(/<\/w:p>$/, `<w:r>${rPr}<w:t xml:space="preserve">${esc(teks)}</w:t></w:r></w:p>`);
}

/**
 * Edit isi tabel. `edit(baris, sel, para, xmlParagraf)` mengembalikan XML
 * paragraf baru, atau undefined bila tidak diubah. Indeks mulai dari 0.
 */
function editTabel(tbl, edit) {
  let b = -1;
  return tbl.replace(/<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g, (tr) => {
    b++;
    let s = -1;
    return tr.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, (tc) => {
      s++;
      let q = -1;
      return tc.replace(RE_PARA, (p) => {
        q++;
        const baru = edit(b, s, q, p);
        return baru === undefined ? p : baru;
      });
    });
  });
}

/** Susun ulang <w:body> dengan mengubah blok tertentu */
function ubahBlok(documentXml, fn) {
  const awal = documentXml.indexOf('<w:body>') + '<w:body>'.length;
  const akhir = documentXml.indexOf('</w:body>');
  const blok = pecahBlok(documentXml.slice(awal, akhir));
  const hasil = fn(blok) || blok;
  return documentXml.slice(0, awal) + hasil.map((x) => x.xml).join('') + documentXml.slice(akhir);
}

/**
 * Blok tanda tangan di contoh surat memakai deretan tab untuk menggeser teks ke
 * kanan; nama/tanggal yang panjang jadi turun baris. Di sini deretan tab diganti
 * indentasi tetap (posisi mirip) supaya tidak pernah terpotong.
 */
function geserKeKanan(p, kiri = 5400) {
  return p
    .replace(RE_RUN, (r) => (/<w:tab\/>/.test(r) && !/<w:t[\s>]/.test(r) ? '' : r))
    .replace(/<w:tabs>[\s\S]*?<\/w:tabs>/, '')
    .replace(/(<w:spacing\b[^>]*\/>)/, `$1<w:ind w:left="${kiri}"/>`);
}

/** Ganti simbol kotak pada daftar centang: '☐' (kosong) -> '☒' (dicentang) */
function setCentang(numberingXml, abstractId, dicentang) {
  const a = new RegExp(`(<w:abstractNum\\b[^>]*w:abstractNumId="${abstractId}"[\\s\\S]*?<w:lvlText w:val=")[^"]*(")`);
  return numberingXml.replace(a, `$1${dicentang ? '☒' : '☐'}$2`);
}

// --------------------------------------------------------------- pengisi
function isiSuratPermohonan(doc, d) {
  return ubahBlok(doc, (blok) => {
    const P = (i) => blok[i].xml;
    const nilai = (i, teks) => { blok[i].xml = tambahTeks(P(i), teks); };

    // Judul: titik-titik pada "TAHUN AKADEMIK ………………"
    blok[2].xml = setTeks(P(2), `TAHUN AKADEMIK ${d.tahunAkademik}`);

    // Identitas: label & titik dua sudah ada di contoh, nilai ditulis setelahnya
    nilai(9, d.nama);                       // "Nama   : "
    nilai(10, ' ' + d.nim);
    nilai(11, ' ' + d.prodi);
    nilai(12, ' ' + (d.semester || ''));

    const lokasi = d.lokasiBaris;
    nilai(13, ' ' + lokasi[0]);
    // Baris lokasi berikutnya: paragraf baru yang diratakan dengan nilai di atasnya
    const pPr = (P(13).match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0]
      .replace(/<w:tabs>[\s\S]*?<\/w:tabs>/, '')
      .replace(/(<w:spacing\b[^>]*\/>)/, '$1<w:ind w:left="3000"/>');
    const rPr = (P(13).match(/<w:rPr>[\s\S]*?<\/w:rPr>/g) || []).pop() || '';
    const tambahan = lokasi.slice(1).map((l) =>
      ({ jenis: 'p', xml: `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>` }));
    blok.splice(14, 0, ...tambahan);
    const geser = tambahan.length;

    // Tanda tangan: "Palopo," + tanggal, lalu nama dan NIM pemohon
    const iTgl = 26 + geser, iNama = 31 + geser, iNim = 32 + geser;
    [iTgl, iNama, iNim].forEach((i) => { blok[i].xml = geserKeKanan(blok[i].xml); });
    blok[iTgl].xml = blok[iTgl].xml.replace(/(<w:t>,<\/w:t>)/, `<w:t xml:space="preserve">, ${esc(d.tanggalCetak)}</w:t>`);
    blok[iNama].xml = blok[iNama].xml.replace(/<w:t>Nama<\/w:t>/, `<w:t xml:space="preserve">${esc(d.nama)}</w:t>`);
    blok[iNim].xml = blok[iNim].xml.replace(/<w:t>Nim<\/w:t>/, `<w:t xml:space="preserve">NIM. ${esc(d.nim)}</w:t>`);
    return blok;
  });
}

function isiBeritaAcara(doc, d) {
  const j = d.jadwal;
  const bagian = j ? j.bagian : { hari: '............', tgl: '.....', bulan: '.....................', tahun: '2026' };
  const titik = '..............................';

  return ubahBlok(doc, (blok) => {
    // "Pada hari ini ... tanggal ... bulan ... tahun 2025, bertempat di Palopo ..."
    const teks = teksParagraf(blok[3].xml)
      .replace(/hari ini\s+\.+\s+tanggal\s+\.+\s+bulan\s+\.+\s+tahun\s+\d+/,
        `hari ini ${bagian.hari} tanggal ${bagian.tgl} bulan ${bagian.bulan} tahun ${bagian.tahun}`);
    blok[3].xml = setTeks(blok[3].xml, teks);

    // Tabel mahasiswa: NIM | Nama | Lokasi Magang 1-3
    blok[4].xml = editTabel(blok[4].xml, (b, s, q, p) => {
      if (b === 1 && s === 0) return setTeks(p, d.nim);
      if (b === 1 && s === 1) return setTeks(p, d.nama);
      if (b >= 1 && b <= 3 && s === 2) {
        const l = d.lokasi[b - 1];
        return setTeks(p, `Magang ${b} : ${l && l.perusahaan ? l.perusahaan : '-'}`);
      }
    });

    // Tim penguji: pembimbing & pendamping lapangan diisi dari data
    blok[6].xml = editTabel(blok[6].xml, (b, s, q, p) => {
      if (s !== 0) return;
      if (b === 9) return setTeks(p, `${d.pembimbingNama || titik} (Pembimbing I)`);
      if (b === 11) return setTeks(p, `${titik} (Pembimbing II)`);
      if (b === 12) return setTeks(p, `${d.pendampingLapangan || titik} (Pendamping Lapangan)`);
    });

    // "Palopo, 23 / Juli / 2025"
    blok[10].xml = setTeks(blok[10].xml, j
      ? `${d.kota}, ${bagian.tgl} / ${bagian.bulan} / ${bagian.tahun} `
      : `${d.kota}, ...... / .......... / ${bagian.tahun} `);

    // Kaprodi
    blok[14].xml = editTabel(blok[14].xml, (b, s, q, p) => {
      if (b === 1 && q === 0) return setTeks(p, d.kaprodi.nama);
      if (b === 1 && q === 1) return setTeks(p, `NUPTK: ${d.kaprodi.nuptk}`);
    });
    return blok;
  });
}

function isiFormulir(doc, d) {
  return ubahBlok(doc, (blok) => {
    blok[7].xml = editTabel(blok[7].xml, (b, s, q, p) => {
      if (s !== 1) return;
      if (b === 0) return setTeks(p, ' ' + (d.nama || '').toUpperCase());
      if (b === 1) return setTeks(p, ' ' + d.nim);
      if (b === 2) return setTeks(p, ' ' + d.prodi);
    });
    blok[10].xml = editTabel(blok[10].xml, (b, s, q, p) => {
      if (s !== 1) return;
      if (b === 0) return setTeks(p, d.pembimbingNama || '-');
      if (b === 1) return setTeks(p, '-');
    });
    blok[22].xml = setTeks(blok[22].xml, `${d.kota}, ${d.tanggalCetak}`);
    blok[24].xml = setTeks(blok[24].xml, d.prodi);
    blok[30].xml = setTeks(blok[30].xml, d.kaprodi.nama);
    blok[31].xml = setTeks(blok[31].xml, `NUPTK. ${d.kaprodi.nuptk}`);
    return blok;
  });
}

/** Kotak centang formulir: numId 4/3/2 = Laporan 1/2/3, numId 1 = bukti pembayaran */
function isiCentangFormulir(numberingXml, d) {
  let x = numberingXml;
  x = setCentang(x, 3, d.laporan[0].sudah);
  x = setCentang(x, 2, d.laporan[1].sudah);
  x = setCentang(x, 1, d.laporan[2].sudah);
  x = setCentang(x, 0, d.pembayaranLunas);
  return x;
}

const PENGISI = {
  'formulir': isiFormulir,
  'surat-permohonan': isiSuratPermohonan,
  'berita-acara': isiBeritaAcara
};

/**
 * Isi berkas contoh dengan data mahasiswa.
 * @returns {Promise<Buffer>} isi file .docx
 */
async function buatDokumenWord(jenis, data) {
  if (!BERKAS[jenis]) throw new Error('Jenis dokumen tidak dikenal: ' + jenis);
  const JSZip = muatJsZip();
  const zip = await JSZip.loadAsync(fs.readFileSync(path.join(DIR_TEMPLATE, BERKAS[jenis])));

  const d = { ...data, lokasiBaris: data.lokasiBaris || lokasiBaris(data) };
  const docXml = await zip.file('word/document.xml').async('string');
  zip.file('word/document.xml', PENGISI[jenis](docXml, d));

  if (jenis === 'formulir') {
    const numXml = await zip.file('word/numbering.xml').async('string');
    zip.file('word/numbering.xml', isiCentangFormulir(numXml, d));
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { buatDokumenWord };
