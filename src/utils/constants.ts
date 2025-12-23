/**
 * Constants v3.0
 * @version 3.0.0
 */

// Color Palette
export const COLORS = {
    MAIN: 0xFFC0CB,      // Pink - Primary brand color
    ERROR: 0xFF6B6B,     // Soft Red - Errors
    SUCCESS: 0x51CF66,   // Soft Green - Success
    WARNING: 0xFFE066,   // Yellow - Warnings
    INFO: 0x339AF0,      // Blue - Information
    NEUTRAL: 0x868E96,   // Gray - Neutral states
    PREMIUM: 0xFFD700,   // Gold - Premium features
    PLAYING: 0x7C3AED,   // Purple - Currently playing
};

// Emoji Configuration
export const EMOJIS = {
    // Status indicators
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    LOADING: '⏳',
    INFO: 'ℹ️',

    // Music icons
    MUSIC: '',
    SEARCH: '',
    TIME: '',
    USER: '',
    HEART: '',
    QUEUE_EMPTY: '',
    PLAYLIST: '',
    TRACK: '',

    // Player Controls (can be customized with Discord custom emojis)
    PREV: '',
    NEXT: '',
    PLAY: '',
    PAUSE: '',
    STOP: '',
    LOOP: '',
    SHUFFLE: '',
    VOLUME: '',

    // Node Status
    NODE_ONLINE: '🟢',
    NODE_OFFLINE: '🔴',
    NODE_CONNECTING: '🟡',
    NODE_WARNING: '🟠',
};

// Bot Configuration Constants
export const BOT_CONFIG = {
    // Queue limits
    MAX_QUEUE_SIZE: 500,
    MAX_HISTORY_SIZE: 100,

    // Timeouts (ms)
    AUTO_LEAVE_TIMEOUT: 3 * 60 * 1000,      // 3 minutes
    VOICE_CONNECT_TIMEOUT: 30 * 1000,        // 30 seconds
    SEARCH_CACHE_TTL: 5 * 60 * 1000,         // 5 minutes
    TRACK_CACHE_TTL: 10 * 60 * 1000,         // 10 minutes
    INACTIVE_CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes

    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    RETRY_BACKOFF_MULTIPLIER: 2,

    // Player defaults
    DEFAULT_VOLUME: 100,
    MAX_VOLUME: 200,
    MIN_VOLUME: 0,

    // Pagination
    QUEUE_PAGE_SIZE: 10,
    SEARCH_RESULTS_LIMIT: 10,

    // Rate limiting
    COMMAND_COOLDOWN_DEFAULT: 3,     // seconds
    SEARCH_COOLDOWN: 2,              // seconds
};

// Message Configuration
export const MESSAGE_CONFIG = {
    // Auto-delete timeouts (ms)
    ERROR_DELETE_AFTER: 8000,
    SUCCESS_DELETE_AFTER: 10000,
    INFO_DELETE_AFTER: 15000,
    SEARCH_DELETE_AFTER: 30000,

    // Maximum lengths
    MAX_EMBED_DESCRIPTION: 4096,
    MAX_FIELD_VALUE: 1024,
    MAX_TRACK_TITLE_DISPLAY: 100,
};

// Node Selection Weights (for health scoring)
export const NODE_WEIGHTS = {
    CPU: 30,           // CPU usage penalty weight
    MEMORY: 20,        // Memory usage penalty weight
    PLAYERS: 20,       // Player count penalty weight
    PING: 15,          // Ping penalty weight
    FAILURES: 15,      // Failure count penalty weight
};
