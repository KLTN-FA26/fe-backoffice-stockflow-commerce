/**
 * Release đơn — lỗi BE → lý do hiển thị trong hộp thoại (BE `OrderReleaseService`, `IdempotencyFilter`).
 *
 * Mỗi lý do kèm mã quy tắc (BR-PRD-08 mẫu chưa duyệt, BR-PRD-09 chưa đủ cọc, BR-02 công nợ quá hạn, LP-2 FTL + COD)
 * để Coordinator đối chiếu docs, và chi tiết rút từ máy chủ (SKU thiếu mẫu) vì câu của BE là tiếng Anh. Lỗi không có
 * nhánh riêng rơi về `orderActionErrorView(error, "release")` (403, mạng, 5xx…).
 */

import {
  ORDER_DELIVERY_MODE_UI,
  ORDER_RELEASE_LABELS,
  ORDER_RELEASE_REFUSAL_LABELS,
} from "@/constants";

import { orderActionErrorView } from "./errors";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView } from "./errors";

const R = ORDER_RELEASE_REFUSAL_LABELS;

/**
 * Mã cho thấy dữ liệu trên màn đã cũ (đơn đã đổi trạng thái / không còn trong phạm vi): đóng hộp thoại, báo bằng toast,
 * tải lại đơn. `ORDER_INVALID_TRANSITION` là cùng ý với CONFLICT của BE cũ.
 */
export const RELEASE_STALE_CODES: readonly string[] = [
  "CONFLICT",
  "NOT_FOUND",
  "ORDER_INVALID_TRANSITION",
];

/**
 * Tranh chấp đồng thời (BE `ErrorCode.isRetryable`, đều 409): OPTIMISTIC_LOCK = người khác ghi trước (dữ liệu đã cũ →
 * tải lại đơn); LOCK_TIMEOUT = đơn đang bị khoá, giao dịch của mình chưa đổi gì; IDEMPOTENT_REQUEST_IN_PROGRESS = bản
 * gốc cùng Idempotency-Key còn chạy. Giữ hộp thoại + dữ liệu đã nhập; KHÔNG tự gửi lại — người dùng bấm lại.
 */
export const RELEASE_CONCURRENCY_CODES = [
  "OPTIMISTIC_LOCK",
  "LOCK_TIMEOUT",
  "IDEMPOTENT_REQUEST_IN_PROGRESS",
] as const;

export const isReleaseConcurrencyError = (error: ApiError): boolean =>
  (RELEASE_CONCURRENCY_CODES as readonly string[]).includes(error.code);

/** BE: "… without an approved sample on SKU-1, SKU-2 (BR-PRD-08)" → "SKU-1, SKU-2"; không khớp → undefined. */
export function missingSampleSkus(message: string): string | undefined {
  return /approved sample on (.+?) \(BR-PRD-08\)/.exec(message)?.[1];
}

/** Lỗi 400 theo ô của BE `ReleaseOrderRequest` (`@NotNull warehouseId`): câu FE cho ô kho. */
export function releaseFieldErrors(error: ApiError): { warehouseId?: string } {
  return error.fieldErrors && "warehouseId" in error.fieldErrors
    ? { warehouseId: R.warehouseField }
    : {};
}

export function releaseErrorView(error: ApiError): OrderErrorView {
  const title = ORDER_RELEASE_LABELS.failedTitle;
  const traceId = error.traceId;
  switch (error.code) {
    case "DESIGN_SAMPLE_NOT_APPROVED": {
      const skus = missingSampleSkus(error.message);
      return {
        title,
        detail: R.sampleNotApproved,
        rule: R.sampleRule,
        serverDetail: skus ? R.missingSamples(skus) : error.message || undefined,
        traceId,
      };
    }
    case "ORDER_DEPOSIT_NOT_RECEIVED":
      return { title, detail: R.depositNotReceived, rule: R.depositRule, traceId };
    case "CUSTOMER_CREDIT_OVERDUE":
      return { title, detail: R.creditOverdue, rule: R.creditRule, traceId };
    case "DELIVERY_MODE_FTL_NO_COD":
      return { title, detail: ORDER_DELIVERY_MODE_UI.ftlNoCod, rule: R.ftlNoCodRule, traceId };
    case "CONFLICT":
    case "ORDER_INVALID_TRANSITION":
      return { title, detail: R.notReleasable, rule: R.notReleasableRule, traceId };
    case "OPTIMISTIC_LOCK":
      return { title, detail: R.optimisticLock, traceId };
    case "LOCK_TIMEOUT":
      return { title, detail: R.lockTimeout, traceId };
    case "IDEMPOTENT_REQUEST_IN_PROGRESS":
      return { title, detail: R.inProgress, traceId };
    case "IDEMPOTENCY_KEY_REUSED":
      return { title, detail: R.keyReused, traceId };
    default:
      return orderActionErrorView(error, "release");
  }
}
