/**
 * captcha.js — Generator & session manager untuk sistem verifikasi captcha.
 *
 * Captcha types:
 *   'text' — Kode 6 karakter acak, user ketik di Modal
 *   'math' — Soal penjumlahan/pengurangan, user pilih jawaban via Button
 *
 * Sessions disimpan di memory (Map) — reset saat bot restart.
 */

// Karakter tanpa ambiguitas visual (tanpa 0/O, 1/I/L)
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// ── Generator ─────────────────────────────────────────────────────────────────

function generateTextCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

function generateMathQuestion() {
  const useSub = Math.random() > 0.5;
  let a, b, answer;

  if (useSub) {
    a = Math.floor(Math.random() * 50) + 20; // 20–69
    b = Math.floor(Math.random() * 18) + 2;  // 2–19
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 45) + 5;  // 5–49
    b = Math.floor(Math.random() * 45) + 5;  // 5–49
    answer = a + b;
  }

  // Buat 3 pilihan salah yang dekat dengan jawaban benar
  const wrongs = new Set();
  while (wrongs.size < 3) {
    const offset = Math.floor(Math.random() * 9) + 1;
    const wrong  = Math.random() > 0.5 ? answer + offset : answer - offset;
    if (wrong !== answer && wrong > 0) wrongs.add(wrong);
  }

  const choices = [answer.toString(), ...[...wrongs].map(String)]
    .sort(() => Math.random() - 0.5);

  return {
    question: `${a} ${useSub ? '−' : '+'} ${b} = ?`,
    answer:   answer.toString(),
    choices,
  };
}

// ── Session Management ────────────────────────────────────────────────────────

/** key: `${guildId}:${userId}` */
const sessions = new Map();

/**
 * Buat sesi captcha baru untuk user.
 * @returns Session object
 */
function createSession(guildId, userId, captchaType, config) {
  const key = `${guildId}:${userId}`;

  // Hapus sesi lama jika ada
  deleteSession(guildId, userId);

  let answer, question, choices, displayCode;

  if (captchaType === 'math') {
    const math = generateMathQuestion();
    answer   = math.answer;
    question = math.question;
    choices  = math.choices;
  } else {
    const code = generateTextCode(6);
    answer      = code;
    displayCode = code.split('').join(' '); // "A B C D E F"
  }

  const session = {
    guildId,
    userId,
    captchaType,
    answer,
    question:    question ?? null,
    choices:     choices  ?? null,
    displayCode: displayCode ?? null,
    attempts:    0,
    maxAttempts: config.maxAttempts ?? 3,
    timeout:     config.timeout ?? 300_000,
    kickOnFail:  config.kickOnFail ?? true,
    joinedAt:    Date.now(),
    messageId:   null,
    channelId:   null,
    timeoutHandle: null,
  };

  sessions.set(key, session);
  return session;
}

function getSession(guildId, userId) {
  return sessions.get(`${guildId}:${userId}`) ?? null;
}

function updateSession(guildId, userId, updates) {
  const key     = `${guildId}:${userId}`;
  const session = sessions.get(key);
  if (!session) return null;
  const updated = { ...session, ...updates };
  sessions.set(key, updated);
  return updated;
}

function incrementAttempts(guildId, userId) {
  const session = getSession(guildId, userId);
  if (!session) return null;
  return updateSession(guildId, userId, { attempts: session.attempts + 1 });
}

function deleteSession(guildId, userId) {
  const key     = `${guildId}:${userId}`;
  const session = sessions.get(key);
  if (session?.timeoutHandle) clearTimeout(session.timeoutHandle);
  sessions.delete(key);
}

function setTimeoutHandle(guildId, userId, handle) {
  updateSession(guildId, userId, { timeoutHandle: handle });
}

/** Hitung elapsed time yang sudah diformat */
function formatElapsed(joinedAt) {
  const ms   = Date.now() - joinedAt;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs} detik`;
  return `${Math.floor(secs / 60)} menit ${secs % 60} detik`;
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  incrementAttempts,
  deleteSession,
  setTimeoutHandle,
  formatElapsed,
};
