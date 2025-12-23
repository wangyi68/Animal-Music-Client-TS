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
import { COLORS } from '../utils/constants.js';

const logger = createLogger('MusicManager');

// Extended player with custom data
interface ExtendedPlayerData {
    textChannelId: string;
    loopMode: LoopMode;
    history: KazagumoTrack[];
    originalQueue: KazagumoTrack[];
    lastMessageId: string | null;
    hasPlayed: boolean; // Flag để theo dõi player đã phát nhạc chưa
}

const playerDataMap = new Map<string, ExtendedPlayerData>();

export function createKazagumo(client: Client, config: Config): Kazagumo {
    // Support both array (multiple nodes) and single object (legacy config)
    let configNodes: any[] = [];

    if (Array.isArray(config.lavalink.nodes)) {
        configNodes = config.lavalink.nodes;
    } else if (typeof config.lavalink.nodes === 'object' && config.lavalink.nodes !== null) {
        logger.warn('config.lavalink.nodes is a single object. Converting to array for compatibility.');
        configNodes = [config.lavalink.nodes];
    } else {
        logger.warn('config.lavalink.nodes is invalid! Defaulting to empty array.');
    }

    const nodes = configNodes.map(node => ({
        name: node.name,
        url: node.url,
        auth: node.auth,
        secure: node.secure
    }));

    logger.info(`Initializing Cluster with ${nodes.length} nodes...`);

    const kazagumo = new Kazagumo({
        defaultSearchEngine: 'youtube_music',
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) client.ws.shards.get(guild.shardId)?.send(payload);
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
        logger.info(`Cluster '${name}' is ready!`);
    });

    // Log warnings for Lavalink errors
    kazagumo.shoukaku.on('error', (name, error) => {
    });
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

    kazagumo.on('playerEmpty', (player: KazagumoPlayer) => {
        handleQueueEmpty(player, client);
    });

    kazagumo.on('playerDestroy', (player: KazagumoPlayer) => {
        removePlayerData(player.guildId);
    });

    return kazagumo;
}

// Lấy ngẫu nhiên một node đã connected
export function getRandomConnectedNode(kazagumo: Kazagumo): string | undefined {
    const connectedNodes: string[] = [];

    kazagumo.shoukaku.nodes.forEach((node, name) => {
        // state 1 = CONNECTED
        if (node.state === 1) {
            connectedNodes.push(name);
        }
    });

    if (connectedNodes.length === 0) {
        logger.warn('No connected nodes available for random selection');
        return undefined;
    }

    const randomIndex = Math.floor(Math.random() * connectedNodes.length);
    const selectedNode = connectedNodes[randomIndex];
    return selectedNode;
}

// Lấy danh sách tên tất cả các nodes đã connected
export function getConnectedNodeNames(kazagumo: Kazagumo): string[] {
    const connectedNodes: string[] = [];

    kazagumo.shoukaku.nodes.forEach((node, name) => {
        if (node.state === 1) {
            connectedNodes.push(name);
        }
    });

    return connectedNodes;
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
    logger.info(`Cluster: ${player.shoukaku.node.name} Track started: ${track.title}`);

    const data = getPlayerData(player.guildId);
    if (!data?.textChannelId) return;

    // Đánh dấu là player đã phát nhạc rồi
    data.hasPlayed = true;

    const channel = client.channels.cache.get(data.textChannelId);
    if (!channel?.isTextBased() || channel.isDMBased()) return;

    // Use unified button creator
    const components = createPlayerControlButtons(player, data.loopMode);

    // Delete previous message if exists
    if (data.lastMessageId) {
        (channel as TextChannel).messages.delete(data.lastMessageId).catch(() => { });
        data.lastMessageId = null;
    }

    const nodeName = player.shoukaku.node.name;
    const embed = createCompactEmbed(track, client.user?.displayAvatarURL() || undefined, player.queue.size, nodeName);

    (channel as TextChannel).send({ embeds: [embed], components: components })
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
        player.queue.add(Object.assign(Object.create(Object.getPrototypeOf(currentTrack)), currentTrack));
    } else if (data.loopMode === 2 && player.queue.size === 0 && data.originalQueue.length > 0) {
        // Restore original queue from snapshot when empty
        data.originalQueue.forEach(track => player.queue.add(Object.assign(Object.create(Object.getPrototypeOf(track)), track)));
    }
}

function handleQueueEmpty(player: KazagumoPlayer, client: Client): void {
    const data = getPlayerData(player.guildId);
    if (!data?.textChannelId) return;

    // Chỉ gửi thông báo "hết nhạc" nếu player đã từng phát nhạc
    // Điều này tránh việc gửi message khi player vừa được tạo hoặc khi queue ban đầu rỗng
    if (!data.hasPlayed) return;

    // QUAN TRỌNG: Kiểm tra thêm xem có bài nào đang phát không
    // Nếu có bài đang phát thì không gửi thông báo (vì playerEmpty có thể trigger sai lúc)
    if (player.queue.current) return;

    // Kiểm tra thêm: nếu player đang playing hoặc paused thì không gửi
    if (player.playing || player.paused) return;

    const channel = client.channels.cache.get(data.textChannelId);
    if (!channel?.isTextBased() || channel.isDMBased()) return;

    const embed = new EmbedBuilder()
        .setDescription(`> Hết nhạc rồi! Chán quá đi mất! Muốn nghe nữa thì thêm bài vào đi!`)
        .setColor(COLORS.MAIN);

    (channel as TextChannel).send({ embeds: [embed] }).catch(() => { });
}

function createCompactEmbed(track: KazagumoTrack, botAvatarUrl?: string, queueSize?: number, nodeName?: string): EmbedBuilder {
    const minutes = Math.floor((track.length || 0) / 60000);
    const seconds = Math.floor(((track.length || 0) % 60000) / 1000);
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const authorName = track.requester ? (track.requester as any).username : 'Không rõ';

    // Queue info with markdown
    const queueInfo = queueSize !== undefined && queueSize > 0
        ? `Còn **${queueSize}** bài nữa lận! Nghe mệt nghỉ!`
        : 'Hàng chờ trống trơn! Thêm nhạc đi!';

    return new EmbedBuilder()
        .setColor(COLORS.MAIN)
        .setAuthor({
            name: `Đang phát nhạc giúp bạn đây!`,
            iconURL: botAvatarUrl
        })
        .setTitle(track.title)
        .setURL(track.uri || null)
        .setThumbnail(track.thumbnail || null)
        .setDescription(`> <a:Music:1452370827474636810> **Bài hát bởi** ${track.author}`)
        .addFields(
            { name: '<a:Loading:1452376829062283478> **Thời lượng**', value: `\`${duration}\``, inline: true },
            { name: '<a:xoayxoat:1444329766600708258> **Yêu cầu bởi**', value: `\`${authorName}\``, inline: true },
            { name: '<:guranote:1444001458600022179> **Hàng chờ**', value: `\`${queueSize || 0} bài\``, inline: true },
            { name: '<a:li:1444329999971651787> **Cluster**', value: `\`${nodeName || 'Unknown'}\``, inline: true }
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
        originalQueue: [],
        lastMessageId: null,
        hasPlayed: false // Khởi tạo là chưa phát nhạc
    });
}

export function removePlayerData(guildId: string): void {
    playerDataMap.delete(guildId);
}

export function setLoopMode(guildId: string, mode: LoopMode, player?: KazagumoPlayer): void {
    const data = playerDataMap.get(guildId);
    if (data) {
        data.loopMode = mode;
        if (mode === 2 && player) {
            // Snapshot current queue
            data.originalQueue = [...player.queue];
            if (player.queue.current) {
                // Clone current track using object create to keep prototype
                data.originalQueue.unshift(Object.assign(Object.create(Object.getPrototypeOf(player.queue.current)), player.queue.current));
            }
        } else if (mode !== 2) {
            data.originalQueue = [];
        }
    }
}

export function getLoopMode(guildId: string): LoopMode {
    return playerDataMap.get(guildId)?.loopMode ?? 0;
}
