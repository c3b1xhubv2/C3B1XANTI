/**
 * commandHandler.js — Auto-load semua file dari src/commands/
 * Untuk tambah command baru: cukup buat file .js di folder commands/
 */

const fs   = require('fs');
const path = require('path');

module.exports = (client) => {
  const commandsPath = path.join(__dirname, '../commands');
  const files        = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  let loaded = 0;
  for (const file of files) {
    try {
      const cmd = require(path.join(commandsPath, file));

      if (!cmd.data || !cmd.execute) {
        console.warn(`⚠️  [Commands] ${file} tidak punya 'data' atau 'execute' — dilewati`);
        continue;
      }

      client.commands.set(cmd.data.name, cmd);
      loaded++;
      console.log(`  📌 Command dimuat : /${cmd.data.name}`);
    } catch (err) {
      console.error(`❌ [Commands] Gagal load ${file}:`, err.message);
    }
  }

  console.log(`✅ [Commands] ${loaded} command(s) siap\n`);
};
