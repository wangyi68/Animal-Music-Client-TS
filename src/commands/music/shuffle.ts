import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';

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
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });
        return { type: 'error', message: errorMsg };
    }

    if (player.queue.size < 2) {
        const errorMsg = 'Trộn sao được khi chỉ có 1-2 bài! Thêm vào đi rồi tớ trộn cho~';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });
        return { type: 'error', message: errorMsg };
    }

    player.queue.shuffle();

    const embed = new EmbedBuilder()
        .setDescription(`Tớ đã trộn **${player.queue.size}** bài hát trong hàng chờ giúp bạn rồi nè!`)
        .setColor(0xFFC0CB);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
