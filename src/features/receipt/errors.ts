/**
 * Goods receipt — map lỗi BE → câu tiếng Việt (đã thống nhất: mọi lỗi hiển thị tiếng Việt).
 *
 * BE trả lỗi nghiệp vụ qua `errorCode` (409) KHÔNG kèm `fieldErrors` (GoodsReceiptServiceImpl,
 * PR #62); chỉ lỗi `@Valid` mới có `fieldErrors` dạng `lines[0].quantity`.
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

/** Lỗi do trạng thái phiếu / PO đã đổi ở nơi khác → màn hình nên tải lại dữ liệu. */
export function isStaleReceiptError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ["INVALID_RECEIPT_TRANSITION", "PURCHASE_ORDER_NOT_RECEIVABLE", "OPTIMISTIC_LOCK"].includes(
      error.code,
    )
  );
}

export interface ReceiptLineFieldError {
  /** Chỉ số dòng trong form kiểm đếm. */
  index: number;
  field: string;
  message: string;
}

const LINE_FIELD = /^lines\[(\d+)\]\.(\w+)$/;

/** `fieldErrors` của `@Valid ReceiptLinesRequest` (`lines[2].locationCode`) → lỗi theo dòng form. */
export function receiptLineFieldErrors(error: ApiError): ReceiptLineFieldError[] {
  return Object.entries(error.fieldErrors ?? {}).flatMap(([name, message]) => {
    const match = LINE_FIELD.exec(name);
    if (!match) return [];
    const [, index, field] = match;
    return [
      { index: Number(index), field, message: message || RECEIPT_ERROR_MESSAGES.VALIDATION_FAILED },
    ];
  });
}
