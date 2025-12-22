import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../handlers/CommandHandler.js';
import { removePlayerData } from '../services/MusicManager.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../types/index.js';

const command: Command = {
    name: 'stop',
    description: 'Dừng phát nhạc và rời khỏi voice channel',
    aliases: ['leave', 'disconnect', 'dc'],
    config: createCommandConfig({
        category: 'music',
        usage: 'stop',
        cooldown: 3,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Dừng phát nhạc và rời khỏi voice channel') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        return await stopPlayer(client, message.guild!.id, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        return await stopPlayer(client, interaction.guild!.id, null, interaction);
    }
};

async function stopPlayer(
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

    player.destroy();
    removePlayerData(guildId);

    const embed = new EmbedBuilder()
        .setDescription('Nhà ngươi đã cho ta ngừng hát 🤬')
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setColor(0xFF0000);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
