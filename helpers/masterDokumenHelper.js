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
const { infoSopPerJudul } = require('./sopMasterMap');
const TIM = require('../data/akreditasi/timPersiapan');
const { PETA_MASTER: PETA_KURIKULUM } = require('./kurikulumHelper');

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
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Item SOP (kelompok B) yang terpetakan ke Buku Induk SOP: status DIAMBIL dari Buku Induk SOP
  // (sumber tunggal), bukan dari isian manual di Master Dokumen.
  let sop = {};
  try { sop = await infoSopPerJudul(); } catch (e) { console.error('Gagal membaca status SOP:', e.message); }
  items.forEach(i => {
    const s = sop[i.nama];
    if (i.kelompok === 'B' && s) {
      i.statusManual = i.status;
      i.status = s.statusMaster;
      i.sopKode = s.kode; i.sopStatus = s.status; i.sopUrl = s.url; i.sopVersi = s.versi;
    }
    // Item yang isinya sudah ada di Dokumen Kurikulum 2024: status awal "Ada" selama admin belum mengubahnya
    // (pilihan manual admin selalu menang). Disahkan/draft tidak ditimpa.
    // Penanggung jawab kelompok menurut SK Tim Persiapan Akreditasi (No. 5666/ELK/POLIDEWA/XI/2026)
    const pj = TIM.pjPerBidang[i.kelompok];
    if (pj) { i.pjNama = pj.nama; i.pjJabatan = pj.jabatan; }
    if (i.nama === 'SK Tim Persiapan Akreditasi') {
      i.timKet = `SK ${TIM.sk.nomor}, ${TIM.sk.tanggal}`;
      if (i.status === 'belum') { i.statusManual = i.status; i.status = 'disahkan'; i.statusDariKurikulum = true; }
    }
    const kur = PETA_KURIKULUM[i.nama];
    if (kur && !i.sopKode) {
      i.kurikulumBagian = kur.bagian; i.kurikulumKet = kur.ket;
      if (i.status === 'belum') { i.statusManual = i.status; i.status = kur.status; i.statusDariKurikulum = true; }
    }
  });
  return items;
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
    return { kode, nama: (tpl && tpl.nama) || list[0].kelompokNama || kode, items: list, progres: hitungProgresMaster(list), pj: TIM.pjPerBidang[kode] || null };
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

/** Progres per anggota Tim Persiapan Akreditasi (gabungan kelompok yang menjadi tanggung jawabnya). */
function ringkasTim(grouped) {
  const per = Object.fromEntries(grouped.map(g => [g.kode, g]));
  return TIM.anggota.map(a => {
    const gs = a.bidang.map(k => per[k]).filter(Boolean);
    const total = gs.reduce((x, g) => x + g.progres.total, 0);
    const disahkan = gs.reduce((x, g) => x + g.progres.disahkan, 0);
    const ada = gs.reduce((x, g) => x + g.progres.ada, 0);
    return { nama: a.nama, jabatan: a.jabatan, bidang: a.bidang, kelompok: gs.map(g => ({ kode: g.kode, nama: g.nama, persen: g.progres.persen, total: g.progres.total })),
      total, disahkan, ada, persen: total ? Math.round(((disahkan + ada * 0.5) / total) * 100) : 0 };
  });
}

/** Tambahkan item template yang belum ada pada periode lama (tidak menyentuh item yang sudah ada). */
async function sinkronTemplate(periodeId) {
  const sudah = await db.collection(COL).where('periodeId', '==', periodeId).get();
  const ada = new Set(sudah.docs.map(d => `${d.data().kelompok}|${d.data().nama}`));
  const baru = flattenTemplate().filter(t => !ada.has(`${t.kelompok}|${t.nama}`));
  const now = new Date().toISOString();
  for (let i = 0; i < baru.length; i += 400) {
    const batch = db.batch();
    baru.slice(i, i + 400).forEach(t => batch.set(db.collection(COL).doc(), { periodeId, ...t, status: 'belum', picNama: '', catatan: '', sumber: '', periodeData: '', fileId: null, fileUrl: null, fileName: null, createdAt: now, updatedAt: now }));
    await batch.commit();
  }
  return baru.length;
}

function masterToCsv(grouped, periodeNama) {
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lines = [`Master Dokumen Prodi - ${periodeNama}`, '',
    ['Kelompok', 'PJ Tim (SK)', 'Sub', 'Dokumen', 'Keterangan', 'Status', 'PIC', 'Sumber', 'Periode Data', 'Bukti (tautan)', 'Catatan'].map(esc).join(',')];
  grouped.forEach(g => g.items.forEach(i => lines.push([
    `${g.kode}. ${g.nama}`, g.pj ? g.pj.nama : '', i.sub || '', i.nama, i.keterangan || '',
    (STATUS_MASTER[i.status] || STATUS_MASTER.belum).label, i.picNama || '', i.sumber || '', i.periodeData || '', i.fileUrl || '', i.catatan || ''
  ].map(esc).join(','))));
  return lines.join('\r\n');
}

module.exports = { COL, seedMasterDokumen, sinkronTemplate, ringkasTim, getMasterItems, groupMaster, hitungProgresMaster, uploadBuktiMaster, masterToCsv, STATUS_MASTER };
