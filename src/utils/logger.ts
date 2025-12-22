// Simple console logger - no dependencies
export const logger = {
    info: (...args: any[]) => console.log('[INFO]', ...args),
    warn: (...args: any[]) => console.warn('[WARN]', ...args),
    error: (...args: any[]) => console.error('[ERROR]', ...args),
    debug: (...args: any[]) => console.log('[DEBUG]', ...args)
};

export function createLogger(label: string) {
    return {
        info: (...args: any[]) => console.log(`[${label}]`, ...args),
        warn: (...args: any[]) => console.warn(`[${label}]`, ...args),
        error: (...args: any[]) => console.error(`[${label}]`, ...args),
        debug: (...args: any[]) => console.log(`[${label}]`, ...args)
    };
}
