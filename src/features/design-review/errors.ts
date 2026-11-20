/**
 * Lỗi khi duyệt / trả lại thiết kế (BE `DesignReviewService.java:166-388`, `common/error/ErrorCode.java`). BE trả `message`
 * tiếng Việt → hiện nguyên văn (`DESIGN_PRINT_FILE_INVALID`, `CUSTOMER_SKU_SOURCE_UNAVAILABLE`, `PRINT_CONFIG_NOT_FOUND`,
 * `refusal.design.changed`); chỉ đổi câu khi câu BE viết cho khách hoặc khi FE đổi hành vi.
 */

import { DESIGN_REVIEW_LABELS } from "@/constants";

import { ApiError } from "@/lib/api/error";
import { serverErrorMessage } from "@/lib/api/error-message";

export const DESIGN_REVIEW_ERROR_OVERRIDES: Readonly<Record<string, string>> = {
  // Câu BE ("Hãy xuất lại bộ file…") viết cho khách.
  DESIGN_FILES_OUTDATED:
    "File khách gửi không còn khớp bố cục / cấu hình in hiện tại — hãy trả lại kèm lý do để khách gửi lại.",
  NOT_FOUND: `${DESIGN_REVIEW_LABELS.notFoundTitle} (đã được duyệt, trả lại hoặc khách đã xoá).`,
};

export function designReviewErrorMessage(error: unknown): string {
  return serverErrorMessage(error, DESIGN_REVIEW_ERROR_OVERRIDES);
}

/** Dữ liệu đã cũ / thiết kế không còn chờ duyệt → tải lại chi tiết; 404 sau đó hiện "không còn chờ duyệt". */
export const DESIGN_STALE_CODES = ["CONFLICT", "OPTIMISTIC_LOCK", "NOT_FOUND"] as const;

/** File khách gửi không dùng được để duyệt → gợi ý trả lại; `DESIGN_FILES_OUTDATED` mở sẵn hộp trả lại. */
export const DESIGN_RETURN_SUGGEST_CODES = [
  "DESIGN_FILES_OUTDATED",
  "DESIGN_PRINT_FILE_INVALID",
] as const;

export function isDesignErrorCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}

/**
 * Không biết kết quả: axios hết giờ / mất mạng (status 0) hoặc BFF hết giờ chờ Spring (502 `BACKEND_UNAVAILABLE`, 504).
 * BE có thể đã duyệt xong → không gửi lại (gửi lại sẽ gặp `CONFLICT`).
 */
export function isUncertainOutcome(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 0 ||
      error.status === 504 ||
      error.code === "NETWORK_ERROR" ||
      error.code === "BACKEND_UNAVAILABLE")
  );
}
