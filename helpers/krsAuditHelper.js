/**
 * helpers/krsAuditHelper.js
 *
 * Pemeriksaan (READ-ONLY) KRS/enrollment mahasiswa untuk menemukan penyebab
 * "kebocoran" tugas - mis. mahasiswa angkatan 2024 menerima tugas Bahasa
 * Indonesia milik angkatan 2026. Tidak menulis apa pun ke database.
 *
 * Cara tugas sampai ke mahasiswa (dari kode): dokumen `tugas` hanya punya
 * `mkId` + `periode` (TIDAK ada kelas/angkatan). Mahasiswa melihat tugas
 * semua `mkId` yang ia punya enrollment `active`-nya. Maka kebocoran terjadi
 * kalau ada enrollment yang "salah" mengarah ke dokumen MK itu. Pemeriksa ini
 * mencari 5 jenis temuan:
 *
 *  A. tugasBocor      - mahasiswa punya enrollment aktif ke MK X, tapi HANYA
 *                       untuk periode lain (mis. Ganjil 2024/2025), sementara
 *                       MK X punya tugas untuk periode yang BUKAN periode
 *                       pengambilannya (mis. tugas Ganjil 2026/2027). Ini
 *                       pola enrollment histori (termasuk hasil script input
 *                       nilai lama) yang masih 'active'.
 *  B. kelasTidakSesuai - enrollment periode terpilih ke dokumen MK yang
 *                       field `kelas`-nya terisi tapi beda dengan kelas
 *                       mahasiswa (atau mahasiswa tanpa kelas).
 *  C. ganda            - enrollment dobel pada periode yang sama: dokumen
 *                       enrollment duplikat, atau dua dokumen MK berkode sama
 *                       (kelas paralel) sekaligus.
 *  D. mkHilang         - enrollment ke dokumen MK yang sudah tidak ada.
 *  E. angkatanMinoritas - (indikasi, bukan bukti) mahasiswa angkatan lain
 *                       masuk ke MK yang >=70% pesertanya satu angkatan.
 *                       Bisa saja sah (mengulang MK).
 */

const { getAllMahasiswa, getAllMataKuliah } = require('./cache');
const { getAngkatanFromNim, normalizeKelas, getCurrentAcademicSemester } = require('./academicHelper');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Ambil enrollment aktif untuk sekumpulan userId (Firestore 'in' maks 30). */
async function getEnrollmentByUsers(db, userIds) {
  const snaps = await Promise.all(chunk(userIds, 30).map(c =>
    db.collection('enrollment').where('userId', 'in', c).where('status', '==', 'active').get()
  ));
  const out = [];
  snaps.forEach(s => s.docs.forEach(d => out.push({ id: d.id, ...d.data() })));
  return out;
}

/** Ambil semua tugas untuk sekumpulan mkId (Firestore 'in' maks 10). */
async function getTugasByMkIds(db, mkIds) {
  const snaps = await Promise.all(chunk(mkIds, 10).map(c =>
    db.collection('tugas').where('mkId', 'in', c).get()
  ));
  const out = [];
  snaps.forEach(s => s.docs.forEach(d => out.push({ id: d.id, ...d.data() })));
  return out;
}

/** Ambil semua enrollment aktif sebuah periode untuk sekumpulan mkId. */
async function getEnrollmentPeriodeByMkIds(db, mkIds, periode) {
  const snaps = await Promise.all(chunk(mkIds, 10).map(c =>
    db.collection('enrollment')
      .where('mkId', 'in', c)
      .where('semester', '==', periode)
      .where('status', '==', 'active')
      .get()
  ));
  const out = [];
  snaps.forEach(s => s.docs.forEach(d => out.push({ id: d.id, ...d.data() })));
  return out;
}

/**
 * @param {object} db
 * @param {object} opts
 * @param {string} opts.angkatan  - '2024', dst; 'semua' untuk semua angkatan
 * @param {string} [opts.kodeMk]  - batasi ke satu kode MK (mis. 'WUD3208')
 * @param {string} [opts.periode] - periode untuk temuan B/C/D/E (default: periode aktif)
 * @param {boolean} [opts.termasukLewat] - temuan A: sertakan tugas yang deadline-nya sudah lewat
 */
async function auditKrs(db, opts = {}) {
  const periodeAktif = getCurrentAcademicSemester().label;
  const periode = String(opts.periode || '').trim() || periodeAktif;
  const angkatan = String(opts.angkatan || '').trim();
  const kodeMk = String(opts.kodeMk || '').trim().toUpperCase();
  const termasukLewat = !!opts.termasukLewat;
  const nowIso = new Date().toISOString();

  // ---- Mahasiswa yang diperiksa (cache bersama, 0 read tambahan) ----
  const semuaMhs = await getAllMahasiswa(db);
  const mhsById = new Map(semuaMhs.map(m => [m.id, m]));
  const diperiksa = semuaMhs.filter(m =>
    angkatan === 'semua' || String(getAngkatanFromNim(m.nim)) === angkatan
  );
  const idDiperiksa = new Set(diperiksa.map(m => m.id));

  const hasil = {
    periodeAktif, periode, angkatan, kodeMk, termasukLewat,
    jumlahMahasiswa: diperiksa.length,
    jumlahEnrollment: 0,
    tugasBocor: [], kelasTidakSesuai: [], ganda: [], mkHilang: [], angkatanMinoritas: []
  };
  if (diperiksa.length === 0) return hasil;

  // ---- Data MK (cache) ----
  const semuaMk = await getAllMataKuliah(db);
  const mkById = new Map(semuaMk.map(m => [m.id, m]));
  const lolosKodeMk = (mkId) => {
    if (!kodeMk) return true;
    const mk = mkById.get(mkId);
    return !!mk && String(mk.kode || '').toUpperCase() === kodeMk;
  };

  // ---- Enrollment aktif semua mahasiswa terperiksa ----
  const enrollAll = (await getEnrollmentByUsers(db, diperiksa.map(m => m.id)))
    .filter(e => e.mkId && lolosKodeMk(e.mkId));
  hasil.jumlahEnrollment = enrollAll.length;

  const info = (userId) => {
    const m = mhsById.get(userId) || {};
    return { id: userId, nim: m.nim || '-', nama: m.nama || '(tanpa nama)', angkatan: getAngkatanFromNim(m.nim) || '-', kelas: m.kelas || '' };
  };
  const infoMk = (mkId) => {
    const mk = mkById.get(mkId);
    return mk ? { id: mkId, kode: mk.kode || '-', nama: mk.nama || '-', kelas: mk.kelas || '' } : { id: mkId, kode: '?', nama: '(MK tidak ditemukan)', kelas: '' };
  };

  // ============ D. MK hilang ============
  enrollAll.forEach(e => {
    if (!mkById.has(e.mkId)) {
      hasil.mkHilang.push({ mhs: info(e.userId), mk: infoMk(e.mkId), semester: e.semester || '-', enrollmentId: e.id, krsId: e.krsId || null });
    }
  });

  // ============ A. Tugas bocor ============
  // semestersByUserMk: userId -> mkId -> Set(semester enrollment)
  const semestersByUserMk = new Map();
  enrollAll.forEach(e => {
    if (!semestersByUserMk.has(e.userId)) semestersByUserMk.set(e.userId, new Map());
    const per = semestersByUserMk.get(e.userId);
    if (!per.has(e.mkId)) per.set(e.mkId, new Set());
    per.get(e.mkId).add(String(e.semester || '').trim());
  });

  const mkIdsUnik = Array.from(new Set(enrollAll.map(e => e.mkId)));
  if (mkIdsUnik.length > 0) {
    const tugasAll = await getTugasByMkIds(db, mkIdsUnik);
    const tugasByMk = new Map();
    tugasAll.forEach(t => {
      if (!tugasByMk.has(t.mkId)) tugasByMk.set(t.mkId, []);
      tugasByMk.get(t.mkId).push(t);
    });

    const bocorPerMhs = new Map();
    semestersByUserMk.forEach((perMk, userId) => {
      perMk.forEach((semSet, mkId) => {
        (tugasByMk.get(mkId) || []).forEach(t => {
          const periodeTugas = String(t.periode || periodeAktif).trim(); // sama seperti tab Tugas: tanpa periode dianggap periode aktif
          if (semSet.has(periodeTugas)) return;               // sesuai periode pengambilan -> aman
          const aktif = !!t.deadline && t.deadline > nowIso;
          if (!aktif && !termasukLewat) return;
          if (!bocorPerMhs.has(userId)) bocorPerMhs.set(userId, []);
          bocorPerMhs.get(userId).push({
            mk: infoMk(mkId),
            tugasId: t.id,
            judul: t.judul || '(tanpa judul)',
            periodeTugas,
            periodeEnrollment: Array.from(semSet).sort().join(', '),
            deadline: t.deadline || null,
            aktif
          });
        });
      });
    });

    bocorPerMhs.forEach((items, userId) => {
      items.sort((a, b) => String(a.deadline || '').localeCompare(String(b.deadline || '')));
      hasil.tugasBocor.push({ mhs: info(userId), items, jumlahAktif: items.filter(i => i.aktif).length });
    });
    hasil.tugasBocor.sort((a, b) => String(a.mhs.nim).localeCompare(String(b.mhs.nim)));
  }

  // ============ B & C. Kelas tidak sesuai + enrollment ganda (periode terpilih) ============
  const enrollPeriode = enrollAll.filter(e => String(e.semester || '').trim() === periode && mkById.has(e.mkId));

  enrollPeriode.forEach(e => {
    const mk = mkById.get(e.mkId);
    const kelasMk = normalizeKelas(mk.kelas);
    if (!kelasMk) return; // MK tidak dipisah per kelas -> tidak ada yang bisa dibandingkan
    const m = mhsById.get(e.userId) || {};
    const kelasMhs = normalizeKelas(m.kelas);
    if (kelasMhs !== kelasMk) {
      hasil.kelasTidakSesuai.push({
        mhs: info(e.userId), mk: infoMk(e.mkId), semester: e.semester,
        kelasMk, kelasMhs: kelasMhs || '(kosong)', enrollmentId: e.id, krsId: e.krsId || null
      });
    }
  });
  hasil.kelasTidakSesuai.sort((a, b) => String(a.mhs.nim).localeCompare(String(b.mhs.nim)));

  const perUserKode = new Map(); // `${userId}|${kode}` -> [enrollment]
  enrollPeriode.forEach(e => {
    const kode = mkById.get(e.mkId).kode || e.mkId;
    const key = `${e.userId}|${kode}`;
    if (!perUserKode.has(key)) perUserKode.set(key, []);
    perUserKode.get(key).push(e);
  });
  perUserKode.forEach((list) => {
    if (list.length < 2) return;
    const mkDistinct = new Set(list.map(e => e.mkId));
    hasil.ganda.push({
      mhs: info(list[0].userId),
      kode: mkById.get(list[0].mkId).kode,
      jenis: mkDistinct.size > 1 ? 'Dua dokumen MK berkode sama (kelas paralel)' : 'Dokumen enrollment duplikat',
      detail: list.map(e => ({ enrollmentId: e.id, mk: infoMk(e.mkId), krsId: e.krsId || null }))
    });
  });
  hasil.ganda.sort((a, b) => String(a.mhs.nim).localeCompare(String(b.mhs.nim)));

  // ============ E. Angkatan minoritas (indikasi) ============
  const mkIdsPeriode = Array.from(new Set(enrollPeriode.map(e => e.mkId)));
  if (mkIdsPeriode.length > 0) {
    const semuaPeserta = await getEnrollmentPeriodeByMkIds(db, mkIdsPeriode, periode);
    const pesertaPerMk = new Map();
    semuaPeserta.forEach(e => {
      if (!pesertaPerMk.has(e.mkId)) pesertaPerMk.set(e.mkId, new Map()); // userId -> true (dedup)
      pesertaPerMk.get(e.mkId).set(e.userId, true);
    });
    pesertaPerMk.forEach((peserta, mkId) => {
      const total = peserta.size;
      if (total < 5) return;
      const hitung = new Map();
      peserta.forEach((_, uid) => {
        const ang = String(getAngkatanFromNim((mhsById.get(uid) || {}).nim) || '?');
        hitung.set(ang, (hitung.get(ang) || 0) + 1);
      });
      let dominan = null, jumlahDominan = 0;
      hitung.forEach((n, ang) => { if (n > jumlahDominan) { dominan = ang; jumlahDominan = n; } });
      if (!dominan || jumlahDominan / total < 0.7) return;
      peserta.forEach((_, uid) => {
        if (!idDiperiksa.has(uid)) return;
        const ang = String(getAngkatanFromNim((mhsById.get(uid) || {}).nim) || '?');
        if (ang === dominan) return;
        hasil.angkatanMinoritas.push({
          mhs: info(uid), mk: infoMk(mkId),
          angkatanDominan: dominan, persenDominan: Math.round(jumlahDominan / total * 100), totalPeserta: total
        });
      });
    });
    hasil.angkatanMinoritas.sort((a, b) => String(a.mhs.nim).localeCompare(String(b.mhs.nim)));
  }

  return hasil;
}

module.exports = { auditKrs };
