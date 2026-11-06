const express = require('express');
const router = express.Router();
const { verifyToken, isDosen } = require('../../middleware/auth');
const { db } = require('../../config/firebaseAdmin');
const { ambilKuisionerMap, hitungDetailDosen, predikat } = require('../../helpers/edomRekapHelper');

router.use(verifyToken);
router.use(isDosen);

const KAPRODI = { nama: 'FAJAR RAMADHAN, S.Pd., M.T', nidn: '8559777678130153', jabatan: 'Ketua Program Studi' };
const WADIR = { nama: 'ANDI RISNAWATI RAMLI, S.T., M.T', nidn: '0931108203', jabatan: 'Wakil Direktur 1' };
const KOTA_CETAK = 'Palopo';

// Semua respon milik dosen ini pada satu periode (hanya data dosen yang login)
async function ambilResponDosen(dosenId, periodeId, mkId) {
  let q = db.collection('edom_respon')
    .where('dosenId', '==', dosenId)
    .where('periodeId', '==', periodeId);
  if (mkId) q = q.where('mkId', '==', mkId);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Data lengkap satu evaluasi MK (dipakai halaman detail & cetak)
async function muatDetailMk(req, res) {
  const { mkId, periode } = req.query;
  if (!mkId || !periode) {
    res.status(400).render('error', { title: 'Error', message: 'Parameter mkId dan periode wajib diisi' });
    return null;
  }
  const [periodeDoc, responList, kuisMap] = await Promise.all([
    db.collection('edom_periode').doc(periode).get(),
    ambilResponDosen(req.dosen.id, periode, mkId),
    ambilKuisionerMap()
  ]);
  if (!periodeDoc.exists) {
    res.status(404).render('error', { title: 'Error', message: 'Periode tidak ditemukan' });
    return null;
  }
  if (responList.length === 0) {
    res.status(404).render('error', { title: 'Error', message: 'Belum ada evaluasi untuk mata kuliah ini pada periode tersebut' });
    return null;
  }
  const detail = hitungDetailDosen(responList, kuisMap, req.dosen.id);
  const mk = detail.mk[0] || {};
  return {
    detail,
    periode: { id: periodeDoc.id, ...periodeDoc.data() },
    mkId,
    mkKode: mk.mkKode || responList[0].mkKode || '',
    mkNama: mk.mkNama || responList[0].mkNama || ''
  };
}

// ============================================================================
// HALAMAN UTAMA: ringkasan per periode + kartu per mata kuliah
// ============================================================================
router.get('/', async (req, res) => {
  try {
    const dosenId = req.dosen.id;
    const periodsSnap = await db.collection('edom_periode').orderBy('tanggalMulai', 'desc').get();
    const periods = periodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const selectedPeriodId = req.query.periode || (periods.length ? periods[0].id : null);
    const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null;

    let ringkasan = null;
    let mkList = [];

    if (selectedPeriod) {
      const [responList, kuisMap] = await Promise.all([
        ambilResponDosen(dosenId, selectedPeriod.id),
        ambilKuisionerMap()
      ]);
      ringkasan = hitungDetailDosen(responList, kuisMap, dosenId);

      if (ringkasan) {
        const mkIds = [...new Set(responList.map(r => r.mkId))];
        mkList = mkIds.map(id => {
          const d = hitungDetailDosen(responList.filter(r => r.mkId === id), kuisMap, dosenId);
          const mk = d.mk[0] || {};
          return {
            mkId: id,
            mkKode: mk.mkKode || '',
            mkNama: mk.mkNama || '(tanpa nama)',
            count: d.count,
            rata: d.rata,
            rataTeks: d.rataTeks,
            pred: d.pred,
            indikator: d.indikator,
            jumlahTeks: d.teks.reduce((n, t) => n + t.jawaban.length, 0)
          };
        }).sort((a, b) => a.mkNama.localeCompare(b.mkNama));
      }
    }

    res.render('dosen/edom/index', {
      title: 'Hasil EDOM',
      periods,
      selectedPeriodId,
      selectedPeriod,
      ringkasan,
      mkList,
      dosen: req.dosen
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat hasil EDOM' });
  }
});

// ============================================================================
// DETAIL EVALUASI PER MATA KULIAH
// ============================================================================
router.get('/detail', async (req, res) => {
  try {
    const data = await muatDetailMk(req, res);
    if (!data) return;
    res.render('dosen/edom/detail', {
      title: `Detail Evaluasi - ${data.mkNama}`,
      mkId: data.mkId,
      mkKode: data.mkKode,
      mkNama: data.mkNama,
      periode: data.periode,
      detail: data.detail,
      predikat
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Error', message: 'Gagal memuat detail evaluasi' });
  }
});

// ============================================================================
// CETAK HASIL EVALUASI (per mata kuliah, A4)
// ============================================================================
router.get('/print', async (req, res) => {
  try {
    const data = await muatDetailMk(req, res);
    if (!data) return;
    res.render('dosen/edom/print', {
      title: `Cetak EDOM - ${data.mkNama}`,
      mkId: data.mkId,
      mkKode: data.mkKode,
      mkNama: data.mkNama,
      periode: data.periode,
      detail: data.detail,
      dosenNama: req.dosen.nama || data.detail.dosenNama,
      dosenNip: req.dosen.nip || req.dosen.nidn || '-',
      kaprodi: KAPRODI,
      wadir: WADIR,
      kota: KOTA_CETAK,
      tanggalCetak: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      urlKembali: `/dosen/edom/detail?mkId=${encodeURIComponent(data.mkId)}&periode=${encodeURIComponent(data.periode.id)}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { title: 'Error', message: 'Gagal mencetak laporan' });
  }
});

module.exports = router;
