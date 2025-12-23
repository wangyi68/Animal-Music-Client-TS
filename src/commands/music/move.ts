/**
 * Move Command - Di chuyển bài trong queue
 * @version 3.0.0
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { QueueManager } from '../../core/index.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

export default {
    name: 'move',
    description: 'Di chuyển bài hát trong hàng chờ',
    aliases: ['mv'],
    config: createCommandConfig({
        category: 'music',
        usage: 'move <từ vị trí> <đến vị trí>',
        voiceChannel: true,
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Di chuyển bài hát trong hàng chờ')
        .addIntegerOption(option =>
            option.setName('from')
                .setDescription('Vị trí hiện tại của bài hát')
                .setRequired(true)
                .setMinValue(1)
        )
        .addIntegerOption(option =>
            option.setName('to')
                .setDescription('Vị trí muốn di chuyển đến')
                .setRequired(true)
                .setMinValue(1)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const client = context.message.client as BotClient;
        const player = client.kazagumo.players.get(context.message.guildId!);

        if (!player || !player.queue.size) {
            const embed = new EmbedBuilder()
                .setDescription(`> Hàng chờ trống trơn mà! Không có gì để di chuyển!`)
                .setColor(COLORS.ERROR);
            const msg = await context.message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.NO_PERMISSION);
            return { type: 'error', message: 'No queue' };
        }

        const from = parseInt(context.args[0]) - 1;
        const to = parseInt(context.args[1]) - 1;

        if (isNaN(from) || isNaN(to)) {
            return { type: 'invalidArguments' };
        }

        const success = QueueManager.move(player, from, to);

        if (!success) {
            const embed = new EmbedBuilder()
                .setDescription(`> Vị trí không hợp lệ! Xem lại đi nha!`)
                .setColor(COLORS.ERROR);
            await context.message.reply({ embeds: [embed] });
            return { type: 'error', message: 'Invalid position' };
        }

        const embed = new EmbedBuilder()
            .setDescription(`> Đã di chuyển bài từ vị trí **#${from + 1}** đến **#${to + 1}** rồi nha!`)
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
                .setDescription(`> Hàng chờ trống trơn mà! Không có gì để di chuyển!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'No queue' };
        }

        const from = context.interaction.options.getInteger('from', true) - 1;
        const to = context.interaction.options.getInteger('to', true) - 1;

        const success = QueueManager.move(player, from, to);

        if (!success) {
            const embed = new EmbedBuilder()
                .setDescription(`> Vị trí không hợp lệ! Xem lại đi nha!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'Invalid position' };
        }

        const embed = new EmbedBuilder()
            .setDescription(`> Đã di chuyển bài từ vị trí **#${from + 1}** đến **#${to + 1}** rồi nha!`)
            .setColor(COLORS.MAIN);
        await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return { type: 'success' };
    }
} as Command;
