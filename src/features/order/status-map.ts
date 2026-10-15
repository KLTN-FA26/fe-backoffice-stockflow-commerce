/**
 * Order — ánh xạ 1-1 hai chiều giữa mã wire BE đã biết (`order/api/OrderStatus.java`, 12 giá trị
 * ở BE develop) và giá trị hiển thị FE (Title Case, `ORDER_STATUSES` trong
 * @/constants/statuses). Cùng cách NCC làm ACTIVE ↔ "Active": màu + nhãn Việt tra theo chuỗi
 * Title Case ở `lib/status-map.ts`.
 *
 * Hai chiều KHÔNG đối xứng về `UNKNOWN`: chiều đọc giữ `UNKNOWN` (trạng thái BE mới FE chưa hỗ
 * trợ); chiều gửi chỉ duyệt `BACKEND_ORDER_STATUSES` nên không thể phát `UNKNOWN` hay chuỗi lạ.
 *
 * FE khớp BE, không dựng theo docs 17 — xem ghi chú QUYẾT ĐỊNH ở `ORDER_STATUSES`.
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
  IN_FULFILMENT: "In Fulfilment",
  ON_HOLD: "On Hold",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
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
