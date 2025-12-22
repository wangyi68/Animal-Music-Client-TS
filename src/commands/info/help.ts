import {
    EmbedBuilder,
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import { createCommandConfig, commands } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, SlashCommandContext } from '../../types/index.js';

// Category emoji IDs (for select menu - format: { id, animated })
const CATEGORY_EMOJIS: Record<string, { id: string; animated: boolean }> = {
    'music': { id: '1452561033800454249', animated: true },
    'info': { id: '1444337540210491392', animated: true },
    'config': { id: '1444336524224233594', animated: false },
};

// Category icons for embed display
const CATEGORY_ICONS: Record<string, string> = {
    'music': '<a:spotif:1452561033800454249>',
    'info': '<a:hasta:1444337540210491392>',
    'config': '<:staff:1444336524224233594>',
};

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
    const user = message?.author || interaction?.user;

    if (!commandName) {
        // Get all categories
        const categoryMap = new Map<string, string[]>();

        commands.forEach((cmd) => {
            const category = cmd.config.category || 'general';
            if (!categoryMap.has(category)) {
                categoryMap.set(category, []);
            }
            categoryMap.get(category)!.push(cmd.name);
        });

        const categories = [...categoryMap.keys()];

        // Create select menu options for each category
        const menuOptions = categories.map(category => {
            const option = new StringSelectMenuOptionBuilder()
                .setLabel(category.charAt(0).toUpperCase() + category.slice(1))
                .setDescription(`Xem các lệnh về ${category}`)
                .setValue(category)
                .setDefault(false);

            // Add emoji if available
            const emojiData = CATEGORY_EMOJIS[category];
            if (emojiData) {
                option.setEmoji({ id: emojiData.id, animated: emojiData.animated });
            }

            return option;
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Chọn danh mục lệnh nè~')
            .setMinValues(1)
            .setMaxValues(Math.min(categories.length, 3))
            .addOptions(menuOptions);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        // Create category list for embed
        const categoryList = categories.map(category => {
            const icon = CATEGORY_ICONS[category] || '•';
            const count = categoryMap.get(category)?.length || 0;
            return `> ${icon} **${category.charAt(0).toUpperCase() + category.slice(1)}** - \`${count}\` lệnh`;
        }).join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({
                name: 'BẢNG LỆNH ANIMAL MUSIC',
                iconURL: user?.displayAvatarURL?.()
            })
            .setDescription(
                `Chào mừng **${user?.username || 'bạn'}** đến với Animal Music nè~\n\n` +
                `### Các danh mục lệnh\n${categoryList}\n\n` +
                `> Chọn danh mục bên dưới để xem chi tiết nha!`
            )
            .addFields({
                name: 'Hướng dẫn sử dụng',
                value: `- Dùng \`${prefix}help <tên lệnh>\` để xem chi tiết 1 lệnh\n` +
                    `- Hoặc chọn menu bên dưới để xem theo danh mục`,
                inline: false
            })
            .setFooter({
                text: `Prefix: ${prefix} • Hỗ trợ cả prefix và slash commands`,
                iconURL: user?.displayAvatarURL?.()
            })
            .setColor(0xFFC0CB)
            .setTimestamp();

        if (message) {
            const reply = await message.reply({ embeds: [embed], components: [row] });
            // Auto delete after 5 minutes
            setTimeout(() => reply.delete().catch(() => { }), 5 * 60 * 1000);
        } else if (interaction) {
            await interaction.reply({ embeds: [embed], components: [row] });
        }
        return { type: 'success' };
    }

    // Show specific command help
    const cmd = commands.get(commandName.toLowerCase()) ||
        [...commands.values()].find(c => c.aliases.includes(commandName.toLowerCase()));

    if (!cmd) {
        const errorMsg = `Không tìm thấy lệnh: **${commandName}**`;
        const embedError = new EmbedBuilder()
            .setDescription(`> ${errorMsg}`)
            .setColor(0xFF0000);
        if (interaction) await interaction.reply({ embeds: [embedError], ephemeral: true });
        else if (message) await message.reply({ embeds: [embedError] });
        return { type: 'error', message: errorMsg };
    }

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `Hướng dẫn lệnh: ${cmd.name}`,
            iconURL: user?.displayAvatarURL?.()
        })
        .setDescription(
            `### Thông tin lệnh\n` +
            `> **Mô tả:** ${cmd.description}\n` +
            `> **Cách dùng:** \`${prefix}${cmd.config.usage || cmd.name}\`\n` +
            `> **Aliases:** ${cmd.aliases.length > 0 ? cmd.aliases.map(a => `\`${a}\``).join(', ') : '*Không có*'}`
        )
        .addFields(
            { name: 'Danh mục', value: `\`${cmd.config.category}\``, inline: true },
            { name: 'Cooldown', value: `\`${cmd.config.cooldown}s\``, inline: true },
            { name: 'Cần Voice', value: cmd.config.voiceChannel ? '`Có`' : '`Không`', inline: true }
        )
        .setFooter({
            text: 'Hỗ trợ cả prefix và slash commands!',
            iconURL: user?.displayAvatarURL?.()
        })
        .setColor(0xFFC0CB)
        .setTimestamp();

    if (message) {
        await message.reply({ embeds: [embed] });
    } else if (interaction) {
        await interaction.reply({ embeds: [embed] });
    }

    return { type: 'success' };
}

// Export function to generate category embed (used by InteractionHandler)
export function createCategoryEmbed(categories: string[], user: any, prefix: string = '/'): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    for (const category of categories) {
        const categoryCommands = [...commands.values()].filter(
            cmd => cmd.config.category === category
        );

        if (categoryCommands.length === 0) continue;

        const icon = CATEGORY_ICONS[category] || '•';
        const commandList = categoryCommands.map(cmd => `\`${cmd.name}\``).join(', ');

        const fields = categoryCommands.map(cmd => ({
            name: `**${cmd.name}** ${cmd.aliases.length > 0 ? `*(${cmd.aliases.join(', ')})*` : ''}`,
            value: `> ${cmd.description}\n> Cách dùng: \`${prefix}${cmd.config.usage || cmd.name}\``,
            inline: false
        }));

        const embed = new EmbedBuilder()
            .setAuthor({
                name: `${icon} ${category.toUpperCase()} - ${categoryCommands.length} lệnh`,
                iconURL: user?.displayAvatarURL?.()
            })
            .setDescription(`Danh sách lệnh: ${commandList}`)
            .addFields(fields.slice(0, 25)) // Discord limit
            .setFooter({
                text: `Prefix: ${prefix}`,
                iconURL: user?.displayAvatarURL?.()
            })
            .setColor(0xFFC0CB)
            .setTimestamp();

        embeds.push(embed);
    }

    return embeds;
}

export default command;
