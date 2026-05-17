/**
 * devGuilds.js — Manajemen daftar guild untuk auto-deploy commands.
 * Data disimpan di data/dev-guilds.json (bukan .env).
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../../data/dev-guilds.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir))  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ guilds: [] }, null, 2));
}

function read() {
  ensureFile();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { guilds: [] }; }
}

function write(data) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function getGuilds() {
  return read().guilds;
}

function addGuild(guildId) {
  const data = read();
  if (data.guilds.includes(guildId)) return false;
  data.guilds.push(guildId);
  write(data);
  return true;
}

function removeGuild(guildId) {
  const data = read();
  if (!data.guilds.includes(guildId)) return false;
  data.guilds = data.guilds.filter(id => id !== guildId);
  write(data);
  return true;
}

module.exports = { getGuilds, addGuild, removeGuild };
