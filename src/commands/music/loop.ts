import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import { setLoopMode, getLoopMode } from '../../services/MusicManager.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext, LoopMode } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets, MessageType } from '../../utils/messageAutoDelete.js';

const LOOP_MODES = ['Tắt', 'Bài hát', 'Hàng chờ'];

const command: Command = {
    name: 'loop',
    description: 'Bật/tắt lặp lại bài hát hoặc hàng chờ',
    aliases: ['repeat'],
    config: createCommandConfig({
        category: 'music',
        usage: 'loop [track/queue/off]',
        cooldown: 3,
        voiceChannel: true
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Bật/tắt lặp lại bài hát hoặc hàng chờ')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Chế độ lặp')
                .addChoices(
                    { name: 'Tắt', value: 'off' },
                    { name: 'Bài hát', value: 'track' },
                    { name: 'Hàng chờ', value: 'queue' }
                )
                .setRequired(false)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message, args } = context;
        const client = message.client as BotClient;
        return await toggleLoop(client, message.guild!.id, args[0], message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const client = interaction.client as BotClient;
        const mode = interaction.options.getString('mode') || undefined;
        return await toggleLoop(client, interaction.guild!.id, mode, null, interaction);
    }
};

async function toggleLoop(
    client: BotClient,
    guildId: string,
    modeArg?: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    const player = client.kazagumo.players.get(guildId);

    if (!player) {
        const errorMsg = 'Loop cái gì khi chưa có nhạc vậy hả?!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    let newMode: LoopMode;
    const arg = modeArg?.toLowerCase();

    if (arg === 'track' || arg === 'song' || arg === '1') {
        newMode = 1;
    } else if (arg === 'queue' || arg === 'all' || arg === '2') {
        newMode = 2;
    } else if (arg === 'off' || arg === 'none' || arg === '0') {
        newMode = 0;
    } else {
        const currentMode = getLoopMode(guildId);
        newMode = ((currentMode + 1) % 3) as LoopMode;
    }

    setLoopMode(guildId, newMode);

    const embed = new EmbedBuilder()
        .setDescription(`> Đã chuyển chế độ lặp sang **${LOOP_MODES[newMode]}** rồi nha! Nghe cho chán thì thôi!`)
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
