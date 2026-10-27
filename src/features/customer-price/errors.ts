/**
 * Phân loại lỗi bảng giá khách hàng theo `ApiError` (BE `CustomerPriceService`, `GlobalExceptionHandler`).
 * Giữ nguyên `ApiError` cho màn hình; ở đây chỉ đọc `code` / `status` / `fieldErrors`.
 */
import { CUSTOMER_PRICE_ERROR_MESSAGES as E } from "@/constants";
import { ApiError } from "@/lib/api/error";

export type CustomerPriceErrorKind =
  | "VALIDATION_FAILED"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_PRICE_NOT_FOUND"
  | "VARIANT_NOT_FOUND"
  /** POST khi khách đã có giá cho SKU. */
  | "CONFLICT"
  /** PUT với version cũ — tải lại phải do người dùng chọn. */
  | "OPTIMISTIC_LOCK"
  | "FORBIDDEN"
  | "unexpected";

const KNOWN = new Set<CustomerPriceErrorKind>([
  "VALIDATION_FAILED",
  "CUSTOMER_NOT_FOUND",
  "CUSTOMER_PRICE_NOT_FOUND",
  "VARIANT_NOT_FOUND",
  "CONFLICT",
  "OPTIMISTIC_LOCK",
  "FORBIDDEN",
]);

const isKind = (code: string): code is CustomerPriceErrorKind =>
  KNOWN.has(code as CustomerPriceErrorKind);

/**
 * `MALFORMED_REQUEST` / `UNSUPPORTED_PARAMETER` (id hay JSON sai dạng) cũng là dữ liệu không hợp lệ;
 * 403 không có mã riêng vẫn là FORBIDDEN; còn lại (mạng, 5xx, sai hợp đồng) → `unexpected`.
 */
export function customerPriceErrorKind(error: unknown): CustomerPriceErrorKind {
  if (!(error instanceof ApiError)) return "unexpected";
  if (isKind(error.code)) return error.code;
  if (error.status === 403) return "FORBIDDEN";
  if (error.code === "MALFORMED_REQUEST" || error.code === "UNSUPPORTED_PARAMETER") {
    return "VALIDATION_FAILED";
  }
  return "unexpected";
}

export function customerPriceErrorMessage(error: unknown): string {
  return E[customerPriceErrorKind(error)];
}

/**
 * Lỗi theo field của BE (`tiers[0].unitPrice`, `note`…) — tên field giữ nguyên để form map vào ô.
 * Lỗi nghiệp vụ của domain (vd "Two price tiers start at N") không có `fieldErrors` → rỗng.
 */
export function customerPriceFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError && error.code === "VALIDATION_FAILED"
    ? { ...error.fieldErrors }
    : {};
}

/** Dữ liệu trên màn đã cũ → tải lại giá của khách: lệch version, giá vừa bị xoá, POST trùng giá đã có. */
const STALE = new Set(["OPTIMISTIC_LOCK", "CUSTOMER_PRICE_NOT_FOUND", "CONFLICT"]);

export function isStaleCustomerPriceError(error: unknown): boolean {
  return error instanceof ApiError && STALE.has(error.code);
}
