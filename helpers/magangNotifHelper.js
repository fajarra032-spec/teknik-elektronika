// helpers/magangNotifHelper.js
// ============================================================================
// NOTIFIKASI ALUR MAGANG (selain pengingat logbook harian yang ada di
// logbookNotifHelper.js).
//
//  KE MAHASISWA  : logbook disetujui / perlu diperbaiki, persetujuan minggu,
//                  logbook dikunci/dibuka, magang dimulai / dikunci / dibuka /
//                  diperpanjang, laporan di-ACC / revisi / dikomentari,
//                  nilai magang keluar, pengingat masa magang hampir berakhir.
//  KE DOSEN PA   : mahasiswa mengunggah laporan, mahasiswa mengajukan seminar,
//                  pengingat mahasiswa bimbingan yang magangnya segera berakhir.
//
// Semua fungsi AMAN dipanggil tanpa await (fire-and-forget): kegagalan
// notifikasi hanya dicatat di log dan tidak pernah menggagalkan aksi utama.
// Bahasa sengaja dibuat santai & hangat (mahasiswa: "kamu", dosen: "Bapak/Ibu").
// ============================================================================

const { TTLCache } = require('./cache');
const { createNotification, createNotificationOnce } = require('./notificationHelper');

const LINK_LOGBOOK = '/mahasiswa/magang/logbook';
const LINK_MAGANG = '/mahasiswa/magang';
const LINK_LAPORAN = '/mahasiswa/magang/laporan';

function aman(nama, fn) {
  return async function (...args) {
    try { return await fn(...args); } catch (e) { console.error(`[notifikasi magang] ${nama}:`, e.message); }
  };
}

function todayWITA() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
}
function potong(teks, n) {
  const t = String(teks || '').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}
/** 'YYYY-MM-DD' -> 'Senin, 3 November' */
function tglPendek(tanggal) {
  if (!tanggal || !/^\d{4}-\d{2}-\d{2}/.test(tanggal)) return '';
  return new Date(tanggal.slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
function tglLengkap(tanggal) {
  if (!tanggal || !/^\d{4}-\d{2}-\d{2}/.test(tanggal)) return '';
  return new Date(tanggal.slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
function selisihHari(dari, ke) {
  return Math.round((new Date(ke + 'T00:00:00Z') - new Date(dari + 'T00:00:00Z')) / 86400000);
}
function sapaOleh(oleh) { return oleh ? `${oleh}` : 'Pembimbing'; }

/** Dokumen `dosen` menyimpan uid akun di field userId (notifikasi ditujukan ke uid itu). */
async function uidDosen(db, dosenId) {
  return require('./dosenAkunHelper').uidDariDosenId(db, dosenId);
}

// ============================================================================
// KE MAHASISWA
// ============================================================================

const logbookDisetujui = aman('logbookDisetujui', async (db, { mahasiswaId, tanggal, oleh }) => {
  const tgl = tglPendek(tanggal);
  await createNotification(db, mahasiswaId, {
    type: 'logbook-disetujui',
    title: tgl ? `Logbook ${tgl} sudah disetujui ✅` : 'Logbook-mu sudah disetujui ✅',
    message: `${sapaOleh(oleh)} sudah menyetujui logbook-mu. Mantap, pertahankan ya!`,
    link: LINK_LOGBOOK
  });
});

const logbookDitolak = aman('logbookDitolak', async (db, { mahasiswaId, tanggal, alasan, oleh }) => {
  const tgl = tglPendek(tanggal);
  const ada = alasan && alasan !== 'Tidak ada alasan';
  await createNotification(db, mahasiswaId, {
    type: 'logbook-ditolak',
    title: tgl ? `Logbook ${tgl} perlu diperbaiki ✏️` : 'Ada logbook yang perlu diperbaiki ✏️',
    message: ada
      ? `Catatan dari ${sapaOleh(oleh)}: “${potong(alasan, 140)}”. Yuk perbaiki lalu simpan lagi.`
      : `${sapaOleh(oleh)} meminta logbook ini diperbaiki. Yuk cek lagi lalu simpan ulang.`,
    link: LINK_LOGBOOK
  });
});

const logbookBanyakDisetujui = aman('logbookBanyakDisetujui', async (db, { mahasiswaId, jumlah, oleh }) => {
  if (!jumlah) return;
  await createNotification(db, mahasiswaId, {
    type: 'logbook-disetujui',
    title: `${jumlah} logbook-mu sudah disetujui ✅`,
    message: `${sapaOleh(oleh)} sudah menyetujui logbook-mu sekaligus. Terus semangat ya!`,
    link: LINK_LOGBOOK
  });
});

const mingguDisetujui = aman('mingguDisetujui', async (db, { mahasiswaId, mingguKe, oleh, catatan }) => {
  const cat = potong(catatan, 140);
  await createNotification(db, mahasiswaId, {
    type: 'logbook-disetujui',
    title: `Logbook minggu ke-${mingguKe} sudah disetujui ✅`,
    message: `${sapaOleh(oleh)} sudah meninjau logbook minggu ini.${cat ? ` Catatan: “${cat}”.` : ''} Lembar mingguanmu siap dicetak.`,
    link: LINK_LOGBOOK
  });
});

const mingguDicabut = aman('mingguDicabut', async (db, { mahasiswaId, mingguKe, oleh }) => {
  await createNotification(db, mahasiswaId, {
    type: 'logbook-ditolak',
    title: `Persetujuan logbook minggu ke-${mingguKe} ditarik`,
    message: `${sapaOleh(oleh)} menarik persetujuan minggu ini, kemungkinan perlu konsultasi ulang. Cek lembar logbook-mu ya.`,
    link: LINK_LOGBOOK
  });
});

const logbookDikunci = aman('logbookDikunci', async (db, { mahasiswaId, oleh }) => {
  await createNotification(db, mahasiswaId, {
    type: 'logbook-kunci',
    title: 'Logbook-mu sudah dikunci 🔒',
    message: `${sapaOleh(oleh)} menyatakan logbook magangmu sudah lengkap dan siap dinilai. Kerja bagus!`,
    link: LINK_MAGANG
  });
});

const logbookDibuka = aman('logbookDibuka', async (db, { mahasiswaId, oleh }) => {
  await createNotification(db, mahasiswaId, {
    type: 'logbook-kunci',
    title: 'Kunci logbook dibuka kembali 🔓',
    message: `${sapaOleh(oleh)} membuka kunci logbook-mu, mungkin ada yang perlu dilengkapi. Cek lagi ya.`,
    link: LINK_LOGBOOK
  });
});

const periodeDimulai = aman('periodeDimulai', async (db, { mahasiswaId, perusahaan, tanggalMulai, tanggalSelesai }) => {
  const mulai = tglLengkap(tanggalMulai);
  const selesai = tglLengkap(tanggalSelesai);
  const rentang = mulai ? ` Mulai ${mulai}${selesai ? ` sampai ${selesai}` : ''}.` : '';
  await createNotification(db, mahasiswaId, {
    type: 'magang-periode',
    title: 'Magang kamu resmi dimulai 🎉',
    message: `${perusahaan ? `Kamu tercatat magang di ${perusahaan}.` : 'Periode magangmu sudah dibuka.'}${rentang} Jangan lupa isi logbook setiap hari kerja ya!`,
    link: LINK_MAGANG
  });
});

const periodeDikunci = aman('periodeDikunci', async (db, { mahasiswaId, alasan, oleh }) => {
  const a = alasan && alasan !== 'Tidak ada alasan' ? ` Alasannya: “${potong(alasan, 120)}”.` : '';
  await createNotification(db, mahasiswaId, {
    type: 'magang-periode',
    title: 'Periode magangmu dikunci sementara 🔒',
    message: `${sapaOleh(oleh)} mengunci periode magangmu.${a} Selama dikunci, logbook belum bisa diisi — hubungi pembimbing kalau ada yang ingin ditanyakan.`,
    link: LINK_MAGANG
  });
});

const periodeDibuka = aman('periodeDibuka', async (db, { mahasiswaId, oleh }) => {
  await createNotification(db, mahasiswaId, {
    type: 'magang-periode',
    title: 'Periode magangmu aktif lagi 🔓',
    message: `${sapaOleh(oleh)} sudah membuka kunci periode magangmu. Kamu bisa lanjut mengisi logbook.`,
    link: LINK_LOGBOOK
  });
});

const periodeDiperpanjang = aman('periodeDiperpanjang', async (db, { mahasiswaId, tanggalSelesaiBaru, oleh }) => {
  const sampai = tglLengkap(tanggalSelesaiBaru);
  await createNotification(db, mahasiswaId, {
    type: 'magang-periode',
    title: 'Masa magangmu diperpanjang 📅',
    message: `${sapaOleh(oleh)} memperpanjang periode magangmu${sampai ? ` sampai ${sampai}` : ''}. Tetap rajin isi logbook ya!`,
    link: LINK_MAGANG
  });
});

const laporanDireview = aman('laporanDireview', async (db, { mahasiswaId, laporanKe, status, catatan, oleh }) => {
  const nomor = laporanKe ? ` ke-${laporanKe}` : '';
  const cat = potong(catatan, 160);
  if (status === 'approved') {
    await createNotification(db, mahasiswaId, {
      type: 'laporan-magang',
      title: `Laporan magang${nomor} di-ACC 🎉`,
      message: `Selamat! ${sapaOleh(oleh)} sudah menyetujui laporanmu.${cat ? ` Catatan: “${cat}”.` : ''}`,
      link: LINK_LAPORAN
    });
  } else {
    await createNotification(db, mahasiswaId, {
      type: 'laporan-magang',
      title: `Laporan magang${nomor} perlu direvisi 📄`,
      message: `${sapaOleh(oleh)} memberi masukan untuk laporanmu.${cat ? ` Catatan: “${cat}”.` : ''} Perbaiki lalu unggah lagi, ya.`,
      link: LINK_LAPORAN
    });
  }
});

const laporanDikomentari = aman('laporanDikomentari', async (db, { mahasiswaId, laporanKe, penulis, isi }) => {
  await createNotification(db, mahasiswaId, {
    type: 'laporan-magang',
    title: `Ada komentar baru di laporan magang${laporanKe ? ` ke-${laporanKe}` : ''} 💬`,
    message: `${penulis || 'Admin'}: “${potong(isi, 140)}”`,
    link: LINK_LAPORAN
  });
});

const nilaiMagangKeluar = aman('nilaiMagangKeluar', async (db, { mahasiswaId, huruf }) => {
  await createNotification(db, mahasiswaId, {
    type: 'nilai-magang',
    title: 'Nilai magangmu sudah keluar 🎓',
    message: `Nilai akhir magangmu${huruf ? ` (${huruf})` : ''} sudah masuk ke KHS/Transkrip. Selamat atas perjuanganmu!`,
    link: '/mahasiswa/akademik/khs'
  });
});

// ============================================================================
// KE DOSEN PA
// ============================================================================

const laporanDiunggah = aman('laporanDiunggah', async (db, { dosenId, mahasiswaId, namaMahasiswa, laporanKe }) => {
  const uid = await uidDosen(db, dosenId);
  if (!uid) return;
  await createNotification(db, uid, {
    type: 'laporan-masuk',
    title: `${namaMahasiswa || 'Mahasiswa bimbingan'} mengunggah laporan magang${laporanKe ? ` ke-${laporanKe}` : ''} 📄`,
    message: 'Laporan baru menunggu ditinjau. Kalau sempat, mohon dicek ya, Bapak/Ibu.',
    link: mahasiswaId ? `/dosen/magang/${mahasiswaId}#laporan` : '/dosen/magang'
  });
});

const seminarDiajukan = aman('seminarDiajukan', async (db, { dosenId, namaMahasiswa, tanggal }) => {
  const uid = await uidDosen(db, dosenId);
  if (!uid) return;
  const tgl = tglLengkap((tanggal || '').slice(0, 10));
  await createNotification(db, uid, {
    type: 'seminar-diajukan',
    title: `${namaMahasiswa || 'Mahasiswa bimbingan'} mengajukan seminar magang 🎤`,
    message: `${tgl ? `Rencana seminar: ${tgl}. ` : ''}Pengajuan sedang diproses admin; Bapak/Ibu bisa memantaunya di menu seminar.`,
    link: '/dosen/seminar'
  });
});

// ============================================================================
// PENGINGAT BERKALA (dipanggil lazy dari middleware, sekali per beberapa jam;
// ID dokumen deterministik sehingga tidak pernah dobel)
// ============================================================================
const TITIK_PENGINGAT = [7, 3, 1];               // H-7, H-3, H-1 sebelum magang berakhir
const cekMhsCache = new TTLCache(6 * 60 * 60 * 1000);
const cekDosenCache = new TTLCache(6 * 60 * 60 * 1000);

/** Mahasiswa: masa magang segera berakhir (H-7 / H-3 / H-1). */
const cekPengingatPeriodeMahasiswa = aman('cekPengingatPeriodeMahasiswa', async (db, user) => {
  if (!user || user.role !== 'mahasiswa' || !user.id) return;
  const kunci = `${user.id}_${todayWITA()}`;
  if (cekMhsCache.get(kunci)) return;
  cekMhsCache.set(kunci, true);

  const snap = await db.collection('magangPeriod')
    .where('mahasiswaId', '==', user.id)
    .where('status', '==', 'active')
    .get();
  const hariIni = todayWITA();
  for (const d of snap.docs) {
    const p = d.data();
    if (!p.tanggalSelesai) continue;
    const sisa = selisihHari(hariIni, p.tanggalSelesai);
    const titik = [...TITIK_PENGINGAT].sort((a, b) => a - b).find((t) => sisa >= 0 && sisa <= t);   // titik terkecil yang sudah masuk
    if (titik === undefined) continue;
    const sisaTeks = sisa === 0 ? 'hari ini' : sisa === 1 ? 'besok' : `${sisa} hari lagi`;
    await createNotificationOnce(db, user.id, `magang-berakhir-${d.id}-h${titik}`, {
      type: 'magang-berakhir',
      title: sisa === 0 ? 'Hari terakhir magang! 🏁' : `Magangmu berakhir ${sisaTeks} ⏳`,
      message: `Masa magang berakhir ${tglLengkap(p.tanggalSelesai)}. Pastikan semua logbook sudah terisi dan sudah dikonsultasikan, lalu siapkan laporan akhirmu.`,
      link: LINK_MAGANG
    });
    break;                                          // satu pengingat per periode per hari sudah cukup
  }
});

/** Dosen PA: mahasiswa bimbingan yang magangnya berakhir dalam 7 hari (maks. satu notifikasi per minggu). */
const cekPengingatPeriodeDosen = aman('cekPengingatPeriodeDosen', async (db, user) => {
  if (!user || user.role !== 'dosen' || !user.dosenId) return;
  const kunci = `${user.dosenId}_${todayWITA()}`;
  if (cekDosenCache.get(kunci)) return;
  cekDosenCache.set(kunci, true);

  const { getMahasiswaBimbinganPa } = require('./pembimbingHelper');
  const mhs = await getMahasiswaBimbinganPa(user.dosenId);
  if (!mhs.length) return;
  const nama = new Map(mhs.map((m) => [m.id, m.nama || '-']));
  const ids = [...nama.keys()];
  const hariIni = todayWITA();
  const segera = [];
  for (let i = 0; i < ids.length; i += 10) {
    const snap = await db.collection('magangPeriod')
      .where('mahasiswaId', 'in', ids.slice(i, i + 10))
      .where('status', '==', 'active')
      .get();
    snap.docs.forEach((d) => {
      const p = d.data();
      if (!p.tanggalSelesai) return;
      const sisa = selisihHari(hariIni, p.tanggalSelesai);
      if (sisa >= 0 && sisa <= 7) segera.push({ nama: nama.get(p.mahasiswaId), sisa });
    });
  }
  if (!segera.length) return;
  segera.sort((a, b) => a.sisa - b.sisa);
  const daftar = segera.slice(0, 3).map((x) => x.nama).join(', ') + (segera.length > 3 ? `, dan ${segera.length - 3} lainnya` : '');
  // satu notifikasi per minggu (kunci = tahun-minggu kira-kira, dari tanggal / 7)
  const mingguKe = Math.floor(new Date(hariIni + 'T00:00:00Z').getTime() / (7 * 86400000));
  await createNotificationOnce(db, user.id, `magang-segera-berakhir-${user.dosenId}-${mingguKe}`, {
    type: 'magang-berakhir',
    title: `${segera.length} mahasiswa bimbingan segera selesai magang ⏳`,
    message: `${daftar}. Mungkin ini saat yang pas untuk menutup logbook dan mengingatkan laporan akhir mereka.`,
    link: '/dosen/magang'
  });
});

module.exports = {
  // mahasiswa
  logbookDisetujui, logbookDitolak, logbookBanyakDisetujui, mingguDisetujui, mingguDicabut,
  logbookDikunci, logbookDibuka,
  periodeDimulai, periodeDikunci, periodeDibuka, periodeDiperpanjang,
  laporanDireview, laporanDikomentari, nilaiMagangKeluar,
  // dosen
  laporanDiunggah, seminarDiajukan,
  // pengingat
  cekPengingatPeriodeMahasiswa, cekPengingatPeriodeDosen
};
