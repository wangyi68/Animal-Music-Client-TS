import { Message, EmbedBuilder } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { getGuildPrefix } from '../database/index.js';
import {
    getCommand,
    checkCooldown,
    checkPermissions
} from './CommandHandler.js';
import { AnimalSync } from '../services/AnimalSync.js';
import type { Config, CommandContext, CommandResult } from '../types/index.js';

const logger = createLogger('MessageHandler');

export async function handleMessage(message: Message, config: Config): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const context = await createMessageContext(message, config);
    if (!context) return;

    await processCommand(context, config);
}

async function createMessageContext(message: Message, config: Config): Promise<CommandContext | null> {
    const { prefix, isMentionPrefix } = await determinePrefix(message, config);

    if (!prefix) return null;

    const contentRaw = message.content;
    const withoutPrefix = contentRaw.slice(prefix.length).trim();

    if (!withoutPrefix) {
        if (isMentionPrefix) {
            await sendBotInfo(message, config);
        }
        return null;
    }

    const args = withoutPrefix.split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return null;

    const command = getCommand(commandName);
    if (!command) {
        if (isMentionPrefix) {
            await sendBotInfo(message, config);
        }
        return null;
    }

    return {
        message,
        args,
        rawArgs: args.join(' '),
        prefix,
        isMentionPrefix
    };
}

async function determinePrefix(message: Message, config: Config): Promise<{ prefix: string | null; isMentionPrefix: boolean }> {
    const content = message.content;
    const botMention = `<@${message.client.user?.id}>`;
    const botMentionNick = `<@!${message.client.user?.id}>`;

    // Check mention prefix
    if (content.startsWith(botMention)) {
        return { prefix: botMention, isMentionPrefix: true };
    }
    if (content.startsWith(botMentionNick)) {
        return { prefix: botMentionNick, isMentionPrefix: true };
    }

    // Check database prefix
    if (message.guild) {
        const dbPrefix = await getGuildPrefix(message.guild.id);
        if (dbPrefix && content.toLowerCase().startsWith(dbPrefix.toLowerCase())) {
            return { prefix: dbPrefix, isMentionPrefix: false };
        }
    }

    // Default prefix
    if (content.toLowerCase().startsWith(config.app.prefix.toLowerCase())) {
        return { prefix: config.app.prefix, isMentionPrefix: false };
    }

    return { prefix: null, isMentionPrefix: false };
}

async function processCommand(context: CommandContext, config: Config): Promise<void> {
    const commandName = context.message.content
        .slice(context.prefix.length)
        .trim()
        .split(/\s+/)[0]
        .toLowerCase();

    const command = getCommand(commandName);
    if (!command) return;

    // Check voice channel requirement
    if (command.config.voiceChannel || command.config.category === 'music') {
        const memberVoice = context.message.member?.voice?.channel;
        if (!memberVoice) {
            await tempReply(context.message, 'Vào phòng Voice đi rồi tớ mới chiều!');
            return;
        }
    }

    // Check cooldown
    const cooldownRemaining = checkCooldown(
        context.message.author.id,
        command.name,
        command.config.cooldown
    );
    if (cooldownRemaining !== null) {
        await tempReply(context.message, `Bình tĩnh nào! Đợi **${cooldownRemaining.toFixed(1)}s** nữa đi~`);
        return;
    }

    // Check permissions
    const permCheck = checkPermissions(
        context,
        command.config.requireUserPermissions,
        command.config.requireBotPermissions
    );
    if (!permCheck.valid) {
        await tempReply(context.message, `Thiếu quyền **${permCheck.missing.join(', ')}** rồi kìa!`);
        return;
    }

    try {
        const result = await command.execute(context);
        handleCommandResult(result, context, command.config);
    } catch (error) {
        logger.error(`Error executing command ${command.name}: ${(error as Error).message}`);
        await sendErrorEmbed(context.message, (error as Error).message);
    }
}

function handleCommandResult(result: CommandResult, context: CommandContext, config: any): void {
    switch (result.type) {
        case 'success':
            break;
        case 'error':
            sendErrorEmbed(context.message, result.message);
            break;
        case 'invalidArguments':
            tempReply(context.message, `Sai cách dùng lệnh rồi! Dùng đúng thế này nè: \`${config.usage}\``);
            break;
        case 'insufficientPermissions':
            tempReply(context.message, 'Bạn không có quyền dùng lệnh này đâu!');
            break;
        case 'cooldown':
            tempReply(context.message, `Bình tĩnh nào! Đợi **${result.remainingTime}s** nữa đi~`);
            break;
    }
}

async function sendBotInfo(message: Message, config: Config): Promise<void> {
    const embed = new EmbedBuilder()
        .setDescription(
            `Chào~ Mình là bot âm nhạc Animal Music nè, prefix của mình là \`${config.app.prefix}\` hoặc là mention tớ để dùng lệnh nha.\n` +
            `Sử dụng \`${config.app.prefix}help\` để biết toàn bộ lệnh của tớ nha~`
        )
        .setColor(0xFFC0CB)
        .setFooter({
            text: 'Music comes first, love follows',
            iconURL: message.client.user?.displayAvatarURL()
        });

    await message.reply({ embeds: [embed] });
}

async function sendErrorEmbed(message: Message, error: string): Promise<void> {
    const embed = new EmbedBuilder()
        .setDescription(`Có lỗi xảy ra rồi nè: \n\`\`\`\n${error.slice(0, 2000)}\n\`\`\``)
        .setColor(0xFF0000);

    const reply = await message.reply({ embeds: [embed] });
    setTimeout(() => reply.delete().catch(() => { }), 20000);
}

export async function tempReply(message: Message, content: string | EmbedBuilder, delay = 10000): Promise<void> {
    const options = typeof content === 'string'
        ? { content }
        : { embeds: [content] };

    const reply = await message.reply(options);
    setTimeout(() => reply.delete().catch(() => { }), delay);
}
