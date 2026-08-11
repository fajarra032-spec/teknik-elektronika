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

module.exports = {
  getCurrentAcademicSemester,
  getSemesterForDate,
  getAngkatanFromNim,
  getStudentCurrentSemester
};