/**
 * Lọc phía FE của hai trang danh sách trong tab Đơn hàng (data-table-mode-a §4.1) — hàm thuần, không side effect.
 *
 * - Yêu cầu huỷ: BE `GET /orders/cancellation-requests` chỉ nhận status / orderId → ô tìm + lọc cột chỉ xét trang đang xem.
 * - Lô hàng hoàn về: BE trả cả danh sách (≤ `listLimit`) → ô tìm + lọc cột xét mọi hồ sơ đã tải; trạng thái gửi BE.
 */

import { textIncludes } from "@/lib/text-match";

import { cancellationReasonLabel } from "./selectors";

import type { CancellationRequest } from "./cancellation-request-schemas";
import type { DeliveryFailureCase } from "./delivery-failure-schemas";

/** Khoá URL của lọc header cột hàng đợi yêu cầu huỷ. */
export const CANCELLATION_FILTER_KEYS = ["crOrder", "crCustomer", "crReason"] as const;
export type CancellationFilterKey = (typeof CANCELLATION_FILTER_KEYS)[number];

/** Khoá URL của lọc header cột lô hàng hoàn về. */
export const DELIVERY_FAILURE_FILTER_KEYS = ["dfOrder", "dfReceipt", "dfReason"] as const;
export type DeliveryFailureFilterKey = (typeof DELIVERY_FAILURE_FILTER_KEYS)[number];

const anyIncludes = (texts: readonly (string | null | undefined)[], needle: string) =>
  !needle.trim() || texts.some((text) => textIncludes(text, needle));

/**
 * Yêu cầu huỷ khớp ô tìm (mã đơn, khách, lý do, ghi chú) + lọc cột. Mã / tên khách BE chưa gửi kèm dòng (null) thì
 * không khớp lọc theo cột đó — không đoán từ đơn tải riêng.
 */
export function matchesCancellationRequest(
  row: CancellationRequest,
  q: string,
  filters: Record<CancellationFilterKey, string>,
): boolean {
  const reason = cancellationReasonLabel(row.reasonCode);
  return (
    anyIncludes([row.orderNumber, row.customerName, reason, row.note], q) &&
    anyIncludes([row.orderNumber], filters.crOrder) &&
    anyIncludes([row.customerName], filters.crCustomer) &&
    (!filters.crReason || row.reasonCode === filters.crReason)
  );
}

/** Lô hàng hoàn về khớp ô tìm (mã đơn, phiếu nhận, lý do, ghi chú) + lọc cột; lý do so theo mã. */
export function matchesDeliveryFailure(
  row: DeliveryFailureCase,
  q: string,
  reasonLabel: string,
  filters: Record<DeliveryFailureFilterKey, string>,
): boolean {
  return (
    anyIncludes([row.orderNumber, row.receiptNumber, reasonLabel, row.failureNote], q) &&
    anyIncludes([row.orderNumber], filters.dfOrder) &&
    anyIncludes([row.receiptNumber], filters.dfReceipt) &&
    (!filters.dfReason || row.failureReason === filters.dfReason)
  );
}
