import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../types/index.js';

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
        const errorMsg = 'Không có gì đang phát ấy ? thử lại ikkk.... ❌';
        const embedError = new EmbedBuilder().setDescription(`❌ ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        return { type: 'error', message: errorMsg };
    }

    const size = player.queue.size;
    player.queue.clear();

    const embed = new EmbedBuilder()
        .setDescription(`🗑️ | Đã xóa **${size}** bài hát khỏi hàng chờ!`)
        .setColor(0xFFC0CB);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
