/**
 * REST API Service for Dashboard
 * Provides HTTP endpoints for dashboard to fetch data
 * @version 3.1.0
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { createLogger } from '../utils/logger.js';
import { StateManager, NodeManager } from '../core/index.js';
import type { Config } from '../types/index.js';
import type { Kazagumo } from 'kazagumo';
import type { Client } from 'discord.js';

const logger = createLogger('RestAPI');

// ============================================
// TYPES
// ============================================

interface APIResponse {
    success: boolean;
    data?: any;
    error?: string;
}

// ============================================
// REST API CLASS
// ============================================

class RestAPIService {
    private static instance: RestAPIService | null = null;
    private server: Server | null = null;
    private kazagumo: Kazagumo | null = null;
    private client: Client | null = null;
    private config: Config | null = null;
    private apiSecret: string = '';

    private constructor() { }

    public static getInstance(): RestAPIService {
        if (!RestAPIService.instance) {
            RestAPIService.instance = new RestAPIService();
        }
        return RestAPIService.instance;
    }

    /**
     * Initialize REST API server
     */
    public initialize(config: Config, kazagumo: Kazagumo, client: Client, port: number = 3002): void {
        this.config = config;
        this.kazagumo = kazagumo;
        this.client = client;
        this.apiSecret = config.api?.secret || 'animal-music-secret';

        this.server = createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(port, () => {
            logger.info(`REST API server running on port ${port}`);
        });
    }

    /**
     * Handle incoming HTTP request
     */
    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Parse URL
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const path = url.pathname;

        // Auth check (skip for health endpoint)
        if (path !== '/api/health') {
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${this.apiSecret}`) {
                this.sendResponse(res, 401, { success: false, error: 'Unauthorized' });
                return;
            }
        }

        try {
            // Route handling
            if (path === '/api/health') {
                this.handleHealth(res);
            }
            else if (path === '/api/stats') {
                this.handleStats(res);
            }
            else if (path === '/api/restart' && req.method === 'POST') {
                this.handleRestart(res);
            }
            else if (path === '/api/nodes') {
                this.handleNodes(res);
            }
            else if (path === '/api/guilds') {
                this.handleGuilds(res);
            }
            else if (path.startsWith('/api/guilds/') && path.endsWith('/player')) {
                const guildId = path.split('/')[3];
                if (req.method === 'GET') {
                    this.handleGetPlayer(res, guildId);
                } else if (req.method === 'POST') {
                    const body = await this.parseBody(req);
                    await this.handlePlayerAction(res, guildId, body);
                }
            }
            else if (path.startsWith('/api/guilds/') && path.endsWith('/queue')) {
                const guildId = path.split('/')[3];
                this.handleGetQueue(res, guildId);
            }
            else {
                this.sendResponse(res, 404, { success: false, error: 'Not Found' });
            }
        } catch (error) {
            logger.error(`API Error: ${error}`);
            this.sendResponse(res, 500, { success: false, error: 'Internal Server Error' });
        }
    }

    /**
     * Health check endpoint
     */
    private handleHealth(res: ServerResponse): void {
        this.sendResponse(res, 200, {
            success: true,
            data: {
                status: 'ok',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: Date.now()
            }
        });
    }

    /**
     * Restart endpoint
     */
    private handleRestart(res: ServerResponse): void {
        this.sendResponse(res, 200, { success: true, data: { message: 'Restarting...' } });

        logger.info('Received restart request via API. Exiting process...');

        // Exit after a short delay to ensure response is sent
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }

    /**
     * Get bot statistics
     */
    private handleStats(res: ServerResponse): void {
        const globalStats = StateManager.getGlobalStats();
        const nodeStats = NodeManager.getStats();

        this.sendResponse(res, 200, {
            success: true,
            data: {
                bot: {
                    guilds: this.client?.guilds.cache.size || 0,
                    users: this.client?.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0) || 0,
                    uptime: this.client?.uptime || 0,
                    ping: this.client?.ws.ping || 0
                },
                players: globalStats,
                nodes: nodeStats
            }
        });
    }

    /**
     * Get all Lavalink nodes status
     */
    private handleNodes(res: ServerResponse): void {
        const nodes = NodeManager.getAllNodesHealth();
        this.sendResponse(res, 200, {
            success: true,
            data: nodes
        });
    }

    /**
     * Get all guilds with active players
     */
    private handleGuilds(res: ServerResponse): void {
        if (!this.kazagumo || !this.client) {
            this.sendResponse(res, 500, { success: false, error: 'Bot not ready' });
            return;
        }

        const guilds = [];
        for (const [guildId, player] of this.kazagumo.players) {
            const guild = this.client.guilds.cache.get(guildId);
            if (guild) {
                guilds.push({
                    id: guildId,
                    name: guild.name,
                    icon: guild.iconURL(),
                    memberCount: guild.memberCount,
                    hasPlayer: true,
                    isPlaying: player.playing,
                    isPaused: player.paused,
                    currentTrack: player.queue.current?.title || null
                });
            }
        }

        this.sendResponse(res, 200, {
            success: true,
            data: guilds
        });
    }

    /**
     * Get player state for a guild
     */
    private handleGetPlayer(res: ServerResponse, guildId: string): void {
        if (!this.kazagumo) {
            this.sendResponse(res, 500, { success: false, error: 'Bot not ready' });
            return;
        }

        const player = this.kazagumo.players.get(guildId);
        if (!player) {
            this.sendResponse(res, 404, { success: false, error: 'No player found' });
            return;
        }

        const state = StateManager.getPlayerState(guildId);
        const current = player.queue.current;

        this.sendResponse(res, 200, {
            success: true,
            data: {
                guildId,
                isPlaying: player.playing,
                isPaused: player.paused,
                volume: player.volume,
                position: player.position,
                loopMode: state?.loopMode ?? 0,
                currentTrack: current ? {
                    title: current.title,
                    author: current.author,
                    uri: current.uri,
                    thumbnail: current.thumbnail,
                    duration: current.length,
                    requester: (current.requester as any)?.username
                } : null,
                queueSize: player.queue.size
            }
        });
    }

    /**
     * Get queue for a guild
     */
    private handleGetQueue(res: ServerResponse, guildId: string): void {
        if (!this.kazagumo) {
            this.sendResponse(res, 500, { success: false, error: 'Bot not ready' });
            return;
        }

        const player = this.kazagumo.players.get(guildId);
        if (!player) {
            this.sendResponse(res, 404, { success: false, error: 'No player found' });
            return;
        }

        const queue = [...player.queue].map((track, index) => ({
            index,
            title: track.title,
            author: track.author,
            uri: track.uri,
            thumbnail: track.thumbnail,
            duration: track.length,
            requester: (track.requester as any)?.username
        }));

        this.sendResponse(res, 200, {
            success: true,
            data: {
                current: player.queue.current ? {
                    title: player.queue.current.title,
                    author: player.queue.current.author,
                    uri: player.queue.current.uri,
                    thumbnail: player.queue.current.thumbnail,
                    duration: player.queue.current.length,
                    position: player.position,
                    requester: (player.queue.current.requester as any)?.username
                } : null,
                queue,
                size: player.queue.size
            }
        });
    }

    /**
     * Handle player actions (POST)
     */
    private async handlePlayerAction(res: ServerResponse, guildId: string, body: any): Promise<void> {
        if (!this.kazagumo) {
            this.sendResponse(res, 500, { success: false, error: 'Bot not ready' });
            return;
        }

        const player = this.kazagumo.players.get(guildId);
        if (!player) {
            this.sendResponse(res, 404, { success: false, error: 'No player found' });
            return;
        }

        const action = body.action;

        try {
            switch (action) {
                case 'pause':
                    await player.pause(true);
                    break;
                case 'resume':
                    await player.pause(false);
                    break;
                case 'skip':
                    player.skip();
                    break;
                case 'stop':
                    await player.destroy();
                    break;
                case 'volume':
                    player.setVolume(body.value || 100);
                    break;
                case 'seek':
                    player.seek(body.position || 0);
                    break;
                case 'shuffle':
                    player.queue.shuffle();
                    break;
                case 'loop':
                    StateManager.setLoopMode(guildId, body.mode || 0);
                    break;
                default:
                    this.sendResponse(res, 400, { success: false, error: 'Unknown action' });
                    return;
            }

            this.sendResponse(res, 200, { success: true, data: { action, executed: true } });
        } catch (error) {
            this.sendResponse(res, 500, { success: false, error: `Action failed: ${error}` });
        }
    }

    /**
     * Parse request body
     */
    private parseBody(req: IncomingMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch (e) {
                    reject(e);
                }
            });
            req.on('error', reject);
        });
    }

    /**
     * Send JSON response
     */
    private sendResponse(res: ServerResponse, statusCode: number, data: APIResponse): void {
        res.writeHead(statusCode);
        res.end(JSON.stringify(data));
    }

    /**
     * Dispose service
     */
    public async dispose(): Promise<void> {
        if (this.server) {
            this.server.close();
        }
        logger.info('REST API disposed');
        RestAPIService.instance = null;
    }
}

export const RestAPI = RestAPIService.getInstance();
export default RestAPI;
