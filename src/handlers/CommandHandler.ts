import { Collection, PermissionResolvable } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';
import { createLogger } from '../utils/logger.js';
import type { Command, CommandConfig, CommandContext, CommandResult } from '../types/index.js';

const logger = createLogger('CommandHandler');

// Default command config
export function createCommandConfig(overrides: Partial<CommandConfig> = {}): CommandConfig {
    return {
        category: 'general',
        usage: '',
        cooldown: 3,
        voiceChannel: false,
        requireUserPermissions: [],
        requireBotPermissions: [],
        ...overrides
    };
}

// Command registry
export const commands = new Collection<string, Command>();
export const aliases = new Collection<string, string>();
const cooldowns = new Map<string, Map<string, number>>();

export function registerCommand(command: Command): void {
    if (!command || !command.name) {
        logger.error('Invalid command object');
        return;
    }
    commands.set(command.name.toLowerCase(), command);
    command.aliases.forEach(alias => {
        aliases.set(alias.toLowerCase(), command.name.toLowerCase());
    });
    // logger.info(`Registered command: ${command.name}`);
}

export function getCommand(name: string): Command | undefined {
    const commandName = aliases.get(name.toLowerCase()) ?? name.toLowerCase();
    return commands.get(commandName);
}

// Get commands path relative to dist folder
function getCommandsPath(): string {
    return join(process.cwd(), 'dist', 'commands');
}

// Get all .js files recursively from a directory
function getAllCommandFiles(dir: string): string[] {
    const files: string[] = [];

    try {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                // Recursively get files from subdirectories
                files.push(...getAllCommandFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.includes('.map')) {
                files.push(fullPath);
            }
        }
    } catch (error) {
        logger.error(`Error reading directory ${dir}: ${(error as Error).message}`);
    }

    return files;
}

export async function loadCommands(): Promise<void> {
    const commandsPath = getCommandsPath();

    try {
        const commandFiles = getAllCommandFiles(commandsPath);

        for (const filePath of commandFiles) {
            try {
                const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
                const commandModule = await import(fileUrl);

                // Handle both default export and named export
                const command: Command = commandModule.default?.default || commandModule.default || commandModule;

                if (command && command.name) {
                    registerCommand(command);
                } else {
                    const fileName = filePath.split(/[/\\]/).pop();
                    logger.warn(`Command file ${fileName} does not export a valid command`);
                }
            } catch (error) {
                const fileName = filePath.split(/[/\\]/).pop();
                logger.error(`Failed to load command ${fileName}: ${(error as Error).message}`);
            }
        }

        logger.info(`Loaded ${commands.size} commands`);
    } catch (error) {
        logger.error(`Failed to load commands directory: ${(error as Error).message}`);
    }
}

// Cooldown check
export function checkCooldown(userId: string, commandName: string, cooldownSeconds: number): number | null {
    if (!cooldowns.has(commandName)) {
        cooldowns.set(commandName, new Map());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(commandName)!;
    const cooldownAmount = cooldownSeconds * 1000;

    if (timestamps.has(userId)) {
        const expirationTime = timestamps.get(userId)! + cooldownAmount;
        if (now < expirationTime) {
            return (expirationTime - now) / 1000;
        }
    }

    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);
    return null;
}

// Permission check
export function checkPermissions(
    context: CommandContext,
    userPerms: PermissionResolvable[],
    botPerms: PermissionResolvable[]
): { valid: boolean; missing: string[] } {
    const member = context.message.member;
    const botMember = context.message.guild?.members.me;

    if (!member || !botMember) {
        return { valid: false, missing: ['Cannot check permissions'] };
    }

    const missingUserPerms = userPerms.filter(perm => !member.permissions.has(perm));
    const missingBotPerms = botPerms.filter(perm => !botMember.permissions.has(perm));

    const missing = [...missingUserPerms, ...missingBotPerms].map(p => String(p));

    return { valid: missing.length === 0, missing };
}
