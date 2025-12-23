/**
 * FairShuffle Command - Xáo trộn công bằng theo từng user
 * @version 3.0.0
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { QueueManager } from '../../core/index.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

export default {
    name: 'fairshuffle',
    description: 'Xáo trộn hàng chờ công bằng - mỗi người được phát đều',
    aliases: ['fs', 'fshuffle'],
    config: createCommandConfig({
        category: 'music',
        usage: 'fairshuffle',
        voiceChannel: true,
        cooldown: 5
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('fairshuffle')
        .setDescription('Xáo trộn hàng chờ công bằng - mỗi người được phát đều') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const client = context.message.client as BotClient;
        const player = client.kazagumo.players.get(context.message.guildId!);

        if (!player || player.queue.size < 2) {
            const embed = new EmbedBuilder()
                .setDescription(`> Cần ít nhất 2 bài trong hàng chờ để xáo trộn!`)
                .setColor(COLORS.ERROR);
            const msg = await context.message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.NO_PERMISSION);
            return { type: 'error', message: 'Not enough tracks' };
        }

        const queueSize = player.queue.size;
        QueueManager.fairShuffle(player);

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'XÁO TRỘN CÔNG BẰNG', iconURL: context.message.author.displayAvatarURL() })
            .setDescription(`> Đã xáo trộn **${queueSize}** bài theo kiểu công bằng rồi đấy!\n> Mỗi người sẽ được phát số bài ngang nhau~`)
            .setColor(COLORS.MAIN)
            .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~' });

        const msg = await context.message.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.TRACK_ADDED);
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const client = context.interaction.client as BotClient;
        const player = client.kazagumo.players.get(context.interaction.guildId!);

        if (!player || player.queue.size < 2) {
            const embed = new EmbedBuilder()
                .setDescription(`> Cần ít nhất 2 bài trong hàng chờ để xáo trộn!`)
                .setColor(COLORS.ERROR);
            await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return { type: 'error', message: 'Not enough tracks' };
        }

        const queueSize = player.queue.size;
        QueueManager.fairShuffle(player);

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'XÁO TRỘN CÔNG BẰNG', iconURL: context.interaction.user.displayAvatarURL() })
            .setDescription(`> Đã xáo trộn **${queueSize}** bài theo kiểu công bằng rồi đấy!\n> Mỗi người sẽ được phát xen kẽ~`)
            .setColor(COLORS.MAIN)
            .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~' });

        await context.interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return { type: 'success' };
    }
} as Command;
