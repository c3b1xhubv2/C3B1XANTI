/**
 * setpunishment.js — Slash command untuk mengubah hukuman pelanggaran.
 *
 * Subcommands:
 *   /setpunishment antilink  timeout:<menit>  — Ubah durasi timeout anti-link
 *   /setpunishment antispam  timeout:<menit>  — Ubah durasi timeout anti-spam
 *   /setpunishment antispam  maxmessages:<n>  — Ubah batas pesan spam
 *   /setpunishment antispam  timewindow:<detik> — Ubah jendela waktu spam
 *   /setpunishment status                     — Lihat semua setting hukuman
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require('discord.js');

const {
  getGuildConfig,
  updateAntilinkConfig,
  updateAntispamConfig,
} = require('../utils/database');

const {
  createSuccessResponse,
  createErrorResponse,
  formatDuration,
} = require('../utils/components');

// ── Helper: bangun panel status hukuman ──────────────────────────────────────
function createPunishmentStatusResponse({ guildName, antilink, antispam }) {
  const c = new ContainerBuilder().setAccentColor(0x5865F2);

  // Header
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ⚖️ Status Hukuman Pelanggaran\n-# ${guildName}`)
  );
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Anti-Link
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        '### 🔗 Anti-Link',
        `**Status     :** ${antilink.enabled ? '🟢 Aktif' : '🔴 Nonaktif'}`,
        `**Hukuman    :** ⏱️ Timeout`,
        `**Durasi     :** ${formatDuration(antilink.timeoutDuration)}`,
      ].join('\n')
    )
  );

  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

  // Anti-Spam
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        '### 💬 Anti-Spam',
        `**Status     :** ${antispam.enabled ? '🟢 Aktif' : '🔴 Nonaktif'}`,
        `**Hukuman    :** ⏱️ Timeout`,
        `**Durasi     :** ${formatDuration(antispam.timeoutDuration)}`,
        `**Batas Pesan:** ${antispam.maxMessages} pesan / ${antispam.timeWindow / 1000}s`,
        `**Hapus Pesan:** ${antispam.deleteMessages ? 'Ya ✅' : 'Tidak ❌'}`,
      ].join('\n')
    )
  );

  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      '-# Gunakan `/setpunishment antilink` atau `/setpunishment antispam` untuk mengubah.'
    )
  );

  return { flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [c] };
}

// ── Command Definition ────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setpunishment')
    .setDescription('⚖️ Atur hukuman untuk pelanggaran di server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── /setpunishment antilink ─────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('antilink')
        .setDescription('Ubah hukuman untuk pelanggaran anti-link')
        .addIntegerOption(opt =>
          opt
            .setName('timeout')
            .setDescription('Durasi timeout dalam menit (1–1440)')
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(true)
        )
    )

    // ── /setpunishment antispam ─────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('antispam')
        .setDescription('Ubah hukuman untuk pelanggaran anti-spam')
        .addIntegerOption(opt =>
          opt
            .setName('timeout')
            .setDescription('Durasi timeout dalam menit (1–1440)')
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('maxmessages')
            .setDescription('Batas jumlah pesan sebelum dianggap spam (2–20)')
            .setMinValue(2)
            .setMaxValue(20)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('timewindow')
            .setDescription('Jendela waktu deteksi spam dalam detik (2–30)')
            .setMinValue(2)
            .setMaxValue(30)
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName('deletemessages')
            .setDescription('Hapus pesan spam secara otomatis? (default: ya)')
            .setRequired(false)
        )
    )

    // ── /setpunishment status ───────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Lihat semua setting hukuman yang aktif saat ini')
    ),

  // ── Handler Utama ───────────────────────────────────────────────────────────
  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const config  = getGuildConfig(guildId);

    // ── /setpunishment status ─────────────────────────────────────────────
    if (sub === 'status') {
      return interaction.reply(
        createPunishmentStatusResponse({
          guildName: interaction.guild.name,
          antilink:  config.antilink,
          antispam:  config.antispam,
        })
      );
    }

    // ── /setpunishment antilink ───────────────────────────────────────────
    if (sub === 'antilink') {
      const timeoutMinutes = interaction.options.getInteger('timeout');
      const timeoutMs      = timeoutMinutes * 60_000;

      updateAntilinkConfig(guildId, { timeoutDuration: timeoutMs });

      return interaction.reply(
        createSuccessResponse(
          'Hukuman Anti-Link Diperbarui',
          [
            `Durasi timeout anti-link berhasil diubah.`,
            '',
            `**Hukuman Baru :** ⏱️ Timeout **${formatDuration(timeoutMs)}**`,
            '',
            `-# Perubahan langsung berlaku untuk pelanggaran berikutnya.`,
          ].join('\n')
        )
      );
    }

    // ── /setpunishment antispam ───────────────────────────────────────────
    if (sub === 'antispam') {
      const timeoutMinutes = interaction.options.getInteger('timeout');
      const maxMessages    = interaction.options.getInteger('maxmessages');
      const timeWindowSec  = interaction.options.getInteger('timewindow');
      const deleteMessages = interaction.options.getBoolean('deletemessages');

      // Minimal satu opsi harus diisi
      if (
        timeoutMinutes === null &&
        maxMessages    === null &&
        timeWindowSec  === null &&
        deleteMessages === null
      ) {
        return interaction.reply(
          createErrorResponse(
            'Opsi Diperlukan',
            'Kamu harus mengisi setidaknya **satu** opsi:\n' +
            '- `timeout` — durasi timeout\n' +
            '- `maxmessages` — batas pesan spam\n' +
            '- `timewindow` — jendela waktu deteksi\n' +
            '- `deletemessages` — hapus pesan spam otomatis'
          )
        );
      }

      // Bangun object update, hanya isi yang berubah
      const updates = {};
      if (timeoutMinutes !== null) updates.timeoutDuration = timeoutMinutes * 60_000;
      if (maxMessages    !== null) updates.maxMessages     = maxMessages;
      if (timeWindowSec  !== null) updates.timeWindow      = timeWindowSec * 1_000;
      if (deleteMessages !== null) updates.deleteMessages  = deleteMessages;

      updateAntispamConfig(guildId, updates);

      // Ambil config terbaru untuk ditampilkan
      const updated = getGuildConfig(guildId).antispam;

      // Daftar perubahan yang dilakukan
      const changes = [];
      if (timeoutMinutes !== null) changes.push(`**Timeout        :** ⏱️ ${formatDuration(updated.timeoutDuration)}`);
      if (maxMessages    !== null) changes.push(`**Batas Pesan    :** ${updated.maxMessages} pesan`);
      if (timeWindowSec  !== null) changes.push(`**Jendela Waktu  :** ${updated.timeWindow / 1000} detik`);
      if (deleteMessages !== null) changes.push(`**Hapus Pesan    :** ${updated.deleteMessages ? 'Ya ✅' : 'Tidak ❌'}`);

      return interaction.reply(
        createSuccessResponse(
          'Hukuman Anti-Spam Diperbarui',
          [
            `Setting anti-spam berhasil diperbarui:`,
            '',
            ...changes,
            '',
            `-# Perubahan langsung berlaku untuk pelanggaran berikutnya.`,
          ].join('\n')
        )
      );
    }
  },
};
