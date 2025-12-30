/**
 * Guild Create Event Handler
 * Handles when bot joins a new guild
 */

import { Guild, Client } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

const logger = createLogger('GuildCreateEvent');

/**
 * Guild create event handler
 */
export default function handleGuildCreate(
    _client: Client,
    _config: Config,
    guild: Guild
): void {
    logger.info(`Joined guild: ${guild.name} (${guild.id})`);
}
