# Patch Integrasi WhatsApp Center v5 — Website Teknik Elektronika

Patch ini menambahkan menu **WhatsApp Center** ke dashboard admin website Teknik Elektronika.

## File yang ditambahkan
- `routes/admin/whatsapp.js` — halaman Inbox dan proxy server-side ke Notification API.
- `views/admin/whatsapp/index.ejs` — tampilan percakapan dan form balasan.
- `views/admin/whatsapp/dashboard.ejs` — dashboard ringkasan WhatsApp. **Baru di v3.**
- `views/admin/whatsapp/_tabs.ejs` — tab Dashboard / Inbox / Riwayat. **Baru di v3.**
- `views/admin/whatsapp/riwayat.ejs` — riwayat pengiriman (audit log). **Baru di v2.**

## File yang diubah
- `routes/admin/index.js` — memasang route `/admin/whatsapp`.
- `views/partials/header.ejs` — menambahkan menu WhatsApp Center pada navigasi admin.

## Konfigurasi environment website
Tambahkan dua variabel berikut ke file `.env` website Teknik Elektronika (bukan `.env` frontend):

```env
NOTIFICATION_API_URL=https://notification.polidewa.ac.id
NOTIFICATION_INTERNAL_KEY=SALIN_NILAI_INTERNAL_API_KEY_DARI_SERVER_NOTIFICATION
```

Nilai `NOTIFICATION_INTERNAL_KEY` harus sama dengan `INTERNAL_API_KEY` di:
`/mnt/storage/projects/polidewa-notification/.env`

Jangan mengirim nilai API Key ke chat, jangan memasukkannya ke kode frontend, dan jangan commit `.env` ke Git.

## Pemasangan di STB
1. Backup project website terlebih dahulu.
2. Ekstrak patch ke direktori project `/mnt/storage/projects/teknik-elektronika`, pertahankan struktur folder.
3. Tambahkan dua environment variable di `.env` website.
4. Pastikan `routes/admin/index.js` memuat route WhatsApp satu kali.
5. Restart hanya aplikasi website:
   `pm2 restart teknik-elektronika --update-env`
6. Login sebagai admin dan buka:
   `https://elektronika.polidewa.ac.id/admin/whatsapp`

## Keamanan
- Route dipasang di bawah router admin yang sudah memakai `verifyToken` dan `isAdmin`.
- API Key hanya digunakan di backend.
- Browser tidak pernah menerima API Key Notification.
- Endpoint internal Notification API tidak dipanggil langsung oleh frontend.

## Catatan kompatibilitas
Route mengharapkan endpoint Notification API berikut:
- `GET /internal/conversations`
- `GET /internal/conversations/:waId/messages`
- `POST /internal/messages`

Kode mencoba membaca array dari properti `conversations`/`messages`, `items`, `results`, atau array langsung. Jika struktur respons API berbeda, sesuaikan `unwrapArray()` pada `routes/admin/whatsapp.js`.

## Tambahan v5 — Pengingat kuliah dosen & mahasiswa
- `helpers/kuliahReminderHelper.js` (baru): penjadwal 1 tick/menit di dalam aplikasi website (tidak butuh cron/PM2 baru).
  - **Ringkasan pagi** (bawaan 06:30 WITA): 1 pesan berisi semua kelas hari itu, ke dosen pengampu dan mahasiswa peserta.
  - **Sebelum kelas** (bawaan MATI): set `KULIAH_REMINDER_MENIT=60` untuk pengingat 1 jam sebelum tiap kelas.
- Sumber: `mataKuliah.jadwal` (teks, boleh banyak sesi dipisah `;`), `mataKuliah.dosenIds`, dan `enrollment` berstatus `active`
  pada **periode akademik berjalan** (enrollment angkatan lama tidak ikut).
- Pesan dibuat sebagai notifikasi lonceng dengan ID deterministik (tidak ganda walau server restart), lalu diteruskan ke WA
  oleh `waNotifier` (opt-out, jam tenang, log, template). Pengingat kuliah tidak memakai kuota 5 pesan/hari.
- Hanya aktif bila `WA_AUTO_ENABLED=true`. Opsi `.env`: `KULIAH_REMINDER_ENABLED`, `KULIAH_PAGI_JAM`, `KULIAH_PAGI_BATAS`,
  `KULIAH_REMINDER_MENIT`, `KULIAH_UNTUK_DOSEN`, `KULIAH_UNTUK_MAHASISWA`.
- **Start penjadwal:** otomatis (cadangan lewat `notificationHelper`, begitu ada satu halaman login dibuka setelah restart).
  Agar pasti jalan sejak server hidup, tambahkan SATU baris di `app.js`, tepat di dalam callback `app.listen(...)`:
  ```js
  require('./helpers/kuliahReminderHelper').mulai(require('./config/firebaseAdmin').getFirebaseInstances().db);
  ```
  (sesuaikan cara mengambil `db` dengan yang dipakai app.js; lihat `getFirebaseInstances` di config/firebaseAdmin.js).
- Batasan: tidak mengenal hari libur/kalender akademik; kelas dengan jadwal tidak terbaca (tanpa hari atau tanpa jam) dilewati.
- Template Meta baru: `pengingat_kuliah` (lihat `docs/TEMPLATE-WHATSAPP-META.md`).

## Tambahan v4 — Notifikasi otomatis website → WhatsApp
- `helpers/waNotifier.js` (baru), `helpers/waTemplates.js` (baru), `helpers/notificationHelper.js` (diubah: 4 baris pemanggilan).
- `views/admin/whatsapp/otomatis.ejs` (baru): daftar aturan dan statusnya; kartu ringkasan di Dashboard; tabel di Riwayat.
- Katalog lengkap: `docs/KATALOG-NOTIFIKASI-WA.md`. Draf template Meta: `docs/TEMPLATE-WHATSAPP-META.md`.
- **Mati bawaan.** Tambahkan ke `.env` website untuk memulai uji aman:
  ```env
  WA_AUTO_ENABLED=true
  WA_AUTO_DRY_RUN=true      # ubah ke false setelah log simulasi terlihat benar
  WA_SEND_MODE=text         # template bila API sudah mendukung
  WA_SITE_URL=https://elektronika.polidewa.ac.id
  ```
  Variabel lain (opsional) ada di komentar bagian atas `helpers/waNotifier.js`.

## Tambahan v3 — Dashboard WhatsApp (`/admin/whatsapp/dashboard`)
- Status Notification API (`GET /health`, tanpa API key) + waktu respons.
- Total percakapan, aktif 24 jam / 7 hari, pesan belum dibaca (bila API menyediakan `unreadCount`).
- Pesan keluar hari ini / 7 hari / 30 hari, tingkat keberhasilan, grafik 14 hari (WITA).
- Pengirim teraktif, percakapan terbaru, dan pengiriman gagal terbaru.
- Menu "WhatsApp Center" di navigasi kini membuka Dashboard; Inbox dan Riwayat diakses lewat tab.
- Statistik keluar berasal dari `wa_logs`, jadi hanya mencakup pesan yang dikirim lewat dashboard ini. Query memakai satu field `createdAt` (tanpa indeks komposit baru).

## Tambahan v2
- **Audit log**: setiap kirim dicatat ke koleksi Firestore `wa_logs` (admin, nomor, 500 karakter pertama pesan, status terkirim/gagal/ditolak, waktu). Dilihat di `/admin/whatsapp/riwayat`.
- **Pencegah kirim ganda**: tombol dinonaktifkan setelah klik, dan server menolak pesan identik ke nomor sama dalam 15 detik.
- **Rate limit**: maks. 20 pesan/menit per admin (in-memory; reset saat PM2 restart).
- Deteksi arah pesan lebih toleran (`outbound/out/outgoing/sent`, `fromMe`). Bila API memakai nama lain, sesuaikan di `index.ejs`.
- Catatan: query riwayat memakai `orderBy('createdAt')` pada satu field sehingga tidak perlu indeks komposit baru.

## Batasan versi awal
Versi awal ini menyediakan Inbox, riwayat pesan, dan balasan satu per satu. Belum termasuk pencarian, label, status dibaca, pengiriman massal, template, lampiran media, dan polling pesan realtime. Pesan bebas tunduk pada aturan jendela 24 jam WhatsApp.
