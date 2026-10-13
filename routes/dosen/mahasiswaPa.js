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
 *   - tombol langsung ke Logbook, Laporan, dan Cetak Logbook tiap mahasiswa.
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

    const daftar = semua.map(m => {
      const info = infoMagang.get(m.id) || null;
      return {
        ...m,
        statusTampil: m.statusMahasiswa || 'Aktif',
        bolehAksi: !isTidakIkutKegiatan(m),
        magang: info,
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

module.exports = router;
