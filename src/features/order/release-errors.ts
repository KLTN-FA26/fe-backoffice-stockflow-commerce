/**
 * Release đơn — lỗi BE → lý do hiển thị trong hộp thoại (BE `OrderReleaseService`, `IdempotencyFilter`).
 *
 * Mỗi lý do kèm mã quy tắc (BR-02 công nợ quá hạn, BR-21/22 giữ hàng + một kho xuất, BR-29 đợt giao kế tiếp, BR-03
 * phạm vi kho) để quản lý kho đối chiếu docs 17. Câu của BE là tiếng Anh nên không hiện thẳng. Lỗi không có nhánh
 * riêng rơi về `orderActionErrorView(error, "release")` (403, mạng, 5xx…).
 */

import { ORDER_RELEASE_LABELS, ORDER_RELEASE_REFUSAL_LABELS } from "@/constants";

import { orderActionErrorView } from "./errors";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView } from "./errors";

const R = ORDER_RELEASE_REFUSAL_LABELS;

/**
 * Mã cho thấy dữ liệu trên màn đã cũ (đơn đã đổi trạng thái / không còn): đóng hộp thoại, báo bằng toast, tải lại
 * đơn. `ORDER_INVALID_TRANSITION` là cùng ý với CONFLICT của BE cũ; `DELIVERY_BATCH_NOT_FOUND` = đợt không còn thuộc đơn.
 */
export const RELEASE_STALE_CODES: readonly string[] = [
  "CONFLICT",
  "NOT_FOUND",
  "ORDER_INVALID_TRANSITION",
  "DELIVERY_BATCH_NOT_FOUND",
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
    case "CUSTOMER_CREDIT_OVERDUE":
      return { title, detail: R.creditOverdue, rule: R.creditRule, traceId };
    case "ORDER_SHIPPING_WAREHOUSE_MISMATCH":
      return { title, detail: R.warehouseMismatch, rule: R.warehouseMismatchRule, traceId };
    case "ORDER_STOCK_NOT_HELD":
      return { title, detail: R.stockNotHeld, rule: R.stockNotHeldRule, traceId };
    case "DELIVERY_BATCH_NOT_NEXT":
      return { title, detail: R.batchNotNext, rule: R.batchRule, traceId };
    case "DELIVERY_BATCH_NOT_FOUND":
      return { title, detail: R.batchNotFound, rule: R.batchRule, traceId };
    case "ORDER_PRINT_GOODS_NOT_RECEIVED":
      return { title, detail: R.printGoodsNotReceived, rule: R.printGoodsRule, traceId };
    case "OUT_OF_DATA_SCOPE":
      return { title, detail: R.outOfScope, rule: R.outOfScopeRule, traceId };
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
