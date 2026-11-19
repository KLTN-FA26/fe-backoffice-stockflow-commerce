/**
 * Giao thất bại — lỗi API → câu tiếng Việt (BE `ErrorCode`, WF-05). Theo `error.code`, không theo message tiếng Anh.
 */

import { DELIVERY_FAILURE_ERROR_MESSAGES, DELIVERY_FAILURE_LABELS } from "@/constants";

import {
  ORDER_STALE_ERROR_CODES,
  commonErrorView,
  fallback,
  isDeliveryFailureErrorCode,
} from "./errors";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView, ServerFieldMap } from "./errors";

/** Dữ liệu trên màn đã cũ (người khác đã quyết hồ sơ / hồ sơ không còn) → đóng hộp thoại, tải lại. */
export const DELIVERY_FAILURE_STALE_CODES: readonly string[] = [
  ...ORDER_STALE_ERROR_CODES.filter((code) => code !== "CONFLICT"),
  "DELIVERY_FAILURE_INVALID_TRANSITION",
  "DELIVERY_FAILURE_CASE_NOT_FOUND",
];

export type DeliveryFailureDecision = "redeliver" | "cancel";

const TITLES: Readonly<Record<DeliveryFailureDecision, string>> = {
  redeliver: DELIVERY_FAILURE_LABELS.redeliver.failedTitle,
  cancel: DELIVERY_FAILURE_LABELS.cancel.failedTitle,
};

const VERBS: Readonly<Record<DeliveryFailureDecision, string>> = {
  redeliver: "giao lại hàng",
  cancel: "huỷ phần chưa giao",
};

export function deliveryFailureErrorView(
  error: ApiError,
  decision: DeliveryFailureDecision,
): OrderErrorView {
  const title = TITLES[decision];
  const traceId = error.traceId;
  if (isDeliveryFailureErrorCode(error.code)) {
    return { title, detail: DELIVERY_FAILURE_ERROR_MESSAGES[error.code], traceId };
  }
  // BE `redeliver`: tính phí chuyến hỏng nhưng đơn không có đợt thanh toán nào để ghi khoản phí
  if (error.code === "CONFLICT" && decision === "redeliver") {
    return {
      title,
      detail:
        "Đơn không có đợt thanh toán nào để ghi phí chuyến hỏng. Kiểm tra hợp đồng của đơn rồi thử lại.",
      traceId,
    };
  }
  if (error.code === "VALIDATION_FAILED") {
    return { title, detail: "Kiểm tra lại ghi chú và khoản phí đã nhập.", traceId };
  }
  return commonErrorView(error, title, VERBS[decision]) ?? fallback(error, title, VERBS[decision]);
}

const V = DELIVERY_FAILURE_LABELS.validation;

/** BE `DeliveryFailureCaseRequests.Redelivery` → ô form. */
export const REDELIVERY_FIELD_ERRORS = {
  note: { field: "note", message: V.noteRequired },
  failedTripFee: { field: "failedTripFee", message: V.feeRequired },
} as const satisfies ServerFieldMap<"note" | "failedTripFee">;

/** BE `DeliveryFailureCaseRequests.Cancellation` (+ `CancellationFeeRequest`) → ô form. */
export const CANCEL_UNDELIVERED_FIELD_ERRORS = {
  note: { field: "note", message: V.noteRequired },
  "agreedFee.amount": { field: "feeAmount", message: V.feeInvalid },
  "agreedFee.reason": { field: "feeReason", message: V.feeReasonRequired },
  "agreedFee.detail": { field: "feeDetail", message: V.feeDetailRequired },
} as const satisfies ServerFieldMap<"note" | "feeAmount" | "feeReason" | "feeDetail">;
