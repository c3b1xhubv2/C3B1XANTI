/**
 * removeguild.js — [Developer Only] Hapus guild dari daftar auto-deploy.
 *
 * File: src/commands/removeguild.js
 */

const { SlashCommandBuilder } = require('discord.js');
const { removeGuild, getGuilds } = require('../utils/devGuilds');
const { REST, Routes }           = require('discord.js');
const { createSuccessResponse, createErrorResponse } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removeguild')
    .setDescription('🔧 [Dev] Hapus guild ini dari daftar auto-deploy')
    .addBooleanOption(opt =>
      opt
        .setName('hapuscommands')
        .setDescription('Hapus juga guild commands dari Discord? (default: tidak)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (interaction.user.id !== process.env.OWNER_ID) {
      return interaction.reply(
        createErrorResponse('Akses Ditolak', 'Command ini hanya untuk developer bot.')
      );
    }

    const guildId      = interaction.guild.id;
    const guildName    = interaction.guild.name;
    const hapusCmd     = interaction.options.getBoolean('hapuscommands') ?? false;

    if (!removeGuild(guildId)) {
      return interaction.reply(
        createErrorResponse(
          'Guild Tidak Ditemukan',
          `Guild **${guildName}** tidak ada dalam daftar deploy.\nGunakan \`/devguilds\` untuk melihat daftar.`
        )
      );
    }

    await interaction.deferReply();

    let cmdInfo = '';
    if (hapusCmd) {
      try {
        const rest = new REST().setToken(process.env.DISCORD_TOKEN);
        await rest.put(
          Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
          { body: [] }
        );
        cmdInfo = '\n**🗑️ Guild commands** di Discord juga sudah dihapus (kembali ke global commands).';
      } catch (err) {
        cmdInfo = `\n⚠️ Gagal hapus guild commands dari Discord: \`${err.message}\``;
      }
    }

    const totalGuilds = getGuilds().length;

    return interaction.editReply(
      createSuccessResponse(
        'Guild Dihapus',
        [
          `**${guildName}** (\`${guildId}\`) telah dihapus dari daftar deploy.`,
          `**📋 Sisa guild terdaftar:** ${totalGuilds}`,
          cmdInfo,
        ].filter(Boolean).join('\n')
      )
    );
  },
};
