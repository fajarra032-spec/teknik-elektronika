// ==================== TERBITKAN SERTIFIKAT (HELPER BERSAMA) ====================
// Dipakai oleh: penyelesaian progress lama (per-materi), generate manual admin,
// dan fitur baru Nilai Akhir (Komponen & Bobot per kelas) — supaya nomor
// sertifikat & cara penerbitannya selalu konsisten di manapun dipanggil.
const { formatOfficialCertNumber, formatPersonalCertNumber } = require('./helpers');

// `breakdown` (opsional): rincian indikator penilaian yang menghasilkan nilai ini,
// contoh: [{ label: 'Kehadiran', weight: 10, score: 100 }, ...] atau
// [{ label: 'Materi 1: Grammar Dasar', weight: null, score: 90 }, ...].
// Disimpan APA ADANYA di dokumen sertifikat (snapshot saat terbit) — supaya
// kalau nanti komponen/materinya diubah/dihapus, sertifikat yang SUDAH terbit
// tetap menampilkan rincian yang benar sesuai kondisi saat diterbitkan dulu.
async function issueCertificate({ db, enrollmentId, userId, overallScore, breakdown = [] }) {
  const certCountSnap = await db.collection('certificates').get();
  const seq = certCountSnap.size + 1;
  const now = new Date();
  const certificateNumber = formatOfficialCertNumber(seq, now);
  const personalNumber = formatPersonalCertNumber(seq, now);

  const certRef = await db.collection('certificates').add({
    enrollmentId, userId, issuedAt: now, certificateNumber, personalNumber, breakdown
  });

  await db.collection('enrollments').doc(enrollmentId).update({
    certificateId: certRef.id,
    completedAt: now,
    overallScore
  });

  return { certificateId: certRef.id, certificateNumber, personalNumber };
}

module.exports = { issueCertificate };
