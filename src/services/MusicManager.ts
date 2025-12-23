/**
 * MusicManager v3.0 - Refactored with Core Services
 * @version 3.0.0
 */

import { Kazagumo, KazagumoPlayer, KazagumoTrack } from 'kazagumo';
import Spotify from 'kazagumo-spotify';
import { Connectors } from 'shoukaku';
import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import type { Config, LoopMode, PlayerSyncData, LavalinkNodeStatus } from '../types/index.js';
import { AnimalSync } from './AnimalSync.js';
import { createPlayerControlButtons } from '../utils/buttons.js';
import { COLORS } from '../utils/constants.js';
import { StateManager, NodeManager, ErrorHandler, ErrorCode } from '../core/index.js';

const logger = createLogger('MusicManager');

export function createKazagumo(client: Client, config: Config): Kazagumo {
    let configNodes: any[] = [];
    if (Array.isArray(config.lavalink.nodes)) {
        configNodes = config.lavalink.nodes;
    } else if (typeof config.lavalink.nodes === 'object' && config.lavalink.nodes !== null) {
        configNodes = [config.lavalink.nodes];
    }

    const nodes = configNodes.map(node => ({
        name: node.name,
        url: node.url,
        auth: node.auth,
        secure: node.secure
    }));

    logger.info(`Initializing Kazagumo with ${nodes.length} nodes...`);

    // Setup Spotify plugin if credentials provided
    const plugins: any[] = [];
    if (config.spotify?.clientId && config.spotify?.clientSecret) {
        plugins.push(
            new Spotify({
                clientId: config.spotify.clientId,
                clientSecret: config.spotify.clientSecret,
                playlistPageLimit: 3, // Max 300 tracks per playlist
                albumPageLimit: 3,    // Max 150 tracks per album
                searchLimit: 10,
                searchMarket: 'VN'    // Vietnam market
            })
        );
        logger.info('Spotify plugin enabled');
    }

    const kazagumo = new Kazagumo({
        defaultSearchEngine: 'youtube_music',
        send: (guildId, payload) => {
            const guild = client.guilds.cache.get(guildId);
            if (guild) client.ws.shards.get(guild.shardId)?.send(payload);
        },
        plugins
    }, new Connectors.DiscordJS(client), nodes, {
        moveOnDisconnect: true,
        resume: true,
        reconnectTries: 5,
        restTimeout: 10000
    });

    // Initialize NodeManager with Kazagumo
    NodeManager.initialize(kazagumo, {
        selectionStrategy: { type: 'best-score' },
        healthCheckInterval: 30000,
        failureThreshold: 3,
        minHealthScore: 30
    });

    // Player events - Using StateManager
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
        StateManager.removePlayerState(player.guildId);
    });

    return kazagumo;
}

// Smart node selection using NodeManager
export function getRandomConnectedNode(kazagumo: Kazagumo): string | undefined {
    return NodeManager.selectBestNode();
}

export function getConnectedNodeNames(kazagumo: Kazagumo): string[] {
    return NodeManager.getConnectedNodes().map(n => n.name);
}

export function getLavalinkNodesStatus(kazagumo: Kazagumo): LavalinkNodeStatus[] {
    return NodeManager.getAllNodesHealth().map(h => ({
        name: h.name,
        url: h.url,
        state: h.state,
        players: h.players,
        cpu: h.cpu,
        memory: h.memory,
        uptime: h.uptime,
        ping: h.ping
    }));
}

function handleTrackStart(player: KazagumoPlayer, track: KazagumoTrack, client: Client): void {
    // Detect source from URI
    const uri = track.uri || '';
    let source = 'YouTube';
    if (uri.includes('spotify.com') || uri.includes('spotify:')) {
        source = 'Spotify';
    }

    logger.info(`[${player.shoukaku.node.name}] [${source}] Track started: ${track.title}`);

    const state = StateManager.getPlayerState(player.guildId);
    if (!state?.textChannelId) return;

    // Update state
    StateManager.updatePlayerState(player.guildId, {
        hasPlayed: true,
        isPlaying: true,
        isPaused: false,
        currentTrack: track
    });

    const channel = client.channels.cache.get(state.textChannelId);
    if (!channel?.isTextBased() || channel.isDMBased()) return;

    const loopMode = StateManager.getLoopMode(player.guildId);
    const components = createPlayerControlButtons(player, loopMode);

    // Delete previous message
    if (state.lastMessageId) {
        (channel as TextChannel).messages.delete(state.lastMessageId).catch(() => { });
        StateManager.updatePlayerState(player.guildId, { lastMessageId: null });
    }

    const embed = createCompactEmbed(track, client.user?.displayAvatarURL(), player.queue.size, player.shoukaku.node.name);

    (channel as TextChannel).send({ embeds: [embed], components })
        .then(msg => {
            StateManager.updatePlayerState(player.guildId, { lastMessageId: msg.id });
        })
        .catch(err => logger.error(`Error sending music card: ${err.message}`));

    // Sync with AnimalSync
    try {
        const syncData: PlayerSyncData = {
            eventExtend: 'event',
            guildId: player.guildId,
            voiceChannelId: player.voiceId || '',
            musicList: [track.title],
            event: { type: 'TrackStart', guildId: player.guildId, channelId: player.voiceId || '' }
        };
        AnimalSync.getInstance().sendPlayerSync(syncData);
    } catch { }
}

function handleTrackEnd(player: KazagumoPlayer): void {
    const state = StateManager.getPlayerState(player.guildId);
    if (!state) return;

    const currentTrack = player.queue.current;
    const loopMode = StateManager.getLoopMode(player.guildId);

    if (currentTrack && loopMode !== 1) {
        StateManager.addToHistory(player.guildId, currentTrack);
    }

    if (loopMode === 1 && currentTrack) {
        // Track loop - re-add current track
        const cloned = Object.assign(Object.create(Object.getPrototypeOf(currentTrack)), currentTrack);
        player.queue.add(cloned);
    } else if (loopMode === 2 && player.queue.size === 0) {
        // Queue loop - restore from snapshot
        const originalQueue = StateManager.getOriginalQueue(player.guildId);
        originalQueue.forEach(track => player.queue.add(track));
    }

    StateManager.updatePlayerState(player.guildId, { isPlaying: false });
}

function handleQueueEmpty(player: KazagumoPlayer, client: Client): void {
    // Delay check to avoid false triggers during track transitions
    setTimeout(() => {
        const state = StateManager.getPlayerState(player.guildId);
        if (!state?.textChannelId || !state.hasPlayed) return;

        // Double check that queue is actually empty and nothing is playing
        if (player.queue.current || player.playing || player.paused || player.queue.size > 0) return;

        const channel = client.channels.cache.get(state.textChannelId);
        if (!channel?.isTextBased() || channel.isDMBased()) return;

        const embed = new EmbedBuilder()
            .setDescription(`> Hết nhạc rồi! Chán quá đi mất! Muốn nghe nữa thì thêm bài vào đi!`)
            .setColor(COLORS.MAIN);

        (channel as TextChannel).send({ embeds: [embed] }).catch(() => { });
    }, 1000);
}

function createCompactEmbed(track: KazagumoTrack, botAvatarUrl?: string, queueSize?: number, nodeName?: string): EmbedBuilder {
    const minutes = Math.floor((track.length || 0) / 60000);
    const seconds = Math.floor(((track.length || 0) % 60000) / 1000);
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const authorName = track.requester ? (track.requester as any).username : 'Không rõ';
    const queueInfo = queueSize && queueSize > 0 ? `Còn **${queueSize}** bài nữa lận!` : 'Hàng chờ trống trơn!';

    // Detect source from URI
    const uri = track.uri || '';
    let source = 'Unknown';
    if (uri.includes('spotify.com') || uri.includes('spotify:')) {
        source = 'Spotify';
    } else if (uri.includes('youtube.com') || uri.includes('youtu.be')) {
        source = 'YouTube';
    } else if (uri.includes('soundcloud.com')) {
        source = 'SoundCloud';
    } else if (uri.includes('deezer.com')) {
        source = 'Deezer';
    } else if (uri.includes('music.apple.com')) {
        source = 'Apple Music';
    }

    return new EmbedBuilder()
        .setColor(COLORS.MAIN)
        .setAuthor({ name: `Đang phát nhạc giúp bạn đây!`, iconURL: botAvatarUrl })
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
        .setFooter({ text: `Animal Music • ${queueInfo}`, iconURL: botAvatarUrl })
        .setTimestamp();
}

// Legacy compatibility - Use StateManager internally
export function getPlayerData(guildId: string) {
    const state = StateManager.getPlayerState(guildId);
    if (!state) return undefined;
    return {
        textChannelId: state.textChannelId,
        loopMode: state.loopMode as LoopMode,
        history: state.history,
        originalQueue: state.originalQueue,
        lastMessageId: state.lastMessageId,
        hasPlayed: state.hasPlayed
    };
}

export function setPlayerData(guildId: string, textChannelId: string): void {
    StateManager.getOrCreatePlayerState(guildId, textChannelId);
}

export function removePlayerData(guildId: string): void {
    StateManager.removePlayerState(guildId);
}

export function setLoopMode(guildId: string, mode: LoopMode, player?: KazagumoPlayer): void {
    const queue = player ? [...player.queue] : undefined;
    const current = player?.queue.current || null;
    StateManager.setLoopMode(guildId, mode, queue, current);
}

export function getLoopMode(guildId: string): LoopMode {
    return StateManager.getLoopMode(guildId);
}
