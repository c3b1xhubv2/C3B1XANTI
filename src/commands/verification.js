/**
 * verification.js — Sistem verifikasi captcha untuk server Discord.
 *
 * Subcommands:
 *   /verification setup   — Aktifkan + konfigurasi verifikasi
 *   /verification disable — Matikan verifikasi
 *   /verification status  — Lihat konfigurasi saat ini
 *
 * File: src/commands/verification.js
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGuildConfig, updateVerificationConfig } = require('../utils/database');
const { createVerificationStatusResponse, createSuccessResponse, createErrorResponse } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verification')
    .setDescription('🔐 Sistem verifikasi captcha untuk member baru')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── setup ────────────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('setup').setDescription('Aktifkan dan konfigurasi sistem verifikasi')
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel tempat captcha dikirim saat member join').setRequired(true))
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role yang diberikan setelah verifikasi berhasil').setRequired(true))
        .addStringOption(opt =>
          opt.setName('captcha').setDescription('Tipe captcha').setRequired(false)
            .addChoices(
              { name: '📝 Text — Ketik 6 karakter acak (lebih aman)', value: 'text' },
              { name: '🔢 Matematika — Pilih jawaban dari soal penjumlahan/pengurangan', value: 'math' },
            ))
        .addChannelOption(opt =>
          opt.setName('logchannel').setDescription('Channel untuk mengirim log verifikasi').setRequired(false))
        .addIntegerOption(opt =>
          opt.setName('timeout').setDescription('Waktu maksimal verifikasi dalam menit (default: 5)').setMinValue(1).setMaxValue(60).setRequired(false))
        .addIntegerOption(opt =>
          opt.setName('maxattempts').setDescription('Maksimal percobaan salah (default: 3)').setMinValue(1).setMaxValue(5).setRequired(false))
        .addBooleanOption(opt =>
          opt.setName('kickonfail').setDescription('Kick member jika gagal/timeout? (default: Ya)').setRequired(false))
    )

    // ── disable ──────────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('disable').setDescription('Nonaktifkan sistem verifikasi')
    )

    // ── status ───────────────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub.setName('status').setDescription('Lihat konfigurasi verifikasi saat ini')
    ),

  async execute(interaction) {
    const { guild, options } = interaction;
    const sub = options.getSubcommand();

    // ── setup ────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const channel    = options.getChannel('channel');
      const role       = options.getRole('role');
      const captchaType = options.getString('captcha') ?? 'text';
      const logChannel  = options.getChannel('logchannel');
      const timeout     = (options.getInteger('timeout') ?? 5) * 60_000;
      const maxAttempts = options.getInteger('maxattempts') ?? 3;
      const kickOnFail  = options.getBoolean('kickonfail') ?? true;

      updateVerificationConfig(guild.id, {
        enabled:      true,
        channel:      channel.id,
        logChannel:   logChannel?.id ?? null,
        verifiedRole: role.id,
        captchaType,
        timeout,
        maxAttempts,
        kickOnFail,
      });

      const timeoutMin = timeout / 60_000;
      return interaction.reply(
        createSuccessResponse(
          '✅ Verifikasi Diaktifkan!',
          [
            `**Channel Verif.  :** <#${channel.id}>`,
            `**Role Verified   :** <@&${role.id}>`,
            `**Tipe Captcha    :** ${captchaType === 'math' ? 'Matematika 🔢' : 'Text 📝'}`,
            `**Log Channel     :** ${logChannel ? `<#${logChannel.id}>` : '*(tidak diatur)*'}`,
            `**Timeout         :** ${timeoutMin} menit`,
            `**Maks Percobaan  :** ${maxAttempts}x`,
            `**Kick jika Gagal :** ${kickOnFail ? 'Ya 🦵' : 'Tidak'}`,
            '',
            '> **💡 Tips setup server:**',
            '> 1. Buat role `Unverified` dan role `Verified`',
            '> 2. Semua channel: deny @everyone, allow `Verified`',
            '> 3. Channel verifikasi: allow @everyone (atau `Unverified`) untuk melihat & kirim pesan',
            '> 4. Setelah verifikasi, bot otomatis memberi role `Verified`',
          ].join('\n')
        )
      );
    }

    // ── disable ──────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      const config = getGuildConfig(guild.id).verification;
      if (!config.enabled) {
        return interaction.reply(createErrorResponse('Sudah Nonaktif', 'Sistem verifikasi memang sudah tidak aktif.'));
      }
      updateVerificationConfig(guild.id, { enabled: false });
      return interaction.reply(createSuccessResponse('Verifikasi Dinonaktifkan', 'Sistem verifikasi telah dimatikan.'));
    }

    // ── status ───────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const config = getGuildConfig(guild.id).verification;
      return interaction.reply(
        createVerificationStatusResponse({ guildName: guild.name, verification: config })
      );
    }
  },
};
