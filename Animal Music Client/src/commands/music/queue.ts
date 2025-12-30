/**
 * Queue Command - Xem danh sách hàng chờ
 * @version 3.1.0
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { QueueManager, QUEUE_CONFIG } from '../../core/index.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'queue',
    description: 'Xem danh sách hàng chờ',
    aliases: ['q'],
    config: createCommandConfig({
        category: 'music',
        usage: 'queue [page]',
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Xem danh sách hàng chờ')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Số trang')
                .setRequired(false)
                .setMinValue(1)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message, args } = context;
        const client = message.client as BotClient;
        const page = parseInt(args[0]) || 1;
        return await showQueue(client, message.guild!.id, page, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        const page = interaction.options.getInteger('page') || 1;
        return await showQueue(client, interaction.guild!.id, page, null, interaction);
    }
};

async function showQueue(
    client: BotClient,
    guildId: string,
    page: number,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player || !player.queue.current) {
        const errorMsg = 'Làm gì có nhạc nào đang phát đâu mà xem! Bật nhạc đi rồi tớ mới show cho~';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    const current = player.queue.current;

    // Use QueueManager for pagination
    const { tracks: pageTracks, totalPages, currentPage } = QueueManager.getPage(
        player,
        page,
        QUEUE_CONFIG.DEFAULT_PAGE_SIZE
    );

    // Get queue stats
    const stats = QueueManager.getStats(player);

    // Format duration helper
    const formatDuration = (ms: number): string => {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Build description
    let description = `**Đang phát:**\n[${current?.title || 'Không rõ'}](${current?.uri || '#'})\n\n`;

    if (pageTracks.length > 0) {
        const startIndex = (currentPage - 1) * QUEUE_CONFIG.DEFAULT_PAGE_SIZE;
        description += '**Hàng chờ:**\n';
        description += pageTracks
            .map((track, i) => {
                const duration = formatDuration(track.length || 0);
                return `\`${startIndex + i + 1}.\` [${track.title}](${track.uri}) \`[${duration}]\``;
            })
            .join('\n');
    } else {
        description += '*Hàng chờ đang trống trơn rồi đó~*';
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'HÀNG CHỜ HIỆN TẠI' })
        .setDescription(description)
        .setFooter({
            text: `Trang ${currentPage}/${totalPages} • ${stats.size} bài • Tổng: ${formatDuration(stats.totalDuration)} • ${stats.uniqueRequesters} người yêu cầu`
        })
        .setColor(COLORS.MAIN);

    if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.QUEUE_DISPLAY);
    } else if (interaction) {
        const msg = await interaction.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.QUEUE_DISPLAY);
    }

    return { type: 'success' };
}

export default command;
