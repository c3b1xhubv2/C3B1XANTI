/**
 * guildMemberAdd.js — Dipanggil saat member baru bergabung.
 *
 * Jika verifikasi aktif:
 *   1. Buat sesi captcha untuk user
 *   2. Kirim pesan captcha ke channel verifikasi (dengan ping)
 *   3. Set timer timeout → auto-kick jika tidak verifikasi
 *
 * ⚠️ Butuh intent: GuildMembers (Server Members Intent di Developer Portal)
 */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getGuildConfig }    = require('../utils/database');
const captcha               = require('../utils/captcha');
const { createVerificationTimeoutLog } = require('../utils/components');

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member) {
    const { guild, user } = member;
    const config  = getGuildConfig(guild.id).verification;

    if (!config.enabled || !config.channel) return;

    const channel = guild.channels.cache.get(config.channel);
    if (!channel) return;

    // ── Buat sesi captcha ─────────────────────────────────────────────────────
    const session = captcha.createSession(guild.id, user.id, config.captchaType, config);
    const timeoutMin = Math.floor(config.timeout / 60000);

    // ── Bangun embed + tombol captcha ─────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🔐 Verifikasi Diperlukan')
      .setThumbnail(user.displayAvatarURL({ size: 128, extension: 'png' }))
      .setDescription([
        `Selamat datang di **${guild.name}**! 👋`,
        'Selesaikan captcha di bawah untuk mendapatkan akses penuh ke server.',
      ].join('\n'))
      .setFooter({ text: `⏱️ Timeout: ${timeoutMin} menit  •  🔄 Maks: ${config.maxAttempts}x percobaan` })
      .setTimestamp();

    let row;
    if (config.captchaType === 'text') {
      embed.addFields({
        name: '📝 Kode Captcha',
        value: `\`\`\`${session.displayCode}\`\`\``,
        inline: false,
      });
      row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`captcha_text_${user.id}`)
          .setLabel('✏️ Masukkan Kode')
          .setStyle(ButtonStyle.Primary)
      );
    } else {
      embed.addFields({
        name: '🔢 Jawab Pertanyaan Berikut',
        value: `**${session.question}**`,
        inline: false,
      });
      const mathButtons = session.choices.map(c =>
        new ButtonBuilder()
          .setCustomId(`captcha_math_${user.id}_${c}`)
          .setLabel(c)
          .setStyle(ButtonStyle.Secondary)
      );
      row = new ActionRowBuilder().addComponents(...mathButtons);
    }

    // ── Kirim pesan ke channel verifikasi ─────────────────────────────────────
    let captchaMsg;
    try {
      captchaMsg = await channel.send({
        content: `<@${user.id}>`,
        embeds:  [embed],
        components: [row],
      });
    } catch (err) {
      console.error(`[Verification] Gagal kirim captcha ke ${channel.name}: ${err.message}`);
      captcha.deleteSession(guild.id, user.id);
      return;
    }

    captcha.updateSession(guild.id, user.id, {
      messageId: captchaMsg.id,
      channelId: channel.id,
    });

    // ── Set timeout ───────────────────────────────────────────────────────────
    const handle = setTimeout(async () => {
      const ses = captcha.getSession(guild.id, user.id);
      if (!ses) return; // Sudah selesai verifikasi

      captcha.deleteSession(guild.id, user.id);

      // Disable tombol di pesan captcha
      try {
        const disabledRow = disableAllButtons(row);
        await captchaMsg.edit({
          content: `~~<@${user.id}>~~`,
          embeds:  [embed.setColor(0x95a5a6).setFooter({ text: '⏱️ Verifikasi timeout — tidak menyelesaikan captcha' })],
          components: [disabledRow],
        });
      } catch {}

      // Kick jika dikonfigurasi
      let kicked = false;
      if (config.kickOnFail) {
        try {
          await member.kick('Gagal verifikasi: timeout');
          kicked = true;
        } catch {}
      }

      // Kirim log timeout
      await sendVerifLog(guild, config, {
        type: 'timeout', user, channel, session: ses, kicked,
      });

    }, config.timeout);

    captcha.setTimeoutHandle(guild.id, user.id, handle);
    console.log(`[Verification] Captcha dikirim ke ${user.tag} di ${guild.name}`);
  },
};

/** Disable semua button di row */
function disableAllButtons(row) {
  return new ActionRowBuilder().addComponents(
    ...row.components.map(btn => ButtonBuilder.from(btn).setDisabled(true))
  );
}

/** Kirim log ke log channel */
async function sendVerifLog(guild, config, { type, user, channel, session, kicked }) {
  if (!config.logChannel) return;
  const logCh = guild.channels.cache.get(config.logChannel);
  if (!logCh) return;

  const { createVerificationSuccessLog, createVerificationFailLog, createVerificationTimeoutLog } = require('../utils/components');

  try {
    const args = { user, guild, channel, session, kicked };
    if (type === 'success')   await logCh.send(createVerificationSuccessLog(args));
    else if (type === 'fail') await logCh.send(createVerificationFailLog(args));
    else                      await logCh.send(createVerificationTimeoutLog(args));
  } catch (err) {
    console.error(`[Verification] Gagal kirim log: ${err.message}`);
  }
}

module.exports._sendVerifLog = sendVerifLog;
module.exports._disableAllButtons = disableAllButtons;
