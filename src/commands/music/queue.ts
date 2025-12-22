import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';

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
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });
        return { type: 'error', message: errorMsg };
    }

    const queue = player.queue;
    const current = queue.current;
    const tracks = [...queue];

    const itemsPerPage = 10;
    const maxPages = Math.ceil(tracks.length / itemsPerPage) || 1;
    const currentPage = Math.min(Math.max(1, page), maxPages);

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageTracks = tracks.slice(start, end);

    let description = `Đang phát giúp bạn bài hát này nè:\n[${current?.title || 'Không rõ'}](${current?.uri || '#'})\n\n`;

    if (pageTracks.length > 0) {
        description += 'Hàng chờ mình đang giữ nè:\n';
        description += pageTracks
            .map((track, i) => `\`${start + i + 1}.\` [${track.title}](${track.uri})`)
            .join('\n');
    } else {
        description += '*Hàng chờ đang trống trơn rồi đó~*';
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'HÀNG CHỜ HIỆN TẠI NÈ~' })
        .setDescription(description)
        .setFooter({ text: `Trang ${currentPage}/${maxPages} • Có tổng cộng ${tracks.length} bài lận đó` })
        .setColor(COLORS.MAIN);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
