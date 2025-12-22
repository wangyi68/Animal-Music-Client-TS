import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { createCommandConfig, commands } from '../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, SlashCommandContext } from '../types/index.js';

const command: Command = {
    name: 'help',
    description: 'Xem danh sách lệnh',
    aliases: ['h', 'commands'],
    config: createCommandConfig({
        category: 'info',
        usage: 'help [tên lệnh]',
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Xem danh sách lệnh')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Tên lệnh cần xem chi tiết')
                .setRequired(false)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        const { message, args } = context;
        return await showHelp(args[0], context.prefix, message);
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const { interaction } = context;
        const commandName = interaction.options.getString('command');
        return await showHelp(commandName || undefined, '/', null, interaction);
    }
};

async function showHelp(
    commandName?: string,
    prefix: string = '/',
    message?: any,
    interaction?: any
): Promise<CommandResult> {
    if (!commandName) {
        // Show all commands
        const commandMap = new Map<string, string[]>();

        commands.forEach((cmd) => {
            const category = cmd.config.category || 'general';
            if (!commandMap.has(category)) {
                commandMap.set(category, []);
            }
            commandMap.get(category)!.push(cmd.name);
        });

        const embed = new EmbedBuilder()
            .setAuthor({
                name: 'Danh sách lệnh',
                iconURL: message?.author?.displayAvatarURL?.() || interaction?.user?.displayAvatarURL?.()
            })
            .setDescription(
                `- Chào, mình là bot âm nhạc :3\n` +
                `- Bot hỗ trợ cả **prefix** và **slash commands**!\n` +
                `### Danh sách lệnh\n` +
                `> Dùng \`${prefix}help <tên lệnh>\` để xem chi tiết.`
            )
            .setFooter({ text: 'Music comes first, love follows 💖' })
            .setColor(0xFFC0CB);

        commandMap.forEach((cmds, category) => {
            const formattedCommands = cmds
                .sort()
                .map(c => `\`${c}\``)
                .join(' ');
            embed.addFields({
                name: category.charAt(0).toUpperCase() + category.slice(1),
                value: formattedCommands,
                inline: false
            });
        });

        if (message) {
            await message.reply({ embeds: [embed] });
        } else if (interaction) {
            await interaction.reply({ embeds: [embed] });
        }
        return { type: 'success' };
    }

    // Show specific command help
    const cmd = commands.get(commandName.toLowerCase()) ||
        [...commands.values()].find(c => c.aliases.includes(commandName.toLowerCase()));

    if (!cmd) {
        const errorMsg = `Không tìm thấy lệnh: ${commandName}`;
        const embedError = new EmbedBuilder().setDescription(`❌ ${errorMsg}`).setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        return { type: 'error', message: errorMsg };
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Hướng dẫn sử dụng lệnh ${cmd.name}` })
        .setTitle(`Tên lệnh: ${cmd.name}`)
        .setDescription(
            `- **Mô tả lệnh:** _\`${cmd.description}\`_\n` +
            `- **Cách dùng lệnh:** \`${cmd.config.usage || cmd.name}\`\n` +
            `- **Aliases:** ${cmd.aliases.map(a => `\`${a}\``).join(' | ') || 'Không có'}`
        )
        .addFields(
            { name: 'Cooldown', value: `${cmd.config.cooldown}s`, inline: true },
            { name: 'Voice Channel', value: cmd.config.voiceChannel ? 'Cần' : 'Không', inline: true },
            { name: 'Category', value: cmd.config.category, inline: true }
        )
        .setFooter({ text: 'Hỗ trợ cả prefix và slash commands! 💖' })
        .setColor(0xFFC0CB);

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

export default command;
