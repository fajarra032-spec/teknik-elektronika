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
 * SKS DOSEN - dua sumber data, jadwal diutamakan:
 *   (1) koleksi `bebanMengajar` (1 dokumen = 1 SESI mengajar, hasil
 *       scripts/sinkron-beban-dosen-dari-jadwal.js dari dokumen jadwal resmi).
 *       Bila sebuah periode punya data di sini, periode itu HANYA memakai
 *       sumber ini. Sesi gabungan kelas (mis. "Gabungan Kelas A & B")
 *       dihitung SEKALI; kelas paralel berjadwal terpisah = dua sesi.
 *   (2) pengampu di mata kuliah: mataKuliah/{id}/pengampuPeriode/{periodeId}
 *       .dosenIds (periode aktif tanpa subdokumen -> mataKuliah.dosenIds).
 *       Dipakai untuk periode yang belum punya data jadwal. Tiap dokumen MK
 *       dihitung sendiri-sendiri, jadi MK kelas paralel / kelas gabungan yang
 *       dipecah jadi dua dokumen (ELK1A & ELK1B) terhitung dobel - itu
 *       kelemahan sumber ini, makanya jadwal diutamakan.
 * Untuk periode bersumber jadwal, hasil dibandingkan dengan sumber (2) dan
 * selisihnya ditampilkan (tabel "Selisih dengan data pengampu MK").
 * MK/sesi diampu tim (>1 dosen): SKS penuh untuk tiap dosen, atau dibagi rata
 * bila opsi `bagiTim` aktif. Dosen di jadwal yang belum ada di koleksi
 * `dosen` tetap tampil (berdasarkan nama) dan otomatis tertaut begitu
 * ditambahkan ke data dosen.
 */

const { getAllMahasiswa, getAllMataKuliah } = require('./cache');
const { getAngkatanFromNim, generatePeriodeOptions, getActivePeriodeId, bandingkanLabelPeriode } = require('./academicHelper');
const { kunciNama } = require('./namaDosen');

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
  const [dosenSnap, mkList, sesiSnap] = await Promise.all([
    db.collection('dosen').get(),
    getAllMataKuliah(db),
    db.collection('bebanMengajar').get()
  ]);
  const dosenMap = new Map(dosenSnap.docs.map(d => [d.id, { id: d.id, nama: d.data().nama || '(tanpa nama)', nip: d.data().nip || '' }]));

  // kunci nama -> daftar id dosen. Dipakai menautkan dosen di jadwal ke data dosen.
  const kunciKandidat = new Map();
  dosenMap.forEach(d => {
    const k = kunciNama(d.nama);
    if (!kunciKandidat.has(k)) kunciKandidat.set(k, []);
    kunciKandidat.get(k).push(d.id);
  });

  const riwayat = await getRiwayatPengampuSemuaMk(db, mkList);

  // id dosen yang benar-benar dipakai sebagai pengampu di mata kuliah (semua periode)
  const dosenDipakai = new Set();
  mkList.forEach(mk => (mk.dosenIds || []).forEach(id => dosenDipakai.add(id)));
  riwayat.forEach(per => per.forEach(v => v.dosenIds.forEach(id => dosenDipakai.add(id))));

  /** Tautkan kunci nama ke satu id dosen. Bila nama ganda di data dosen, pilih
   *  satu-satunya yang dipakai di mata kuliah; kalau tetap tidak jelas -> null. */
  const cariIdDosen = (kunci) => {
    const arr = kunciKandidat.get(kunci) || [];
    if (arr.length === 1) return arr[0];
    if (arr.length > 1) {
      const dipakai = arr.filter(id => dosenDipakai.has(id));
      return dipakai.length === 1 ? dipakai[0] : null;
    }
    return null;
  };
  const dosenGanda = [];
  kunciKandidat.forEach((arr) => {
    if (arr.length > 1) dosenGanda.push({ nama: dosenMap.get(arr[0]).nama, jumlah: arr.length });
  });

  const periodeAktifId = getActivePeriodeId();
  const labelPeriode = new Map();
  const urutanPeriode = new Map();
  generatePeriodeOptions(50, 5).forEach(p => { labelPeriode.set(p.id, p.label); urutanPeriode.set(p.id, p.urutan); });

  // identitas[key] = { id|null, nama, nip }  (key = id dosen, atau 'nama:<kunci>')
  const identitas = new Map();
  const dosenTidakDikenal = new Map();

  // beban[sumber]: Map<periodeId, Map<key, {sks, rincian:[]}>>
  const bebanMk = new Map();
  const bebanJadwal = new Map();
  const sesiTanpaDosen = new Map(); // periodeId -> [{namaMk, kelas, keterangan}]

  function tambah(target, periodeId, key, sksDihitung, rincian) {
    if (!target.has(periodeId)) target.set(periodeId, new Map());
    const per = target.get(periodeId);
    if (!per.has(key)) per.set(key, { sks: 0, rincian: [] });
    const b = per.get(key);
    b.sks += sksDihitung;
    b.rincian.push(rincian);
  }

  // ---------- sumber (2): pengampu di data MK ----------
  function catatMk(periodeId, dosenIds, mk) {
    const unik = Array.from(new Set(dosenIds.filter(Boolean)));
    if (unik.length === 0) return;
    const sksMk = parseFloat(mk.sks) || 0;
    const bagian = bagiTim ? sksMk / unik.length : sksMk;
    unik.forEach(did => {
      if (!dosenMap.has(did)) {
        dosenTidakDikenal.set(did, (dosenTidakDikenal.get(did) || 0) + 1);
        if (!identitas.has(did)) identitas.set(did, { id: did, nama: '(dosen tidak ditemukan: ' + did + ')', nip: '' });
      }
      tambah(bebanMk, periodeId, did, bagian, {
        mkId: mk.id, kode: mk.kode || '-', nama: mk.nama || '-', kelas: mk.kelas || '',
        semesterKurikulum: mk.semester || '', sksMk, sksDihitung: round2(bagian), tim: unik.length, gabungan: false, sumber: 'data-mk'
      });
    });
  }
  mkList.forEach(mk => {
    const per = riwayat.get(mk.id) || new Map();
    per.forEach((v, pid) => {
      if (v.label) labelPeriode.set(pid, v.label);
      if (v.urutan) urutanPeriode.set(pid, v.urutan);
      catatMk(pid, v.dosenIds, mk);
    });
    if (!per.has(periodeAktifId) && Array.isArray(mk.dosenIds) && mk.dosenIds.length > 0) {
      catatMk(periodeAktifId, mk.dosenIds, mk);
    }
  });

  // ---------- sumber (1): sesi dari jadwal ----------
  sesiSnap.docs.forEach(doc => {
    const x = doc.data();
    const pid = x.periodeId;
    if (!pid) return;
    if (x.periodeLabel) labelPeriode.set(pid, x.periodeLabel);
    if (x.urutan) urutanPeriode.set(pid, x.urutan);
    const kelasTeks = (Array.isArray(x.kelas) ? x.kelas : [x.kelas]).filter(Boolean).join(' + ') + (x.gabungan ? ' (gabungan)' : '');
    const dosenSesi = Array.isArray(x.dosen) ? x.dosen : [];
    // pastikan periode tercatat bersumber jadwal walau sesinya belum ada dosen
    if (!bebanJadwal.has(pid)) bebanJadwal.set(pid, new Map());
    if (dosenSesi.length === 0) {
      if (!sesiTanpaDosen.has(pid)) sesiTanpaDosen.set(pid, []);
      sesiTanpaDosen.get(pid).push({ namaMk: x.namaMk || '-', kelas: kelasTeks, keterangan: x.keterangan || '' });
      return;
    }
    const sksSesi = parseFloat(x.sks) || 0;
    const bagian = bagiTim ? sksSesi / dosenSesi.length : sksSesi;
    dosenSesi.forEach(dd => {
      const kunci = dd.key || kunciNama(dd.nama);
      const idTertaut = (dd.id && dosenMap.has(dd.id)) ? dd.id : cariIdDosen(kunci);
      const key = idTertaut || ('nama:' + kunci);
      if (!identitas.has(key)) {
        const gandaTakJelas = (kunciKandidat.get(kunci) || []).length > 1;
        identitas.set(key, idTertaut
          ? { id: idTertaut, nama: dosenMap.get(idTertaut).nama, nip: dosenMap.get(idTertaut).nip }
          : { id: null, nama: dd.nama + (gandaTakJelas ? ' (nama ganda di data dosen)' : ' (belum ada di data dosen)'), nip: '' });
      }
      tambah(bebanJadwal, pid, key, bagian, {
        mkId: null, sesiId: doc.id, kode: x.kodeMk || '-', nama: x.namaMk || '-', kelas: kelasTeks,
        semesterKurikulum: x.semesterKurikulum || '', sksMk: sksSesi, sksDihitung: round2(bagian),
        tim: dosenSesi.length, gabungan: !!x.gabungan, keterangan: x.keterangan || '', sumber: 'jadwal'
      });
    });
  });

  // ---------- periode & sumber efektif ----------
  const semuaPid = new Set([...bebanMk.keys(), ...bebanJadwal.keys()]);
  const sumberPeriode = (pid) => (bebanJadwal.has(pid) ? 'jadwal' : 'data-mk');
  const bebanEfektif = (pid) => (bebanJadwal.has(pid) ? bebanJadwal.get(pid) : (bebanMk.get(pid) || new Map()));

  const semuaPeriode = Array.from(semuaPid)
    .map(id => ({ id, label: labelPeriode.get(id) || id, urutan: urutanPeriode.get(id) || 0, sumber: sumberPeriode(id) }))
    .sort((a, b) => (b.urutan - a.urutan) || bandingkanLabelPeriode(b.label, a.label));

  const infoDosen = (key) => identitas.get(key) || dosenMap.get(key) || { id: key, nama: '(dosen tidak ditemukan: ' + key + ')', nip: '' };

  // ---------- detail periode terpilih ----------
  const efektifTerpilih = bebanEfektif(periodeId);
  const sumberTerpilih = sumberPeriode(periodeId);
  const bebanMkTerpilih = bebanMk.get(periodeId) || new Map();
  const semuaKey = new Set([...dosenMap.keys(), ...efektifTerpilih.keys()]);

  const perDosen = Array.from(semuaKey).map(key => {
    const info = infoDosen(key);
    const b = efektifTerpilih.get(key);
    const rincian = b ? b.rincian.slice().sort((x, y) => String(x.kelas).localeCompare(String(y.kelas)) || String(x.kode).localeCompare(String(y.kode))) : [];
    const mkB = bebanMkTerpilih.get(key);
    return {
      id: info.id || key, nama: info.nama, nip: info.nip,
      jumlahMk: rincian.length,
      totalSks: b ? round2(b.sks) : 0,
      sksDataMk: mkB ? round2(mkB.sks) : 0,
      rincian
    };
  }).sort((a, b) => (b.totalSks - a.totalSks) || String(a.nama).localeCompare(String(b.nama)));

  // selisih jadwal vs data MK (hanya bila periode bersumber jadwal)
  let selisih = [];
  if (sumberTerpilih === 'jadwal') {
    selisih = perDosen
      .filter(d => Math.abs(d.totalSks - d.sksDataMk) > 0.001)
      .map(d => ({ id: d.id, nama: d.nama, sksJadwal: d.totalSks, sksDataMk: d.sksDataMk, beda: round2(d.totalSks - d.sksDataMk) }));
  }

  // ---------- matriks semua periode ----------
  const matriks = Array.from(new Set([...dosenMap.keys(), ...semuaPid.size ? Array.from(semuaPid).flatMap(p => Array.from(bebanEfektif(p).keys())) : []]))
    .map(key => {
      const info = infoDosen(key);
      const nilai = {};
      let adaData = false;
      semuaPeriode.forEach(p => {
        const b = bebanEfektif(p.id).get(key);
        nilai[p.id] = b ? round2(b.sks) : 0;
        if (b) adaData = true;
      });
      return { id: info.id || key, nama: info.nama, nip: info.nip, nilai, adaData };
    }).filter(r => r.adaData).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));

  const totalPerPeriode = {};
  semuaPeriode.forEach(p => { totalPerPeriode[p.id] = round2(matriks.reduce((s, r) => s + (r.nilai[p.id] || 0), 0)); });

  return {
    perDosen,
    matriks,
    semuaPeriode,
    totalPerPeriode,
    sumberTerpilih,
    selisih,
    sesiTanpaDosen: sesiTanpaDosen.get(periodeId) || [],
    dosenGanda,
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
