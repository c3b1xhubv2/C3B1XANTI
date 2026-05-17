/**
 * components.js — Builder untuk semua pesan Components V2
 * Discord.js v14.19.3+ diperlukan.
 */

const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hours    = Math.floor(totalSec / 3600);
  const minutes  = Math.floor((totalSec % 3600) / 60);
  const secs     = totalSec % 60;
  if (hours > 0)   return `${hours} jam ${minutes} menit`;
  if (minutes > 0) return `${minutes} menit`;
  return `${secs} detik`;
}

function getTimestamp() {
  return new Date().toLocaleString('id-ID', {
    timeZone:  'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

/**
 * Format teks aksi moderasi:
 *   action: 'timeout' | 'kick' | 'none'
 */
function formatAction(action, timeoutDuration) {
  if (action === 'kick')    return '🦵 **Dikick** *(Admin tidak bisa di-timeout oleh Discord)*';
  if (action === 'timeout') return `⏱️ Timeout **${formatDuration(timeoutDuration)}**`;
  return '⚠️ Gagal (tidak ada izin)';
}

// ── Builder Helpers ───────────────────────────────────────────────────────────
function buildContainer(color) {
  return new ContainerBuilder().setAccentColor(color);
}
function addHeader(c, text)   { return c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text)); }
function addSep(c)            { return c.addSeparatorComponents(new SeparatorBuilder().setDivider(true)); }
function addBody(c, content)  { return c.addTextDisplayComponents(new TextDisplayBuilder().setContent(content)); }

// ── General ───────────────────────────────────────────────────────────────────
function createSuccessResponse(title, description) {
  const c = buildContainer(0x57F287);
  addHeader(c, `## ✅ ${title}`); addSep(c); addBody(c, description);
  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

function createErrorResponse(title, description) {
  const c = buildContainer(0xED4245);
  addHeader(c, `## ❌ ${title}`); addSep(c); addBody(c, description);
  return { flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [c] };
}

function createInfoPanel(title, fields) {
  const content = fields.map(([l, v]) => `**${l} :** ${v}`).join('\n');
  const c = buildContainer(0x5865F2);
  addHeader(c, `## ℹ️ ${title}`); addSep(c); addBody(c, content);
  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

// ── Anti-Link ─────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {User}   opts.user
 * @param {TextChannel} opts.channel
 * @param {string} opts.link
 * @param {number} opts.timeoutDuration
 * @param {'timeout'|'kick'|'none'} opts.action  — hasil moderasi
 */
function createAntilinkLog({ user, channel, link, timeoutDuration, action = 'timeout' }) {
  const avatarURL = user.displayAvatarURL({ size: 64, extension: 'png' });
  const shortLink = link.length > 80 ? `${link.substring(0, 80)}...` : link;
  // Warna header: merah normal atau ungu jika dikick (admin)
  const color = action === 'kick' ? 0x9B59B6 : 0xED4245;

  const c = buildContainer(color);
  c.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 🔗 Anti-Link — Pelanggaran Terdeteksi')
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarURL))
  );

  addSep(c);
  addBody(c, [
    `**👤 User        :** ${user.tag} (<@${user.id}>)`,
    `**🆔 User ID     :** \`${user.id}\``,
    `**📌 Channel     :** <#${channel.id}> (\`#${channel.name}\`)`,
    `**🔗 Link        :** \`${shortLink}\``,
    `**🛡️ Aksi        :** ${formatAction(action, timeoutDuration)}`,
    `**🕐 Waktu       :** ${getTimestamp()}`,
    action === 'kick'
      ? '\n-# ⚠️ User memiliki izin **Administrator** — Discord melarang timeout untuk admin, sehingga user **dikick**.'
      : '',
  ].filter(Boolean).join('\n'));

  addSep(c);
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('👤 Lihat Profil User')
        .setURL(`https://discord.com/users/${user.id}`)
    )
  );

  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

function createAntilinkWarning({ channelName, timeoutDuration, action = 'timeout' }) {
  const actionMsg = action === 'kick'
    ? 'Kamu telah **dikick dari server** karena memiliki izin Administrator sehingga tidak bisa di-timeout.'
    : `Kamu mendapat **timeout selama ${formatDuration(timeoutDuration)}** karena melanggar aturan server.`;

  const c = buildContainer(0xFEE75C);
  addHeader(c, '## ⚠️ Peringatan — Link Terdeteksi!');
  addSep(c);
  addBody(c, [
    `Pesanmu di **#${channelName}** mengandung **link** dan telah dihapus.`,
    actionMsg,
    '',
    '-# Jika ini adalah kesalahan, silakan hubungi moderator server.',
  ].join('\n'));
  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

function createStatusResponse({ guildName, antilink }) {
  const statusText  = antilink.enabled ? '🟢 **Aktif**' : '🔴 **Nonaktif**';
  const modeText    = antilink.mode === 'all' ? '🌐 Semua Channel' : '📌 Channel Tertentu';
  const logChannel  = antilink.logChannel ? `<#${antilink.logChannel}>` : '*Belum diatur*';
  const channels    = antilink.channels.length ? antilink.channels.map(id => `<#${id}>`).join(', ') : '*Belum ada*';
  const exemptRoles = antilink.exemptRoles.length ? antilink.exemptRoles.map(id => `<@&${id}>`).join(', ') : '*Tidak ada*';
  const lines = [
    `**Status          :** ${statusText}`,
    `**Mode            :** ${modeText}`,
    `**Timeout         :** ${formatDuration(antilink.timeoutDuration)}`,
    `**Log Channel     :** ${logChannel}`,
    `**Role Exempt     :** ${exemptRoles}`,
  ];
  if (antilink.mode === 'specific') lines.splice(2, 0, `**Channel Aktif   :** ${channels}`);
  const c = buildContainer(antilink.enabled ? 0x57F287 : 0xED4245);
  addHeader(c, `## 🔗 Status Anti-Link\n-# ${guildName}`); addSep(c); addBody(c, lines.join('\n'));
  return { flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [c] };
}

// ── Anti-Spam ─────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {'timeout'|'kick'|'none'} opts.action
 */
function createAntispamLog({ user, channel, messageCount, timeWindow, timeoutDuration, deletedCount, action = 'timeout' }) {
  const avatarURL = user.displayAvatarURL({ size: 64, extension: 'png' });
  const color = action === 'kick' ? 0x9B59B6 : 0xFF7B00;

  const c = buildContainer(color);
  c.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('## 💬 Anti-Spam — Spam Terdeteksi')
      )
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarURL))
  );

  addSep(c);
  addBody(c, [
    `**👤 User          :** ${user.tag} (<@${user.id}>)`,
    `**🆔 User ID       :** \`${user.id}\``,
    `**📌 Channel       :** <#${channel.id}> (\`#${channel.name}\`)`,
    `**💬 Pesan Spam    :** ${messageCount} pesan dalam ${timeWindow / 1000}s`,
    `**🗑️ Pesan Dihapus :** ${deletedCount} pesan`,
    `**🛡️ Aksi          :** ${formatAction(action, timeoutDuration)}`,
    `**🕐 Waktu         :** ${getTimestamp()}`,
    action === 'kick'
      ? '\n-# ⚠️ User memiliki izin **Administrator** — Discord melarang timeout untuk admin, sehingga user **dikick**.'
      : '',
  ].filter(Boolean).join('\n'));

  addSep(c);
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel('👤 Lihat Profil User')
        .setURL(`https://discord.com/users/${user.id}`)
    )
  );

  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

function createAntispamWarning({ channelName, messageCount, timeWindow, timeoutDuration, action = 'timeout' }) {
  const actionMsg = action === 'kick'
    ? 'Kamu telah **dikick dari server** karena memiliki izin Administrator sehingga tidak bisa di-timeout.'
    : `Kamu mendapat **timeout selama ${formatDuration(timeoutDuration)}**.`;

  const c = buildContainer(0xFF7B00);
  addHeader(c, '## 🚫 Peringatan — Spam Terdeteksi!');
  addSep(c);
  addBody(c, [
    `Kamu terdeteksi mengirim **${messageCount} pesan dalam ${timeWindow / 1000} detik** di **#${channelName}**.`,
    `Pesan-pesan tersebut telah dihapus. ${actionMsg}`,
    '',
    '-# Jika ini adalah kesalahan, silakan hubungi moderator server.',
  ].join('\n'));
  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

function createAntispamStatusResponse({ guildName, antispam }) {
  const statusText  = antispam.enabled ? '🟢 **Aktif**' : '🔴 **Nonaktif**';
  const modeText    = antispam.mode === 'all' ? '🌐 Semua Channel' : '📌 Channel Tertentu';
  const logChannel  = antispam.logChannel ? `<#${antispam.logChannel}>` : '*Belum diatur*';
  const channels    = antispam.channels.length ? antispam.channels.map(id => `<#${id}>`).join(', ') : '*Belum ada*';
  const exemptRoles = antispam.exemptRoles.length ? antispam.exemptRoles.map(id => `<@&${id}>`).join(', ') : '*Tidak ada*';
  const lines = [
    `**Status           :** ${statusText}`,
    `**Mode             :** ${modeText}`,
    `**Batas Pesan      :** ${antispam.maxMessages} pesan / ${antispam.timeWindow / 1000}s`,
    `**Timeout          :** ${formatDuration(antispam.timeoutDuration)}`,
    `**Hapus Pesan      :** ${antispam.deleteMessages ? 'Ya' : 'Tidak'}`,
    `**Log Channel      :** ${logChannel}`,
    `**Role Exempt      :** ${exemptRoles}`,
  ];
  if (antispam.mode === 'specific') lines.splice(2, 0, `**Channel Aktif    :** ${channels}`);
  const c = buildContainer(antispam.enabled ? 0xFF7B00 : 0xED4245);
  addHeader(c, `## 💬 Status Anti-Spam\n-# ${guildName}`); addSep(c); addBody(c, lines.join('\n'));
  return { flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [c] };
}

module.exports = {
  createSuccessResponse,
  createErrorResponse,
  createInfoPanel,
  formatDuration,
  createAntilinkLog,
  createAntilinkWarning,
  createStatusResponse,
  createAntispamLog,
  createAntispamWarning,
  createAntispamStatusResponse,
};

// ══════════════════════════════════════════════════════════════════════════════
// VERIFICATION — Log Components (Components V2)
// Captcha message menggunakan EmbedBuilder biasa (agar bisa ping user).
// Log-log di bawah ini menggunakan Components V2 sepenuhnya.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Log verifikasi BERHASIL — dikirim ke log channel.
 */
function createVerificationSuccessLog({ user, guild, channel, session, verifiedRole }) {
  const elapsed = session ? `${Math.floor((Date.now() - session.joinedAt) / 1000)} detik` : 'N/A';
  const attempts = session ? `${session.attempts}/${session.maxAttempts}` : 'N/A';
  const type     = session?.captchaType === 'math' ? 'Matematika 🔢' : 'Text 📝';
  const roleText = verifiedRole ? `<@&${verifiedRole}>` : '*(tidak ada)*';

  const c = buildContainer(0x57F287); // Hijau
  c.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('## ✅ Verifikasi Berhasil'))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 64, extension: 'png' })))
  );
  addSep(c);
  addBody(c, [
    `**👤 User           :** ${user.tag} (<@${user.id}>)`,
    `**🆔 User ID        :** \`${user.id}\``,
    `**🖥️ Server         :** ${guild.name}`,
    `**📌 Channel Verif. :** ${channel ? `<#${channel.id}>` : '*(DM)*'}`,
    `**🎯 Tipe Captcha   :** ${type}`,
    `**🔢 Percobaan      :** ${attempts}`,
    `**⏱️ Durasi Verif.  :** ${elapsed}`,
    `**🎖️ Role Diberikan :** ${roleText}`,
    `**🕐 Waktu          :** ${getTimestamp()}`,
  ].join('\n'));
  addSep(c);
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('👤 Lihat Profil').setURL(`https://discord.com/users/${user.id}`)
    )
  );
  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

/**
 * Log verifikasi GAGAL (habis percobaan) — dikirim ke log channel.
 */
function createVerificationFailLog({ user, guild, channel, session, kicked }) {
  const attempts = session ? `${session.attempts}/${session.maxAttempts}` : 'N/A';
  const type     = session?.captchaType === 'math' ? 'Matematika 🔢' : 'Text 📝';
  const actionText = kicked ? '🦵 **Dikick dari server**' : '⚠️ Tidak ada aksi (kickOnFail: false)';

  const c = buildContainer(0xED4245); // Merah
  c.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('## ❌ Verifikasi Gagal'))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 64, extension: 'png' })))
  );
  addSep(c);
  addBody(c, [
    `**👤 User           :** ${user.tag} (<@${user.id}>)`,
    `**🆔 User ID        :** \`${user.id}\``,
    `**🖥️ Server         :** ${guild.name}`,
    `**📌 Channel Verif. :** ${channel ? `<#${channel.id}>` : '*(DM)*'}`,
    `**🎯 Tipe Captcha   :** ${type}`,
    `**🔢 Percobaan      :** ${attempts} *(habis)*`,
    `**📋 Alasan         :** Melebihi batas percobaan`,
    `**🛡️ Aksi           :** ${actionText}`,
    `**🕐 Waktu          :** ${getTimestamp()}`,
  ].join('\n'));
  addSep(c);
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('👤 Lihat Profil').setURL(`https://discord.com/users/${user.id}`)
    )
  );
  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

/**
 * Log verifikasi TIMEOUT — dikirim ke log channel.
 */
function createVerificationTimeoutLog({ user, guild, channel, session, kicked }) {
  const attempts   = session ? `${session.attempts}/${session.maxAttempts}` : 'N/A';
  const type       = session?.captchaType === 'math' ? 'Matematika 🔢' : 'Text 📝';
  const timeoutMin = session ? Math.floor(session.timeout / 60000) : '?';
  const actionText = kicked ? '🦵 **Dikick dari server**' : '⚠️ Tidak ada aksi (kickOnFail: false)';

  const c = buildContainer(0xFEE75C); // Kuning
  c.addSectionComponents(
    new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent('## ⏱️ Verifikasi Timeout'))
      .setThumbnailAccessory(new ThumbnailBuilder().setURL(user.displayAvatarURL({ size: 64, extension: 'png' })))
  );
  addSep(c);
  addBody(c, [
    `**👤 User           :** ${user.tag} (<@${user.id}>)`,
    `**🆔 User ID        :** \`${user.id}\``,
    `**🖥️ Server         :** ${guild.name}`,
    `**📌 Channel Verif. :** ${channel ? `<#${channel.id}>` : '*(DM)*'}`,
    `**🎯 Tipe Captcha   :** ${type}`,
    `**🔢 Percobaan      :** ${attempts} *(tidak menyelesaikan)*`,
    `**📋 Alasan         :** Waktu verifikasi habis (${timeoutMin} menit)`,
    `**🛡️ Aksi           :** ${actionText}`,
    `**🕐 Waktu          :** ${getTimestamp()}`,
  ].join('\n'));
  addSep(c);
  c.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('👤 Lihat Profil').setURL(`https://discord.com/users/${user.id}`)
    )
  );
  return { flags: [MessageFlags.IsComponentsV2], components: [c] };
}

/**
 * Panel status konfigurasi verification.
 */
function createVerificationStatusResponse({ guildName, verification }) {
  const s = verification;
  const statusText  = s.enabled ? '🟢 **Aktif**' : '🔴 **Nonaktif**';
  const captchaText = s.captchaType === 'math' ? 'Matematika 🔢' : 'Text 📝';
  const lines = [
    `**Status           :** ${statusText}`,
    `**Channel Verif.   :** ${s.channel ? `<#${s.channel}>` : '*Belum diatur*'}`,
    `**Log Channel      :** ${s.logChannel ? `<#${s.logChannel}>` : '*Belum diatur*'}`,
    `**Role Verified    :** ${s.verifiedRole ? `<@&${s.verifiedRole}>` : '*Belum diatur*'}`,
    `**Tipe Captcha     :** ${captchaText}`,
    `**Timeout          :** ${Math.floor(s.timeout / 60000)} menit`,
    `**Maks Percobaan   :** ${s.maxAttempts}x`,
    `**Kick jika Gagal  :** ${s.kickOnFail ? 'Ya' : 'Tidak'}`,
  ];
  const c = buildContainer(s.enabled ? 0x57F287 : 0xED4245);
  addHeader(c, `## 🔐 Status Verifikasi\n-# ${guildName}`);
  addSep(c);
  addBody(c, lines.join('\n'));
  return { flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral], components: [c] };
}

// Export tambahan
module.exports.createVerificationSuccessLog  = createVerificationSuccessLog;
module.exports.createVerificationFailLog     = createVerificationFailLog;
module.exports.createVerificationTimeoutLog  = createVerificationTimeoutLog;
module.exports.createVerificationStatusResponse = createVerificationStatusResponse;
