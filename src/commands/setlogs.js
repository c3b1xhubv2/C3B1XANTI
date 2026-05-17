/**
 * setlogs.js — Slash command untuk mengatur channel log.
 *
 * Subcommands:
 *   /setlogs antilink  — Atur channel log anti-link
 *   /setlogs antispam  — Atur channel log anti-spam
 *   /setlogs disable   — Nonaktifkan log (pilih jenis)
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const { updateAntilinkConfig, updateAntispamConfig } = require('../utils/database');
const { createSuccessResponse, createErrorResponse } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogs')
    .setDescription('📋 Atur channel log untuk sistem bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /setlogs antilink
    .addSubcommand(sub =>
      sub
        .setName('antilink')
        .setDescription('Atur channel log untuk pelanggaran anti-link')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel tujuan log anti-link')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )

    // /setlogs antispam
    .addSubcommand(sub =>
      sub
        .setName('antispam')
        .setDescription('Atur channel log untuk pelanggaran anti-spam')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel tujuan log anti-spam')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )

    // /setlogs disable
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Nonaktifkan pengiriman log untuk sistem tertentu')
        .addStringOption(opt =>
          opt
            .setName('sistem')
            .setDescription('Sistem yang ingin dinonaktifkan log-nya')
            .setRequired(true)
            .addChoices(
              { name: '🔗 Anti-Link', value: 'antilink' },
              { name: '💬 Anti-Spam', value: 'antispam' },
              { name: '🔴 Semua', value: 'all' }
            )
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Cek permission bot di channel log
    async function checkPerms(channel) {
      const perms = channel.permissionsFor(interaction.guild.members.me);
      return perms?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel]);
    }

    // ── antilink ────────────────────────────────────────────────────────────
    if (sub === 'antilink') {
      const channel = interaction.options.getChannel('channel');

      if (!await checkPerms(channel)) {
        return interaction.reply(
          createErrorResponse(
            'Izin Kurang',
            `Bot tidak punya izin **Send Messages** di ${channel}.\nBerikan izin terlebih dahulu.`
          )
        );
      }

      updateAntilinkConfig(interaction.guild.id, { logChannel: channel.id });

      return interaction.reply(
        createSuccessResponse(
          'Log Anti-Link Diatur!',
          [
            `Log pelanggaran anti-link akan dikirim ke ${channel}.`,
            '',
            '> 💡 Pastikan channel ini hanya bisa dilihat moderator.',
            '> Setiap pelanggaran mengirim log lengkap (avatar, user, link, timeout).',
          ].join('\n')
        )
      );
    }

    // ── antispam ────────────────────────────────────────────────────────────
    if (sub === 'antispam') {
      const channel = interaction.options.getChannel('channel');

      if (!await checkPerms(channel)) {
        return interaction.reply(
          createErrorResponse(
            'Izin Kurang',
            `Bot tidak punya izin **Send Messages** di ${channel}.\nBerikan izin terlebih dahulu.`
          )
        );
      }

      updateAntispamConfig(interaction.guild.id, { logChannel: channel.id });

      return interaction.reply(
        createSuccessResponse(
          'Log Anti-Spam Diatur!',
          [
            `Log pelanggaran anti-spam akan dikirim ke ${channel}.`,
            '',
            '> 💡 Pastikan channel ini hanya bisa dilihat moderator.',
            '> Log berisi: jumlah spam, pesan dihapus, durasi timeout.',
          ].join('\n')
        )
      );
    }

    // ── disable ─────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      const sistem = interaction.options.getString('sistem');

      if (sistem === 'antilink' || sistem === 'all') {
        updateAntilinkConfig(interaction.guild.id, { logChannel: null });
      }
      if (sistem === 'antispam' || sistem === 'all') {
        updateAntispamConfig(interaction.guild.id, { logChannel: null });
      }

      const label = {
        antilink: '🔗 Anti-Link',
        antispam: '💬 Anti-Spam',
        all:      '🔗 Anti-Link & 💬 Anti-Spam',
      }[sistem];

      return interaction.reply(
        createSuccessResponse(
          'Log Dinonaktifkan',
          `Log untuk sistem **${label}** telah dimatikan.\nGunakan \`/setlogs\` untuk mengaktifkan kembali.`
        )
      );
    }
  },
};
