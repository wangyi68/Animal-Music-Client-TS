import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import { setGuildPrefix } from '../../database/index.js';
import type { Command, CommandContext, CommandResult, SlashCommandContext } from '../../types/index.js';

const command: Command = {
    name: 'prefix',
    description: 'Thay đổi prefix của bot trong server',
    aliases: ['setprefix', 'changeprefix'],
    config: createCommandConfig({
        category: 'config',
        usage: 'prefix <prefix mới>',
        cooldown: 10,
        requireUserPermissions: [PermissionFlagsBits.ManageGuild]
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('prefix')
        .setDescription('Thay đổi prefix của bot trong server')
        .addStringOption(option =>
            option.setName('newprefix')
                .setDescription('Prefix mới (tối đa 5 ký tự)')
                .setRequired(true)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message, args } = context;
        if (args.length === 0) return { type: 'invalidArguments' };
        return await changePrefix(message.guild!.id, args[0], message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const newPrefix = interaction.options.getString('newprefix', true);
        return await changePrefix(interaction.guild!.id, newPrefix, null, interaction);
    }
};

async function changePrefix(
    guildId: string,
    newPrefix: string,
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    if (newPrefix.length > 5) {
        const errorMsg = 'Prefix không được dài quá **5 ký tự** nha!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });
        return { type: 'error', message: errorMsg };
    }

    const success = await setGuildPrefix(guildId, newPrefix);

    if (!success) {
        const errorMsg = 'Không thể thay đổi prefix rồi nè!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });
        return { type: 'error', message: errorMsg };
    }

    const embed = new EmbedBuilder()
        .setDescription(`> Tớ đã thay đổi prefix thành **\`${newPrefix}\`** rồi nha!`)
        .setColor(0x00FF00);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
