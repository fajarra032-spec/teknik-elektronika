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
 * Urutan KRONOLOGIS (angka) dari LABEL periode akademik (mis. "Ganjil
 * 2025/2026"). Dipakai untuk mengurutkan transkrip/KHS/rekap supaya
 * semester tersusun urut WAKTU - BUKAN alfabetis.
 *
 * Kenapa perlu fungsi khusus (tidak cukup `localeCompare` biasa): secara
 * alfabet huruf "a" pada "Ganjil" lebih kecil dari huruf "e" pada
 * "Genap", jadi `localeCompare` akan SELALU menaruh semua label "Ganjil
 * ..." sebelum semua label "Genap ...", BERAPA PUN TAHUNNYA. Akibatnya
 * begitu data mencakup lebih dari 1 tahun ajaran, urutannya kacau - mis.
 * "Ganjil 2026/2027" (semester 3, lebih baru) muncul SEBELUM "Genap
 * 2025/2026" (semester 2, lebih lama), padahal seharusnya sebaliknya.
 *
 * @param {string} label mis. "Ganjil 2025/2026"
 * @returns {number} makin besar = makin baru. Label yang formatnya tidak
 *   dikenali (mis. "-", kosong, atau format lama) diberi -Infinity supaya
 *   tetap konsisten ditaruh paling awal (gampang dicurigai kalau muncul),
 *   bukan malah mengacaukan urutan label lain yang valid.
 */
function urutanDariLabelPeriode(label) {
  const match = String(label || '').match(/^(Ganjil|Genap)\s+(\d{4})\/(\d{4})$/i);
  if (!match) return -Infinity;
  const semester = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  const tahunAwal = parseInt(match[2], 10);
  return periodeKeUrutan(tahunAwal, semester);
}

/**
 * Comparator siap pakai untuk Array.prototype.sort(), mengurutkan label
 * periode akademik (mis. "Ganjil 2025/2026") secara KRONOLOGIS - lihat
 * urutanDariLabelPeriode() di atas untuk alasan kenapa `localeCompare`
 * biasa tidak cukup untuk label seperti ini.
 */
function bandingkanLabelPeriode(a, b) {
  return urutanDariLabelPeriode(a) - urutanDariLabelPeriode(b);
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

/**
 * Normalisasi label kelas (mis. field `kelas` pada dokumen mahasiswa &
 * mataKuliah) supaya variasi penulisan seperti "ELK 1B", "elk1b", " ELK1B "
 * semuanya dianggap SAMA ("ELK1B"). Tanpa ini, mahasiswa yang kelasnya
 * ke-input dengan spasi (mis. "ELK 1B") tidak akan pernah cocok dengan
 * mata kuliah kelas paralel yang kelasnya tersimpan "ELK1B" (tanpa spasi) -
 * gejalanya: paket KRS/kelas tidak terbaca/tidak ditemukan padahal secara
 * kasat mata terlihat sama.
 * @param {string|null|undefined} kelas
 * @returns {string|null}
 */
function normalizeKelas(kelas) {
  if (!kelas) return null;
  const bersih = String(kelas).trim().toUpperCase().replace(/\s+/g, '');
  return bersih || null;
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
  urutanKePeriode,
  urutanDariLabelPeriode,
  bandingkanLabelPeriode,
  normalizeKelas
};