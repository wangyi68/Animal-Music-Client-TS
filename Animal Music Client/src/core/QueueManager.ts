/**
 * QueueManager - Enhanced Queue Management
 * @version 3.0.0
 */

import { EventEmitter } from 'events';
import { KazagumoTrack, KazagumoPlayer } from 'kazagumo';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('QueueManager');

export interface QueueStats {
    size: number;
    totalDuration: number;
    uniqueRequesters: number;
}

class QueueManagerClass extends EventEmitter {
    private static instance: QueueManagerClass;

    private constructor() {
        super();
        logger.info('QueueManager initialized');
    }

    public static getInstance(): QueueManagerClass {
        if (!QueueManagerClass.instance) {
            QueueManagerClass.instance = new QueueManagerClass();
        }
        return QueueManagerClass.instance;
    }

    /**
     * Thêm track vào đầu queue (play next)
     */
    public addNext(player: KazagumoPlayer, track: KazagumoTrack): void {
        player.queue.unshift(track);
        this.emit('trackAddedNext', { guildId: player.guildId, track });
    }

    /**
     * Xóa track theo index
     */
    public remove(player: KazagumoPlayer, index: number): KazagumoTrack | null {
        if (index < 0 || index >= player.queue.size) return null;
        const queue = [...player.queue];
        const removed = queue.splice(index, 1)[0];
        player.queue.clear();
        queue.forEach(t => player.queue.add(t));
        this.emit('trackRemoved', { guildId: player.guildId, track: removed, index });
        return removed;
    }

    /**
     * Di chuyển track từ vị trí này sang vị trí khác
     */
    public move(player: KazagumoPlayer, from: number, to: number): boolean {
        if (from < 0 || from >= player.queue.size || to < 0 || to >= player.queue.size) return false;
        const queue = [...player.queue];
        const [track] = queue.splice(from, 1);
        queue.splice(to, 0, track);
        player.queue.clear();
        queue.forEach(t => player.queue.add(t));
        this.emit('trackMoved', { guildId: player.guildId, from, to });
        return true;
    }

    /**
     * Xóa các bài trùng lặp trong queue
     */
    public removeDuplicates(player: KazagumoPlayer): number {
        const seen = new Set<string>();
        const unique: KazagumoTrack[] = [];
        let removed = 0;

        for (const track of player.queue) {
            const key = track.uri || track.title;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(track);
            } else {
                removed++;
            }
        }

        if (removed > 0) {
            player.queue.clear();
            unique.forEach(t => player.queue.add(t));
        }
        return removed;
    }

    /**
     * Đảo ngược queue
     */
    public reverse(player: KazagumoPlayer): void {
        const queue = [...player.queue].reverse();
        player.queue.clear();
        queue.forEach(t => player.queue.add(t));
        this.emit('queueReversed', { guildId: player.guildId });
    }

    /**
     * Lấy thống kê queue
     */
    public getStats(player: KazagumoPlayer): QueueStats {
        const tracks = [...player.queue];
        const requesters = new Set(tracks.map(t => (t.requester as any)?.id).filter(Boolean));

        return {
            size: tracks.length,
            totalDuration: tracks.reduce((sum, t) => sum + (t.length || 0), 0),
            uniqueRequesters: requesters.size
        };
    }

    /**
     * Tìm tracks theo keyword
     */
    public search(player: KazagumoPlayer, keyword: string): { index: number; track: KazagumoTrack }[] {
        const results: { index: number; track: KazagumoTrack }[] = [];
        const lowerKeyword = keyword.toLowerCase();

        [...player.queue].forEach((track, index) => {
            if (track.title.toLowerCase().includes(lowerKeyword) ||
                track.author?.toLowerCase().includes(lowerKeyword)) {
                results.push({ index, track });
            }
        });

        return results;
    }

    /**
     * Xóa tracks của một user cụ thể
     */
    public removeByUser(player: KazagumoPlayer, userId: string): number {
        const queue = [...player.queue];
        const filtered = queue.filter(t => (t.requester as any)?.id !== userId);
        const removed = queue.length - filtered.length;

        if (removed > 0) {
            player.queue.clear();
            filtered.forEach(t => player.queue.add(t));
        }
        return removed;
    }

    /**
     * Lấy queue slice với pagination
     */
    public getPage(player: KazagumoPlayer, page: number, pageSize: number = 10): { tracks: KazagumoTrack[]; totalPages: number; currentPage: number } {
        const queue = [...player.queue];
        const totalPages = Math.ceil(queue.length / pageSize) || 1;
        const currentPage = Math.max(1, Math.min(page, totalPages));
        const start = (currentPage - 1) * pageSize;

        return {
            tracks: queue.slice(start, start + pageSize),
            totalPages,
            currentPage
        };
    }

    /**
     * Fair shuffle - đảm bảo các user được phân bổ đều
     */
    public fairShuffle(player: KazagumoPlayer): void {
        const queue = [...player.queue];
        const byUser = new Map<string, KazagumoTrack[]>();

        // Group by user
        queue.forEach(track => {
            const userId = (track.requester as any)?.id || 'unknown';
            if (!byUser.has(userId)) byUser.set(userId, []);
            byUser.get(userId)!.push(track);
        });

        // Shuffle each user's tracks
        byUser.forEach(tracks => {
            for (let i = tracks.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
            }
        });

        // Interleave
        const result: KazagumoTrack[] = [];
        const userQueues = Array.from(byUser.values());
        let maxIndex = Math.max(...userQueues.map(q => q.length));

        for (let i = 0; i < maxIndex; i++) {
            for (const userQueue of userQueues) {
                if (i < userQueue.length) {
                    result.push(userQueue[i]);
                }
            }
        }

        player.queue.clear();
        result.forEach(t => player.queue.add(t));
        this.emit('queueFairShuffled', { guildId: player.guildId });
    }
}

export const QueueManager = QueueManagerClass.getInstance();
export default QueueManager;
