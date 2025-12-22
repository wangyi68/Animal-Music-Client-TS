import { EmbedBuilder, SlashCommandBuilder, version } from 'discord.js';
import { createCommandConfig, commands } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import moment from 'moment';
import 'moment-duration-format';
import os from 'os';

const command: Command = {
    name: 'stats',
    description: 'Xem thông tin chi tiết về Bot',
    aliases: ['info', 'botinfo'],
    config: createCommandConfig({
        category: 'info',
        usage: 'stats',
        cooldown: 10
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Xem thông tin chi tiết về Bot') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        const embed = await createStatsEmbed(client, context.prefix);
        await message.reply({ embeds: [embed] });
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        await interaction.deferReply();
        const embed = await createStatsEmbed(client, '/');
        await interaction.editReply({ embeds: [embed] });
        return { type: 'success' };
    }
};

async function createStatsEmbed(client: BotClient, prefix: string): Promise<EmbedBuilder> {
    // Calculate uptime
    const durationBot = (moment.duration(client.uptime) as any).format("D [ngày], H [giờ], m [phút], s [giây]");

    // Memory usage
    const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

    // Get stats
    const totalGuilds = client.guilds.cache.size;
    const totalChannels = client.channels.cache.size;
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const totalCommands = commands.size;
    const ping = client.ws.ping;

    // Get active players
    const activePlayers = client.kazagumo?.players?.size || 0;

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Thông tin về ${client.user?.username || 'Bot'}`,
            iconURL: client.user?.displayAvatarURL()
        })
        .setThumbnail(client.user?.displayAvatarURL() || null)
        .setColor(0xFFC0CB)
        .setDescription(
            `> Bot âm nhạc được phát triển với tất cả tình yêu~\n\n` +
            `### Thông tin Bot`
        )
        .addFields(
            {
                name: '> Prefix',
                value: `\`${prefix}\``,
                inline: true
            },
            {
                name: '> Số máy chủ',
                value: `\`${totalGuilds.toLocaleString('vi-VN')}\``,
                inline: true
            },
            {
                name: '> Số thành viên',
                value: `\`${totalMembers.toLocaleString('vi-VN')}\``,
                inline: true
            },
            {
                name: '> Số kênh',
                value: `\`${totalChannels.toLocaleString('vi-VN')}\``,
                inline: true
            },
            {
                name: '> Số lệnh',
                value: `\`${totalCommands}\``,
                inline: true
            },
            {
                name: '> Đang phát nhạc',
                value: `\`${activePlayers} server\``,
                inline: true
            }
        )
        .addFields({
            name: '\u200b',
            value: `### Chỉ số hệ thống`,
            inline: false
        })
        .addFields(
            {
                name: '> RAM sử dụng',
                value: `\`${memUsed} MB\``,
                inline: true
            },
            {
                name: '> RAM máy chủ',
                value: `\`${memTotal} GB\``,
                inline: true
            },
            {
                name: '> Ping',
                value: `\`${ping}ms\``,
                inline: true
            },
            {
                name: '> Hệ điều hành',
                value: `\`${os.platform()}\``,
                inline: true
            },
            {
                name: '> Kiến trúc',
                value: `\`${os.arch()}\``,
                inline: true
            },
            {
                name: '> Node.js',
                value: `\`${process.version}\``,
                inline: true
            },
            {
                name: '> Discord.js',
                value: `\`v${version}\``,
                inline: true
            },
            {
                name: '> Uptime',
                value: `\`${durationBot}\``,
                inline: true
            },
            {
                name: '> Lavalink',
                value: `\`${client.kazagumo?.shoukaku?.nodes?.size || 0} node\``,
                inline: true
            }
        )
        .setFooter({
            text: 'Animal Music • Made with love',
            iconURL: client.user?.displayAvatarURL()
        })
        .setTimestamp();

    return embed;
}

export default command;
