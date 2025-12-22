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

export async function loadCommands(): Promise<void> {
    const commandsPath = getCommandsPath();

    try {
        const commandFiles = readdirSync(commandsPath).filter(file =>
            file.endsWith('.js') && !file.includes('.map')
        );

        for (const file of commandFiles) {
            try {
                const filePath = `file://${join(commandsPath, file).replace(/\\/g, '/')}`;
                const commandModule = await import(filePath);

                // Handle both default export and named export
                const command: Command = commandModule.default?.default || commandModule.default || commandModule;

                if (command && command.name) {
                    registerCommand(command);
                } else {
                    logger.warn(`Command file ${file} does not export a valid command`);
                }
            } catch (error) {
                logger.error(`Failed to load command ${file}: ${(error as Error).message}`);
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
