/**
 * Phân loại lỗi giá chuẩn theo `ApiError` (BE `StandardPriceService`, `GlobalExceptionHandler`). Giữ nguyên `ApiError`
 * cho màn hình; ở đây chỉ đọc `code` / `status` / `fieldErrors`.
 */
import { STANDARD_PRICE_ERROR_MESSAGES as E } from "@/constants";
import { ApiError } from "@/lib/api/error";

export type StandardPriceErrorKind = keyof typeof E;

const isKind = (code: string): code is StandardPriceErrorKind =>
  code !== "unexpected" && Object.hasOwn(E, code);

/**
 * `MALFORMED_REQUEST` / `UNSUPPORTED_PARAMETER` cũng là dữ liệu không hợp lệ; 403 không có mã riêng vẫn là FORBIDDEN;
 * còn lại (mạng, 5xx, sai hợp đồng) → `unexpected`.
 */
export function standardPriceErrorKind(error: unknown): StandardPriceErrorKind {
  if (!(error instanceof ApiError)) return "unexpected";
  if (isKind(error.code)) return error.code;
  if (error.status === 403) return "FORBIDDEN";
  if (error.code === "MALFORMED_REQUEST" || error.code === "UNSUPPORTED_PARAMETER") {
    return "VALIDATION_FAILED";
  }
  return "unexpected";
}

export function standardPriceErrorMessage(error: unknown): string {
  return E[standardPriceErrorKind(error)];
}

/** Lỗi theo field của BE (`tiers[0].unitPrice`, `note`…) — tên field giữ nguyên để form map vào ô. */
export function standardPriceFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.code === "VALIDATION_FAILED"
    ? { ...error.fieldErrors }
    : {};
}

/** Dữ liệu trên màn đã cũ → tải lại giá chuẩn: lệch version, giá vừa bị xoá, POST trùng giá đã có. */
const STALE: readonly string[] = ["OPTIMISTIC_LOCK", "STANDARD_PRICE_NOT_FOUND", "CONFLICT"];

export function isStaleStandardPriceError(error: unknown): boolean {
  return error instanceof ApiError && STALE.includes(error.code);
}
