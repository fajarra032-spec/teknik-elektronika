// data/sop/detail/sop-te-045.js - SOP Backup dan Keamanan Data
// Sumber: scripts/backup-collections.js, config/firebaseAdmin.js, .gitignore, struktur folder proyek.
// Angka waktu bertanda (u) = USULAN, harus disetujui Kaprodi sebelum SOP disahkan.
module.exports = {
  kode: 'SOP-TE-045',
  judul: 'Backup dan Keamanan Data',
  versi: '1.0 (Draf)',
  tanggalDibuat: '14 November 2026',
  tujuan: [
    'Menetapkan prosedur pencadangan (backup), penyimpanan, pemulihan, dan pengamanan data serta kredensial sistem informasi prodi.',
    'Menjamin data akademik dapat dipulihkan saat terjadi kesalahan atau insiden, dan data pribadi tidak bocor.'
  ],
  ruangLingkup: [
    'Berlaku untuk data Firestore sistem informasi prodi, berkas pada Google Drive (Data WEB), konfigurasi dan kredensial (berkas .env, service account Firebase, Google OAuth), serta berkas ekspor yang berisi data pribadi (CSV dan JSON).',
    'Perubahan data langsung ke basis data diatur pada SOP-TE-046; akun dan hak akses pada SOP-TE-044.'
  ],
  dasarHukum: [
    'Kebijakan keamanan informasi dan pelindungan data pribadi Politeknik Dewantara. [KONFIRMASI: nomor dokumen]',
    'Kebijakan dan Manual SPMI Politeknik Dewantara. [KONFIRMASI: nomor dokumen]'
  ],
  definisi: [
    { istilah: 'Backup', arti: 'Salinan data koleksi dalam berkas JSON per koleksi, dibuat dengan scripts/backup-collections.js ke folder backup-<tanggal-waktu> beserta berkas _ringkasan.json.' },
    { istilah: 'Kredensial', arti: 'Rahasia akses sistem: variabel .env, kunci service account Firebase, dan client secret Google OAuth.' },
    { istilah: 'Admin sistem', arti: 'Pihak yang menjalankan backup, pemulihan, dan pengamanan teknis sistem.' },
    { istilah: 'Uji pemulihan', arti: 'Percobaan memulihkan backup ke lingkungan uji untuk memastikan data dapat dibaca dan dipakai.' }
  ],
  pihak: [
    { peran: 'Admin sistem', tanggungJawab: 'Menjalankan backup, menyimpan salinan, menguji pemulihan, mengamankan kredensial, dan memulihkan data.' },
    { peran: 'Ketua Program Studi', tanggungJawab: 'Menyetujui kebijakan backup, pemulihan data, dan penanganan insiden.' },
    { peran: 'Tim Penjaminan Mutu', tanggungJawab: 'Meninjau log backup dan uji pemulihan tiap semester.' },
    { peran: 'Unit teknologi informasi institusi', tanggungJawab: 'Mendukung penyimpanan salinan di luar server dan keamanan jaringan. [KONFIRMASI: unit dan kontak]' }
  ],
  persyaratan: [
    'Admin sistem memiliki akses yang sah ke Firestore dan kredensial yang diperlukan.',
    'Daftar koleksi yang dicadangkan sudah ditetapkan dan dimutakhirkan.',
    'Lokasi penyimpanan salinan di luar server tersedia dan akses dibatasi.'
  ],
  prosedur: [
    { no: 1, kegiatan: 'Menetapkan dan memutakhirkan daftar aset data yang wajib dicadangkan (koleksi Firestore, berkas Drive, konfigurasi) dan menyesuaikan daftar koleksi pada skrip backup.', pelaksana: 'Admin sistem / Ketua Program Studi', waktu: 'Awal tahun dan setiap ada modul baru (u)', output: 'Daftar aset data' },
    { no: 2, kegiatan: 'Menjalankan node scripts/backup-collections.js secara berkala (mingguan) dan wajib sebelum memasang pembaruan sistem, menjalankan skrip perubahan data, atau pergantian semester.', pelaksana: 'Admin sistem', waktu: 'Mingguan dan sebelum perubahan (u)', output: 'Folder backup-<tanggal-waktu>' },
    { no: 3, kegiatan: 'Memeriksa _ringkasan.json: jumlah dokumen tiap koleksi dan tidak ada koleksi gagal; mengulang backup bila ada kegagalan; mencatat hasil pada log backup.', pelaksana: 'Admin sistem', waktu: 'Segera setelah backup', output: 'Log backup' },
    { no: 4, kegiatan: 'Menyimpan sedikitnya dua salinan: satu pada penyimpanan terpisah dari server dengan akses terbatas dan terenkripsi; salinan di komputer kerja dihapus setelah dipindahkan.', pelaksana: 'Admin sistem', waktu: 'Hari yang sama (u)', output: 'Salinan di lokasi aman' },
    { no: 5, kegiatan: 'Menyimpan backup sesuai masa simpan yang ditetapkan, lalu menghapus backup yang melewati masa simpan secara aman.', pelaksana: 'Admin sistem', waktu: 'Masa simpan 12 bulan (u)', output: 'Catatan penghapusan backup' },
    { no: 6, kegiatan: 'Menguji pemulihan satu backup pada lingkungan uji dan membandingkan jumlah serta isi data dengan sistem berjalan.', pelaksana: 'Admin sistem', waktu: 'Setiap semester (u)', output: 'Laporan uji pemulihan' },
    { no: 7, kegiatan: 'Mengamankan kredensial: .env, kunci service account, dan client secret tidak disimpan pada repositori, arsip, atau berkas yang dibagikan; mengganti (rotate) kredensial bila bocor atau terjadi pergantian personel; mencabut akses admin yang tidak lagi bertugas.', pelaksana: 'Admin sistem / Ketua Program Studi', waktu: 'Terus-menerus; peninjauan tiap semester (u)', output: 'Daftar akses dan catatan rotasi kredensial' },
    { no: 8, kegiatan: 'Menyimpan berkas ekspor berisi data pribadi (mis. data mahasiswa, tagihan, EDOM) pada penyimpanan terbatas di luar folder proyek dan menghapusnya setelah selesai dipakai.', pelaksana: 'Admin sistem', waktu: 'Setelah ekspor dipakai', output: 'Catatan pengelolaan berkas ekspor' },
    { no: 9, kegiatan: 'Menangani insiden kehilangan atau kerusakan data: melapor, memeriksa dampak, memulihkan dari backup terbaru atas persetujuan Ketua Program Studi, memverifikasi hasil, dan menyusun laporan insiden.', pelaksana: 'Admin sistem / Ketua Program Studi', waktu: 'Segera setelah insiden (u)', output: 'Laporan insiden; data pulih' },
    { no: 10, kegiatan: 'Meninjau log backup, hasil uji pemulihan, dan daftar akses tiap semester serta menetapkan perbaikan.', pelaksana: 'Tim Penjaminan Mutu / Ketua Program Studi', waktu: 'Akhir semester', output: 'Laporan tinjauan keamanan data' }
  ],
  kasusKhusus: [
    { kasus: 'Sebagian koleksi gagal dicadangkan (nama koleksi salah atau tidak ada)', penanganan: 'Skrip menandai kegagalan; perbaiki daftar koleksi dan ulangi backup sebelum perubahan apa pun dijalankan.' },
    { kasus: 'Kredensial terunggah ke repositori, dibagikan, atau terkirim lewat obrolan', penanganan: 'Segera rotate kredensial pada Firebase dan Google Cloud, periksa log akses, dan catat sebagai insiden.' },
    { kasus: 'Komputer kerja atau media berisi backup hilang', penanganan: 'Dilaporkan sebagai insiden; ganti kredensial yang mungkin tersimpan dan evaluasi dampak data pribadi.' },
    { kasus: 'Pemulihan sebagian (satu koleksi atau satu mahasiswa)', penanganan: 'Dilakukan melalui SOP Koreksi dan Perubahan Data Akademik (SOP-TE-046) dengan persetujuan Ketua Program Studi.' }
  ],
  formulir: [
    'Log backup dan _ringkasan.json',
    'Laporan uji pemulihan',
    'Daftar akses dan catatan rotasi kredensial',
    'Laporan insiden data'
  ],
  lampiran: [],
  konfirmasi: [
    'Skrip backup hanya mencakup 8 koleksi (nilai, tugas, tugasManual, rubrikBobot, logbookMagang, magangPeriod, enrollment, mataKuliah), sedangkan kode memakai sekitar 70 koleksi (hitungan kasar dari pencarian kode). Koleksi penting seperti pengguna, KRS, dosen, mahasiswa, lulusan, SK, surat, dan seminar belum tercakup; lengkapi daftarnya.',
    'Tidak ada skrip pemulihan (restore) di folder scripts/ dan tidak terlihat penjadwalan otomatis di kode yang saya baca; pemulihan saat ini manual.',
    'Backup berupa JSON tidak terenkripsi pada folder lokal proyek. Tetapkan lokasi, enkripsi, dan masa simpan.',
    '.gitignore belum mengecualikan folder backup-*, administrasi.json (berisi client secret Google), users_data.json, mahasiswa.csv, dan berkas CSV ekspor. .gitignore menulis serviceAccount.json, sedangkan konfigurasi memuat cadangan ./serviceAccountKey.json yang tidak tercantum.',
    'Berkas Google Drive (Data WEB) belum masuk prosedur backup; tetapkan cara pencadangannya.',
    'Unit teknologi informasi institusi, kebijakan pelindungan data pribadi, dan siapa admin sistem.',
    'Angka waktu bertanda (u) adalah usulan.'
  ],
  referensi: []
};
