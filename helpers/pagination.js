/**
 * helpers/pagination.js
 *
 * Helper paginasi berbasis CURSOR (startAfter) untuk query Firestore,
 * BUKAN offset/skip. Ini penting untuk hemat kuota: Firestore .offset(n)
 * tetap membaca (dan menghitung sebagai "read") semua dokumen yang
 * dilewati, jadi kalau dipakai untuk halaman ke-50 misalnya, Firestore
 * tetap membaca ~500 dokumen di belakang layar. Cursor (startAfter)
 * TIDAK membaca dokumen yang dilewati sama sekali - hanya index.
 *
 * Konsepnya:
 * - Setiap "cursor" adalah array nilai field-field yang dipakai orderBy,
 *   diambil dari dokumen TERAKHIR pada halaman sebelumnya, di-encode
 *   base64 supaya bisa dititipkan lewat query string URL (?after=...).
 * - Untuk tombol "Sebelumnya", kita tidak bisa mundur langsung di
 *   Firestore (tidak ada "startBefore" yang praktis dipakai bareng
 *   limit), jadi kita simpan riwayat cursor sebagai "trail" (tumpukan)
 *   di query string juga. Klik "Next" -> push cursor lama ke trail.
 *   Klik "Sebelumnya" -> pop cursor dari trail. Semua state ada di URL,
 *   tidak perlu session/DB tambahan, dan tidak ada baca dokumen ekstra.
 */

function encodeCursor(values) {
  if (values === null || values === undefined) return '';
  return Buffer.from(JSON.stringify(values), 'utf8').toString('base64url');
}

function decodeCursor(str) {
  if (!str) return null;
  try {
    const parsed = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

function encodeTrail(trailArray) {
  if (!Array.isArray(trailArray) || trailArray.length === 0) return '';
  return Buffer.from(JSON.stringify(trailArray), 'utf8').toString('base64url');
}

function decodeTrail(str) {
  if (!str) return [];
  try {
    const parsed = JSON.parse(Buffer.from(str, 'base64url').toString('utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Jalankan query Firestore dengan paginasi cursor.
 *
 * @param {FirebaseFirestore.Query} baseQuery - query yang SUDAH di-orderBy
 *   (wajib orderBy minimal 1 field yang nilainya dipakai sebagai cursor;
 *   disarankan tambahkan orderBy FieldPath.documentId() di akhir sebagai
 *   tie-breaker supaya urutan antar-request selalu konsisten).
 * @param {Object} opts
 * @param {number} opts.pageSize - jumlah entri per halaman (default 10)
 * @param {string} opts.afterParam - nilai req.query.after (string ter-encode)
 * @param {string} opts.trailParam - nilai req.query.trail (string ter-encode)
 * @param {Function} opts.cursorFromDoc - (docSnapshot) => array nilai cursor
 *   untuk dokumen tsb, urutannya harus sama dengan urutan orderBy pada
 *   baseQuery. Contoh: (doc) => [doc.get('tanggal'), doc.id]
 *
 * @returns {Promise<{docs: FirebaseFirestore.QueryDocumentSnapshot[], hasNext: boolean, hasPrev: boolean, nextAfter: string, nextTrail: string, prevAfter: string, prevTrail: string}>}
 */
async function paginate(baseQuery, opts) {
  const pageSize = opts.pageSize || 10;
  const afterParam = opts.afterParam || '';
  const trailParam = opts.trailParam || '';
  const cursorFromDoc = opts.cursorFromDoc;

  const afterCursor = decodeCursor(afterParam);
  let q = baseQuery;
  if (afterCursor) {
    q = q.startAfter(...afterCursor);
  }

  // Ambil 1 ekstra untuk tahu apakah masih ada halaman berikutnya,
  // tanpa perlu query count() terpisah.
  const snap = await q.limit(pageSize + 1).get();
  const hasNext = snap.docs.length > pageSize;
  const docs = snap.docs.slice(0, pageSize);

  const hasPrev = !!afterParam;
  const currentTrail = decodeTrail(trailParam);

  let nextAfter = '', nextTrail = '';
  if (hasNext && docs.length > 0) {
    const lastDoc = docs[docs.length - 1];
    nextAfter = encodeCursor(cursorFromDoc(lastDoc));
    nextTrail = encodeTrail([...currentTrail, afterParam || '']);
  }

  let prevAfter = '', prevTrail = '';
  if (hasPrev) {
    prevAfter = currentTrail.length ? currentTrail[currentTrail.length - 1] : '';
    prevTrail = encodeTrail(currentTrail.slice(0, -1));
  }

  return { docs, hasNext, hasPrev, nextAfter, nextTrail, prevAfter, prevTrail };
}

module.exports = { encodeCursor, decodeCursor, encodeTrail, decodeTrail, paginate };
