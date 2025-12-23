import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets, MessageType } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'volume',
    description: 'Thay đổi âm lượng',
    aliases: ['vol'],
    config: createCommandConfig({
        category: 'music',
        usage: 'volume <0-125>',
        cooldown: 3,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Thay đổi âm lượng')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Mức âm lượng (0-125)')
                .setMinValue(0)
                .setMaxValue(125)
                .setRequired(false)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message, args } = context;
        const client = message.client as BotClient;
        const volume = args[0] ? parseInt(args[0]) : undefined;
        return await setVolume(client, message.guild!.id, volume, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        const volume = interaction.options.getInteger('level') ?? undefined;
        return await setVolume(client, interaction.guild!.id, volume, null, interaction);
    }
};

async function setVolume(
    client: BotClient,
    guildId: string,
    volume?: number,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player) {
        const errorMsg = 'Chỉnh volume cái gì khi chưa bật nhạc vậy?!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    if (volume === undefined) {
        const embed = new EmbedBuilder()
            .setDescription(`> Đang để **${player.volume}%** đấy! Điếc hay sao mà hỏi?`)
            .setColor(COLORS.MAIN);

        if (message) {
            const msg = await message.reply({ embeds: [embed] });
            smartDelete(msg, { type: MessageType.INFO, contentLength: 50 });
        } else if (interaction) {
            const msg = await interaction.reply({ embeds: [embed] });
            smartDelete(msg, { type: MessageType.INFO, contentLength: 50 });
        }
        return { type: 'success' };
    }

    if (isNaN(volume) || volume < 0 || volume > 125) {
        const errorMsg = 'Này! Âm lượng chỉ được từ **0** đến **125** thôi! Đừng có làm khó tớ!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    player.setVolume(volume);

    const embed = new EmbedBuilder()
        .setDescription(`> Rồi rồi! Đã chỉnh xuống **${volume}%** rồi nhé! Đừng bắt tớ chỉnh nữa!`)
        .setColor(COLORS.SUCCESS);

    if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS, contentLength: 50 });
    } else if (interaction) {
        const msg = await interaction.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.SUCCESS, contentLength: 50 });
    }

    return { type: 'success' };
}

export default command;
