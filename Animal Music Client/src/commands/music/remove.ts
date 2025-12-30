/**
 * Remove Command - Xóa bài khỏi queue
 * @version 3.0.0
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { QueueManager } from '../../core/index.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

export default {
    name: 'remove',
    description: 'Xóa bài hát khỏi hàng chờ',
    aliases: ['rm', 'delete'],
    config: createCommandConfig({
        category: 'music',
        usage: 'remove <vị trí>',
        voiceChannel: true,
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Xóa bài hát khỏi hàng chờ')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('Vị trí bài hát cần xóa')
                .setRequired(true)
                .setMinValue(1)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const client = context.message.client as BotClient;
        const player = client.kazagumo.players.get(context.message.guildId!);

        if (!player || !player.queue.size) {
            const embed = new EmbedBuilder()
                .setDescription(`> Hàng chờ trống trơn mà! Xóa cái gì được!`)
                .setColor(COLORS.ERROR);
            const msg = await context.message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.NO_PERMISSION);
            return { type: 'error', message: 'No queue' };
        }

        const position = parseInt(context.args[0]) - 1;

        if (isNaN(position)) {
            return { type: 'invalidArguments' };
        }

        const removed = QueueManager.remove(player, position);

        if (!removed) {
            const embed = new EmbedBuilder()
                .setDescription(`> Vị trí không hợp lệ! Xem lại đi nha!`)
                .setColor(COLORS.ERROR);
            await context.message.reply({ embeds: [embed] });
            return { type: 'error', message: 'Invalid position' };
        }

        const embed = new EmbedBuilder()
            .setDescription(`> Đã xóa bài **${removed.title}** khỏi hàng chờ rồi nha!`)
            .setColor(COLORS.MAIN);
        const msg = await context.message.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.TRACK_ADDED);
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const client = context.interaction.client as BotClient;
        const player = client.kazagumo.players.get(context.interaction.guildId!);

        if (!player || !player.queue.size) {
            const embed = new EmbedBuilder()
                .setDescription(`> Hàng chờ trống trơn mà! Xóa cái gì được!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'No queue' };
        }

        const position = context.interaction.options.getInteger('position', true) - 1;
        const removed = QueueManager.remove(player, position);

        if (!removed) {
            const embed = new EmbedBuilder()
                .setDescription(`> Vị trí không hợp lệ! Xem lại đi nha!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'Invalid position' };
        }

        const embed = new EmbedBuilder()
            .setDescription(`> Đã xóa bài **${removed.title}** khỏi hàng chờ rồi nha!`)
            .setColor(COLORS.MAIN);
        await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return { type: 'success' };
    }
} as Command;
