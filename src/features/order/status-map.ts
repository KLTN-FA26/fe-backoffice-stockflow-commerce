/**
 * Order — ánh xạ 1-1 hai chiều giữa mã wire BE (`order/api/OrderStatus.java`, 10 giá trị — ON_HOLD
 * có từ BE commit 2e9c4df) và giá trị hiển thị FE (Title Case, `ORDER_STATUSES` trong
 * @/constants/statuses). Cùng cách NCC làm ACTIVE ↔ "Active": màu + nhãn Việt tra theo chuỗi
 * Title Case ở `lib/status-map.ts`.
 *
 * FE khớp BE, không dựng theo docs 17 — xem ghi chú QUYẾT ĐỊNH ở `ORDER_STATUSES`.
 */

import { BACKEND_ORDER_STATUSES } from "./schemas";

import type { BackendOrderStatus, OrderStatus } from "./types";

export const BACKEND_TO_FE_ORDER_STATUS = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  IN_FULFILMENT: "In Fulfilment",
  ON_HOLD: "On Hold",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
} as const satisfies Record<BackendOrderStatus, OrderStatus>;

export function mapBackendOrderStatus(beStatus: BackendOrderStatus): OrderStatus {
  return BACKEND_TO_FE_ORDER_STATUS[beStatus];
}

/** FE → BE cho tham số lọc gửi lên. 1-1 nên không mất giá trị nào. */
export function toBackendOrderStatuses(statuses: readonly OrderStatus[]): BackendOrderStatus[] {
  return BACKEND_ORDER_STATUSES.filter((be) => statuses.includes(BACKEND_TO_FE_ORDER_STATUS[be]));
}
