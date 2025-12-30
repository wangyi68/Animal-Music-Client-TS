/**
 * ErrorHandler - Unified Error Handling System
 * @version 3.0.0
 */

import { EmbedBuilder, Message, ChatInputCommandInteraction, ButtonInteraction, MessageFlags } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { COLORS } from '../utils/constants.js';
import { smartDelete, DeletePresets } from '../utils/messageAutoDelete.js';

const logger = createLogger('ErrorHandler');

export enum ErrorCode {
    UNKNOWN = 1000, TIMEOUT = 1001, RATE_LIMITED = 1002, PERMISSION_DENIED = 1003,
    NOT_IN_VOICE = 2000, BOT_NOT_IN_VOICE = 2001, DIFFERENT_VOICE_CHANNEL = 2002, VOICE_CONNECT_FAILED = 2003,
    NO_PLAYER = 3000, PLAYER_CREATION_FAILED = 3002, NO_TRACK_PLAYING = 3003, QUEUE_EMPTY = 3004,
    NO_RESULTS = 4000, TRACK_LOAD_FAILED = 4001, TRACK_UNAVAILABLE = 4002, SEARCH_FAILED = 4004,
    NO_NODES_AVAILABLE = 5000, NODE_CONNECTION_FAILED = 5001, TRACK_DECODE_FAILED = 5003,
    INVALID_ARGUMENTS = 6000, COOLDOWN = 6001, NOT_TRACK_REQUESTER = 6003,
    CONFIG_INVALID = 7000, DATABASE_ERROR = 7002
}

export interface BotError {
    code: ErrorCode;
    message: string;
    userMessage: string;
    details?: any;
    recoverable: boolean;
    retryable: boolean;
    retryAfter?: number;
}

const USER_MESSAGES: Record<ErrorCode, string> = {
    [ErrorCode.UNKNOWN]: 'Á! Có lỗi gì đó xảy ra rồi! Không phải tại tớ đâu nha!',
    [ErrorCode.TIMEOUT]: 'Chờ lâu quá rồi! Thử lại đi nha~',
    [ErrorCode.RATE_LIMITED]: 'Từ từ thôi! Đừng spam lệnh nữa!',
    [ErrorCode.PERMISSION_DENIED]: 'Bạn không có quyền dùng cái này đâu! Hứ!',
    [ErrorCode.NOT_IN_VOICE]: 'Vào phòng voice trước đi! Đứng ngoài mà đòi nghe nhạc à?!',
    [ErrorCode.BOT_NOT_IN_VOICE]: 'Tớ còn chưa vào voice mà! Dùng lệnh play trước đi!',
    [ErrorCode.DIFFERENT_VOICE_CHANNEL]: 'Bạn khác phòng voice với tớ rồi!',
    [ErrorCode.VOICE_CONNECT_FAILED]: 'Không vào được voice channel! Kiểm tra quyền của tớ đi!',
    [ErrorCode.NO_PLAYER]: 'Chưa phát nhạc gì mà! Sao tớ biết làm gì được!',
    [ErrorCode.PLAYER_CREATION_FAILED]: 'Không tạo được player! Có vấn đề gì đó rồi!',
    [ErrorCode.NO_TRACK_PLAYING]: 'Không có bài nào đang phát! Queue trống trơn rồi!',
    [ErrorCode.QUEUE_EMPTY]: 'Hàng chờ trống không mà! Thêm nhạc đi nào!',
    [ErrorCode.NO_RESULTS]: 'Tìm mãi không thấy bài đó! Thử từ khóa khác xem!',
    [ErrorCode.TRACK_LOAD_FAILED]: 'Không load được bài này! Có thể bị chặn hoặc xóa rồi!',
    [ErrorCode.TRACK_UNAVAILABLE]: 'Bài này không khả dụng rồi! Tìm bài khác đi nha!',
    [ErrorCode.SEARCH_FAILED]: 'Không tìm kiếm được! Thử lại sau nha!',
    [ErrorCode.NO_NODES_AVAILABLE]: 'Không có server nhạc nào sẵn sàng! Thử lại sau nha!',
    [ErrorCode.NODE_CONNECTION_FAILED]: 'Không kết nối được server nhạc!',
    [ErrorCode.TRACK_DECODE_FAILED]: 'Không decode được bài này! Thử phát lại xem!',
    [ErrorCode.INVALID_ARGUMENTS]: 'Dùng lệnh sai rồi! Xem lại cách dùng đi nha!',
    [ErrorCode.COOLDOWN]: 'Nóng vội quá! Đợi chút đi nào!',
    [ErrorCode.NOT_TRACK_REQUESTER]: 'Bài này không phải bạn yêu cầu mà đòi điều khiển!',
    [ErrorCode.CONFIG_INVALID]: 'Config có vấn đề! Kiểm tra lại file config nha!',
    [ErrorCode.DATABASE_ERROR]: 'Database có vấn đề! Nhưng bot vẫn chạy được~'
};

class ErrorHandlerClass {
    private static instance: ErrorHandlerClass;
    private errorCounts: Map<ErrorCode, number> = new Map();

    private constructor() { }

    public static getInstance(): ErrorHandlerClass {
        if (!ErrorHandlerClass.instance) {
            ErrorHandlerClass.instance = new ErrorHandlerClass();
        }
        return ErrorHandlerClass.instance;
    }

    public createError(code: ErrorCode, details?: any, customMessage?: string): BotError {
        const error: BotError = {
            code,
            message: customMessage || `Error ${code}: ${ErrorCode[code]}`,
            userMessage: USER_MESSAGES[code] || USER_MESSAGES[ErrorCode.UNKNOWN],
            details,
            recoverable: ![ErrorCode.CONFIG_INVALID, ErrorCode.PERMISSION_DENIED].includes(code),
            retryable: [ErrorCode.TIMEOUT, ErrorCode.RATE_LIMITED, ErrorCode.VOICE_CONNECT_FAILED, ErrorCode.SEARCH_FAILED].includes(code),
            retryAfter: code === ErrorCode.RATE_LIMITED ? 5000 : code === ErrorCode.TIMEOUT ? 2000 : undefined
        };
        this.trackError(code);
        return error;
    }

    public fromException(error: Error | any, fallbackCode: ErrorCode = ErrorCode.UNKNOWN): BotError {
        const message = error.message?.toLowerCase() || '';
        let code = fallbackCode;

        if (message.includes('voice') && message.includes('not established')) code = ErrorCode.VOICE_CONNECT_FAILED;
        else if (message.includes('no nodes')) code = ErrorCode.NO_NODES_AVAILABLE;
        else if (message.includes('track decode')) code = ErrorCode.TRACK_DECODE_FAILED;
        else if (message.includes('timeout')) code = ErrorCode.TIMEOUT;

        return this.createError(code, { originalError: error.message });
    }

    public async handle(error: BotError | Error, context: Message | ChatInputCommandInteraction | ButtonInteraction | any, options: { ephemeral?: boolean } = {}): Promise<void> {
        const botError = !(error as BotError).code ? this.fromException(error) : error as BotError;
        logger.error(`[${ErrorCode[botError.code]}] ${botError.message}`);

        const embed = new EmbedBuilder().setColor(COLORS.ERROR).setDescription(`> ${botError.userMessage}`);

        try {
            if (context instanceof Message) {
                const msg = await context.reply({ embeds: [embed] });
                smartDelete(msg, DeletePresets.COMMAND_ERROR);
            } else if (context.deferred) {
                await context.editReply({ embeds: [embed] });
            } else if (context.replied) {
                await context.followUp({ embeds: [embed], flags: options.ephemeral ? MessageFlags.Ephemeral : undefined });
            } else {
                await context.reply({ embeds: [embed], flags: options.ephemeral ? MessageFlags.Ephemeral : undefined });
            }
        } catch (e) { logger.error('Failed to send error response'); }
    }

    public simpleErrorEmbed(message: string): EmbedBuilder {
        return new EmbedBuilder().setColor(COLORS.ERROR).setDescription(`> ${message}`);
    }

    public async withRetry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
        let lastError: Error | null = null;
        for (let i = 1; i <= maxRetries; i++) {
            try { return await fn(); }
            catch (e: any) { lastError = e; if (i < maxRetries) await new Promise(r => setTimeout(r, delay * i)); }
        }
        throw lastError;
    }

    private trackError(code: ErrorCode): void {
        this.errorCounts.set(code, (this.errorCounts.get(code) || 0) + 1);
    }

    public getErrorStats(): { code: ErrorCode; name: string; count: number }[] {
        return Array.from(this.errorCounts.entries()).map(([code, count]) => ({ code, name: ErrorCode[code], count })).sort((a, b) => b.count - a.count);
    }
}

export const ErrorHandler = ErrorHandlerClass.getInstance();
export default ErrorHandler;
