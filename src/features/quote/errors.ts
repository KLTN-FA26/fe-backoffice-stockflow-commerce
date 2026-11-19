/**
 * Lỗi báo giá (plan WF-02 A7). BE trả `message` tiếng Việt → hiển thị nguyên văn; map ở đây chỉ để
 * đổi hành vi (tải lại khi dữ liệu cũ). Đã bỏ các mã BE không còn: DESIGN_SAMPLE_NOT_APPROVED,
 * PAYMENT_TERM_NOT_ALLOWED, ORDER_NOT_QUOTED.
 */

import { ApiError } from "@/lib/api/error";
import { serverErrorMessage } from "@/lib/api/error-message";

export const QUOTE_ERROR_OVERRIDES: Readonly<Record<string, string>> = {
  OPTIMISTIC_LOCK: "Dữ liệu vừa thay đổi, đã tải lại.",
};

export function quoteErrorMessage(error: unknown): string {
  return serverErrorMessage(error, QUOTE_ERROR_OVERRIDES);
}

/** Lỗi do dữ liệu đã cũ / đổi trạng thái → tải lại báo giá, không tự gửi lại. */
export const QUOTE_STALE_CODES = ["INVALID_QUOTE_TRANSITION", "QUOTE_EXPIRED"] as const;

/** Lỗi gửi báo giá khi phí khuôn / giá dòng còn thiếu → đưa con trỏ về ô phí (plan §4). */
export const QUOTE_PRICE_MISSING_CODES = ["QUOTE_PLATE_FEE_MISSING", "QUOTE_NOT_PRICED"] as const;

export function isQuoteErrorCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}
