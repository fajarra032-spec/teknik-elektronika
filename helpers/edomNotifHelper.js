// helpers/edomNotifHelper.js
// Notifikasi (lonceng) untuk dosen saat mendapat evaluasi dosen oleh mahasiswa (EDOM).
//
// - SATU notifikasi per dosen + mata kuliah + periode (ID deterministik), bukan satu per
//   mahasiswa, supaya lonceng tidak banjir saat puluhan mahasiswa mengisi.
// - Identitas mahasiswa TIDAK disebut di notifikasi (EDOM bersifat anonim bagi dosen).
// - Respon berikutnya hanya memperbarui jumlah respon; notifikasi ditandai belum dibaca
//   lagi tiap kelipatan 10 respon.
// Aman dipanggil tanpa await: kegagalan hanya dicatat di log, tidak menggagalkan penyimpanan EDOM.
const { createNotificationOnce } = require('./notificationHelper');
const { uidDariDosenId } = require('./dosenAkunHelper');
const { TTLCache } = require('./cache');

const KELIPATAN_ALERT_ULANG = 10;

async function hitungRespon(db, dosenId, mkId, periodeId) {
  const q = db.collection('edom_respon')
    .where('dosenId', '==', dosenId).where('mkId', '==', mkId).where('periodeId', '==', periodeId);
  try { return (await q.count().get()).data().count || 0; }
  catch (e) { return (await q.get()).size; }
}

/** @param {{dosenId:string, mkId:string, mkKode?:string, mkNama?:string, periodeId:string, semester?:string}} info */
async function edomDiterima(db, info) {
  try {
    const uid = await uidDariDosenId(db, info.dosenId);
    if (!uid) { console.error('[notifikasi edom] akun user untuk dosenId', info.dosenId, 'tidak ditemukan'); return; }

    const jumlah = await hitungRespon(db, info.dosenId, info.mkId, info.periodeId);
    const namaMk = [info.mkKode, info.mkNama].filter(Boolean).join(' - ') || 'mata kuliah Anda';
    const pesan = `Mahasiswa mengisi evaluasi (EDOM) untuk ${namaMk}${info.semester ? ' (' + info.semester + ')' : ''}. Respon masuk: ${jumlah}. Lihat hasilnya di menu Edom.`;
    const docId = `edom-${info.dosenId}-${info.mkId}-${info.periodeId}`;

    const baru = await createNotificationOnce(db, uid, docId, {
      type: 'edom-diterima',
      title: 'Anda mendapat evaluasi dosen (EDOM)',
      message: pesan,
      link: '/dosen/edom'
    });
    if (!baru) {
      const patch = { message: pesan };
      if (jumlah > 0 && jumlah % KELIPATAN_ALERT_ULANG === 0) { patch.read = false; patch.createdAt = new Date().toISOString(); }
      await db.collection('notifications').doc(docId).update(patch);
      require('./notificationHelper').invalidateNavbar && require('./notificationHelper').invalidateNavbar(uid);
    }
  } catch (e) {
    console.error('[notifikasi edom]', e.message);
  }
}

module.exports = { edomDiterima };
