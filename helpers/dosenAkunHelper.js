// helpers/dosenAkunHelper.js
// Satu-satunya tempat yang memetakan dokumen 'dosen' <-> akun 'users'.
// Autentikasi memakai users.dosenId (lihat middleware/auth.js), sedangkan
// dosen.userId bisa kosong. Karena itu keduanya dipakai: users.dosenId utama,
// dosen.userId sebagai cadangan.

/** @returns {Promise<Object<string,string>>} dosenId -> uid akun */
async function petaUserPerDosen(db) {
  const [uSnap, dSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'dosen').get(),
    db.collection('dosen').get()
  ]);
  const peta = {};
  dSnap.docs.forEach(d => { const uid = d.data().userId; if (uid) peta[d.id] = uid; }); // cadangan
  uSnap.docs.forEach(u => { const dId = u.data().dosenId; if (dId) peta[dId] = u.id; }); // utama
  return peta;
}

/** @returns {Promise<string|null>} uid akun untuk satu dosenId */
async function uidDariDosenId(db, dosenId) {
  if (!dosenId) return null;
  const u = await db.collection('users').where('dosenId', '==', dosenId).limit(1).get();
  if (!u.empty) return u.docs[0].id;
  const d = await db.collection('dosen').doc(dosenId).get();
  return d.exists && d.data().userId ? d.data().userId : null;
}

module.exports = { petaUserPerDosen, uidDariDosenId };
