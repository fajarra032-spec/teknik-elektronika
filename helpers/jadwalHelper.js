/**
 * helpers/jadwalHelper.js
 * Parser teks jadwal bebas isian admin di field `mataKuliah.jadwal`, contoh:
 * "Senin 08:00-10:30, Ruang A101". Awalnya cuma dipakai di routes/display.js
 * (papan display TV), sekarang dipakai juga oleh notifikasi pengingat
 * mengajar dosen (helpers/dosenReminderHelper.js) - jadi dipindah ke sini
 * supaya satu sumber kebenaran, tidak dobel logika parsing di 2 tempat.
 */

// Nama hari, index harus sama dengan Date.getDay() (0=Minggu ... 6=Sabtu)
const HARI_LIST = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseJadwalText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const hari = HARI_LIST.find(h => lower.includes(h.toLowerCase()));
  const jamMatch = text.match(/(\d{1,2}[.:]\d{2})\s*-\s*(\d{1,2}[.:]\d{2})/);
  if (!hari || !jamMatch) return null;
  const ruangMatch = text.match(/ruang\s*\S+/i);
  return {
    hari,
    jamMulai: jamMatch[1].replace('.', ':'),
    jamSelesai: jamMatch[2].replace('.', ':'),
    ruangan: ruangMatch ? ruangMatch[0] : ''
  };
}

module.exports = { HARI_LIST, parseJadwalText };
