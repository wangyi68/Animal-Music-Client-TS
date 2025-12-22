import {
    REST,
    Routes,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    AutocompleteInteraction
} from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { commands, checkCooldown } from './CommandHandler.js';
import type { Config, SlashCommandContext, CommandResult } from '../types/index.js';
import { COLORS } from '../utils/constants.js';

const logger = createLogger('SlashHandler');

// Build slash commands from registered commands
export function buildSlashCommands(): SlashCommandBuilder[] {
    const slashCommands: SlashCommandBuilder[] = [];

    commands.forEach((command) => {
        // If command has custom slashCommand, use it
        if (command.slashCommand) {
            slashCommands.push(command.slashCommand);
        } else {
            // Auto-generate from command data
            const slash = new SlashCommandBuilder()
                .setName(command.name)
                .setDescription(command.description || 'No description');

            // Add query option for music commands
            if (command.config.category === 'music' && command.name === 'play') {
                slash.addStringOption(option =>
                    option.setName('query')
                        .setDescription('Tên bài hát hoặc link YouTube/Spotify')
                        .setRequired(true)
                        .setAutocomplete(true)
                );
            }

            // Add optional arguments for other commands
            if (command.name === 'volume') {
                slash.addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Mức âm lượng (0-100)')
                        .setMinValue(0)
                        .setMaxValue(100)
                        .setRequired(false)
                );
            }

            if (command.name === 'loop') {
                slash.addStringOption(option =>
                    option.setName('mode')
                        .setDescription('Chế độ lặp')
                        .addChoices(
                            { name: 'Tắt', value: 'off' },
                            { name: 'Bài hát', value: 'track' },
                            { name: 'Hàng chờ', value: 'queue' }
                        )
                        .setRequired(false)
                );
            }

            if (command.name === 'prefix') {
                slash.addStringOption(option =>
                    option.setName('newprefix')
                        .setDescription('Prefix mới')
                        .setRequired(true)
                );
            }

            if (command.name === 'queue') {
                slash.addIntegerOption(option =>
                    option.setName('page')
                        .setDescription('Số trang')
                        .setRequired(false)
                );
            }

            if (command.name === 'help') {
                slash.addStringOption(option =>
                    option.setName('command')
                        .setDescription('Tên lệnh cần xem')
                        .setRequired(false)
                );
            }

            slashCommands.push(slash);
        }
    });

    return slashCommands;
}

// Register slash commands with Discord
export async function registerSlashCommands(config: Config, clientId?: string): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(config.app.token);
    const slashCommands = buildSlashCommands();

    // Use provided clientId or fallback to config
    const appId = clientId || config.app.clientId.toString();

    try {
        logger.info(`Registering ${slashCommands.length} slash commands for app ${appId}...`);

        await rest.put(
            Routes.applicationCommands(appId),
            { body: slashCommands.map(cmd => cmd.toJSON()) }
        );

        logger.info('Slash commands registered successfully!');
    } catch (error) {
        logger.error(`Failed to register slash commands: ${(error as Error).message}`);
    }
}

// Handle slash command interaction
export async function handleSlashCommand(
    interaction: ChatInputCommandInteraction,
    _config: Config
): Promise<void> {
    const command = commands.get(interaction.commandName);

    if (!command) {
        const embed = new EmbedBuilder()
            .setDescription('> Hả?! Lệnh này không tồn tại đâu!')
            .setColor(COLORS.ERROR);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    // Check voice channel requirement
    if (command.config.voiceChannel || command.config.category === 'music') {
        const member = interaction.member as any;
        if (!member?.voice?.channel) {
            const embed = new EmbedBuilder()
                .setDescription('> Vào **phòng Voice** đi rồi tớ mới phát nhạc cho!')
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }
    }

    // Check cooldown
    const cooldownRemaining = checkCooldown(
        interaction.user.id,
        command.name,
        command.config.cooldown
    );
    if (cooldownRemaining !== null) {
        const embed = new EmbedBuilder()
            .setDescription(`> Bình tĩnh nào! Đợi **${cooldownRemaining.toFixed(1)}s** nữa đi~`)
            .setColor(COLORS.MAIN);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    try {
        // Create slash context
        const context: SlashCommandContext = { interaction };

        // Use executeSlash if available, otherwise convert to prefix-like execution
        if (command.executeSlash) {
            const result = await command.executeSlash(context);
            await handleSlashResult(interaction, result, command.config);
        } else {
            // Defer reply for commands that might take time
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }

            // Convert slash options to args for prefix command handler
            extractArgsFromInteraction(interaction);

            // Legacy support (not fully implemented here as we prefer strict slash handlers)
            const embed = new EmbedBuilder()
                .setDescription(`> Lệnh **${command.name}** đã được thực thi!`)
                .setColor(COLORS.SUCCESS);
            await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        logger.error(`Error executing slash command ${command.name}: ${(error as Error).message}`);

        const embed = new EmbedBuilder()
            .setDescription('> Có lỗi xảy ra khi thực thi lệnh rồi nè!')
            .setColor(COLORS.ERROR);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
}


export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = commands.get(interaction.commandName);
    if (!command || !command.autocomplete) {
        await interaction.respond([]);
        return;
    }

    try {
        await command.autocomplete(interaction);
    } catch (error) {
        logger.error(`Error in autocomplete for ${command.name}: ${(error as Error).message}`);
    }
}

function extractArgsFromInteraction(interaction: ChatInputCommandInteraction): string[] {
    const args: string[] = [];

    // Extract all options as args
    interaction.options.data.forEach(option => {
        if (option.value !== undefined && option.value !== null) {
            args.push(String(option.value));
        }
    });

    return args;
}

async function handleSlashResult(
    interaction: ChatInputCommandInteraction,
    result: CommandResult,
    _config: any
): Promise<void> {
    switch (result.type) {
        case 'success':
            // Command handles its own response
            break;
        case 'error':
            if (!interaction.replied && !interaction.deferred) {
                const embed = new EmbedBuilder()
                    .setDescription(`> ${result.message}`)
                    .setColor(COLORS.ERROR);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            break;
        case 'invalidArguments':
            const embedArg = new EmbedBuilder()
                .setDescription(`> Sai cách dùng lệnh rồi! Kiểm tra lại đi nha~`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embedArg], flags: MessageFlags.Ephemeral });
            break;
        case 'insufficientPermissions':
            const embedPerm = new EmbedBuilder()
                .setDescription('> Bạn không có quyền dùng lệnh này đâu!')
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embedPerm], flags: MessageFlags.Ephemeral });
            break;
        case 'cooldown':
            const embedCool = new EmbedBuilder()
                .setDescription(`> Bình tĩnh nào! Đợi **${result.remainingTime}s** nữa đi~`)
                .setColor(COLORS.MAIN);
            await interaction.reply({ embeds: [embedCool], flags: MessageFlags.Ephemeral });
            break;
    }
}
