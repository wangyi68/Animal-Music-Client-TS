import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets, MessageType } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'shuffle',
    description: 'Xáo trộn hàng chờ',
    aliases: [],
    config: createCommandConfig({
        category: 'music',
        usage: 'shuffle',
        cooldown: 5,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Xáo trộn hàng chờ') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        return await shuffleQueue(client, message.guild!.id, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        return await shuffleQueue(client, interaction.guild!.id, null, interaction);
    }
};

async function shuffleQueue(
    client: BotClient,
    guildId: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player) {
        const errorMsg = 'Shuffle cái gì?! Chưa có nhạc nào đang phát hết á!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    if (player.queue.size < 2) {
        const embedError = new EmbedBuilder().setDescription('> Trời ạ! Có 1-2 bài thì trộn kiểu gì! Thêm bài vào đi!').setColor(COLORS.ERROR);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: 'Not enough tracks to shuffle' };
    }

    player.queue.shuffle();

    const embed = new EmbedBuilder()
        .setDescription(`> Hứ! Đã trộn **${player.queue.size}** bài lung tung beng lên rồi đấy! Chúc may mắn!`)
        .setColor(COLORS.SUCCESS);

    if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS, contentLength: 60 });
    } else if (interaction) {
        const msg = await interaction.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS, contentLength: 60 });
    }

    return { type: 'success' };
}

export default command;
