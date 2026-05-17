/**
 * messageCreate.js — Anti-Link & Anti-Spam handler.
 *
 * PENTING — Logika bypass yang diubah:
 *   ❌ Lama : hanya mengecualikan user dengan izin ManageMessages/Administrator
 *   ✅ Baru : berlaku untuk SEMUA user yang role-nya di BAWAH role bot,
 *             termasuk yang punya Administrator — kecuali Guild Owner.
 *             Satu-satunya bypass manual adalah "exemptRoles" yang diset admin.
 */

const { getGuildConfig } = require('../utils/database');
const {
  createAntilinkLog,
  createAntilinkWarning,
  createAntispamLog,
  createAntispamWarning,
} = require('../utils/components');

// ── Regex Deteksi Link ────────────────────────────────────────────────────────
const LINK_REGEX = /(?:(?:https?|ftp):\/\/|www\.)[\w\-]+(\.[\w\-]+)+([\w\-._~:/?#\[\]@!$&'()*+,;=%]*)?|[\w\-]+(\.[\w\-]+)+\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]*/gi;

// ── In-Memory Spam Cache ──────────────────────────────────────────────────────
// key: `${guildId}:${userId}:${channelId}` → Array<{ time, id }>
const spamCache = new Map();

/**
 * Tambahkan pesan ke cache dan kembalikan entries dalam time window.
 */
function trackSpamMessage(message, timeWindow) {
  const key  = `${message.guild.id}:${message.author.id}:${message.channel.id}`;
  const now  = Date.now();

  if (!spamCache.has(key)) spamCache.set(key, []);

  const entries = spamCache.get(key);
  entries.push({ time: now, id: message.id });

  // Filter hanya dalam time window
  const fresh = entries.filter(e => now - e.time < timeWindow);
  spamCache.set(key, fresh);

  // Auto-cleanup setelah time window berakhir
  setTimeout(() => {
    const current = spamCache.get(key);
    if (current) {
      const stillFresh = current.filter(e => Date.now() - e.time < timeWindow);
      if (stillFresh.length === 0) spamCache.delete(key);
      else spamCache.set(key, stillFresh);
    }
  }, timeWindow + 500);

  return fresh;
}

/**
 * Hapus cache spam user di channel tertentu (setelah diproses).
 */
function clearSpamCache(guildId, userId, channelId) {
  spamCache.delete(`${guildId}:${userId}:${channelId}`);
}

// ── Cek Apakah User Bisa Di-Moderasi (Hierarchy) ─────────────────────────────
/**
 * Kembalikan true jika user TIDAK BISA dimoderasi bot:
 *   - Guild Owner, ATAU
 *   - Role user >= role bot (bot tidak punya otoritas)
 */
function isBeyondBotReach(message) {
  if (message.author.id === message.guild.ownerId) return true;

  const botRole  = message.guild.members.me?.roles.highest;
  const userRole = message.member.roles.highest;

  if (!botRole) return true; // Keamanan: bot tidak punya role

  // comparePositionTo: > 0 artinya userRole lebih tinggi
  return userRole.comparePositionTo(botRole) >= 0;
}

// ── Cek ExemptRoles ───────────────────────────────────────────────────────────
function isRoleExempt(member, exemptRoles) {
  const memberRoleIds = member.roles.cache.map(r => r.id);
  return exemptRoles.some(id => memberRoleIds.includes(id));
}

// ── Timeout Helper ────────────────────────────────────────────────────────────
async function applyTimeout(member, duration, reason) {
  try {
    if (member.isCommunicationDisabled()) return false; // sudah di-timeout
    await member.timeout(duration, reason.substring(0, 512));
    return true;
  } catch (err) {
    console.error('❌ Timeout gagal:', err.message);
    return false;
  }
}

// ── Kirim Log ke Channel ──────────────────────────────────────────────────────
async function sendLog(guild, logChannelId, payload) {
  if (!logChannelId) return;
  try {
    const ch = guild.channels.cache.get(logChannelId);
    if (ch) await ch.send(payload);
  } catch (err) {
    console.error('❌ Gagal kirim log:', err.message);
  }
}

// ── Event Handler ─────────────────────────────────────────────────────────────
module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild)     return;
    if (!message.member)    return;

    const config = getGuildConfig(message.guild.id);

    // ══════════════════════════════════════════════════════════════════════
    // BLOK 1: ANTI-LINK
    // ══════════════════════════════════════════════════════════════════════
    const al = config.antilink;

    if (al.enabled) {
      // Cek apakah channel dipantau
      const alMonitored = al.mode === 'all'
        ? true
        : al.channels.includes(message.channel.id);

      if (alMonitored) {
        // Bypass hanya jika di luar jangkauan bot (hierarchy) ATAU exempt role
        const alBypass = isBeyondBotReach(message) || isRoleExempt(message.member, al.exemptRoles);

        if (!alBypass) {
          LINK_REGEX.lastIndex = 0;
          const matches = message.content.match(LINK_REGEX);

          if (matches?.length) {
            const detectedLink = matches[0];
            console.log(`🔗 [Anti-Link] ${message.author.tag} | #${message.channel.name} | ${detectedLink}`);

            // 1. Hapus pesan
            await message.delete().catch(() => {});

            // 2. Timeout user
            const timedOut = await applyTimeout(
              message.member,
              al.timeoutDuration,
              `[Anti-Link] Link: ${detectedLink.substring(0, 100)}`
            );

            // 3. Peringatan singkat di channel (auto-hapus 6 detik)
            const warn = await message.channel.send({
              content: `> ⚠️ <@${message.author.id}> Pesanmu dihapus karena mengandung **link**!${timedOut ? ' Kamu di-timeout.' : ''}`,
            }).catch(() => null);
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 6_000);

            // 4. DM ke user
            message.author.send(
              createAntilinkWarning({
                channelName:     message.channel.name,
                timeoutDuration: al.timeoutDuration,
              })
            ).catch(() => {});

            // 5. Log
            await sendLog(
              message.guild,
              al.logChannel,
              createAntilinkLog({
                user:            message.author,
                channel:         message.channel,
                link:            detectedLink,
                timeoutDuration: al.timeoutDuration,
              })
            );

            return; // Sudah diproses, stop di sini
          }
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // BLOK 2: ANTI-SPAM
    // ══════════════════════════════════════════════════════════════════════
    const as = config.antispam;

    if (as.enabled) {
      const asMonitored = as.mode === 'all'
        ? true
        : as.channels.includes(message.channel.id);

      if (asMonitored) {
        const asBypass = isBeyondBotReach(message) || isRoleExempt(message.member, as.exemptRoles);

        if (!asBypass) {
          const entries = trackSpamMessage(message, as.timeWindow);

          if (entries.length >= as.maxMessages) {
            const spamMessageIds = entries.map(e => e.id);
            console.log(`💬 [Anti-Spam] ${message.author.tag} | #${message.channel.name} | ${entries.length} pesan`);

            // Hapus cache langsung agar tidak double-trigger
            clearSpamCache(message.guild.id, message.author.id, message.channel.id);

            // 1. Bulk delete pesan spam (maks 14 hari — selalu aman untuk spam)
            let deletedCount = 0;
            if (as.deleteMessages) {
              try {
                const deleted = await message.channel.bulkDelete(spamMessageIds, true);
                deletedCount = deleted.size;
              } catch {
                // Fallback: hapus satu per satu
                for (const id of spamMessageIds) {
                  await message.channel.messages.delete(id).catch(() => {});
                  deletedCount++;
                }
              }
            }

            // 2. Timeout user
            const timedOut = await applyTimeout(
              message.member,
              as.timeoutDuration,
              `[Anti-Spam] ${entries.length} pesan dalam ${as.timeWindow / 1000}s`
            );

            // 3. Peringatan di channel (auto-hapus 6 detik)
            const warn = await message.channel.send({
              content: `> 🚫 <@${message.author.id}> Kamu terdeteksi **spam** (${entries.length} pesan/${as.timeWindow / 1000}s)!${timedOut ? ' Kamu di-timeout.' : ''}`,
            }).catch(() => null);
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 6_000);

            // 4. DM ke user
            message.author.send(
              createAntispamWarning({
                channelName:     message.channel.name,
                messageCount:    entries.length,
                timeWindow:      as.timeWindow,
                timeoutDuration: as.timeoutDuration,
              })
            ).catch(() => {});

            // 5. Log
            await sendLog(
              message.guild,
              as.logChannel,
              createAntispamLog({
                user:            message.author,
                channel:         message.channel,
                messageCount:    entries.length,
                timeWindow:      as.timeWindow,
                timeoutDuration: as.timeoutDuration,
                deletedCount,
              })
            );
          }
        }
      }
    }
  },
};
