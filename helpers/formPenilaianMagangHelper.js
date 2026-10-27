// helpers/formPenilaianMagangHelper.js
// ============================================================================
// DATA CETAK "FORM PENILAIAN MAGANG INDUSTRI" (format resmi Politeknik Dewantara)
// Dua jenis, satu template (views/magang/form_penilaian_print.ejs):
//   - 'dosen'    : diisi Dosen Pembimbing (Laporan 8, Kepribadian 7, Pengetahuan 3)
//   - 'lapangan' : diisi Pendamping Lapangan di IDUKA (Keterampilan 2,
//                  Pengetahuan 2, Sikap Kerja 5, Laporan 1)
// Angka diletakkan di kolom huruf (A/B+/B/C+/C/D/E) sesuai rentang nilainya
// (keterangan b pada form). Kalau belum dinilai, form dicetak KOSONG supaya
// bisa diisi tangan. Hak akses TIDAK dicek di sini - pemanggil wajib mengecek.
// ============================================================================

const { db } = require('../config/firebaseAdmin');
const { nilaiKeHuruf } = require('./nilaiHelper');
const { getPembimbingMahasiswa } = require('./pembimbingHelper');
const { getMagangPeriodById, getMagangPeriodsByMahasiswa } = require('../models/magangPeriodModel');
const {
  ITEM_NILAI_DOSEN, ITEM_PENDAMPING_LAPANGAN, daftarKategori, hitungRincian, getNilaiMagang
} = require('./nilaiMagangHelper');

const SKALA = ['A', 'B+', 'B', 'C+', 'C', 'D', 'E'];

function fmtTanggal(t) {
  if (!t) return '';
  const d = new Date(String(t).slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? String(t) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * @param {string} mahasiswaId
 * @param {string} [periodId] kosong = periode pertama mahasiswa
 * @param {'dosen'|'lapangan'} jenis
 * @param {boolean} [kosong] true = cetak form KOSONG (tanpa nilai) walau sudah dinilai,
 *   mis. untuk mahasiswa yang membawa form ke pendamping lapangan
 * @returns {Promise<Object|null>} variabel untuk res.render('magang/form_penilaian_print'), null kalau mahasiswa tak ada
 */
async function buildFormPenilaianData(mahasiswaId, periodId, jenis, kosong) {
  jenis = jenis === 'lapangan' ? 'lapangan' : 'dosen';
  const doc = await db.collection('users').doc(mahasiswaId).get();
  if (!doc.exists) return null;
  const mahasiswa = { id: doc.id, ...doc.data() };

  let period = null;
  if (periodId) {
    const p = await getMagangPeriodById(periodId);
    if (p && p.mahasiswaId === mahasiswaId) period = p; // cegah cetak silang
  } else {
    const semua = await getMagangPeriodsByMahasiswa(mahasiswaId).catch(() => []);
    if (semua.length > 0) period = semua[0];
  }

  const daftarItem = jenis === 'lapangan' ? ITEM_PENDAMPING_LAPANGAN : ITEM_NILAI_DOSEN;
  const nm = (period && !kosong) ? await getNilaiMagang(mahasiswaId, period.pdkId) : null;

  let items = {};
  let catatan = '';
  let sudahDinilai = false;
  if (nm) {
    if (jenis === 'lapangan') {
      items = { ...nm.nilaiLapanganItems };
      if (items.laporan === undefined && items.logbook !== undefined) items.laporan = items.logbook; // data lama
      sudahDinilai = nm.nilaiLapangan !== null && nm.nilaiLapangan !== undefined;
      catatan = nm.catatanLapangan || '';
    } else {
      items = { ...nm.nilaiDosenItems };
      sudahDinilai = nm.nilaiDosen !== null && nm.nilaiDosen !== undefined;
      catatan = nm.catatanDosen || '';
    }
  }
  const rincian = sudahDinilai ? hitungRincian(items, daftarItem) : null;

  const kategori = daftarKategori(daftarItem).map(nama => {
    const dalam = daftarItem.filter(it => it.kategori === nama).map(it => {
      const v = sudahDinilai ? parseFloat(items[it.key]) : NaN;
      return { label: it.label, nilai: isNaN(v) ? null : v, huruf: isNaN(v) ? null : nilaiKeHuruf(v).huruf };
    });
    return {
      nama,
      items: dalam,
      // kategori berisi satu indikator senama (mis. "Laporan" di form lapangan) = baris tunggal
      tunggal: dalam.length === 1 && dalam[0].label === nama,
      rata: rincian && rincian.perKategori[nama] !== null && rincian.perKategori[nama] !== undefined ? rincian.perKategori[nama] : null
    };
  });

  const dosenPa = await getPembimbingMahasiswa(mahasiswa.dosenPaId ? mahasiswa : mahasiswaId);
  const perusahaan = (period && period.perusahaan) || {};

  return {
    title: `Form Penilaian Magang - ${mahasiswa.nama || ''}`,
    jenis,
    skala: SKALA,
    mahasiswa,
    prodi: 'Teknik Elektronika',
    lokasi: perusahaan.nama || '',
    mulai: period ? fmtTanggal(period.tanggalMulai) : '',
    selesai: period ? fmtTanggal(period.tanggalSelesai) : '',
    semester: mahasiswa.semester || (period && period.semester) || '',
    kategori,
    total: rincian ? rincian.total : null,
    rataAkhir: rincian ? rincian.rataAkhir : null,
    sudahDinilai,
    catatan,
    dosenPa,
    pendamping: perusahaan.pembimbingLapangan || '',
    generatedAt: new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })
  };
}

module.exports = { buildFormPenilaianData, SKALA };
