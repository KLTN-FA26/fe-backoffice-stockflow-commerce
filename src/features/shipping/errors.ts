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
 * Có tạo `Idempotency-Key` mới cho lần gửi sau không. BE `IdempotencyFilter.isStorable` LƯU mọi
 * response < 500 (trừ 408/409/423/425/429) — kể cả 400 VALIDATION_FAILED: gửi lại cùng key với
 * body đã sửa sẽ bị 422 IDEMPOTENCY_KEY_REUSED mãi. Chỉ giữ key khi request có thể chưa tới / chưa
 * xong ở BE (mất mạng `status 0`, 5xx) — gửi lại đúng request đó thì BE không bàn giao hai lần.
 */
export function shouldRenewIdempotencyKey(error: unknown): boolean {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
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
