/**
 * antispam.js — Slash command untuk kelola sistem anti-spam.
 *
 * Subcommands:
 *   /antispam setup        — Aktifkan anti-spam (mode, threshold, window, timeout)
 *   /antispam disable      — Nonaktifkan anti-spam
 *   /antispam status       — Lihat konfigurasi saat ini
 *   /antispam addchannel   — Tambah channel (mode: specific)
 *   /antispam removechannel — Hapus channel dari daftar
 *   /antispam exempt       — Kelola role yang dikecualikan
 *
 * Letakkan file ini di: src/commands/antispam.js
 * Bot akan otomatis memuatnya saat restart (tidak perlu ubah file lain).
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const { getGuildConfig, updateAntispamConfig } = require('../utils/database');
const {
  createSuccessResponse,
  createErrorResponse,
  createAntispamStatusResponse,
  formatDuration,
} = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('⚙️ Kelola sistem anti-spam server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // /antispam setup
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Aktifkan dan konfigurasi sistem anti-spam')
        .addStringOption(opt =>
          opt
            .setName('mode')
            .setDescription('Pilih mode perlindungan channel')
            .setRequired(true)
            .addChoices(
              { name: '🌐 Semua Channel', value: 'all' },
              { name: '📌 Channel Tertentu', value: 'specific' }
            )
        )
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel yang dilindungi (wajib untuk mode: specific)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('maxpesan')
            .setDescription('Batas maks pesan sebelum dianggap spam (default: 5)')
            .setMinValue(2)
            .setMaxValue(30)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('window')
            .setDescription('Periode waktu dalam detik (default: 5)')
            .setMinValue(1)
            .setMaxValue(60)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt
            .setName('timeout')
            .setDescription('Durasi timeout dalam menit (default: 5)')
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName('hapuspesan')
            .setDescription('Hapus pesan spam? (default: ya)')
            .setRequired(false)
        )
    )

    // /antispam disable
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Nonaktifkan sistem anti-spam seluruh server')
    )

    // /antispam status
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Lihat status dan konfigurasi anti-spam saat ini')
    )

    // /antispam addchannel
    .addSubcommand(sub =>
      sub
        .setName('addchannel')
        .setDescription('Tambah channel ke daftar yang dipantau (mode: specific)')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel yang ingin ditambahkan')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )

    // /antispam removechannel
    .addSubcommand(sub =>
      sub
        .setName('removechannel')
        .setDescription('Hapus channel dari daftar yang dipantau (mode: specific)')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel yang ingin dihapus')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )

    // /antispam exempt
    .addSubcommand(sub =>
      sub
        .setName('exempt')
        .setDescription('Tambah atau hapus role yang dikecualikan dari anti-spam')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('Role yang akan dikelola')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('Tambah atau hapus role dari daftar exempt')
            .setRequired(true)
            .addChoices(
              { name: '➕ Tambah ke exempt', value: 'add' },
              { name: '➖ Hapus dari exempt', value: 'remove' }
            )
        )
    ),

  // ── Execute ───────────────────────────────────────────────────────────────
  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── setup ───────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const mode          = interaction.options.getString('mode');
      const channel       = interaction.options.getChannel('channel');
      const maxMessages   = interaction.options.getInteger('maxpesan') ?? 5;
      const windowSec     = interaction.options.getInteger('window') ?? 5;
      const timeoutMin    = interaction.options.getInteger('timeout') ?? 5;
      const deleteMsg     = interaction.options.getBoolean('hapuspesan') ?? true;

      if (mode === 'specific' && !channel) {
        return interaction.reply(
          createErrorResponse(
            'Channel Diperlukan',
            'Mode **specific** membutuhkan channel yang dipilih.\nGunakan option `channel` untuk memilih channel yang ingin dipantau.'
          )
        );
      }

      const config   = getGuildConfig(guildId);
      let   channels = config.antispam.channels ?? [];

      if (mode === 'specific' && channel) {
        if (!channels.includes(channel.id)) channels.push(channel.id);
      } else if (mode === 'all') {
        channels = [];
      }

      updateAntispamConfig(guildId, {
        enabled:         true,
        mode,
        channels,
        maxMessages,
        timeWindow:      windowSec * 1000,
        timeoutDuration: timeoutMin * 60_000,
        deleteMessages:  deleteMsg,
      });

      const scope = mode === 'all' ? '🌐 **Semua Channel**' : `📌 ${channel}`;

      return interaction.reply(
        createSuccessResponse(
          'Anti-Spam Diaktifkan!',
          [
            `Sistem anti-spam berhasil dikonfigurasi.`,
            '',
            `**Mode         :** ${scope}`,
            `**Batas Pesan  :** ${maxMessages} pesan / ${windowSec} detik`,
            `**Timeout      :** ${formatDuration(timeoutMin * 60_000)}`,
            `**Hapus Pesan  :** ${deleteMsg ? 'Ya' : 'Tidak'}`,
            '',
            '> Berlaku untuk semua user yang role-nya **di bawah role bot**, termasuk yang punya Administrator.',
            '> Pastikan sudah mengatur log channel dengan `/setlogs antispam`.',
          ].join('\n')
        )
      );
    }

    // ── disable ─────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      updateAntispamConfig(guildId, { enabled: false });

      return interaction.reply(
        createSuccessResponse(
          'Anti-Spam Dinonaktifkan',
          'Sistem anti-spam telah **dimatikan** untuk seluruh server.\nGunakan `/antispam setup` untuk mengaktifkan kembali.'
        )
      );
    }

    // ── status ──────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const config = getGuildConfig(guildId);

      return interaction.reply(
        createAntispamStatusResponse({
          guildName: interaction.guild.name,
          antispam:  config.antispam,
        })
      );
    }

    // ── addchannel ──────────────────────────────────────────────────────────
    if (sub === 'addchannel') {
      const channel = interaction.options.getChannel('channel');
      const config  = getGuildConfig(guildId);
      const { channels } = config.antispam;

      if (channels.includes(channel.id)) {
        return interaction.reply(
          createErrorResponse('Channel Sudah Ada', `${channel} sudah ada dalam daftar channel yang dipantau.`)
        );
      }

      updateAntispamConfig(guildId, {
        channels: [...channels, channel.id],
        mode:     'specific',
        enabled:  true,
      });

      return interaction.reply(
        createSuccessResponse(
          'Channel Ditambahkan',
          [
            `${channel} berhasil ditambahkan ke daftar channel yang dipantau.`,
            '',
            '> Mode otomatis diset ke **specific** dan anti-spam **diaktifkan**.',
          ].join('\n')
        )
      );
    }

    // ── removechannel ────────────────────────────────────────────────────────
    if (sub === 'removechannel') {
      const channel  = interaction.options.getChannel('channel');
      const config   = getGuildConfig(guildId);
      const channels = config.antispam.channels;

      if (!channels.includes(channel.id)) {
        return interaction.reply(
          createErrorResponse('Channel Tidak Ditemukan', `${channel} tidak ada dalam daftar channel yang dipantau.`)
        );
      }

      const newChannels = channels.filter(id => id !== channel.id);
      updateAntispamConfig(guildId, { channels: newChannels });

      return interaction.reply(
        createSuccessResponse(
          'Channel Dihapus',
          [
            `${channel} berhasil dihapus dari daftar pantauan.`,
            newChannels.length === 0
              ? '\n> ⚠️ Daftar kosong. Gunakan `/antispam setup mode:all` untuk pantau semua channel.'
              : `\n> Sisa channel dipantau: **${newChannels.length}**`,
          ].join('')
        )
      );
    }

    // ── exempt ───────────────────────────────────────────────────────────────
    if (sub === 'exempt') {
      const role   = interaction.options.getRole('role');
      const action = interaction.options.getString('action');
      const config = getGuildConfig(guildId);
      let   exempt = config.antispam.exemptRoles ?? [];

      if (action === 'add') {
        if (exempt.includes(role.id)) {
          return interaction.reply(
            createErrorResponse('Role Sudah Ada', `${role} sudah ada dalam daftar exempt.`)
          );
        }
        exempt.push(role.id);
        updateAntispamConfig(guildId, { exemptRoles: exempt });

        return interaction.reply(
          createSuccessResponse(
            'Role Exempt Ditambahkan',
            `${role} berhasil ditambahkan.\nAnggota dengan role ini tidak akan terkena anti-spam.`
          )
        );
      }

      if (action === 'remove') {
        if (!exempt.includes(role.id)) {
          return interaction.reply(
            createErrorResponse('Role Tidak Ditemukan', `${role} tidak ada dalam daftar exempt.`)
          );
        }
        exempt = exempt.filter(id => id !== role.id);
        updateAntispamConfig(guildId, { exemptRoles: exempt });

        return interaction.reply(
          createSuccessResponse(
            'Role Exempt Dihapus',
            `${role} berhasil dihapus dari daftar exempt.\nAnggota dengan role ini sekarang terkena anti-spam.`
          )
        );
      }
    }
  },
};
