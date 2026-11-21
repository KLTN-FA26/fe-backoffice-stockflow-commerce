/**
 * Chuyến cất hàng — map lỗi BE → câu tiếng Việt. Lỗi đặt thùng vào bin dùng chung `putawayConfirmError` (cùng
 * luật cứng với cất một thùng).
 */

import { PUTAWAY_ERROR_MESSAGES, PUTAWAY_TRIP_ERROR_MESSAGES as T } from "@/constants";
import { ApiError } from "@/lib/api/error";

const isTripCode = (code: string): code is keyof typeof T => code in T;

/** Mã làm chuyến trên màn đã cũ (người khác / bộ quét đổi) → màn tải lại thay vì giữ form. */
const STALE = new Set([
  "PUTAWAY_TRIP_INVALID_STATE",
  "PUTAWAY_TRIP_NOT_FOUND",
  "PUTAWAY_TRIP_ALREADY_OPEN",
]);

export interface TripError {
  message: string;
  stale: boolean;
}

export function tripErrorMessage(error: unknown): TripError {
  if (!(error instanceof ApiError))
    return { message: PUTAWAY_ERROR_MESSAGES.generic, stale: false };
  if (isTripCode(error.code)) return { message: T[error.code], stale: STALE.has(error.code) };
  if (
    error.code === "FORBIDDEN" ||
    error.code === "OUT_OF_DATA_SCOPE" ||
    error.code === "NETWORK_ERROR"
  ) {
    return { message: PUTAWAY_ERROR_MESSAGES[error.code], stale: false };
  }
  return { message: error.message || PUTAWAY_ERROR_MESSAGES.generic, stale: false };
}
