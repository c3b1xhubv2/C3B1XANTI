/**
 * guildCreate.js — Dipanggil otomatis saat bot MASUK ke server baru.
 *
 * Yang terjadi:
 *   1. Inisialisasi config server di database (antilink, antispam)
 *   2. Deploy semua slash commands ke server baru SECARA INSTAN
 *   3. Catat server ke daftar guild yang sudah di-deploy
 *
 * Tidak perlu konfigurasi manual apapun — semuanya otomatis.
 */

const { deployToGuild }      = require('../utils/deployCommands');
const { addDeployedGuild }   = require('../utils/commandHash');
const { getGuildConfig }     = require('../utils/database');

module.exports = {
  name: 'guildCreate',
  once: false,

  async execute(guild) {
    const tag = `"${guild.name}" (${guild.id})`;
    console.log(`\n📨 Bot bergabung ke server baru: ${tag}`);
    console.log(`   👥 Members : ${guild.memberCount}`);
    console.log(`   👑 Owner   : ${guild.ownerId}`);

    // 1. Inisialisasi config server (buat entry default di database)
    try {
      getGuildConfig(guild.id);
      console.log(`   ✅ Config server diinisialisasi`);
    } catch (err) {
      console.error(`   ⚠️  Gagal init config: ${err.message}`);
    }

    // 2. Deploy semua commands ke server ini
    console.log(`   🔄 Deploy commands...`);
    const result = await deployToGuild(guild.id);

    if (result.success) {
      console.log(`   ✅ ${result.count} commands berhasil di-deploy ke ${tag}\n`);
      addDeployedGuild(guild.id);
    } else {
      console.error(`   ❌ Deploy gagal: ${result.error}\n`);
    }
  },
};
