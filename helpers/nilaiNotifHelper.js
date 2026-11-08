// helpers/nilaiNotifHelper.js
// ============================================================================
// NOTIFIKASI NILAI UNTUK MAHASISWA
//   - nilaiTugas   : dosen menilai tugas (lewat pengumpulan maupun nilai langsung)
//   - nilaiLkm     : dosen memeriksa LKM praktikum
//   - nilaiAkhir   : nilai akhir MK dikunci/ditulis ke KHS-Transkrip (satu MK)
//   - nilaiAkhirBanyak : kunci satu kelas sekaligus
//
// Aman dipanggil tanpa await: kegagalan notifikasi hanya dicatat di log dan
// tidak pernah menggagalkan penyimpanan nilai. Nilai akhir memakai ID
// deterministik (mahasiswa+MK+periode+nilai), jadi menekan "Kunci semua"
// berulang kali TIDAK menggandakan notifikasi; baru kirim lagi bila nilainya berubah.
// ============================================================================
const { createNotification, createNotificationOnce } = require('./notificationHelper');

function aman(nama, fn) {
  return async function (...args) {
    try { return await fn(...args); } catch (e) { console.error(`[notifikasi nilai] ${nama}:`, e.message); }
  };
}
function potong(teks, n) {
  const t = String(teks || '').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}
function angka(n) {
  const v = parseFloat(n);
  return isNaN(v) ? String(n) : String(Math.round(v * 100) / 100);
}
function idAman(teks) { return String(teks || '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 60); }

async function namaMk(db, mkId) {
  if (!mkId) return '';
  const doc = await db.collection('mataKuliah').doc(mkId).get();
  return doc.exists ? (doc.data().nama || doc.data().kode || '') : '';
}

const nilaiTugas = aman('nilaiTugas', async (db, { mahasiswaId, tugasId, judul, mkId, nilai, komentar, oleh }) => {
  if (!mahasiswaId) return;
  const mk = await namaMk(db, mkId);
  const cat = potong(komentar, 140);
  await createNotification(db, mahasiswaId, {
    type: 'nilai',
    title: `Tugas “${potong(judul, 70)}” sudah dinilai 📝`,
    message: `${mk ? mk + ' · ' : ''}Nilaimu: ${angka(nilai)}.${cat ? ` Catatan${oleh ? ' dari ' + oleh : ' dosen'}: “${cat}”.` : ''}`,
    link: tugasId ? `/mahasiswa/elearning/tugas/${tugasId}` : '/mahasiswa/akademik'
  });
});

const nilaiLkm = aman('nilaiLkm', async (db, { mahasiswaId, mkId, modulJudul, nilai, catatan, oleh }) => {
  if (!mahasiswaId) return;
  const mk = await namaMk(db, mkId);
  const cat = potong(catatan, 140);
  const adaNilai = nilai !== null && nilai !== undefined && nilai !== '' && !isNaN(parseFloat(nilai));
  await createNotification(db, mahasiswaId, {
    type: 'nilai',
    title: `LKM${modulJudul ? ` “${potong(modulJudul, 60)}”` : ''} sudah diperiksa 🔬`,
    message: `${mk ? mk + ' · ' : ''}${adaNilai ? `Nilai praktikum: ${angka(nilai)}. ` : 'Dosen sudah memeriksa LKM-mu. '}${cat ? `Catatan${oleh ? ' dari ' + oleh : ' dosen'}: “${cat}”.` : ''}`.trim(),
    link: mkId ? `/mahasiswa/elearning/mk/${mkId}/modul` : '/mahasiswa/akademik'
  });
});

const nilaiAkhir = aman('nilaiAkhir', async (db, { mahasiswaId, kodeMk, namaMk: nama, nilai, semester }) => {
  if (!mahasiswaId || nilai === undefined || nilai === null || isNaN(parseFloat(nilai))) return;
  const { nilaiKeHuruf } = require('./nilaiHelper');
  const { huruf } = nilaiKeHuruf(nilai);
  await createNotificationOnce(db, mahasiswaId,
    `nilai-akhir-${mahasiswaId}-${idAman(kodeMk || nama)}-${idAman(semester)}-${idAman(angka(nilai))}`, {
      type: 'nilai',
      title: `Nilai akhir ${nama || kodeMk || 'mata kuliah'} sudah keluar 🎓`,
      message: `Nilai akhirmu: ${angka(nilai)} (${huruf})${semester ? ` untuk ${semester}` : ''}. Sudah masuk ke KHS dan Transkrip-mu.`,
      link: '/mahasiswa/akademik/khs'
    });
});

const nilaiAkhirBanyak = aman('nilaiAkhirBanyak', async (db, { items, kodeMk, namaMk: nama, semester }) => {
  for (const it of items || []) {
    await nilaiAkhir(db, { mahasiswaId: it.userId, kodeMk, namaMk: it.namaMk || nama, nilai: it.nilai, semester });
  }
});

module.exports = { nilaiTugas, nilaiLkm, nilaiAkhir, nilaiAkhirBanyak };
