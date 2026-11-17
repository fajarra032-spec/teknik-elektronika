// helpers/statusDosenHelper.js
// Status kepegawaian dosen terhadap prodi:
//   homebase = dosen homebase (basis/induk) prodi ini
//   bantu    = dosen bantu (mengajar membantu prodi, homebase di tempat lain)
// Dokumen dosen lama yang belum punya field `statusDosen` dianggap 'homebase'.

const STATUS_DOSEN = {
  HOMEBASE: 'homebase',
  BANTU: 'bantu'
};

const STATUS_DOSEN_OPTIONS = [
  { value: STATUS_DOSEN.HOMEBASE, label: 'Dosen Homebase' },
  { value: STATUS_DOSEN.BANTU, label: 'Dosen Bantu' }
];

const DEFAULT_STATUS_DOSEN = STATUS_DOSEN.HOMEBASE;

/** Normalisasi nilai apa pun ke 'homebase' | 'bantu' (default homebase). */
function normalizeStatusDosen(value) {
  const v = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (v === 'bantu' || v === 'dosenbantu') return STATUS_DOSEN.BANTU;
  return DEFAULT_STATUS_DOSEN;
}

function getStatusDosen(dosen) {
  return normalizeStatusDosen(dosen && dosen.statusDosen);
}

function labelStatusDosen(value) {
  return getStatusDosen({ statusDosen: value }) === STATUS_DOSEN.BANTU ? 'Dosen Bantu' : 'Dosen Homebase';
}

function isDosenHomebase(dosen) { return getStatusDosen(dosen) === STATUS_DOSEN.HOMEBASE; }
function isDosenBantu(dosen) { return getStatusDosen(dosen) === STATUS_DOSEN.BANTU; }

/**
 * Boleh ditetapkan sebagai Dosen PA / pembimbing magang? Dosen bantu TIDAK boleh,
 * kecuali env DOSEN_BANTU_BOLEH_PA=on. (Dosen lama tanpa status = homebase = boleh.)
 */
function bolehJadiDosenPa(dosen) {
  if (String(process.env.DOSEN_BANTU_BOLEH_PA || '').toLowerCase() === 'on') return true;
  return !isDosenBantu(dosen);
}
const PESAN_DOSEN_BANTU_PA = 'Dosen Bantu tidak dapat ditetapkan sebagai Dosen PA / pembimbing magang. Pilih dosen homebase.';

module.exports = {
  bolehJadiDosenPa,
  PESAN_DOSEN_BANTU_PA,
  STATUS_DOSEN,
  STATUS_DOSEN_OPTIONS,
  DEFAULT_STATUS_DOSEN,
  normalizeStatusDosen,
  getStatusDosen,
  labelStatusDosen,
  isDosenHomebase,
  isDosenBantu
};
