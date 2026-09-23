/**
 * Order — selectors (pure derivations).
 *
 * Mọi tính toán KPI / filter / flag row sống ở đây. Component chỉ gọi selector,
 * không .filter()/.reduce() inline. PURE — không side effect, không import icon.
 *
 * Source: docs/ecommerce/17-order §3 (Output).
 */

import { ORDER_STATUS } from "@/constants";
import { formatCompact, formatMoney } from "@/lib/format";

import type { Order, OrderStatus } from "./types";

export { formatMoney };
export { formatCompact as formatCompactVND };

/* ── Status groupings ────────────────────────────────────────────────── */

/** Đang xử lý nội bộ — đã thu tiền, chưa bàn giao vận chuyển. */
const PROCESSING_STATUSES: readonly OrderStatus[] = [
  ORDER_STATUS.CONFIRMED,
  "In Production",
  ORDER_STATUS.READY_TO_FULFILL,
  "Picking",
  "Packed",
];

/** Đã bàn giao vận chuyển, chưa giao xong. */
const SHIPPING_STATUSES: readonly OrderStatus[] = [ORDER_STATUS.SHIPPED, "In Transit"];

/** Cần người xử lý tay (ngoại lệ). */
const ATTENTION_STATUSES: readonly OrderStatus[] = [
  "Payment Failed",
  "Delivery Failed",
  "On Hold",
  "Partially Fulfilled",
  ORDER_STATUS.CANCELLED,
];

/** Statuses that should flag a row in the list table. */
const FLAGGED_STATUSES: readonly OrderStatus[] = [
  "Payment Failed",
  "Delivery Failed",
  "On Hold",
  "Partially Fulfilled",
];

/* ── List-level stats ────────────────────────────────────────────────── */

export interface OrderListStats {
  total: number;
  pendingPayment: number;
  processing: number;
  shipping: number;
  delivered: number;
  attention: number;
  revenue: number;
}

/**
 * Compute stats from a list of orders.
 * Pure function — page chỉ ghép nhãn/icon quanh các con số này.
 */
export function computeOrderStats(list: readonly Order[]): OrderListStats {
  const result: OrderListStats = {
    total: list.length,
    pendingPayment: 0,
    processing: 0,
    shipping: 0,
    delivered: 0,
    attention: 0,
    revenue: 0,
  };

  for (const order of list) {
    if (order.status === ORDER_STATUS.PENDING_PAYMENT) result.pendingPayment++;
    if (PROCESSING_STATUSES.includes(order.status)) result.processing++;
    if (SHIPPING_STATUSES.includes(order.status)) result.shipping++;
    if (order.status === ORDER_STATUS.DELIVERED) result.delivered++;
    if (ATTENTION_STATUSES.includes(order.status)) result.attention++;
    result.revenue += order.grandTotal;
  }

  return result;
}

/* ── Row-level UI helpers ────────────────────────────────────────────── */

export function shouldFlagOrderRow(order: Order): boolean {
  return FLAGGED_STATUSES.includes(order.status);
}
