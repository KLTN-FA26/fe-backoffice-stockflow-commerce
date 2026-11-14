/**
 * Duyệt / từ chối yêu cầu huỷ — lỗi BE → lý do hiển thị (BE `CancellationRequestService`, `Order#cancel`).
 *
 * Branch theo `error.code`, KHÔNG theo `error.message` (tiếng Anh, có thể đổi). Các lý do "dữ liệu đã cũ" (đơn đã có
 * thùng dán nhãn, yêu cầu đã được quyết, hết hiệu lực) đóng hộp thoại + tải lại; lỗi còn lại giữ hộp thoại và dữ liệu đã
 * nhập. Khác `errors.ts` (đã vượt 200 dòng) nên tách file riêng.
 */

import { CANCELLATION_REQUEST_ERROR_MESSAGES as M, CANCELLATION_REQUEST_LABELS } from "@/constants";

import { ORDER_STALE_ERROR_CODES, commonErrorView, fallback } from "./errors";

import type { ApiError } from "@/lib/api/error";
import type { OrderErrorView } from "./errors";

export type CancellationDecisionAction = "approve" | "reject";

/**
 * Mã cho thấy dữ liệu trên màn đã cũ: ngoài nhóm chung của đơn còn có yêu cầu đã được quyết (NOT_PENDING — kể cả bị hệ
 * thống đóng thành `Expired`, docs 17 §5.4) và yêu cầu không còn (NOT_FOUND).
 */
export const CANCELLATION_REQUEST_STALE_CODES: readonly string[] = [
  ...ORDER_STALE_ERROR_CODES,
  "ORDER_CANCELLATION_REQUEST_NOT_PENDING",
  "CANCELLATION_REQUEST_NOT_FOUND",
];

const TITLES: Record<CancellationDecisionAction, string> = {
  approve: CANCELLATION_REQUEST_LABELS.approve.failedTitle,
  reject: CANCELLATION_REQUEST_LABELS.reject.failedTitle,
};

const VERBS: Record<CancellationDecisionAction, string> = {
  approve: "duyệt yêu cầu huỷ",
  reject: "từ chối yêu cầu huỷ",
};

export function cancellationDecisionErrorView(
  error: ApiError,
  action: CancellationDecisionAction,
): OrderErrorView {
  const title = TITLES[action];
  const traceId = error.traceId;
  switch (error.code) {
    case "ORDER_NOT_CANCELLABLE":
      return { title, detail: M.notCancellable, rule: M.notCancellableRule, traceId };
    case "ORDER_CANCELLATION_REQUEST_NOT_PENDING":
      return { title, detail: M.notPending, rule: M.notPendingRule, traceId };
    case "CANCELLATION_REQUEST_NOT_FOUND":
    case "NOT_FOUND":
      return { title, detail: M.notFound, traceId };
    case "CANCELLATION_FEE_BEFORE_PRINTING":
      return { title, detail: M.feeBeforePrinting, rule: M.feeBeforePrintingRule, traceId };
    case "CANCELLATION_NEEDS_STAFF":
      return { title, detail: M.needsStaff, traceId };
    case "VALIDATION_FAILED":
      return {
        title,
        detail: action === "approve" ? M.validationApprove : M.validationReject,
        traceId,
      };
    default:
      return commonErrorView(error, title, VERBS[action]) ?? fallback(error, title, VERBS[action]);
  }
}
