/**
 * Kho xuất của đơn — luật hiển thị / gating khớp BE (docs 17 §4.2 bước 2-3, BR-22), pure.
 *
 * UI-only — Backend phải re-check: `PUT /orders/{id}/shipping-warehouse` (`@RequiresPermission
 * sales-order-shipping-warehouses:UPDATE`, `Order#chooseShippingWarehouse`: chỉ đơn của hợp đồng ở CONFIRMED hoặc
 * AWAITING_STOCK; đổi sang kho khác bị 409 `ORDER_SHIPPING_WAREHOUSE_LOCKED` khi đã giữ hàng hoặc đã có Đơn sản xuất gửi đi).
 */

import { ORDER_SHIPPING_WAREHOUSE_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { ShippingCoverage, ShippingLineCoverage } from "./shipping-warehouse-schemas";
import type { Order, OrderReadStatus } from "./types";

/**
 * BE `Order#chooseShippingWarehouse`: đơn Đã xác nhận (Sale chọn kho) hoặc Đang chờ hàng (Đơn sản xuất đã gửi — chọn lại
 * để giữ phần hàng vừa về). Các trạng thái khác BE trả 409 ORDER_SHIPPING_WAREHOUSE_NOT_ALLOWED.
 */
export const SHIPPING_WAREHOUSE_STATUSES: readonly OrderReadStatus[] = [
  "Confirmed",
  "Awaiting Stock",
];

export interface ShippingWarehouseControl {
  /** Có thấy thẻ "Kho xuất" + tình trạng giữ hàng (`sales-order-shipping-warehouses:READ`). */
  readonly canRead: boolean;
  /** Có nút chọn / đổi kho (`sales-order-shipping-warehouses:UPDATE`). */
  readonly canChoose: boolean;
}

/** `null` = không hiện thẻ (đơn ở bước khác, hoặc không có quyền đọc lẫn ghi). */
export function shippingWarehouseControl(
  order: Pick<Order, "status">,
  can: (code: PermissionCode) => boolean,
): ShippingWarehouseControl | null {
  if (!SHIPPING_WAREHOUSE_STATUSES.includes(order.status)) return null;
  const canChoose = can(ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.update);
  const canRead = can(ORDER_SHIPPING_WAREHOUSE_PERMISSIONS.read);
  return canRead || canChoose ? { canRead: canRead || canChoose, canChoose } : null;
}

export interface CartonTotals {
  readonly cartons: number;
  readonly held: number;
  readonly short: number;
}

export function cartonTotals(lines: readonly ShippingLineCoverage[]): CartonTotals {
  return lines.reduce<CartonTotals>(
    (sum, line) => ({
      cartons: sum.cartons + line.cartons,
      held: sum.held + line.heldCartons,
      short: sum.short + line.shortCartons,
    }),
    { cartons: 0, held: 0, short: 0 },
  );
}

export type HoldOutcome = "full" | "partial" | "none";

/**
 * Kết quả giữ hàng của đơn ở kho xuất: đủ (BE `fullyHeld`) / một phần (giữ k < N thùng) / chưa giữ được thùng nào
 * (phần thiếu được giữ tiếp khi hàng nhập kho — docs 17 §4.2 bước 3).
 */
export function holdOutcome(coverage: Pick<ShippingCoverage, "fullyHeld" | "lines">): HoldOutcome {
  if (coverage.fullyHeld) return "full";
  return cartonTotals(coverage.lines).held > 0 ? "partial" : "none";
}

/**
 * Đã có hàng giữ ở kho xuất → không đổi sang kho khác (docs 17 §4.2 bước 2, BR-22). Chưa biết tình trạng giữ hàng
 * (`undefined`) thì không khoá: BE là bên quyết (409 `ORDER_SHIPPING_WAREHOUSE_LOCKED`).
 */
export function isWarehouseLocked(coverage: ShippingCoverage | undefined): boolean {
  return !!coverage?.warehouseId && cartonTotals(coverage.lines).held > 0;
}
