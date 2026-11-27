# WA Gateway (mirip WhatsApp Web)

Gateway pengganti Elektronika Notification API. Login **scan QR sekali**, sesi tersimpan.
Tanpa template Meta, tanpa batas 24 jam. Website tidak perlu diubah kodenya, cukup ganti `.env`.

> Tidak resmi (protokol WhatsApp Web / Baileys). Pakai **nomor cadangan**. Gateway memberi jeda acak
> 2–6 detik antar pesan dan batas 800 pesan/hari (ubah lewat env) untuk menekan risiko blokir.

## Pasang (di server yang sama dengan website, atau server lain)
```bash
cd wa-gateway
npm install
INTERNAL_KEY="isi-kunci-rahasia-minimal-16-karakter" npm start
```
Agar jalan terus: `npm i -g pm2` lalu
`INTERNAL_KEY="..." pm2 start server.js --name wa-gateway && pm2 save`.

## Login (sekali saja)
1. Buka `http://SERVER:3100/qr?key=INTERNAL_KEY` (atau lihat QR di terminal).
2. Di ponsel (nomor yang dipakai mengirim): WhatsApp > Perangkat tertaut > Tautkan perangkat > scan.
3. Halaman berubah menjadi "Terhubung". Sesi tersimpan di `data/auth` - jangan dihapus/dibagikan.

## Sambungkan ke website (`.env` website)
```
NOTIFICATION_API_URL=http://localhost:3100
NOTIFICATION_INTERNAL_KEY=isi-kunci-rahasia-minimal-16-karakter   # sama dengan INTERNAL_KEY
WA_SEND_MODE=text        # kirim teks bebas (bukan template)
WA_CEK_JENDELA=off       # pengecekan 24 jam tidak diperlukan lagi
```
Restart website. Cek status: `curl -H "x-internal-key: KUNCI" http://localhost:3100/internal/status`.

## Opsi (env gateway)
`PORT` (3100) · `DATA_DIR` · `GW_JEDA_MIN_MS` (2000) · `GW_JEDA_MAX_MS` (6000) · `GW_MAX_PER_DAY` (800)

## Catatan
- Pesan "template" dari website tetap bisa: gateway mengubahnya jadi teks biasa memakai isi di `templates.js`.
- Nomor yang tidak terdaftar di WhatsApp ditolak dengan pesan jelas (tercatat gagal di log website).
- Riwayat chat disimpan di `data/store.json` (maks. 200 pesan per percakapan). Riwayat lama dari API sebelumnya tidak ikut pindah.
- Jangan buka port 3100 ke internet; cukup bisa diakses website (localhost / jaringan internal).
