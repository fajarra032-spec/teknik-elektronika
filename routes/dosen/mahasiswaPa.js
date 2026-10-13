/**
 * routes/dosen/mahasiswaPa.js
 *
 * PUSAT KERJA DOSEN PA (Pembimbing Akademik).
 * Daftar mahasiswa yang Dosen PA-nya adalah dosen yang sedang login (field
 * `dosenPaId` di dokumen mahasiswa - di-set lewat /admin/mahasiswa atau script
 * assign-dosen-pa-*). Karena Dosen PA juga satu-satunya pembimbing magang
 * (Pembimbing 1 & 2 sudah ditiadakan), halaman ini menjadi titik awal:
 *   - ringkasan: jumlah mahasiswa per status, yang sedang magang, dan yang
 *     MENUNGGU tindakan Anda (logbook pending, laporan belum ditinjau),
 *   - filter status (Aktif/Cuti/Keluar/Lulus), pencarian, dan "perlu ditindak",
 *   - tombol langsung ke Logbook, Laporan, dan Cetak Logbook tiap mahasiswa,
 *   - LEMBAR KONSULTASI bimbingan akademik tiap mahasiswa (catat, ubah, hapus,
 *     cetak) - lihat bagian bawah file ini.
 *
 * Mahasiswa Cuti/Keluar tetap TAMPIL di sini (mereka tetap bimbingan PA
 * Anda) tetapi tidak ikut info magang & tombol aksi.
 *
 * BEDA dengan "Mahasiswa Bimbingan" di routes/dosen/mahasiswa.js (itu
 * berdasarkan mata kuliah yang diampu).
 */

const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { isTidakIkutKegiatan } = require('../../helpers/statusMahasiswaHelper');
const { isPembimbingMahasiswa } = require('../../helpers/pembimbingHelper');
const {
  COLLECTION: KONSULTASI,
  KATEGORI,
  BATAS,
  getKonsultasiMahasiswa,
  bersihkanInput,
  labelSemesterBerjalan,
  buildPrintData
} = require('../../helpers/konsultasiPaHelper');

router.use(verifyToken);
router.use(isDosen);

const STATUS_VALID = ['Aktif', 'Cuti', 'Keluar', 'Lulus'];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Info magang (hanya untuk mahasiswa yang boleh ikut kegiatan) - gagal = kosong, halaman tetap tampil. */
async function getInfoMagang(ids) {
  const info = new Map(); // id -> { periode, logbookPending, laporanMenunggu }
  ids.forEach(id => info.set(id, { periode: null, logbookPending: 0, laporanMenunggu: 0 }));
  if (ids.length === 0) return info;

  // 1) Periode magang aktif
  try {
    for (const c of chunk(ids, 10)) {
      const snap = await db.collection('magangPeriod')
        .where('mahasiswaId', 'in', c)
        .where('status', '==', 'active')
        .get();
      snap.docs.forEach(d => {
        const p = d.data();
        const row = info.get(p.mahasiswaId);
        if (row && !row.periode) {
          row.periode = {
            perusahaan: (p.perusahaan && p.perusahaan.nama) || '',
            pdkKode: p.pdkKode || '',
            tanggalMulai: p.tanggalMulai || null,
            tanggalSelesai: p.tanggalSelesai || null
          };
        }
      });
    }
  } catch (err) {
    console.error('Mahasiswa PA - gagal baca periode magang:', err.message);
  }

  // 2) Laporan yang belum ditinjau (status 'submitted' atau belum ada status)
  try {
    for (const c of chunk(ids, 10)) {
      const snap = await db.collection('laporanMagang').where('userId', 'in', c).get();
      snap.docs.forEach(d => {
        const l = d.data();
        if (l.status === 'submitted' || !l.status) {
          const row = info.get(l.userId);
          if (row) row.laporanMenunggu += 1;
        }
      });
    }
  } catch (err) {
    console.error('Mahasiswa PA - gagal baca laporan:', err.message);
  }

  // 3) Logbook menunggu persetujuan (count() murah, hanya yang punya periode aktif)
  const punyaPeriode = ids.filter(id => info.get(id).periode);
  await Promise.all(punyaPeriode.map(async id => {
    try {
      const s = await db.collection('logbookMagang')
        .where('userId', '==', id)
        .where('status', '==', 'pending')
        .count().get();
      info.get(id).logbookPending = s.data().count || 0;
    } catch (err) {
      console.error('Mahasiswa PA - gagal hitung logbook pending:', err.message);
    }
  }));

  return info;
}

/** Jumlah & tanggal konsultasi terakhir per mahasiswa (batch 'in', 1 filter -> tanpa index baru). */
async function getRingkasanKonsultasi(ids) {
  const out = new Map();
  ids.forEach(id => out.set(id, { jumlah: 0, terakhir: '' }));
  try {
    for (const c of chunk(ids, 10)) {
      const snap = await db.collection(KONSULTASI).where('mahasiswaId', 'in', c).get();
      snap.docs.forEach(d => {
        const k = d.data();
        const row = out.get(k.mahasiswaId);
        if (!row) return;
        row.jumlah += 1;
        if (String(k.tanggal || '') > row.terakhir) row.terakhir = String(k.tanggal || '');
      });
    }
  } catch (err) {
    console.error('Mahasiswa PA - gagal baca ringkasan konsultasi:', err.message);
  }
  return out;
}

router.get('/', async (req, res) => {
  try {
    const dosenId = req.dosen.id;
    const search = (req.query.search || '').trim();
    const statusFilter = STATUS_VALID.includes(req.query.status) ? req.query.status : '';
    const fokusPerlu = req.query.fokus === 'perlu';

    const snapshot = await db.collection('users')
      .where('role', '==', 'mahasiswa')
      .where('dosenPaId', '==', dosenId)
      .get();

    const semua = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.nim || '').localeCompare(b.nim || ''));

    // Info magang hanya untuk yang boleh ikut kegiatan (bukan Cuti/Keluar/Lulus)
    const idBolehMagang = semua
      .filter(m => !isTidakIkutKegiatan(m) && m.statusMahasiswa !== 'Lulus')
      .map(m => m.id);
    const infoMagang = await getInfoMagang(idBolehMagang);
    const ringkasanKonsultasi = await getRingkasanKonsultasi(semua.map(m => m.id));

    const daftar = semua.map(m => {
      const info = infoMagang.get(m.id) || null;
      return {
        ...m,
        statusTampil: m.statusMahasiswa || 'Aktif',
        bolehAksi: !isTidakIkutKegiatan(m),
        magang: info,
        konsultasi: ringkasanKonsultasi.get(m.id) || { jumlah: 0, terakhir: '' },
        perluDitindak: !!info && (info.logbookPending > 0 || info.laporanMenunggu > 0)
      };
    });

    // Hitungan untuk chip & kartu ringkasan (dari SELURUH mahasiswa PA, bukan hasil filter)
    const statusCounts = { Aktif: 0, Cuti: 0, Keluar: 0, Lulus: 0 };
    daftar.forEach(m => { if (statusCounts[m.statusTampil] !== undefined) statusCounts[m.statusTampil] += 1; });
    const ringkasan = {
      total: daftar.length,
      aktif: statusCounts.Aktif,
      sedangMagang: daftar.filter(m => m.magang && m.magang.periode).length,
      logbookMenunggu: daftar.reduce((s, m) => s + (m.magang ? m.magang.logbookPending : 0), 0),
      laporanMenunggu: daftar.reduce((s, m) => s + (m.magang ? m.magang.laporanMenunggu : 0), 0),
      perluDitindak: daftar.filter(m => m.perluDitindak).length
    };

    // Terapkan filter
    const q = search.toLowerCase();
    const filteredList = daftar.filter(m => {
      if (statusFilter && m.statusTampil !== statusFilter) return false;
      if (fokusPerlu && !m.perluDitindak) return false;
      if (q && !((m.nama || '').toLowerCase().includes(q) || (m.nim || '').toLowerCase().includes(q))) return false;
      return true;
    });

    res.render('dosen/mahasiswa_pa', {
      title: 'Mahasiswa Bimbingan Akademik (PA)',
      dosen: req.dosen,
      filteredList,
      totalPa: daftar.length,
      ringkasan,
      statusCounts,
      statusFilter,
      fokusPerlu,
      search
    });
  } catch (error) {
    console.error('Error memuat mahasiswa PA:', error);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Gagal memuat daftar mahasiswa bimbingan akademik'
    });
  }
});

// ============================================================================
// LEMBAR KONSULTASI BIMBINGAN AKADEMIK
// Hanya Dosen PA dari mahasiswa tsb yang boleh melihat/mencatat/mengubah/
// menghapus. Mahasiswa melihat sendiri lewat /mahasiswa/konsultasi-pa.
// ============================================================================

/** Pastikan dosen ini Dosen PA mahasiswa; kembalikan dokumen mahasiswa atau null (respon sudah dikirim). */
async function pastikanDosenPa(req, res) {
  const mahasiswaId = req.params.id;
  const { isBimbingan } = await isPembimbingMahasiswa(req.dosen.id, mahasiswaId);
  if (!isBimbingan) {
    res.status(403).render('error', { title: 'Akses Ditolak', message: 'Anda bukan Dosen PA mahasiswa ini.' });
    return null;
  }
  const doc = await db.collection('users').doc(mahasiswaId).get();
  if (!doc.exists) {
    res.status(404).render('error', { title: 'Tidak Ditemukan', message: 'Data mahasiswa tidak ditemukan.' });
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

const PESAN_OK = {
  tambah: 'Konsultasi berhasil dicatat.',
  ubah: 'Konsultasi berhasil diperbarui.',
  hapus: 'Konsultasi berhasil dihapus.'
};

router.get('/:id/konsultasi', async (req, res) => {
  try {
    const mahasiswa = await pastikanDosenPa(req, res);
    if (!mahasiswa) return;
    const daftar = (await getKonsultasiMahasiswa(mahasiswa.id)).reverse(); // terbaru di atas
    res.render('dosen/konsultasi_pa', {
      title: `Lembar Konsultasi - ${mahasiswa.nama}`,
      mahasiswa,
      daftar,
      KATEGORI,
      BATAS,
      hariIni: new Date().toISOString().slice(0, 10),
      sukses: PESAN_OK[req.query.ok] || '',
      galat: req.query.err ? String(req.query.err).slice(0, 200) : ''
    });
  } catch (error) {
    console.error('Error memuat lembar konsultasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat lembar konsultasi' });
  }
});

router.post('/:id/konsultasi', async (req, res) => {
  try {
    const mahasiswa = await pastikanDosenPa(req, res);
    if (!mahasiswa) return;
    const hasil = bersihkanInput(req.body);
    const base = `/dosen/mahasiswa-pa/${mahasiswa.id}/konsultasi`;
    if (hasil.error) return res.redirect(`${base}?err=${encodeURIComponent(hasil.error)}`);

    const now = new Date().toISOString();
    await db.collection(KONSULTASI).add({
      ...hasil.data,
      mahasiswaId: mahasiswa.id,
      dosenId: req.dosen.id,
      dosenNama: req.dosen.nama || '',
      semester: labelSemesterBerjalan(),
      createdAt: now,
      updatedAt: now
    });
    res.redirect(`${base}?ok=tambah`);
  } catch (error) {
    console.error('Error menambah konsultasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menyimpan konsultasi' });
  }
});

/** Ambil dokumen konsultasi & pastikan memang milik mahasiswa di URL. */
async function ambilKonsultasi(mahasiswaId, kid) {
  const ref = db.collection(KONSULTASI).doc(kid);
  const doc = await ref.get();
  if (!doc.exists || doc.data().mahasiswaId !== mahasiswaId) return null;
  return ref;
}

router.post('/:id/konsultasi/:kid/update', async (req, res) => {
  try {
    const mahasiswa = await pastikanDosenPa(req, res);
    if (!mahasiswa) return;
    const base = `/dosen/mahasiswa-pa/${mahasiswa.id}/konsultasi`;
    const ref = await ambilKonsultasi(mahasiswa.id, req.params.kid);
    if (!ref) return res.redirect(`${base}?err=${encodeURIComponent('Data konsultasi tidak ditemukan.')}`);
    const hasil = bersihkanInput(req.body);
    if (hasil.error) return res.redirect(`${base}?err=${encodeURIComponent(hasil.error)}`);
    await ref.update({ ...hasil.data, updatedAt: new Date().toISOString(), diubahOleh: req.dosen.id });
    res.redirect(`${base}?ok=ubah`);
  } catch (error) {
    console.error('Error mengubah konsultasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mengubah konsultasi' });
  }
});

router.post('/:id/konsultasi/:kid/delete', async (req, res) => {
  try {
    const mahasiswa = await pastikanDosenPa(req, res);
    if (!mahasiswa) return;
    const base = `/dosen/mahasiswa-pa/${mahasiswa.id}/konsultasi`;
    const ref = await ambilKonsultasi(mahasiswa.id, req.params.kid);
    if (!ref) return res.redirect(`${base}?err=${encodeURIComponent('Data konsultasi tidak ditemukan.')}`);
    await ref.delete();
    res.redirect(`${base}?ok=hapus`);
  } catch (error) {
    console.error('Error menghapus konsultasi:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menghapus konsultasi' });
  }
});

router.get('/:id/konsultasi/print', async (req, res) => {
  try {
    const mahasiswa = await pastikanDosenPa(req, res);
    if (!mahasiswa) return;
    const data = await buildPrintData(mahasiswa.id);
    if (!data) return res.status(404).send('Data mahasiswa tidak ditemukan');
    res.render('konsultasi_pa_print', data);
  } catch (error) {
    console.error('Error mencetak lembar konsultasi:', error);
    res.status(500).send('Gagal mencetak lembar konsultasi');
  }
});

module.exports = router;
