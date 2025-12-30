/**
 * Core Module Exports
 * @version 3.1.0
 */

// Core Services
export { StateManager, type PlayerState, type GuildSettings } from './StateManager.js';
export { NodeManager, type NodeHealth, type NodeSelectionStrategy } from './NodeManager.js';
export { ErrorHandler, ErrorCode, type BotError } from './ErrorHandler.js';
export { QueueManager, type QueueStats } from './QueueManager.js';

// Constants
export {
    STATE_CONFIG,
    NODE_CONFIG,
    HEALTH_THRESHOLDS,
    SCORE_PENALTIES,
    QUEUE_CONFIG,
    ERROR_CONFIG
} from './constants.js';

// Types
export {
    type TrackRequester,
    type TypedTrack,
    type AudioFilters,
    type QueueSearchResult,
    type PaginatedQueue,
    type QueueOperationResult,
    type CreatePlayerOptions,
    DEFAULT_AUDIO_FILTERS,
    getRequesterId,
    getRequesterName
} from './types.js';
