/**
 * Order — BE→FE status mapping.
 *
 * BE OrderStatus wire value (order/internal/domain/OrderStatus.java, 9 giá trị)
 * → FE OrderStatus (21-value union, @/constants/statuses). Một chiều — FE có
 * nhiều state hiển thị mà BE không bao giờ trả (mock-only states).
 */

import type { OrderStatus } from "@/constants/statuses";

export type BackendOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "IN_FULFILMENT"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED";

/**
 * ASSUMPTION (open-question: xác nhận lại với Uông Thanh Tú trước khi tích hợp
 * API thật): PAID và IN_FULFILMENT chưa có tương đương chính xác trong union
 * cũ — chọn tạm "Confirmed" / "Ready to Fulfill". Đây là hàm ĐẦU TIÊN cần soát
 * lại khi có response thật (OrderResponse#status).
 */
export function mapBackendOrderStatus(beStatus: BackendOrderStatus): OrderStatus {
  switch (beStatus) {
    case "DRAFT":
      return "Draft";
    case "PENDING_PAYMENT":
      return "Pending Payment";
    case "PAID":
      return "Confirmed"; // ASSUMPTION (open-question Tú)
    case "IN_FULFILMENT":
      return "Ready to Fulfill"; // ASSUMPTION (open-question Tú)
    case "SHIPPED":
      return "Shipped";
    case "DELIVERED":
      return "Delivered";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    case "RETURNED":
      return "Returned";
  }
}
