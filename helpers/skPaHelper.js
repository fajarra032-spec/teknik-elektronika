/**
 * helpers/skPaHelper.js
 *
 * Generate dokumen "Surat Keputusan Penetapan Dosen Pembimbing Akademik"
 * (SK PA) sebagai file .docx, dibuat dari data mahasiswa & Dosen PA yang
 * SUNGGUHAN ada di database (bukan diketik manual) - dipakai dari tombol
 * "Rilis SK PA" di halaman Kelola Mahasiswa (/admin/mahasiswa).
 *
 * Formatnya meniru contoh SK PA resmi Politeknik Dewantara yang sudah
 * pernah diterbitkan (SK 122/EK/Polidewa/I/2024 & SK 1814/EK/Polidewa/VII/2025):
 * - Halaman 1: badan surat keputusan (menimbang/mengingat/memutuskan) +
 *   tanda tangan Ketua Program Studi.
 * - Halaman 2 dst: lampiran berupa tabel No/NIM/Nama/Dosen PA, dengan sel
 *   "Dosen PA" MENYATU (vertical merge) untuk mahasiswa-mahasiswa yang
 *   dosen pembimbingnya sama - persis seperti contoh aslinya.
 *
 * CATATAN INSTALASI: butuh package npm 'docx'. Kalau belum ada di server:
 *   npm install docx
 * Sengaja di-require LAZY (baru dipanggil saat fungsi buatDokumenSkPa()
 * dijalankan, bukan saat file ini di-require) supaya kalau package-nya
 * belum ter-install, yang gagal cuma fitur ini saja (ketangkap try/catch
 * di route pemanggilnya) - BUKAN bikin seluruh aplikasi gagal start.
 */

const https = require('https');

const FONT = 'Times New Roman';

/**
 * Ambil logo institusi untuk kop surat. Best-effort: kalau gagal diambil
 * (mis. server tidak ada akses internet keluar saat itu, atau URL-nya
 * berubah), dokumen tetap dibuat TANPA logo (kop teks saja) - tidak
 * menggagalkan seluruh proses.
 */
function ambilLogo(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    }).on('error', () => resolve(null));
  });
}

/**
 * @param {object} info - { nomorSk, semester ('Ganjil'|'Genap'), tahunAjaran ('2026/2027'),
 *   tanggal (string tampilan, mis. '8 September 2026'), kota, namaKaprodi, nidnKaprodi, logoUrl }
 * @param {Array}  daftarMahasiswa - [{ nim, nama, dosenPaNama, dosenPaNidn }], SUDAH terurut
 *   (per dosenPaNama lalu NIM) sebelum dipanggil ke sini - lihat routes/admin/mahasiswa.js
 * @returns {Promise<Buffer>} isi file .docx
 */
async function buatDokumenSkPa(info, daftarMahasiswa) {
  // require di sini (bukan di top-level file) - lihat catatan instalasi di atas.
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, VerticalMergeType, ShadingType,
    ImageRun, PageBreak
  } = require('docx');

  // ---- Helper kecil yang butuh kelas-kelas docx di atas (nested di sini
  // supaya tetap dalam scope require lazy-nya) ----
  function borderNone() {
    return {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    };
  }
  const GARIS = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const CELL_BORDER = { top: GARIS, bottom: GARIS, left: GARIS, right: GARIS };

  function teks(text, opts = {}) {
    return new TextRun({
      text,
      bold: !!opts.bold,
      italics: !!opts.italics,
      underline: opts.underline ? {} : undefined,
      size: opts.size || 22,
      font: FONT,
    });
  }

  function paragraf(text, opts = {}) {
    return new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
      indent: opts.indent ? { left: opts.indent } : undefined,
      children: [teks(text, opts)],
    });
  }

  /** Baris "Label : isi" ala format SK (kolom label, titik dua, isi) */
  function barisLabel(label, isi) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: borderNone(),
      rows: [new TableRow({
        children: [
          new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, borders: borderNone(), children: [paragraf(label)] }),
          new TableCell({ width: { size: 2, type: WidthType.PERCENTAGE }, borders: borderNone(), children: [paragraf(':')] }),
          new TableCell({ width: { size: 84, type: WidthType.PERCENTAGE }, borders: borderNone(), children: [paragraf(isi)] }),
        ],
      })],
    });
  }

  /** Paragraf lanjutan (poin b, 2, 3, dst) - diberi indentasi supaya sejajar kolom isi di atas */
  function lanjutan(text) {
    return paragraf(text, { indent: 1440 });
  }

  function headerCell(text) {
    return new TableCell({
      borders: CELL_BORDER,
      shading: { type: ShadingType.CLEAR, fill: 'D9D9D9' },
      verticalAlign: 'center',
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [teks(text, { bold: true, size: 20 })] })],
    });
  }

  function bodyCell(lines, opts = {}) {
    const arr = Array.isArray(lines) ? lines : [lines];
    return new TableCell({
      borders: CELL_BORDER,
      verticalAlign: 'center',
      verticalMerge: opts.merge,
      children: arr.length > 0
        ? arr.map(t => new Paragraph({ alignment: opts.align || AlignmentType.LEFT, children: [teks(t, { size: 20 })] }))
        : [new Paragraph({ children: [] })],
    });
  }

  // ---- Mulai susun dokumen ----
  const logoBuffer = await ambilLogo(info.logoUrl);

  const kopChildren = [];
  if (logoBuffer) {
    kopChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new ImageRun({ data: logoBuffer, type: 'png', transformation: { width: 70, height: 70 } })],
    }));
  }

  const kop = [
    ...kopChildren,
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [teks('KEPUTUSAN', { bold: true, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [teks('KETUA PROGRAM STUDI TEKNIK ELEKTRONIKA', { bold: true, size: 26 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [teks(`Nomor: ${info.nomorSk}`, { bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 0 }, children: [teks('Tentang', { size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [teks('PENETAPAN DOSEN PEMBIMBING AKADEMIK', { bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [teks(`Semester ${info.semester} Tahun Akademik ${info.tahunAjaran}`, { bold: true, size: 24 })] }),
  ];

  const isiSk = [
    barisLabel('Menimbang', `a. Bahwa dalam rangka pelaksanaan tugas pendidikan dan pembelajaran semester ${info.semester.toLowerCase()} tahun akademik ${info.tahunAjaran} pada Program Studi Teknik Elektronika Politeknik Dewantara, dipandang perlu menetapkan dosen pembimbing akademik.`),
    lanjutan('b. Bahwa sehubungan dengan hal tersebut pada poin a, perlu ditetapkan keputusannya.'),
    barisLabel('Mengingat', '1. Undang-Undang Nomor 20 Tahun 2003 tentang Sistem Pendidikan Nasional;'),
    lanjutan('2. Undang-Undang Nomor 12 Tahun 2012 tentang Pendidikan Tinggi;'),
    lanjutan('3. Peraturan Menteri Pendidikan dan Kebudayaan Nomor 3 Tahun 2020 tentang Standar Nasional Pendidikan Tinggi;'),
    lanjutan('4. Peraturan Akademik Politeknik Dewantara.'),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [teks('MEMUTUSKAN', { bold: true, size: 24 })] }),
    barisLabel('Menetapkan', ''),
    barisLabel('Pertama', `Mengangkat saudara sebagai dosen pembimbing akademik mahasiswa Program Studi Teknik Elektronika TA ${info.tahunAjaran} sebagaimana tercantum pada lampiran keputusan ini.`),
    barisLabel('Kedua', 'Kepada saudara diberi tugas dan tanggung jawab: (1) melaksanakan tugas membimbing; (2) melakukan evaluasi proses dan hasil belajar mahasiswa.'),
    barisLabel('Ketiga', 'Melaksanakan pembimbingan dengan ketentuan membimbing mahasiswa untuk membuat KRS dengan pertimbangan jumlah SKS yang bisa diprogram maksimal 20 SKS.'),
    barisLabel('Keempat', 'Keputusan ini berlaku sejak tanggal ditetapkan dan apabila terdapat kekeliruan di dalamnya, akan diadakan perbaikan sebagaimana mestinya.'),
  ];

  const ttdBlok = [
    new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.RIGHT, children: [teks(`Ditetapkan di : ${info.kota}`)] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [teks(`Pada Tanggal : ${info.tanggal}`)] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [teks('Ketua Program Studi,')] }),
    new Paragraph({ spacing: { before: 800 }, alignment: AlignmentType.RIGHT, children: [teks(info.namaKaprodi, { bold: true, underline: true })] }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [teks(`NUPTK/NIDN. ${info.nidnKaprodi}`)] }),
  ];

  // ---- Lampiran: tabel dengan sel Dosen PA menyatu per kelompok ----
  const headerRow = new TableRow({
    tableHeader: true,
    children: [headerCell('No'), headerCell('NIM'), headerCell('Nama Mahasiswa'), headerCell('Dosen Pembimbing Akademik')],
  });

  const rows = [headerRow];
  daftarMahasiswa.forEach((m, i) => {
    const sebelum = daftarMahasiswa[i - 1];
    const sesudah = daftarMahasiswa[i + 1];
    const awalKelompok = !sebelum || sebelum.dosenPaNama !== m.dosenPaNama;
    const akhirKelompok = !sesudah || sesudah.dosenPaNama !== m.dosenPaNama;

    let mergeType;
    if (!awalKelompok) mergeType = VerticalMergeType.CONTINUE;
    else if (!akhirKelompok) mergeType = VerticalMergeType.RESTART;

    rows.push(new TableRow({
      children: [
        bodyCell(String(i + 1), { align: AlignmentType.CENTER }),
        bodyCell(m.nim, { align: AlignmentType.CENTER }),
        bodyCell(m.nama),
        bodyCell(awalKelompok ? [m.dosenPaNama, m.dosenPaNidn ? `NIDN. ${m.dosenPaNidn}` : ''] : [], { merge: mergeType }),
      ],
    }));
  });

  const tabelLampiran = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [700, 1800, 4500, 3500],
    rows,
  });

  const lampiran = [
    new Paragraph({
      spacing: { after: 100 },
      children: [teks(`Lampiran Surat Keputusan Ketua Program Studi Teknik Elektronika Nomor ${info.nomorSk} tentang Penetapan Dosen Pembimbing Akademik Semester ${info.semester} Tahun Akademik ${info.tahunAjaran}.`, { italics: true, size: 20 })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 0 }, children: [teks('DAFTAR DOSEN PEMBIMBING AKADEMIK', { bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [teks('PROGRAM STUDI TEKNIK ELEKTRONIKA', { bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [teks(`SEMESTER ${info.semester.toUpperCase()}`, { bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [teks(`TAHUN AKADEMIK ${info.tahunAjaran}`, { bold: true, size: 24 })] }),
    tabelLampiran,
  ];

  const doc = new Document({
    sections: [{
      properties: { page: { size: { width: 11907, height: 16840 } } }, // A4
      children: [
        ...kop,
        ...isiSk,
        ...ttdBlok,
        new Paragraph({ children: [new PageBreak()] }),
        ...lampiran,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buatDokumenSkPa };
