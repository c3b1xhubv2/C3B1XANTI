/**
 * devguilds.js — [Developer Only] Kelola deployment commands dari Discord.
 *
 * /devguilds list       — Lihat semua server tempat bot berada
 * /devguilds deployall  — Force deploy ulang ke semua server sekaligus
 * /devguilds status     — Lihat status deployment (hash, dll)
 *
 * File: src/commands/devguilds.js
 */

const { SlashCommandBuilder } = require('discord.js');
const { deployToAllGuilds, collectAllCommands } = require('../utils/deployCommands');
const { computeHash, getStoredHash, getDeployedGuilds, saveDeployment } = require('../utils/commandHash');
const { createSuccessResponse, createErrorResponse } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('devguilds')
    .setDescription('🔧 [Dev] Kelola deployment commands di semua server')
    .addSubcommand(sub =>
      sub.setName('list').setDescription('Lihat semua server tempat bot berada')
    )
    .addSubcommand(sub =>
      sub.setName('deployall').setDescription('Force deploy ulang ke semua server yang bot ada')
    )
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Lihat status deployment commands')
    ),

  async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply(
        createErrorResponse('Akses Ditolak', 'Command ini hanya untuk developer bot.')
      );
    }

    const sub = interaction.options.getSubcommand();

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const guilds = [...interaction.client.guilds.cache.values()];

      const lines = guilds.map((g, i) =>
        `${i + 1}. **${g.name}** — \`${g.id}\` (${g.memberCount} members)`
      );

      return interaction.reply(
        createSuccessResponse(
          `Daftar Server Bot (${guilds.length})`,
          lines.join('\n') || '*Belum ada server*'
        )
      );
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const commands       = collectAllCommands();
      const currentHash    = computeHash(commands);
      const storedHash     = getStoredHash();
      const deployedGuilds = getDeployedGuilds();
      const allGuildIds    = [...interaction.client.guilds.cache.keys()];
      const notDeployed    = allGuildIds.filter(id => !deployedGuilds.includes(id));

      return interaction.reply(
        createSuccessResponse(
          'Status Deployment Commands',
          [
            `**Commands         :** ${commands.length} (${commands.map(c => `\`/${c.name}\``).join(', ')})`,
            `**Hash Saat Ini    :** \`${currentHash}\``,
            `**Hash Tersimpan   :** \`${storedHash ?? 'belum ada'}\``,
            `**Status Hash      :** ${currentHash === storedHash ? '✅ Up-to-date' : '⚠️ Commands berubah!'}`,
            `**Total Server     :** ${allGuildIds.length}`,
            `**Sudah Deploy     :** ${deployedGuilds.length}`,
            `**Belum Deploy     :** ${notDeployed.length}`,
            notDeployed.length > 0
              ? `\n> ⚠️ Gunakan \`/devguilds deployall\` atau restart bot untuk deploy ke semua.`
              : '',
          ].filter(Boolean).join('\n')
        )
      );
    }

    // ── deployall ─────────────────────────────────────────────────────────────
    if (sub === 'deployall') {
      const allGuildIds = [...interaction.client.guilds.cache.keys()];

      if (allGuildIds.length === 0) {
        return interaction.reply(
          createErrorResponse('Tidak Ada Server', 'Bot belum bergabung ke server manapun.')
        );
      }

      await interaction.deferReply();

      const results = await deployToAllGuilds(allGuildIds);

      const lines = results.map(r => {
        const g = interaction.client.guilds.cache.get(r.guildId);
        const name = g?.name ?? r.guildId;
        return r.success ? `✅ **${name}**` : `❌ **${name}** — \`${r.error}\``;
      });

      const successCount = results.filter(r => r.success).length;

      // Update hash setelah deploy
      const commands = collectAllCommands();
      saveDeployment(computeHash(commands), allGuildIds);

      return interaction.editReply(
        createSuccessResponse(
          `Deploy Ulang Selesai — ${successCount}/${allGuildIds.length} Berhasil`,
          lines.join('\n')
        )
      );
    }
  },
};
