import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'skip',
    description: 'Bỏ qua bài hát hiện tại',
    aliases: ['s', 'next'],
    config: createCommandConfig({
        category: 'music',
        usage: 'skip',
        cooldown: 3,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài hát hiện tại') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;
        const client = message.client as BotClient;
        return await skipTrack(client, message.guild!.id, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        return await skipTrack(client, interaction.guild!.id, null, interaction);
    }
};

async function skipTrack(
    client: BotClient,
    guildId: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player) {
        const errorMsg = 'Hảả?! Làm gì có nhạc nào đang phát đâu mà skip!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    const currentTrack = player.queue.current;
    player.skip();

    const embed = new EmbedBuilder()
        .setDescription(`> Tớ đã bỏ qua **${currentTrack?.title || 'bài hát'}** rồi nha~`)
        .setColor(COLORS.MAIN);

    if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.SKIP_TRACK);
    } else if (interaction) {
        const msg = await interaction.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.SKIP_TRACK);
    }

    return { type: 'success' };
}

export default command;
