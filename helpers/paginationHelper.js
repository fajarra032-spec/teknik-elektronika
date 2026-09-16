// helpers/paginationHelper.js
//
// Helper pagination berbasis CURSOR (bukan offset) supaya benar-benar hemat
// kuota baca Firestore - bukan cuma menyembunyikan baris di tampilan.
//
// Kenapa cursor, bukan offset/skip halaman biasa?
// Firestore tetap MENGHITUNG (dan membebankan kuota) setiap dokumen yang
// "dilewati" kalau pakai .offset(n) - jadi buka halaman ke-20 tetap membaca
// 200 dokumen di belakang layar. Dengan .startAfter(nilaiTerakhirHalaman
// sebelumnya), Firestore cuma benar-benar membaca dokumen pada halaman yang
// diminta saja (mis. 10 dokumen per halaman, ya cuma 10 yang dibaca).
//
// Cara pakai singkat (lihat routes/admin/mahasiswa_list.js untuk contoh utuh):
//
//   const { cursor, history, semua } = getCursorPaging(req);
//   let query = db.collection('users').where('role','==','mahasiswa').orderBy('nim');
//   if (!semua) {
//     if (cursor) query = query.startAfter(cursor);
//     query = query.limit(PER_PAGE + 1); // +1 buat tahu apakah masih ada halaman berikutnya
//   }
//   const snapshot = await query.get();
//   const hasNext = !semua && snapshot.docs.length > PER_PAGE;
//   const docs = hasNext ? snapshot.docs.slice(0, PER_PAGE) : snapshot.docs;
//   const nextCursor = docs.length ? docs[docs.length - 1].data().nim : null;
//   const nextQuery = buildNextQuery(cursor, history, nextCursor);   // -> {cursor, h}
//   const prevQuery = history.length ? buildPrevQuery(history) : null; // -> {cursor, h} | null

/**
 * Baca state paging dari query string request.
 * - cursor: nilai field urut (mis. NIM) dari dokumen terakhir halaman sebelumnya
 * - history: daftar cursor halaman-halaman sebelumnya, supaya tombol "Sebelumnya" bisa mundur
 * - semua: kalau true, abaikan limit dan tampilkan semua data (dipakai user yang memang perlu lihat semua)
 */
function getCursorPaging(req) {
  const cursor = req.query.cursor || null;
  const history = req.query.h ? String(req.query.h).split(',').filter((v, i, arr) => !(v === '' && arr.length === 1)) : [];
  const semua = req.query.semua === '1';
  return { cursor, history, semua };
}

/** Query string (object) untuk pindah ke halaman berikutnya. */
function buildNextQuery(currentCursor, history, nextCursorValue) {
  const newHistory = [...history, currentCursor || ''];
  return { cursor: nextCursorValue, h: newHistory.join(',') };
}

/** Query string (object) untuk kembali ke halaman sebelumnya. */
function buildPrevQuery(history) {
  const newHistory = history.slice(0, -1);
  const prevRaw = history[history.length - 1];
  return { cursor: prevRaw === '' ? '' : prevRaw, h: newHistory.join(',') };
}

/**
 * Susun ulang URL dengan query params tertentu ditimpa/ditambah, sisanya
 * (filter search, angkatan, dll) tetap dipertahankan.
 */
function buildUrl(basePath, currentQuery, overrides) {
  const merged = { ...currentQuery, ...overrides };
  const params = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    params.set(k, v);
  });
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

module.exports = { getCursorPaging, buildNextQuery, buildPrevQuery, buildUrl };
