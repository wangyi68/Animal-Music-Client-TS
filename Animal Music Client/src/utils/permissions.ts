/**
 * Permission Utilities - DJ Role System
 * Kiểm tra quyền điều khiển bot cho users
 * Hỗ trợ cả DJ Role và DJ User IDs
 * @version 3.1.0
 */

import { GuildMember, User, VoiceBasedChannel, PermissionFlagsBits } from 'discord.js';
import { getDJSettings } from '../database/index.js';

export type PermissionLevel = 'owner' | 'admin' | 'dj_role' | 'dj_user' | 'requester' | 'alone' | 'member';

export interface PermissionCheckResult {
    allowed: boolean;
    level: PermissionLevel;
    reason?: string;
}

export interface PermissionContext {
    member: GuildMember;
    requester?: User | null;
    voiceChannel?: VoiceBasedChannel | null;
    ownerId?: string;
}

/**
 * Các action cần kiểm tra quyền DJ
 */
export const DJ_ACTIONS = [
    'stop',
    'skip',
    'pause',
    'resume',
    'volume',
    'loop',
    'shuffle',
    'clear',
    'move',
    'remove',
    'seek',
    'replay',
    'fairshuffle',
    'playnext'
] as const;

export type DJAction = typeof DJ_ACTIONS[number];

/**
 * Kiểm tra xem user có quyền DJ không
 * Thứ tự ưu tiên: Bot Owner > Admin > DJ Role > DJ User > Requester > Alone in VC
 */
export async function checkDJPermission(
    context: PermissionContext,
    _action?: DJAction
): Promise<PermissionCheckResult> {
    const { member, requester, voiceChannel, ownerId } = context;

    // 1. Bot Owner - Full access
    if (ownerId && member.id === ownerId) {
        return { allowed: true, level: 'owner' };
    }

    // 2. Administrator Permission - Full access
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        return { allowed: true, level: 'admin' };
    }

    // 3. Manage Guild Permission - Like Admin
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return { allowed: true, level: 'admin' };
    }

    // 4. Check DJ Settings from database
    const djSettings = await getDJSettings(member.guild.id);

    if (djSettings?.enabled) {
        // 4a. Check DJ Role
        if (djSettings.djRoleId && member.roles.cache.has(djSettings.djRoleId)) {
            return { allowed: true, level: 'dj_role' };
        }

        // 4b. Check DJ User ID
        if (djSettings.djUserIds.includes(member.id)) {
            return { allowed: true, level: 'dj_user' };
        }

        // If DJ mode is enabled but user doesn't have DJ access
        // Still check requester and alone conditions below
    }

    // 5. Is the song requester - Can control their own songs
    if (requester && member.id === requester.id) {
        return { allowed: true, level: 'requester' };
    }

    // 6. Alone in voice channel - Can control when no one else is listening
    if (voiceChannel) {
        const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
        if (humanMembers.size === 1 && humanMembers.has(member.id)) {
            return { allowed: true, level: 'alone' };
        }
    }

    // No permission - Generate appropriate message
    let reason = 'Bạn không có quyền điều khiển bot! Cần Admin hoặc DJ~';

    if (djSettings?.enabled) {
        const parts: string[] = [];
        if (djSettings.djRoleId) {
            parts.push(`role <@&${djSettings.djRoleId}>`);
        }
        if (djSettings.djUserIds.length > 0) {
            parts.push('được thêm vào danh sách DJ');
        }
        if (parts.length > 0) {
            reason = `Bạn cần có ${parts.join(' hoặc ')} để dùng lệnh này!`;
        }
    }

    return {
        allowed: false,
        level: 'member',
        reason
    };
}

/**
 * Quick check - Có quyền DJ cơ bản không (không async)
 * Dùng cho các case không cần check database
 */
export function hasBasicDJPermission(member: GuildMember, ownerId?: string): boolean {
    // Owner hoặc Admin
    if (ownerId && member.id === ownerId) return true;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
    return false;
}

/**
 * Kiểm tra xem action có cần quyền DJ không
 */
export function isDJAction(action: string): action is DJAction {
    return DJ_ACTIONS.includes(action as DJAction);
}

/**
 * Format permission level thành text đẹp
 */
export function formatPermissionLevel(level: PermissionLevel): string {
    const levels: Record<PermissionLevel, string> = {
        owner: 'Bot Owner',
        admin: 'Administrator',
        dj_role: 'DJ Role',
        dj_user: 'DJ User',
        requester: 'Song Requester',
        alone: 'Alone in VC',
        member: 'Member'
    };
    return levels[level];
}

/**
 * Tạo message khi không có quyền
 */
export function getNoPermissionMessage(result: PermissionCheckResult): string {
    if (result.reason) return result.reason;
    return 'Hứ! Bạn không có quyền điều khiển bot đâu! Cần Admin hoặc xin DJ đi~';
}
