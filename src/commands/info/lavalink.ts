import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext, LavalinkNodeStatus } from '../../types/index.js';
import { getLavalinkNodesStatus } from '../../services/MusicManager.js';
import moment from 'moment';
import 'moment-duration-format';

const command: Command = {
    name: 'lavalink',
    description: 'Xem trạng thái các Lavalink node',
    aliases: ['nodes', 'lavanodes', 'nodeinfo'],
    config: createCommandConfig({
        category: 'info',
        usage: 'lavalink',
        cooldown: 5
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('lavalink')
        .setDescription('Xem trạng thái các Lavalink node') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        const embed = await createLavalinkEmbed(client);
        await message.reply({ embeds: [embed] });
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        await interaction.deferReply();
        const embed = await createLavalinkEmbed(client);
        await interaction.editReply({ embeds: [embed] });
        return { type: 'success' };
    }
};

async function createLavalinkEmbed(client: BotClient): Promise<EmbedBuilder> {
    const nodes = getLavalinkNodesStatus(client.kazagumo);

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Trạng thái Lavalink Nodes`,
            iconURL: client.user?.displayAvatarURL()
        })
        .setColor(0xFFC0CB)
        .setThumbnail(client.user?.displayAvatarURL() || null)
        .setDescription(
            `> Đang theo dõi **${nodes.length}** Lavalink node${nodes.length > 1 ? 's' : ''}~\n\n` +
            `### Tổng quan`
        );

    if (nodes.length === 0) {
        embed.addFields({
            name: '⚠️ Không có node nào',
            value: 'Không tìm thấy Lavalink node nào được cấu hình!',
            inline: false
        });
    } else {
        // Summary stats
        const connectedNodes = nodes.filter(n => n.state === 'CONNECTED').length;
        const totalPlayers = nodes.reduce((acc, n) => acc + n.players, 0);

        embed.addFields(
            {
                name: '> Nodes online',
                value: `\`${connectedNodes}/${nodes.length}\``,
                inline: true
            },
            {
                name: '> Tổng players',
                value: `\`${totalPlayers}\``,
                inline: true
            },
            {
                name: '> Trạng thái',
                value: connectedNodes === nodes.length ? '`✅ Tất cả hoạt động`' : '`⚠️ Có node offline`',
                inline: true
            }
        );

        // Add separator
        embed.addFields({
            name: '\u200b',
            value: `### Chi tiết từng Node`,
            inline: false
        });

        // Individual node info
        for (const node of nodes) {
            const statusEmoji = getStatusEmoji(node.state);
            const uptime = node.uptime > 0
                ? (moment.duration(node.uptime) as any).format("D[d] H[h] m[m] s[s]")
                : 'N/A';

            const memUsedMB = (node.memory.used / 1024 / 1024).toFixed(1);
            const memAllocatedMB = (node.memory.allocated / 1024 / 1024).toFixed(1);

            const fieldValue = [
                `**Trạng thái:** ${statusEmoji} \`${node.state}\``,
                `**URL:** \`${node.url}\``,
                `**Players:** \`${node.players}\``,
                `**CPU:** \`${node.cpu}%\``,
                `**RAM:** \`${memUsedMB}MB / ${memAllocatedMB}MB\``,
                `**Uptime:** \`${uptime}\``,
                `**Ping:** \`${node.ping >= 0 ? node.ping + 'ms' : 'N/A'}\``
            ].join('\n');

            embed.addFields({
                name: `${statusEmoji} Node: ${node.name}`,
                value: fieldValue,
                inline: true
            });
        }
    }

    embed.setFooter({
        text: 'Animal Music • Lavalink Status',
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
