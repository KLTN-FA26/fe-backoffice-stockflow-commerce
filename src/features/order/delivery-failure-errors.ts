/**
 * Lô hàng hoàn về / đóng phần thất lạc — lỗi API → câu tiếng Việt (BE `ErrorCode`, WF-05). Theo `error.code`, không theo
 * message tiếng Anh.
 */

import {
  DELIVERY_FAILURE_ERROR_MESSAGES,
  DELIVERY_FAILURE_LABELS,
  FEE_BEARER_LABELS,
  LOST_SHIPMENT_CLOSURE_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { evidenceUploadErrorMessage } from "./delivery-window-errors";
import {
  ORDER_STALE_ERROR_CODES,
  commonErrorView,
  fallback,
  isDeliveryFailureErrorCode,
} from "./errors";

import type { OrderErrorView, ServerFieldMap } from "./errors";

/** Dữ liệu trên màn đã cũ (người khác đã quyết hồ sơ / hồ sơ không còn) → đóng hộp thoại, tải lại. */
export const DELIVERY_FAILURE_STALE_CODES: readonly string[] = [
  ...ORDER_STALE_ERROR_CODES.filter((code) => code !== "CONFLICT"),
  "DELIVERY_FAILURE_INVALID_TRANSITION",
  "DELIVERY_FAILURE_CASE_NOT_FOUND",
];

/** Lô không còn đóng được như thất lạc (người khác đã đóng / hàng đã về / đã giao) → đóng hộp thoại, tải lại. */
export const LOST_CLOSURE_STALE_CODES: readonly string[] = [
  ...ORDER_STALE_ERROR_CODES.filter((code) => code !== "CONFLICT"),
  "ORDER_SHIPMENT_NOT_LOST_CLOSABLE",
];

export type DeliveryFailureDecision = "cancel" | "lost-closure";

const TITLES: Readonly<Record<DeliveryFailureDecision, string>> = {
  cancel: DELIVERY_FAILURE_LABELS.cancel.failedTitle,
  "lost-closure": LOST_SHIPMENT_CLOSURE_LABELS.failedTitle,
};

const VERBS: Readonly<Record<DeliveryFailureDecision, string>> = {
  cancel: "huỷ phần chưa giao",
  "lost-closure": "đóng phần thất lạc",
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
  if (error.code === "VALIDATION_FAILED") {
    const detail =
      decision === "cancel"
        ? "Kiểm tra lại ghi chú và khoản phí đã nhập."
        : "Kiểm tra lại ghi chú và tệp xác nhận đã đính kèm.";
    return { title, detail, traceId };
  }
  // Q-12: lệnh cần APPROVE riêng — nói rõ quyền nào thay vì câu 403 chung
  if (error.code === "FORBIDDEN" && decision === "lost-closure") {
    return { title, detail: LOST_SHIPMENT_CLOSURE_LABELS.forbidden, traceId };
  }
  return commonErrorView(error, title, VERBS[decision]) ?? fallback(error, title, VERBS[decision]);
}

const V = DELIVERY_FAILURE_LABELS.validation;

/** BE `DeliveryFailureCaseRequests.Cancellation` (+ `CancellationFeeRequest`) → ô form. */
export const CANCEL_UNDELIVERED_FIELD_ERRORS = {
  note: { field: "note", message: V.noteRequired },
  "agreedFee.amount": { field: "feeAmount", message: V.feeInvalid },
  "agreedFee.reason": { field: "feeReason", message: V.feeReasonRequired },
  "agreedFee.detail": { field: "feeDetail", message: V.feeDetailRequired },
  feeBearer: { field: "feeBearer", message: FEE_BEARER_LABELS.required },
} as const satisfies ServerFieldMap<"note" | "feeAmount" | "feeReason" | "feeDetail" | "feeBearer">;

/** BE lost-closure request → ô form. */
export const LOST_CLOSURE_FIELD_ERRORS = {
  note: { field: "note", message: LOST_SHIPMENT_CLOSURE_LABELS.noteRequired },
  evidenceUploadId: {
    field: "evidenceUploadId",
    message: LOST_SHIPMENT_CLOSURE_LABELS.evidenceRequired,
  },
} as const satisfies ServerFieldMap<"note" | "evidenceUploadId">;

/**
 * Lỗi xin đường tải tệp xác nhận thất lạc → câu Việt. Quyền và "lô không còn đóng được" nói theo lệnh này; còn lại (loại
 * tệp, dung lượng, mạng, kho lưu trữ) dùng chung câu của tải tệp bằng chứng.
 */
export function lostEvidenceUploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "FORBIDDEN" || error.code === "OUT_OF_DATA_SCOPE") {
      return LOST_SHIPMENT_CLOSURE_LABELS.forbidden;
    }
    if (error.code === "ORDER_SHIPMENT_NOT_LOST_CLOSABLE" || error.code === "NOT_FOUND") {
      return DELIVERY_FAILURE_ERROR_MESSAGES.ORDER_SHIPMENT_NOT_LOST_CLOSABLE;
    }
  }
  return evidenceUploadErrorMessage(error);
}
