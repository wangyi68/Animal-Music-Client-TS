import mongoose, { Schema, Document, Model } from 'mongoose';
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

// Models
export const Guild = mongoose.model<GuildDocument>('Guild', guildSchema);
export const Prefix = mongoose.model<PrefixDocument>('Prefix', prefixSchema);

// Database connection
let isConnected = false;

export async function connectDatabase(config: Config): Promise<void> {
    if (isConnected) {
        logger.warn('Database is already connected');
        return;
    }

    try {

        await mongoose.connect(config.mongodb.uri, {
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
