import { Message, InteractionResponse } from 'discord.js';

/**
 * Loại message để xác định thời gian xóa phù hợp
 */
export enum MessageType {
    /** Thông báo lỗi - xóa nhanh */
    ERROR = 'error',
    /** Thông báo thành công ngắn - xóa vừa */
    SUCCESS = 'success',
    /** Thông tin/kết quả tìm kiếm - xóa chậm hơn */
    INFO = 'info',
    /** Danh sách/menu chọn - xóa chậm */
    SELECTION = 'selection',
    /** Thông báo quan trọng - không xóa tự động */
    IMPORTANT = 'important'
}

/**
 * Cấu hình timeout mặc định (ms) cho từng loại message
 */
const BASE_TIMEOUTS: Record<MessageType, number> = {
    [MessageType.ERROR]: 8000,      // 8 giây - lỗi cần đọc nhanh
    [MessageType.SUCCESS]: 10000,   // 10 giây - thành công
    [MessageType.INFO]: 15000,      // 15 giây - thông tin cần đọc
    [MessageType.SELECTION]: 30000, // 30 giây - cần thời gian chọn
    [MessageType.IMPORTANT]: -1     // Không xóa tự động
};

/**
 * Hệ số nhân dựa trên độ dài nội dung
 * Nội dung dài hơn = cần thêm thời gian đọc
 */
function getContentLengthMultiplier(contentLength: number): number {
    if (contentLength <= 50) return 1.0;
    if (contentLength <= 150) return 1.2;
    if (contentLength <= 300) return 1.5;
    if (contentLength <= 500) return 1.8;
    return 2.0;  // Nội dung rất dài
}

/**
 * Hệ số nhân dựa trên số lượng fields trong embed
 */
function getFieldsMultiplier(fieldsCount: number): number {
    if (fieldsCount === 0) return 1.0;
    if (fieldsCount <= 2) return 1.2;
    if (fieldsCount <= 5) return 1.5;
    return 2.0;  // Nhiều fields
}

interface SmartDeleteOptions {
    /** Loại message */
    type?: MessageType;
    /** Độ dài nội dung (tự động tính nếu không cung cấp) */
    contentLength?: number;
    /** Số fields trong embed */
    fieldsCount?: number;
    /** Override timeout cụ thể (ms) - bỏ qua tính toán thông minh */
    overrideTimeout?: number;
    /** Timeout tối thiểu (ms) */
    minTimeout?: number;
    /** Timeout tối đa (ms) */
    maxTimeout?: number;
}

/**
 * Tính toán timeout thông minh dựa trên nhiều yếu tố
 */
export function calculateSmartTimeout(options: SmartDeleteOptions = {}): number {
    const {
        type = MessageType.SUCCESS,
        contentLength = 0,
        fieldsCount = 0,
        overrideTimeout,
        minTimeout = 5000,
        maxTimeout = 60000
    } = options;

    // Nếu có override, sử dụng trực tiếp
    if (overrideTimeout !== undefined) {
        return Math.min(Math.max(overrideTimeout, minTimeout), maxTimeout);
    }

    const baseTimeout = BASE_TIMEOUTS[type];
    
    // Không xóa tự động cho message quan trọng
    if (baseTimeout === -1) return -1;

    // Tính toán multiplier
    const lengthMultiplier = getContentLengthMultiplier(contentLength);
    const fieldsMultiplier = getFieldsMultiplier(fieldsCount);

    // Tính timeout cuối cùng
    let finalTimeout = baseTimeout * lengthMultiplier * fieldsMultiplier;

    // Áp dụng giới hạn
    finalTimeout = Math.min(Math.max(finalTimeout, minTimeout), maxTimeout);

    return Math.round(finalTimeout);
}

/**
 * Tự động xóa message sau một khoảng thời gian thông minh
 * @param message Message hoặc InteractionResponse cần xóa
 * @param options Tùy chọn để tính timeout
 * @returns Timer ID (có thể dùng để cancel)
 */
export function smartDelete(
    message: Message | InteractionResponse | any,
    options: SmartDeleteOptions = {}
): NodeJS.Timeout | null {
    const timeout = calculateSmartTimeout(options);
    
    // Không xóa nếu timeout = -1
    if (timeout === -1) return null;

    return setTimeout(() => {
        if (message?.delete) {
            message.delete().catch(() => { });
        } else if (message?.deleteReply) {
            message.deleteReply().catch(() => { });
        }
    }, timeout);
}

/**
 * Helper function để xóa message lỗi (8-16 giây)
 */
export function deleteAfterError(message: Message | any, contentLength = 100): NodeJS.Timeout {
    return smartDelete(message, {
        type: MessageType.ERROR,
        contentLength
    }) as NodeJS.Timeout;
}

/**
 * Helper function để xóa message thành công (10-20 giây)
 */
export function deleteAfterSuccess(message: Message | any, contentLength = 100): NodeJS.Timeout {
    return smartDelete(message, {
        type: MessageType.SUCCESS,
        contentLength
    }) as NodeJS.Timeout;
}

/**
 * Helper function để xóa message thông tin (15-30 giây)
 */
export function deleteAfterInfo(message: Message | any, contentLength = 200, fieldsCount = 0): NodeJS.Timeout {
    return smartDelete(message, {
        type: MessageType.INFO,
        contentLength,
        fieldsCount
    }) as NodeJS.Timeout;
}

/**
 * Helper function để xóa message có selection menu (30-60 giây)
 */
export function deleteAfterSelection(message: Message | any): NodeJS.Timeout {
    return smartDelete(message, {
        type: MessageType.SELECTION
    }) as NodeJS.Timeout;
}

/**
 * Presets cho các trường hợp phổ biến
 */
export const DeletePresets = {
    /** Thông báo cooldown - 8 giây */
    COOLDOWN: { type: MessageType.ERROR, contentLength: 50 },
    /** Thông báo thiếu quyền - 10 giây */
    NO_PERMISSION: { type: MessageType.ERROR, contentLength: 100 },
    /** Thêm bài hát thành công - 10 giây */
    TRACK_ADDED: { type: MessageType.SUCCESS, contentLength: 150, fieldsCount: 2 },
    /** Thêm playlist thành công - 15 giây */
    PLAYLIST_ADDED: { type: MessageType.SUCCESS, contentLength: 200, fieldsCount: 3 },
    /** Hiển thị queue - 20 giây */
    QUEUE_DISPLAY: { type: MessageType.INFO, contentLength: 500, fieldsCount: 0 },
    /** Kết quả tìm kiếm - 30 giây */
    SEARCH_RESULTS: { type: MessageType.SELECTION },
    /** Thông báo dừng nhạc - 8 giây */
    MUSIC_STOPPED: { type: MessageType.SUCCESS, contentLength: 50 },
    /** Lỗi command - 15 giây (cần đọc lỗi) */
    COMMAND_ERROR: { type: MessageType.ERROR, contentLength: 300 }
} as const;
