/**
 * Lỗi BE của module thanh toán → câu tiếng Việt. BE trả message tiếng Anh cho lỗi nghiệp vụ nên FE
 * luôn chọn câu theo `errorCode` (ErrorCode.java, 4B-6 / 4B-9). Không bao giờ hiện chữ của BE.
 */

import { apiErrorMessage } from "@/lib/api/error-message";

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
};

export function paymentErrorMessage(error: unknown): string {
  return apiErrorMessage(error, PAYMENT_ERROR_MESSAGES);
}

/** Lỗi "dữ liệu đã đổi" ngoài các mã chung: tải lại trước khi cho thao tác tiếp. */
export const PAYMENT_STALE_CODES = [
  "INSTALLMENT_NOT_PAYABLE",
  "PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING",
  "PAYMENT_RECEIPT_ALREADY_VOIDED",
  "REFUND_EXCEEDS_REFUNDABLE",
  "REFUND_RECORD_ALREADY_VOIDED",
] as const;
