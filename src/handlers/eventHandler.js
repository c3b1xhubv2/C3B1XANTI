/**
 * eventHandler.js — Auto-load semua file dari src/events/
 * Untuk tambah event baru: cukup buat file .js di folder events/
 */

const fs   = require('fs');
const path = require('path');

module.exports = (client) => {
  const eventsPath = path.join(__dirname, '../events');
  const files      = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  let loaded = 0;
  for (const file of files) {
    try {
      const event = require(path.join(eventsPath, file));

      if (!event.name || !event.execute) {
        console.warn(`⚠️  [Events] ${file} tidak punya 'name' atau 'execute' — dilewati`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      loaded++;
      console.log(`  📡 Event dimuat   : ${event.name}${event.once ? ' (once)' : ''}`);
    } catch (err) {
      console.error(`❌ [Events] Gagal load ${file}:`, err.message);
    }
  }

  console.log(`✅ [Events] ${loaded} event(s) siap\n`);
};
