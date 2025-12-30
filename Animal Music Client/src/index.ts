/**
 * Animal Music Client - Main Entry Point
 * @version 3.1.0
 */

import {
    Client,
    GatewayIntentBits,
    Collection,
    Events
} from 'discord.js';
import { createLogger } from './utils/logger.js';
import { loadConfig } from './utils/ConfigLoader.js';
import { connectDatabase, disconnectDatabase } from './database/index.js';
import { loadCommands } from './handlers/CommandHandler.js';
import { handleMessage } from './handlers/MessageHandler.js';
import { handleSlashCommand, handleAutocomplete } from './handlers/SlashHandler.js';
import { handleInteraction } from './handlers/InteractionHandler.js';
import { createKazagumo } from './services/MusicManager.js';
import { AnimalSync } from './services/AnimalSync.js';
import { RestAPI } from './services/RestAPI.js';
import { StateManager, NodeManager } from './core/index.js';
import {
    handleReady,
    handleVoiceStateUpdate,
    handleGuildCreate,
    handleGuildDelete,
    clearAllAutoLeaveTimers
} from './events/index.js';
import type { BotClient, Config } from './types/index.js';

const logger = createLogger('Main');

/**
 * Initialize Discord client with required intents
 */
function createClient(): BotClient {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent
        ]
    }) as BotClient;

    client.commands = new Collection();
    client.aliases = new Collection();

    return client;
}

/**
 * Initialize services (AnimalSync & REST API)
 */
async function initializeServices(client: BotClient, config: Config): Promise<void> {
    // Initialize AnimalSync (SignalR)
    if (config.websocket?.url) {
        try {
            await AnimalSync.initialize(config, client.kazagumo);
            logger.info('AnimalSync initialized');
        } catch (error) {
            logger.warn(`AnimalSync initialization failed: ${(error as Error).message}`);
        }
    }

    // Initialize REST API
    if (config.api?.enabled) {
        try {
            RestAPI.initialize(config, client.kazagumo, client, config.api.port || 3002);
            logger.info('REST API initialized');
        } catch (error) {
            logger.warn(`REST API initialization failed: ${(error as Error).message}`);
        }
    }
}

/**
 * Register all event listeners
 */
function registerEvents(client: BotClient, config: Config): void {
    // Ready event
    client.once(Events.ClientReady, async () => {
        await handleReady(client, config);

        // Sync guilds with AnimalSync after ready
        if (config.websocket?.url) {
            const guildIds = client.guilds.cache.map(g => g.id);
            await AnimalSync.sendGuildSync(guildIds);
        }
    });

    // Message event (prefix commands)
    client.on(Events.MessageCreate, async (message) => {
        await handleMessage(message, config);
    });

    // Interaction event (slash commands & components)
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

    // Voice state update event
    client.on(Events.VoiceStateUpdate, (oldState, newState) => {
        handleVoiceStateUpdate(client, config, oldState, newState);
    });

    // Guild events with AnimalSync
    client.on(Events.GuildCreate, async (guild) => {
        handleGuildCreate(client, config, guild);
        if (config.websocket?.url) {
            const guildIds = client.guilds.cache.map(g => g.id);
            await AnimalSync.sendGuildSync(guildIds);
        }
    });

    client.on(Events.GuildDelete, async (guild) => {
        handleGuildDelete(client, config, guild);
        if (config.websocket?.url) {
            const guildIds = client.guilds.cache.map(g => g.id);
            await AnimalSync.sendGuildSync(guildIds);
        }
    });
}

/**
 * Graceful shutdown handler
 */
function createShutdownHandler(client: BotClient): () => Promise<void> {
    return async () => {
        logger.info('Shutting down...');

        // Cleanup AnimalSync
        try {
            await AnimalSync.dispose();
        } catch (e) {
            // Ignore
        }

        // Cleanup REST API
        try {
            await RestAPI.dispose();
        } catch (e) {
            // Ignore
        }

        // Cleanup auto-leave timers
        clearAllAutoLeaveTimers();

        // Cleanup core services
        StateManager.dispose();
        NodeManager.dispose();

        // Disconnect database
        await disconnectDatabase();

        // Destroy client
        client.destroy();

        process.exit(0);
    };
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
    logger.info('Starting Animal Music Client...');

    // Load configuration
    const config = loadConfig();

    // Create Discord client
    const client = createClient();
    client.config = config;

    // Connect to database
    try {
        await connectDatabase(config);
    } catch (error) {
        logger.error(`Database connection failed: ${(error as Error).message}`);
    }

    // Initialize Kazagumo (Lavalink client)
    client.kazagumo = createKazagumo(client, config);

    // Load commands
    await loadCommands();

    // Initialize services (AnimalSync & REST API)
    await initializeServices(client, config);

    // Register event handlers
    registerEvents(client, config);

    // Setup graceful shutdown
    const shutdown = createShutdownHandler(client);
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Login to Discord
    try {
        await client.login(config.app.token);
    } catch (error) {
        logger.error(`Failed to login: ${(error as Error).message}`);
        process.exit(1);
    }
}

// Start the application
main().catch((error) => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
