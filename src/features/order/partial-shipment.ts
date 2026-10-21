/**
 * Order — luật của BE PR #150 mà màn đơn phải khớp: gating "Giao một phần" (PACK-PARTIAL) và đơn đóng sẵn hàng
 * có sẵn trước hàng in còn huỷ được (PACK-EARLY).
 *
 * Tách khỏi `lifecycle.ts` (giới hạn 200 dòng / file). Pure: trạng thái đơn + mã quyền → điều khiển trên màn.
 */

import { ORDER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { Order, OrderStatus } from "./types";

/** Dữ kiện của đơn mà `Order#packedOnlyAheadOfPrints` xét. */
export interface PackedAheadFacts {
  readonly packedAt: string | null;
  readonly hasShipments: boolean;
  /** Trạng thái đơn quay về khi gỡ giữ (staff). */
  readonly statusBeforeHold?: Order["statusBeforeHold"];
}

/**
 * BE `Order#packedOnlyAheadOfPrints` (BE PR #150, PACK-EARLY): hàng có sẵn của đơn còn đang in đã đóng
 * thành kiện nhưng CHƯA bàn giao lô nào → kiện còn nằm trong kho, huỷ được (huỷ kiện, trả hàng về tồn,
 * quy tắc phí khi đang in). Đã có lô rời đi hoặc đơn đã PACKED trở đi thì phải đi luồng trả hàng.
 * BE không trả cờ "huỷ được" nên FE đối chiếu cùng điều kiện (17 §4.5 bước 15).
 */
export function isPackedOnlyAheadOfPrints(
  status: OrderStatus,
  { packedAt, hasShipments, statusBeforeHold }: PackedAheadFacts,
): boolean {
  const printing =
    status === "In Production" || (status === "On Hold" && statusBeforeHold === "In Production");
  return packedAt !== null && printing && !hasShipments;
}

/**
 * BE `Order#decidePartialShipment`: Sales đổi được cho tới khi hàng đi hết / đơn đóng. Từ SHIPPED trở đi
 * (giao thất bại, đã giao, trả hàng, hoàn tiền, hoàn tất, huỷ, đóng sổ) → 409 ORDER_PARTIAL_SHIPMENT_LOCKED.
 */
export const PARTIAL_SHIPMENT_OPEN_STATUSES: readonly OrderStatus[] = [
  "Draft",
  "Pending Payment",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "Picking",
  "Partially Fulfilled",
  "Packed",
  "On Hold",
];

export type PartialShipmentLock = "closed" | "awaiting-prints";

/** Điều khiển "Giao một phần" trên chi tiết đơn: trạng thái hiện tại + việc nút sẽ làm. */
export interface PartialShipmentControl {
  /** Cờ hiện tại của đơn. */
  readonly allowed: boolean;
  /** Giá trị nút sẽ đặt (ngược với `allowed`). */
  readonly next: boolean;
  /** Có quyền VÀ đơn chưa bị khoá — mới hiện nút. */
  readonly canChange: boolean;
  /** Vì sao không đổi được dù có quyền (null = không bị khoá). */
  readonly lock: PartialShipmentLock | null;
}

/**
 * BE `Order.awaitingProduction` (PACK-EARLY): hàng có sẵn đã bàn giao trước khi hàng in xong, đơn tách hẳn và
 * chờ sản xuất. Cột này KHÔNG có trong `OrderResponse`, nên suy từ `printLinesReady` theo đúng
 * `Order#printLinesReady`: `printLinesReady = !hasPrintLines || (!printing && !awaitingProduction)`, với
 * `printing` = IN_PRODUCTION, hoặc ON_HOLD giữ từ IN_PRODUCTION (lúc đó chưa có lô nào đi nên awaiting = false).
 * Vậy `printLinesReady === false` mà đơn không còn "đang in" thì chỉ có thể là đang chờ sản xuất — kể cả khi đơn
 * ON_HOLD giữ từ PARTIALLY_FULFILLED (cờ này vẫn đúng suốt thời gian bị giữ).
 */
export function isAwaitingProduction(
  order: Pick<Order, "status" | "statusBeforeHold" | "printLinesReady">,
): boolean {
  if (order.printLinesReady !== false) return false;
  const printing =
    order.status === "In Production" ||
    (order.status === "On Hold" && order.statusBeforeHold === "In Production");
  return !printing;
}

/**
 * Điều khiển giao một phần của đơn, hoặc null khi BE không trả cờ (không đoán). Khoá theo
 * `Order#decidePartialShipment` (BE kiểm tra theo thứ tự này):
 * - đơn đã đi / đóng (`PARTIAL_SHIPMENT_OPEN_STATUSES`) → "closed";
 * - muốn TẮT mà đơn đang chờ sản xuất (`isAwaitingProduction`) → "awaiting-prints": đơn đã tách nên BE
 *   409 ORDER_PARTIAL_SHIPMENT_LOCKED cho tới khi hàng in xong hoặc phần còn lại được đóng. Đơn IN_PRODUCTION
 *   chưa giao lô nào thì vẫn tắt được.
 * Quyền tra theo MÃ (`sales-order-partial-shipments:UPDATE`), không theo vai trò.
 */
export function partialShipmentControl(
  order: Pick<Order, "status" | "statusBeforeHold" | "allowPartialShipment" | "printLinesReady">,
  can: (code: PermissionCode) => boolean,
): PartialShipmentControl | null {
  if (order.allowPartialShipment === null) return null;
  const allowed = order.allowPartialShipment;
  // Trạng thái chưa hỗ trợ: không đoán là đã đóng — chỉ hiện cờ, không cho đổi
  if (order.status === "UNKNOWN") return { allowed, next: !allowed, lock: null, canChange: false };
  let lock: PartialShipmentLock | null = null;
  if (!PARTIAL_SHIPMENT_OPEN_STATUSES.includes(order.status)) lock = "closed";
  else if (allowed && isAwaitingProduction(order)) lock = "awaiting-prints";
  return {
    allowed,
    next: !allowed,
    lock,
    // UI-only — Backend phải re-check (@RequiresPermission sales-order-partial-shipments:UPDATE;
    // đơn đã đi/đóng hoặc đang chờ sản xuất → 409 ORDER_PARTIAL_SHIPMENT_LOCKED)
    canChange: lock === null && can(ORDER_PERMISSIONS.partialShipment),
  };
}
