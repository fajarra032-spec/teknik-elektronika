# Katalog Notifikasi Website → WhatsApp (Teknik Elektronika)

Hasil audit kode website: semua notifikasi lonceng dibuat lewat `helpers/notificationHelper.js`
(`createNotification`, `createNotificationOnce`, `createNotificationForUsers`). Patch ini memasang
satu pemanggilan `waNotifier.enqueue(...)` di ketiga fungsi tersebut. Tidak ada file route yang diubah.

Kolom **WA** = dikirim ke WhatsApp secara bawaan. Aturan yang mati bisa dinyalakan lewat
`WA_AUTO_RULES_ON=kode1,kode2`, dan yang hidup bisa dimatikan lewat `WA_AUTO_RULES_OFF=kode`.

| Kode aturan | Notifikasi di website | Sumber | Penerima | Template | WA |
|---|---|---|---|---|---|
| `nilai_akhir` | Nilai akhir {MK} sudah keluar 🎓 | nilaiNotifHelper (rubrik, nilai admin) | Mahasiswa | nilai_keluar | ✅ |
| `nilai_magang` | Nilai magangmu sudah keluar 🎓 | magangNotifHelper | Mahasiswa | nilai_keluar | ✅ |
| `nilai_tugas` | Tugas “…” sudah dinilai 📝; LKM … sudah diperiksa 🔬 | nilaiNotifHelper, dosen/nilai | Mahasiswa | nilai_keluar | ✅ |
| `laporan_review` | Laporan magang di-ACC 🎉 / perlu direvisi 📄 | magangNotifHelper | Mahasiswa | info_magang | ✅ |
| `laporan_komentar` | Ada komentar baru di laporan magang 💬 | magangNotifHelper | Mahasiswa | info_magang | ⬜ |
| `laporan_masuk` | {Mahasiswa} mengunggah laporan magang 📄 | magangNotifHelper | Dosen | info_dosen | ✅ |
| `seminar_diajukan` | {Mahasiswa} mengajukan seminar magang 🎤 | magangNotifHelper | Dosen | info_dosen | ✅ |
| `seminar_jadwal` | Jadwal seminar ditetapkan/diubah; pengajuan ditolak | admin/seminar | Mahasiswa | info_layanan | ✅ |
| `logbook_kosong` | Logbook hari ini masih kosong nih 📝 | logbookNotifHelper | Mahasiswa | pengingat_logbook | ✅ |
| `logbook_ditolak` | Logbook perlu diperbaiki ✏️; persetujuan ditarik | magangNotifHelper | Mahasiswa | info_magang | ✅ |
| `logbook_disetujui` | Logbook sudah disetujui ✅ (harian/mingguan/banyak) | magangNotifHelper | Mahasiswa | info_magang | ⬜ (ramai) |
| `logbook_kunci` | Logbook dikunci 🔒 / kunci dibuka 🔓 | magangNotifHelper | Mahasiswa | info_magang | ✅ |
| `logbook_menunggu` | N mahasiswa menunggu tanda tangan logbook | dosenReminderHelper | Dosen | info_dosen | ✅ |
| `magang_periode` | Magang dimulai 🎉 / dikunci 🔒 / aktif lagi 🔓 / diperpanjang 📅 | magangNotifHelper | Mahasiswa | info_magang | ✅ |
| `magang_berakhir` | Magangmu berakhir H-7/H-3/H-1 ⏳; N mahasiswa segera selesai | magangNotifHelper | Mahasiswa & Dosen | info_magang | ✅ |
| `surat_tugas` | Surat Tugas baru terbit untuk dosen | helpers/suratTugasNotifHelper (admin/surat) | Dosen | info_dosen | ✅ |
| `sk_dosen` | SK Mengajar baru/diperbarui; SK Pembimbing Akademik | admin/sk, admin/bimbingan | Dosen | info_dosen | ✅ |
| `tugas_belum_dinilai` | N tugas mahasiswa menunggu dinilai | dosenReminderHelper | Dosen | info_dosen | ✅ |
| `jadwal_mengajar` | Jadwal mengajar hari ini: {MK} | dosenReminderHelper | Dosen | info_dosen | ⬜ (satu per MK) |
| `alat` | Peminjaman alat disetujui/ditolak; pengembalian terverifikasi/belum diterima | peminjamanAlatHelper | Mahasiswa | info_layanan | ✅ |
| `kuliah_pagi` | Jadwal kuliah/mengajar hari ini (ringkasan 1 pesan) | kuliahReminderHelper (**baru**) | Mahasiswa & Dosen | pengingat_kuliah | ✅ |
| `kuliah_sebelum` | Kuliah/mengajar pukul HH:MM dimulai N menit lagi | kuliahReminderHelper (**baru**) | Mahasiswa & Dosen | pengingat_kuliah | ✅ bila `KULIAH_REMINDER_MENIT` > 0 |
| `pesan` | Pesan baru dari {nama} (chat website) | messengerHelper | Mahasiswa & Dosen | info_layanan | ⬜ (ramai) |
| `admin_pmb` | Pendaftar PMB baru | routes/landing | **Admin** | info_admin | ✅ |
| `admin_kunjungan` | Pengajuan kunjungan industri baru | routes/dokumen | **Admin** | info_admin | ✅ |
| `admin_alat` | Pengajuan peminjaman alat baru; Pengajuan pengembalian alat | routes/mahasiswa/peminjamanAlat | **Admin** | info_admin | ✅ |

Jenis notifikasi yang tidak punya aturan tidak diteruskan.

## Notifikasi untuk admin
- Penerima: semua akun `users` ber-role `admin`. Nomor tujuan = `noHp` akun admin (bila ada) **ditambah** nomor di pengaturan.
- Isi nomor di **Admin > WhatsApp > Otomatis > Pengiriman & jadwal > Notifikasi admin** (disimpan di web), atau lewat `.env`:
  ```env
  WA_ADMIN_NUMBERS=085242459746        # boleh lebih dari satu, pisahkan koma
  WA_ADMIN_MAX_PER_DAY=30              # batas per nomor admin per hari (bawaan 30)
  WA_ADMIN_IGNORE_QUIET=false          # true = tetap kirim saat jam tenang
  ```
- Beberapa akun admin dengan nomor sama hanya menghasilkan **satu** pesan (dedup per nomor + judul + isi).
- `WA_REQUIRE_OPTIN` tidak berlaku untuk admin; `waOptOut: true` pada akun admin tetap dihormati.
- Teks pesan diatur di tab **Template pesan** (template `info_admin`). Aturan bisa dimatikan satu per satu di tab **Aturan notifikasi** (grup Admin).
- Notifikasi admin dari fitur baru: panggil `notifikasiAdmin(db, {type, title, message, link})` (helpers/peminjamanAlatHelper.js), lalu tambahkan satu baris aturan `ADM` di `helpers/waNotifier.js`.

## Pengaman bawaan
- **Mati bawaan**: tidak ada yang terkirim sebelum `WA_AUTO_ENABLED=true`. Mulai dengan `WA_AUTO_DRY_RUN=true` (hanya dicatat sebagai "simulasi").
- Antrean berurutan dengan jeda 1,5 detik; tidak memperlambat halaman website.
- Maks. 5 pesan otomatis per penerima per hari (`WA_AUTO_MAX_PER_DAY`).
- Jam tenang 21.00–06.00 WITA: pesan ditunda sampai pagi (ditahan di memori; hilang bila PM2 restart).
- Penerima dengan `waOptOut: true` di dokumen `users` dilewati. Set `WA_REQUIRE_OPTIN=true` agar hanya yang `waOptIn: true` yang menerima.
- Notifikasi identik dalam 2 menit tidak dikirim ganda.
- Semua keputusan (terkirim/gagal/dilewati/simulasi) dicatat di Firestore `wa_auto_logs` dan tampil di dashboard serta tab Riwayat.

## Nomor penerima
- Mahasiswa: field `noHp` pada dokumen `users` (sudah ada).
- Dosen: dibaca dari `users.noHp`, atau dari dokumen `dosen` (field `noHp`/`noHP`/`whatsapp`/`noWa`/`telepon`). **Kolom ini belum ada di form dosen**; tambahkan `noHp` di `views/admin/dosen_form.ejs` dan `routes/admin/dosen.js`.
- Format `08xx`, `+62`, `0062`, atau `8xx` otomatis diubah menjadi `628xx`.
