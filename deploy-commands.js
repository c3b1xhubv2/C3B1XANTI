require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// mode: guild | global | clear-guild | clear-global
const MODE = process.argv[2] || "guild";

// ================= VALIDATION =================
if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN tidak ditemukan");
  process.exit(1);
}

// ================= LOAD COMMANDS =================
const commands = [];
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./src/commands/${file}`);

  if (!command.data) {
    console.log(`⚠️ Command ${file} tidak punya data`);
    continue;
  }

  commands.push(command.data.toJSON());
}

// ================= REST =================
const rest = new REST({ version: '10' }).setToken(TOKEN);

// ================= MAIN =================
(async () => {
  try {
    console.log(`🚀 MODE: ${MODE}`);

    // ================= CLEAR GUILD =================
    if (MODE === "clear-guild") {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: [] }
      );

      console.log("🧹 Semua GUILD command berhasil dihapus!");
      return;
    }

    // ================= CLEAR GLOBAL =================
    if (MODE === "clear-global") {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: [] }
      );

      console.log("🧹 Semua GLOBAL command berhasil dihapus!");
      return;
    }

    // ================= DEPLOY GLOBAL =================
    if (MODE === "global") {
      console.log("🧹 Membersihkan GLOBAL command lama...");
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: [] }
      );

      console.log("🚀 Deploy GLOBAL command baru...");
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );

      console.log("🌍 Global commands berhasil di deploy!");
      console.log("⚠️ Delay ±1-10 menit");
      return;
    }

    // ================= DEPLOY GUILD =================
    console.log("🧹 Membersihkan GUILD command lama...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: [] }
    );

    console.log("🚀 Deploy GUILD command baru...");
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("🏠 Guild commands berhasil di deploy!");
    console.log("⚡ Instan muncul");

  } catch (error) {
    console.error(error);
  }
})();