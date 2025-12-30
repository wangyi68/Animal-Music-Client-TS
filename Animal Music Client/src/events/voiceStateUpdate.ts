/**
 * Voice State Update Event Handler
 * Handles auto-leave when bot is alone in voice channel
 */

import { VoiceState, Client } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import type { Config } from '../types/index.js';
import type { BotClient } from '../types/index.js';

const logger = createLogger('VoiceStateEvent');

// Auto-leave timers storage
const autoLeaveTimers = new Map<string, NodeJS.Timeout>();

/**
 * Get non-bot member count in a voice channel
 */
function getNonBotMemberCount(channel: any): number {
    const members = channel?.members?.filter((m: any) => !m.user.bot);
    return members?.size ?? 0;
}

/**
 * Handle bot disconnection from voice channel
 */
async function handleBotDisconnect(
    client: BotClient,
    oldState: VoiceState
): Promise<boolean> {
    if (oldState.member?.id !== client.user?.id || oldState.channel) {
        return false;
    }

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

    return true;
}

/**
 * Start auto-leave timer when bot is alone
 */
function startAutoLeaveTimer(
    client: BotClient,
    guildId: string,
    timeout: number
): void {
    if (autoLeaveTimers.has(guildId)) return;

    const timer = setTimeout(async () => {
        const currentPlayer = client.kazagumo.players.get(guildId);
        if (!currentPlayer) {
            autoLeaveTimers.delete(guildId);
            return;
        }

        // Double check if still alone
        const vc = client.channels.cache.get(currentPlayer.voiceId || '');
        const stillAlone = vc && getNonBotMemberCount(vc) === 0;

        if (stillAlone) {
            try {
                await currentPlayer.destroy();
                logger.info(`Auto-left voice channel in guild ${guildId} due to inactivity`);
            } catch (e) {
                // Ignore destruction errors
            }
        }

        autoLeaveTimers.delete(guildId);
    }, timeout);

    autoLeaveTimers.set(guildId, timer);
}

/**
 * Cancel auto-leave timer when someone joins
 */
function cancelAutoLeaveTimer(guildId: string): void {
    const timer = autoLeaveTimers.get(guildId);
    if (timer) {
        clearTimeout(timer);
        autoLeaveTimers.delete(guildId);
    }
}

/**
 * Voice state update event handler
 */
export default async function handleVoiceStateUpdate(
    client: BotClient,
    config: Config,
    oldState: VoiceState,
    newState: VoiceState
): Promise<void> {
    // Handle bot disconnection
    const wasDisconnected = await handleBotDisconnect(client, oldState);
    if (wasDisconnected) return;

    // Check if someone left the voice channel where bot is
    const player = client.kazagumo.players.get(oldState.guild.id);
    if (!player || !player.voiceId) return;

    const voiceChannel = client.channels.cache.get(player.voiceId);
    if (!voiceChannel || voiceChannel.type !== 2) return; // 2 = GUILD_VOICE

    const memberCount = getNonBotMemberCount(voiceChannel);
    // Default: 3 minutes auto-leave timeout
    const AUTO_LEAVE_TIMEOUT = 3 * 60 * 1000;

    if (memberCount === 0) {
        // Bot is alone - start auto-leave timer
        startAutoLeaveTimer(client, oldState.guild.id, AUTO_LEAVE_TIMEOUT);
    } else {
        // Someone joined - cancel timer
        cancelAutoLeaveTimer(oldState.guild.id);
    }
}

/**
 * Clear all timers (for cleanup)
 */
export function clearAllAutoLeaveTimers(): void {
    for (const [guildId, timer] of autoLeaveTimers) {
        clearTimeout(timer);
    }
    autoLeaveTimers.clear();
}
