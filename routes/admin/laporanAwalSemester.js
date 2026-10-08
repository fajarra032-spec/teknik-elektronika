/**
 * routes/admin/laporanAwalSemester.js
 * Dipasang di /admin/laporan-awal-semester
 *
 *   GET /                -> halaman laporan (mahasiswa + SKS dosen)
 *   GET /export          -> unduh Excel (.xlsx), parameter sama dengan halaman
 *
 * Parameter: ?periode=ganjil-2026-2027 &bagiTim=1
 * Logika & definisi angka: helpers/laporanAwalSemesterHelper.js
 */
const express = require('express');
const XLSX = require('xlsx');
const router = express.Router();
const { db } = require('../../config/firebaseAdmin');
const { buildLaporanAwalSemester } = require('../../helpers/laporanAwalSemesterHelper');

function bacaParam(req) {
  return {
    periodeId: String(req.query.periode || '').trim(),
    bagiTim: req.query.bagiTim === '1'
  };
}

router.get('/', async (req, res) => {
  try {
    const laporan = await buildLaporanAwalSemester(db, bacaParam(req));
    res.render('admin/laporan_awal_semester', { title: 'Laporan Awal Semester', laporan });
  } catch (error) {
    console.error('Error laporan awal semester:', error);
    res.status(500).render('error', { title: 'Error', message: 'Gagal menyusun laporan: ' + error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const L = await buildLaporanAwalSemester(db, bacaParam(req));
    const m = L.mahasiswa, d = L.dosen;
    const wb = XLSX.utils.book_new();
    const tambahSheet = (nama, aoa, lebar) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      if (lebar) ws['!cols'] = lebar.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nama);
    };
    const tgl = new Date(L.dibuatPada).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

    // 1) Ringkasan mahasiswa
    tambahSheet('Ringkasan Mahasiswa', [
      ['LAPORAN AWAL SEMESTER - ' + L.periode.label],
      ['Dibuat: ' + tgl + ' (status mahasiswa = kondisi saat laporan dibuat)'],
      [],
      ['Kategori', 'Jumlah'],
      ['Mahasiswa Aktif (termasuk pindahan & magang)', m.total.aktif],
      ['   di antaranya Pindahan', m.total.pindahan],
      ['        Pindahan antar kampus', m.total.pindahanAntarKampus],
      ['        Pindahan antar prodi (kampus sama)', m.total.pindahanAntarProdi],
      ['   di antaranya Magang', m.total.magang],
      ['        Magang 1', m.total.magang1],
      ['        Magang 2', m.total.magang2],
      ['        Magang 3', m.total.magang3],
      ['Cuti', m.total.cuti],
      ['Lulus', m.total.lulus],
      ['Keluar', m.total.keluar],
      ['Total terdaftar', m.total.total]
    ], [48, 12]);

    // 2) Per angkatan
    tambahSheet('Per Angkatan', [
      ['Angkatan', 'Aktif', 'Pindahan', 'Magang', 'Cuti', 'Lulus', 'Keluar', 'Total'],
      ...m.perAngkatan.map(r => [r.angkatan, r.aktif, r.pindahan, r.magang, r.cuti, r.lulus, r.keluar, r.total]),
      ['TOTAL', m.total.aktif, m.total.pindahan, m.total.magang, m.total.cuti, m.total.lulus, m.total.keluar, m.total.total]
    ], [14, 9, 10, 9, 9, 9, 9, 9]);

    // 3) Daftar cuti / pindahan / magang
    const daftarRows = [];
    [['Cuti', m.daftar.cuti], ['Pindahan', m.daftar.pindahan], ['Magang', m.daftar.magang]].forEach(([kat, arr]) => {
      arr.forEach(x => daftarRows.push([kat, x.nim, x.nama, x.angkatan, x.kelas, x.semester, x.status, x.statusMagang, x.asalKampus, x.asalProdi, kat === 'Pindahan' ? x.jenisPindahan : '']));
    });
    tambahSheet('Cuti-Pindahan-Magang', [
      ['Kategori', 'NIM', 'Nama', 'Angkatan', 'Kelas', 'Semester', 'Status', 'Status Magang', 'Asal Kampus (pindahan)', 'Asal Prodi (pindahan)', 'Jenis Pindahan'],
      ...daftarRows
    ], [11, 12, 30, 10, 9, 12, 9, 15, 26, 30, 26]);

    // 4) SKS dosen periode terpilih
    tambahSheet('SKS Dosen', [
      ['BEBAN SKS DOSEN - ' + L.periode.label + (L.bagiTim ? ' (SKS tim dibagi rata)' : ' (SKS tim dihitung penuh per dosen)')],
      ['Sumber data: ' + (d.sumberTerpilih === 'jadwal' ? 'jadwal resmi (sesi gabungan dihitung sekali)' : 'data pengampu di mata kuliah (belum dicocokkan dengan jadwal)')],
      [],
      ['No', 'Nama Dosen', 'NIP', 'Jumlah MK/Kelas', 'Total SKS'],
      ...d.perDosen.map((x, i) => [i + 1, x.nama, x.nip, x.jumlahMk, x.totalSks]),
      ['', 'TOTAL', '', d.perDosen.reduce((s, x) => s + x.jumlahMk, 0), d.ringkasan.totalSks]
    ], [5, 34, 22, 16, 11]);

    // 5) Rincian MK per dosen
    const rincianRows = [];
    d.perDosen.forEach(x => x.rincian.forEach(r => rincianRows.push([x.nama, r.kode, r.nama, r.kelas, r.semesterKurikulum, r.sksMk, r.sksDihitung, r.tim])));
    tambahSheet('Rincian SKS Dosen', [
      ['Dosen', 'Kode MK', 'Mata Kuliah', 'Kelas', 'Smt Kurikulum', 'SKS MK', 'SKS Dihitung', 'Jumlah Dosen Pengampu'],
      ...rincianRows
    ], [30, 11, 36, 9, 13, 8, 12, 20]);

    // 6) Matriks dosen x semester
    tambahSheet('SKS per Semester', [
      ['Nama Dosen', 'NIP', ...d.semuaPeriode.map(p => p.label)],
      ['Sumber data', '', ...d.semuaPeriode.map(p => p.sumber === 'jadwal' ? 'jadwal' : 'data MK')],
      ...d.matriks.map(r => [r.nama, r.nip, ...d.semuaPeriode.map(p => r.nilai[p.id] || 0)]),
      ['TOTAL', '', ...d.semuaPeriode.map(p => d.totalPerPeriode[p.id] || 0)]
    ], [34, 22, ...d.semuaPeriode.map(() => 17)]);

    if (d.sumberTerpilih === 'jadwal') {
      tambahSheet('Selisih vs Data MK', [
        ['SELISIH BEBAN: JADWAL vs DATA PENGAMPU MK - ' + L.periode.label],
        [],
        ['Nama Dosen', 'SKS menurut jadwal', 'SKS menurut data MK', 'Selisih'],
        ...d.selisih.map(x => [x.nama, x.sksJadwal, x.sksDataMk, x.beda])
      ], [36, 20, 22, 10]);
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const namaFile = `laporan-awal-semester-${L.periode.id}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${namaFile}"`);
    res.send(buf);
  } catch (error) {
    console.error('Error ekspor laporan awal semester:', error);
    res.status(500).send('Gagal membuat file Excel: ' + error.message);
  }
});

module.exports = router;
