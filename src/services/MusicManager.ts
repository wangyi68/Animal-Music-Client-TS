import { Kazagumo, KazagumoPlayer, KazagumoTrack } from 'kazagumo';
import { Connectors } from 'shoukaku';
import {
    Client,
    TextChannel,
    EmbedBuilder,
} from 'discord.js';
import { createLogger } from '../utils/logger.js';
import type { Config, LoopMode, PlayerSyncData, LavalinkNodeStatus } from '../types/index.js';
import { AnimalSync } from './AnimalSync.js';
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
    // Use all configured nodes instead of just the first one
    const nodes = config.lavalink.nodes.map(node => ({
        name: node.name,
        url: node.url,
        auth: node.auth,
        secure: node.secure
    }));

    const kazagumo = new Kazagumo({
        defaultSearchEngine: 'youtube_music',
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) guild.shard.send(payload);
        },
        plugins: []
    }, new Connectors.DiscordJS(client), nodes, {
        moveOnDisconnect: true,
        resume: true,
        reconnectTries: 5,
        restTimeout: 10000
    });

    // Event handlers - Only log when node is ready (successful connection)
    kazagumo.shoukaku.on('ready', (name: string) => {
        logger.info(`Node '${name}' is ready!`);
    });

    // Silent handlers for error/close/disconnect/reconnecting to avoid log spam
    kazagumo.shoukaku.on('error', () => { });
    kazagumo.shoukaku.on('close', () => { });
    kazagumo.shoukaku.on('disconnect', (() => { }) as any);
    kazagumo.shoukaku.on('reconnecting', (() => { }) as any);

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

// Get status of all Lavalink nodes
export function getLavalinkNodesStatus(kazagumo: Kazagumo): LavalinkNodeStatus[] {
    const statuses: LavalinkNodeStatus[] = [];

    kazagumo.shoukaku.nodes.forEach((node, name) => {
        const stats = node.stats;
        const nodeAny = node as any;
        statuses.push({
            name: name,
            url: `${nodeAny.options?.host || nodeAny.url || 'unknown'}:${nodeAny.options?.port || ''}`.replace(/:$/, ''),
            state: node.state === 0 ? 'CONNECTING'
                : node.state === 1 ? 'CONNECTED'
                    : node.state === 2 ? 'DISCONNECTED'
                        : 'RECONNECTING',
            players: stats?.players || 0,
            cpu: stats?.cpu?.systemLoad ? Math.round(stats.cpu.systemLoad * 100) : 0,
            memory: {
                used: stats?.memory?.used || 0,
                free: stats?.memory?.free || 0,
                allocated: stats?.memory?.allocated || 0,
                reservable: stats?.memory?.reservable || 0
            },
            uptime: stats?.uptime || 0,
            ping: typeof nodeAny.ws?.ping === 'number' ? nodeAny.ws.ping : -1
        });
    });

    return statuses;
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

    const embed = createCompactEmbed(track, client.user?.displayAvatarURL() || undefined, player.queue.size);

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
        .setDescription(`> Hết nhạc rồi nè~ Muốn nghe nữa thì thêm bài vào đi nha!`)
        .setColor(0xFFC0CB);

    channel.send({ embeds: [embed] }).catch(() => { });
}

function createCompactEmbed(track: KazagumoTrack, botAvatarUrl?: string, queueSize?: number): EmbedBuilder {
    const minutes = Math.floor((track.length || 0) / 60000);
    const seconds = Math.floor(((track.length || 0) % 60000) / 1000);
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const authorName = track.requester ? (track.requester as any).username : 'Không rõ';

    // Queue info with markdown
    const queueInfo = queueSize !== undefined && queueSize > 0
        ? `Còn **${queueSize}** bài nữa nè!`
        : 'Hàng chờ trống rồi...';

    return new EmbedBuilder()
        .setColor(0xFFC0CB) // Pink Main Color
        .setAuthor({
            name: `Đang phát cho bạn nghe nè~`,
            iconURL: botAvatarUrl
        })
        .setTitle(track.title)
        .setURL(track.uri || null)
        .setThumbnail(track.thumbnail || null)
        .setDescription(`> <a:Music:1452370827474636810> **Bài hát bởi** ${track.author}`)
        .addFields(
            { name: '<a:Loading:1452376829062283478> **Thời lượng**', value: `\`${duration}\``, inline: true },
            { name: '<a:xoayxoat:1444329766600708258> **Yêu cầu bởi**', value: `\`${authorName}\``, inline: true },
            { name: '<:guranote:1444001458600022179> **Hàng chờ**', value: `\`${queueSize || 0} bài\``, inline: true }
        )
        .setFooter({
            text: `Animal Music • ${queueInfo}`,
            iconURL: botAvatarUrl
        })
        .setTimestamp();
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
