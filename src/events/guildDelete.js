/**
 * guildDelete.js — Dipanggil saat bot KELUAR dari server (kick/ban/leave).
 * Membersihkan record server dari tracking list.
 */

const { removeDeployedGuild } = require('../utils/commandHash');

module.exports = {
  name: 'guildDelete',
  once: false,

  async execute(guild) {
    console.log(`\n📤 Bot keluar dari server: "${guild.name ?? 'Unknown'}" (${guild.id})\n`);
    // Hapus dari daftar deployed guilds agar tidak di-track lagi
    removeDeployedGuild(guild.id);
  },
};
