/**
 * Guild Delete Event Handler
 * Handles when bot leaves/is kicked from a guild
 */

import { Guild, Client } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import type { Config } from '../types/index.js';

const logger = createLogger('GuildDeleteEvent');

/**
 * Guild delete event handler
 */
export default function handleGuildDelete(
    _client: Client,
    _config: Config,
    guild: Guild
): void {
    logger.info(`Left guild: ${guild.name} (${guild.id})`);
}
