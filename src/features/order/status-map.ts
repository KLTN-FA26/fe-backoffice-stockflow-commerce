/**
 * Order — ánh xạ 1-1 hai chiều giữa mã wire BE đã biết (`order/api/OrderStatus.java`, 19 giá trị,
 * BE PR #133) và giá trị hiển thị FE (Title Case, `ORDER_STATUSES` trong
 * @/constants/statuses). Cùng cách NCC làm ACTIVE ↔ "Active": màu + nhãn Việt tra theo chuỗi
 * Title Case ở `lib/status-map.ts`.
 *
 * Hai chiều KHÔNG đối xứng về `UNKNOWN`: chiều đọc giữ `UNKNOWN` (chuỗi BE lạ — trạng thái mới, hoặc
 * mã đã bỏ IN_FULFILMENT / PAID); chiều gửi chỉ duyệt `BACKEND_ORDER_STATUSES` nên không thể phát
 * `UNKNOWN`, mã đã bỏ hay chuỗi lạ. Bí danh lọc cũ mà BE còn nhận (`OrderStatusFilter`) KHÔNG dùng ở
 * đây — FE luôn gửi tên hiện hành.
 *
 * FE khớp BE, không dựng theo docs 17 — xem ghi chú ở `ORDER_STATUSES`.
 */

import { ORDER_STATUS_UNKNOWN } from "@/constants/statuses";

import { BACKEND_ORDER_STATUSES } from "./schemas";

import type {
  BackendOrderReadStatus,
  BackendOrderStatus,
  OrderReadStatus,
  OrderStatus,
} from "./types";

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
} as const satisfies Record<BackendOrderStatus, OrderStatus>;

/** BE → FE khi đọc response. `UNKNOWN` giữ nguyên (hiển thị "Không rõ", không có thao tác). */
export function mapBackendOrderStatus(beStatus: BackendOrderReadStatus): OrderReadStatus {
  return beStatus === ORDER_STATUS_UNKNOWN
    ? ORDER_STATUS_UNKNOWN
    : BACKEND_TO_FE_ORDER_STATUS[beStatus];
}

/**
 * FE → BE cho tham số lọc gửi lên. Chỉ phát mã trong `BACKEND_ORDER_STATUSES` — `UNKNOWN` (hay
 * chuỗi nào khác lọt vào lúc chạy) bị bỏ, không bao giờ thành `status=UNKNOWN`.
 */
export function toBackendOrderStatuses(statuses: readonly OrderStatus[]): BackendOrderStatus[] {
  return BACKEND_ORDER_STATUSES.filter((be) => statuses.includes(BACKEND_TO_FE_ORDER_STATUS[be]));
}
