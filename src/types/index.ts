import {
    Client,
    Message,
    ChatInputCommandInteraction,
    Collection,
    PermissionResolvable,
    SlashCommandBuilder,
    AutocompleteInteraction
} from 'discord.js';
import { Kazagumo, KazagumoPlayer } from 'kazagumo';

// Config types
export interface AppConfig {
    token: string;
    prefix: string;
    clientId: number;
    ownerId: string;
}

export interface LavalinkNodeConfig {
    name: string;
    url: string;
    auth: string;
    secure: boolean;
}

// Lavalink node status for monitoring
export interface LavalinkNodeStatus {
    name: string;
    url: string;
    state: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING';
    players: number;
    cpu: number;
    memory: {
        used: number;
        free: number;
        allocated: number;
        reservable: number;
    };
    uptime: number;
    ping: number;
}

export interface LavalinkConfig {
    nodes: LavalinkNodeConfig[];
}

export interface MongoDBConfig {
    uri: string;
}

export interface WebSocketConfig {
    url: string;
    secret: string;
}

export interface SpotifyConfig {
    clientId: string;
    clientSecret: string;
}

export interface Config {
    app: AppConfig;
    lavalink: LavalinkConfig;
    mongodb: MongoDBConfig;
    websocket?: WebSocketConfig;
    spotify?: SpotifyConfig;
}

// Command types
export interface CommandConfig {
    category: string;
    usage: string;
    cooldown: number; // in seconds
    voiceChannel: boolean;
    requireUserPermissions: PermissionResolvable[];
    requireBotPermissions: PermissionResolvable[];
}

// Prefix Command Context
export interface CommandContext {
    message: Message;
    args: string[];
    rawArgs: string;
    prefix: string;
    isMentionPrefix: boolean;
}

// Slash Command Context  
export interface SlashCommandContext {
    interaction: ChatInputCommandInteraction;
}

// Unified Command interface supporting both prefix and slash
export interface Command {
    name: string;
    description: string;
    aliases: string[];
    config: CommandConfig;
    // Slash command data builder
    slashCommand?: SlashCommandBuilder;
    // Execute for prefix commands
    execute(context: CommandContext): Promise<CommandResult>;
    // Execute for slash commands (optional, falls back to prefix handler)
    executeSlash?(context: SlashCommandContext): Promise<CommandResult>;
    // Autocomplete handler
    autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export type CommandResult =
    | { type: 'success' }
    | { type: 'error'; message: string }
    | { type: 'cooldown'; remainingTime: number }
    | { type: 'insufficientPermissions' }
    | { type: 'invalidArguments' };

// Bot Client extension
export interface BotClient extends Client {
    commands: Collection<string, Command>;
    aliases: Collection<string, string>;
    kazagumo: Kazagumo;
    config: Config;
}

// Music types
export enum LoopMode {
    NONE = 0,
    TRACK = 1,
    QUEUE = 2
}

export interface GuildMusicData {
    player: KazagumoPlayer | null;
    textChannelId: string | null;
    loopMode: LoopMode;
}

// Player Sync types (for AnimalSync)
export interface PlayerEvent {
    type: string;
    guildId: string;
    channelId: string;
}

export interface PlayerUpdateState {
    connected: boolean;
    position: number;
    time: number;
}

export interface PlayerSyncData {
    eventExtend: string;
    guildId: string;
    voiceChannelId: string;
    musicList?: string[];
    stats?: Record<string, any>;
    event?: PlayerEvent;
    state?: PlayerUpdateState;
}

// Database types
export interface GuildDocument {
    guildId: string;
    guildName: string;
    guildOwnerId?: string;
    prefix?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface PrefixDocument {
    guildId: string;
    prefix: string;
}
