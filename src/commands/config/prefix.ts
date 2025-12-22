import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import { setGuildPrefix } from '../../database/index.js';
import type { Command, CommandContext, CommandResult, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { smartDelete, DeletePresets, MessageType } from '../../utils/messageAutoDelete.js';

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
        const errorMsg = 'Ngốc quá! Prefix dài hơn **5 ký tự** thì ai mà nhớ được! Viết ngắn lại đi!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    const success = await setGuildPrefix(guildId, newPrefix);

    if (!success) {
        const errorMsg = 'Ư... Có lỗi gì đó rồi, không đổi prefix được đâu! Thử lại sau đi!';
        const embedError = new EmbedBuilder().setDescription(`> ${errorMsg}`).setColor(COLORS.ERROR);
        if (interaction) {
            await interaction.reply({ embeds: [embedError], ephemeral: true });
        } else if (message) {
            const msg = await message.reply({ embeds: [embedError] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
        }
        return { type: 'error', message: errorMsg };
    }

    const embed = new EmbedBuilder()
        .setDescription(`> Hứ, nể tình lắm tớ mới đổi prefix thành **\`${newPrefix}\`** cho đấy nhé!`)
        .setColor(COLORS.SUCCESS);

    if (message) {
        const msg = await message.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.INFO });
    } else if (interaction) {
        const msg = await interaction.reply({ embeds: [embed] });
        smartDelete(msg, { type: MessageType.INFO });
    }

    return { type: 'success' };
}

export default command;
