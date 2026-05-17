/**
 * addguild.js — [Developer Only] Daftarkan guild saat ini untuk auto-deploy.
 *
 * Hanya bisa digunakan oleh OWNER_ID yang ada di .env.
 * Menyimpan guild ID ke data/dev-guilds.json dan langsung
 * men-deploy semua slash commands ke guild tersebut (instan).
 *
 * File: src/commands/addguild.js
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { addGuild, getGuilds }  = require('../utils/devGuilds');
const { deployToGuild }        = require('../utils/deployCommands');
const { createSuccessResponse, createErrorResponse } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addguild')
    .setDescription('🔧 [Dev] Daftarkan guild ini untuk auto-deploy slash commands'),

  async execute(interaction) {
    // ── Cek apakah user adalah owner bot ─────────────────────────────────────
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply(
        createErrorResponse(
          'Akses Ditolak',
          'Command ini **hanya untuk developer bot**.\nKamu tidak memiliki akses untuk menggunakan command ini.'
        )
      );
    }

    const guildId   = interaction.guild.id;
    const guildName = interaction.guild.name;

    // Cek apakah guild sudah terdaftar
    if (!addGuild(guildId)) {
      return interaction.reply(
        createErrorResponse(
          'Sudah Terdaftar',
          [
            `Guild **${guildName}** (\`${guildId}\`) sudah ada dalam daftar deploy.`,
            '',
            `Gunakan \`/devguilds\` untuk melihat semua guild yang terdaftar.`,
          ].join('\n')
        )
      );
    }

    // Defer agar ada waktu untuk deploy
    await interaction.deferReply();

    // Deploy semua commands ke guild ini
    const result = await deployToGuild(guildId);

    if (!result.success) {
      return interaction.editReply(
        createErrorResponse(
          'Deploy Gagal',
          [
            `Guild **${guildName}** berhasil ditambahkan ke daftar, tapi deploy commands gagal.`,
            `\`\`\`${result.error}\`\`\``,
            'Coba jalankan `node deploy-commands.js --guild` secara manual.',
          ].join('\n')
        )
      );
    }

    const totalGuilds = getGuilds().length;

    return interaction.editReply(
      createSuccessResponse(
        'Guild Berhasil Ditambahkan!',
        [
          `**${guildName}** (\`${guildId}\`) telah didaftarkan.`,
          '',
          `**✅ ${result.count} commands** berhasil di-deploy secara **instan** ke guild ini!`,
          `**📋 Total guild terdaftar:** ${totalGuilds}`,
          '',
          '> Setiap kali bot restart, commands akan otomatis di-deploy ulang ke semua guild yang terdaftar.',
        ].join('\n')
      )
    );
  },
};
