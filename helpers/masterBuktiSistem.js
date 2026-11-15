// helpers/masterBuktiSistem.js
//
// Menyambungkan item Master Dokumen Prodi ke DATA YANG SUDAH ADA di web (EDOM, dosen, mahasiswa, alat lab,
// magang, penelitian, tracer, dst). Hasilnya: status awal otomatis + jumlah data + tautan ke modulnya.
//
// Aturan:
//  - Hanya MENGISI status awal bila item masih "Belum Ada" (pilihan manual admin selalu menang).
//  - Adanya data di sistem dihitung "Ada" paling tinggi, TIDAK PERNAH "Disahkan" (pengesahan butuh SK/bukti).
//  - Data yang kelengkapannya perlu dicek (mis. biodata dosen) diberi status "Draft".
//  - Jumlah dihitung dengan count() agregat (murah) dan di-cache 5 menit.
//  - Item tanpa data (jumlah 0) tidak diubah.

const { db } = require('../config/firebaseAdmin');

const TTL = 5 * 60 * 1000;
const cache = new Map();
async function cached(key, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < TTL) return c.v;
  let v = null;
  try { v = await fn(); } catch (e) { console.error(`Bukti sistem "${key}" gagal dihitung:`, e.message); }
  cache.set(key, { t: Date.now(), v });
  return v;
}
const cnt = async q => (await q.count().get()).data().count;
const col = n => db.collection(n);

const sumberDosen = () => cached('dosen', () => cnt(col('dosen')));
const sumberMhs = () => cached('mahasiswa', () => cnt(col('users').where('role', '==', 'mahasiswa')));
const sumberAlat = () => cached('alatLab', async () => (await col('alatLab').get()).docs.filter(d => d.data().aktif !== false).length);
const sumberSk = kat => cached('sk:' + kat, () => cnt(col('sk_dosen').where('kategori', '==', kat)));
const sumberPerusahaan = () => cached('perusahaan', async () => {
  const snap = await col('magangPeriod').select('perusahaan').get();
  return new Set(snap.docs.map(d => ((d.data().perusahaan || {}).nama || '').trim().toLowerCase()).filter(Boolean)).size;
});
const sumberRps = () => cached('rps', async () => {
  const kur = require('../data/kurikulum/kurikulum2024');
  const mk = await col('mataKuliah').get();
  const ids = {};
  mk.docs.forEach(d => { const k = String(d.data().kode || '').trim().toLowerCase(); if (k) (ids[k] = ids[k] || []).push(d.id); });
  const kodeRps = k => (k === 'WUD2201-5' ? ['WUD2201', 'WUD2202', 'WUD2203', 'WUD2204', 'WUD2205'] : [k]);
  let ada = 0;
  for (const m of kur.MK) {
    const refs = kodeRps(m.kode).flatMap(k => ids[k.toLowerCase()] || []).map(id => col('mataKuliah').doc(id).collection('rps').doc('utama'));
    if (!refs.length) continue;
    const docs = await db.getAll(...refs);
    if (docs.some(d => d.exists)) ada++;
  }
  return { ada, total: kur.MK.length };
});
const sumberAlumni = () => cached('alumni', async () => ({ lulusan: await cnt(col('lulusan')), tracer: await cnt(col('tracerStudy')) }));

// Tiap aturan: nama item (persis di Master Dokumen), sumber, fungsi hitung -> angka atau objek, status, teks, tautan.
const ATURAN = [
  { nama: 'Hasil evaluasi dosen oleh mahasiswa (EDOM)', hitung: () => cached('edom', () => cnt(col('edom_respon'))), status: 'ada', teks: n => `${n} respon EDOM tersimpan`, href: '/admin/edom', hrefDosen: '/dosen/edom' },
  { nama: 'Rekapitulasi seluruh dosen (data induk)', hitung: sumberDosen, status: 'ada', teks: n => `${n} dosen terdata`, href: '/admin/dosen' },
  { nama: 'Biodata dosen dan riwayat pendidikan', hitung: sumberDosen, status: 'draft', teks: n => `${n} dosen terdata; kelengkapan biodata perlu dicek`, href: '/admin/dosen' },
  { nama: 'Daftar dosen beserta bidang keahlian', hitung: sumberDosen, status: 'draft', teks: n => `${n} dosen terdata; bidang keahlian perlu dicek`, href: '/admin/dosen' },
  { nama: 'Sertifikat pelatihan dan pengembangan kompetensi', hitung: () => cached('sertifikat', () => cnt(col('sertifikatDosen'))), status: 'draft', teks: n => `${n} sertifikat dosen tersimpan`, href: '/admin/sertifikat', hrefDosen: '/dosen/sertifikat' },
  { nama: 'SK pembagian tugas mengajar', hitung: () => sumberSk('mengajar'), status: 'ada', teks: n => `${n} SK Mengajar sudah dirilis ke dosen`, href: '/admin/sk' },
  { nama: 'SK pembimbing akademik (PA)', hitung: () => sumberSk('pa'), status: 'ada', teks: n => `${n} SK PA sudah dirilis ke dosen`, href: '/admin/sk' },
  { nama: 'SK pembimbing dan penguji magang', hitung: () => sumberSk('pembimbing_magang'), status: 'ada', teks: n => `${n} SK Pembimbing Magang sudah dirilis`, href: '/admin/sk' },
  { nama: 'Data induk mahasiswa', hitung: sumberMhs, status: 'ada', teks: n => `${n} mahasiswa terdata`, href: '/admin/mahasiswa' },
  { nama: 'Data mahasiswa per angkatan', hitung: sumberMhs, status: 'ada', teks: n => `${n} mahasiswa terdata (dapat dikelompokkan per angkatan)`, href: '/admin/mahasiswa' },
  { nama: 'Logbook kegiatan harian', hitung: () => cached('logbook', () => cnt(col('logbookMagang'))), status: 'ada', teks: n => `${n} entri logbook magang`, href: '/admin/emagang' },
  { nama: 'Daftar perusahaan mitra magang', hitung: sumberPerusahaan, status: 'ada', teks: n => `${n} perusahaan pernah menerima mahasiswa magang`, href: '/admin/perusahaan' },
  { nama: 'Daftar mitra industri', hitung: sumberPerusahaan, status: 'draft', teks: n => `${n} perusahaan mitra magang (status kerja sama/MoU perlu dicek)`, href: '/admin/perusahaan' },
  { nama: 'Rekapitulasi mahasiswa yang telah menyelesaikan magang', hitung: () => cached('laporanMagang', () => cnt(col('laporanMagang'))), status: 'draft', teks: n => `${n} laporan magang tercatat`, href: '/admin/laporan-magang' },
  { nama: 'Daftar inventaris alat laboratorium', hitung: sumberAlat, status: 'ada', teks: n => `${n} alat aktif terdata`, href: '/admin/alat-lab' },
  { nama: 'Daftar kondisi alat', hitung: sumberAlat, status: 'ada', teks: n => `${n} alat aktif terdata (jumlah baik/rusak tercatat)`, href: '/admin/alat-lab' },
  { nama: 'Formulir peminjaman alat', hitung: () => cached('peminjaman', () => cnt(col('peminjamanAlat'))), status: 'ada', teks: n => `${n} peminjaman alat tercatat`, href: '/admin/peminjaman-alat' },
  { nama: 'Daftar penelitian dosen', hitung: () => cached('penelitian', () => cnt(col('penelitian'))), status: 'ada', teks: n => `${n} penelitian tercatat`, hrefDosen: '/dosen/penelitian' },
  { nama: 'Daftar pengabdian kepada masyarakat', hitung: () => cached('pengabdian', () => cnt(col('pengabdian'))), status: 'ada', teks: n => `${n} pengabdian tercatat`, hrefDosen: '/dosen/pengabdian' },
  { nama: 'Dokumentasi kunjungan industri', hitung: () => cached('kunjungan', () => cnt(col('kunjunganIndustri'))), status: 'draft', teks: n => `${n} kunjungan industri tercatat (dokumentasi kegiatan perlu dilampirkan)`, href: '/admin/kunjungan-industri' },
  { nama: 'Kalender akademik prodi', hitung: () => cached('jadwalPenting', () => cnt(col('jadwalPenting'))), status: 'draft', teks: n => `${n} agenda di Jadwal Penting`, href: '/admin/jadwalpenting' },
  { nama: 'Database alumni per angkatan', hitung: sumberAlumni, ukuran: a => a.lulusan + a.tracer, status: 'ada', teks: a => `${a.lulusan} data lulusan + ${a.tracer} isian tracer`, href: '/admin/tracklulusan' },
  { nama: 'Nomor kontak dan pekerjaan alumni', hitung: sumberAlumni, ukuran: a => a.lulusan + a.tracer, status: 'draft', teks: a => `${a.lulusan} data lulusan + ${a.tracer} isian tracer; kelengkapan kontak perlu dicek`, href: '/admin/tracklulusan' },
  { nama: 'Laporan tracer study', hitung: sumberAlumni, ukuran: a => a.tracer, status: 'draft', teks: a => `${a.tracer} isian tracer tersimpan; laporan rekapnya belum disusun`, href: '/admin/tracklulusan' },
  { nama: 'RPS seluruh mata kuliah', hitung: sumberRps, ukuran: r => r.ada, statusFn: r => (r.ada >= r.total ? 'ada' : 'draft'), teks: r => `RPS tersimpan untuk ${r.ada} dari ${r.total} mata kuliah kurikulum`, href: '/admin/rps' }
];
const PER_NAMA = Object.fromEntries(ATURAN.map(a => [a.nama, a]));

/** Peta nama item Master -> { status, teks, href, hrefDosen }. Kosong bila datanya tidak ada/gagal dibaca. */
async function infoBuktiSistem() {
  const unik = [...new Set(ATURAN.map(a => a.hitung))];
  await Promise.all(unik.map(f => f())); // isi cache paralel
  const out = {};
  for (const a of ATURAN) {
    const v = await a.hitung();
    if (v == null) continue;
    const n = a.ukuran ? a.ukuran(v) : v;
    if (!n) continue;
    out[a.nama] = { status: a.statusFn ? a.statusFn(v) : a.status, teks: a.teks(v), href: a.href || '', hrefDosen: a.hrefDosen || '' };
  }
  return out;
}

module.exports = { ATURAN, PER_NAMA, infoBuktiSistem };
