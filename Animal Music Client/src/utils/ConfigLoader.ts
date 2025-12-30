import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { Config } from '../types/index.js';
import { createLogger } from './logger.js';

const logger = createLogger('ConfigLoader');

/**
 * Supported config file formats
 */
export type ConfigFormat = 'json' | 'yaml' | 'yml';

/**
 * Config file priority order (first found will be used)
 */
const CONFIG_FILES: { name: string; format: ConfigFormat }[] = [
    { name: 'config.yaml', format: 'yaml' },
    { name: 'config.yml', format: 'yml' },
    { name: 'config.json', format: 'json' }
];

/**
 * Parse config content based on format
 */
function parseConfig(content: string, format: ConfigFormat): Config {
    switch (format) {
        case 'yaml':
        case 'yml':
            return parseYaml(content) as Config;
        case 'json':
            return JSON.parse(content) as Config;
        default:
            throw new Error(`Unsupported config format: ${format}`);
    }
}

/**
 * Validate required config fields
 */
function validateConfig(config: Config): void {
    const errors: string[] = [];

    // Required: app section
    if (!config.app) {
        errors.push('Missing "app" section');
    } else {
        if (!config.app.token) errors.push('Missing "app.token"');
        if (!config.app.prefix) errors.push('Missing "app.prefix"');
        if (!config.app.clientId) errors.push('Missing "app.clientId"');
        if (!config.app.ownerId) errors.push('Missing "app.ownerId"');
    }

    // Required: lavalink section
    if (!config.lavalink) {
        errors.push('Missing "lavalink" section');
    } else {
        if (!config.lavalink.nodes || config.lavalink.nodes.length === 0) {
            errors.push('Missing or empty "lavalink.nodes" array');
        } else {
            config.lavalink.nodes.forEach((node, index) => {
                if (!node.name) errors.push(`Missing "name" in lavalink node ${index}`);
                if (!node.url) errors.push(`Missing "url" in lavalink node ${index}`);
                if (!node.auth) errors.push(`Missing "auth" in lavalink node ${index}`);
            });
        }
    }

    // Optional but warn if missing
    if (!config.mongodb?.uri) {
        logger.warn('MongoDB URI not configured - using in-memory storage');
    }

    if (errors.length > 0) {
        throw new Error(`Config validation failed:\n  - ${errors.join('\n  - ')}`);
    }
}

/**
 * Load configuration from file
 * Supports: config.yaml, config.yml, config.json (in priority order)
 */
export function loadConfig(basePath?: string): Config {
    const baseDir = basePath || process.cwd();

    // Find first available config file
    let configPath: string | null = null;
    let configFormat: ConfigFormat | null = null;

    for (const { name, format } of CONFIG_FILES) {
        const path = join(baseDir, name);
        if (existsSync(path)) {
            configPath = path;
            configFormat = format;
            logger.info(`Found config file: ${name}`);
            break;
        }
    }

    if (!configPath || !configFormat) {
        const fileList = CONFIG_FILES.map(f => f.name).join(', ');
        logger.error(`No config file found! Searched for: ${fileList}`);
        logger.error('Copy config.example.json or config.example.yaml and fill in your values.');
        process.exit(1);
    }

    try {
        const content = readFileSync(configPath, 'utf-8');
        const config = parseConfig(content, configFormat);

        // Validate config
        validateConfig(config);

        logger.info(`Config loaded successfully (${configFormat.toUpperCase()} format)`);
        return config;
    } catch (error) {
        if (error instanceof SyntaxError) {
            logger.error(`Failed to parse config file: ${error.message}`);
        } else {
            logger.error(`Failed to load config: ${(error as Error).message}`);
        }
        process.exit(1);
    }
}

/**
 * Get example path for creating a new config
 */
export function getExampleConfigPath(format: ConfigFormat = 'yaml'): string {
    const ext = format === 'yml' ? 'yml' : format;
    return join(process.cwd(), `config.example.${ext}`);
}
