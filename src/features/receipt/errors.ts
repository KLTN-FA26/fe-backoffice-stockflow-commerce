/**
 * Goods receipt — map lỗi BE → câu tiếng Việt (đã thống nhất: mọi lỗi hiển thị tiếng Việt).
 */

import { RECEIPT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

type KnownErrorCode = Exclude<keyof typeof RECEIPT_ERROR_MESSAGES, "generic">;

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code !== "generic" && code in RECEIPT_ERROR_MESSAGES;
}

/** Câu tiếng Việt cho một lỗi bất kỳ khi thao tác với phiếu nhận. */
export function receiptErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (isKnownErrorCode(error.code)) return RECEIPT_ERROR_MESSAGES[error.code];
    // BE đã dịch message sang tiếng Việt cho các lỗi chung còn lại
    if (error.message) return error.message;
  }
  return RECEIPT_ERROR_MESSAGES.generic;
}

/** Lỗi do trạng thái phiếu / Đơn sản xuất / thùng đã đổi ở nơi khác → màn hình nên tải lại dữ liệu. */
export function isStaleReceiptError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    [
      "INVALID_RECEIPT_TRANSITION",
      "PRODUCTION_ORDER_NOT_RECEIVABLE",
      "OPTIMISTIC_LOCK",
      // SCRUM-473: LPN không còn là thùng RECEIVING / IN_STOCK của dòng
      "STOCK_PACKAGE_NOT_FOUND",
      "INVALID_STOCK_PACKAGE_TRANSITION",
      "STOCK_PACKAGE_WRONG_LOCATION",
    ].includes(error.code)
  );
}
