/**
 * NowPlaying Command - Xem bài đang phát với progress bar
 * @version 3.0.0
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';
import { StateManager } from '../../core/index.js';

export default {
    name: 'nowplaying',
    description: 'Xem bài đang phát với progress bar',
    aliases: ['np', 'current', 'playing'],
    config: createCommandConfig({
        category: 'music',
        usage: 'nowplaying',
        voiceChannel: false,
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Xem bài đang phát với progress bar') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const client = context.message.client as BotClient;
        return await showNowPlaying(client, context.message.guildId!, context.message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const client = context.interaction.client as BotClient;
        return await showNowPlaying(client, context.interaction.guildId!, null, context.interaction);
    }
} as Command;

async function showNowPlaying(
    client: BotClient,
    guildId: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player || !player.queue.current) {
        const embed = new EmbedBuilder()
            .setDescription(`> Không có bài nào đang phát cả! Thêm nhạc đi nào!`)
            .setColor(COLORS.ERROR);

        if (interaction) {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else if (message) {
            const msg = await message.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: 'No track playing' };
    }

    const track = player.queue.current;
    const position = player.position || 0;
    const duration = track.length || 0;
    const progress = createProgressBar(position, duration);
    const state = StateManager.getPlayerState(guildId);
    const loopMode = state?.loopMode || 0;
    const loopText = loopMode === 0 ? 'Tắt' : loopMode === 1 ? 'Bài hát' : 'Hàng chờ';

    const requester = track.requester as any;

    const embed = new EmbedBuilder()
        .setColor(COLORS.PLAYING || COLORS.MAIN)
        .setAuthor({
            name: 'ĐANG PHÁT',
            iconURL: client.user?.displayAvatarURL()
        })
        .setTitle(track.title)
        .setURL(track.uri || null)
        .setThumbnail(track.thumbnail || null)
        .setDescription(
            `**Nghệ sĩ:** ${track.author}\n\n` +
            `${progress}\n` +
            `\`${formatTime(position)}\` / \`${formatTime(duration)}\``
        )
        .addFields(
            { name: '<a:Loading:1452376829062283478> Âm lượng', value: `\`${player.volume}%\``, inline: true },
            { name: '<a:spotif:1452561033800454249> Lặp lại', value: `\`${loopText}\``, inline: true },
            { name: '<:guranote:1444001458600022179> Hàng chờ', value: `\`${player.queue.size} bài\``, inline: true }
        )
        .setFooter({
            text: `Yêu cầu bởi ${requester?.username || 'Không rõ'} • Cluster: ${player.shoukaku.node.name}`,
            iconURL: requester?.displayAvatarURL?.() || undefined
        })
        .setTimestamp();

    if (player.paused) {
        embed.setAuthor({
            name: '⏸️ TẠM DỪNG',
            iconURL: client.user?.displayAvatarURL()
        });
    }

    if (interaction) {
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.QUEUE_DISPLAY);
    }

    return { type: 'success' };
}

function createProgressBar(current: number, total: number, length: number = 15): string {
    if (total === 0) return '▬'.repeat(length);

    const progress = Math.round((current / total) * length);
    const filled = '▓'.repeat(Math.min(progress, length));
    const empty = '░'.repeat(Math.max(length - progress, 0));

    return `${filled}${empty}`;
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
