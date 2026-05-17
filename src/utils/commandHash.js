/**
 * commandHash.js — Sistem deteksi perubahan command.
 *
 * Menyimpan hash dari semua commands dan daftar guild yang sudah di-deploy.
 * Ketika command berubah → hash baru → auto redeploy ke semua guild.
 * Data disimpan di: data/command-hash.json
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const FILE = path.join(__dirname, '../../data/command-hash.json');

function ensureDir() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readData() {
  ensureDir();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { hash: null, deployedGuilds: [], updatedAt: null }; }
}

function writeData(data) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

/**
 * Hitung hash pendek dari daftar commands.
 * Hash berubah jika ada command baru, dihapus, atau diubah option-nya.
 */
function computeHash(commands) {
  const normalized = commands
    .map(c => JSON.stringify(c))
    .sort()
    .join('');
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

function getStoredHash()     { return readData().hash; }
function getDeployedGuilds() { return readData().deployedGuilds ?? []; }

/**
 * Simpan hash terbaru dan daftar guild yang sudah di-deploy.
 */
function saveDeployment(hash, guildIds) {
  writeData({
    hash,
    deployedGuilds: [...new Set(guildIds)],
    updatedAt:      new Date().toISOString(),
  });
}

function addDeployedGuild(guildId) {
  const data = readData();
  if (!data.deployedGuilds.includes(guildId)) {
    data.deployedGuilds.push(guildId);
    writeData(data);
  }
}

function removeDeployedGuild(guildId) {
  const data = readData();
  data.deployedGuilds = data.deployedGuilds.filter(id => id !== guildId);
  writeData(data);
}

module.exports = {
  computeHash,
  getStoredHash,
  getDeployedGuilds,
  saveDeployment,
  addDeployedGuild,
  removeDeployedGuild,
};
