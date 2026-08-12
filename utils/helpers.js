// ==================== HELPER FUNCTIONS (TERPUSAT) ====================
const { db } = require('../config/firebase');

/**
 * Bikin username unik dari nama/email (dipakai saat admin membuat akun guru/siswa
 * lewat form, karena login sekarang pakai username — bukan email — sebagai
 * kredensial utama). Contoh: "Budi Santoso" -> "budisantoso", kalau sudah
 * dipakai -> "budisantoso2", "budisantoso3", dst.
 */
async function generateUniqueUsername(base) {
  let slug = String(base || 'user')
    .toLowerCase()
    .replace(/@.*/, '') // kalau base berupa email, buang bagian setelah @
    .replace(/[^a-z0-9]/g, '');
  if (!slug) slug = 'user';

  let candidate = slug;
  let suffix = 1;
  // Cari username yang belum dipakai (skala sekolah kecil-menengah, ini cepat).
  while (true) {
    const existing = await db.collection('users').where('username', '==', candidate).get();
    if (existing.empty) return candidate;
    suffix += 1;
    candidate = `${slug}${suffix}`;
  }
}

function getRemainingTime(startDate, durationStr) {
  if (!startDate) return { text: 'Belum dimulai', isFinished: false };
  const start = new Date(startDate);
  const now = new Date();
  const durationMatch = (durationStr || '').match(/(\d+)\s*(bulan|minggu|hari)/i);
  if (!durationMatch) return { text: 'Durasi tidak diketahui', isFinished: false };
  const value = parseInt(durationMatch[1]);
  const unit = durationMatch[2].toLowerCase();
  let endDate = new Date(start);
  if (unit === 'bulan') endDate.setMonth(endDate.getMonth() + value);
  else if (unit === 'minggu') endDate.setDate(endDate.getDate() + (value * 7));
  else if (unit === 'hari') endDate.setDate(endDate.getDate() + value);
  else return { text: 'Durasi tidak valid', isFinished: false };
  if (now >= endDate) return { text: 'Kursus selesai', isFinished: true };
  const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  if (diffDays >= 30) return { text: `${Math.floor(diffDays / 30)} bulan lagi`, isFinished: false };
  return { text: `${diffDays} hari lagi`, isFinished: false };
}

function calculateOverallScore(progress, syllabus) {
  let total = 0, count = 0;
  progress?.forEach(p => { if (p.score !== null && p.score !== undefined) { total += p.score; count++; } });
  return count === 0 ? 0 : Math.round(total / count);
}

function isAllCompleted(progress, passingScore = 70) {
  return progress?.every(p => p.score !== null && p.score >= passingScore) || false;
}

// Generate ID pendek untuk item materi di dalam syllabus (array di Firestore
// tidak punya auto-id per elemen seperti sub-collection, jadi kita buat sendiri)
function generateShortId(prefix = 'm') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// v2.0 Fase 3: hitung skor otomatis untuk quiz/CBT pilihan ganda
// answers: { [questionId]: pilihanIndex }, questions: [{ id, correctAnswer, points }]
function autoGradeQuiz(answers, questions) {
  let totalPoints = 0, earnedPoints = 0;
  const detail = questions.map(q => {
    const points = q.points || 10;
    totalPoints += points;
    const studentAnswer = answers ? answers[q.id] : undefined;
    const isCorrect = studentAnswer !== undefined && Number(studentAnswer) === Number(q.correctAnswer);
    if (isCorrect) earnedPoints += points;
    return { questionId: q.id, studentAnswer, isCorrect, points: isCorrect ? points : 0 };
  });
  const score = totalPoints === 0 ? 0 : Math.round((earnedPoints / totalPoints) * 100);
  return { score, detail, earnedPoints, totalPoints };
}

// ==================== TEMPLATE SERTIFIKAT RESMI (v2.0) ====================
// Klasifikasi nilai -> huruf & predikat, sesuai template sertifikat resmi sekolah
// (tabel "Grade Classification" yang tercetak di sertifikat).
function getGradeClassification(score) {
  const s = Number(score) || 0;
  if (s >= 86) return { grade: 'A', classification: 'EXCELLENT' };
  if (s >= 71) return { grade: 'B', classification: 'GOOD' };
  if (s >= 60) return { grade: 'C', classification: 'FAIRLY' };
  return { grade: 'D', classification: 'POOR' };
}

const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

// Format nomor sertifikat resmi, contoh: "007/G/MP-ILS/XII/2023"
// `sequence` adalah urutan sertifikat ke berapa (dihitung dari total sertifikat yang sudah terbit).
function formatOfficialCertNumber(sequence, date = new Date()) {
  const roman = ROMAN_MONTHS[date.getMonth()];
  return `${String(sequence).padStart(3, '0')}/G/MP-ILS/${roman}/${date.getFullYear()}`;
}

// Format nomor pribadi siswa yang tercetak di bawah nama, contoh: "258.03.10.23"
function formatPersonalCertNumber(sequence, date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${String(sequence).padStart(3, '0')}.${mm}.${dd}.${yy}`;
}

// Format nomor sertifikat EVENT (beda dari sertifikat kelulusan kursus — pakai
// kode "E" bukan "G"), contoh: "001/E/MP-ILS/VIII/2026"
function formatEventCertNumber(sequence, date = new Date()) {
  const roman = ROMAN_MONTHS[date.getMonth()];
  return `${String(sequence).padStart(3, '0')}/E/MP-ILS/${roman}/${date.getFullYear()}`;
}

module.exports = {
  getRemainingTime, calculateOverallScore, isAllCompleted, generateShortId, autoGradeQuiz,
  getGradeClassification, formatOfficialCertNumber, formatPersonalCertNumber, generateUniqueUsername,
  formatEventCertNumber
};
