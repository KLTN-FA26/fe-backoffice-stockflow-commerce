/**
 * Release đơn — luật biết trước từ dữ liệu đơn. Pure: đơn → lý do CHẮC CHẮN chưa release được, để màn nói ra thay vì
 * chỉ ẩn nút. Chỉ nêu cái FE chứng minh được; BR-PRD-08 (mẫu duyệt) và công nợ quá hạn do BE kiểm khi release.
 */

import { ORDER_RELEASE_BLOCKER_LABELS } from "@/constants";

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
 * docs 19 BR-09 / BE `ORDER_DEPOSIT_NOT_RECEIVED`: đơn cọc chưa nhận cọc nằm ở PENDING_PAYMENT và không release được
 * (BE chỉ release đơn CONFIRMED) — nói rõ lý do thay vì không có nút. UI-only — Backend phải re-check.
 */
export function releaseBlockers(
  order: Pick<Order, "status" | "paymentTerm" | "depositReceivedAt">,
): ReleaseBlocker[] {
  if (order.status === "Pending Payment" && depositState(order) === "awaiting") {
    return [
      {
        rule: ORDER_RELEASE_BLOCKER_LABELS.depositRule,
        message: ORDER_RELEASE_BLOCKER_LABELS.depositNotReceived,
      },
    ];
  }
  return [];
}
