/**
 * ready.js — Dijalankan saat bot berhasil login.
 *
 * Sistem Auto-Deploy yang CERDAS:
 *
 *   Bot membandingkan hash command saat ini dengan hash yang tersimpan.
 *
 *   KASUS 1 — Commands berubah (ada tambahan/modifikasi):
 *     → Deploy ke SEMUA server sekaligus (termasuk server lama)
 *     → Update hash tersimpan
 *
 *   KASUS 2 — Bot masuk server baru saat offline:
 *     → Deploy hanya ke server-server yang belum pernah menerima commands
 *
 *   KASUS 3 — Tidak ada perubahan & semua server sudah up-to-date:
 *     → Lewati deployment (startup cepat)
 *
 *   KASUS 4 — Bot baru pertama kali nyala:
 *     → Deploy ke semua server yang sedang aktif
 */

const { ActivityType }     = require('discord.js');
const { collectAllCommands, deployToGuild } = require('../utils/deployCommands');
const {
  computeHash,
  getStoredHash,
  getDeployedGuilds,
  saveDeployment,
} = require('../utils/commandHash');

module.exports = {
  name: 'clientReady',
  once: true,

  async execute(client) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  ✅ Bot online  : ${client.user.tag}`);
    console.log(`  📊 Server      : ${client.guilds.cache.size}`);
    console.log(`  🆔 Client ID   : ${client.user.id}`);
    console.log(`${'═'.repeat(50)}\n`);

    client.user.setActivity('🔗 Memantau Link & Spam', { type: ActivityType.Watching });

    // ── Analisis kebutuhan deployment ─────────────────────────────────────────
    const allGuildIds     = [...client.guilds.cache.keys()];
    const commands        = collectAllCommands();
    const currentHash     = computeHash(commands);
    const storedHash      = getStoredHash();
    const deployedGuilds  = getDeployedGuilds();
    const commandsChanged = currentHash !== storedHash;

    // Guild yang bergabung saat bot offline (belum pernah dapat commands)
    const offlineNewGuilds = allGuildIds.filter(id => !deployedGuilds.includes(id));

    console.log(`📦 Commands     : ${commands.length} (${commands.map(c => `/${c.name}`).join(', ')})`);
    console.log(`🔖 Hash saat ini: ${currentHash}`);
    console.log(`🔖 Hash lama    : ${storedHash ?? '(belum ada)'}`);
    console.log(`📋 Perubahan    : ${commandsChanged ? '⚠️  YA — commands diubah!' : '✅ Tidak ada'}`);
    console.log(`🆕 Server baru  : ${offlineNewGuilds.length} (bergabung saat bot offline)\n`);

    // ── Tentukan guild mana yang perlu di-deploy ──────────────────────────────
    let guildsToDeploy = [];
    let reason         = '';

    if (commandsChanged) {
      // Commands berubah → deploy ulang ke SEMUA server
      guildsToDeploy = allGuildIds;
      reason         = `commands berubah (hash: ${storedHash?.slice(0,8) ?? 'baru'} → ${currentHash.slice(0,8)})`;
    } else if (offlineNewGuilds.length > 0) {
      // Ada server baru yang join saat offline
      guildsToDeploy = offlineNewGuilds;
      reason         = `${offlineNewGuilds.length} server baru bergabung saat bot offline`;
    } else {
      // Semua up-to-date
      console.log(`✅ Semua ${allGuildIds.length} server sudah up-to-date, deployment dilewati.\n`);
      return;
    }

    // ── Proses deployment ─────────────────────────────────────────────────────
    console.log(`🔄 Deploy ke ${guildsToDeploy.length} server (${reason})...`);

    if (guildsToDeploy.length > 10) {
      const eta = Math.ceil(guildsToDeploy.length * 0.35);
      console.log(`   ⏳ Estimasi waktu: ~${eta} detik\n`);
    }

    let successCount = 0;

    for (let i = 0; i < guildsToDeploy.length; i++) {
      const guildId = guildsToDeploy[i];
      const guild   = client.guilds.cache.get(guildId);
      const name    = guild?.name ?? guildId;

      const result = await deployToGuild(guildId);

      if (result.success) {
        console.log(`  ✅ [${i + 1}/${guildsToDeploy.length}] ${name}`);
        successCount++;
      } else {
        console.log(`  ❌ [${i + 1}/${guildsToDeploy.length}] ${name} — ${result.error}`);
      }

      // Rate limit delay (skip delay untuk guild terakhir)
      if (i < guildsToDeploy.length - 1) {
        await new Promise(r => setTimeout(r, 350));
      }
    }

    // ── Update data deployment ────────────────────────────────────────────────
    // Gabungkan: guild lama yang masih aktif + guild yang baru di-deploy
    const updatedDeployedGuilds = [
      ...deployedGuilds.filter(id => allGuildIds.includes(id)), // filter yang masih aktif
      ...guildsToDeploy,
    ];
    saveDeployment(currentHash, updatedDeployedGuilds);

    console.log(`\n✅ Deployment selesai: ${successCount}/${guildsToDeploy.length} berhasil`);
    if (commandsChanged) {
      console.log(`🔖 Hash tersimpan: ${currentHash}`);
    }
    console.log('');
  },
};
