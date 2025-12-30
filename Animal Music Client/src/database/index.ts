import mongoose, { Schema } from 'mongoose';
import { createLogger } from '../utils/logger.js';
import type { GuildDocument, PrefixDocument, Config } from '../types/index.js';

const logger = createLogger('Database');

// Guild Schema
const guildSchema = new Schema<GuildDocument>({
    guildId: { type: String, required: true, unique: true },
    guildName: { type: String, required: true },
    guildOwnerId: { type: String },
    prefix: { type: String },
}, {
    timestamps: true
});

// Prefix Schema
const prefixSchema = new Schema<PrefixDocument>({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, required: true }
});

// DJ Settings Schema - Hỗ trợ cả DJ Role và DJ User IDs
export interface DJSettingsDocument {
    guildId: string;
    djRoleId: string | null;      // Role ID được phép làm DJ
    djUserIds: string[];          // Danh sách User IDs được phép làm DJ
    enabled: boolean;             // Bật/tắt DJ mode
    createdAt: Date;
    updatedAt: Date;
}

const djSettingsSchema = new Schema<DJSettingsDocument>({
    guildId: { type: String, required: true, unique: true, index: true },
    djRoleId: { type: String, default: null },
    djUserIds: { type: [String], default: [] },
    enabled: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Models
export const Guild = mongoose.model<GuildDocument>('Guild', guildSchema);
export const Prefix = mongoose.model<PrefixDocument>('Prefix', prefixSchema);
export const DJSettings = mongoose.model<DJSettingsDocument>('DJSettings', djSettingsSchema);

// Database connection
let isConnected = false;

export async function connectDatabase(config: Config): Promise<void> {
    if (isConnected) {
        logger.warn('Database is already connected');
        return;
    }

    try {

        await mongoose.connect(config.mongodb.uri, {
            dbName: 'animal_music',
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        isConnected = true;
        logger.info('Database connected successfully');

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
            isConnected = false;
        });

        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB error: ${err.message}`);
        });

    } catch (error) {
        logger.error(`Failed to connect to database: ${(error as Error).message}`);
        throw error;
    }
}

export async function disconnectDatabase(): Promise<void> {
    if (!isConnected) {
        logger.warn('Database is not connected');
        return;
    }

    try {
        await mongoose.disconnect();
        isConnected = false;
        logger.info('Database disconnected successfully');
    } catch (error) {
        logger.error(`Failed to disconnect database: ${(error as Error).message}`);
    }
}

export function isDatabaseConnected(): boolean {
    return isConnected && mongoose.connection.readyState === 1;
}

// Prefix operations
export async function getGuildPrefix(guildId: string): Promise<string | null> {
    try {
        const prefix = await Prefix.findOne({ guildId });
        return prefix?.prefix || null;
    } catch (error) {
        // logger.error(`Error getting prefix for guild ${guildId}: ${(error as Error).message}`);
        return null;
    }
}

export async function setGuildPrefix(guildId: string, prefix: string): Promise<boolean> {
    try {
        await Prefix.findOneAndUpdate(
            { guildId },
            { guildId, prefix },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        logger.error(`Error setting prefix for guild ${guildId}: ${(error as Error).message}`);
        return false;
    }
}

// Guild operations
export async function upsertGuild(guildId: string, guildName: string, ownerId?: string): Promise<void> {
    try {
        await Guild.findOneAndUpdate(
            { guildId },
            {
                guildId,
                guildName,
                guildOwnerId: ownerId
            },
            { upsert: true, new: true }
        );
    } catch (error) {
        logger.error(`Error upserting guild ${guildId}: ${(error as Error).message}`);
    }
}

// ============================================
// DJ SETTINGS OPERATIONS
// ============================================

/**
 * Lấy DJ settings cho guild
 */
export async function getDJSettings(guildId: string): Promise<DJSettingsDocument | null> {
    try {
        return await DJSettings.findOne({ guildId });
    } catch (error) {
        logger.error(`Error getting DJ settings for guild ${guildId}: ${(error as Error).message}`);
        return null;
    }
}

/**
 * Lấy DJ Role ID (legacy support)
 */
export async function getDJRole(guildId: string): Promise<string | null> {
    try {
        const settings = await DJSettings.findOne({ guildId });
        return settings?.enabled ? settings.djRoleId : null;
    } catch (error) {
        return null;
    }
}

/**
 * Set DJ Role cho guild
 */
export async function setDJRole(guildId: string, roleId: string | null): Promise<boolean> {
    try {
        await DJSettings.findOneAndUpdate(
            { guildId },
            {
                guildId,
                djRoleId: roleId,
                enabled: roleId !== null
            },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        logger.error(`Error setting DJ role for guild ${guildId}: ${(error as Error).message}`);
        return false;
    }
}

/**
 * Thêm DJ User vào danh sách
 */
export async function addDJUser(guildId: string, userId: string): Promise<boolean> {
    try {
        await DJSettings.findOneAndUpdate(
            { guildId },
            {
                guildId,
                $addToSet: { djUserIds: userId },
                enabled: true
            },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        logger.error(`Error adding DJ user for guild ${guildId}: ${(error as Error).message}`);
        return false;
    }
}

/**
 * Xóa DJ User khỏi danh sách
 */
export async function removeDJUser(guildId: string, userId: string): Promise<boolean> {
    try {
        await DJSettings.findOneAndUpdate(
            { guildId },
            { $pull: { djUserIds: userId } }
        );
        return true;
    } catch (error) {
        logger.error(`Error removing DJ user for guild ${guildId}: ${(error as Error).message}`);
        return false;
    }
}

/**
 * Kiểm tra user có phải DJ không (theo User ID)
 */
export async function isDJUser(guildId: string, userId: string): Promise<boolean> {
    try {
        const settings = await DJSettings.findOne({ guildId });
        if (!settings?.enabled) return false;
        return settings.djUserIds.includes(userId);
    } catch (error) {
        return false;
    }
}

/**
 * Bật/tắt DJ mode
 */
export async function setDJEnabled(guildId: string, enabled: boolean): Promise<boolean> {
    try {
        await DJSettings.findOneAndUpdate(
            { guildId },
            { guildId, enabled },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        logger.error(`Error toggling DJ mode for guild ${guildId}: ${(error as Error).message}`);
        return false;
    }
}

/**
 * Reset DJ settings về mặc định
 */
export async function resetDJSettings(guildId: string): Promise<boolean> {
    try {
        await DJSettings.findOneAndUpdate(
            { guildId },
            {
                guildId,
                djRoleId: null,
                djUserIds: [],
                enabled: false
            },
            { upsert: true, new: true }
        );
        return true;
    } catch (error) {
        logger.error(`Error resetting DJ settings for guild ${guildId}: ${(error as Error).message}`);
        return false;
    }
}

