/**
 * helpers/messengerHelper.js
 * Logika bersama untuk fitur Pesan Pribadi (Messenger) antar mahasiswa,
 * dosen, dan admin - dipakai oleh routes/pesan.js (halaman umum, semua
 * role) dan ditampilkan ringkas di dropdown navbar (partials/header.ejs).
 *
 * Memakai koleksi Firestore 'chats' yang SUDAH ADA sebelumnya (awalnya
 * hanya dipakai dosen->mahasiswa lewat routes/dosen/chat.js). Di sini
 * dipakai secara umum untuk semua kombinasi role, jadi routes/dosen/chat.js
 * yang lama tetap jalan seperti biasa (kompatibel, tidak diubah skemanya):
 *   { senderId, receiverId, message, timestamp: ISOString, read: boolean }
 *
 * PENTING soal identitas: senderId/receiverId di sini SELALU uid Firebase
 * Auth (sama dengan req.user.id) - BUKAN dosenId (id dokumen koleksi
 * 'dosen'). Dokumen dosen punya field `userId` yang menyimpan uid ini.
 */

const { TTLCache, getUserProfileByUid, getAllMahasiswa } = require('./cache');
const { createNotification } = require('./notificationHelper');

const COLLECTION = 'chats';
const NAVBAR_TTL_MS = 15 * 1000;
const navbarPesanCache = new TTLCache(NAVBAR_TTL_MS);
const adminListCache = new TTLCache(10 * 60 * 1000);
const dosenContactCache = new TTLCache(10 * 60 * 1000);

/** Daftar semua admin (untuk kontak "mulai obrolan baru" & lookup nama). */
async function getAllAdmins(db) {
  return adminListCache.getOrFetch('all', async () => {
    const snap = await db.collection('users').where('role', '==', 'admin').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

/** Daftar dosen sebagai kontak pesan: id di sini = uid (bukan dosenId). */
async function getAllDosenAsContacts(db) {
  return dosenContactCache.getOrFetch('all', async () => {
    const snap = await db.collection('dosen').get();
    return snap.docs
      .map(d => ({ dosenId: d.id, ...d.data() }))
      .filter(d => d.userId) // hanya dosen yang akunnya sudah aktif (punya login)
      .map(d => ({ id: d.userId, nama: d.nama, role: 'dosen', foto: d.foto || null }));
  });
}

/**
 * Daftar kontak yang boleh diajak mulai obrolan baru, sesuai role user yang
 * sedang login. Mahasiswa <-> Dosen <-> Admin bisa saling chat; sesama
 * mahasiswa/sesama dosen sengaja TIDAK disediakan di sini (bukan tujuan
 * utama fitur ini, dan supaya daftar kontak tidak membengkak).
 */
async function getContactsForUser(db, currentUser) {
  const admins = (await getAllAdmins(db))
    .filter(u => u.id !== currentUser.id)
    .map(u => ({ id: u.id, nama: u.nama || u.email || 'Admin', role: 'admin', foto: null }));

  if (currentUser.role === 'mahasiswa') {
    const dosen = await getAllDosenAsContacts(db);
    return [...dosen, ...admins];
  }
  if (currentUser.role === 'dosen') {
    const mhs = await getAllMahasiswa(db);
    const mahasiswa = mhs.map(m => ({ id: m.id, nama: m.nama || '-', role: 'mahasiswa', foto: m.foto || null }));
    return [...mahasiswa, ...admins];
  }
  if (currentUser.role === 'admin') {
    const [mhs, dosen] = await Promise.all([getAllMahasiswa(db), getAllDosenAsContacts(db)]);
    const mahasiswa = mhs.map(m => ({ id: m.id, nama: m.nama || '-', role: 'mahasiswa', foto: m.foto || null }));
    return [...mahasiswa, ...dosen];
  }
  return [];
}

/** Kirim pesan pribadi, sekaligus membuat notifikasi untuk penerima. */
async function sendMessage(db, sender, receiverId, message) {
  const text = (message || '').trim();
  if (!text || !receiverId || receiverId === sender.id) return null;

  const doc = {
    senderId: sender.id,
    receiverId,
    message: text.slice(0, 2000), // batasi panjang, jaga-jaga input tidak wajar
    timestamp: new Date().toISOString(),
    read: false
  };
  const ref = await db.collection(COLLECTION).add(doc);
  navbarPesanCache.delete(sender.id);
  navbarPesanCache.delete(receiverId);

  // Notifikasi otomatis untuk penerima - ini salah satu pemicu notifikasi
  // "otomatis dari sistem" yang terhubung langsung (lihat juga
  // helpers/nilaiHelper.js untuk pemicu nilai baru).
  await createNotification(db, receiverId, {
    type: 'pesan',
    title: `Pesan baru dari ${sender.nama || 'seseorang'}`,
    message: text.length > 80 ? text.slice(0, 80) + '…' : text,
    link: `/pesan/pribadi/${sender.id}`
  });

  return { id: ref.id, ...doc };
}

/**
 * Ambil riwayat pesan antara dua user. Kalau `sejak` diisi (ISO string),
 * hanya ambil pesan yang lebih baru dari itu (dipakai untuk kirim pesan
 * tanpa reload penuh, BUKAN untuk polling berkala).
 */
async function getMessages(db, userA, userB, sejak) {
  // Firestore tidak bisa query "OR" dua field berbeda dalam satu query,
  // jadi diambil dua arah lalu digabung & diurutkan di kode.
  let qSent = db.collection(COLLECTION).where('senderId', '==', userA).where('receiverId', '==', userB);
  let qRecv = db.collection(COLLECTION).where('senderId', '==', userB).where('receiverId', '==', userA);
  if (sejak) {
    qSent = qSent.where('timestamp', '>', sejak);
    qRecv = qRecv.where('timestamp', '>', sejak);
  }
  const [sentSnap, recvSnap] = await Promise.all([qSent.get(), qRecv.get()]);
  const all = [
    ...sentSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ...recvSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  ];
  all.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  return sejak ? all : all.slice(-100); // pemuatan awal: 100 pesan terakhir saja
}

/** Tandai semua pesan MASUK dari satu lawan bicara sebagai sudah dibaca. */
async function markConversationRead(db, userId, partnerId) {
  const snap = await db.collection(COLLECTION)
    .where('senderId', '==', partnerId)
    .where('receiverId', '==', userId)
    .where('read', '==', false)
    .limit(200)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
  navbarPesanCache.delete(userId);
}

/**
 * Ringkasan percakapan untuk navbar & halaman inbox: dikelompokkan per
 * lawan bicara, diurutkan dari pesan terbaru, lengkap nama & jumlah pesan
 * belum dibaca per percakapan. Di-cache singkat per user (lihat catatan
 * performa di notificationHelper.js - polanya sama).
 */
async function getConversations(db, userId) {
  return navbarPesanCache.getOrFetch(userId, async () => {
    const [sentSnap, recvSnap] = await Promise.all([
      db.collection(COLLECTION).where('senderId', '==', userId).orderBy('timestamp', 'desc').limit(200).get(),
      db.collection(COLLECTION).where('receiverId', '==', userId).orderBy('timestamp', 'desc').limit(200).get()
    ]);
    const all = [
      ...sentSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      ...recvSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    ];

    const byPartner = new Map();
    for (const m of all) {
      const partnerId = m.senderId === userId ? m.receiverId : m.senderId;
      const existing = byPartner.get(partnerId);
      if (!existing || m.timestamp > existing.lastMessage.timestamp) {
        byPartner.set(partnerId, {
          partnerId,
          lastMessage: m,
          unreadCount: existing ? existing.unreadCount : 0
        });
      }
      if (m.receiverId === userId && !m.read) {
        const entry = byPartner.get(partnerId);
        entry.unreadCount += 1;
      }
    }

    const conversations = Array.from(byPartner.values())
      .sort((a, b) => (a.lastMessage.timestamp < b.lastMessage.timestamp ? 1 : -1));

    // Lengkapi nama/foto lawan bicara masing-masing (pakai cache profil
    // yang sudah ada, jadi tidak nambah baca Firestore kalau user itu baru
    // saja dilihat middleware auth).
    const enriched = await Promise.all(conversations.map(async c => {
      const profile = await getUserProfileByUid(db, c.partnerId);
      return {
        ...c,
        partnerNama: profile ? (profile.nama || profile.email || 'Pengguna') : 'Pengguna',
        partnerRole: profile ? profile.role : null,
        partnerFoto: profile ? (profile.foto || null) : null
      };
    }));

    const unreadCount = enriched.reduce((sum, c) => sum + c.unreadCount, 0);
    return { unreadCount, items: enriched };
  });
}

/** Ringkasan buat navbar (dropdown) - hanya beberapa percakapan teratas. */
async function getNavbarSummary(db, userId) {
  if (!userId) return { unreadCount: 0, items: [] };
  const { unreadCount, items } = await getConversations(db, userId);
  return { unreadCount, items: items.slice(0, 5) };
}

module.exports = {
  getContactsForUser,
  sendMessage,
  getMessages,
  markConversationRead,
  getConversations,
  getNavbarSummary
};
