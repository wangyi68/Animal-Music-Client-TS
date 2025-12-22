import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext, LavalinkNodeStatus } from '../../types/index.js';
import { getLavalinkNodesStatus } from '../../services/MusicManager.js';
import moment from 'moment';
import 'moment-duration-format';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, MessageType, DeletePresets } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'lavalink',
    description: 'Xem trạng thái các Cluster',
    aliases: ['nodes', 'cluster', 'clusters'],
    config: createCommandConfig({
        category: 'info',
        usage: 'lavalink',
        cooldown: 5
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('lavalink')
        .setDescription('Xem trạng thái các Lavalink node (Owner only)') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;

        // Check if user is bot owner (from config)
        const ownerId = client.config.app.ownerId;

        if (ownerId && message.author.id !== ownerId) {
            const msg = await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(COLORS.ERROR)
                        .setDescription('> ❌ Lệnh này chỉ dành cho **Owner Bot** thôi nha!')
                ]
            });
            smartDelete(msg, DeletePresets.NO_PERMISSION);
            return { type: 'error', message: 'Not bot owner' };
        }

        const embed = await createLavalinkEmbed(client);
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.INFO, fieldsCount: 5 });
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;

        // Check if user is bot owner (from config)
        const ownerId = client.config.app.ownerId;

        if (ownerId && interaction.user.id !== ownerId) {
            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(COLORS.ERROR)
                        .setDescription('> ❌ Lệnh này chỉ dành cho **Owner Bot** thôi nha!')
                ],
                ephemeral: true
            });
            return { type: 'error', message: 'Not bot owner' };
        }

        await interaction.deferReply();
        const embed = await createLavalinkEmbed(client);
        const msg = await interaction.editReply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.INFO, fieldsCount: 5 });
        return { type: 'success' };
    }
};

async function createLavalinkEmbed(client: BotClient): Promise<EmbedBuilder> {
    const nodes = getLavalinkNodesStatus(client.kazagumo);

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Trạng thái System Clusters`,
            iconURL: client.user?.displayAvatarURL()
        })
        .setColor(COLORS.MAIN)
        .setThumbnail(client.user?.displayAvatarURL() || null);

    if (nodes.length === 0) {
        embed.setDescription('> ⚠️ Hả? Chả tìm thấy cái Cluster nào cả! Cấu hình kiểu gì vậy?!');
    } else {
        // Summary stats
        const connectedNodes = nodes.filter(n => n.state === 'CONNECTED').length;
        const totalPlayers = nodes.reduce((acc, n) => acc + n.players, 0);
        const statusText = connectedNodes === nodes.length
            ? '✅ Tất cả hoạt động'
            : '⚠️ Có Cluster offline';

        // Build description with summary
        let description = `> Đang theo dõi **${nodes.length}** Clusters\n\n`;
        description += `**📊 Tổng quan**\n`;
        description += `┌ **Clusters:** \`${connectedNodes}/${nodes.length}\` online\n`;
        description += `├ **Players:** \`${totalPlayers}\` đang hoạt động\n`;
        description += `└ **Trạng thái:** ${statusText}\n\n`;
        description += `**🖥️ Chi tiết Cluster**`;

        embed.setDescription(description);

        // Individual node info - NOT inline for better format
        for (const node of nodes) {
            const statusEmoji = getStatusEmoji(node.state);
            const uptime = node.uptime > 0
                ? (moment.duration(node.uptime) as any).format("D[d] H[h] m[m]")
                : 'N/A';

            const memUsedMB = (node.memory.used / 1024 / 1024).toFixed(0);
            const memAllocatedMB = (node.memory.allocated / 1024 / 1024).toFixed(0);

            // Compact format
            const fieldValue = [
                `┌ **Trạng thái:** ${statusEmoji} ${node.state}`,
                `├ **Players:** ${node.players} | **CPU:** ${node.cpu}%`,
                `├ **RAM:** ${memUsedMB}MB / ${memAllocatedMB}MB`,
                `├ **Uptime:** ${uptime}`,
                `└ **Ping:** ${node.ping >= 0 ? node.ping + 'ms' : 'N/A'}`
            ].join('\n');

            embed.addFields({
                name: `${statusEmoji} ${node.name}`,
                value: fieldValue,
                inline: false  // Changed to false for better readability
            });
        }
    }

    embed.setFooter({
        text: 'Animal Music • Cluster Status',
        iconURL: client.user?.displayAvatarURL()
    })
        .setTimestamp();

    return embed;
}

function getStatusEmoji(state: LavalinkNodeStatus['state']): string {
    switch (state) {
        case 'CONNECTED':
            return '🟢';
        case 'CONNECTING':
            return '🟡';
        case 'RECONNECTING':
            return '🟠';
        case 'DISCONNECTED':
            return '🔴';
        default:
            return '⚪';
    }
}

export default command;

