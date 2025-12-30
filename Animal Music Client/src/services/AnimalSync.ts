/**
 * AnimalSync - SignalR Real-time Sync Service
 * Uses @microsoft/signalr for real-time communication between bot and dashboard
 * @version 3.1.0
 */

import * as signalR from '@microsoft/signalr';
import { createServer, Server as HttpServer } from 'http';
import { createLogger } from '../utils/logger.js';
import { StateManager, NodeManager } from '../core/index.js';
import type { Config } from '../types/index.js';
import type { Kazagumo, KazagumoPlayer } from 'kazagumo';

const logger = createLogger('AnimalSync');

// ============================================
// TYPES
// ============================================

export interface PlayerSyncData {
    guildId: string;
    isPlaying: boolean;
    isPaused: boolean;
    volume: number;
    loopMode: number;
    position: number;
    currentTrack: {
        title: string;
        author: string;
        uri: string;
        thumbnail: string | null;
        duration: number;
        requester: string;
    } | null;
    queue: {
        title: string;
        author: string;
        uri: string;
        duration: number;
        requester: string;
    }[];
    queueSize: number;
    voiceChannelId: string | null;
    textChannelId: string | null;
}

export interface DashboardCommand {
    action: 'play' | 'pause' | 'skip' | 'stop' | 'volume' | 'seek' | 'shuffle' | 'loop' | 'remove_track';
    guildId: string;
    payload?: any;
}

// ============================================
// ANIMALSYNC CLASS
// ============================================

class AnimalSyncService {
    private static instance: AnimalSyncService | null = null;
    private hubConnection: signalR.HubConnection | null = null;
    private kazagumo: Kazagumo | null = null;
    private config: Config | null = null;
    private syncInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isConnected: boolean = false;
    private botId: string = '';

    private constructor() { }

    public static getInstance(): AnimalSyncService {
        if (!AnimalSyncService.instance) {
            AnimalSyncService.instance = new AnimalSyncService();
        }
        return AnimalSyncService.instance;
    }

    /**
     * Initialize SignalR connection
     */
    public async initialize(config: Config, kazagumo: Kazagumo): Promise<void> {
        this.config = config;
        this.kazagumo = kazagumo;
        this.botId = String(config.app.clientId);

        const hubUrl = config.websocket?.url;
        if (!hubUrl) {
            logger.warn('No SignalR hub URL configured, AnimalSync disabled');
            return;
        }

        // Create SignalR connection
        this.hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl, {
                accessTokenFactory: () => config.websocket?.token || '',
                skipNegotiation: true,
                transport: signalR.HttpTransportType.WebSockets
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: (retryContext) => {
                    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
                    const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                    logger.info(`Reconnecting in ${delay / 1000}s...`);
                    return delay;
                }
            })
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        // Setup event handlers
        this.setupEventHandlers();

        // Connect
        await this.connect();

        // Start periodic sync
        this.startPeriodicSync();
    }

    /**
     * Setup SignalR event handlers
     */
    private setupEventHandlers(): void {
        if (!this.hubConnection) return;

        // Connection lifecycle events
        this.hubConnection.onreconnecting((error) => {
            this.isConnected = false;
            logger.warn(`Connection lost, reconnecting... ${error?.message || ''}`);
        });

        this.hubConnection.onreconnected((connectionId) => {
            this.isConnected = true;
            logger.info(`Reconnected with ID: ${connectionId}`);
            this.sendBotInfo();
        });

        this.hubConnection.onclose((error) => {
            this.isConnected = false;
            logger.warn(`Connection closed: ${error?.message || 'Unknown reason'}`);
            this.scheduleReconnect();
        });

        // Receive commands from dashboard
        this.hubConnection.on('ReceiveCommand', (command: DashboardCommand) => {
            this.handleCommand(command);
        });

        // Request player state
        this.hubConnection.on('RequestPlayerState', (guildId: string) => {
            this.sendPlayerState(guildId);
        });

        // Request all players
        this.hubConnection.on('RequestAllPlayers', () => {
            this.sendAllPlayerStates();
        });

        // Request node status
        this.hubConnection.on('RequestNodeStatus', () => {
            this.sendNodeStatus();
        });

        // Ping/Pong for keep-alive
        this.hubConnection.on('Ping', () => {
            this.hubConnection?.invoke('Pong', this.botId).catch(() => { });
        });
    }

    /**
     * Connect to SignalR hub
     */
    private async connect(): Promise<void> {
        if (!this.hubConnection) return;

        try {
            await this.hubConnection.start();
            this.isConnected = true;
            logger.info(`Connected to SignalR hub`);

            // Register bot with hub
            await this.sendBotInfo();
        } catch (error) {
            logger.error(`Failed to connect: ${(error as Error).message}`);
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, 5000);
    }

    /**
     * Send bot info to hub
     */
    private async sendBotInfo(): Promise<void> {
        if (!this.hubConnection || !this.isConnected) return;

        try {
            await this.hubConnection.invoke('RegisterBot', {
                botId: this.botId,
                name: 'Animal Music',
                version: '3.1.0',
                guilds: this.kazagumo?.players.size || 0,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error(`Failed to register bot: ${(error as Error).message}`);
        }
    }

    /**
     * Handle command from dashboard
     */
    private async handleCommand(command: DashboardCommand): Promise<void> {
        if (!this.kazagumo) return;

        const player = this.kazagumo.players.get(command.guildId);
        if (!player) {
            logger.warn(`No player found for guild ${command.guildId}`);
            return;
        }

        logger.info(`Executing command: ${command.action} for guild ${command.guildId}`);

        try {
            switch (command.action) {
                case 'pause':
                    await player.pause(true);
                    break;

                case 'play':
                    await player.pause(false);
                    break;

                case 'skip':
                    player.skip();
                    break;

                case 'stop':
                    await player.destroy();
                    break;

                case 'volume':
                    if (typeof command.payload?.volume === 'number') {
                        player.setVolume(command.payload.volume);
                    }
                    break;

                case 'seek':
                    if (typeof command.payload?.position === 'number') {
                        player.seek(command.payload.position);
                    }
                    break;

                case 'shuffle':
                    player.queue.shuffle();
                    break;

                case 'loop':
                    if (typeof command.payload?.mode === 'number') {
                        StateManager.setLoopMode(command.guildId, command.payload.mode);
                    }
                    break;

                case 'remove_track':
                    if (typeof command.payload?.index === 'number') {
                        const queue = [...player.queue];
                        queue.splice(command.payload.index, 1);
                        player.queue.clear();
                        queue.forEach(t => player.queue.add(t));
                    }
                    break;
            }

            // Send updated state after command
            this.sendPlayerState(command.guildId);

        } catch (error) {
            logger.error(`Failed to execute command ${command.action}: ${error}`);
        }
    }

    /**
     * Send player state to hub
     */
    public async sendPlayerState(guildId: string): Promise<void> {
        if (!this.hubConnection || !this.isConnected || !this.kazagumo) return;

        const playerData = this.getPlayerSyncData(guildId);
        if (!playerData) return;

        try {
            await this.hubConnection.invoke('SendPlayerState', playerData);
        } catch (error) {
            logger.error(`Failed to send player state: ${(error as Error).message}`);
        }
    }

    /**
     * Send all player states
     */
    public async sendAllPlayerStates(): Promise<void> {
        if (!this.kazagumo) return;

        for (const [guildId] of this.kazagumo.players) {
            await this.sendPlayerState(guildId);
        }
    }

    /**
     * Send node status to hub
     */
    public async sendNodeStatus(): Promise<void> {
        if (!this.hubConnection || !this.isConnected) return;

        try {
            const nodes = NodeManager.getAllNodesHealth();
            await this.hubConnection.invoke('SendNodeStatus', {
                botId: this.botId,
                nodes,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error(`Failed to send node status: ${(error as Error).message}`);
        }
    }

    /**
     * Send guild sync (all guilds bot is in)
     */
    public async sendGuildSync(guildIds: string[]): Promise<void> {
        if (!this.hubConnection || !this.isConnected) return;

        try {
            await this.hubConnection.invoke('SendGuildSync', {
                botId: this.botId,
                guilds: guildIds,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error(`Failed to send guild sync: ${(error as Error).message}`);
        }
    }

    /**
     * Notify track started
     */
    public async notifyTrackStart(guildId: string): Promise<void> {
        await this.sendPlayerState(guildId);
    }

    /**
     * Notify track ended
     */
    public async notifyTrackEnd(guildId: string): Promise<void> {
        await this.sendPlayerState(guildId);
    }

    /**
     * Get player sync data
     */
    private getPlayerSyncData(guildId: string): PlayerSyncData | null {
        if (!this.kazagumo) return null;

        const player = this.kazagumo.players.get(guildId);
        if (!player) return null;

        const state = StateManager.getPlayerState(guildId);
        const current = player.queue.current;

        return {
            guildId,
            isPlaying: player.playing,
            isPaused: player.paused,
            volume: player.volume,
            loopMode: state?.loopMode ?? 0,
            position: player.position,
            currentTrack: current ? {
                title: current.title,
                author: current.author || 'Unknown',
                uri: current.uri || '',
                thumbnail: current.thumbnail || null,
                duration: current.length || 0,
                requester: (current.requester as any)?.username || 'Unknown'
            } : null,
            queue: [...player.queue].slice(0, 50).map(track => ({
                title: track.title,
                author: track.author || 'Unknown',
                uri: track.uri || '',
                duration: track.length || 0,
                requester: (track.requester as any)?.username || 'Unknown'
            })),
            queueSize: player.queue.size,
            voiceChannelId: player.voiceId || null,
            textChannelId: state?.textChannelId || null
        };
    }

    /**
     * Start periodic sync
     */
    private startPeriodicSync(): void {
        this.syncInterval = setInterval(() => {
            if (this.isConnected && this.kazagumo) {
                // Sync all active players
                for (const [guildId] of this.kazagumo.players) {
                    this.sendPlayerState(guildId);
                }
                // Sync node status
                this.sendNodeStatus();
            }
        }, 10000); // Every 10 seconds
    }

    /**
     * Check if connected
     */
    public isConnectedToHub(): boolean {
        return this.isConnected;
    }

    /**
     * Dispose service
     */
    public async dispose(): Promise<void> {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }

        if (this.hubConnection) {
            try {
                await this.hubConnection.stop();
            } catch (e) {
                // Ignore
            }
        }

        this.isConnected = false;
        logger.info('AnimalSync disposed');
        AnimalSyncService.instance = null;
    }
}

export const AnimalSync = AnimalSyncService.getInstance();
export default AnimalSync;
