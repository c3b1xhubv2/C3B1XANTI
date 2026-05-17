/**
 * interactionCreate.js — Router utama untuk semua interaksi Discord.
 *
 * Menangani:
 *   • Slash commands         — /antilink, /verification, dll
 *   • Button interactions    — Captcha text & math buttons
 *   • Modal submissions      — Input kode captcha text
 */

const {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

const captcha               = require('../utils/captcha');
const { getGuildConfig }    = require('../utils/database');
const {
  createErrorResponse,
  createSuccessResponse,
} = require('../utils/components');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {

    // ──────────────────────────────────────────────────────────────────────────
    // 1. SLASH COMMANDS
    // ──────────────────────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[Command Error] /${interaction.commandName}:`, err);
        const msg = createErrorResponse('Terjadi Kesalahan', `\`\`\`${err.message}\`\`\``);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ ...msg }).catch(() => {});
        } else {
          await interaction.reply({ ...msg }).catch(() => {});
        }
      }
      return;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. BUTTON — CAPTCHA TEXT (→ buka Modal input)
    // ──────────────────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('captcha_text_')) {
      const targetId = interaction.customId.slice('captcha_text_'.length);

      if (interaction.user.id !== targetId) {
        return interaction.reply({ content: '❌ Captcha ini bukan milikmu!', ephemeral: true });
      }

      const ses = captcha.getSession(interaction.guild.id, interaction.user.id);
      if (!ses) {
        return interaction.reply({ content: '❌ Sesi captcha tidak ditemukan. Mungkin sudah expired.', ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId(`captcha_modal_${interaction.user.id}`)
        .setTitle('🔐 Verifikasi Captcha');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('captcha_input')
            .setLabel(`Masukkan kode: ${ses.answer}`)  // hint tapi bisa dihapus
            .setStyle(TextInputStyle.Short)
            .setMinLength(6).setMaxLength(6)
            .setPlaceholder('Ketik 6 karakter captcha di atas...')
            .setRequired(true)
        )
      );

      // Sembunyikan hint jika ingin lebih sulit — label bisa diganti:
      // .setLabel('Masukkan kode captcha yang tertera:')

      return interaction.showModal(modal);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. BUTTON — CAPTCHA MATH (→ cek jawaban langsung)
    // ──────────────────────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('captcha_math_')) {
      // Format: captcha_math_{userId}_{choice}
      const parts  = interaction.customId.split('_');
      // parts[0]=captcha, parts[1]=math, parts[2]=userId, parts[3..]=choice
      const targetId = parts[2];
      const choice   = parts.slice(3).join('_');

      if (interaction.user.id !== targetId) {
        return interaction.reply({ content: '❌ Captcha ini bukan milikmu!', ephemeral: true });
      }

      return handleCaptchaAnswer(interaction, choice);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. MODAL SUBMIT — CAPTCHA TEXT (→ cek kode yang diketik)
    // ──────────────────────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('captcha_modal_')) {
      const targetId = interaction.customId.slice('captcha_modal_'.length);

      if (interaction.user.id !== targetId) {
        return interaction.reply({ content: '❌ Modal ini bukan milikmu!', ephemeral: true });
      }

      const input = interaction.fields.getTextInputValue('captcha_input').toUpperCase().trim();
      return handleCaptchaAnswer(interaction, input);
    }
  },
};

// ── Handler jawaban captcha ───────────────────────────────────────────────────

async function handleCaptchaAnswer(interaction, answer) {
  const { guild, user } = interaction;
  const ses = captcha.getSession(guild.id, user.id);

  if (!ses) {
    return interaction.reply({
      content: '❌ Sesi verifikasi tidak ditemukan. Mungkin sudah expired atau kamu sudah terverifikasi.',
      ephemeral: true,
    });
  }

  const isCorrect = answer.toUpperCase() === ses.answer.toUpperCase();
  const updated   = captcha.incrementAttempts(guild.id, user.id);

  const config = getGuildConfig(guild.id).verification;
  const channel = guild.channels.cache.get(ses.channelId);
  const { _sendVerifLog, _disableAllButtons } = require('./guildMemberAdd');

  // ── JAWABAN BENAR ─────────────────────────────────────────────────────────
  if (isCorrect) {
    captcha.deleteSession(guild.id, user.id);

    // Beri role verified
    let roleGiven = false;
    if (config.verifiedRole) {
      try {
        const member = await guild.members.fetch(user.id);
        await member.roles.add(config.verifiedRole);
        roleGiven = true;
      } catch {}
    }

    // Disable tombol captcha + edit embed
    try {
      if (channel && ses.messageId) {
        const captchaMsg = await channel.messages.fetch(ses.messageId);
        const disabledRow = new ActionRowBuilder().addComponents(
          ...captchaMsg.components[0].components.map(btn =>
            ButtonBuilder.from(btn).setDisabled(true).setStyle(ButtonStyle.Success)
          )
        );
        await captchaMsg.edit({
          components: [disabledRow],
          embeds: [
            EmbedBuilder.from(captchaMsg.embeds[0])
              .setColor(0x57F287)
              .setFooter({ text: '✅ Verifikasi berhasil!' }),
          ],
        });
      }
    } catch {}

    // Balas user (ephemeral)
    await interaction.reply({
      content: `✅ **Verifikasi berhasil!** Selamat datang di **${guild.name}**!${roleGiven ? ` Role <@&${config.verifiedRole}> telah diberikan.` : ''}`,
      ephemeral: true,
    }).catch(() => {});

    // Kirim log
    await _sendVerifLog(guild, config, {
      type: 'success',
      user,
      channel,
      session: { ...updated, attempts: updated.attempts },
      verifiedRole: config.verifiedRole,
    });

    console.log(`[Verification] ✅ ${user.tag} berhasil verifikasi di ${guild.name}`);
    return;
  }

  // ── JAWABAN SALAH ─────────────────────────────────────────────────────────
  const remaining = ses.maxAttempts - updated.attempts;

  if (updated.attempts >= updated.maxAttempts) {
    // Habis percobaan → kick
    captcha.deleteSession(guild.id, user.id);

    // Disable tombol
    try {
      if (channel && ses.messageId) {
        const captchaMsg = await channel.messages.fetch(ses.messageId);
        const disabledRow = new ActionRowBuilder().addComponents(
          ...captchaMsg.components[0].components.map(btn =>
            ButtonBuilder.from(btn).setDisabled(true).setStyle(ButtonStyle.Danger)
          )
        );
        await captchaMsg.edit({
          components: [disabledRow],
          embeds: [
            EmbedBuilder.from(captchaMsg.embeds[0])
              .setColor(0xED4245)
              .setFooter({ text: `❌ Verifikasi gagal — percobaan habis (${updated.attempts}/${updated.maxAttempts})` }),
          ],
        });
      }
    } catch {}

    await interaction.reply({
      content: `❌ **Verifikasi gagal!** Kamu telah melebihi batas percobaan (${updated.attempts}/${updated.maxAttempts}).${config.kickOnFail ? '\n🦵 Kamu akan dikick dari server.' : ''}`,
      ephemeral: true,
    }).catch(() => {});

    let kicked = false;
    if (config.kickOnFail) {
      try {
        const member = await guild.members.fetch(user.id);
        await member.kick('Gagal verifikasi: melebihi batas percobaan');
        kicked = true;
      } catch {}
    }

    await _sendVerifLog(guild, config, {
      type: 'fail',
      user, channel,
      session: { ...ses, attempts: updated.attempts },
      kicked,
    });

    console.log(`[Verification] ❌ ${user.tag} gagal verifikasi di ${guild.name}${kicked ? ' (dikick)' : ''}`);
    return;
  }

  // Masih ada percobaan
  await interaction.reply({
    content: `❌ **Jawaban salah!** Sisa percobaan: **${remaining}x**`,
    ephemeral: true,
  }).catch(() => {});
}
