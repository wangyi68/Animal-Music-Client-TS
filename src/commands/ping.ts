import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, SlashCommandContext } from '../types/index.js';

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

        const embedPing = new EmbedBuilder().setDescription('🏓 Pinging...').setColor(0xFFC0CB);
        const sent = await message.reply({ embeds: [embedPing] });
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(message.client.ws.ping);

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
            )
            .setColor(latency < 200 ? 0x00FF00 : latency < 500 ? 0xFFFF00 : 0xFF0000);

        await sent.edit({ embeds: [embed] });
        return { type: 'success' };
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;

        const embedPing = new EmbedBuilder().setDescription('🏓 Pinging...').setColor(0xFFC0CB);
        const sent = await interaction.reply({ embeds: [embedPing], fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Bot Latency', value: `${latency}ms`, inline: true },
                { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
            )
            .setColor(latency < 200 ? 0x00FF00 : latency < 500 ? 0xFFFF00 : 0xFF0000);

        await interaction.editReply({ embeds: [embed] });
        return { type: 'success' };
    }
};

export default command;
