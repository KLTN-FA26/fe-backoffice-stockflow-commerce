import {
  CREDIT_HOLD_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  ORDER_HOLD_GUIDANCE,
  ORDER_PERMISSIONS,
  ORDER_STATUS_UNKNOWN,
} from "@/constants";

import { isOrderTerminal } from "../lifecycle";

import type { PermissionCode } from "@/lib/auth";
import type { OrderActionCode } from "../lifecycle";
import type { Order, OrderReadStatus } from "../types";

/** Trạng thái đã đóng gói / bàn giao — BE không cho huỷ (BR-ORD-004), xử lý qua luồng trả hàng. */
const PACKED_ONWARDS: readonly OrderReadStatus[] = [
  "Packed",
  "Partially Fulfilled",
  "Shipped",
  "Delivery Failed",
  "Delivered",
  "Return Requested",
  "Returned",
  "Refunded",
  "Partially Refunded",
];

/** Việc có thể làm nút chính, theo thứ tự ưu tiên (việc tiếp theo của luồng đơn). */
export const PRIMARY_ORDER: readonly OrderActionCode[] = [
  "release",
  "credit-approve",
  "resolve-hold",
  "delivery-failure",
  "hold",
];
/** Việc phá huỷ — luôn trong menu "⋯", chữ đỏ, cuối menu. */
export const DANGER_ORDER: readonly OrderActionCode[] = [
  "credit-reject",
  "remainder-closure",
  "admin-cancel",
];

/** Mã quyền ghi bất kỳ trên đơn — thiếu hết thì người xem chỉ đọc. */
const WRITE_PERMISSIONS: readonly PermissionCode[] = [
  ORDER_PERMISSIONS.cancel,
  ORDER_PERMISSIONS.hold,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.approve,
  ORDER_PERMISSIONS.release,
  CREDIT_HOLD_PERMISSIONS.approve,
];

/**
 * Vì sao không có nút thao tác — theo trạng thái + quyền, để người dùng không tưởng là lỗi. Không nói
 * "đã bàn giao" với đơn chỉ đang lấy hàng / tạm giữ.
 */
export function noActionReason(
  order: Pick<Order, "status">,
  can: (code: PermissionCode) => boolean,
): string {
  // Trạng thái BE mới FE chưa hỗ trợ — không đoán thao tác (không phải "đã kết thúc")
  if (order.status === ORDER_STATUS_UNKNOWN) {
    return "Trạng thái đơn chưa được hỗ trợ — không có thao tác.";
  }
  if (isOrderTerminal(order.status)) return "Đơn đã kết thúc — không còn thao tác.";
  if (!WRITE_PERMISSIONS.some(can)) return "Bạn chỉ có quyền xem đơn hàng.";
  if (order.status === "On Hold") {
    return "Đơn đang tạm giữ — việc gỡ giữ / duyệt cần quyền khác với quyền của bạn.";
  }
  // BR-ORD-004: từ PACKED hàng đã đóng — không huỷ được, đi luồng trả hàng
  if (PACKED_ONWARDS.includes(order.status)) {
    return "Đơn đã đóng gói / bàn giao vận chuyển — không huỷ được, xử lý qua luồng trả hàng.";
  }
  return "Không có thao tác nào bạn được phép làm ở trạng thái này.";
}

/**
 * Vì sao không có nút "Gỡ giữ" khi đơn bị giữ: giữ do hệ thống → nói xử lý ở đâu; lý do không rõ
 * (BE thêm mã mới / không trả `holdReason`) → không đoán, báo chưa gỡ được. Giữ do điều phối viên mà
 * người xem thiếu quyền thì không cần giải thích thêm.
 */
export function holdGuidanceFor(
  order: Pick<Order, "holdReason">,
  can: (code: PermissionCode) => boolean,
): string | null {
  switch (order.holdReason) {
    case "CREDIT":
      return ORDER_HOLD_GUIDANCE.CREDIT;
    // WF-05 GH-1: BE ORDER_DELIVERY_FAILURE_USE_DECISION — gỡ bằng quyết định hồ sơ giao thất bại
    case "DELIVERY_FAILED":
      return ORDER_HOLD_GUIDANCE.DELIVERY_FAILED;
    case null:
    case "UNKNOWN":
      return can(ORDER_PERMISSIONS.hold) ? ORDER_HOLD_GUIDANCE.UNRESOLVABLE : null;
    default:
      return null;
  }
}
