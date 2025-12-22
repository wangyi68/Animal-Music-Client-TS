import { Kazagumo, KazagumoPlayer, KazagumoTrack } from 'kazagumo';
import { Connectors } from 'shoukaku';
import {
    Client,
    TextChannel,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import { createLogger } from '../utils/logger.js';
import type { Config, LoopMode, PlayerSyncData } from '../types/index.js';
import { AnimalSync } from './AnimalSync.js';
import { EMOJIS } from '../utils/constants.js';
import { createPlayerControlButtons } from '../utils/buttons.js';

const logger = createLogger('MusicManager');

// Extended player with custom data
interface ExtendedPlayerData {
    textChannelId: string;
    loopMode: LoopMode;
    history: KazagumoTrack[];
    lastMessageId: string | null;
}

const playerDataMap = new Map<string, ExtendedPlayerData>();

export function createKazagumo(client: Client, config: Config): Kazagumo {
    const kazagumo = new Kazagumo({
        defaultSearchEngine: 'youtube_music',
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        plugins: []
    }, new Connectors.DiscordJS(client), config.lavalink.nodes.length > 0 ? [config.lavalink.nodes[0]] : [], {
        moveOnDisconnect: true,
        resume: true,
        reconnectTries: 5,
        restTimeout: 10000
    });

    // Event handlers
    kazagumo.shoukaku.on('ready', (name: string) => {
        logger.info(`Node '${name}' is ready!`);
    });

    kazagumo.shoukaku.on('error', (name: string, error: Error) => {
        logger.error(`Node '${name}' error: ${error.message}`);
    });

    kazagumo.shoukaku.on('close', (name: string, code: number, reason: string) => {
        logger.warn(`Node '${name}' closed with code ${code}: ${reason}`);
    });

    kazagumo.shoukaku.on('disconnect', ((name: string, players: any, moved: boolean) => {
        if (moved) {
            logger.info(`Node '${name}' disconnected. Players moved.`);
        } else {
            logger.warn(`Node '${name}' disconnected.`);
        }
    }) as any);

    // Player events
    kazagumo.on('playerStart' as any, (player: KazagumoPlayer, track: KazagumoTrack) => {
        handleTrackStart(player, track, client);
    });

    kazagumo.on('playerEnd' as any, (player: KazagumoPlayer) => {
        handleTrackEnd(player);
    });

    kazagumo.on('playerEmpty' as any, (player: KazagumoPlayer) => {
        handleQueueEmpty(player, client);
    });

    return kazagumo;
}

function handleTrackStart(player: KazagumoPlayer, track: KazagumoTrack, client: Client): void {
    logger.info(`Track started: ${track.title}`);

    const data = getPlayerData(player.guildId);
    if (!data?.textChannelId) return;

    const channel = client.channels.cache.get(data.textChannelId) as TextChannel;
    if (!channel) return;

    // Use unified button creator
    const components = createPlayerControlButtons(player, data.loopMode);

    // Delete previous message if exists
    if (data.lastMessageId) {
        channel.messages.delete(data.lastMessageId).catch(() => { });
        data.lastMessageId = null;
    }

    const embed = createCompactEmbed(track);

    channel.send({ embeds: [embed], components: components })
        .then(msg => {
            data.lastMessageId = msg.id;
            // No longer auto-delete after duration, we manually manage it on next track start
        })
        .catch(err => logger.error(`Error sending music card: ${err.message}`));

    // Sync
    try {
        const animalSync = AnimalSync.getInstance();
        const syncData: PlayerSyncData = {
            eventExtend: 'event',
            guildId: player.guildId,
            voiceChannelId: player.voiceId || '',
            musicList: [track.title],
            event: {
                type: 'TrackStart',
                guildId: player.guildId,
                channelId: player.voiceId || ''
            }
        };
        animalSync.sendPlayerSync(syncData);
    } catch (e) { }
}

function handleTrackEnd(player: KazagumoPlayer): void {
    const data = getPlayerData(player.guildId);
    if (!data) return;

    const currentTrack = player.queue.current;
    if (currentTrack && data.loopMode !== 1) { // Not track loop
        data.history.push(currentTrack);
        if (data.history.length > 50) {
            data.history.shift();
        }
    }

    if (data.loopMode === 1 && currentTrack) {
        player.queue.add(currentTrack);
    } else if (data.loopMode === 2 && player.queue.size === 0 && data.history.length > 0) {
        data.history.forEach(track => player.queue.add(track));
        data.history = [];
    }
}

function handleQueueEmpty(player: KazagumoPlayer, client: Client): void {
    const data = getPlayerData(player.guildId);
    if (!data?.textChannelId) return;

    const channel = client.channels.cache.get(data.textChannelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setDescription(`${EMOJIS.QUEUE_EMPTY} Queue finished.`)
        .setColor(0xFFC0CB);

    channel.send({ embeds: [embed] }).catch(() => { });
}

function createCompactEmbed(track: KazagumoTrack): EmbedBuilder {
    const minutes = Math.floor((track.length || 0) / 60000);
    const seconds = Math.floor(((track.length || 0) % 60000) / 1000);
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const authorName = track.requester ? (track.requester as any).username : 'Unknown';

    return new EmbedBuilder()
        .setColor(0xFFC0CB) // Pink Main Color
        .setThumbnail(track.thumbnail || null)
        .setAuthor({ name: `${track.title}`, iconURL: track.thumbnail || undefined })
        .setTitle(`${EMOJIS.MUSIC} ${track.title}`)
        .setURL(track.uri || null)
        .setDescription(`By **${track.author}** | ${EMOJIS.TIME} ${duration} | ${EMOJIS.USER} ${authorName}`)
        .setFooter({ text: `Requested by ${authorName}` });
}

// Player data management
export function getPlayerData(guildId: string): ExtendedPlayerData | undefined {
    return playerDataMap.get(guildId);
}

export function setPlayerData(guildId: string, textChannelId: string): void {
    playerDataMap.set(guildId, {
        textChannelId,
        loopMode: 0,
        history: [],
        lastMessageId: null
    });
}

export function removePlayerData(guildId: string): void {
    playerDataMap.delete(guildId);
}

export function setLoopMode(guildId: string, mode: LoopMode): void {
    const data = playerDataMap.get(guildId);
    if (data) {
        data.loopMode = mode;
    }
}

export function getLoopMode(guildId: string): LoopMode {
    return playerDataMap.get(guildId)?.loopMode ?? 0;
}
