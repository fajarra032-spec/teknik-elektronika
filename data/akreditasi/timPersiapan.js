// data/akreditasi/timPersiapan.js
// DATA HARDCODED dari SK Ketua Program Studi D3 Teknik Elektronika No. 5666/ELK/POLIDEWA/XI/2026
// (14 November 2026) tentang Pembentukan Tim Persiapan Akreditasi. Kode bidang A-L sama dengan kelompok
// di Master Dokumen Prodi. Jika susunan tim berubah (SK baru), ubah file ini.

const sk = {
  nomor: '5666/ELK/POLIDEWA/XI/2026', tanggal: '14 November 2026', penetap: 'Ketua Program Studi D3 Teknik Elektronika (Fajar Ramadhan, S.Pd., M.T.)',
  tentang: 'Pembentukan Tim Persiapan Akreditasi Program Studi D3 Teknik Elektronika Politeknik Dewantara',
  berlaku: 'Sejak ditetapkan sampai selesainya kegiatan persiapan akreditasi atau sampai ditetapkan keputusan lebih lanjut',
  // Berkas PDF SK disimpan di public/ sehingga bisa diunduh langsung (tanpa login).
  berkasUrl: '/dokumen/akreditasi/SK_Tim_Persiapan_Akreditasi_5666.pdf',
  berkasNama: 'SK_Tim_Persiapan_Akreditasi_5666.pdf'
};

const BIDANG = {
  A: 'Legalitas dan Tata Kelola Program Studi', B: 'Standar Operasional Prosedur (SOP)', C: 'Kurikulum dan Pembelajaran',
  D: 'Administrasi Dosen', E: 'Administrasi Mahasiswa', F: 'Program Magang', G: 'Laboratorium dan Sarana Prasarana',
  H: 'Penelitian dan Pengabdian kepada Masyarakat (PkM)', I: 'Kerja Sama dan Hubungan Industri', J: 'Penjaminan Mutu Internal (SPMI)',
  K: 'Alumni dan Tracer Study', L: 'Pelaporan dan Akreditasi'
};

const anggota = [
  { nama: 'Fajar Ramadhan, S.Pd., M.T.', idTipe: 'NUPTK', id: '8559777678130153', jabatan: 'Ketua Tim', bidang: ['A', 'D', 'E', 'F', 'G', 'I'],
    tugas: ['Mengoordinasikan seluruh kegiatan persiapan akreditasi', 'Mengumpulkan dan memverifikasi dokumen legalitas serta tata kelola prodi', 'Mengoordinasikan kelengkapan administrasi dosen dan mahasiswa', 'Mengumpulkan dokumen pelaksanaan program magang', 'Menginventarisasi sarana prasarana, peralatan lab, modul praktikum, dan dokumen K3', 'Mengumpulkan dokumen kerja sama dan bukti implementasinya', 'Koordinasi, pemantauan, dan validasi akhir dokumen tim'] },
  { nama: 'Miftahul Hairia, S.Pd., M.Pd.', idTipe: 'NUPTK', id: '6138777678230143', jabatan: 'Sekretaris', bidang: ['B', 'J'],
    tugas: ['Menginventarisasi dan menyusun dokumen SOP', 'Mengumpulkan dokumen standar, pelaksanaan, evaluasi, pengendalian, dan peningkatan mutu', 'Mengumpulkan bukti audit mutu dan tindak lanjutnya', 'Mengelola administrasi dan dokumentasi kegiatan tim'] },
  { nama: 'Rahman Syam, S.Pd., M.Si.', idTipe: 'NIDN', id: '0921129104', jabatan: 'Anggota', bidang: ['H'],
    tugas: ['Menginventarisasi kegiatan penelitian dosen dan mahasiswa', 'Mengumpulkan dokumen penelitian, publikasi, dan luaran', 'Mengumpulkan dokumen PkM beserta laporan dan luarannya', 'Mengidentifikasi keterlibatan mahasiswa dalam penelitian dan PkM'] },
  { nama: 'Gunawan Tari, S.T., M.T.', idTipe: 'NIDN', id: '0908058803', jabatan: 'Anggota', bidang: ['K'],
    tugas: ['Mengumpulkan dan memperbarui data alumni', 'Mengoordinasikan pelaksanaan tracer study', 'Mengumpulkan data masa tunggu dan kesesuaian bidang pekerjaan', 'Mengumpulkan umpan balik pengguna lulusan dan alumni'] },
  { nama: 'Ariani Amri, S.Pd., M.Pd.', idTipe: 'NIDN', id: '0918029701', jabatan: 'Anggota', bidang: ['L'],
    tugas: ['Menginventarisasi kebutuhan dokumen pendukung akreditasi', 'Membantu kompilasi data LED dan LKPS', 'Memeriksa kelengkapan dan keteraturan dokumen pendukung', 'Mengelola pengarsipan dan rekapitulasi status pemenuhan dokumen', 'Melaporkan perkembangan kelengkapan dokumen kepada Ketua Tim'] },
  { nama: 'Suardi, S.Pd., M.Pd.', idTipe: 'NIDN', id: '0905068702', jabatan: 'Anggota', bidang: ['C'],
    tugas: ['Menginventarisasi dokumen kurikulum prodi', 'Mengumpulkan dokumen profil lulusan, CPL, dan struktur kurikulum', 'Mengumpulkan dokumen RPS, bahan ajar, dan perangkat pembelajaran', 'Mengumpulkan bukti proses pembelajaran dan evaluasi hasil belajar', 'Mendukung evaluasi dan pengembangan kurikulum'] }
];

const tugasTim = [
  'Mengidentifikasi dan menginventarisasi seluruh kebutuhan dokumen serta data pendukung akreditasi',
  'Mengumpulkan dan menyusun dokumen berdasarkan kriteria dan instrumen akreditasi yang berlaku',
  'Memeriksa kelengkapan, kesesuaian, konsistensi, dan validitas data serta dokumen pendukung',
  'Mengoordinasikan pemenuhan dokumen dengan unit kerja dan pihak terkait di Politeknik Dewantara',
  'Menyiapkan bukti pelaksanaan tridarma, tata kelola, penjaminan mutu, dan aspek lain yang relevan',
  'Menyiapkan bahan penyusunan LED dan LKPS sesuai instrumen yang berlaku',
  'Melakukan pengarsipan dan pengelolaan dokumen akreditasi secara terstruktur dan berkelanjutan',
  'Melaporkan perkembangan persiapan akreditasi kepada Ketua Program Studi'
];
const ketentuan = [
  'Setiap anggota wajib melaksanakan tugas sesuai bidang tanggung jawab.',
  'Dokumen yang belum tersedia harus diidentifikasi dan ditindaklanjuti melalui koordinasi dengan unit terkait.',
  'Setiap dokumen harus memiliki sumber yang jelas, periode data, dan bukti pendukung yang dapat diverifikasi.',
  'Seluruh dokumen disimpan dalam Pusat Data Dokumen Program Studi D3 Teknik Elektronika.',
  'Hasil pekerjaan tim menjadi bahan evaluasi internal dan persiapan pengajuan akreditasi program studi.'
];

const pjPerBidang = {};
anggota.forEach(a => a.bidang.forEach(b => { pjPerBidang[b] = a; }));

// Catatan pemeriksaan SK (khusus admin). tingkat: sedang | rendah.
const catatan = [
  { tingkat: 'sedang', judul: 'SK ditetapkan Ketua Program Studi, bukan pimpinan institusi',
    isi: 'Tim ini dibentuk dengan SK Kaprodi, dan Kaprodi sekaligus menjadi Ketua Tim. Periksa Statuta/pedoman Politeknik Dewantara apakah pembentukan tim akreditasi menjadi kewenangan Kaprodi atau Direktur/Wakil Direktur. Jika kewenangannya di pimpinan, siapkan SK Direktur atau surat penugasan pendukung.' },
  { tingkat: 'sedang', judul: 'Beban Ketua Tim terlalu terpusat',
    isi: 'Ketua Tim memegang 6 dari 12 bidang (A, D, E, F, G, I) sekaligus melakukan validasi akhir seluruh dokumen. Pertimbangkan pembantu/koordinator untuk bidang administrasi mahasiswa, dosen, dan laboratorium agar tidak menjadi hambatan.' },
  { tingkat: 'rendah', judul: 'Identitas institusi berbeda dengan Dokumen Kurikulum 2024',
    isi: 'SK memakai alamat "JL. KH. Ahmad Razak No. 7" dan e-mail teknik.elektronika@polidewa.ac.id, sedangkan Dokumen Kurikulum 2024 memakai "Lr. 2 No. 7" dan elektronika@polidewa.ac.id. Samakan karena identitas ini tampil di LED dan LKPS.' },
  { tingkat: 'rendah', judul: 'Dasar "Mengingat" masih umum',
    isi: 'Butir 4 hanya menyebut "ketentuan peraturan perundang-undangan mengenai penjaminan mutu". Ini aman dari risiko merujuk peraturan yang sudah dicabut, tetapi bila ingin lebih spesifik dapat mencantumkan peraturan penjaminan mutu terbaru (Permendiktisaintek No. 39 Tahun 2025) dan dokumen SPMI institusi.' }
];

// Pemetaan Kriteria akreditasi (I-IX di workspace) -> bidang SK (A-L). INI TURUNAN ISI KRITERIA, bukan bagian SK:
// SK hanya membagi bidang A-L. Ubah di sini bila pembagian kriteria berbeda.
const kriteriaBidang = { I: ['A'], II: ['A', 'B', 'I', 'J'], III: ['E'], IV: ['D'], V: ['G'], VI: ['C', 'F'], VII: ['H'], VIII: ['H'], IX: ['K'] };

/** Penanggung jawab (SK) untuk satu kriteria: [{ nama (tanpa gelar), lengkap, jabatan, bidang: [..] }] */
function pjUntukKriteria(kode) {
  const per = new Map();
  (kriteriaBidang[kode] || []).forEach(b => {
    const a = pjPerBidang[b];
    if (!a) return;
    if (!per.has(a.nama)) per.set(a.nama, { nama: a.nama.split(',')[0], lengkap: a.nama, jabatan: a.jabatan, bidang: [] });
    per.get(a.nama).bidang.push(b);
  });
  return [...per.values()];
}
const koordinatorPelaporan = anggota.find(a => a.bidang.includes('L'));

module.exports = { sk, BIDANG, anggota, tugasTim, ketentuan, pjPerBidang, catatan, kriteriaBidang, pjUntukKriteria, koordinatorPelaporan };
