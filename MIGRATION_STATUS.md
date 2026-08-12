# Migrasi ke MariaDB (Server Lokal / Armbian STB)

## Status migrasi

**Sudah dimigrasi penuh ke MariaDB, TIDAK ada lagi dependency ke Firebase/Google:**
- Login, register, logout (password di-hash pakai bcrypt, session pakai `express-session` — sudah dipakai sebelumnya)
- Dashboard admin, kelola user, verifikasi user
- Kelola program (termasuk upload materi)
- Kelola galeri beranda (fitur baru)
- Enrollment (daftar, edit progres, generate sertifikat)
- Pendaftaran publik (form di halaman utama)
- Upload file (materi, foto profil, galeri, bukti transfer) — sekarang disimpan di folder lokal `/uploads`, bukan lagi Google Drive

**Cara kerja teknisnya:** dibuatkan "lapisan kompatibilitas" (`config/firestoreCompat.js`) yang meniru API Firestore/Firebase Auth persis, tapi datanya sungguhan tersimpan di MariaDB (satu tabel generik per "collection", kolom `data` berisi JSON). Ini supaya SEMUA route lain (yang belum sempat diaudit detail satu-satu) otomatis ikut jalan di atas MariaDB tanpa perlu ditulis ulang query-nya, karena mereka semua mengambil `db`/`admin` dari satu file pusat: `config/firebase.js`.

**Yang perlu jadi perhatian (belum diuji detail satu-satu, tapi seharusnya jalan lewat compat layer di atas):**
- Kelola Kelas, Teacher dashboard, Gradebook, Tugas/Kuis, Pembayaran, Sertifikat admin, Analitik, Ekspor Excel/PDF, Notifikasi, Pengumuman, Jadwal & Absensi
- **Chat real-time**: fitur ini SEBELUMNYA mengandalkan Firestore client-side listener (`firebase.js` di browser) untuk update pesan otomatis tanpa reload. Setelah migrasi ini, `firebaseConfig` yang dikirim ke `views/chat/room.ejs` kosong, jadi bagian real-time listener di browser kemungkinan akan gagal jalan (chat API di backend tetap ada, tapi tidak lagi live-update). Ini perlu penyesuaian terpisah (misalnya diganti polling biasa) kalau chat dipakai aktif.

Kalau ada modul di atas yang error saat dipakai nyata, laporkan error persisnya — kemungkinan cuma butuh penyesuaian kecil di titik itu saja, karena fondasi (DB, auth, storage) sudah solid dan teruji.

## Setup di server Armbian/STB

### 1. Install MariaDB
```bash
sudo apt update
sudo apt install -y mariadb-server
sudo systemctl enable --now mariadb
sudo mysql_secure_installation   # set root password, dsb
```

### 2. Buat database & user aplikasi (jangan pakai root untuk aplikasi)
```bash
sudo mysql -u root -p
```
```sql
CREATE DATABASE merah_putih_ils CHARACTER SET utf8mb4;
CREATE USER 'ils_app'@'localhost' IDENTIFIED BY 'GANTI_DENGAN_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON merah_putih_ils.* TO 'ils_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Install dependency Node.js
```bash
cd /path/ke/aplikasi
npm install
```
> Semua dependency (mysql2, bcryptjs, ejs, dst) sudah didaftarkan di `package.json`. Tidak perlu lagi `firebase-admin` atau `googleapis`.

### 4. Isi file `.env`
Buat `.env` di root project (lihat `.env.example` untuk daftar lengkap):
```
PORT=3000
SESSION_SECRET=ganti-dengan-string-acak-panjang

ADMIN_EMAILS=email-admin-anda@contoh.com

DB_HOST=localhost
DB_PORT=3306
DB_USER=ils_app
DB_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT
DB_NAME=merah_putih_ils
```
Tidak perlu lagi `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_CLIENT_ID`, dll — sudah tidak dipakai.

### 5. Siapkan storage untuk upload — SANGAT DISARANKAN pakai USB/SD eksternal
eMMC internal STB biasanya kecil (4–16GB, dipakai OS + aplikasi) dan umur tulisnya
terbatas. Foto galeri, materi, dan bukti transfer sebaiknya disimpan di storage
eksternal, bukan eMMC.

**a) Cek & mount USB/SD (contoh USB terpasang di `/dev/sda1`):**
```bash
lsblk                                  # lihat nama device USB/SD kamu
sudo mkdir -p /mnt/usb-storage
sudo mount /dev/sda1 /mnt/usb-storage  # sesuaikan /dev/sda1 dengan device asli
```

**b) Biar otomatis ter-mount tiap boot**, tambahkan ke `/etc/fstab` (cek UUID dulu dengan `sudo blkid`):
```
UUID=xxxx-xxxx  /mnt/usb-storage  ext4  defaults,nofail  0  2
```

**c) Arahkan aplikasi ke situ** lewat `.env`:
```
UPLOAD_DIR=/mnt/usb-storage/ils-uploads
```
Folder `ils-uploads` di dalamnya dibuat otomatis oleh aplikasi. Kalau `UPLOAD_DIR`
tidak diisi, upload akan tetap tersimpan di eMMC (folder `uploads/` di dalam project) — masih jalan, tapi tidak disarankan untuk pemakaian jangka panjang.

### 6. Buat folder upload (kalau masih pakai default di eMMC, opsional)
```bash
mkdir -p uploads
```

### 7. Jalankan
```bash
node app.js
```
Tabel-tabel di MariaDB **dibuat otomatis** saat pertama kali dipakai (tidak perlu jalankan file `.sql` manual).

### 8. Buat akun pertama (admin, guru, siswa)
Tidak ada lagi halaman pendaftaran sendiri (`/register` sudah dihapus). Semua akun
dibuat oleh admin lewat terminal:
```bash
npm run create-account
```
Ikuti pertanyaannya (peran, username, nama, password). Login di `/login` sekarang
pakai **USERNAME + password** (bukan email). Lihat bagian "Membuat Akun" di bawah
untuk detail lengkap.

## Membuat akun (admin / guru / siswa)

Tidak ada lagi pendaftaran akun sendiri (`/register` sudah dihapus). Login sekarang pakai **username + password**. Semua akun dibuat lewat terminal:

```bash
npm run create-account
```
akan tanya-jawab interaktif (peran, username, nama, password — password disembunyikan saat diketik).

Atau langsung satu baris:
```bash
node scripts/create-account.js --role=admin --username=admin1 --name="Nama Admin" --password=passwordAman123
node scripts/create-account.js --role=teacher --username=guru1 --name="Bu Guru" --password=passwordAman123
node scripts/create-account.js --role=user --username=budi1 --name="Budi" --password=passwordAman123
```
`--role` yang valid: `admin`, `teacher` (guru), `user` (siswa).

Akun guru juga bisa dibuat langsung dari menu **Kelola Kelas** di admin — usernamenya dibuat otomatis dari nama (tampil di pesan sukses setelah dibuat, jadi dicatat lalu diteruskan ke guru bersangkutan).

## Backup database

Database MariaDB sekarang bisa di-backup otomatis. Script sudah tersedia:

```bash
bash scripts/backup-db.sh      # backup manual, sekali jalan
bash scripts/restore-db.sh <file.sql.gz>   # pulihkan dari backup
```

Untuk backup **otomatis harian** (disarankan), daftarkan lewat cron:
```bash
crontab -e
```
Tambahkan baris (backup tiap hari jam 2 pagi, sesuaikan path):
```
0 2 * * * /bin/bash /root/english-course/scripts/backup-db.sh >> /root/english-course/db-backups/backup.log 2>&1
```
Backup otomatis tersimpan 7 hari terakhir (yang lebih lama otomatis dihapus). Kalau `UPLOAD_DIR` di `.env`
diarahkan ke storage eksternal, backup juga ikut disimpan di situ (bukan di eMMC).

## Proteksi login (rate limiting)

Sejak v3.3, percobaan login yang gagal berulang kali dari IP yang sama akan diblokir sementara
(5x gagal dalam 15 menit → diblokir 15 menit). Ini mencegah orang lain mencoba menebak-nebak
password siswa/admin secara membabi-buta. Tidak perlu setup apa pun, otomatis aktif.

## Catatan keamanan

`app.use(express.static('uploads'))` menyajikan folder upload apa adanya, artinya siapa pun yang tahu/menebak nama filenya bisa mengaksesnya langsung (sama seperti perilaku Google Drive versi "siapa saja yang punya link" sebelumnya). Ini cukup untuk kebutuhan sekolah bahasa skala kecil; kalau nanti perlu proteksi lebih ketat (misal bukti transfer hanya bisa dilihat admin), beri tahu saya untuk ditambahkan middleware otentikasi khusus di path `/uploads`.

## Catatan performa untuk board 2GB RAM
- Pool koneksi MariaDB dibatasi 8 koneksi bersamaan (`config/db.js`) — cukup untuk sekolah bahasa skala kecil-menengah, dan tidak membebani board.
- Semua filter/urutan data diproses di Node (bukan query SQL kompleks) untuk kesederhanaan — pada skala ratusan/ribuan baris per tabel, ini masih sangat cepat di board seperti ini. Kalau nanti data sudah puluhan ribu baris per tabel dan terasa lambat, itu titik yang paling masuk akal buat dioptimasi lebih lanjut (bisa hubungi lagi kalau sampai situ).
