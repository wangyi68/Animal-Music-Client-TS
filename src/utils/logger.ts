/**
 * Enhanced Logger v3.0
 * @version 3.0.0
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

const LEVEL_COLORS: Record<LogLevel, string> = {
    [LogLevel.DEBUG]: '\x1b[90m', // Gray
    [LogLevel.INFO]: '\x1b[36m',  // Cyan
    [LogLevel.WARN]: '\x1b[33m',  // Yellow
    [LogLevel.ERROR]: '\x1b[31m'  // Red
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let minLevel: LogLevel = LogLevel.INFO;

function formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').split('.')[0];
}

function formatMessage(level: LogLevel, label: string, ...args: any[]): string {
    const levelName = LogLevel[level].padEnd(5);
    const color = LEVEL_COLORS[level];
    const timestamp = formatTimestamp();
    const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    return `${BOLD}[${timestamp}]${RESET} ${color}[${levelName}]${RESET} ${BOLD}[${label}]${RESET} ${message}`;
}

function log(level: LogLevel, label: string, ...args: any[]): void {
    if (level < minLevel) return;

    const message = formatMessage(level, label, ...args);

    switch (level) {
        case LogLevel.ERROR:
            console.error(message);
            break;
        case LogLevel.WARN:
            console.warn(message);
            break;
        default:
            console.log(message);
    }
}

export const logger = {
    debug: (...args: any[]) => log(LogLevel.DEBUG, 'App', ...args),
    info: (...args: any[]) => log(LogLevel.INFO, 'App', ...args),
    warn: (...args: any[]) => log(LogLevel.WARN, 'App', ...args),
    error: (...args: any[]) => log(LogLevel.ERROR, 'App', ...args)
};

export function createLogger(label: string) {
    return {
        debug: (...args: any[]) => log(LogLevel.DEBUG, label, ...args),
        info: (...args: any[]) => log(LogLevel.INFO, label, ...args),
        warn: (...args: any[]) => log(LogLevel.WARN, label, ...args),
        error: (...args: any[]) => log(LogLevel.ERROR, label, ...args)
    };
}

export function setLogLevel(level: LogLevel): void {
    minLevel = level;
}

export function getLogLevel(): LogLevel {
    return minLevel;
}
