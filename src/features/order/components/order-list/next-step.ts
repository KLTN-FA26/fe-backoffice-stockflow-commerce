import { NEXT_STEP_LABELS } from "./constants";

import type { Order } from "../../types";

const L = NEXT_STEP_LABELS;

/**
 * Việc tiếp theo của một đơn trên danh sách (bo-17), suy ra chỉ từ field dòng `GET /orders` đã có — không gọi thêm API.
 * Chỉ các bước có người phải làm: lập / chờ ký hợp đồng, chờ khách trả đợt khi ký, chọn kho xuất (BE
 * `Order#chooseShippingWarehouse` ở CONFIRMED), gỡ giữ đơn theo lý do (CREDIT do Kế toán duyệt, DELIVERY_FAILED do quyết
 * định hồ sơ). Các trạng thái kho / giao đang chạy: `null` (trạng thái đã nói đủ).
 */
export function orderListNextStep(
  order: Pick<Order, "status" | "holdReason" | "warehouseId">,
): string | null {
  switch (order.status) {
    case "Draft":
      return L.draft;
    case "Pending Contract":
      return L.pendingContract;
    case "Pending Payment":
      return L.pendingPayment;
    case "Confirmed":
      return order.warehouseId ? null : L.chooseWarehouse;
    case "On Hold":
      if (order.holdReason === "CREDIT") return L.creditHold;
      if (order.holdReason === "DELIVERY_FAILED") return L.deliveryFailedHold;
      return L.otherHold;
    case "Delivery Failed":
      return L.deliveryFailed;
    default:
      return null;
  }
}
