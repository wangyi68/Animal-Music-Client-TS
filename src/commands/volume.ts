import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../types/index.js';

const command: Command = {
    name: 'volume',
    description: 'Thay đổi âm lượng',
    aliases: ['vol'],
    config: createCommandConfig({
        category: 'music',
        usage: 'volume <0-100>',
        cooldown: 3,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Thay đổi âm lượng')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Mức âm lượng (0-100)')
                .setMinValue(0)
                .setMaxValue(100)
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
        const errorMsg = 'Không có gì đang phát ấy ? thử lại ikkk.... ❌';
        const embedError = new EmbedBuilder().setDescription(`❌ ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        return { type: 'error', message: errorMsg };
    }

    if (volume === undefined) {
        const embed = new EmbedBuilder()
            .setDescription(`Âm lượng hiện tại: **${player.volume}%**`)
            .setColor(0xFFC0CB);

        if (message) await message.reply({ embeds: [embed] });
        else if (interaction) await interaction.reply({ embeds: [embed] });
        return { type: 'success' };
    }

    if (isNaN(volume) || volume < 0 || volume > 100) {
        const errorMsg = 'Âm lượng phải từ 0 đến 100!';
        const embedError = new EmbedBuilder().setDescription(`❌ ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        return { type: 'error', message: errorMsg };
    }

    player.setVolume(volume);

    const embed = new EmbedBuilder()
        .setDescription(`Đã đặt âm lượng thành **${volume}%**`)
        .setColor(0xFFC0CB);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
