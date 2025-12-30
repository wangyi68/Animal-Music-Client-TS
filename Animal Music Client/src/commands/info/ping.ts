import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, MessageType } from '../../utils/messageAutoDelete.js';

const command: Command = {
    name: 'ping',
    description: 'Kiểm tra độ trễ của bot',
    aliases: [],
    config: createCommandConfig({
        category: 'info',
        usage: 'ping',
        cooldown: 5
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Kiểm tra độ trễ của bot') as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message } = context;

        const embedPing = new EmbedBuilder().setDescription('> Đang kiểm tra...').setColor(COLORS.MAIN);
        const sent = await message.reply({ embeds: [embedPing] });
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(message.client.ws.ping);

        const embed = new EmbedBuilder()
            .setTitle('Kết quả Ping')
            .addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
            )
            .setColor(latency < 200 ? COLORS.SUCCESS : latency < 500 ? 0xFFFF00 : COLORS.ERROR);

        const msg = await sent.edit({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.INFO });
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;

        const embedPing = new EmbedBuilder().setDescription('> Đang kiểm tra...').setColor(COLORS.MAIN);
        const sent = await interaction.reply({ embeds: [embedPing], fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setTitle('Kết quả Ping')
            .addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
            )
            .setColor(latency < 200 ? COLORS.SUCCESS : latency < 500 ? 0xFFFF00 : COLORS.ERROR);

        const msg = await interaction.editReply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.INFO });
        return { type: 'success' };
    }
};

export default command;
