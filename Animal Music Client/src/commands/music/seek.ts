/**
 * Seek Command - Tua bài hát đến vị trí cụ thể
 * @version 3.0.0
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

export default {
    name: 'seek',
    description: 'Tua bài hát đến vị trí cụ thể',
    aliases: ['goto', 'jumpto'],
    config: createCommandConfig({
        category: 'music',
        usage: 'seek <thời gian (giây hoặc mm:ss)>',
        voiceChannel: true,
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Tua bài hát đến vị trí cụ thể')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Thời gian (VD: 30, 1:30, 2:30)')
                .setRequired(true)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const client = context.message.client as BotClient;
        const player = client.kazagumo.players.get(context.message.guildId!);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setDescription(`> Chưa có nhạc nào đang phát mà tua cái gì!`)
                .setColor(COLORS.ERROR);
            const msg = await context.message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
            return { type: 'error', message: 'No player' };
        }

        const timeArg = context.args[0];
        if (!timeArg) return { type: 'invalidArguments' };

        const position = parseTime(timeArg);
        if (position === null || position < 0) {
            const embed = new EmbedBuilder()
                .setDescription(`> Thời gian không hợp lệ! Nhập kiểu 30, 1:30, hoặc 2:30`)
                .setColor(COLORS.ERROR);
            await context.message.reply({ embeds: [embed] });
            return { type: 'error', message: 'Invalid time' };
        }

        const trackLength = player.queue.current.length || 0;
        if (position > trackLength) {
            const embed = new EmbedBuilder()
                .setDescription(`> Bài này có ${formatTime(trackLength)} thôi! Đừng tua quá lố!`)
                .setColor(COLORS.ERROR);
            await context.message.reply({ embeds: [embed] });
            return { type: 'error', message: 'Position exceeds track length' };
        }

        player.seek(position);

        const embed = new EmbedBuilder()
            .setDescription(`> Đã tua đến **${formatTime(position)}** rồi nha!`)
            .setColor(COLORS.MAIN);
        const msg = await context.message.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.TRACK_ADDED);
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const client = context.interaction.client as BotClient;
        const player = client.kazagumo.players.get(context.interaction.guildId!);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setDescription(`> Chưa có nhạc nào đang phát mà tua cái gì!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'No player' };
        }

        const timeArg = context.interaction.options.getString('time', true);
        const position = parseTime(timeArg);

        if (position === null || position < 0) {
            const embed = new EmbedBuilder()
                .setDescription(`> Thời gian không hợp lệ! Nhập kiểu 30, 1:30, hoặc 2:30`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'Invalid time' };
        }

        const trackLength = player.queue.current.length || 0;
        if (position > trackLength) {
            const embed = new EmbedBuilder()
                .setDescription(`> Bài này có ${formatTime(trackLength)} thôi! Đừng tua quá lố!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'Position exceeds track length' };
        }

        player.seek(position);

        const embed = new EmbedBuilder()
            .setDescription(`> Đã tua đến **${formatTime(position)}** rồi nha!`)
            .setColor(COLORS.MAIN);
        await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return { type: 'success' };
    }
} as Command;

function parseTime(timeStr: string): number | null {
    // Handle mm:ss format
    if (timeStr.includes(':')) {
        const parts = timeStr.split(':').map(p => parseInt(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return (parts[0] * 60 + parts[1]) * 1000;
        }
        if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
            return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }
        return null;
    }

    // Handle seconds format
    const seconds = parseInt(timeStr);
    if (!isNaN(seconds)) {
        return seconds * 1000;
    }

    return null;
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
