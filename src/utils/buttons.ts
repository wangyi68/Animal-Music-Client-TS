import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { EMOJIS } from './constants.js';
import { LoopMode } from '../types/index.js';
import type { KazagumoPlayer } from 'kazagumo';

export function createPlayerControlButtons(player: KazagumoPlayer, loopMode: LoopMode): ActionRowBuilder<ButtonBuilder>[] {
    const isPaused = player.paused;

    // Row 1: Playback Controls
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Trước')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!player.queue.previous.length),
        new ButtonBuilder()
            .setCustomId('pause_resume')
            .setLabel(isPaused ? 'Tiếp tục' : 'Tạm dừng')
            .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('Dừng')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('skip')
            .setLabel('Bỏ qua')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('queue_btn')
            .setLabel('Hàng chờ')
            .setStyle(ButtonStyle.Secondary)
    );

    // Apply Emojis if they exist
    if (EMOJIS.PREV) (row1.components[0] as ButtonBuilder).setEmoji(EMOJIS.PREV);
    if (isPaused ? EMOJIS.PLAY : EMOJIS.PAUSE) (row1.components[1] as ButtonBuilder).setEmoji(isPaused ? EMOJIS.PLAY : EMOJIS.PAUSE);
    if (EMOJIS.STOP) (row1.components[2] as ButtonBuilder).setEmoji(EMOJIS.STOP);
    if (EMOJIS.NEXT) (row1.components[3] as ButtonBuilder).setEmoji(EMOJIS.NEXT);

    // Calculate Loop Label/Style
    let loopLabel = 'Lặp: Tắt';
    let loopStyle = ButtonStyle.Secondary;
    if (loopMode === LoopMode.TRACK) { loopLabel = 'Lặp: Bài'; loopStyle = ButtonStyle.Success; }
    if (loopMode === LoopMode.QUEUE) { loopLabel = 'Lặp: Danh sách'; loopStyle = ButtonStyle.Success; }

    // Row 2: Mode Controls + Search
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('loop')
            .setLabel(loopLabel)
            .setStyle(loopStyle),
        new ButtonBuilder()
            .setCustomId('shuffle')
            .setLabel('Trộn bài')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('search_btn')
            .setLabel('Tìm kiếm')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('volume_btn')
            .setLabel(`${player.volume}%`)
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('clear')
            .setLabel('Dọn hàng chờ')
            .setStyle(ButtonStyle.Danger)
    );

    // Apply Emojis if they exist
    if (EMOJIS.LOOP) (row2.components[0] as ButtonBuilder).setEmoji(EMOJIS.LOOP);
    if (EMOJIS.SHUFFLE) (row2.components[1] as ButtonBuilder).setEmoji(EMOJIS.SHUFFLE);
    if (EMOJIS.SEARCH) (row2.components[2] as ButtonBuilder).setEmoji(EMOJIS.SEARCH);
    if (EMOJIS.VOLUME) (row2.components[3] as ButtonBuilder).setEmoji(EMOJIS.VOLUME);

    return [row1, row2];
}
