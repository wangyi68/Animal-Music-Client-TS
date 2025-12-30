/**
 * Core Module Types
 * Shared interfaces and types for core services
 * @version 3.1.0
 */

import { KazagumoTrack, KazagumoPlayer } from 'kazagumo';
import { User } from 'discord.js';

// ============================================
// TRACK TYPES
// ============================================

/**
 * Extended track requester interface
 * Replaces unsafe `(track.requester as any)` casts
 */
export interface TrackRequester {
    id: string;
    username: string;
    displayName?: string;
    discriminator?: string;
    avatar?: string | null;
    displayAvatarURL?: () => string;
}

/**
 * Typed Kazagumo Track with proper requester type
 */
export type TypedTrack = KazagumoTrack & {
    requester?: TrackRequester | User;
};

/**
 * Helper to safely get requester ID
 */
export function getRequesterId(track: KazagumoTrack): string | undefined {
    const requester = track.requester as TrackRequester | User | undefined;
    return requester?.id;
}

/**
 * Helper to safely get requester username
 */
export function getRequesterName(track: KazagumoTrack): string {
    const requester = track.requester as TrackRequester | User | undefined;
    if (!requester) return 'Unknown';

    if ('username' in requester) {
        return requester.username;
    }
    return 'Unknown';
}

// ============================================
// AUDIO FILTER TYPES
// ============================================

/**
 * Audio filter configuration
 */
export interface AudioFilters {
    /** Bass boost level (0-100) */
    bassboost: number;

    /** Nightcore effect (speed up + pitch) */
    nightcore: boolean;

    /** Vaporwave effect (slow down + pitch) */
    vaporwave: boolean;

    /** 8D audio rotation effect */
    rotation: boolean;

    /** Tremolo effect */
    tremolo: boolean;

    /** Karaoke mode (reduce vocals) */
    karaoke: boolean;

    /** Low pass filter */
    lowpass: boolean;
}

/**
 * Default audio filters
 */
export const DEFAULT_AUDIO_FILTERS: AudioFilters = {
    bassboost: 0,
    nightcore: false,
    vaporwave: false,
    rotation: false,
    tremolo: false,
    karaoke: false,
    lowpass: false
};

// ============================================
// EVENT TYPES (for typed EventEmitter in future)
// ============================================

/**
 * State Manager event payloads
 */
export interface StateManagerEventMap {
    playerCreated: { guildId: string; textChannelId: string };
    playerDestroyed: { guildId: string };
    playerUpdated: { guildId: string; changes: string[] };
    trackStarted: { guildId: string; track: KazagumoTrack };
    trackEnded: { guildId: string; track: KazagumoTrack };
    queueUpdated: { guildId: string; size: number };
    settingsUpdated: { guildId: string };
    cacheHit: { type: 'search' | 'track'; key: string; hits: number };
    cacheMiss: { type: 'search' | 'track'; key: string };
}

/**
 * Node Manager event payloads
 */
export interface NodeManagerEventMap {
    nodeReady: { name: string };
    nodeError: { name: string; error: Error };
    nodeClose: { name: string; code: number; reason: string };
    nodeDisconnect: { name: string };
    nodeReconnecting: { name: string };
    nodeUnhealthy: { name: string; reason: string };
    healthCheckComplete: { nodes: number; healthy: number };
}

/**
 * Queue Manager event payloads
 */
export interface QueueManagerEventMap {
    trackAddedNext: { guildId: string; track: KazagumoTrack };
    trackRemoved: { guildId: string; track: KazagumoTrack; index: number };
    trackMoved: { guildId: string; from: number; to: number };
    queueCleared: { guildId: string; count: number };
    queueShuffled: { guildId: string };
    queueReversed: { guildId: string };
    queueFairShuffled: { guildId: string };
}

// ============================================
// QUEUE OPERATION TYPES
// ============================================

/**
 * Result of queue search operation
 */
export interface QueueSearchResult {
    index: number;
    track: KazagumoTrack;
}

/**
 * Pagination result
 */
export interface PaginatedQueue {
    tracks: KazagumoTrack[];
    totalPages: number;
    currentPage: number;
    totalTracks: number;
}

/**
 * Queue operation result
 */
export interface QueueOperationResult {
    success: boolean;
    message?: string;
    affected?: number;
}

// ============================================
// PLAYER EXTENDED TYPES
// ============================================

/**
 * Extended player with additional metadata
 */
export interface ExtendedPlayer extends KazagumoPlayer {
    textChannelId?: string;
    lastActivity?: number;
}

/**
 * Player creation options
 */
export interface CreatePlayerOptions {
    guildId: string;
    textChannelId: string;
    voiceChannelId: string;
    deaf?: boolean;
    mute?: boolean;
    volume?: number;
}
