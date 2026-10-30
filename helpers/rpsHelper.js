/**
 * helpers/rpsHelper.js
 *
 * Tab "RPS" pada workspace MK dosen (routes/dosen/mk.js, views/dosen/mk_rps*.ejs).
 *
 * Alur data:
 *   1. buildDefaultRps()  -> isi awal RPS dari data resmi yang sudah ada di web
 *      (data/rencanaPertemuanData.js: topik, kemampuan akhir, metode, bobot
 *      16 pertemuan) + data MK (kode, nama, sks, semester) + dosen pengampu.
 *   2. Dosen mengubah isian di form -> parseRpsForm() -> disimpan di Firestore
 *      mataKuliah/{mkId}/rps/utama.
 *   3. mergeRps(default, tersimpan) -> yang dipakai tampilan form & cetak.
 *      Field yang belum pernah disimpan otomatis memakai default.
 */

const { getRencanaPertemuan } = require('../data/rencanaPertemuanData');

// Identitas Kaprodi: SAMA dengan yang dipakai surat-surat lain di web ini
// (routes/admin/sk.js -> KAPRODI, routes/admin/surat.js -> penandatangan,
// gambar tanda tangan /images/ttd.png). Kalau Kaprodi berganti, ubah di sini
// bersama file-file tersebut.
const KAPRODI = {
  nama: 'Fajar Ramadhan, S.Pd., M.T',
  nuptk: '8559777678130153',
  jabatan: 'Ketua Program Studi Teknik Elektronika',
  ttdUrl: '/images/ttd.png'
};

const PRODI = 'TEKNIK ELEKTRONIKA';
const INSTITUSI = 'POLITEKNIK DEWANTARA';
const KOTA = 'Palopo';

// Tabel konversi nilai - baku institusi (sama dengan format RPS)
const NILAI_RENTANG = [
  { nilai: 'A',  skor: '4,0', rentang: '86,0 – 100',  kategori: 'Istimewa' },
  { nilai: 'B+', skor: '3,5', rentang: '76,0 – 85,9', kategori: 'Sangat baik' },
  { nilai: 'B',  skor: '3,0', rentang: '60,0 – 75,9', kategori: 'Baik' },
  { nilai: 'C+', skor: '2,5', rentang: '50,0 –59,9',  kategori: 'Cukup Baik' },
  { nilai: 'C',  skor: '2,0', rentang: '25,0 – 49,9', kategori: 'Cukup' },
  { nilai: 'D',  skor: '1,0', rentang: '10,0– 24,9',  kategori: 'Kurang' },
  { nilai: 'E',  skor: '0,0', rentang: '0,0-9,9',     kategori: 'Sangat Kurang' }
];

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
  'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** '2026-03-15' -> '15 Maret 2026' (tanpa pengaruh zona waktu) */
function formatTanggalId(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str || ''));
  if (!m) return '';
  return `${parseInt(m[3], 10)} ${BULAN[parseInt(m[2], 10) - 1] || ''} ${m[1]}`;
}

function hariIniISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function rumpunDefault(mk) {
  if (mk.rumpun) return mk.rumpun;
  const kode = String(mk.kode || '').toUpperCase();
  if (kode.startsWith('WUD')) return 'Mata Kuliah Umum';
  return 'Mata Kuliah Inti';
}

function huruf1Kecil(s) {
  s = String(s || '').trim();
  // jangan ubah singkatan/nama (mis. "SPSS", "Excel" bukan di awal kalimat ini)
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * Isi awal RPS untuk satu MK.
 * @param {object} mk            dokumen mataKuliah ({id, kode, nama, sks, semester, ...})
 * @param {string[]} namaDosen   nama semua dosen pengampu
 * @param {object} dosenLogin    req.dosen (untuk nama & NUPTK penanda tangan "Dibuat Oleh")
 */
function buildDefaultRps(mk, namaDosen, dosenLogin) {
  const rencana = getRencanaPertemuan(mk.kode) || [];
  const sks = parseInt(mk.sks, 10) || 3;

  const pertemuan = [];
  for (let i = 1; i <= 16; i++) {
    const r = rencana.find(x => x.pertemuan === i);
    const ujian = r && r.jenis === 'ujian';
    let subCpmk = '', materi = '', metode = '', indikator = '', bobot = '';
    if (r && ujian) {
      subCpmk = i === 8 ? 'UJIAN TENGAH SEMESTER' : 'UJIAN AKHIR SEMESTER';
      materi = r.kemampuan || '';
      metode = 'Ujian';
      bobot = '-';
    } else if (r) {
      subCpmk = `Sub-CPMK${i}: ${r.kemampuan}`;
      materi = r.topik;
      metode = r.metode || '';
      indikator = r.kemampuan ? `Ketepatan dalam ${huruf1Kecil(r.kemampuan)}` : '';
      bobot = r.bobot != null ? `${r.bobot}%` : '';
    } else if (i === 8 || i === 16) {
      subCpmk = i === 8 ? 'UJIAN TENGAH SEMESTER' : 'UJIAN AKHIR SEMESTER';
      metode = 'Ujian';
      bobot = '-';
    }
    pertemuan.push({
      ke: i,
      subCpmk,
      materi,
      metode,
      waktu: (i === 8 || i === 16) ? '2' : String(sks),
      indikator,
      bobot
    });
  }

  // Pokok bahasan = topik unik sesuai urutan RPS (tanpa penanda "bagian x/y")
  const pokok = [];
  rencana.forEach(r => {
    if (r.jenis === 'ujian') return;
    const t = r.topikRps || r.topik;
    if (t && !pokok.includes(t)) pokok.push(t);
  });

  const deskripsi = pokok.length
    ? `Mata kuliah ${mk.nama} (${mk.kode}) bobot ${sks} SKS ini membahas: ${pokok.join('; ')}.`
    : '';

  const pengembang = (namaDosen && namaDosen.length ? namaDosen : [dosenLogin && dosenLogin.nama]).filter(Boolean).join(', ');

  return {
    tglPenyusunan: hariIniISO(),
    rumpun: rumpunDefault(mk),
    dosenPengembang: pengembang,
    koordinator: KAPRODI.nama,
    cpl: [],
    cpmk: [],
    deskripsi,
    materi: pokok,
    referensi: [],
    media: ['Komputer/Laboratorium komputer', 'LCD Projector', 'Papan Tulis', 'LMS (Learning Management System)'],
    teamTeaching: '',
    assesmen: 'Penilaian sikap dan kehadiran, tugas, UTS, dan UAS sesuai aspek penilaian',
    pertemuan,
    aspek: [
      { label: 'Sikap, Kehadiran, dan Keaktifan', nilai: '20' },
      { label: 'Ujian Tengah Semester (UTS)', nilai: '25' },
      { label: 'Ujian Akhir Semester (UAS)', nilai: '35' },
      { label: 'Ujian Harian dan Tugas-tugas', nilai: '20' }
    ],
    tglTtd: hariIniISO(),
    koordinatorNama: KAPRODI.nama,
    koordinatorNuptk: KAPRODI.nuptk,
    dosenNama: (dosenLogin && dosenLogin.nama) || pengembang,
    dosenNuptk: (dosenLogin && (dosenLogin.nuptk || dosenLogin.NUPTK || dosenLogin.nidn || dosenLogin.NIDN)) || ''
  };
}

/** Gabungkan default dengan isian tersimpan (yang tersimpan menang). */
function mergeRps(def, saved) {
  if (!saved) return { ...def };
  const out = { ...def };
  Object.keys(def).forEach(k => {
    if (saved[k] === undefined || saved[k] === null) return;
    if (k === 'pertemuan' || k === 'aspek') return;
    out[k] = saved[k];
  });
  out.pertemuan = def.pertemuan.map((d, i) => {
    const s = Array.isArray(saved.pertemuan) ? saved.pertemuan.find(x => x && x.ke === d.ke) || saved.pertemuan[i] : null;
    return s ? { ...d, ...s, ke: d.ke } : d;
  });
  out.aspek = Array.isArray(saved.aspek) && saved.aspek.length ? saved.aspek : def.aspek;
  return out;
}

// ---------------------------------------------------------------------------
// Pengolah isian form
// ---------------------------------------------------------------------------
const teks = (v, max = 3000) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
const satuBaris = (v, max = 300) => teks(v, max).replace(/\s*\n\s*/g, ' ');

/** textarea -> array baris; tanda nomor/bullet yang diketik dosen dibuang (nomor dibuat otomatis saat cetak) */
function barisKeArray(v, { hapusPenanda = false } = {}) {
  return teks(v, 20000).split('\n')
    .map(s => s.trim())
    .map(s => hapusPenanda ? s.replace(/^(\d+[.)]|[-•*])\s+/, '') : s)
    .filter(Boolean)
    .slice(0, 60)
    .map(s => s.slice(0, 1500));
}

const tglValid = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : '');

function parseRpsForm(b) {
  const pertemuan = [];
  for (let i = 1; i <= 16; i++) {
    pertemuan.push({
      ke: i,
      subCpmk: teks(b[`p${i}_subCpmk`], 800),
      materi: teks(b[`p${i}_materi`], 1500),
      metode: teks(b[`p${i}_metode`], 400),
      waktu: satuBaris(b[`p${i}_waktu`], 20),
      indikator: teks(b[`p${i}_indikator`], 1000),
      bobot: satuBaris(b[`p${i}_bobot`], 20)
    });
  }
  const aspek = [];
  for (let i = 0; i < 4; i++) {
    aspek.push({ label: satuBaris(b[`aspek_label_${i}`], 120), nilai: satuBaris(b[`aspek_nilai_${i}`], 10) });
  }
  return {
    tglPenyusunan: tglValid(b.tglPenyusunan),
    rumpun: satuBaris(b.rumpun, 100),
    dosenPengembang: satuBaris(b.dosenPengembang, 300),
    koordinator: satuBaris(b.koordinator, 200),
    cpl: barisKeArray(b.cpl),
    cpmk: barisKeArray(b.cpmk),
    deskripsi: teks(b.deskripsi, 5000),
    materi: barisKeArray(b.materi, { hapusPenanda: true }),
    referensi: barisKeArray(b.referensi, { hapusPenanda: true }),
    media: barisKeArray(b.media, { hapusPenanda: true }),
    teamTeaching: teks(b.teamTeaching, 1000),
    assesmen: teks(b.assesmen, 1500),
    pertemuan,
    aspek,
    tglTtd: tglValid(b.tglTtd),
    koordinatorNama: satuBaris(b.koordinatorNama, 200),
    koordinatorNuptk: satuBaris(b.koordinatorNuptk, 60),
    dosenNama: satuBaris(b.dosenNama, 200),
    dosenNuptk: satuBaris(b.dosenNuptk, 60)
  };
}

module.exports = {
  KAPRODI, PRODI, INSTITUSI, KOTA, NILAI_RENTANG,
  formatTanggalId, buildDefaultRps, mergeRps, parseRpsForm
};
