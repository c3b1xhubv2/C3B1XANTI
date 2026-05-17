/**
 * deployCommands.js — Utility untuk deploy commands ke guild secara instan.
 * Digunakan oleh guildCreate event, ready.js, dan CLI scripts.
 */

const { REST, Routes } = require('discord.js');
const path = require('path');
const fs   = require('fs');

/**
 * Kumpulkan semua command dari src/commands/ secara otomatis.
 * Setiap file .js yang punya properti `data` akan disertakan.
 */
function collectAllCommands() {
  const commandsPath = path.join(__dirname, '../commands');
  return fs.readdirSync(commandsPath)
    .filter(f => f.endsWith('.js'))
    .map(f => {
      const cmd = require(path.join(commandsPath, f));
      return cmd.data?.toJSON() ?? null;
    })
    .filter(Boolean);
}

/**
 * Deploy semua commands ke satu guild (instan, tidak ada delay).
 * @returns {{ success: boolean, count: number, error?: string }}
 */
async function deployToGuild(guildId) {
  try {
    const rest     = new REST().setToken(process.env.DISCORD_TOKEN);
    const commands = collectAllCommands();

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
      { body: commands }
    );

    return { success: true, count: commands.length };
  } catch (err) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Deploy ke banyak guild sekaligus dengan delay antar request
 * untuk menghindari rate limit Discord.
 * @param {string[]} guildIds
 * @param {number}   delayMs  — delay ms antar guild (default 350ms)
 */
async function deployToAllGuilds(guildIds, delayMs = 350) {
  const results = [];
  for (let i = 0; i < guildIds.length; i++) {
    const result = await deployToGuild(guildIds[i]);
    results.push({ guildId: guildIds[i], ...result });
    // Delay kecil antar request agar tidak kena rate limit
    if (i < guildIds.length - 1 && delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

module.exports = { collectAllCommands, deployToGuild, deployToAllGuilds };
