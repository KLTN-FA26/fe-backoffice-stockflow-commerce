/**
 * Order — ánh xạ 1-1 hai chiều giữa mã wire BE (`order/api/OrderStatus.java`, 19 giá trị, BE PR #133)
 * và giá trị hiển thị FE (Title Case, `ORDER_STATUSES` trong
 * @/constants/statuses). Cùng cách NCC làm ACTIVE ↔ "Active": màu + nhãn Việt tra theo chuỗi
 * Title Case ở `lib/status-map.ts`.
 *
 * FE khớp BE — xem ghi chú ở `ORDER_STATUSES`. Mã lạ → "UNKNOWN" (schema `.catch`).
 */

import { BACKEND_ORDER_STATUSES } from "./schemas";

import type { BackendOrderStatus, OrderStatus } from "./types";

export const BACKEND_TO_FE_ORDER_STATUS = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending Payment",
  CONFIRMED: "Confirmed",
  IN_PRODUCTION: "In Production",
  READY_TO_FULFILL: "Ready to Fulfill",
  PICKING: "Picking",
  PARTIALLY_FULFILLED: "Partially Fulfilled",
  PACKED: "Packed",
  ON_HOLD: "On Hold",
  SHIPPED: "Shipped",
  DELIVERY_FAILED: "Delivery Failed",
  DELIVERED: "Delivered",
  RETURN_REQUESTED: "Return Requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially Refunded",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
} as const satisfies Record<Exclude<BackendOrderStatus, "UNKNOWN">, OrderStatus>;

export function mapBackendOrderStatus(beStatus: BackendOrderStatus): OrderStatus {
  return beStatus === "UNKNOWN" ? "UNKNOWN" : BACKEND_TO_FE_ORDER_STATUS[beStatus];
}

/** FE → BE cho tham số lọc gửi lên. 1-1 nên không mất giá trị nào; "UNKNOWN" không lọc được. */
export function toBackendOrderStatuses(
  statuses: readonly OrderStatus[],
): Exclude<BackendOrderStatus, "UNKNOWN">[] {
  return BACKEND_ORDER_STATUSES.filter((be) => statuses.includes(BACKEND_TO_FE_ORDER_STATUS[be]));
}
