/**
 * PlayNext Command - Thêm bài vào đầu queue
 * @version 3.0.0
 */

import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { setPlayerData, getRandomConnectedNode } from '../../services/MusicManager.js';
import { QueueManager } from '../../core/index.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

export default {
    name: 'playnext',
    description: 'Thêm bài hát vào đầu hàng chờ',
    aliases: ['pn', 'next'],
    config: createCommandConfig({
        category: 'music',
        usage: 'playnext <tên bài/link>',
        voiceChannel: true,
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('playnext')
        .setDescription('Thêm bài hát vào đầu hàng chờ - phát ngay sau bài hiện tại')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Tên bài hát hoặc link')
                .setRequired(true)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        return await playNextLogic(context.message.client as BotClient, context.message, context.args.join(' '));
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const query = context.interaction.options.getString('query', true);
        return await playNextLogic(context.interaction.client as BotClient, context.interaction, query);
    }
} as Command;

async function playNextLogic(client: BotClient, context: any, query: string): Promise<CommandResult> {
    const isInteraction = !!context.isCommand;
    const member = context.member;
    const guildId = context.guildId!;

    if (!member?.voice?.channel) {
        const embed = new EmbedBuilder()
            .setDescription(`> Vào phòng Voice trước đi! Không có ai nghe thì tớ hát cho ai?!`)
            .setColor(COLORS.ERROR);
        if (isInteraction) {
            await context.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
            const msg = await context.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.NO_PERMISSION);
        }
        return { type: 'error', message: 'No voice channel' };
    }

    if (!query) return { type: 'invalidArguments' };

    let player = client.kazagumo.players.get(guildId);
    if (!player) {
        const randomNode = getRandomConnectedNode(client.kazagumo);
        player = await client.kazagumo.createPlayer({
            guildId,
            textId: context.channelId,
            voiceId: member.voice.channel.id,
            volume: 100,
            nodeName: randomNode
        });
    }

    setPlayerData(guildId, context.channelId);

    if (isInteraction && !context.deferred && !context.replied) {
        await context.deferReply();
    }

    const result = await client.kazagumo.search(query, { requester: member.user });

    if (!result.tracks.length) {
        const embed = new EmbedBuilder()
            .setDescription(`> Không tìm thấy bài đó đâu! Tìm lại đi nha!`)
            .setColor(COLORS.ERROR);
        if (isInteraction) {
            await context.editReply({ embeds: [embed] });
        } else {
            await context.reply({ embeds: [embed] });
        }
        return { type: 'error', message: 'No tracks found' };
    }

    const track = result.tracks[0];

    // Add to front of queue using QueueManager
    QueueManager.addNext(player, track);

    if (!player.playing && !player.paused) player.play();

    const embed = new EmbedBuilder()
        .setColor(COLORS.MAIN)
        .setThumbnail(track.thumbnail || null)
        .setAuthor({
            name: 'SẼ PHÁT TIẾP THEO!',
            iconURL: member.user.displayAvatarURL()
        })
        .setDescription(`> Bài **[${track.title}](${track.uri})** sẽ được phát ngay sau bài hiện tại nha~`)
        .addFields(
            { name: '<c:member:1452367060419088455> Nghệ sĩ', value: `\`${track.author}\``, inline: true },
            { name: '<a:Loading:1452376829062283478> Thời lượng', value: `\`${Math.floor((track.length || 0) / 60000)}:${Math.floor(((track.length || 0) % 60000) / 1000).toString().padStart(2, '0')}\``, inline: true }
        )
        .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~', iconURL: member.user.displayAvatarURL() });

    if (isInteraction) {
        const msg = await context.editReply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.TRACK_ADDED);
    } else {
        const msg = await context.reply({ embeds: [embed] });
        smartDelete(msg, DeletePresets.TRACK_ADDED);
    }

    return { type: 'success' };
}
