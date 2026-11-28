/**
 * Release đơn — luật biết trước từ dữ liệu đơn. Pure: đơn → lý do CHẮC CHẮN chưa release được, để màn nói ra thay vì
 * chỉ ẩn nút. Chỉ nêu cái FE chứng minh được; BR-PRD-08 (mẫu duyệt) và công nợ quá hạn do BE kiểm khi release.
 */

import { ORDER_RELEASE_BLOCKER_LABELS } from "@/constants";

import type { OrderInstallmentsSummary } from "./installments-summary-api";
import type { Order } from "./types";

export type DepositState = "not-applicable" | "awaiting" | "received";

/** Trạng thái cọc, suy từ `paymentTerm` + `depositReceivedAt` (BE không có enum riêng). */
export function depositState(
  order: Pick<Order, "paymentTerm" | "depositReceivedAt">,
): DepositState {
  if (order.paymentTerm !== "DEPOSIT") return "not-applicable";
  return order.depositReceivedAt ? "received" : "awaiting";
}

export interface ReleaseBlocker {
  /** Mã quy tắc để đối chiếu docs. */
  rule: string;
  message: string;
}

/**
 * docs 07 BR-01, 15 BR-07, 17 BR-02: Pending Payment chờ thu đủ ON_SIGNING và BE chưa cho release.
 * Khi đọc được các đợt, `onSigningPaid` của BE phân biệt trường hợp tiền đã đủ nhưng trạng thái đơn chưa cập nhật.
 * Quản lý kho không mặc định có `payment-installments:READ`: dùng trạng thái Pending Payment để giải thích khi
 * không đọc được chi tiết. UI-only — Backend phải re-check.
 */
export function releaseBlockers(
  order: Pick<Order, "status">,
  payment?: Pick<OrderInstallmentsSummary, "onSigningPaid"> | null,
): ReleaseBlocker[] {
  if (order.status === "Pending Payment" && payment?.onSigningPaid !== true) {
    return [
      {
        rule: ORDER_RELEASE_BLOCKER_LABELS.onSigningRule,
        message: ORDER_RELEASE_BLOCKER_LABELS.onSigningPending,
      },
    ];
  }
  return [];
}
