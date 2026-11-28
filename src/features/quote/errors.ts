/**
 * Lỗi báo giá (plan WF-02 A7). BE trả `message` tiếng Việt → hiển thị nguyên văn; map ở đây chỉ để
 * đổi hành vi (tải lại khi dữ liệu cũ). Đã bỏ các mã BE không còn: DESIGN_SAMPLE_NOT_APPROVED,
 * PAYMENT_TERM_NOT_ALLOWED, ORDER_NOT_QUOTED.
 */

import { ApiError } from "@/lib/api/error";
import { GENERIC_API_ERROR, serverErrorMessage } from "@/lib/api/error-message";
import { salesOwnerErrorMessage } from "@/lib/references/sales-owner-access";

export const QUOTE_ERROR_OVERRIDES: Readonly<Record<string, string>> = {
  OPTIMISTIC_LOCK: "Dữ liệu vừa thay đổi, đã tải lại.",
};

/** Khoá lạc quan khi LƯU trong form sửa: form có nút "Tải lại theo bản mới", các thao tác ở trang chi tiết thì không có. */
export const QUOTE_EDIT_LOCK_MESSAGE =
  "Báo giá vừa được người khác sửa — bấm 'Tải lại theo bản mới' rồi sửa lại.";

/**
 * Câu dự phòng theo mã khi BE không kèm câu tiếng Việt (14 BR-10, 13 BR-04 sửa ngày 2026-11-26) — BE có câu thì hiện câu
 * của BE.
 */
export const QUOTE_ERROR_FALLBACKS: Readonly<Record<string, string>> = {
  QUOTE_PRICE_REVIEW_PENDING: "Báo giá đang chờ duyệt giá; rút lại để sửa.",
  QUOTE_PRICE_REVIEW_NOT_PENDING: "Báo giá không còn chờ duyệt giá — đã tải lại.",
  QUOTE_PRICE_REVIEW_SELF: "Giá phải do người khác với người gửi duyệt phê duyệt.",
  STANDARD_PRICE_NOT_FOUND: "Quy cách này chưa có giá chuẩn.",
  STANDARD_PRICE_VARIANT_REQUIRED:
    "Giá chuẩn đặt cho quy cách của danh mục, không đặt cho SKU riêng của khách.",
};

/**
 * `ownerName`: người phụ trách màn đang biết — để câu BR-S12 (409 CUSTOMER_OWNED_BY_OTHER_SALES) nêu đúng tên dù BE không
 * gửi kèm.
 */
export function quoteErrorMessage(error: unknown, ownerName?: string | null): string {
  const owned = salesOwnerErrorMessage(error, ownerName);
  if (owned) return owned;
  const fallback = error instanceof ApiError ? QUOTE_ERROR_FALLBACKS[error.code] : undefined;
  return serverErrorMessage(error, QUOTE_ERROR_OVERRIDES, fallback ?? GENERIC_API_ERROR);
}

/**
 * Lỗi do dữ liệu đã cũ / đổi trạng thái → tải lại báo giá, không tự gửi lại. Gồm hai mã duyệt giá (14 BR-10): báo giá
 * vừa được gửi duyệt / vừa được duyệt, từ chối hay rút lại ở nơi khác.
 */
export const QUOTE_STALE_CODES = [
  "INVALID_QUOTE_TRANSITION",
  "QUOTE_EXPIRED",
  "QUOTE_PRICE_REVIEW_PENDING",
  "QUOTE_PRICE_REVIEW_NOT_PENDING",
] as const;

/** Lỗi gửi báo giá khi phí khuôn / giá dòng còn thiếu → đưa con trỏ về ô phí (plan §4). */
export const QUOTE_PRICE_MISSING_CODES = ["QUOTE_PLATE_FEE_MISSING", "QUOTE_NOT_PRICED"] as const;

export function isQuoteErrorCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}
