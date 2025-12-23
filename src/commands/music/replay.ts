/**
 * Replay Command - Phát lại bài hiện tại từ đầu
 * @version 3.0.0
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

export default {
    name: 'replay',
    description: 'Phát lại bài hiện tại từ đầu',
    aliases: ['restart', 'rewind'],
    config: createCommandConfig({
        category: 'music',
        usage: 'replay',
        voiceChannel: true,
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('replay')
        .setDescription('Phát lại bài hiện tại từ đầu') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const client = context.message.client as BotClient;
        const player = client.kazagumo.players.get(context.message.guildId!);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setDescription(`> Không có bài nào đang phát để replay!`)
                .setColor(COLORS.ERROR);
            const msg = await context.message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
            return { type: 'error', message: 'No track playing' };
        }

        player.seek(0);

        const embed = new EmbedBuilder()
            .setDescription(`> Đã quay lại từ đầu bài **${player.queue.current.title}** rồi nha!`)
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
                .setDescription(`> Không có bài nào đang phát để replay!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'No track playing' };
        }

        player.seek(0);

        const embed = new EmbedBuilder()
            .setDescription(`> Đã quay lại từ đầu bài **${player.queue.current.title}** rồi nha!`)
            .setColor(COLORS.MAIN);
        await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return { type: 'success' };
    }
} as Command;
