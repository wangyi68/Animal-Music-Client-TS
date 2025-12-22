import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import { removePlayerData } from '../../services/MusicManager.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';

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
        return await stopPlayer(client, message.guild!.id, message, null);
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
        const embedError = new EmbedBuilder()
            .setDescription(`> Dừng cái gì?! Đâu có gì đang phát đâu mà dừng!`)
            .setColor(COLORS.ERROR);

        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });

        return { type: 'error', message: 'Không có nhạc đang phát' };
    }

    try {
        await player.destroy();
    } catch (e) {
        // Ignore if already destroyed
    }
    removePlayerData(guildId);

    const user = message ? message.author : interaction.user;
    const embed = new EmbedBuilder()
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
        .setDescription('Tớ đã tắt nhạc và rời đi rồi nè, bạn nhớ tớ thì lại gọi nha~')
        .setColor(COLORS.ERROR);

    if (interaction) {
        await interaction.reply({ embeds: [embed] });
    } else if (message) {
        await message.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
