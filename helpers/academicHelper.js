/**
 * Hitung label semester akademik untuk TANGGAL APAPUN (bukan cuma "sekarang").
 * Dipakai untuk merekonsiliasi dokumen `tugas`/`nilai` yang label periode-nya
 * kebetulan salah tersimpan (mis. akibat penyesuaian batas bulan semester) -
 * dengan menghitung ulang dari tanggal aslinya (deadline/createdAt), bukan
 * dari kapan dokumen itu disimpan.
 * @param {Date|string} dateInput
 */
function getSemesterForDate(dateInput) {
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  let semester, tahunAwal, tahunAkhir;

  // Semester Ganjil: 1 September - 28/29 Februari (6 bulan)
  // Semester Genap : 1 Maret - 31 Agustus (6 bulan)
  if (month >= 9 && month <= 12) {
    // September - Desember: Ganjil, tahun ajaran baru dimulai tahun ini
    semester = "Ganjil";
    tahunAwal = year;
    tahunAkhir = year + 1;
  } else if (month === 1 || month === 2) {
    // Januari - Februari: masih Ganjil, lanjutan dari September tahun lalu
    semester = "Ganjil";
    tahunAwal = year - 1;
    tahunAkhir = year;
  } else {
    // Maret - Agustus: Genap
    semester = "Genap";
    tahunAwal = year - 1;
    tahunAkhir = year;
  }
  return {
    semester,
    tahunAwal,
    tahunAkhir,
    label: `${semester} ${tahunAwal}/${tahunAkhir}`,
    tahunAkademik: `${tahunAwal}/${tahunAkhir}`
  };
}

function getCurrentAcademicSemester() {
  return getSemesterForDate(new Date());
}

function getAngkatanFromNim(nim) {
  if (!nim || nim.length < 2) return null;
  const twoDigit = parseInt(nim.substring(0, 2), 10);
  if (isNaN(twoDigit)) return null;
  return 2000 + twoDigit;
}

function getStudentCurrentSemester(angkatan) {
  const current = getCurrentAcademicSemester();
  const tahunAwal = current.tahunAwal;
  const isGanjil = current.semester === "Ganjil";
  let semester = (tahunAwal - angkatan) * 2;
  if (isGanjil) semester += 1;
  else semester += 2;
  return semester;
}

/**
 * ===== PERIODE / TAHUN AJARAN =====
 * Dipakai untuk fitur "Dosen Pengampu per Periode" di Kelola Mata Kuliah,
 * supaya pengampu satu MK bisa berbeda tiap semester tanpa menghapus
 * riwayat semester sebelumnya.
 *
 * Direpresentasikan sebagai deret angka (urutan) supaya mudah diurutkan &
 * digeser maju/mundur: setiap tahun ajaran punya 2 periode (Ganjil lalu Genap).
 *   urutan = 2 * tahunAwal + (0 untuk Ganjil, 1 untuk Genap)
 */
function periodeKeUrutan(tahunAwal, semester) {
  return 2 * tahunAwal + (semester === 'Genap' ? 1 : 0);
}

function urutanKePeriode(urutan) {
  const tahunAwal = Math.floor(urutan / 2);
  const semester = (((urutan % 2) + 2) % 2 === 0) ? 'Ganjil' : 'Genap';
  return { tahunAwal, tahunAkhir: tahunAwal + 1, semester };
}

/**
 * ID unik & konsisten untuk satu periode, dipakai sebagai doc ID Firestore.
 * Contoh: getPeriodeId('Ganjil', 2026, 2027) -> "ganjil-2026-2027"
 */
function getPeriodeId(semester, tahunAwal, tahunAkhir) {
  return `${String(semester).toLowerCase()}-${tahunAwal}-${tahunAkhir}`;
}

/**
 * Label yang ditampilkan ke user. Contoh: "Ganjil 2026/2027"
 */
function getPeriodeLabel(semester, tahunAwal, tahunAkhir) {
  return `${semester} ${tahunAwal}/${tahunAkhir}`;
}

/**
 * ID periode akademik yang sedang berjalan saat ini (berdasarkan tanggal hari ini).
 */
function getActivePeriodeId() {
  const current = getCurrentAcademicSemester();
  return getPeriodeId(current.semester, current.tahunAwal, current.tahunAkhir);
}

/**
 * Menghasilkan daftar periode untuk dropdown, urut dari yang terbaru ke
 * yang terlama (periode mendatang muncul paling atas).
 * @param {number} keBelakang jumlah periode sebelum periode aktif yang ikut ditampilkan
 * @param {number} keDepan jumlah periode setelah periode aktif yang ikut ditampilkan
 */
function generatePeriodeOptions(keBelakang = 6, keDepan = 1) {
  const current = getCurrentAcademicSemester();
  const urutanAktif = periodeKeUrutan(current.tahunAwal, current.semester);
  const options = [];

  for (let u = urutanAktif + keDepan; u >= urutanAktif - keBelakang; u--) {
    const { tahunAwal, tahunAkhir, semester } = urutanKePeriode(u);
    options.push({
      id: getPeriodeId(semester, tahunAwal, tahunAkhir),
      label: getPeriodeLabel(semester, tahunAwal, tahunAkhir),
      semester,
      tahunAwal,
      tahunAkhir,
      urutan: u,
      isActive: u === urutanAktif
    });
  }
  return options;
}

module.exports = {
  getCurrentAcademicSemester,
  getSemesterForDate,
  getAngkatanFromNim,
  getStudentCurrentSemester,
  getPeriodeId,
  getPeriodeLabel,
  getActivePeriodeId,
  generatePeriodeOptions,
  periodeKeUrutan,
  urutanKePeriode
};