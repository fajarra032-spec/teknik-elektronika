/**
 * helpers/modulPraktikumHelper.js
 *
 * Logika untuk fitur "Modul Praktikum": menampilkan job sheet praktikum
 * (lihat data/modulPraktikumData.js) pada mata kuliah yang bersifat
 * praktik - saat ini: Elektronika Digital, Mikrokontroler, PLC,
 * Perangkat Lunak Aplikasi, Aplikasi Komputer, Data dan Sistem Informasi,
 * Rangkaian Elektronika, Teknik Pengukuran, dan Menggambar Teknik.
 *
 * Deteksi jenis praktikum dilakukan lewat pencocokan kata kunci pada
 * kode/nama mata kuliah (bukan hardcode 1 kode saja), supaya tetap
 * terdeteksi walau kode MK berbeda antar program studi/peminatan
 * (lihat scripts/sync-matakuliah-dari-rps.js - "Elektronika Digital"
 * dan "Programmable Logic Control (PLC)" dipakai di lebih dari 1 kode MK).
 *
 * Konsep publikasi:
 *  - Template modul (data/modulPraktikumData.js) adalah isi DEFAULT/AWAL.
 *  - Dosen bisa menimpa per-modul (catatan, tanggal pelaksanaan, upload
 *    job sheet sendiri) lewat field `mataKuliah.modulPraktikum` (array of
 *    override, 1 entri per modul, dicocokkan lewat field `id`).
 *  - Setiap modul punya status `aktif` (dipublikasikan ke ELK-Learning
 *    mahasiswa atau belum) - default TIDAK aktif sampai dosen menyalakan,
 *    supaya keputusan "mau pakai modul ini atau tidak" sepenuhnya ada di
 *    tangan dosen pengampu, sesuai mata kuliahnya.
 */

const TEMPLATE = require('../data/modulPraktikumData');

const JENIS_LABEL = {
  elektronika_digital: 'Elektronika Digital',
  mikrokontroler: 'Mikrokontroler',
  plc: 'PLC (Programmable Logic Control)',
  perangkat_lunak_aplikasi: 'Perangkat Lunak Aplikasi',
  aplikasi_komputer: 'Aplikasi Komputer',
  data_sistem_informasi: 'Data dan Sistem Informasi',
  rangkaian_elektronika: 'Rangkaian Elektronika',
  teknik_pengukuran: 'Teknik Pengukuran',
  menggambar_teknik: 'Menggambar Teknik'
};

// Kata kunci pencocokan (huruf kecil semua) - dicek terhadap "kode + nama" MK.
// Urutan penting untuk frasa yang saling beririsan: 'perangkat lunak aplikasi'
// dan 'aplikasi komputer' dicek sebagai frasa utuh supaya tidak saling
// tertukar (keduanya sama-sama mengandung kata 'aplikasi').
const KEYWORDS = {
  elektronika_digital: ['elektronika digital'],
  mikrokontroler: ['mikrokontroler', 'mikrokontroller', 'mikrokontrol'],
  plc: ['programmable logic control', 'plc'],
  perangkat_lunak_aplikasi: ['perangkat lunak aplikasi'],
  aplikasi_komputer: ['aplikasi komputer'],
  data_sistem_informasi: ['data dan sistem informasi'],
  rangkaian_elektronika: ['rangkaian elektronika'],
  teknik_pengukuran: ['teknik pengukuran'],
  menggambar_teknik: ['menggambar teknik']
};

/**
 * Mendeteksi jenis praktikum dari sebuah dokumen mataKuliah.
 * @param {{kode?: string, nama?: string}} mk
 * @returns {'elektronika_digital'|'mikrokontroler'|'plc'|null}
 */
function detectJenisPraktikum(mk) {
  if (!mk) return null;
  const teks = ` ${(mk.kode || '')} ${(mk.nama || '')} `.toLowerCase();
  for (const jenis of Object.keys(KEYWORDS)) {
    if (KEYWORDS[jenis].some((kw) => teks.includes(kw))) return jenis;
  }
  return null;
}

/**
 * Menggabungkan template default modul praktikum dengan override milik
 * dosen (disimpan di field `modulPraktikum` pada dokumen mataKuliah).
 * @param {object} mk - dokumen mataKuliah (harus sudah termasuk field modulPraktikum bila ada)
 * @returns {{ jenis: string|null, jenisLabel: string|null, modulList: Array }}
 */
function getModulPraktikumList(mk) {
  const jenis = detectJenisPraktikum(mk);
  if (!jenis) return { jenis: null, jenisLabel: null, modulList: [] };

  const template = TEMPLATE[jenis] || [];
  const overrideList = (mk && mk.modulPraktikum) || [];

  const modulList = template.map((modul) => {
    const override = overrideList.find((o) => o.id === modul.id) || {};
    return {
      ...modul,
      aktif: override.aktif === true,
      tanggal: override.tanggal || null,
      catatanDosen: override.catatanDosen || '',
      fileUrl: override.fileUrl || null,
      fileNama: override.fileNama || null,
      updatedAt: override.updatedAt || null
    };
  });

  return { jenis, jenisLabel: JENIS_LABEL[jenis], modulList };
}

/**
 * Sama seperti getModulPraktikumList, tapi hanya modul yang sudah
 * dipublikasikan dosen (aktif === true) - dipakai di sisi ELK-Learning
 * mahasiswa.
 */
function getPublishedModulPraktikum(mk) {
  const hasil = getModulPraktikumList(mk);
  return { ...hasil, modulList: hasil.modulList.filter((m) => m.aktif) };
}

module.exports = {
  JENIS_LABEL,
  detectJenisPraktikum,
  getModulPraktikumList,
  getPublishedModulPraktikum
};
