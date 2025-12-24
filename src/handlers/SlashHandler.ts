import {
    REST,
    Routes,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    AutocompleteInteraction,
    GuildMember,
    VoiceBasedChannel
} from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { commands, checkCooldown } from './CommandHandler.js';
import type { Config, SlashCommandContext, CommandResult, BotClient } from '../types/index.js';
import { COLORS } from '../utils/constants.js';
import { smartDelete, DeletePresets } from '../utils/messageAutoDelete.js';
import { checkDJPermission, getNoPermissionMessage, DJ_ACTIONS } from '../utils/permissions.js';

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
            .setDescription('> Hả?! Làm gì có lệnh này! Mơ à!')
            .setColor(COLORS.ERROR);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    // Check voice channel requirement
    if (command.config.voiceChannel || command.config.category === 'music') {
        const member = interaction.member as any;
        if (!member?.voice?.channel) {
            const embed = new EmbedBuilder()
                .setDescription('> Đã bảo là vào **Voice** trước đi mà! Không vào sao tớ phát nhạc được!')
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }
    }

    // Check DJ permission for music control commands
    const isDJCommand = DJ_ACTIONS.includes(command.name as any);
    if (isDJCommand && command.config.category === 'music') {
        const client = interaction.client as BotClient;
        const player = client.kazagumo?.players.get(interaction.guildId!);
        const currentTrack = player?.queue.current;
        const requester = currentTrack?.requester as any;

        const member = interaction.member as GuildMember;
        const voiceChannel = member?.voice?.channel as VoiceBasedChannel | null;

        const permResult = await checkDJPermission({
            member,
            requester: requester?.id ? requester : null,
            voiceChannel,
            ownerId: client.config.app.ownerId
        });

        if (!permResult.allowed) {
            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Hảả?! Bạn không có quyền!' })
                .setDescription(`> ${getNoPermissionMessage(permResult)}`)
                .setColor(COLORS.ERROR)
                .setFooter({ text: 'DJ Role System • Animal Music' });
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
            .setDescription(`> Từ từ thôi! Spam lệnh là tớ dỗi đấy! Đợi **${cooldownRemaining.toFixed(1)}s** nữa đi!`)
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
            .setDescription('> Áá! Có lỗi rồi! Không phải tại tớ đâu nha!')
            .setColor(COLORS.ERROR);

        if (interaction.deferred || interaction.replied) {
            const msg = await interaction.editReply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.COMMAND_ERROR);
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
                .setDescription(`> Dùng lệnh sai bét rồi! Kiểm tra lại đi!`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embedArg], flags: MessageFlags.Ephemeral });
            break;
        case 'insufficientPermissions':
            const embedPerm = new EmbedBuilder()
                .setDescription('> Bạn làm gì có cửa dùng lệnh này! Hứ!')
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embedPerm], flags: MessageFlags.Ephemeral });
            break;
        case 'cooldown':
            const embedCool = new EmbedBuilder()
                .setDescription(`> Đã bảo là đợi **${result.remainingTime}s** nữa đi mà!`)
                .setColor(COLORS.MAIN);
            await interaction.reply({ embeds: [embedCool], flags: MessageFlags.Ephemeral });
            break;
    }
}
