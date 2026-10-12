/**
 * Shipping — map errorCode (contract đề xuất SCRUM-288) → câu tiếng Việt.
 */

import { SHIPPING_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

type KnownErrorCode = Exclude<keyof typeof SHIPPING_ERROR_MESSAGES, "generic">;

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code !== "generic" && Object.hasOwn(SHIPPING_ERROR_MESSAGES, code);
}

export function shippingErrorMessage(error: unknown): string {
  if (error instanceof ApiError && isKnownErrorCode(error.code)) {
    return SHIPPING_ERROR_MESSAGES[error.code];
  }
  return SHIPPING_ERROR_MESSAGES.generic;
}

/** Trạng thái chuyến đã đổi ở nơi khác (máy quét khác, người khác bàn giao) → tải lại. */
export function isStaleLoadError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ["INVALID_LOAD_TRANSITION", "OPTIMISTIC_LOCK", "LOAD_NOT_FULLY_LOADED"].includes(error.code)
  );
}

/**
 * Lỗi làm mọi mã còn trong hàng đợi quét chắc chắn thất bại theo cùng một cách (chuyến không còn
 * LOADING / không còn tồn tại, mất quyền, mất mạng) → dừng hàng đợi thay vì gửi tiếp từng mã.
 */
export function isScanQueueFatal(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return (
    error.status === 0 ||
    error.status === 401 ||
    error.status === 403 ||
    ["INVALID_LOAD_TRANSITION", "LOAD_NOT_FOUND", "OUT_OF_DATA_SCOPE"].includes(error.code)
  );
}
