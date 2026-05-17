/**
 * database.js — Manajemen data konfigurasi berbasis JSON.
 * Mendukung: antilink, antispam, verification config per guild.
 */

const fs   = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, '../../data/guilds.json');

function ensureDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir))     fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ guilds: {} }, null, 2));
}
function readDB() {
  ensureDB();
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { guilds: {} }; }
}
function writeDB(data) {
  ensureDB();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function defaultAntilink() {
  return { enabled: false, mode: 'all', channels: [], exemptRoles: [], timeoutDuration: 300_000, logChannel: null };
}
function defaultAntispam() {
  return { enabled: false, mode: 'all', channels: [], exemptRoles: [], maxMessages: 5, timeWindow: 5_000, timeoutDuration: 300_000, deleteMessages: true, logChannel: null };
}
function defaultVerification() {
  return {
    enabled:       false,
    channel:       null,      // ID channel verifikasi
    logChannel:    null,      // ID channel logs
    verifiedRole:  null,      // ID role yang diberikan setelah verifikasi
    unverifiedRole: null,     // ID role yang diberikan saat join (opsional)
    captchaType:   'text',    // 'text' | 'math'
    timeout:       300_000,   // 5 menit
    maxAttempts:   3,
    kickOnFail:    true,      // kick jika gagal / timeout
  };
}

function getGuildConfig(guildId) {
  const db = readDB();
  if (!db.guilds[guildId]) db.guilds[guildId] = {};
  db.guilds[guildId].antilink      = { ...defaultAntilink(),      ...(db.guilds[guildId].antilink      ?? {}) };
  db.guilds[guildId].antispam      = { ...defaultAntispam(),      ...(db.guilds[guildId].antispam      ?? {}) };
  db.guilds[guildId].verification  = { ...defaultVerification(),  ...(db.guilds[guildId].verification  ?? {}) };
  writeDB(db);
  return db.guilds[guildId];
}
function setGuildConfig(guildId, config) {
  const db = readDB();
  db.guilds[guildId] = config;
  writeDB(db);
  return config;
}
function updateAntilinkConfig(guildId, updates) {
  const config = getGuildConfig(guildId);
  config.antilink = { ...config.antilink, ...updates };
  return setGuildConfig(guildId, config);
}
function updateAntispamConfig(guildId, updates) {
  const config = getGuildConfig(guildId);
  config.antispam = { ...config.antispam, ...updates };
  return setGuildConfig(guildId, config);
}
function updateVerificationConfig(guildId, updates) {
  const config = getGuildConfig(guildId);
  config.verification = { ...config.verification, ...updates };
  return setGuildConfig(guildId, config);
}

module.exports = { getGuildConfig, setGuildConfig, updateAntilinkConfig, updateAntispamConfig, updateVerificationConfig };
