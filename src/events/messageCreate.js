/**
 * messageCreate.js — Anti-Link & Anti-Spam handler.
 *
 * PENTING — Logika bypass yang diubah:
 *   ❌ Lama : hanya mengecualikan user dengan izin ManageMessages/Administrator
 *   ✅ Baru : berlaku untuk SEMUA user yang role-nya di BAWAH role bot,
 *             termasuk yang punya Administrator — kecuali Guild Owner.
 *             Satu-satunya bypass manual adalah "exemptRoles" yang diset admin.
 *
 * CHANGELOG:
 *   - FIX: Regex anti-link diganti agar tidak false positive (10.000/GB, dll)
 *   - FIX: Semua link yang terdeteksi ditampilkan full (bukan hanya matches[0])
 *   - FIX: Link panjang dikirim sebagai pesan terpisah agar tidak terpotong
 */

const { getGuildConfig } = require('../utils/database');
const {
  createAntilinkLog,
  createAntilinkWarning,
  createAntispamLog,
  createAntispamWarning,
} = require('../utils/components');

// ── Regex Deteksi Link ────────────────────────────────────────────────────────
//
// FIX: Regex lama mendeteksi pola "angka.angka/teks" (contoh: 10.000/GB)
//      sebagai link. Regex baru memastikan link BENAR-BENAR bisa dibuka browser.
//
// ATURAN REGEX BARU:
//   1. URL dengan protokol eksplisit  → https://..., http://..., ftp://...
//   2. URL dengan www.                → www.example.com
//   3. Domain + TLD valid TANPA angka → dagel.id, tokopedia.com
//      (bagian sebelum titik pertama WAJIB diawali huruf, bukan angka)
//      Ini yang mencegah "10.000/GB" lolos.
//
// Yang TIDAK akan terdeteksi (false positive dicegah):
//   ✗ 10.000/GB     → diawali angka, bukan domain
//   ✗ 16/9          → tidak ada TLD
//   ✗ path/to/file  → tidak ada titik domain
//   ✗ v1.2.3        → tidak ada TLD valid di akhir
//
const LINK_REGEX = new RegExp(
  // Cabang 1: http/https/ftp dengan protokol eksplisit
  '(?:https?|ftp):\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+([\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]*)?' +
  '|' +
  // Cabang 2: www. tanpa protokol
  'www\\.[a-zA-Z][\\w\\-]*(\\.[\\w\\-]+)+(\\/[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]*)?' +
  '|' +
  // Cabang 3: domain langsung, WAJIB diawali huruf (bukan angka), + TLD valid
  // Negative lookbehind (?<![0-9.]) mencegah "10.000" lolos
  '(?<![0-9.])[a-zA-Z][\\w\\-]{1,61}\\.' +
  '(?:com|net|org|id|gg|io|app|dev|xyz|info|co\\.id|co|me|live|online|store|site|web|' +
  'cloud|tech|tv|us|uk|au|sg|my|biz|edu|gov|mil|int|vercel\\.app|netlify\\.app|github\\.io)' +
  '(?:\\/[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]*)?',
  'gi'
);

// ── Validasi Tambahan Setelah Regex ───────────────────────────────────────────
/**
 * Filter hasil regex untuk memastikan hanya link yang benar-benar valid.
 * Ini adalah lapisan kedua keamanan setelah regex.
 */
function isValidLink(candidate) {
  if (!candidate.includes('.')) return false;

  if (!/^(?:https?|ftp|www)/i.test(candidate)) {
    const beforeFirstDot = candidate.split('.')[0];
    if (/^\d+$/.test(beforeFirstDot)) return false;
    if (beforeFirstDot.length < 2) return false;
  }

  return true;
}

/**
 * Ekstrak semua link valid dari konten pesan.
 * Mengembalikan array string link yang sudah dibersihkan.
 */
function extractLinks(content) {
  // Bersihkan zero-width characters (trik bypass umum di Discord)
  const cleaned = content.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060]/g, '');

  LINK_REGEX.lastIndex = 0;
  const matches = cleaned.match(LINK_REGEX);
  if (!matches) return [];

  return [...new Set(matches.filter(isValidLink))];
}

// ── In-Memory Spam Cache ──────────────────────────────────────────────────────
const spamCache = new Map();

function trackSpamMessage(message, timeWindow) {
  const key = `${message.guild.id}:${message.author.id}:${message.channel.id}`;
  const now = Date.now();

  if (!spamCache.has(key)) spamCache.set(key, []);

  const entries = spamCache.get(key);
  entries.push({ time: now, id: message.id });

  const fresh = entries.filter(e => now - e.time < timeWindow);
  spamCache.set(key, fresh);

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

function clearSpamCache(guildId, userId, channelId) {
  spamCache.delete(`${guildId}:${userId}:${channelId}`);
}

// ── Cek Apakah User Bisa Di-Moderasi (Hierarchy) ─────────────────────────────
function isBeyondBotReach(message) {
  if (message.author.id === message.guild.ownerId) return true;

  const botRole  = message.guild.members.me?.roles.highest;
  const userRole = message.member.roles.highest;

  if (!botRole) return true;

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
    if (member.isCommunicationDisabled()) return false;
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

/**
 * FIX: Kirim full link sebagai pesan terpisah setelah embed.
 * Discord embed field dibatasi 1024 karakter — link panjang akan terpotong
 * jika dimasukkan ke field. Solusi: kirim sebagai pesan teks biasa terpisah.
 */
async function sendFullLinkLog(guild, logChannelId, links) {
  if (!logChannelId || !links.length) return;
  try {
    const ch = guild.channels.cache.get(logChannelId);
    if (!ch) return;

    const linkLines = links.map(l => `\`${l}\``).join('\n');
    await ch.send({
      content: `🔗 **Full Link Terdeteksi:**\n${linkLines}`,
    });
  } catch (err) {
    console.error('❌ Gagal kirim full link log:', err.message);
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
      const alMonitored = al.mode === 'all'
        ? true
        : al.channels.includes(message.channel.id);

      if (alMonitored) {
        const alBypass = isBeyondBotReach(message) || isRoleExempt(message.member, al.exemptRoles);

        if (!alBypass) {
          // FIX: Gunakan extractLinks() yang akurat — tidak false positive
          const detectedLinks = extractLinks(message.content);

          if (detectedLinks.length > 0) {
            const primaryLink = detectedLinks[0];
            console.log(`🔗 [Anti-Link] ${message.author.tag} | #${message.channel.name} | ${detectedLinks.join(', ')}`);

            // 1. Hapus pesan
            await message.delete().catch(() => {});

            // 2. Timeout user
            const timedOut = await applyTimeout(
              message.member,
              al.timeoutDuration,
              `[Anti-Link] Link: ${primaryLink.substring(0, 100)}`
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

            // 5. Log embed
            await sendLog(
              message.guild,
              al.logChannel,
              createAntilinkLog({
                user:            message.author,
                channel:         message.channel,
                link:            primaryLink,
                timeoutDuration: al.timeoutDuration,
              })
            );

            // 6. FIX: Kirim semua link full di pesan terpisah agar tidak terpotong
            await sendFullLinkLog(message.guild, al.logChannel, detectedLinks);

            return;
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

            clearSpamCache(message.guild.id, message.author.id, message.channel.id);

            let deletedCount = 0;
            if (as.deleteMessages) {
              try {
                const deleted = await message.channel.bulkDelete(spamMessageIds, true);
                deletedCount = deleted.size;
              } catch {
                for (const id of spamMessageIds) {
                  await message.channel.messages.delete(id).catch(() => {});
                  deletedCount++;
                }
              }
            }

            const timedOut = await applyTimeout(
              message.member,
              as.timeoutDuration,
              `[Anti-Spam] ${entries.length} pesan dalam ${as.timeWindow / 1000}s`
            );

            const warn = await message.channel.send({
              content: `> 🚫 <@${message.author.id}> Kamu terdeteksi **spam** (${entries.length} pesan/${as.timeWindow / 1000}s)!${timedOut ? ' Kamu di-timeout.' : ''}`,
            }).catch(() => null);
            if (warn) setTimeout(() => warn.delete().catch(() => {}), 6_000);

            message.author.send(
              createAntispamWarning({
                channelName:     message.channel.name,
                messageCount:    entries.length,
                timeWindow:      as.timeWindow,
                timeoutDuration: as.timeoutDuration,
              })
            ).catch(() => {});

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
