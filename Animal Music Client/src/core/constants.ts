/**
 * Core Module Constants
 * Centralized configuration values for core services
 * @version 3.1.0
 */

// ============================================
// STATE MANAGER CONFIGURATION
// ============================================

export const STATE_CONFIG = {
    /** Cleanup interval in milliseconds */
    CLEANUP_INTERVAL: 5 * 60 * 1000,      // 5 minutes

    /** Time before a player is considered inactive */
    INACTIVE_THRESHOLD: 30 * 60 * 1000,   // 30 minutes

    /** Default TTL for cached items */
    DEFAULT_CACHE_TTL: 5 * 60 * 1000,     // 5 minutes

    /** Maximum number of items in cache */
    MAX_CACHE_SIZE: 500,

    /** Maximum tracks to keep in history */
    MAX_HISTORY_SIZE: 100,

    /** Maximum event listeners */
    MAX_LISTENERS: 50
} as const;

// ============================================
// NODE MANAGER CONFIGURATION
// ============================================

export const NODE_CONFIG = {
    /** Health check interval in milliseconds */
    HEALTH_CHECK_INTERVAL: 30000,         // 30 seconds

    /** Maximum failures before marking node unhealthy */
    FAILURE_THRESHOLD: 3,

    /** Time to wait before retrying failed node */
    RECOVERY_TIME: 60000,                 // 1 minute

    /** Minimum health score to be considered healthy */
    MIN_HEALTH_SCORE: 30,

    /** Maximum event listeners */
    MAX_LISTENERS: 20,

    /** Initial health check delay */
    INITIAL_CHECK_DELAY: 5000             // 5 seconds
} as const;

// ============================================
// HEALTH SCORE THRESHOLDS
// ============================================

export const HEALTH_THRESHOLDS = {
    /** Player count thresholds for scoring */
    PLAYERS: {
        HIGH: 50,      // -20 points
        MEDIUM: 20,    // -10 points
        LOW: 10        // -5 points
    },

    /** CPU usage thresholds */
    CPU: {
        CRITICAL: 80,  // -30 points
        HIGH: 60,      // -20 points
        MEDIUM: 40     // -10 points
    },

    /** Memory usage percentage thresholds */
    MEMORY: {
        CRITICAL: 80,  // -20 points
        HIGH: 60       // -10 points
    },

    /** Ping latency thresholds (ms) */
    PING: {
        CRITICAL: 200, // -15 points
        HIGH: 100,     // -10 points
        MEDIUM: 50     // -5 points
    }
} as const;

// ============================================
// SCORE PENALTIES
// ============================================

export const SCORE_PENALTIES = {
    // Player count penalties
    PLAYERS_HIGH: 20,
    PLAYERS_MEDIUM: 10,
    PLAYERS_LOW: 5,

    // CPU penalties
    CPU_CRITICAL: 30,
    CPU_HIGH: 20,
    CPU_MEDIUM: 10,

    // Memory penalties
    MEMORY_CRITICAL: 20,
    MEMORY_HIGH: 10,

    // Ping penalties
    PING_CRITICAL: 15,
    PING_HIGH: 10,
    PING_MEDIUM: 5,

    // Failure penalties
    MAX_FAILURE_PENALTY: 40,
    FAILURE_MULTIPLIER: 10,

    // Recovery bonus
    RECOVERY_BONUS: 10
} as const;

// ============================================
// QUEUE CONFIGURATION
// ============================================

export const QUEUE_CONFIG = {
    /** Maximum queue size per guild */
    MAX_QUEUE_SIZE: 500,

    /** Default page size for pagination */
    DEFAULT_PAGE_SIZE: 10,

    /** Maximum page size */
    MAX_PAGE_SIZE: 25
} as const;

// ============================================
// ERROR HANDLER CONFIGURATION
// ============================================

export const ERROR_CONFIG = {
    /** Default retry count */
    DEFAULT_RETRIES: 3,

    /** Base delay between retries (ms) */
    BASE_RETRY_DELAY: 1000,

    /** Rate limit wait time (ms) */
    RATE_LIMIT_WAIT: 5000,

    /** Timeout wait time (ms) */
    TIMEOUT_WAIT: 2000
} as const;
