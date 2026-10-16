/**
 * routes/admin/bimbingan.js
 * Admin: Daftar Pembimbing Magang (read-only).
 *
 * REVISI: Pembimbing 1 & 2 DITIADAKAN. Hanya ada SATU pembimbing magang, yaitu
 * Dosen Pembimbing Akademik (PA) mahasiswa (users.dosenPaId). Karena itu
 * halaman ini TIDAK lagi dipakai untuk menetapkan pembimbing - penetapan
 * dilakukan di menu Mahasiswa (Edit Mahasiswa / "Tetapkan Dosen PA" massal /
 * script assign-dosen-pa-*). Halaman ini hanya menampilkan siapa pembimbing
 * (Dosen PA) tiap mahasiswa aktif, dan mana yang BELUM punya Dosen PA (belum
 * bisa mengisi logbook/laporan magang).
 *
 * Koleksi `bimbingan` lama tidak lagi dibaca/ditulis (data dibiarkan untuk arsip).
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const skDistribusi = require('../../helpers/skDistribusiHelper');
const { getCurrentAcademicSemester } = require('../../helpers/academicHelper');

router.use(verifyToken);
router.use(isAdmin);

router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .get();

    const semua = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(m => !m.statusMahasiswa || m.statusMahasiswa === 'Aktif')
      .sort((a, b) => String(a.nim || '').localeCompare(String(b.nim || '')));

    const mahasiswaList = semua.map(m => ({
      id: m.id,
      nim: m.nim || '-',
      nama: m.nama || '-',
      kelas: m.kelas || '-',
      semester: m.semester || '-',
      dosenPaId: m.dosenPaId || null,
      dosenPaNama: m.dosenPaNama || null
    }));

    const belumPa = mahasiswaList.filter(m => !m.dosenPaId).length;

    res.render('admin/bimbingan/index', {
      title: 'Pembimbing Magang (Dosen PA)',
      mahasiswaList,
      totalMahasiswa: mahasiswaList.length,
      totalBelumPa: belumPa,
      search: req.query.search || ''
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat daftar pembimbing magang'
    });
  }
});

// ============================================================================
// CETAK SK PEMBIMBING AKADEMIK (Dosen PA)
// Admin cukup mengisi NOMOR SK, mencentang mahasiswa yang ikut, lalu cetak.
// Kop surat & TTD Kaprodi sama dengan transkrip/KHS (partials/kop_surat +
// /images/ttd.png). Hanya mahasiswa Aktif yang sudah punya Dosen PA.
// ============================================================================

// Penandatangan: sama dengan yang dipakai di transkrip (views/mahasiswa/transkrip_print.ejs)
const KAPRODI = { nama: 'Fajar Ramadhan, S.Pd., M.T.', nuptk: '8559777678130153' };
const KOTA_DEFAULT = 'Palopo';

const angkatanDariNim = (nim) => (nim && String(nim).length >= 2 ? '20' + String(nim).substring(0, 2) : '');

/** Ambil mahasiswa Aktif ber-Dosen PA + identitas dosen terbaru (NIDN/NUPTK) dari koleksi dosen. */
async function ambilDataSk() {
  const [mhsSnap, dosenSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'mahasiswa').get(),
    db.collection('dosen').get()
  ]);

  const dosenMap = {};
  dosenSnap.docs.forEach(d => { dosenMap[d.id] = d.data(); });

  const identitas = (dosenId, fallbackNidn) => {
    const d = dosenMap[dosenId] || {};
    if (d.nidn) return `NIDN. ${d.nidn}`;
    const nuptk = d.nuptk || d.nip;
    if (nuptk) return `NUPTK. ${nuptk}`;
    return fallbackNidn ? `NIDN. ${fallbackNidn}` : '';
  };

  const semua = mhsSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(m => !m.statusMahasiswa || m.statusMahasiswa === 'Aktif');

  const punyaPa = semua
    .filter(m => m.dosenPaId)
    .map(m => ({
      id: m.id,
      nim: m.nim || '-',
      nama: m.nama || '-',
      angkatan: angkatanDariNim(m.nim),
      dosenPaId: m.dosenPaId,
      dosenPaNama: (dosenMap[m.dosenPaId] && dosenMap[m.dosenPaId].nama) || m.dosenPaNama || '-',
      dosenPaIdentitas: identitas(m.dosenPaId, m.dosenPaNidn)
    }))
    .sort((a, b) => String(a.nim).localeCompare(String(b.nim)));

  return { punyaPa, belumPa: semua.length - punyaPa.length };
}

router.get('/sk', async (req, res) => {
  try {
    const { punyaPa, belumPa } = await ambilDataSk();
    const academic = getCurrentAcademicSemester();
    const dosenList = Array.from(new Map(punyaPa.map(m => [m.dosenPaId, m.dosenPaNama])).entries())
      .map(([id, nama]) => ({ id, nama }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    const angkatanList = Array.from(new Set(punyaPa.map(m => m.angkatan).filter(Boolean))).sort().reverse();

    res.render('admin/bimbingan/sk_pilih', {
      title: 'Cetak SK Pembimbing',
      mahasiswaList: punyaPa,
      dosenList,
      angkatanList,
      jumlahBelumPa: belumPa,
      semesterDefault: academic.semester || 'Ganjil',
      tahunAjaranDefault: academic.tahunAkademik || '',
      kotaDefault: KOTA_DEFAULT
    });
  } catch (error) {
    console.error('Error memuat halaman cetak SK pembimbing:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat halaman Cetak SK Pembimbing' });
  }
});

// Batas isi per halaman lampiran (satuan "baris"; grup 1 mahasiswa = 2 baris karena sel dosen 2 baris)
const KAPASITAS_HAL_PERTAMA = 35;
const KAPASITAS_HAL_LAIN = 44;
const RUANG_TTD = 10;

/** Bagi baris lampiran ke beberapa halaman, tiap halaman punya rowspan sel Dosen PA sendiri. */
function bagiHalaman(rows) {
  // 1) kelompokkan baris berurutan yang dosennya sama
  const grup = [];
  rows.forEach((r, i) => {
    const last = grup[grup.length - 1];
    if (last && last.dosenPaId === r.dosenPaId) last.baris.push({ ...r, no: i + 1 });
    else grup.push({ dosenPaId: r.dosenPaId, nama: r.dosenPaNama, identitas: r.dosenPaIdentitas, baris: [{ ...r, no: i + 1 }] });
  });

  // 2) isi halaman; grup yang kepanjangan dipotong di batas halaman (sel dosen diulang)
  const halaman = [];
  let cur = []; let kapasitas = KAPASITAS_HAL_PERTAMA; let terpakai = 0;
  const tutup = () => { halaman.push(cur); cur = []; kapasitas = KAPASITAS_HAL_LAIN; terpakai = 0; };

  grup.forEach(g => {
    let sisa = g.baris.slice();
    while (sisa.length) {
      const biaya = (n) => Math.max(n, 2); // sel dosen butuh min. 2 baris (nama + NIDN)
      const muat = kapasitas - terpakai;
      if (muat < 2) { tutup(); continue; }
      const ambil = Math.min(sisa.length, muat);
      if (biaya(ambil) > muat) { tutup(); continue; }
      cur.push({ nama: g.nama, identitas: g.identitas, baris: sisa.slice(0, ambil) });
      terpakai += biaya(ambil);
      sisa = sisa.slice(ambil);
      if (sisa.length) tutup();
    }
  });
  if (cur.length) halaman.push(cur);

  const terakhir = halaman.length ? halaman[halaman.length - 1] : [];
  const unitTerakhir = terakhir.reduce((n, g) => n + Math.max(g.baris.length, 2), 0);
  const kapTerakhir = halaman.length === 1 ? KAPASITAS_HAL_PERTAMA : KAPASITAS_HAL_LAIN;
  const ttdHalamanBaru = unitTerakhir > kapTerakhir - RUANG_TTD;
  return { halaman, ttdHalamanBaru };
}

/**
 * Validasi isian + susun data SK (dipakai oleh Cetak maupun Rilis & Kirim).
 * @returns {Promise<{error?: string, data?: object}>}
 */
async function siapkanSk(body) {
  const nomorSk = String(body.nomorSk || '').trim();
  if (!nomorSk) return { error: 'Nomor SK wajib diisi.' };

  let ids = body.mahasiswaId || [];
  if (!Array.isArray(ids)) ids = [ids];
  const pilih = new Set(ids);
  if (pilih.size === 0) return { error: 'Centang minimal satu mahasiswa.' };

  const academic = getCurrentAcademicSemester();
  const semester = ['Ganjil', 'Genap'].includes(body.semester) ? body.semester : (academic.semester || 'Ganjil');
  const tahunAjaran = String(body.tahunAjaran || '').trim() || academic.tahunAkademik || '';
  const kota = String(body.kota || '').trim() || KOTA_DEFAULT;
  const tgl = body.tanggal ? new Date(body.tanggal) : new Date();
  const tanggal = (isNaN(tgl) ? new Date() : tgl)
    .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const { punyaPa } = await ambilDataSk();
  let rows = punyaPa.filter(m => pilih.has(m.id));
  if (rows.length === 0) return { error: 'Mahasiswa terpilih tidak ditemukan (harus Aktif dan punya Dosen PA).' };

  const cmpNim = (a, b) => String(a.nim).localeCompare(String(b.nim));
  if (body.urutan === 'dosen') {
    rows = rows.sort((a, b) => a.dosenPaNama.localeCompare(b.dosenPaNama) || cmpNim(a, b));
  } else if (body.urutan === 'nim') {
    rows = rows.sort(cmpNim);
  } else {
    // Bawaan (seperti SK sebelumnya): per angkatan, lalu per blok Dosen PA
    // (blok diurutkan dari NIM terkecil di angkatan itu), lalu NIM.
    const minNim = {};
    rows.forEach(m => {
      const k = m.angkatan + '|' + m.dosenPaId;
      if (!minNim[k] || String(m.nim) < minNim[k]) minNim[k] = String(m.nim);
    });
    rows = rows.sort((a, b) =>
      String(a.angkatan).localeCompare(String(b.angkatan)) ||
      minNim[a.angkatan + '|' + a.dosenPaId].localeCompare(minNim[b.angkatan + '|' + b.dosenPaId]) ||
      a.dosenPaId.localeCompare(b.dosenPaId) ||
      cmpNim(a, b));
  }

  const hasilBagi = bagiHalaman(rows);
  const halaman = hasilBagi.halaman;
  let ttdHalamanBaru = hasilBagi.ttdHalamanBaru;

  // Jangan biarkan halaman hanya berisi tanda tangan: bawa 3 baris terakhir ke halaman TTD.
  if (ttdHalamanBaru && halaman.length) {
    const last = halaman[halaman.length - 1];
    const pindah = [];
    let n = 0;
    while (n < 3 && last.length) {
      const g = last[last.length - 1];
      const ambil = Math.min(3 - n, g.baris.length);
      pindah.unshift({ nama: g.nama, identitas: g.identitas, baris: g.baris.slice(g.baris.length - ambil) });
      g.baris = g.baris.slice(0, g.baris.length - ambil);
      n += ambil;
      if (!g.baris.length) last.pop();
    }
    halaman.push(pindah);
    ttdHalamanBaru = false;
  }

  // Ringkasan per dosen (untuk pengiriman SK ke dosen terkait)
  const perDosen = new Map();
  rows.forEach(m => {
    if (!perDosen.has(m.dosenPaId)) perDosen.set(m.dosenPaId, { dosenId: m.dosenPaId, nama: m.dosenPaNama, jumlah: 0 });
    perDosen.get(m.dosenPaId).jumlah++;
  });

  return {
    data: {
      title: `SK Pembimbing Akademik ${semester} ${tahunAjaran}`,
      nomorSk, semester, tahunAjaran, kota, tanggal,
      kaprodi: KAPRODI,
      totalMahasiswa: rows.length,
      halaman, ttdHalamanBaru,
      urlKembali: '/admin/bimbingan/sk',
      perDosen: Array.from(perDosen.values())
    }
  };
}

router.post('/sk/cetak', async (req, res) => {
  try {
    const { error, data } = await siapkanSk(req.body);
    if (error) return res.status(400).send(error);
    res.render('admin/bimbingan/sk_cetak', data);
  } catch (err) {
    console.error('Error cetak SK pembimbing:', err);
    res.status(500).send('Gagal membuat SK Pembimbing: ' + err.message);
  }
});

// ============================================================================
// RILIS & KIRIM SK KE DOSEN
// 1) SK dibuat jadi PDF (sama persis dengan tampilan cetak) - pola yang sama
//    dengan Surat Tugas (puppeteer), 2) diunggah ke Google Drive folder
//    "SK Dosen" dan dibagikan, 3) dibuatkan entri di koleksi sk_dosen untuk
//    TIAP dosen yang ada di lampiran (kategori 'pa') -> muncul di menu
//    "SK Saya" dosen, 4) dosen mendapat notifikasi (lonceng navbar).
// Kirim ulang dengan Nomor SK yang sama MENGGANTI file lama (tidak dobel).
// ============================================================================
router.post('/sk/kirim', async (req, res) => {
  let browser;
  try {
    const { error, data } = await siapkanSk(req.body);
    if (error) return res.status(400).send(error);

    // --- 1) Render HTML -> PDF ---
    const html = await new Promise((resolve, reject) => {
      res.render('admin/bimbingan/sk_cetak', { ...data, modePdf: true }, (err, out) => (err ? reject(err) : resolve(out)));
    });
    browser = await skDistribusi.bukaBrowser();
    const pdfBuffer = await skDistribusi.htmlKePdf(browser, html);
    await browser.close(); browser = null;

    // --- 2) Unggah ke Drive (folder SK Dosen), bagikan ---
    const drive = require('../../config/googleDrive');
    const { getSkFolder } = require('./sk');
    const folderId = await getSkFolder();
    const namaFile = `SK_Pembimbing_Akademik_${skDistribusi.amanNama(data.nomorSk)}_${skDistribusi.amanNama(data.semester)}_${skDistribusi.amanNama(data.tahunAjaran)}.pdf`;
    const { fileId, fileUrl } = await skDistribusi.unggahPdf(drive, folderId, namaFile, pdfBuffer);

    // --- 3) Entri sk_dosen per dosen (ganti bila Nomor SK sama sudah pernah dikirim) ---
    const judul = `SK Pembimbing Akademik ${data.semester} ${data.tahunAjaran} (No. ${data.nomorSk})`;
    const sebelumnya = await db.collection('sk_dosen').where('nomorSk', '==', data.nomorSk).get();
    const lama = {};          // dosenId -> doc ref
    const fileLama = new Set();
    sebelumnya.docs.forEach(d => {
      const v = d.data();
      if (v.kategori === 'pa') { lama[v.dosenId] = d.ref; if (v.fileId) fileLama.add(v.fileId); }
    });

    const sekarang = new Date();
    for (const d of data.perDosen) {
      const isi = {
        dosenId: d.dosenId, kategori: 'pa', judul, fileUrl, fileId,
        nomorSk: data.nomorSk, semester: data.semester, tahunAjaran: data.tahunAjaran,
        jumlahMahasiswa: d.jumlah, sumber: 'rilis-otomatis-sk-pa',
        tanggalUpload: sekarang, createdBy: req.user.id
      };
      if (lama[d.dosenId]) await lama[d.dosenId].update(isi);
      else await db.collection('sk_dosen').add(isi);
    }

    // File lama yang tidak dipakai lagi -> hapus dari Drive
    for (const lamaId of fileLama) {
      if (lamaId !== fileId) await skDistribusi.hapusFileBilaYatim(db, drive, lamaId);
    }

    // --- 4) Notifikasi ke tiap dosen (userId = id akun user dosen tsb) ---
    try {
      const { createNotification } = require('../../helpers/notificationHelper');
      const userPerDosen = await skDistribusi.petaUserPerDosen(db);
      for (const d of data.perDosen) {
        const uid = userPerDosen[d.dosenId];
        if (!uid) continue;
        await createNotification(db, uid, {
          type: 'sk',
          title: lama[d.dosenId] ? 'SK Pembimbing Akademik diperbarui' : 'SK Pembimbing Akademik baru',
          message: `${judul}: Anda ditetapkan sebagai Dosen PA untuk ${d.jumlah} mahasiswa.`,
          link: '/dosen/sk'
        });
      }
    } catch (e) { console.error('SK terkirim, tetapi notifikasi gagal dibuat:', e.message); }

    res.redirect(`/admin/sk?terkirim=${data.perDosen.length}&nomor=${encodeURIComponent(data.nomorSk)}`);
  } catch (err) {
    console.error('Error rilis & kirim SK pembimbing:', err);
    if (browser) { try { await browser.close(); } catch (_) {} }
    res.status(500).send('Gagal merilis & mengirim SK Pembimbing: ' + err.message);
  }
});

module.exports = router;
