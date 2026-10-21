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
 * Điều khiển giao một phần của đơn, hoặc null khi BE không trả cờ (không đoán). Khoá:
 * - đơn đã đi / đóng (`PARTIAL_SHIPMENT_OPEN_STATUSES`);
 * - đang bật mà đơn PARTIALLY_FULFILLED còn chờ hàng in (`printLinesReady = false`): hàng có sẵn đã đi trước
 *   hàng in nên đơn đã tách — BE 409 khi tắt. Khoá này chỉ gợi ý sớm; BE vẫn là người quyết (đơn ON_HOLD giữ từ
 *   trạng thái đó chỉ biết qua 409).
 * Quyền tra theo MÃ (`sales-order-partial-shipments:UPDATE`), không theo vai trò.
 */
export function partialShipmentControl(
  order: Pick<Order, "status" | "allowPartialShipment" | "printLinesReady">,
  can: (code: PermissionCode) => boolean,
): PartialShipmentControl | null {
  if (order.allowPartialShipment === null) return null;
  const allowed = order.allowPartialShipment;
  // Trạng thái chưa hỗ trợ: không đoán là đã đóng — chỉ hiện cờ, không cho đổi
  if (order.status === "UNKNOWN") return { allowed, next: !allowed, lock: null, canChange: false };
  let lock: PartialShipmentLock | null = null;
  if (!PARTIAL_SHIPMENT_OPEN_STATUSES.includes(order.status)) lock = "closed";
  else if (allowed && order.status === "Partially Fulfilled" && order.printLinesReady === false) {
    lock = "awaiting-prints";
  }
  return {
    allowed,
    next: !allowed,
    lock,
    canChange: lock === null && can(ORDER_PERMISSIONS.partialShipment),
  };
}
