// helpers/suratTugasNotifHelper.js
// Notifikasi (lonceng + WhatsApp otomatis) untuk dosen saat Surat Tugas terbit.
// Aman dipanggil tanpa await: kegagalan hanya dicatat di log, tidak pernah
// menggagalkan pembuatan surat.
const { createNotification } = require('./notificationHelper');

function potong(t, n) {
  t = String(t || '').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

/** dosenId (id dokumen 'dosen') -> id akun user. Cadangan: dosen.userId. */
async function userIdDariDosen(db, dosenId) {
  if (!dosenId) return null;
  const u = await db.collection('users').where('dosenId', '==', dosenId).limit(1).get();
  if (!u.empty) return u.docs[0].id;
  const d = await db.collection('dosen').doc(dosenId).get();
  return d.exists && d.data().userId ? d.data().userId : null;
}

/**
 * @param {{dosenId:string, namaKegiatan:string, nomorSurat?:string, tanggal?:string, tempat?:string}} info
 */
async function suratTugasTerbit(db, info) {
  try {
    const uid = await userIdDariDosen(db, info.dosenId);
    if (!uid) {
      console.error('[notifikasi surat tugas] akun user untuk dosenId', info.dosenId, 'tidak ditemukan');
      return;
    }
    const rincian = [info.tanggal, info.tempat].filter(Boolean).join(' · ');
    await createNotification(db, uid, {
      type: 'surat-tugas',
      title: 'Surat Tugas baru terbit',
      message: `${potong(info.namaKegiatan, 120)}${rincian ? ' (' + potong(rincian, 100) + ')' : ''}${info.nomorSurat ? '. No. ' + info.nomorSurat : ''}.`,
      link: '/dosen/surat'
    });
  } catch (e) {
    console.error('[notifikasi surat tugas]', e.message);
  }
}

module.exports = { suratTugasTerbit, userIdDariDosen };
