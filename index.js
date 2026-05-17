require('dotenv').config();

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const CommandHandler = require('./src/handlers/commandHandler');
const EventHandler   = require('./src/handlers/eventHandler');

// ── Validasi env ──────────────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN dan CLIENT_ID wajib diisi di file .env!');
  process.exit(1);
}

// ── Client setup ──────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // Wajib aktifkan di Developer Portal!
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Storage untuk slash commands
client.commands = new Collection();

// Load semua handlers
CommandHandler(client);
EventHandler(client);

// Login
client.login(process.env.DISCORD_TOKEN)
  .then(() => console.log('🚀 Proses login sedang berjalan...'))
  .catch(err => {
    console.error('❌ Gagal login ke Discord:', err.message);
    process.exit(1);
  });
