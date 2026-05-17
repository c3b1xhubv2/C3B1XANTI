/**
 * antilink.js — Slash command utama untuk kelola sistem anti-link.
 *
 * Subcommands:
 *   /antilink setup    — Aktifkan anti-link (all/specific channel, durasi timeout)
 *   /antilink disable  — Nonaktifkan anti-link
 *   /antilink status   — Lihat konfigurasi saat ini
 *   /antilink addchannel — Tambah channel ke mode specific
 *   /antilink removechannel — Hapus channel dari mode specific
 *   /antilink exempt   — Kelola role yang dikecualikan
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');

const { getGuildConfig, updateAntilinkConfig } = require('../utils/database');
const {
  createSuccessResponse,
  createErrorResponse,
  createStatusResponse,
  createInfoPanel,
  formatDuration,
} = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antilink')
    .setDescription('⚙️ Kelola sistem anti-link server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ── /antilink setup ───────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('Aktifkan dan konfigurasi sistem anti-link')
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
            .setName('timeout')
            .setDescription('Durasi timeout dalam menit (default: 5, maks: 1440)')
            .setMinValue(1)
            .setMaxValue(1440)
            .setRequired(false)
        )
    )

    // ── /antilink disable ─────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Nonaktifkan sistem anti-link untuk seluruh server')
    )

    // ── /antilink status ──────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Lihat status dan konfigurasi anti-link saat ini')
    )

    // ── /antilink addchannel ──────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('addchannel')
        .setDescription('Tambah channel ke daftar yang dilindungi (mode: specific)')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel yang ingin ditambahkan')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )

    // ── /antilink removechannel ───────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('removechannel')
        .setDescription('Hapus channel dari daftar yang dilindungi (mode: specific)')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel yang ingin dihapus')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )

    // ── /antilink exempt ──────────────────────────────────────────────────────
    .addSubcommand(sub =>
      sub
        .setName('exempt')
        .setDescription('Tambah atau hapus role yang dikecualikan dari anti-link')
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

  // ── Handler utama ───────────────────────────────────────────────────────────
  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // ── setup ─────────────────────────────────────────────────────────────────
    if (sub === 'setup') {
      const mode           = interaction.options.getString('mode');
      const channel        = interaction.options.getChannel('channel');
      const timeoutMinutes = interaction.options.getInteger('timeout') ?? 5;
      const timeoutMs      = timeoutMinutes * 60_000;

      if (mode === 'specific' && !channel) {
        return interaction.reply(
          createErrorResponse(
            'Channel Diperlukan',
            'Mode **specific** membutuhkan channel yang dipilih.\nGunakan option `channel` untuk memilih channel yang ingin dilindungi.'
          )
        );
      }

      const config   = getGuildConfig(guildId);
      let   channels = config.antilink.channels ?? [];

      if (mode === 'specific' && channel) {
        if (!channels.includes(channel.id)) channels.push(channel.id);
      } else if (mode === 'all') {
        channels = []; // reset saat mode all
      }

      updateAntilinkConfig(guildId, {
        enabled: true,
        mode,
        channels,
        timeoutDuration: timeoutMs,
      });

      const scope = mode === 'all'
        ? '🌐 **Semua Channel**'
        : `📌 ${channel}`;

      return interaction.reply(
        createSuccessResponse(
          'Anti-Link Diaktifkan!',
          [
            `Sistem anti-link berhasil dikonfigurasi.`,
            '',
            `**Mode        :** ${scope}`,
            `**Timeout     :** ${formatDuration(timeoutMs)}`,
            '',
            '> Pengguna yang mengirim link akan otomatis dihapus pesannya dan di-timeout.',
            '> Pastikan sudah mengatur log channel dengan `/setlogs antilink`.',
          ].join('\n')
        )
      );
    }

    // ── disable ───────────────────────────────────────────────────────────────
    if (sub === 'disable') {
      updateAntilinkConfig(guildId, { enabled: false });

      return interaction.reply(
        createSuccessResponse(
          'Anti-Link Dinonaktifkan',
          'Sistem anti-link telah **dimatikan** untuk seluruh server.\nGunakan `/antilink setup` untuk mengaktifkan kembali.'
        )
      );
    }

    // ── status ────────────────────────────────────────────────────────────────
    if (sub === 'status') {
      const config = getGuildConfig(guildId);

      return interaction.reply(
        createStatusResponse({
          guildName: interaction.guild.name,
          antilink:  config.antilink,
        })
      );
    }

    // ── addchannel ────────────────────────────────────────────────────────────
    if (sub === 'addchannel') {
      const channel = interaction.options.getChannel('channel');
      const config  = getGuildConfig(guildId);
      const { channels } = config.antilink;

      if (channels.includes(channel.id)) {
        return interaction.reply(
          createErrorResponse(
            'Channel Sudah Ada',
            `${channel} sudah ada dalam daftar channel yang dilindungi.`
          )
        );
      }

      updateAntilinkConfig(guildId, {
        channels: [...channels, channel.id],
        mode:     'specific',
        enabled:  true,
      });

      return interaction.reply(
        createSuccessResponse(
          'Channel Ditambahkan',
          [
            `${channel} berhasil ditambahkan ke daftar channel yang dilindungi.`,
            '',
            `> Mode otomatis diset ke **specific** dan anti-link **diaktifkan**.`,
          ].join('\n')
        )
      );
    }

    // ── removechannel ─────────────────────────────────────────────────────────
    if (sub === 'removechannel') {
      const channel  = interaction.options.getChannel('channel');
      const config   = getGuildConfig(guildId);
      const channels = config.antilink.channels;

      if (!channels.includes(channel.id)) {
        return interaction.reply(
          createErrorResponse(
            'Channel Tidak Ditemukan',
            `${channel} tidak ada dalam daftar channel yang dilindungi.`
          )
        );
      }

      const newChannels = channels.filter(id => id !== channel.id);
      updateAntilinkConfig(guildId, { channels: newChannels });

      return interaction.reply(
        createSuccessResponse(
          'Channel Dihapus',
          [
            `${channel} berhasil dihapus dari daftar perlindungan.`,
            newChannels.length === 0
              ? '\n> ⚠️ Daftar channel kosong. Gunakan `/antilink setup mode:all` untuk melindungi semua channel.'
              : `\n> Sisa channel dilindungi: **${newChannels.length}**`,
          ].join('')
        )
      );
    }

    // ── exempt ────────────────────────────────────────────────────────────────
    if (sub === 'exempt') {
      const role   = interaction.options.getRole('role');
      const action = interaction.options.getString('action');
      const config = getGuildConfig(guildId);
      let   exempt = config.antilink.exemptRoles ?? [];

      if (action === 'add') {
        if (exempt.includes(role.id)) {
          return interaction.reply(
            createErrorResponse('Role Sudah Ada', `${role} sudah ada dalam daftar exempt.`)
          );
        }
        exempt.push(role.id);
        updateAntilinkConfig(guildId, { exemptRoles: exempt });

        return interaction.reply(
          createSuccessResponse(
            'Role Exempt Ditambahkan',
            `${role} berhasil ditambahkan.\nAnggota dengan role ini tidak akan terkena anti-link.`
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
        updateAntilinkConfig(guildId, { exemptRoles: exempt });

        return interaction.reply(
          createSuccessResponse(
            'Role Exempt Dihapus',
            `${role} berhasil dihapus dari daftar exempt.\nAnggota dengan role ini sekarang terkena anti-link.`
          )
        );
      }
    }
  },
};
