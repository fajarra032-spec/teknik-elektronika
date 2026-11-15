// helpers/skPanitiaHelper.js
//
// "SK Panitia/Tim" di menu Kelola SK Dosen: SK Tim Persiapan Akreditasi (data hardcoded di
// data/akreditasi/timPersiapan.js, berkas PDF di public/dokumen/akreditasi/) yang bisa dikirim ke
// satu atau beberapa dosen sekaligus. Entri masuk ke koleksi sk_dosen (kategori 'panitia'), sama seperti
// SK lain, sehingga langsung tampil di menu SK Dosen masing-masing dosen. Satu berkas Drive dipakai
// bersama (hapus entri tidak menghapus berkas selama masih dipakai dosen lain).

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const TIM = require('../data/akreditasi/timPersiapan');

const KODE = 'sk-panitia-5666';
const BERKAS = path.join(__dirname, '../public/dokumen/akreditasi', TIM.sk.berkasNama);
const JUDUL = `SK Tim Persiapan Akreditasi Prodi D3 Teknik Elektronika (No. ${TIM.sk.nomor})`;

const dasarNama = n => String(n || '').split(',')[0].toLowerCase().replace(/\s+/g, ' ').trim();

const info = () => ({
  kode: KODE, judul: JUDUL, nomor: TIM.sk.nomor, tanggal: TIM.sk.tanggal, tentang: TIM.sk.tentang,
  berkasUrl: TIM.sk.berkasUrl, berkasAda: fs.existsSync(BERKAS),
  anggota: TIM.anggota.map(a => ({ nama: a.nama, jabatan: a.jabatan, bidang: a.bidang }))
});

/** id dosen di database yang namanya sama dengan anggota tim (dasar nama tanpa gelar). */
function idDosenAnggotaTim(dosenList) {
  const dasarTim = new Set(TIM.anggota.map(a => dasarNama(a.nama)));
  return new Set(dosenList.filter(d => dasarTim.has(dasarNama(d.nama))).map(d => d.id));
}

async function idDosenSudahTerkirim(db) {
  const snap = await db.collection('sk_dosen').where('sumber', '==', KODE).get();
  return new Set(snap.docs.map(d => d.data().dosenId));
}

/**
 * Kirim SK Panitia ke banyak dosen. Berkas diunggah ke Drive SEKALI (atau memakai berkas yang sudah
 * pernah diunggah). Dosen yang sudah menerimanya dilewati.
 * deps: { db, drive, folderId, userId, userPerDosen, createNotification }
 */
async function kirimKeDosen(dosenIds, deps) {
  const { db, drive, folderId, userId, userPerDosen, createNotification } = deps;
  const ids = [...new Set((Array.isArray(dosenIds) ? dosenIds : [dosenIds]).filter(Boolean))];
  if (!ids.length) return { error: 'Pilih minimal satu dosen.' };
  if (!fs.existsSync(BERKAS)) return { error: `Berkas PDF SK tidak ditemukan di ${BERKAS}` };

  const sudah = await idDosenSudahTerkirim(db);
  const target = ids.filter(id => !sudah.has(id));
  const dilewati = ids.length - target.length;
  if (!target.length) return { terkirim: 0, dilewati, gagal: [] };

  // berkas Drive: pakai ulang bila SK ini pernah dikirim ke dosen lain
  let fileId, fileUrl;
  const lama = await db.collection('sk_dosen').where('sumber', '==', KODE).limit(1).get();
  if (!lama.empty && lama.docs[0].data().fileId) {
    ({ fileId, fileUrl } = lama.docs[0].data());
  } else {
    const up = await drive.files.create({
      resource: { name: TIM.sk.berkasNama, parents: [folderId] },
      media: { mimeType: 'application/pdf', body: Readable.from(fs.readFileSync(BERKAS)) },
      fields: 'id'
    });
    fileId = up.data.id;
    await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
    fileUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  let terkirim = 0;
  const gagal = [];
  for (const dosenId of target) {
    try {
      await db.collection('sk_dosen').add({
        dosenId, kategori: 'panitia', judul: JUDUL, fileUrl, fileId, nomorSk: TIM.sk.nomor,
        sumber: KODE, tanggalUpload: new Date(), createdBy: userId
      });
      const uid = userPerDosen && userPerDosen[dosenId];
      if (uid && createNotification) {
        try {
          await createNotification(db, uid, { type: 'sk', title: 'SK Panitia baru', message: `${JUDUL}: Anda tercantum/terkait dalam SK ini.`, link: '/dosen/sk' });
        } catch (e) { console.error('SK panitia terkirim, tetapi notifikasi gagal dibuat:', e.message); }
      }
      terkirim++;
    } catch (e) {
      console.error('Gagal mengirim SK panitia ke dosen', dosenId, e.message);
      gagal.push(dosenId);
    }
  }
  return { terkirim, dilewati, gagal };
}

module.exports = { KODE, JUDUL, info, idDosenAnggotaTim, idDosenSudahTerkirim, kirimKeDosen, dasarNama };
