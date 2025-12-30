/**
 * Ready Event Handler
 * Handles bot ready state and rotating presence
 */

import { ActivityType } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { getLavalinkNodesStatus } from '../services/MusicManager.js';
import { registerSlashCommands } from '../handlers/SlashHandler.js';
import type { Config } from '../types/index.js';
import type { BotClient } from '../types/index.js';

const logger = createLogger('ReadyEvent');

// Rotating presence activities
const ACTIVITIES = [
    {
        name: 'Youtube',
        type: ActivityType.Streaming,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    {
        name: 'SoundCloud',
        type: ActivityType.Streaming,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
    {
        name: 'Cluster Stats',
        type: ActivityType.Streaming,
        url: 'https://www.youtube.com/watch?v=vkpcyY7Xe64',
    },
];

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Update bot presence with rotating activities
 */
function createPresenceUpdater(client: BotClient): () => void {
    let currentIndex = 0;

    return () => {
        if (!client.user) return;

        const activity = ACTIVITIES[currentIndex];
        let displayActivity: any = activity;

        // Special handling for Cluster Stats - show real-time stats
        if (activity.name === 'Cluster Stats' && client.kazagumo) {
            const nodes = getLavalinkNodesStatus(client.kazagumo);
            const memoryUsage = nodes.reduce((acc, node) => acc + node.memory.used, 0);
            const totalPlayers = nodes.reduce((acc, node) => acc + node.players, 0);

            displayActivity = {
                name: `Cluster: ${nodes.length} | Play: ${totalPlayers} | RAM: ${formatBytes(memoryUsage)}`,
                type: ActivityType.Streaming,
                url: 'https://www.youtube.com/watch?v=vkpcyY7Xe64',
            };
        }

        client.user.setPresence({
            activities: [displayActivity],
            status: 'online'
        });

        currentIndex = (currentIndex + 1) % ACTIVITIES.length;
    };
}

/**
 * Ready event handler
 */
export default async function handleReady(client: BotClient, config: Config): Promise<void> {
    logger.info(`${client.user?.tag} is ready!`);

    // Register slash commands
    if (client.user) {
        await registerSlashCommands(config, client.user.id);
    }

    // Setup rotating presence
    const updatePresence = createPresenceUpdater(client);
    updatePresence(); // Initial update

    // Update presence every 30 seconds
    setInterval(updatePresence, 30000);
}
