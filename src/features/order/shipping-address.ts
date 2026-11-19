/**
 * Order — đổi địa chỉ giao (docs 17 §4.7 bước 23-24, BR-16; 08 BR-04, §6 "Địa chỉ giao không hợp lệ").
 *
 * Pure: trạng thái đơn + mốc dán nhãn + mã quyền → có hiện "Đổi địa chỉ giao" không. Khớp `Order#changeShippingAddress`
 * của BE (WF04 G2). UI-only — Backend phải re-check (`@RequiresPermission sales-order-addresses:UPDATE`; đơn đã có thùng
 * dán nhãn hoặc ở bước không cho đổi → 409 ORDER_ADDRESS_LOCKED).
 */

import { ORDER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderReadStatus } from "./types";

/**
 * Bước đổi được địa chỉ giao (docs 17 §4.7 bước 24): `Draft` sửa tự do (14); từ `Pending Payment` tới `Picking` chỉ đổi
 * địa chỉ giao, khi chưa dán nhãn giao hàng. `Pending Contract` không có: hợp đồng đã gửi mang địa chỉ, Sale huỷ hợp đồng
 * để sửa (14 §4.3 bước 16). `Packed` trở đi không sửa.
 */
export const SHIPPING_ADDRESS_CHANGE_STATUSES: readonly OrderReadStatus[] = [
  "Draft",
  "Pending Payment",
  "Confirmed",
  "Awaiting Stock",
  "Ready to Fulfill",
  "Picking",
];

/**
 * Sale đổi được địa chỉ giao của đơn: có mã quyền, đơn của một khách (địa chỉ chọn từ sổ địa chỉ — 14 §4.2 bước 9), thùng
 * đầu tiên chưa dán nhãn (08 BR-04) và đơn ở bước cho đổi. Đơn đang tạm giữ xét theo bước trước khi giữ: địa chỉ sai được
 * giữ lý do ADDRESS, sửa, rồi gỡ giữ (08 §6).
 */
export function canChangeShippingAddress(
  order: Pick<Order, "status" | "statusBeforeHold" | "firstLabeledAt" | "customerId">,
  can: (code: PermissionCode) => boolean,
): boolean {
  const standing = order.status === "On Hold" ? order.statusBeforeHold : order.status;
  return (
    can(ORDER_PERMISSIONS.shippingAddress) &&
    !!order.customerId &&
    order.firstLabeledAt === null &&
    standing !== null &&
    SHIPPING_ADDRESS_CHANGE_STATUSES.includes(standing)
  );
}
