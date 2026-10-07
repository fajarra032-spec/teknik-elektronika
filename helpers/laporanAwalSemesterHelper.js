/**
 * helpers/laporanAwalSemesterHelper.js
 *
 * Membentuk data LAPORAN AWAL SEMESTER:
 *   1. Rekap mahasiswa: Aktif, Cuti, Pindahan, Magang (+ Lulus/Keluar sebagai
 *      pelengkap), total dan per angkatan, beserta daftar nama.
 *   2. Beban SKS setiap dosen pada periode terpilih (dengan rincian MK).
 *   3. Matriks SKS setiap dosen x setiap semester (semua periode yang
 *      pengampunya tercatat).
 * READ-ONLY: tidak menulis apa pun ke database.
 *
 * ---------------------------------------------------------------------------
 * DEFINISI (supaya angka bisa dipertanggungjawabkan)
 * ---------------------------------------------------------------------------
 * - AKTIF   : users.statusMahasiswa === 'Aktif'. Angka ini TERMASUK mahasiswa
 *             pindahan dan yang sedang magang (mereka tetap berstatus Aktif);
 *             keduanya ditampilkan sebagai "di antaranya".
 * - CUTI    : users.statusMahasiswa === 'Cuti'.
 * - MAGANG  : users.statusMagang adalah 'Magang 1' / 'Magang 2' / 'Magang 3'
 *             (sedang magang). 'Selesai Magang' TIDAK dihitung.
 * - PINDAHAN: dideteksi dari dua sumber:
 *             (a) users.jenisMasuk === 'Pindahan' (atau users.pindahan === true)
 *                 + users.asalKampus / users.asalProdi -> diisi lewat
 *                 scripts/tandai-mahasiswa-pindahan.js, atau
 *             (b) punya nilai alih kredit: grades.jenis === 'alih-kredit'
 *                 (asalProdi/asalPerguruanTinggi ikut terbaca dari nilai itu).
 *             Hanya mahasiswa berstatus Aktif/Cuti yang dihitung pindahan.
 *             Jenis: 'Antar kampus' bila asal kampus bukan Politeknik
 *             Dewantara; 'Antar prodi (kampus sama)' bila asalnya kampus ini.
 *
 * CATATAN PENTING: status mahasiswa di database adalah kondisi SAAT INI,
 * bukan riwayat per semester. Jalankan/ekspor laporan ini di awal semester
 * (sebelum status banyak berubah) bila ingin angka "awal semester" yang tepat.
 *
 * SKS DOSEN: pengampu per periode dibaca dari subkoleksi
 * mataKuliah/{id}/pengampuPeriode/{periodeId}.dosenIds. Untuk periode AKTIF,
 * bila subdokumennya belum ada, dipakai mataKuliah.dosenIds (cermin periode
 * aktif). Tiap dokumen MK dihitung sendiri-sendiri, jadi MK kelas paralel
 * (mis. ELK1A & ELK1B) dihitung dua kali = dua kelas yang memang diajar.
 * MK diampu tim (>1 dosen): SKS penuh untuk tiap dosen, atau dibagi rata bila
 * opsi `bagiTim` aktif.
 */

const { getAllMahasiswa, getAllMataKuliah } = require('./cache');
const { getAngkatanFromNim, generatePeriodeOptions, getActivePeriodeId, bandingkanLabelPeriode } = require('./academicHelper');

const MAGANG_AKTIF = ['Magang 1', 'Magang 2', 'Magang 3'];

const round2 = (n) => Math.round(n * 100) / 100;

/** Jenis pindahan dari asal kampus: kampus ini (Politeknik Dewantara/Polidewa) = antar prodi. */
function jenisPindahan(asalKampus) {
  const k = String(asalKampus || '').trim();
  if (!k) return 'Asal belum diisi';
  return /dewantara|polidewa/i.test(k) ? 'Antar prodi (kampus sama)' : 'Antar kampus';
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ----------------------------------------------------------------------------
// 1) MAHASISWA
// ----------------------------------------------------------------------------
async function getPindahanInfo(db) {
  // userId -> { asalProdi }  dari nilai alih kredit
  const map = new Map();
  const snap = await db.collection('grades').where('jenis', '==', 'alih-kredit').get();
  snap.docs.forEach(d => {
    const g = d.data();
    if (!g.userId) return;
    if (!map.has(g.userId)) map.set(g.userId, { asalProdi: g.asalProdi || '', asalKampus: g.asalPerguruanTinggi || '' });
    else {
      const x = map.get(g.userId);
      if (!x.asalProdi && g.asalProdi) x.asalProdi = g.asalProdi;
      if (!x.asalKampus && g.asalPerguruanTinggi) x.asalKampus = g.asalPerguruanTinggi;
    }
  });
  return map;
}

async function buildRekapMahasiswa(db) {
  const [semua, pindahanMap] = await Promise.all([getAllMahasiswa(db), getPindahanInfo(db)]);

  const kosong = () => ({ aktif: 0, cuti: 0, pindahan: 0, pindahanAntarKampus: 0, pindahanAntarProdi: 0, magang: 0, magang1: 0, magang2: 0, magang3: 0, lulus: 0, keluar: 0, total: 0 });
  const total = kosong();
  const perAngkatan = new Map();
  const daftar = { cuti: [], pindahan: [], magang: [] };

  semua.forEach(m => {
    const angkatan = getAngkatanFromNim(m.nim) || 'Tanpa angkatan';
    if (!perAngkatan.has(angkatan)) perAngkatan.set(angkatan, kosong());
    const baris = perAngkatan.get(angkatan);

    const status = m.statusMahasiswa || 'Aktif';
    const isPindahan = (m.jenisMasuk === 'Pindahan' || m.pindahan === true || pindahanMap.has(m.id));
    const sedangMagang = MAGANG_AKTIF.includes(m.statusMagang);

    const tambah = (k) => { baris[k]++; total[k]++; };
    tambah('total');
    const item = {
      id: m.id, nim: m.nim || '-', nama: m.nama || '(tanpa nama)', angkatan,
      kelas: m.kelas || '', semester: m.semester || '', status,
      statusMagang: m.statusMagang || '',
      asalKampus: m.asalKampus || (pindahanMap.get(m.id) || {}).asalKampus || '',
      asalProdi: m.asalProdi || (pindahanMap.get(m.id) || {}).asalProdi || ''
    };
    item.jenisPindahan = jenisPindahan(item.asalKampus);

    if (status === 'Aktif') {
      tambah('aktif');
      if (sedangMagang) {
        tambah('magang');
        tambah('magang' + m.statusMagang.slice(-1));
        daftar.magang.push(item);
      }
    } else if (status === 'Cuti') {
      tambah('cuti');
      daftar.cuti.push(item);
    } else if (status === 'Lulus') {
      tambah('lulus');
    } else if (status === 'Keluar') {
      tambah('keluar');
    }
    if (isPindahan && (status === 'Aktif' || status === 'Cuti')) {
      tambah('pindahan');
      if (item.jenisPindahan === 'Antar kampus') tambah('pindahanAntarKampus');
      else if (item.jenisPindahan.startsWith('Antar prodi')) tambah('pindahanAntarProdi');
      daftar.pindahan.push(item);
    }
  });

  const urut = (a, b) => String(a.nim).localeCompare(String(b.nim));
  daftar.cuti.sort(urut); daftar.pindahan.sort(urut); daftar.magang.sort(urut);

  const barisAngkatan = Array.from(perAngkatan.entries())
    .map(([angkatan, v]) => ({ angkatan, ...v }))
    .sort((a, b) => String(b.angkatan).localeCompare(String(a.angkatan)));

  return { total, perAngkatan: barisAngkatan, daftar };
}

// ----------------------------------------------------------------------------
// 2 & 3) SKS DOSEN
// ----------------------------------------------------------------------------
/** Baca seluruh riwayat pengampu semua MK: Map<mkId, Map<periodeId, {label, dosenIds}>> */
async function getRiwayatPengampuSemuaMk(db, mkList) {
  const hasil = new Map();
  for (const grup of chunk(mkList, 20)) {
    const snaps = await Promise.all(grup.map(mk =>
      db.collection('mataKuliah').doc(mk.id).collection('pengampuPeriode').get()
    ));
    snaps.forEach((snap, i) => {
      const per = new Map();
      snap.docs.forEach(d => {
        const x = d.data();
        per.set(d.id, { label: x.label || d.id, urutan: x.urutan || 0, dosenIds: Array.isArray(x.dosenIds) ? x.dosenIds : [] });
      });
      hasil.set(grup[i].id, per);
    });
  }
  return hasil;
}

async function buildSksDosen(db, { periodeId, bagiTim }) {
  const [dosenSnap, mkList] = await Promise.all([db.collection('dosen').get(), getAllMataKuliah(db)]);
  const dosenMap = new Map(dosenSnap.docs.map(d => [d.id, { id: d.id, nama: d.data().nama || '(tanpa nama)', nip: d.data().nip || '' }]));
  const riwayat = await getRiwayatPengampuSemuaMk(db, mkList);

  const periodeAktifId = getActivePeriodeId();
  const labelPeriode = new Map();   // periodeId -> label
  const urutanPeriode = new Map();  // periodeId -> urutan (untuk pengurutan kolom)
  generatePeriodeOptions(50, 5).forEach(p => { labelPeriode.set(p.id, p.label); urutanPeriode.set(p.id, p.urutan); });

  // beban[periodeId][dosenId] = { sks, kelas:Set, rincian:[...] }
  const beban = new Map();
  const dosenTidakDikenal = new Map(); // id -> jumlah kemunculan (info data yatim)

  function catat(periodeId, dosenIds, mk) {
    const unik = Array.from(new Set(dosenIds.filter(Boolean)));
    if (unik.length === 0) return;
    const sksMk = parseFloat(mk.sks) || 0;
    const bagian = bagiTim ? sksMk / unik.length : sksMk;
    if (!beban.has(periodeId)) beban.set(periodeId, new Map());
    const per = beban.get(periodeId);
    unik.forEach(did => {
      if (!dosenMap.has(did)) dosenTidakDikenal.set(did, (dosenTidakDikenal.get(did) || 0) + 1);
      if (!per.has(did)) per.set(did, { sks: 0, rincian: [] });
      const b = per.get(did);
      b.sks += bagian;
      b.rincian.push({
        mkId: mk.id, kode: mk.kode || '-', nama: mk.nama || '-', kelas: mk.kelas || '',
        semesterKurikulum: mk.semester || '', sksMk, sksDihitung: round2(bagian), tim: unik.length
      });
    });
  }

  mkList.forEach(mk => {
    const per = riwayat.get(mk.id) || new Map();
    per.forEach((v, pid) => {
      if (v.label) labelPeriode.set(pid, v.label);
      if (v.urutan) urutanPeriode.set(pid, v.urutan);
      catat(pid, v.dosenIds, mk);
    });
    // periode aktif belum punya subdokumen -> pakai cermin mk.dosenIds
    if (!per.has(periodeAktifId) && Array.isArray(mk.dosenIds) && mk.dosenIds.length > 0) {
      catat(periodeAktifId, mk.dosenIds, mk);
    }
  });

  // ---- periode yang punya data, urut kronologis (terbaru dulu) ----
  const semuaPeriode = Array.from(beban.keys())
    .map(id => ({ id, label: labelPeriode.get(id) || id, urutan: urutanPeriode.get(id) || 0 }))
    .sort((a, b) => (b.urutan - a.urutan) || bandingkanLabelPeriode(b.label, a.label));

  // ---- detail periode terpilih ----
  const bebanTerpilih = beban.get(periodeId) || new Map();
  const dosenIdsSemua = new Set([...dosenMap.keys(), ...bebanTerpilih.keys()]);
  const perDosen = Array.from(dosenIdsSemua).map(did => {
    const info = dosenMap.get(did) || { id: did, nama: '(dosen tidak ditemukan: ' + did + ')', nip: '' };
    const b = bebanTerpilih.get(did);
    const rincian = b ? b.rincian.slice().sort((x, y) => String(x.kode).localeCompare(String(y.kode)) || String(x.kelas).localeCompare(String(y.kelas))) : [];
    return {
      id: did, nama: info.nama, nip: info.nip,
      jumlahMk: rincian.length,
      totalSks: b ? round2(b.sks) : 0,
      rincian
    };
  }).sort((a, b) => (b.totalSks - a.totalSks) || String(a.nama).localeCompare(String(b.nama)));

  // ---- matriks dosen x semua periode ----
  const matriks = Array.from(dosenIdsSemua).map(did => {
    const info = dosenMap.get(did) || { nama: '(dosen tidak ditemukan: ' + did + ')', nip: '' };
    const nilai = {};
    let adaData = false;
    semuaPeriode.forEach(p => {
      const b = (beban.get(p.id) || new Map()).get(did);
      nilai[p.id] = b ? round2(b.sks) : 0;
      if (b) adaData = true;
    });
    return { id: did, nama: info.nama, nip: info.nip, nilai, adaData };
  }).filter(r => r.adaData).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));

  const totalPerPeriode = {};
  semuaPeriode.forEach(p => { totalPerPeriode[p.id] = round2(matriks.reduce((s, r) => s + (r.nilai[p.id] || 0), 0)); });

  return {
    perDosen,
    matriks,
    semuaPeriode,
    totalPerPeriode,
    dosenTidakDikenal: Array.from(dosenTidakDikenal.keys()),
    ringkasan: {
      jumlahDosenTerdaftar: dosenMap.size,
      jumlahDosenMengajar: perDosen.filter(d => d.totalSks > 0).length,
      jumlahDosenTanpaBeban: perDosen.filter(d => d.totalSks === 0).length,
      totalSks: round2(perDosen.reduce((s, d) => s + d.totalSks, 0))
    }
  };
}

// ----------------------------------------------------------------------------
// GABUNGAN
// ----------------------------------------------------------------------------
async function buildLaporanAwalSemester(db, { periodeId, bagiTim = false } = {}) {
  const opsiPeriode = generatePeriodeOptions(8, 1);
  const pilih = opsiPeriode.find(p => p.id === periodeId) || opsiPeriode.find(p => p.isActive) || opsiPeriode[0];

  const [mahasiswa, dosen] = await Promise.all([
    buildRekapMahasiswa(db),
    buildSksDosen(db, { periodeId: pilih.id, bagiTim })
  ]);

  return { periode: pilih, opsiPeriode, bagiTim, dibuatPada: new Date().toISOString(), mahasiswa, dosen };
}

module.exports = { buildLaporanAwalSemester, MAGANG_AKTIF };
