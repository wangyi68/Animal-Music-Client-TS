import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';

const command: Command = {
    name: 'pause',
    description: 'Tạm dừng/tiếp tục phát nhạc',
    aliases: ['resume'],
    config: createCommandConfig({
        category: 'music',
        usage: 'pause',
        cooldown: 3,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Tạm dừng/tiếp tục phát nhạc') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        return await togglePause(client, message.guild!.id, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        return await togglePause(client, interaction.guild!.id, null, interaction);
    }
};

async function togglePause(
    client: BotClient,
    guildId: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player) {
        const errorMsg = 'À mà! Chưa có nhạc nào đâu mà pause với resume!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });
        return { type: 'error', message: errorMsg };
    }

    const isPaused = player.paused;
    player.pause(!isPaused);

    const embed = new EmbedBuilder()
        .setDescription(isPaused ? '> Tiếp tục phát nhạc rồi nè~' : '> Tạm dừng phát nhạc rồi nha!')
        .setColor(0xFFC0CB);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
