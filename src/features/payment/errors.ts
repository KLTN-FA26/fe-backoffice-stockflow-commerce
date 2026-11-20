/**
 * Lỗi BE của module thanh toán → câu tiếng Việt.
 * - Phiếu thu (lập / huỷ): BE đã dịch (`messages_vi`, PR #365) và nêu số phiếu / đơn → `receiptErrorMessage` hiện
 *   `message` của BE; câu FE theo `errorCode` chỉ là dự phòng khi BE không kèm câu.
 * - Hoàn tiền, `EXPORT_TOO_LARGE`, `NOT_FOUND` của đơn: BE vẫn trả câu tiếng Anh tự viết (WF-02 N4) nên
 *   `paymentErrorMessage` chọn câu FE theo `errorCode`. Đổi sang `message` khi BE dịch phần này.
 */

import { ApiError } from "@/lib/api/error";
import {
  apiErrorMessage,
  COMMON_API_ERROR_MESSAGES,
  serverErrorMessage,
} from "@/lib/api/error-message";
import { formatMoney } from "@/lib/format/money";

export const PAYMENT_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INSTALLMENT_NOT_FOUND: "Không tìm thấy đợt thanh toán.",
  // docs 15 BR-05: đợt Paid / Cancelled không nhận thêm tiền
  INSTALLMENT_NOT_PAYABLE:
    "Đợt này đã thanh toán đủ hoặc đã huỷ nên không nhận thêm tiền. Dữ liệu đã được tải lại.",
  // docs 15 BR-05: một phiếu thu chỉ trả các đợt của cùng một khách
  INSTALLMENT_CUSTOMER_MISMATCH:
    "Có đợt thuộc khách hàng khác. Một phiếu thu chỉ ghi cho một khách.",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách hàng.",
  PAYMENT_RECEIPT_NOT_FOUND: "Không tìm thấy phiếu thu.",
  // docs 15 BR-03: một mã sao kê chỉ dùng cho một phiếu thu còn hiệu lực
  PAYMENT_RECEIPT_REFERENCE_IN_USE:
    "Mã tham chiếu sao kê này đã được ghi trong một phiếu thu còn hiệu lực.",
  // docs 15 BR-05: không có tiền dư — mỗi dòng không vượt số còn phải thu
  PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING:
    "Có dòng trả nhiều hơn số đợt đó còn phải thu. Dữ liệu đã được tải lại, kiểm tra lại số tiền.",
  // docs 15 BR-04: phiếu thu huỷ một lần
  PAYMENT_RECEIPT_ALREADY_VOIDED: "Phiếu thu này đã được huỷ. Dữ liệu đã được tải lại.",
  // docs 15 §4.4 bước 13
  PAYMENT_RECEIPT_VOID_NOT_ALLOWED:
    "Không huỷ được phiếu thu vì đơn đã huỷ, hoàn tất, đóng, đang trả hàng hoặc đã ghi nhận hoàn tiền.",
  // docs 15 BR-13 / §4.4 bước 14
  PAYMENT_RECEIPT_VOID_NEEDS_HOLD:
    "Huỷ phiếu này làm đơn đã xác nhận thiếu đợt khi ký. Hãy chọn “Treo đơn” để tiếp tục.",
  REFUND_EXCEEDS_REFUNDABLE: "Số tiền vượt số còn phải hoàn của đơn. Dữ liệu đã được tải lại.",
  REFUND_RECORD_NOT_FOUND: "Không tìm thấy ghi nhận hoàn tiền.",
  REFUND_RECORD_ALREADY_VOIDED: "Ghi nhận hoàn tiền này đã được huỷ. Dữ liệu đã được tải lại.",
  REFUND_REFERENCE_IN_USE: "Mã tham chiếu sao kê này đã được ghi cho một lần hoàn khác.",
  TRANSFER_INSTRUCTIONS_UNAVAILABLE: "Chưa hiển thị được thông tin chuyển khoản. Thử lại sau.",
  NOT_FOUND: "Không tìm thấy đơn hàng.",
  // BE `PaymentReceiptExportService`: câu tiếng Anh tự viết (WF-02 N4), chưa có bản dịch
  EXPORT_TOO_LARGE: "File xuất sẽ có hơn 50.000 dòng: hãy thu hẹp bộ lọc rồi xuất lại.",
};

/** Mã mà BE trả câu tiếng Anh hoặc câu không nói đúng việc FE làm: luôn dùng câu FE. */
const RECEIPT_OVERRIDES: Readonly<Record<string, string>> = {
  OPTIMISTIC_LOCK: COMMON_API_ERROR_MESSAGES.OPTIMISTIC_LOCK!,
  NOT_FOUND: PAYMENT_ERROR_MESSAGES.NOT_FOUND!,
  EXPORT_TOO_LARGE: PAYMENT_ERROR_MESSAGES.EXPORT_TOO_LARGE!,
};

/**
 * `PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING` kèm `details` `{ installmentId, outstanding, currency }` (plan §1.2): nói rõ
 * đợt đó còn phải thu bao nhiêu thay vì câu chung (WF-02 audit, mục 9).
 */
export function exceedsOutstanding(
  error: unknown,
): { installmentId: string | null; outstanding: number; currency: string } | null {
  if (!(error instanceof ApiError) || error.code !== "PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING")
    return null;
  const outstanding = error.details?.outstanding;
  if (typeof outstanding !== "number") return null;
  const installmentId = error.details?.installmentId;
  const currency = error.details?.currency;
  return {
    installmentId: typeof installmentId === "string" ? installmentId : null,
    outstanding,
    currency: typeof currency === "string" ? currency : "VND",
  };
}

export function paymentErrorMessage(error: unknown): string {
  const exceeds = exceedsOutstanding(error);
  if (exceeds)
    return `Có dòng trả nhiều hơn số đợt đó còn phải thu (còn ${formatMoney(exceeds.outstanding, exceeds.currency)}). Dữ liệu đã được tải lại, kiểm tra lại số tiền.`;
  return apiErrorMessage(error, PAYMENT_ERROR_MESSAGES);
}

/** Lập / huỷ phiếu thu: `message` đã dịch của BE; không có thì câu FE theo mã (`paymentErrorMessage`). */
export function receiptErrorMessage(error: unknown): string {
  return serverErrorMessage(error, RECEIPT_OVERRIDES, paymentErrorMessage(error));
}

/**
 * Lỗi gắn được vào một ô của phiếu thu: mã sao kê đã dùng → ô "Mã tham chiếu"; vượt số còn phải thu → ô số tiền của
 * đợt đó. Gắn vào ô thì tự mất khi người dùng sửa ô (WF-02 audit mục 9: báo lỗi trùng mã từng còn sau khi đổi mã).
 */
export function receiptFieldError(
  error: unknown,
  lineIndexOf: (installmentId: string) => number,
): { field: "reference" | `lines.${number}.amount`; message: string } | null {
  if (error instanceof ApiError && error.code === "PAYMENT_RECEIPT_REFERENCE_IN_USE")
    return {
      field: "reference",
      message: PAYMENT_ERROR_MESSAGES.PAYMENT_RECEIPT_REFERENCE_IN_USE!,
    };
  const exceeds = exceedsOutstanding(error);
  if (exceeds?.installmentId) {
    const index = lineIndexOf(exceeds.installmentId);
    if (index >= 0)
      return {
        field: `lines.${index}.amount`,
        message: `Vượt số còn phải thu (${formatMoney(exceeds.outstanding, exceeds.currency)}).`,
      };
  }
  return null;
}

/** Lỗi "dữ liệu đã đổi" ngoài các mã chung: tải lại trước khi cho thao tác tiếp. */
export const PAYMENT_STALE_CODES = [
  "INSTALLMENT_NOT_PAYABLE",
  "PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING",
  "PAYMENT_RECEIPT_ALREADY_VOIDED",
  "REFUND_EXCEEDS_REFUNDABLE",
  "REFUND_RECORD_ALREADY_VOIDED",
] as const;
