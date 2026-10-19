/**
 * routes/mahasiswa/penyelesaianStudi.js
 *
 * Menu "Penyelesaian Studi" untuk mahasiswa yang akan seminar magang.
 *
 * Alur:
 *   1. Mahasiswa mengisi FORMULIR PENGAJUAN jadwal seminar.
 *   2. Admin (/admin/seminar) menyetujui dan menentukan hari seminar. Saat
 *      disetujui, jadwal otomatis masuk ke Jadwal Penting (agenda sistem).
 *   3. Setelah disetujui, mahasiswa mengurus berkas: Surat Permohonan Ujian,
 *      Berita Acara (keduanya bisa diunduh Word & dicetak), Transkrip Nilai
 *      (diambil dari menu Transkrip), dan Bukti Pembayaran (diambil di Bagian
 *      Keuangan).
 *
 * Data pengajuan disimpan di koleksi `permohonanMagang` (koleksi yang sama
 * dengan yang dikelola admin di /admin/seminar), jadi tidak ada antrian ganda.
 */

const express = require('express');
const router = express.Router();
const { db } = require('../../config/firebaseAdmin');
const { getPembimbingMahasiswa } = require('../../helpers/pembimbingHelper');
const {
  DOKUMEN, PRODI, tanggalPanjang, pecahTanggal,
  bangunDataBerkas, namaBerkas
} = require('../../helpers/penyelesaianStudiHelper');

const STATUS_AKTIF = ['pending', 'approved'];

// Gambar kop diambil dari berkas contoh resmi (templates/penyelesaian-studi/kop-*.png|jpeg),
// supaya tampilan cetak sama dengan berkas Word.
const fs = require('fs');
const path = require('path');
const kopCache = {};
function kopDataUri(jenis) {
  if (kopCache[jenis] !== undefined) return kopCache[jenis];
  const dir = path.join(__dirname, '../../templates/penyelesaian-studi');
  const kandidat = [['png', 'image/png'], ['jpeg', 'image/jpeg']];
  for (const [ext, mime] of kandidat) {
    const file = path.join(dir, `kop-${jenis}.${ext}`);
    if (fs.existsSync(file)) {
      return (kopCache[jenis] = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`);
    }
  }
  return (kopCache[jenis] = '');
}

// ----------------------------------------------------------------- bantu
async function ambilSemuaPengajuan(userId) {
  // Tanpa orderBy supaya tidak butuh index komposit baru; diurutkan di JS.
  const snap = await db.collection('permohonanMagang').where('userId', '==', userId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function ambilPengajuanMilik(id, userId) {
  const doc = await db.collection('permohonanMagang').doc(id).get();
  if (!doc.exists) return { error: 404, pesan: 'Pengajuan tidak ditemukan' };
  const data = { id: doc.id, ...doc.data() };
  if (data.userId !== userId) return { error: 403, pesan: 'Akses ditolak' };
  return { pengajuan: data };
}

/** Data awal formulir: lokasi magang, pendamping lapangan, dan status laporan dari sistem */
async function ambilDataAwal(user) {
  const [periodSnap, laporanDocs] = await Promise.all([
    db.collection('magangPeriod').where('mahasiswaId', '==', user.id).get(),
    db.getAll(...[1, 2, 3].map((ke) => db.collection('laporanMagang').doc(`${user.id}_${ke}`)))
  ]);

  const periode = periodSnap.docs
    .map((d) => d.data())
    .filter((p) => p.status !== 'cancelled')
    .sort((a, b) => String(a.tanggalMulai || '').localeCompare(String(b.tanggalMulai || '')));

  const lokasi = [1, 2, 3].map((ke) => ({
    ke,
    perusahaan: (periode[ke - 1] && periode[ke - 1].perusahaan && periode[ke - 1].perusahaan.nama) || ''
  }));

  const terakhir = [...periode].reverse().find((p) => p.perusahaan && p.perusahaan.pembimbingLapangan);
  const laporan = {};
  laporanDocs.forEach((doc, i) => { laporan[i + 1] = doc.exists; });

  return {
    lokasi,
    laporan,
    pendampingLapangan: (terakhir && terakhir.perusahaan.pembimbingLapangan) || ''
  };
}

async function tampilkanHalaman(req, res, { error = null, form = null, status = 200 } = {}) {
  const user = req.user;
  const [semua, pembimbing, awal] = await Promise.all([
    ambilSemuaPengajuan(user.id),
    getPembimbingMahasiswa(user),
    ambilDataAwal(user)
  ]);

  const aktif = semua.find((p) => STATUS_AKTIF.includes(p.status)) || null;
  const terbaru = aktif || semua[0] || null;
  const data = aktif ? bangunDataBerkas({ user, pengajuan: aktif, pembimbing }) : null;

  res.status(status).render('mahasiswa/penyelesaian/index', {
    title: 'Penyelesaian Studi',
    user,
    prodi: PRODI,
    pembimbing,
    awal,
    aktif,
    terbaru,
    jadwal: data && data.jadwal,
    error,
    form,
    fmt: { tanggalPanjang, pecahTanggal },
    riwayat: semua
  });
}

// ------------------------------------------------------------- halaman utama
router.get('/', async (req, res) => {
  try {
    await tampilkanHalaman(req, res);
  } catch (err) {
    console.error('Error halaman Penyelesaian Studi:', err);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat halaman Penyelesaian Studi' });
  }
});

// ------------------------------------------------------------------ ajukan
router.post('/ajukan', async (req, res) => {
  try {
    const user = req.user;
    const b = req.body || {};
    const semua = await ambilSemuaPengajuan(user.id);
    if (semua.some((p) => STATUS_AKTIF.includes(p.status))) {
      return tampilkanHalaman(req, res, { error: 'Anda sudah memiliki pengajuan seminar yang sedang berjalan.', status: 400 });
    }

    const lokasiMagang = [1, 2, 3].map((ke) => ({ ke, perusahaan: String(b['lokasi' + ke] || '').trim().slice(0, 200) }));
    const form = {
      lokasi: lokasiMagang,
      pendampingLapangan: String(b.pendampingLapangan || '').trim().slice(0, 150),
      pembayaranLunas: b.pembayaranLunas === 'on',
      catatan: String(b.catatan || '').trim().slice(0, 500)
    };

    if (!lokasiMagang[0].perusahaan) {
      return tampilkanHalaman(req, res, { error: 'Lokasi Magang 1 wajib diisi.', form, status: 400 });
    }

    const [pembimbing, awal] = await Promise.all([getPembimbingMahasiswa(user), ambilDataAwal(user)]);
    if (!pembimbing) {
      return tampilkanHalaman(req, res, {
        error: 'Dosen Pembimbing Akademik (PA) Anda belum ditetapkan. Hubungi admin program studi terlebih dahulu.',
        form, status: 400
      });
    }

    const now = new Date().toISOString();
    await db.collection('permohonanMagang').add({
      userId: user.id,
      nim: user.nim,
      nama: user.nama,
      prodi: PRODI,
      sumber: 'penyelesaian-studi',
      judul: 'Seminar Hasil Magang 1, 2, dan 3',
      tanggal: null,
      waktu: '',
      tempat: '',
      pembimbing: pembimbing.nama,
      penguji: '',
      lokasiMagang,
      pendampingLapangan: form.pendampingLapangan,
      laporan: awal.laporan,          // status laporan saat diajukan (dicek dari sistem)
      pembayaranLunas: form.pembayaranLunas,
      catatanMahasiswa: form.catatan,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      history: [{ status: 'pending', timestamp: now, catatan: 'Formulir pengajuan jadwal seminar diterima' }]
    });

    res.redirect('/mahasiswa/penyelesaian-studi');
  } catch (err) {
    console.error('Error ajukan seminar:', err);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menyimpan pengajuan' });
  }
});

// ------------------------------------------------------------------- batal
router.post('/:id/batal', async (req, res) => {
  try {
    const { pengajuan, error, pesan } = await ambilPengajuanMilik(req.params.id, req.user.id);
    if (error) return res.status(error).send(pesan);
    if (pengajuan.status !== 'pending') {
      return res.status(400).send('Hanya pengajuan yang masih menunggu yang dapat dibatalkan');
    }
    const now = new Date().toISOString();
    await db.collection('permohonanMagang').doc(pengajuan.id).update({
      status: 'dibatalkan',
      updatedAt: now,
      history: [...(pengajuan.history || []), { status: 'dibatalkan', timestamp: now, catatan: 'Dibatalkan mahasiswa' }]
    });
    res.redirect('/mahasiswa/penyelesaian-studi');
  } catch (err) {
    console.error('Error batal seminar:', err);
    res.status(500).send('Gagal membatalkan pengajuan');
  }
});

// ----------------------------------------------------------------- dokumen
async function siapkanDokumen(req, res) {
  const { id, jenis } = req.params;
  if (!DOKUMEN[jenis]) { res.status(404).send('Jenis dokumen tidak ditemukan'); return null; }

  const { pengajuan, error, pesan } = await ambilPengajuanMilik(id, req.user.id);
  if (error) { res.status(error).send(pesan); return null; }

  if (DOKUMEN[jenis].butuhJadwal && pengajuan.status !== 'approved') {
    res.status(403).send('Dokumen ini baru dapat dibuat setelah jadwal seminar disetujui admin.');
    return null;
  }
  if (!DOKUMEN[jenis].butuhJadwal && !['pending', 'approved'].includes(pengajuan.status)) {
    res.status(403).send('Pengajuan ini sudah tidak aktif.');
    return null;
  }

  const pembimbing = await getPembimbingMahasiswa(req.user);
  return { pengajuan, data: bangunDataBerkas({ user: req.user, pengajuan, pembimbing }) };
}

// Tampilan siap cetak (Cetak / simpan PDF dari browser)
router.get('/:id/dokumen/:jenis/cetak', async (req, res) => {
  try {
    const hasil = await siapkanDokumen(req, res);
    if (!hasil) return;
    const { jenis, id } = req.params;
    res.render('mahasiswa/penyelesaian/cetak_' + jenis.replace(/-/g, '_'), {
      title: DOKUMEN[jenis].judul,
      user: req.user,
      d: hasil.data,
      kop: kopDataUri(jenis),
      judulDokumen: DOKUMEN[jenis].judul,
      urlWord: `/mahasiswa/penyelesaian-studi/${id}/dokumen/${jenis}/word`,
      urlKembali: '/mahasiswa/penyelesaian-studi'
    });
  } catch (err) {
    console.error('Error cetak dokumen:', err);
    res.status(500).send('Gagal menyiapkan dokumen');
  }
});

// Unduh Word (.docx)
router.get('/:id/dokumen/:jenis/word', async (req, res) => {
  try {
    const hasil = await siapkanDokumen(req, res);
    if (!hasil) return;
    const { jenis } = req.params;

    // Di-require di sini (lazy): kalau package 'docx' belum ter-install, hanya
    // unduhan Word yang gagal - halaman cetak tetap berfungsi.
    const { buatDokumenWord } = require('../../helpers/penyelesaianStudiDocx');
    const buffer = await buatDokumenWord(jenis, hasil.data);

    const nama = namaBerkas(jenis, hasil.data) + '.docx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nama}"; filename*=UTF-8''${encodeURIComponent(nama)}`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('Error unduh Word:', err);
    res.status(500).send('Gagal membuat berkas Word: ' + err.message);
  }
});

module.exports = router;
