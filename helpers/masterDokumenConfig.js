// helpers/masterDokumenConfig.js
//
// Template "Master Dokumen Prodi" (Buku Induk Administrasi Prodi) untuk
// persiapan akreditasi. 12 kelompok (A-L). Ini TEMPLATE AWAL yang dibuat
// otomatis per periode akreditasi, lalu bisa ditambah item/dihapus lewat web.
//
// Catatan: daftar SOP di kelompok B adalah rekomendasi kebutuhan operasional
// prodi, bukan daftar yang diwajibkan kementerian satu per satu. SOP harus
// mengikuti kebijakan dan dokumen SPMI Politeknik Dewantara.
//
// Format item: string "Nama dokumen | keterangan singkat" (keterangan opsional).
// Properti kriteria = kode kriteria di DEFAULT_KRITERIA (helpers/akreditasiHelper.js)
// yang paling relevan, hanya sebagai petunjuk pemetaan bukti.

const MASTER_DOKUMEN = [
  {
    kode: 'A', nama: 'Legalitas dan Tata Kelola Prodi', kriteria: 'II',
    items: [
      'SK pendirian program studi | Legalitas pembukaan prodi',
      'SK izin operasional | Izin penyelenggaraan',
      'SK pengangkatan Kaprodi | Masa jabatan dan kewenangan',
      'Struktur organisasi prodi | Kaprodi, sekretaris, koordinator',
      'Uraian tugas dan tanggung jawab | Job description tiap posisi',
      'Visi, misi, tujuan dan strategi (VMTS) | Arah pengembangan prodi',
      'Rencana Strategis (Renstra) prodi | Target jangka menengah',
      'Rencana Operasional (Renop) | Program kerja tahunan',
      'Program kerja Kaprodi | Target dan kegiatan tiap tahun',
      'Kalender akademik prodi | Agenda akademik',
      'Notulen rapat prodi | Bukti pengambilan keputusan',
      'Laporan kinerja tahunan prodi | Evaluasi capaian program',
      'SK dosen tetap dan dosen pengampu',
      'SK pembimbing akademik (PA)',
      'SK koordinator laboratorium',
      'SK tim kurikulum',
      'SK tim penjaminan mutu / tim mutu prodi',
      'SK pembimbing dan penguji magang',
      'Daftar dosen beserta bidang keahlian'
    ]
  },
  {
    kode: 'B', nama: 'SOP (Standar Operasional Prosedur)', kriteria: 'II',
    sub: [
      { nama: 'SOP Akademik', items: [
        'SOP Penyusunan dan Penetapan Jadwal Kuliah', 'SOP Pengisian KRS', 'SOP Perubahan KRS',
        'SOP Pelaksanaan Perkuliahan', 'SOP Presensi Mahasiswa', 'SOP Presensi Dosen',
        'SOP Perubahan Jadwal Kuliah', 'SOP Perkuliahan Pengganti', 'SOP Penyusunan dan Evaluasi RPS',
        'SOP Pelaksanaan UTS dan UAS', 'SOP Penginputan dan Perbaikan Nilai', 'SOP Evaluasi Hasil Belajar',
        'SOP Pembimbingan Akademik', 'SOP Cuti Akademik dan Aktif Kembali', 'SOP Monitoring Masa Studi Mahasiswa'
      ] },
      { nama: 'SOP Praktikum dan Laboratorium', items: [
        'SOP Penggunaan Laboratorium', 'SOP Peminjaman Alat dan Bahan', 'SOP Pengembalian Alat',
        'SOP Pelaksanaan Praktikum', 'SOP Keselamatan dan Kesehatan Kerja (K3)', 'SOP Penanganan Kerusakan Alat',
        'SOP Pemeliharaan dan Kalibrasi Alat', 'SOP Inventarisasi Peralatan',
        'SOP Penanganan Kecelakaan Laboratorium', 'SOP Pengelolaan Limbah Elektronik'
      ] },
      { nama: 'SOP Magang dan Kerja Sama Industri', items: [
        'SOP Pemetaan dan Penetapan Mitra Magang', 'SOP Pendaftaran Magang', 'SOP Pembekalan Magang',
        'SOP Penempatan Mahasiswa Magang', 'SOP Penunjukan Dosen Pembimbing', 'SOP Monitoring dan Evaluasi Magang',
        'SOP Penilaian Magang', 'SOP Penyusunan Laporan Magang', 'SOP Seminar Hasil Magang',
        'SOP Penanganan Permasalahan Mahasiswa di Industri'
      ] },
      { nama: 'SOP Layanan Mahasiswa', items: [
        'SOP Pelayanan Administrasi Akademik', 'SOP Konsultasi Mahasiswa', 'SOP Penanganan Keluhan Mahasiswa',
        'SOP Bimbingan dan Konseling', 'SOP Surat Keterangan Mahasiswa', 'SOP Rekomendasi Beasiswa',
        'SOP Penanganan Pelanggaran Akademik', 'SOP Pengajuan Kegiatan Kemahasiswaan'
      ] },
      { nama: 'SOP Pengelolaan Dosen dan Mutu', items: [
        'SOP Penugasan Mengajar Dosen', 'SOP Monitoring Kinerja Dosen', 'SOP Evaluasi Dosen oleh Mahasiswa',
        'SOP Evaluasi RPS dan Pembelajaran', 'SOP Evaluasi Kurikulum', 'SOP Rapat Evaluasi Prodi',
        'SOP Audit Mutu Internal', 'SOP Tindak Lanjut Hasil Evaluasi', 'SOP Pengelolaan Dokumen Mutu',
        'SOP Evaluasi Kepuasan Pengguna Lulusan'
      ] }
    ]
  },
  {
    kode: 'C', nama: 'Kurikulum dan Pembelajaran', kriteria: 'VI',
    items: [
      'Dokumen Kurikulum | Kurikulum yang disahkan',
      'Profil Lulusan | Kompetensi pekerjaan lulusan',
      'CPL | Capaian Pembelajaran Lulusan',
      'Matriks CPL dan Mata Kuliah | Pemetaan kontribusi MK',
      'CPMK | Capaian Pembelajaran Mata Kuliah',
      'Sub-CPMK | Capaian tiap tahapan pembelajaran',
      'RPS seluruh mata kuliah | Rencana pembelajaran semester',
      'Rencana evaluasi pembelajaran | Metode dan bobot penilaian',
      'Rubrik penilaian | Instrumen penilaian',
      'Peta kurikulum | Sebaran mata kuliah per semester',
      'Dokumen evaluasi kurikulum | Hasil evaluasi dan rekomendasi',
      'Berita acara peninjauan kurikulum | Bukti keterlibatan stakeholder',
      'Dokumen kesesuaian kurikulum dengan industri | Masukan pengguna lulusan',
      'Dokumen konversi dan pengakuan pembelajaran | Jika diterapkan',
      'Laporan ketercapaian CPL per semester | Bukti CPL benar-benar diukur'
    ]
  },
  {
    kode: 'D', nama: 'Administrasi Dosen', kriteria: 'IV',
    items: [
      'Rekapitulasi seluruh dosen (data induk) | Dipegang Kaprodi',
      'Biodata dosen dan riwayat pendidikan',
      'NIDN/NUPTK dan data kepegawaian',
      'Sertifikat pendidik atau kompetensi',
      'SK pembagian tugas mengajar',
      'Jadwal mengajar',
      'Jurnal perkuliahan',
      'Rekap kehadiran mengajar',
      'Rekap penilaian mahasiswa',
      'Hasil evaluasi dosen oleh mahasiswa (EDOM)',
      'Sertifikat pelatihan dan pengembangan kompetensi',
      'Data studi lanjut dosen'
    ]
  },
  {
    kode: 'E', nama: 'Administrasi Mahasiswa', kriteria: 'III',
    items: [
      'Data induk mahasiswa | Identitas dan status mahasiswa',
      'Data mahasiswa per angkatan | Monitoring perkembangan',
      'Rekap IP dan IPK | Evaluasi akademik',
      'Rekap kehadiran mahasiswa | Monitoring kedisiplinan',
      'Rekap status mahasiswa | Aktif, cuti, keluar, lulus',
      'Data mahasiswa berisiko DO | Pencegahan putus studi',
      'Data prestasi mahasiswa | Kinerja kemahasiswaan',
      'Data penerima beasiswa | Layanan mahasiswa',
      'Data kelulusan dan masa studi | Monitoring masa studi',
      'Laporan perkembangan mahasiswa per angkatan'
    ]
  },
  {
    kode: 'F', nama: 'Program Magang', kriteria: 'VI',
    items: [
      'Pedoman akademik magang', 'Pedoman teknis pelaksanaan magang', 'Daftar perusahaan mitra magang',
      'MoU/MoA/IA magang', 'SK pembimbing magang', 'Surat pengantar mahasiswa',
      'Surat penerimaan dari perusahaan', 'Formulir penempatan mahasiswa', 'Logbook kegiatan harian',
      'Formulir monitoring dosen', 'Formulir penilaian pembimbing industri', 'Format laporan magang',
      'Format penilaian laporan', 'Format berita acara seminar', 'Format daftar nilai akhir magang',
      'Rekapitulasi mahasiswa yang telah menyelesaikan magang',
      'Dokumentasi tiap tahap magang | Persyaratan, bobot SKS, capaian, penilaian, bukti selesai'
    ]
  },
  {
    kode: 'G', nama: 'Laboratorium dan Sarana Prasarana', kriteria: 'V',
    items: [
      'Daftar inventaris alat laboratorium', 'Kartu inventaris barang', 'Daftar kondisi alat',
      'Jadwal penggunaan laboratorium', 'Jadwal praktikum', 'Modul praktikum', 'SOP laboratorium',
      'Formulir peminjaman alat', 'Formulir kerusakan alat', 'Jadwal pemeliharaan alat',
      'Daftar kebutuhan bahan habis pakai', 'Dokumen K3', 'Dokumentasi kegiatan praktikum',
      'Logbook penggunaan alat/laboratorium'
    ]
  },
  {
    kode: 'H', nama: 'Penelitian dan Pengabdian kepada Masyarakat', kriteria: 'VII',
    items: [
      'Daftar penelitian dosen', 'Daftar publikasi ilmiah', 'Daftar pengabdian kepada masyarakat',
      'SK tim penelitian dan PkM', 'Laporan akhir kegiatan', 'Dokumentasi kegiatan',
      'Bukti luaran penelitian', 'Bukti luaran pengabdian',
      'Keterlibatan mahasiswa dalam penelitian dan PkM', 'Rekapitulasi pendanaan penelitian dan PkM'
    ]
  },
  {
    kode: 'I', nama: 'Kerja Sama dan Hubungan Industri', kriteria: 'II',
    items: [
      'Daftar mitra industri', 'MoU tingkat institusi', 'MoA tingkat unit (jika digunakan)',
      'Implementation Agreement (IA) atau bukti implementasi', 'Dokumentasi kunjungan industri',
      'Dokumentasi kuliah praktisi', 'Data mahasiswa magang di mitra',
      'Data dosen praktisi / praktisi mengajar', 'Evaluasi kepuasan mitra', 'Evaluasi pengguna lulusan'
    ]
  },
  {
    kode: 'J', nama: 'Penjaminan Mutu (SPMI)', kriteria: 'II',
    items: [
      'Kebijakan SPMI', 'Manual SPMI', 'Standar SPMI', 'Formulir SPMI',
      'Standar akademik', 'Standar pembelajaran', 'Standar penelitian dan PkM', 'Standar kemahasiswaan',
      'Standar SDM', 'Standar sarana dan prasarana', 'Laporan evaluasi diri',
      'Laporan Audit Mutu Internal (AMI)', 'Temuan audit dan tindakan koreksi',
      'Laporan evaluasi kinerja program studi', 'Rapat Tinjauan Manajemen (RTM)',
      'Laporan tindak lanjut hasil RTM',
      'Survei kepuasan mahasiswa', 'Survei kepuasan dosen', 'Survei kepuasan alumni', 'Survei kepuasan mitra'
    ]
  },
  {
    kode: 'K', nama: 'Alumni dan Tracer Study', kriteria: 'IX',
    items: [
      'Database alumni per angkatan', 'Nomor kontak dan pekerjaan alumni', 'Laporan tracer study',
      'Waktu tunggu mendapatkan pekerjaan', 'Kesesuaian pekerjaan dengan bidang keahlian',
      'Tingkat kepuasan pengguna lulusan', 'Masukan alumni terhadap kurikulum',
      'Dokumentasi kegiatan alumni', 'Data alumni yang berwirausaha', 'Data alumni yang melanjutkan pendidikan'
    ]
  },
  {
    kode: 'L', nama: 'Pelaporan dan Akreditasi', kriteria: '',
    items: [
      'Laporan Evaluasi Diri (LED)', 'Laporan Kinerja Program Studi (LKPS)',
      'Data dosen dan tenaga kependidikan', 'Data mahasiswa', 'Data lulusan',
      'Data kurikulum dan pembelajaran', 'Data penelitian dan PkM', 'Data kerja sama',
      'Data sarana prasarana', 'Data keuangan dan pendanaan (sesuai kewenangan UPPS)',
      'Data penjaminan mutu', 'Bukti capaian kinerja dan tindak lanjut'
    ]
  }
];

const STATUS_MASTER = {
  belum: { label: 'Belum Ada', badge: 'secondary' },
  draft: { label: 'Draft / Perlu Revisi', badge: 'warning' },
  ada: { label: 'Ada (belum disahkan)', badge: 'info' },
  disahkan: { label: 'Lengkap & Disahkan', badge: 'success' }
};

/** Ratakan template jadi daftar item siap simpan (tanpa periodeId). */
function flattenTemplate() {
  const out = [];
  MASTER_DOKUMEN.forEach(g => {
    let urutan = 0;
    const push = (raw, sub) => {
      const [nama, ket] = String(raw).split('|').map(s => s.trim());
      urutan += 1;
      out.push({
        kelompok: g.kode, kelompokNama: g.nama, kriteriaKode: g.kriteria || '',
        sub: sub || '', urutan, nama, keterangan: ket || ''
      });
    };
    (g.items || []).forEach(i => push(i, ''));
    (g.sub || []).forEach(s => s.items.forEach(i => push(i, s.nama)));
  });
  return out;
}

module.exports = { MASTER_DOKUMEN, STATUS_MASTER, flattenTemplate };
