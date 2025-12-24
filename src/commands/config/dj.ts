/**
 * DJ Command - Quản lý DJ Role System
 * Cho phép set DJ Role hoặc thêm/xóa DJ Users
 * @version 3.1.0
 */

import {
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    Role,
    User
} from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import {
    getDJSettings,
    setDJRole,
    addDJUser,
    removeDJUser,
    setDJEnabled,
    resetDJSettings
} from '../../database/index.js';
import type { Command, CommandContext, CommandResult, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets, MessageType } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'dj',
    description: 'Quản lý hệ thống DJ - Quyền điều khiển bot',
    aliases: ['djrole', 'djuser', 'djsettings'],
    config: createCommandConfig({
        category: 'config',
        usage: 'dj <role|user|status|reset> [target]',
        cooldown: 5,
        requireUserPermissions: [PermissionFlagsBits.ManageGuild]
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('dj')
        .setDescription('Quản lý hệ thống DJ - Quyền điều khiển bot')
        .addSubcommand(sub =>
            sub.setName('role')
                .setDescription('Set DJ Role cho server')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role được phép làm DJ (bỏ trống để xóa)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Thêm user vào danh sách DJ')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User được thêm quyền DJ')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Xóa user khỏi danh sách DJ')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('User bị xóa quyền DJ')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Xem trạng thái DJ settings hiện tại')
        )
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Bật/tắt DJ mode')
                .addBooleanOption(opt =>
                    opt.setName('enabled')
                        .setDescription('Bật hoặc tắt DJ mode')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset DJ settings về mặc định')
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message, args } = context;

        if (args.length === 0) {
            return await showStatus(message.guild!.id, message);
        }

        const subcommand = args[0].toLowerCase();

        switch (subcommand) {
            case 'role':
                // Try to find mentioned role
                const roleId = message.mentions.roles.first()?.id || args[1];
                if (!roleId) {
                    return await setRole(message.guild!.id, null, message);
                }
                return await setRole(message.guild!.id, roleId, message);

            case 'add':
                const addUserId = message.mentions.users.first()?.id || args[1];
                if (!addUserId) {
                    const embed = new EmbedBuilder()
                        .setDescription('> Hảả?! Mention user hoặc ghi ID đi! Tớ biết thêm ai?!')
                        .setColor(COLORS.ERROR);
                    const msg = await message.reply({ embeds: [embed] });
                    smartDelete(msg, DeletePresets.COMMAND_ERROR);
                    return { type: 'invalidArguments' };
                }
                return await addUser(message.guild!.id, addUserId, message);

            case 'remove':
                const removeUserId = message.mentions.users.first()?.id || args[1];
                if (!removeUserId) {
                    const embed = new EmbedBuilder()
                        .setDescription('> Hảả?! Mention user hoặc ghi ID đi! Tớ biết xóa ai?!')
                        .setColor(COLORS.ERROR);
                    const msg = await message.reply({ embeds: [embed] });
                    smartDelete(msg, DeletePresets.COMMAND_ERROR);
                    return { type: 'invalidArguments' };
                }
                return await removeUser(message.guild!.id, removeUserId, message);

            case 'toggle':
                const enabled = args[1]?.toLowerCase() === 'on' || args[1]?.toLowerCase() === 'true';
                return await toggleDJ(message.guild!.id, enabled, message);

            case 'reset':
                return await resetDJ(message.guild!.id, message);

            case 'status':
            default:
                return await showStatus(message.guild!.id, message);
        }
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        switch (subcommand) {
            case 'role':
                const role = interaction.options.getRole('role') as Role | null;
                return await setRole(guildId, role?.id || null, null, interaction);

            case 'add':
                const addUser_ = interaction.options.getUser('user', true);
                return await addUser(guildId, addUser_.id, null, interaction, addUser_);

            case 'remove':
                const removeUser_ = interaction.options.getUser('user', true);
                return await removeUser(guildId, removeUser_.id, null, interaction, removeUser_);

            case 'toggle':
                const enabled = interaction.options.getBoolean('enabled', true);
                return await toggleDJ(guildId, enabled, null, interaction);

            case 'reset':
                return await resetDJ(guildId, null, interaction);

            case 'status':
            default:
                return await showStatus(guildId, null, interaction);
        }
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function setRole(
    guildId: string,
    roleId: string | null,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const success = await setDJRole(guildId, roleId);

    if (!success) {
        const embed = new EmbedBuilder()
            .setDescription('> Ư... Có lỗi gì đó rồi! Không set được DJ Role đâu!')
            .setColor(COLORS.ERROR);

        if (interaction) {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: 'Failed to set DJ role' };
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'CẬP NHẬT DJ ROLE' })
        .setDescription(roleId
            ? `> Hứ, tớ đã set DJ Role thành <@&${roleId}> rồi đấy!\n> Ai có role này sẽ được quyền điều khiển bot nha~`
            : '> Đã xóa DJ Role rồi nha! Giờ chỉ Admin mới điều khiển được thôi~'
        )
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: 'DJ Role System • Animal Music' });

    if (interaction) {
        await interaction.reply({ embeds: [embed] });
    } else if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS });
    }

    return { type: 'success' };
}

async function addUser(
    guildId: string,
    userId: string,
    message?: any,
    interaction?: any,
    user?: User
): Promise<CommandResult> {
    const success = await addDJUser(guildId, userId);

    if (!success) {
        const embed = new EmbedBuilder()
            .setDescription('> Ư... Có lỗi gì đó rồi! Không thêm được DJ User đâu!')
            .setColor(COLORS.ERROR);

        if (interaction) {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: 'Failed to add DJ user' };
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'THÊM DJ USER' })
        .setDescription(`> Đã thêm <@${userId}> vào danh sách DJ rồi nha!\n> Giờ người này có thể điều khiển bot đó~`)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: 'DJ Role System • Animal Music' });

    if (user) {
        embed.setThumbnail(user.displayAvatarURL());
    }

    if (interaction) {
        await interaction.reply({ embeds: [embed] });
    } else if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS });
    }

    return { type: 'success' };
}

async function removeUser(
    guildId: string,
    userId: string,
    message?: any,
    interaction?: any,
    user?: User
): Promise<CommandResult> {
    const success = await removeDJUser(guildId, userId);

    if (!success) {
        const embed = new EmbedBuilder()
            .setDescription('> Ư... Có lỗi gì đó rồi! Không xóa được DJ User đâu!')
            .setColor(COLORS.ERROR);

        if (interaction) {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: 'Failed to remove DJ user' };
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'XÓA DJ USER' })
        .setDescription(`> Đã xóa <@${userId}> khỏi danh sách DJ rồi!\n> Bye bye quyền DJ~`)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: 'DJ Role System • Animal Music' });

    if (user) {
        embed.setThumbnail(user.displayAvatarURL());
    }

    if (interaction) {
        await interaction.reply({ embeds: [embed] });
    } else if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS });
    }

    return { type: 'success' };
}

async function toggleDJ(
    guildId: string,
    enabled: boolean,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const success = await setDJEnabled(guildId, enabled);

    if (!success) {
        const embed = new EmbedBuilder()
            .setDescription('> Ư... Có lỗi gì đó rồi! Không toggle được DJ mode đâu!')
            .setColor(COLORS.ERROR);

        if (interaction) {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: 'Failed to toggle DJ mode' };
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: enabled ? 'BẬT DJ MODE' : 'TẮT DJ MODE' })
        .setDescription(enabled
            ? '> DJ Mode đã được **BẬT**!\n> Giờ chỉ DJ Role/User mới điều khiển được bot nha~'
            : '> DJ Mode đã được **TẮT**!\n> Ai cũng có thể điều khiển bot rồi~'
        )
        .setColor(enabled ? COLORS.SUCCESS : COLORS.WARNING)
        .setFooter({ text: 'DJ Role System • Animal Music' });

    if (interaction) {
        await interaction.reply({ embeds: [embed] });
    } else if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS });
    }

    return { type: 'success' };
}

async function resetDJ(
    guildId: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const success = await resetDJSettings(guildId);

    if (!success) {
        const embed = new EmbedBuilder()
            .setDescription('> Ư... Có lỗi gì đó rồi! Không reset được DJ settings đâu!')
            .setColor(COLORS.ERROR);

        if (interaction) {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: 'Failed to reset DJ settings' };
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'RESET DJ SETTINGS' })
        .setDescription('> Đã reset DJ settings về mặc định rồi nha!\n> DJ Role và DJ Users đã được xóa hết~')
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: 'DJ Role System • Animal Music' });

    if (interaction) {
        await interaction.reply({ embeds: [embed] });
    } else if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS });
    }

    return { type: 'success' };
}

async function showStatus(
    guildId: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const settings = await getDJSettings(guildId);

    const embed = new EmbedBuilder()
        .setAuthor({ name: '🎧 DJ SETTINGS' })
        .setColor(COLORS.MAIN)
        .setFooter({ text: 'DJ Role System • Animal Music' });

    if (!settings || !settings.enabled) {
        embed.setDescription('> DJ Mode hiện đang **TẮT**\n> Ai cũng có thể điều khiển bot!\n\n> *Dùng `/dj toggle true` để bật DJ Mode*');
    } else {
        let description = '> DJ Mode hiện đang **BẬT**\n\n';

        // DJ Role
        if (settings.djRoleId) {
            description += `**DJ Role:** <@&${settings.djRoleId}>\n`;
        } else {
            description += '**DJ Role:** *Chưa set*\n';
        }

        // DJ Users
        if (settings.djUserIds.length > 0) {
            const userMentions = settings.djUserIds.map(id => `<@${id}>`).join(', ');
            description += `**DJ Users (${settings.djUserIds.length}):** ${userMentions}\n`;
        } else {
            description += '**DJ Users:** *Chưa có*\n';
        }

        description += '\n> *Người có quyền: Admin, DJ Role, DJ Users, Requester*';
        embed.setDescription(description);
    }

    // Add fields with usage info
    embed.addFields(
        {
            name: '<a:noteoote:1453343798351495258> Cách sử dụng', value:
                '`/dj role @role` - Set DJ Role\n' +
                '`/dj add @user` - Thêm DJ User\n' +
                '`/dj remove @user` - Xóa DJ User\n' +
                '`/dj toggle on/off` - Bật/tắt DJ Mode\n' +
                '`/dj reset` - Reset về mặc định',
            inline: false
        }
    );

    if (interaction) {
        await interaction.reply({ embeds: [embed] });
    } else if (message) {
        await message.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
