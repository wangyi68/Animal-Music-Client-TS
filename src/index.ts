import {
    Client,
    GatewayIntentBits,
    Collection,
    ActivityType,
    Events
} from 'discord.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createLogger } from './utils/logger.js';
import { connectDatabase, disconnectDatabase } from './database/index.js';
import { loadCommands } from './handlers/CommandHandler.js';
import { handleMessage } from './handlers/MessageHandler.js';
import { registerSlashCommands, handleSlashCommand, handleAutocomplete } from './handlers/SlashHandler.js';
import { handleInteraction } from './handlers/InteractionHandler.js';
import { createKazagumo } from './services/MusicManager.js';
import { AnimalSync } from './services/AnimalSync.js';
import type { Config, BotClient } from './types/index.js';

const logger = createLogger('Main');

// Load config
function loadConfig(): Config {
    const configPath = join(process.cwd(), 'config.json');

    if (!existsSync(configPath)) {
        logger.error('config.json not found! Copy config.example.json to config.json and fill in your values.');
        process.exit(1);
    }

    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Config;
    return config;
}

async function main(): Promise<void> {
    logger.info('Starting Animal Music Client...');

    // Load configuration
    const config = loadConfig();

    // Create Discord client
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent
        ]
    }) as BotClient;

    // Initialize collections
    client.commands = new Collection();
    client.aliases = new Collection();
    client.config = config;

    // Connect to database
    try {
        await connectDatabase(config);
    } catch (error) {
        logger.error(`Database connection failed: ${(error as Error).message}`);
    }

    // Initialize Kazagumo (Lavalink client)
    client.kazagumo = createKazagumo(client, config);

    // Initialize AnimalSync (WebSocket)
    if (config.websocket?.url) {
        try {
            AnimalSync.initialize(config);
            logger.info('AnimalSync initialized');
        } catch (error) {
            logger.warn(`AnimalSync initialization failed: ${(error as Error).message}`);
        }
    }

    // Load commands
    await loadCommands();

    // Event: Ready
    client.once(Events.ClientReady, async () => {
        logger.info(`${client.user?.tag} is ready!`);

        // Register slash commands (using client ID)
        if (client.user) {
            await registerSlashCommands(config, client.user.id);
        }

        // Rotating Presence
        const activities = [
            {
                name: 'Youtube',
                type: ActivityType.Streaming,
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            },
            {
                name: 'Spotify',
                type: ActivityType.Streaming,
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            },
            {
                name: 'SoundCloud',
                type: ActivityType.Streaming,
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            },
        ];

        let currentIndex = 0;
        const updatePresence = () => {
            if (client.user) {
                client.user.setPresence({
                    activities: [activities[currentIndex]],
                    status: 'online'
                });
                currentIndex = (currentIndex + 1) % activities.length;
            }
        };

        // Initial update
        updatePresence();

        // Rotate every 10 seconds
        setInterval(updatePresence, 10000);

        // Sync guilds with AnimalSync
        try {
            const animalSync = AnimalSync.getInstance();
            const guilds = client.guilds.cache.map(g => g.id);
            animalSync.sendGuildSync(guilds);
        } catch (e) { }
    });

    // Event: Message (Prefix commands)
    client.on(Events.MessageCreate, async (message) => {
        await handleMessage(message, config);
    });

    // Event: Interaction (Slash commands & Components)
    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isChatInputCommand()) {
            await handleSlashCommand(interaction, config);
        } else if (
            interaction.isButton() ||
            interaction.isStringSelectMenu() ||
            interaction.isModalSubmit()
        ) {
            await handleInteraction(interaction, config);
        } else if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction);
        }
    });

    // Event: Voice State Update
    const autoLeaveTimers = new Map<string, NodeJS.Timeout>();

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        // Bot was disconnected
        if (oldState.member?.id === client.user?.id && !newState.channel) {
            const player = client.kazagumo.players.get(oldState.guild.id);
            if (player) {
                try {
                    await player.destroy();
                } catch (error) {
                    // Ignore already destroyed errors
                }
            }
            // Clear any pending auto-leave timer
            const timer = autoLeaveTimers.get(oldState.guild.id);
            if (timer) {
                clearTimeout(timer);
                autoLeaveTimers.delete(oldState.guild.id);
            }
            return;
        }

        // Check if someone left the voice channel where bot is
        const player = client.kazagumo.players.get(oldState.guild.id);
        if (!player || !player.voiceId) return;

        const voiceChannel = client.channels.cache.get(player.voiceId);
        if (!voiceChannel || voiceChannel.type !== 2) return; // 2 = GUILD_VOICE

        const members = (voiceChannel as any).members?.filter((m: any) => !m.user.bot);
        const memberCount = members?.size ?? 0;

        // If bot is alone in the channel
        if (memberCount === 0) {
            // Start 3-minute timer to auto-leave
            if (!autoLeaveTimers.has(oldState.guild.id)) {
                const timer = setTimeout(async () => {
                    const currentPlayer = client.kazagumo.players.get(oldState.guild.id);
                    if (currentPlayer) {
                        // Double check if still alone
                        const vc = client.channels.cache.get(currentPlayer.voiceId || '');
                        const stillAlone = vc && (vc as any).members?.filter((m: any) => !m.user.bot).size === 0;

                        if (stillAlone) {
                            try {
                                await currentPlayer.destroy();
                                logger.info(`Auto-left voice channel in guild ${oldState.guild.id} due to inactivity`);
                            } catch (e) {
                                // Ignore
                            }
                        }
                    }
                    autoLeaveTimers.delete(oldState.guild.id);
                }, 3 * 60 * 1000); // 3 minutes

                autoLeaveTimers.set(oldState.guild.id, timer);
            }
        } else {
            // Someone joined, cancel the timer
            const timer = autoLeaveTimers.get(oldState.guild.id);
            if (timer) {
                clearTimeout(timer);
                autoLeaveTimers.delete(oldState.guild.id);
            }
        }
    });

    // Event: Guild Join
    client.on(Events.GuildCreate, (guild) => {
        logger.info(`Joined guild: ${guild.name} (${guild.id})`);
        try {
            const animalSync = AnimalSync.getInstance();
            const guilds = client.guilds.cache.map(g => g.id);
            animalSync.sendGuildSync(guilds);
        } catch (e) { }
    });

    // Event: Guild Leave
    client.on(Events.GuildDelete, (guild) => {
        logger.info(`Left guild: ${guild.name} (${guild.id})`);
        try {
            const animalSync = AnimalSync.getInstance();
            const guilds = client.guilds.cache.map(g => g.id);
            animalSync.sendGuildSync(guilds);
        } catch (e) { }
    });

    // Graceful shutdown
    const shutdown = async () => {
        logger.info('Shutting down...');

        try {
            const animalSync = AnimalSync.getInstance();
            await animalSync.dispose();
        } catch (e) { }

        await disconnectDatabase();
        client.destroy();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Login
    try {
        await client.login(config.app.token);
    } catch (error) {
        logger.error(`Failed to login: ${(error as Error).message}`);
        process.exit(1);
    }
}

main().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
