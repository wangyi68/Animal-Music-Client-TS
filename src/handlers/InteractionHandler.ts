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
    ButtonBuilder,
    ComponentType,
    TextChannel
} from 'discord.js';
import { setLoopMode, getLoopMode, setPlayerData } from '../services/MusicManager.js';
import type { BotClient, LoopMode } from '../types/index.js';
import { COLORS } from '../utils/constants.js';
import { createPlayerControlButtons } from '../utils/buttons.js';
import {
    smartDelete,
    MessageType,
    DeletePresets
} from '../utils/messageAutoDelete.js';



function isValidUrl(string: string): boolean {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

export async function handleInteraction(interaction: Interaction, _config: any): Promise<void> {
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
            .setDescription(`> Không có nhạc mà cứ bấm nút loạn xạ à! Im lặng đi!`)
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

    // Check if user is the song requester (optional - allow others to control)
    const currentTrack = player.queue.current;
    const requester = currentTrack?.requester as any;
    const isRequester = !requester || requester?.id === interaction.user.id;

    // For certain actions, check if user is the requester or has permission
    const restrictedActions = ['stop', 'clear_btn', 'loop', 'shuffle', 'pause_resume', 'skip', 'prev', 'next', 'volume'];
    if (restrictedActions.includes(customId) && !isRequester) {
        const member = interaction.member as any;
        const hasPermission = member?.permissions?.has?.('ManageGuild');

        if (!hasPermission) {
            const errorEmbed = new EmbedBuilder()
                .setAuthor({ name: 'Hảả?! Mấy cái nút này không phải của bạn!' })
                .setDescription(`> Bài hát này là yêu cầu của: ${requester?.toString?.() || 'Không rõ'}\n> Đừng có táy máy tay chân!`)
                .setColor(COLORS.ERROR);
            const reply = await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            smartDelete(reply, DeletePresets.NO_PERMISSION);
            return;
        }
    }

    switch (customId) {
        case 'prev':
            const previousTracks = player.queue.previous;
            if (!previousTracks || previousTracks.length === 0) {
                const embed = new EmbedBuilder().setDescription('> Hết đường lùi rồi! Đừng có cố nữa!').setColor(COLORS.ERROR);
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
            const embedStop = new EmbedBuilder().setDescription('Dừng rồi đấy! Vừa lòng chưa?').setColor(COLORS.MAIN);
            const channel = interaction.channel as TextChannel;
            if (channel) {
                const msg = await channel.send({ embeds: [embedStop] });
                smartDelete(msg, DeletePresets.MUSIC_STOPPED);
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
            const embedShuffle = new EmbedBuilder().setDescription('Đã xáo trộn giúp rồi đấy! Rối tung lên cho xem!').setColor(COLORS.MAIN);
            await interaction.reply({ embeds: [embedShuffle], flags: MessageFlags.Ephemeral });
            return;

        case 'clear':
            player.queue.clear();
            const embedClear = new EmbedBuilder().setDescription('Dọn sạch sẽ rồi! Đừng có bày bừa ra nữa nha!').setColor(COLORS.MAIN);
            await interaction.reply({ embeds: [embedClear], flags: MessageFlags.Ephemeral });
            return;

        case 'queue_btn':
            const current = player.queue.current;
            const tracks = [...player.queue].slice(0, 10);

            let description = current
                ? `**Đang phát:** [${current.title}](${current.uri})\n\n`
                : 'Không có bài nào đang phát.\n\n';

            if (tracks.length > 0) {
                description += '**Hàng chờ:**\n';
                description += tracks.map((track, i) => `\`${i + 1}.\` [${track.title}](${track.uri})`).join('\n');
                if (player.queue.size > 10) {
                    description += `\n\n...và còn ${player.queue.size - 10} bài nữa`;
                }
            } else {
                description += '*Hàng chờ đang trống trơn rồi đó~*';
            }

            const embedQueue = new EmbedBuilder()
                .setAuthor({ name: 'HÀNG CHỜ HIỆN TẠI NÈ~', iconURL: interaction.user.displayAvatarURL() })
                .setDescription(description)
                .setFooter({ text: `Tổng cộng ${player.queue.size} bài trong hàng chờ` })
                .setColor(COLORS.MAIN);

            await interaction.reply({ embeds: [embedQueue], flags: MessageFlags.Ephemeral });
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
            embedFn.setDescription(`> Không thể phát bài hát này rồi nè!`);
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

        const msg = await interaction.editReply({ embeds: [embed], components: [] });
        smartDelete(msg, DeletePresets.TRACK_ADDED);
        return;
    }

    // Handle help menu selection
    if (customId === 'help_menu') {
        const { createCategoryEmbed } = await import('../commands/info/help.js');
        const embeds = createCategoryEmbed(values, interaction.user, '/');

        if (embeds.length > 0) {
            await interaction.update({ embeds: embeds, components: [] });
        } else {
            const noCommandsEmbed = new EmbedBuilder()
                .setDescription('> Không tìm thấy lệnh nào trong danh mục này nè.')
                .setColor(COLORS.ERROR);
            await interaction.update({ embeds: [noCommandsEmbed], components: [] });
        }
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
                .setDescription(`> Chưa bật nhạc mà đòi chỉnh volume! Ngáo à?`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        const volumeStr = interaction.fields.getTextInputValue('volume_input');
        const volume = parseInt(volumeStr);

        if (isNaN(volume) || volume < 0 || volume > 100) {
            const embed = new EmbedBuilder()
                .setDescription(`> Đã bảo là từ **0** đến **100** thôi! Không biết đếm à?`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        player.setVolume(volume);
        const embed = new EmbedBuilder()
            .setDescription(`> Rồi rồi! Đã chỉnh xuống **${volume}%** rồi nhé! Đừng bắt tớ chỉnh nữa!`)
            .setColor(COLORS.MAIN);
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    else if (interaction.customId === 'search_modal') {
        const query = interaction.fields.getTextInputValue('search_input');
        const guildId = interaction.guildId!;

        if (!player) {
            const embed = new EmbedBuilder()
                .setDescription(`> Dùng lệnh \`/play\` trước đi! Đừng có đốt cháy giai đoạn!`)
                .setColor(COLORS.ERROR);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            return;
        }

        setPlayerData(guildId, interaction.channelId!);
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const result = await client.kazagumo.search(query, { requester: interaction.user });

        if (!result.tracks.length) {
            const embed = new EmbedBuilder()
                .setDescription(`> Tìm mãi chả thấy gì cho \`${query}\` cả! Tìm cái khác đi!`)
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
                embed.setDescription(`> Tớ đã thêm playlist **${result.playlistName}** vào hàng chờ rồi nha!`)
                    .addFields(
                        { name: 'Số lượng', value: `\`${result.tracks.length}\` bài hát`, inline: true },
                        { name: 'Người thêm', value: `\`${interaction.user.username}\``, inline: true }
                    );
            } else {
                embed.setDescription(`> Bài **[${track.title}](${track.uri})** đã được thêm vào hàng chờ rồi nè~`)
                    .addFields(
                        { name: 'Tác giả', value: `\`${track.author}\``, inline: true },
                        { name: 'Thời lượng', value: `\`${Math.floor((track.length || 0) / 60000)}:${Math.floor(((track.length || 0) % 60000) / 1000).toString().padStart(2, '0')}\``, inline: true }
                    );
            }

            const msgResult = await interaction.editReply({ embeds: [embed] });
            smartDelete(msgResult, {
                type: MessageType.SUCCESS,
                contentLength: 200,
                fieldsCount: 2
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
                .setDescription(`> Tìm thấy nhiều kết quả lắm! Chọn bên dưới đi nha~`)
                .setColor(COLORS.MAIN)
                .setFooter({ text: 'Gửi ngàn lời thương vào bản nhạc này~', iconURL: interaction.user.displayAvatarURL() });

            const searchMsg = await interaction.editReply({ embeds: [embed], components: [row] });
            smartDelete(searchMsg, DeletePresets.SEARCH_RESULTS);
        }
    }
}
