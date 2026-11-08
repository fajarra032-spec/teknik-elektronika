/**
 * routes/pratinjau.js
 * Halaman PRATINJAU dokumen bersama (semua role, termasuk publik).
 *
 *   GET /pratinjau?u=<url berkas>&t=<judul>&k=<url kembali>
 *
 * Semua tombol "Lihat / Buka / Cetak / Unduh PDF" untuk berkas yang tersimpan di
 * Google Drive (surat, SK, laporan, KRS, sertifikat, modul, dll.) diarahkan ke sini
 * supaya pengguna MELIHAT dulu dokumennya, lalu memilih sendiri: Unduh, Cetak,
 * atau Buka di tab baru - tidak lagi langsung terunduh / berpindah ke Drive.
 *
 * Keamanan: halaman ini TIDAK memberi akses baru. Hanya ID berkas Drive yang
 * valid (ditampilkan lewat penampil resmi Drive, tunduk pada izin berkas itu
 * sendiri) atau berkas milik situs sendiri (/uploads, /dokumen) yang diterima;
 * alamat lain tidak pernah di-redirect otomatis.
 */
const express = require('express');
const router = express.Router();

const ID_DRIVE = /^[A-Za-z0-9_-]{10,120}$/;
const EKSTENSI_LOKAL = /\.(pdf|png|jpe?g|gif|webp)$/i;

/** Ambil ID berkas dari berbagai bentuk tautan Drive (/file/d/ID, ?id=ID, open?id=ID). */
function ambilIdDrive(url) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  if (!/^(drive|docs)\.google\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/\/d\/([A-Za-z0-9_-]+)/);
  const id = (m && m[1]) || u.searchParams.get('id');
  return id && ID_DRIVE.test(id) ? id : null;
}

/** Hanya berkas statis milik situs: /uploads/... atau /dokumen/... dengan ekstensi aman. */
function berkasLokalAman(path) {
  if (typeof path !== 'string' || path.length > 300) return false;
  if (!/^\/(uploads|dokumen)\//.test(path) || path.includes('..') || path.includes('\\') || path.includes('//')) return false;
  return EKSTENSI_LOKAL.test(path.split('?')[0].split('#')[0]);
}

/** Tujuan "Kembali" hanya boleh alamat internal. */
function kembaliAman(k) {
  return typeof k === 'string' && /^\/(?!\/)/.test(k) ? k : '';
}

router.get('/', (req, res) => {
  const u = String(req.query.u || '').trim();
  const judul = String(req.query.t || '').trim().slice(0, 140) || 'Pratinjau Dokumen';
  const urlKembali = kembaliAman(req.query.k);

  const idDrive = ambilIdDrive(u);
  let data;
  if (idDrive) {
    data = {
      jenis: 'drive',
      src: `https://drive.google.com/file/d/${idDrive}/preview`,
      urlUnduh: `https://drive.google.com/uc?export=download&id=${idDrive}`,
      urlTabBaru: `https://drive.google.com/file/d/${idDrive}/view`
    };
  } else if (berkasLokalAman(u)) {
    data = { jenis: 'lokal', src: u, urlUnduh: u, urlTabBaru: u };
  } else {
    data = { jenis: 'tidak-didukung', src: '', urlUnduh: '', urlTabBaru: '' };
  }

  res.set('Cache-Control', 'no-store');
  res.status(data.jenis === 'tidak-didukung' ? 400 : 200).render('pratinjau', {
    title: judul,
    judul,
    urlKembali,
    urlAsli: data.jenis === 'tidak-didukung' && /^https?:\/\//i.test(u) ? u : '',
    ...data
  });
});

/** Helper untuk rute lain: bangun URL pratinjau dari tautan berkas. */
function urlPratinjau(fileUrl, judul, kembali) {
  const p = new URLSearchParams({ u: fileUrl });
  if (judul) p.set('t', judul);
  if (kembali) p.set('k', kembali);
  return `/pratinjau?${p.toString()}`;
}

module.exports = router;
module.exports.urlPratinjau = urlPratinjau;
