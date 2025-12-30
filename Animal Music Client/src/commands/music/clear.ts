import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets, MessageType } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'clear',
    description: 'Xóa toàn bộ hàng chờ',
    aliases: ['cls'],
    config: createCommandConfig({
        category: 'music',
        usage: 'clear',
        cooldown: 5,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Xóa toàn bộ hàng chờ') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        return await clearQueue(client, message.guild!.id, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        return await clearQueue(client, interaction.guild!.id, null, interaction);
    }
};

async function clearQueue(
    client: BotClient,
    guildId: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player) {
        const errorMsg = 'Clear cái gì?! Làm gì có gì để clear đâu mà!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    const size = player.queue.size;
    player.queue.clear();

    const embed = new EmbedBuilder()
        .setDescription(`> Dọn sạch sành sanh **${size}** bài rồi đấy! Mệt chết đi được!`)
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
