/**
 * Order — selectors (pure derivations). PURE — không side effect, không import icon.
 */

import {
  ORDER_CANCELLATION_REQUEST_EXPIRED_NOTE,
  ORDER_CANCELLATION_REQUEST_STATUS_LABELS,
} from "@/constants";

import type { Order, OrderStatus } from "./types";

/**
 * Trạng thái cần người xử lý tay → gắn viền cảnh báo ở row (data-table-mode-a).
 * Ngoại lệ chờ nhân viên quyết: ON_HOLD (giữ đơn), DELIVERY_FAILED (giao thất bại — giao lại hoặc trả
 * về), PARTIALLY_FULFILLED (giao một phần — đóng phần còn lại hoặc chờ phần sau) và RETURN_REQUESTED
 * (khách yêu cầu trả hàng). Chốt với lead 22/10.
 */
const FLAGGED_STATUSES: readonly OrderStatus[] = [
  "On Hold",
  "Delivery Failed",
  "Partially Fulfilled",
  "Return Requested",
];

export function shouldFlagOrderRow(order: Pick<Order, "status">): boolean {
  return FLAGGED_STATUSES.includes(order.status);
}

/**
 * Nhãn tiếng Việt của trạng thái yêu cầu huỷ đơn (BE `CancellationRequestStatus`: PENDING, APPROVED,
 * REJECTED, EXPIRED). Mã lạ BE thêm sau hiện nguyên văn thay vì làm hỏng cả bảng.
 */
export function cancellationRequestStatusLabel(status: string): string {
  return Object.hasOwn(ORDER_CANCELLATION_REQUEST_STATUS_LABELS, status)
    ? ORDER_CANCELLATION_REQUEST_STATUS_LABELS[
        status as keyof typeof ORDER_CANCELLATION_REQUEST_STATUS_LABELS
      ]
    : status;
}

/**
 * Ghi chú quyết định của yêu cầu huỷ. Yêu cầu EXPIRED do hệ thống đóng (BE `decisionNote` là câu tiếng
 * Anh sinh tự động) → hiện câu tiếng Việt cố định; trạng thái khác giữ ghi chú của người duyệt.
 */
export function cancellationRequestNote(
  status: string,
  decisionNote: string | null,
): string | null {
  return status === "EXPIRED" ? ORDER_CANCELLATION_REQUEST_EXPIRED_NOTE : decisionNote;
}
