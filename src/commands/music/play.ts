import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    AutocompleteInteraction
} from 'discord.js';
import { createCommandConfig } from '../../handlers/CommandHandler.js';
import type { Command, CommandContext, CommandResult, BotClient, SlashCommandContext } from '../../types/index.js';
import { COLORS } from '../../utils/constants.js';
import { setPlayerData } from '../../services/MusicManager.js';
import { smartDelete, DeletePresets } from '../../utils/messageAutoDelete.js';

export default {
    name: 'play',
    description: 'Phát nhạc từ YouTube/Spotify/SoundCloud',
    aliases: ['p', 'pp'],
    config: createCommandConfig({
        category: 'music',
        usage: 'play <tên bài/link>',
        voiceChannel: true,
        cooldown: 3
    }),

    slashCommand: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc từ YouTube/Spotify/SoundCloud')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Tên bài hát hoặc link')
                .setRequired(true)
        ) as SlashCommandBuilder,

    async execute(context: CommandContext): Promise<CommandResult> {
        return await playLogic(context.message.client as BotClient, context.message, context.args.join(' '));
    },

    async executeSlash(context: SlashCommandContext): Promise<CommandResult> {
        const query = context.interaction.options.getString('query', true);
        return await playLogic(context.interaction.client as BotClient, context.interaction, query);
    },

    async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
        const focusedValue = interaction.options.getFocused();
        if (!focusedValue) {
            await interaction.respond([]);
            return;
        }

        const client = interaction.client as BotClient;
        try {
            const result = await client.kazagumo.search(focusedValue, { requester: interaction.user });

            if (!result.tracks.length) {
                await interaction.respond([]);
                return;
            }

            const choices = result.tracks
                .slice(0, 25) // Discord limit is 25
                .map(track => ({
                    name: `${track.title.substring(0, 90)} - ${track.author?.substring(0, 100) || 'Unknown'}`,
                    value: track.uri || focusedValue
                }));

            await interaction.respond(choices);
        } catch (error) {
            await interaction.respond([]);
        }
    }
} as Command;

async function playLogic(client: BotClient, context: any, query: string): Promise<CommandResult> {
    const isInteraction = !!context.isCommand;
    const member = isInteraction ? context.member : context.member;
    const guildId = context.guildId!;

    if (!member?.voice?.channel) {
        const embed = new EmbedBuilder()
            .setDescription(`Huhu, bạn chưa vào phòng Voice kìa!`)
            .setColor(COLORS.ERROR);
        if (isInteraction) await context.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        else await context.reply({ embeds: [embed] });
        return { type: 'error', message: 'No voice channel' };
    }

    if (!query) {
        return { type: 'invalidArguments' };
    }

    if (isInteraction && !context.deferred && !context.replied) {
        await context.deferReply();
    }

    let player = client.kazagumo.players.get(guildId);
    if (!player) {
        player = await client.kazagumo.createPlayer({
            guildId: guildId,
            textId: context.channelId,
            voiceId: member.voice.channel.id,
            volume: 100
        });
    }

    // Set player data so MusicManager knows where to send updates
    setPlayerData(guildId, context.channelId);

    const result = await client.kazagumo.search(query, { requester: member.user });

    if (!result.tracks.length) {
        const embed = new EmbedBuilder()
            .setDescription(`**Không tìm thấy bài hát mà bạn muốn tìm. Vui lòng thử lại.**`)
            .setColor(COLORS.ERROR);
        if (isInteraction) await context.editReply({ embeds: [embed] });
        else await context.reply({ embeds: [embed] });
        return { type: 'error', message: 'No tracks found' };
    }

    if (result.type === 'PLAYLIST' || result.tracks.length === 1 || isValidUrl(query)) {
        const track = result.tracks[0];

        if (result.type === 'PLAYLIST') {
            for (const t of result.tracks) player.queue.add(t);
        } else {
            player.queue.add(track);
        }

        if (!player.playing && !player.paused) player.play();

        // Rich Embed Add To Queue
        const embed = new EmbedBuilder()
            .setColor(COLORS.MAIN)
            .setThumbnail(track.thumbnail || null)
            .setAuthor({
                name: result.type === 'PLAYLIST' ? 'ĐÃ THÊM PLAYLIST NÈ~' : 'ĐÃ THÊM VÀO HÀNG CHỜ ĐÓ~',
                iconURL: member.user.displayAvatarURL()
            })
            .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~', iconURL: member.user.displayAvatarURL() });

        if (result.type === 'PLAYLIST') {
            embed.setDescription(`> Tớ đã thêm cả playlist **${result.playlistName}** vào hàng chờ rồi nha!`)
                .addFields(
                    { name: '<a:li:1444329999971651787>  Số lượng', value: `\`${result.tracks.length}\` bài`, inline: true },
                    { name: '<:guranote:1444001458600022179> Người thêm', value: `\`${member.user.username}\``, inline: true }
                );
        } else {
            const position = player.queue.size;
            const positionText = position === 0 ? 'Đang phát ngay!' : `Vị trí #${position}`;

            embed.setDescription(`> Bài **[${track.title}](${track.uri})** đã được thêm vào hàng chờ rồi nè~`)
                .addFields(
                    { name: '<:member:1452367060419088455>  Nghệ sĩ', value: `\`${track.author}\``, inline: true },
                    { name: '<a:Loading:1452376829062283478> Thời lượng', value: `\`${Math.floor((track.length || 0) / 60000)}:${Math.floor(((track.length || 0) % 60000) / 1000).toString().padStart(2, '0')}\``, inline: true },
                    { name: '<:notebookkk:1444335515024363734>  Vị trí', value: `\`${positionText}\``, inline: true }
                );
        }

        if (isInteraction) {
            const msg = await context.editReply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.TRACK_ADDED);
        } else {
            const msg = await context.reply({ embeds: [embed] });
            smartDelete(msg, DeletePresets.TRACK_ADDED);
        }

        return { type: 'success' };
    }

    // Multiple results -> Select Menu
    const tracks = result.tracks.slice(0, 10);

    const options = tracks.map((track, index) =>
        new StringSelectMenuOptionBuilder()
            .setLabel(`${index + 1}. ${track.title.substring(0, 95)}`)
            .setDescription(track.author ? track.author.substring(0, 95) : 'Unknown Artist')
            .setValue(track.uri || query)
    );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('search_select')
        .setPlaceholder('Chọn bài hát để phát...')
        .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'KẾT QUẢ TÌM KIẾM NÈ~', iconURL: member.user.displayAvatarURL() })
        .setDescription(`> Tìm thấy **${tracks.length}** kết quả cho \`${query}\`. Chọn bên dưới đi nha~`)
        .setColor(COLORS.MAIN)
        .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~', iconURL: member.user.displayAvatarURL() });

    if (isInteraction) await context.editReply({ embeds: [embed], components: [row] });
    else await context.reply({ embeds: [embed], components: [row] });

    return { type: 'success' };
}

function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}
