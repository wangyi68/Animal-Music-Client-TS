import {
    Interaction,
    ButtonInteraction,
    StringSelectMenuInteraction,
    ModalSubmitInteraction,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonStyle,
    ButtonBuilder,
    ComponentType,
    TextChannel
} from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { setLoopMode, getLoopMode, setPlayerData } from '../services/MusicManager.js';
import type { BotClient, LoopMode } from '../types/index.js';
import { COLORS, EMOJIS } from '../utils/constants.js';
import { createPlayerControlButtons } from '../utils/buttons.js';

const logger = createLogger('InteractionHandler');

function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

export async function handleInteraction(interaction: Interaction, config: any): Promise<void> {
    if (interaction.isButton()) {
        await handleButton(interaction);
    } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
    } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
    }
}



async function handleButton(interaction: ButtonInteraction): Promise<void> {
    const client = interaction.client as BotClient;
    const player = client.kazagumo.players.get(interaction.guildId!);

    if (!player) {
        const embed = new EmbedBuilder()
            .setDescription(`${EMOJIS.ERROR} Không có nhạc đang phát.`)
            .setColor(COLORS.ERROR);

        if (interaction.message) {
            const rows = interaction.message.components.map(row => {
                const newRow = new ActionRowBuilder<ButtonBuilder>();
                (row as any).components.forEach((comp: any) => {
                    if (comp.type === ComponentType.Button) {
                        const btn = ButtonBuilder.from(comp as any);
                        btn.setDisabled(true);
                        newRow.addComponents(btn);
                    }
                });
                return newRow;
            });
            if (rows.length > 0 && rows[0].components.length > 0) {
                await interaction.update({ components: rows });
                return;
            }
        }
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        return;
    }

    const { customId } = interaction;
    let updateNeeded = false;

    switch (customId) {
        case 'prev':
            const previousTracks = player.queue.previous;
            if (!previousTracks || previousTracks.length === 0) {
                const embed = new EmbedBuilder().setDescription('❌ Không có bài trước đó.').setColor(COLORS.ERROR);
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }
            const previousTrack = previousTracks.pop();
            if (previousTrack) {
                player.queue.unshift(previousTrack);
                player.skip();
                await interaction.deferUpdate();
            }
            return;

        case 'pause_resume':
            const isPaused = player.paused;
            player.pause(!isPaused);
            updateNeeded = true;
            break;

        case 'stop':
            await player.destroy();
            await interaction.message.delete().catch(() => { });
            const embedStop = new EmbedBuilder().setDescription('Đã dừng nhạc nè~').setColor(COLORS.MAIN);
            const channel = interaction.channel as TextChannel;
            if (channel) {
                await channel.send({ embeds: [embedStop] })
                    .then((msg: any) => setTimeout(() => msg.delete().catch(() => { }), 10000));
            }
            return;

        case 'skip':
            player.skip();
            await interaction.deferUpdate();
            return;

        case 'loop':
            const currentMode = getLoopMode(interaction.guildId!);
            const newMode = (currentMode + 1) % 3 as LoopMode;
            setLoopMode(interaction.guildId!, newMode);
            updateNeeded = true;
            break;

        case 'shuffle':
            player.queue.shuffle();
            const embedShuffle = new EmbedBuilder().setDescription('Tớ đã xáo trộn lại danh sách bài hát giúp bạn rồi nè!').setColor(COLORS.MAIN);
            await interaction.reply({ embeds: [embedShuffle], flags: MessageFlags.Ephemeral });
            return;

        case 'clear':
            player.queue.clear();
            const embedClear = new EmbedBuilder().setDescription('Tớ đã dọn dẹp danh sách chờ sạch bóng luôn rồi đó~').setColor(COLORS.MAIN);
            await interaction.reply({ embeds: [embedClear], flags: MessageFlags.Ephemeral });
            return;
    }

    if (customId === 'search_btn') {
        const searchModal = new ModalBuilder()
            .setCustomId('search_modal')
            .setTitle('Gửi bản nhạc bạn yêu thích vào đây nè~');
        const searchInput = new TextInputBuilder()
            .setCustomId('search_input')
            .setLabel('Nói cho tớ yêu cầu của bạn nha')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Nhập tên bài hoặc link YouTube nè...')
            .setRequired(true);
        const searchRow = new ActionRowBuilder<TextInputBuilder>().addComponents(searchInput);
        searchModal.addComponents(searchRow);
        await interaction.showModal(searchModal);
        return;
    }

    if (customId === 'volume_btn') {
        const modal = new ModalBuilder()
            .setCustomId('volume_modal')
            .setTitle('Điều chỉnh âm lượng');
        const volumeInput = new TextInputBuilder()
            .setCustomId('volume_input')
            .setLabel('Nhập âm lượng (0-100)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(player.volume.toString())
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(3);
        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(volumeInput);
        modal.addComponents(firstActionRow);
        await interaction.showModal(modal);
        return;
    }

    if (updateNeeded) {
        const loopMode = getLoopMode(interaction.guildId!);
        const components = createPlayerControlButtons(player, loopMode);
        await interaction.update({ components: components });
    }
}

async function handleSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    const client = interaction.client as BotClient;
    const { customId, values, guildId } = interaction;
    const embedFn = new EmbedBuilder().setColor(COLORS.MAIN);

    if (customId === 'search_select') {
        const uri = values[0];

        await interaction.deferUpdate();

        let player = client.kazagumo.players.get(guildId!);
        if (!player) {
            const member = interaction.member as any;
            if (member?.voice?.channel) {
                player = await client.kazagumo.createPlayer({
                    guildId: guildId!,
                    textId: interaction.channelId!,
                    voiceId: member.voice.channel.id,
                    volume: 100
                });
            } else {
                return;
            }
        }

        setPlayerData(guildId!, interaction.channelId!);

        const result = await client.kazagumo.search(uri, { requester: interaction.user });
        if (!result.tracks.length) {
            embedFn.setDescription(`${EMOJIS.ERROR} Không thể phát bài hát này!`);
            embedFn.setColor(COLORS.ERROR);
            await interaction.followUp({ embeds: [embedFn], flags: MessageFlags.Ephemeral });
            return;
        }

        const track = result.tracks[0];
        player.queue.add(track);
        if (!player.playing && !player.paused) player.play();

        const embed = new EmbedBuilder()
            .setColor(COLORS.MAIN)
            .setThumbnail(track.thumbnail || null)
            .setAuthor({
                name: 'ĐÃ THÊM VÀO HÀNG CHỜ',
                iconURL: interaction.user.displayAvatarURL()
            })
            .setDescription(`**[${track.title}](${track.uri})**`)
            .addFields(
                { name: 'Tác giả', value: `\`${track.author}\``, inline: true },
                { name: 'Thời lượng', value: `\`${Math.floor((track.length || 0) / 60000)}:${Math.floor(((track.length || 0) % 60000) / 1000).toString().padStart(2, '0')}\``, inline: true }
            )
            .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~', iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed], components: [] })
            .then((msg: any) => {
                setTimeout(() => msg.delete().catch(() => { }), 10000);
            });
        return;
    }

    await interaction.deferUpdate();
}

async function handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    const client = interaction.client as BotClient;
    const player = client.kazagumo.players.get(interaction.guildId!);

    if (interaction.customId === 'volume_modal') {
        if (!player) {
            const embed = new EmbedBuilder()
                .setDescription(`Không có nhạc đang phát.`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const volumeStr = interaction.fields.getTextInputValue('volume_input');
        const volume = parseInt(volumeStr);

        if (isNaN(volume) || volume < 0 || volume > 100) {
            const embed = new EmbedBuilder()
                .setDescription(`Vui lòng nhập số từ 0-100.`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        player.setVolume(volume);
        const embed = new EmbedBuilder()
            .setDescription(`Đã đặt âm lượng: **${volume}%**`)
            .setColor(COLORS.MAIN);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (interaction.customId === 'search_modal') {
        const query = interaction.fields.getTextInputValue('search_input');
        const guildId = interaction.guildId!;

        if (!player) {
            const embed = new EmbedBuilder()
                .setDescription(`Vui lòng dùng lệnh \`/play\` trước để tạo phiên nghe nhạc.`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        setPlayerData(guildId, interaction.channelId!);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await client.kazagumo.search(query, { requester: interaction.user });

        if (!result.tracks.length) {
            const embed = new EmbedBuilder()
                .setDescription(`Không tìm thấy bài hát nào cho \`${query}\`.`)
                .setColor(COLORS.ERROR);
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (result.type === 'PLAYLIST' || result.tracks.length === 1 || isValidUrl(query)) {
            const track = result.tracks[0];
            if (result.type === 'PLAYLIST') {
                for (const t of result.tracks) player.queue.add(t);
            } else {
                player.queue.add(track);
            }
            if (!player.playing && !player.paused) player.play();

            const embed = new EmbedBuilder()
                .setColor(COLORS.MAIN)
                .setThumbnail(track.thumbnail || null)
                .setAuthor({
                    name: result.type === 'PLAYLIST' ? 'ĐÃ THÊM PLAYLIST NÈ~' : 'ĐÃ THÊM VÀO HÀNG CHỜ ĐÓ~',
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~', iconURL: interaction.user.displayAvatarURL() });

            if (result.type === 'PLAYLIST') {
                embed.setDescription(`Đã thêm playlist **${result.playlistName}** vào hàng chờ!`)
                    .addFields(
                        { name: 'Số lượng', value: `\`${result.tracks.length}\` bài hát`, inline: true },
                        { name: 'Người thêm', value: `\`${interaction.user.username}\``, inline: true }
                    );
            } else {
                embed.setDescription(`**[${track.title}](${track.uri})**`)
                    .addFields(
                        { name: 'Tác giả', value: `\`${track.author}\``, inline: true },
                        { name: 'Thời lượng', value: `\`${Math.floor((track.length || 0) / 60000)}:${Math.floor(((track.length || 0) % 60000) / 1000).toString().padStart(2, '0')}\``, inline: true }
                    );
            }

            await interaction.editReply({ embeds: [embed] })
                .then((msg: any) => {
                    setTimeout(() => msg.delete().catch(() => { }), 10000);
                });
        } else {
            const tracks = result.tracks.slice(0, 10);
            const options = tracks.map((track, index) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${index + 1}. ${track.title.substring(0, 95)}`)
                    .setDescription(track.author ? track.author.substring(0, 95) : 'Unknown Artist')
                    .setValue(track.uri || query)
            );

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('search_select')
                .setPlaceholder('Chọn bài hát...')
                .addOptions(options);

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'KẾT QUẢ TÌM KIẾM NÈ~', iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`Tìm thấy nhiều kết quả lắm luôn. Hãy chọn bên dưới nha:`)
                .setColor(COLORS.MAIN)
                .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~', iconURL: interaction.user.displayAvatarURL() });

            await interaction.editReply({ embeds: [embed], components: [row] })
                .then((msg: any) => {
                    setTimeout(() => msg.delete().catch(() => { }), 30000); // Give user more time to select
                });
        }
    }
}
