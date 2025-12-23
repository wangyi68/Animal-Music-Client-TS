/**
 * StateManager - Unified State Management System
 * Quản lý tập trung tất cả state của bot: players, queues, settings
 * @version 3.0.0
 */

import { EventEmitter } from 'events';
import { KazagumoTrack } from 'kazagumo';
import { createLogger } from '../utils/logger.js';
import type { LoopMode } from '../types/index.js';

const logger = createLogger('StateManager');

// ============================================
// INTERFACES & TYPES
// ============================================

export interface PlayerState {
    guildId: string;
    textChannelId: string;
    voiceChannelId: string | null;
    loopMode: LoopMode;
    volume: number;
    isPaused: boolean;
    isPlaying: boolean;
    currentTrack: KazagumoTrack | null;
    history: KazagumoTrack[];
    originalQueue: KazagumoTrack[];
    lastMessageId: string | null;
    hasPlayed: boolean;
    createdAt: number;
    lastActivityAt: number;
    // Smart features
    autoplay: boolean;
    bassBoost: number;
    nightcore: boolean;
    // Statistics
    totalTracksPlayed: number;
    totalPlaytimeMs: number;
}

export interface GuildSettings {
    guildId: string;
    prefix: string;
    djRoleId: string | null;
    announceChannel: string | null;
    defaultVolume: number;
    maxQueueSize: number;
    maxHistorySize: number;
    autoLeaveTimeout: number; // ms
    autoLeaveWhenEmpty: boolean;
    restrictToVoiceChannel: boolean;
}

export interface CacheEntry<T> {
    data: T;
    expiresAt: number;
    hits: number;
}

export type StateEvent =
    | 'playerCreated'
    | 'playerDestroyed'
    | 'playerUpdated'
    | 'trackStarted'
    | 'trackEnded'
    | 'queueUpdated'
    | 'settingsUpdated'
    | 'cacheHit'
    | 'cacheMiss';

// ============================================
// STATE MANAGER CLASS
// ============================================

class StateManagerClass extends EventEmitter {
    private static instance: StateManagerClass;

    // Core state stores
    private playerStates: Map<string, PlayerState> = new Map();
    private guildSettings: Map<string, GuildSettings> = new Map();

    // Caching system
    private searchCache: Map<string, CacheEntry<any>> = new Map();
    private trackCache: Map<string, CacheEntry<KazagumoTrack>> = new Map();

    // Configuration
    private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_CACHE_SIZE = 500;
    private readonly MAX_HISTORY_SIZE = 100;

    // Cleanup interval
    private cleanupInterval: NodeJS.Timeout | null = null;

    private constructor() {
        super();
        this.setMaxListeners(50);
        this.startCleanupJob();
        logger.info('StateManager initialized');
    }

    public static getInstance(): StateManagerClass {
        if (!StateManagerClass.instance) {
            StateManagerClass.instance = new StateManagerClass();
        }
        return StateManagerClass.instance;
    }

    // ============================================
    // PLAYER STATE MANAGEMENT
    // ============================================

    /**
     * Tạo hoặc lấy player state cho guild
     */
    public getOrCreatePlayerState(guildId: string, textChannelId: string): PlayerState {
        let state = this.playerStates.get(guildId);

        if (!state) {
            state = this.createDefaultPlayerState(guildId, textChannelId);
            this.playerStates.set(guildId, state);
            this.emit('playerCreated', state);
            logger.info(`Created player state for guild ${guildId}`);
        } else {
            // Update text channel if changed
            if (state.textChannelId !== textChannelId) {
                state.textChannelId = textChannelId;
            }
        }

        return state;
    }

    /**
     * Lấy player state (không tạo mới)
     */
    public getPlayerState(guildId: string): PlayerState | undefined {
        return this.playerStates.get(guildId);
    }

    /**
     * Cập nhật player state
     */
    public updatePlayerState(guildId: string, updates: Partial<PlayerState>): PlayerState | undefined {
        const state = this.playerStates.get(guildId);
        if (!state) return undefined;

        Object.assign(state, updates, { lastActivityAt: Date.now() });
        this.emit('playerUpdated', state);
        return state;
    }

    /**
     * Xóa player state
     */
    public removePlayerState(guildId: string): boolean {
        const state = this.playerStates.get(guildId);
        if (state) {
            this.playerStates.delete(guildId);
            this.emit('playerDestroyed', state);
            logger.info(`Removed player state for guild ${guildId}`);
            return true;
        }
        return false;
    }

    /**
     * Lấy tất cả active players
     */
    public getAllPlayerStates(): PlayerState[] {
        return Array.from(this.playerStates.values());
    }

    /**
     * Đếm số players đang active
     */
    public getActivePlayerCount(): number {
        return this.playerStates.size;
    }

    // ============================================
    // HISTORY MANAGEMENT
    // ============================================

    /**
     * Thêm track vào history
     */
    public addToHistory(guildId: string, track: KazagumoTrack): void {
        const state = this.playerStates.get(guildId);
        if (!state) return;

        // Clone track để tránh reference issues
        const clonedTrack = this.cloneTrack(track);
        state.history.push(clonedTrack);

        // Giới hạn kích thước history
        const maxHistory = this.getGuildSettings(guildId)?.maxHistorySize || this.MAX_HISTORY_SIZE;
        while (state.history.length > maxHistory) {
            state.history.shift();
        }

        state.totalTracksPlayed++;
    }

    /**
     * Lấy track từ history
     */
    public popFromHistory(guildId: string): KazagumoTrack | undefined {
        const state = this.playerStates.get(guildId);
        if (!state || state.history.length === 0) return undefined;

        return state.history.pop();
    }

    /**
     * Clone track an toàn, giữ prototype
     */
    private cloneTrack(track: KazagumoTrack): KazagumoTrack {
        return Object.assign(Object.create(Object.getPrototypeOf(track)), track);
    }

    // ============================================
    // LOOP MODE MANAGEMENT
    // ============================================

    /**
     * Set loop mode và snapshot queue nếu cần
     */
    public setLoopMode(guildId: string, mode: LoopMode, currentQueue?: KazagumoTrack[], currentTrack?: KazagumoTrack | null): void {
        const state = this.playerStates.get(guildId);
        if (!state) return;

        state.loopMode = mode;

        // Snapshot queue khi bật queue loop
        if (mode === 2 && currentQueue) {
            state.originalQueue = currentQueue.map(t => this.cloneTrack(t));
            if (currentTrack) {
                state.originalQueue.unshift(this.cloneTrack(currentTrack));
            }
        } else if (mode !== 2) {
            state.originalQueue = [];
        }

        this.emit('playerUpdated', state);
    }

    /**
     * Lấy loop mode
     */
    public getLoopMode(guildId: string): LoopMode {
        return this.playerStates.get(guildId)?.loopMode ?? 0;
    }

    /**
     * Lấy original queue cho queue loop
     */
    public getOriginalQueue(guildId: string): KazagumoTrack[] {
        const state = this.playerStates.get(guildId);
        return state?.originalQueue.map(t => this.cloneTrack(t)) || [];
    }

    // ============================================
    // GUILD SETTINGS MANAGEMENT
    // ============================================

    /**
     * Lấy hoặc tạo guild settings
     */
    public getGuildSettings(guildId: string): GuildSettings {
        let settings = this.guildSettings.get(guildId);

        if (!settings) {
            settings = this.createDefaultGuildSettings(guildId);
            this.guildSettings.set(guildId, settings);
        }

        return settings;
    }

    /**
     * Cập nhật guild settings
     */
    public updateGuildSettings(guildId: string, updates: Partial<GuildSettings>): GuildSettings {
        const settings = this.getGuildSettings(guildId);
        Object.assign(settings, updates);
        this.emit('settingsUpdated', settings);
        return settings;
    }

    // ============================================
    // CACHING SYSTEM
    // ============================================

    /**
     * Cache search results
     */
    public cacheSearchResult(query: string, result: any, ttl: number = this.DEFAULT_CACHE_TTL): void {
        // Kiểm tra giới hạn cache
        if (this.searchCache.size >= this.MAX_CACHE_SIZE) {
            this.evictOldestCacheEntries(this.searchCache, Math.floor(this.MAX_CACHE_SIZE * 0.2));
        }

        this.searchCache.set(query.toLowerCase(), {
            data: result,
            expiresAt: Date.now() + ttl,
            hits: 0
        });
    }

    /**
     * Lấy cached search result
     */
    public getCachedSearchResult(query: string): any | null {
        const entry = this.searchCache.get(query.toLowerCase());

        if (!entry) {
            this.emit('cacheMiss', { type: 'search', query });
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.searchCache.delete(query.toLowerCase());
            this.emit('cacheMiss', { type: 'search', query });
            return null;
        }

        entry.hits++;
        this.emit('cacheHit', { type: 'search', query, hits: entry.hits });
        return entry.data;
    }

    /**
     * Cache track metadata
     */
    public cacheTrack(identifier: string, track: KazagumoTrack, ttl: number = this.DEFAULT_CACHE_TTL): void {
        if (this.trackCache.size >= this.MAX_CACHE_SIZE) {
            this.evictOldestCacheEntries(this.trackCache, Math.floor(this.MAX_CACHE_SIZE * 0.2));
        }

        this.trackCache.set(identifier, {
            data: this.cloneTrack(track),
            expiresAt: Date.now() + ttl,
            hits: 0
        });
    }

    /**
     * Lấy cached track
     */
    public getCachedTrack(identifier: string): KazagumoTrack | null {
        const entry = this.trackCache.get(identifier);

        if (!entry || Date.now() > entry.expiresAt) {
            if (entry) this.trackCache.delete(identifier);
            return null;
        }

        entry.hits++;
        return this.cloneTrack(entry.data);
    }

    /**
     * Xóa các entries cũ nhất
     */
    private evictOldestCacheEntries<T>(cache: Map<string, CacheEntry<T>>, count: number): void {
        const entries = Array.from(cache.entries())
            .sort((a, b) => a[1].expiresAt - b[1].expiresAt);

        for (let i = 0; i < Math.min(count, entries.length); i++) {
            cache.delete(entries[i][0]);
        }
    }

    /**
     * Xóa toàn bộ cache
     */
    public clearCache(): void {
        this.searchCache.clear();
        this.trackCache.clear();
        logger.info('Cache cleared');
    }

    /**
     * Lấy cache statistics
     */
    public getCacheStats(): { searchCacheSize: number; trackCacheSize: number } {
        return {
            searchCacheSize: this.searchCache.size,
            trackCacheSize: this.trackCache.size
        };
    }

    // ============================================
    // STATISTICS
    // ============================================

    /**
     * Lấy thống kê tổng hợp
     */
    public getGlobalStats(): {
        totalPlayers: number;
        totalTracksPlayed: number;
        totalPlaytimeMs: number;
        cacheStats: { searchCacheSize: number; trackCacheSize: number };
    } {
        const players = this.getAllPlayerStates();
        return {
            totalPlayers: players.length,
            totalTracksPlayed: players.reduce((sum, p) => sum + p.totalTracksPlayed, 0),
            totalPlaytimeMs: players.reduce((sum, p) => sum + p.totalPlaytimeMs, 0),
            cacheStats: this.getCacheStats()
        };
    }

    // ============================================
    // CLEANUP & MAINTENANCE
    // ============================================

    /**
     * Bắt đầu job cleanup định kỳ
     */
    private startCleanupJob(): void {
        // Cleanup every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredCache();
            this.cleanupInactivePlayers();
        }, 5 * 60 * 1000);
    }

    /**
     * Cleanup expired cache entries
     */
    private cleanupExpiredCache(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.searchCache.entries()) {
            if (now > entry.expiresAt) {
                this.searchCache.delete(key);
                cleaned++;
            }
        }

        for (const [key, entry] of this.trackCache.entries()) {
            if (now > entry.expiresAt) {
                this.trackCache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info(`Cleaned ${cleaned} expired cache entries`);
        }
    }

    /**
     * Cleanup inactive players (30 phút không hoạt động)
     */
    private cleanupInactivePlayers(): void {
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

        for (const [guildId, state] of this.playerStates.entries()) {
            if (!state.isPlaying && now - state.lastActivityAt > inactiveThreshold) {
                this.removePlayerState(guildId);
                logger.info(`Cleaned up inactive player state for guild ${guildId}`);
            }
        }
    }

    /**
     * Shutdown cleanup
     */
    public dispose(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.playerStates.clear();
        this.guildSettings.clear();
        this.clearCache();
        logger.info('StateManager disposed');
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private createDefaultPlayerState(guildId: string, textChannelId: string): PlayerState {
        return {
            guildId,
            textChannelId,
            voiceChannelId: null,
            loopMode: 0,
            volume: 100,
            isPaused: false,
            isPlaying: false,
            currentTrack: null,
            history: [],
            originalQueue: [],
            lastMessageId: null,
            hasPlayed: false,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            autoplay: false,
            bassBoost: 0,
            nightcore: false,
            totalTracksPlayed: 0,
            totalPlaytimeMs: 0
        };
    }

    private createDefaultGuildSettings(guildId: string): GuildSettings {
        return {
            guildId,
            prefix: 'ish',
            djRoleId: null,
            announceChannel: null,
            defaultVolume: 100,
            maxQueueSize: 500,
            maxHistorySize: 100,
            autoLeaveTimeout: 3 * 60 * 1000, // 3 minutes
            autoLeaveWhenEmpty: true,
            restrictToVoiceChannel: false
        };
    }
}

// Export singleton instance
export const StateManager = StateManagerClass.getInstance();
export default StateManager;
