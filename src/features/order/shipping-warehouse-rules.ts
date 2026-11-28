/**
 * Kho xuất của đơn — luật hiển thị / gating khớp BE (docs 17 §4.2 bước 2-3, BR-22), pure.
 *
 * UI-only — Backend phải re-check: `PUT /orders/{id}/shipping-warehouse` (`@RequiresPermission
 * sales-order-shipping-warehouses:UPDATE`, `Order#chooseShippingWarehouse`: chỉ đơn của hợp đồng ở CONFIRMED hoặc
 * AWAITING_STOCK; đổi sang kho khác bị 409 `ORDER_SHIPPING_WAREHOUSE_LOCKED` khi đã giữ hàng hoặc đã có Đơn sản xuất gửi đi).
 */

import { ORDER_SHIPPING_WAREHOUSE_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type {
  ShippingCoverage,
  ShippingLineCoverage,
  ShippingWarehouseOption,
} from "./shipping-warehouse-schemas";
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

/** Vì sao kho đầu danh sách được gợi ý — đúng hai ưu tiên của docs 17 §4.2 bước 2 (C3). */
export type RecommendationReason = "holdsEveryLine" | "roomForProduction";

/**
 * Kho hệ thống gợi ý và lý do (docs 17 §4.2 bước 2): BE xếp kho đầu danh sách là kho (1) đang có đủ hàng cho mọi dòng, rồi
 * (2) còn chỗ (còn trống dự kiến ≥ thể tích phần phải sản xuất, thể tích tính được) cho phần phải sản xuất, chỗ lớn hơn
 * trước. Kho đầu không rơi vào hai nhóm đó (kho chỉ được xếp theo số thùng có sẵn, không có trong docs) thì không có lý do
 * để nói — trả `null`, FE không chọn sẵn và không ghi "Gợi ý vì…". Chỉ một kho: kho đó là lựa chọn duy nhất, không cần lý do.
 */
export function recommendedWarehouse(
  warehouses: readonly ShippingWarehouseOption[],
): { warehouseId: string; reason: RecommendationReason } | null {
  const first = warehouses[0];
  if (!first) return null;
  if (first.holdsEveryLine) return { warehouseId: first.warehouseId, reason: "holdsEveryLine" };
  if (!first.exceedsProjected && first.neededM3 != null && first.projectedFreeM3 != null)
    return { warehouseId: first.warehouseId, reason: "roomForProduction" };
  return null;
}

/**
 * Kho chọn sẵn khi mở hộp thoại (R6): chỉ có một kho → kho đó; nhiều kho → kho gợi ý có lý do. Đơn đã có kho xuất (đang đổi
 * kho) thì không chọn sẵn — đổi là việc Sale chủ động. Sale vẫn phải bấm "Chọn kho và giữ hàng".
 */
export function defaultWarehouseId(
  warehouses: readonly ShippingWarehouseOption[],
  chosenWarehouseId: string | null | undefined,
): string {
  if (chosenWarehouseId) return "";
  if (warehouses.length === 1) return warehouses[0]?.warehouseId ?? "";
  return recommendedWarehouse(warehouses)?.warehouseId ?? "";
}
