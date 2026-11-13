// helpers/masterDokumenHelper.js
//
// Logika "Master Dokumen Prodi": seed template per periode, pengelompokan,
// progres, ekspor CSV, dan unggah bukti ke Google Drive.
// Koleksi Firestore: akreditasi_master (satu dokumen = satu item dokumen prodi).
// Query hanya memakai where('periodeId') supaya tidak butuh indeks komposit baru.

const { db } = require('../config/firebaseAdmin');
const drive = require('../config/googleDrive');
const { Readable } = require('stream');
const { getOrCreateSubFolder, DATA_WEB_FOLDER_ID } = require('./akreditasiHelper');
const { MASTER_DOKUMEN, STATUS_MASTER, flattenTemplate } = require('./masterDokumenConfig');

const COL = 'akreditasi_master';

/** Idempotent: hanya mengisi kalau periode belum punya item master sama sekali. */
async function seedMasterDokumen(periodeId) {
  const exist = await db.collection(COL).where('periodeId', '==', periodeId).limit(1).get();
  if (!exist.empty) return 0;
  const items = flattenTemplate();
  const now = new Date().toISOString();
  for (let i = 0; i < items.length; i += 400) {
    const batch = db.batch();
    items.slice(i, i + 400).forEach(it => {
      batch.set(db.collection(COL).doc(), {
        periodeId, ...it, status: 'belum', picNama: '', catatan: '',
        fileId: null, fileUrl: null, fileName: null,
        createdAt: now, updatedAt: now
      });
    });
    await batch.commit();
  }
  return items.length;
}

async function getMasterItems(periodeId) {
  const snap = await db.collection(COL).where('periodeId', '==', periodeId).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Kelompokkan item per kelompok A-L (mengikuti urutan template) + progres tiap kelompok. */
function groupMaster(items) {
  const byKode = {};
  items.forEach(it => { (byKode[it.kelompok] = byKode[it.kelompok] || []).push(it); });
  const urut = MASTER_DOKUMEN.map(g => g.kode);
  Object.keys(byKode).forEach(k => { if (!urut.includes(k)) urut.push(k); }); // kelompok tambahan manual
  return urut.filter(k => byKode[k]).map(kode => {
    const list = byKode[kode].sort((a, b) =>
      (a.sub || '').localeCompare(b.sub || '') || (a.urutan || 0) - (b.urutan || 0));
    const tpl = MASTER_DOKUMEN.find(g => g.kode === kode);
    return { kode, nama: (tpl && tpl.nama) || list[0].kelompokNama || kode, items: list, progres: hitungProgresMaster(list) };
  });
}

/** "Lengkap" = disahkan. "Ada" dihitung setengah supaya progres tidak menyesatkan. */
function hitungProgresMaster(items) {
  const total = items.length;
  const hitung = s => items.filter(i => i.status === s).length;
  const disahkan = hitung('disahkan'), ada = hitung('ada'), draft = hitung('draft');
  return {
    total, disahkan, ada, draft, belum: total - disahkan - ada - draft,
    persen: total ? Math.round(((disahkan + ada * 0.5) / total) * 100) : 0,
    adaBukti: items.filter(i => i.fileUrl).length
  };
}

async function uploadBuktiMaster({ periodeId, kelompok, file }) {
  const root = await getOrCreateSubFolder(DATA_WEB_FOLDER_ID, 'Akreditasi');
  const periodeFolder = await getOrCreateSubFolder(root, periodeId);
  const masterFolder = await getOrCreateSubFolder(periodeFolder, 'Master_Dokumen');
  const folderId = await getOrCreateSubFolder(masterFolder, `Kelompok_${kelompok}`);
  const res = await drive.files.create({
    resource: { name: `${Date.now()}_${file.originalname}`, parents: [folderId] },
    media: { mimeType: file.mimetype, body: Readable.from(file.buffer) },
    fields: 'id'
  });
  await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  return {
    fileId: res.data.id,
    fileUrl: `https://drive.google.com/file/d/${res.data.id}/view`,
    fileName: file.originalname
  };
}

function masterToCsv(grouped, periodeNama) {
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lines = [`Master Dokumen Prodi - ${periodeNama}`, '',
    ['Kelompok', 'Sub', 'Dokumen', 'Keterangan', 'Status', 'Penanggung Jawab', 'Bukti (tautan)', 'Catatan'].map(esc).join(',')];
  grouped.forEach(g => g.items.forEach(i => lines.push([
    `${g.kode}. ${g.nama}`, i.sub || '', i.nama, i.keterangan || '',
    (STATUS_MASTER[i.status] || STATUS_MASTER.belum).label, i.picNama || '', i.fileUrl || '', i.catatan || ''
  ].map(esc).join(','))));
  return lines.join('\r\n');
}

module.exports = { COL, seedMasterDokumen, getMasterItems, groupMaster, hitungProgresMaster, uploadBuktiMaster, masterToCsv, STATUS_MASTER };
