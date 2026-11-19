/**
 * Giao thất bại — vòng đời hồ sơ + action-gating (WF-05 GH-1; docs 09 §4.3, 17 §4.8 bước 33).
 *
 * Bảng chuyển trạng thái chép từ BE `DeliveryFailureCase` / `DeliveryFailureService`:
 * - OPEN → REDELIVERY (Sale quyết giao lại) | CANCELLED (huỷ phần chưa giao).
 * - REDELIVERY → REDELIVERED (bàn giao lại thành lô mới) | CANCELLED (huỷ khi hàng giao lại chưa được lấy).
 * - REDELIVERED, CANCELLED: đóng (`Status#isClosed`) — không quyết định lại.
 * UI-only — Backend phải re-check (DELIVERY_FAILURE_INVALID_TRANSITION, @RequiresPermission).
 */

import { ORDER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { DeliveryFailureCase, DeliveryFailureCaseStatus } from "./delivery-failure-schemas";
import type { Order } from "./types";

export const DELIVERY_FAILURE_TRANSITIONS: Readonly<
  Record<DeliveryFailureCaseStatus, readonly DeliveryFailureCaseStatus[]>
> = {
  OPEN: ["REDELIVERY", "CANCELLED"],
  REDELIVERY: ["REDELIVERED", "CANCELLED"],
  REDELIVERED: [],
  CANCELLED: [],
  // Trạng thái BE thêm sau: FE không đoán — không thao tác
  UNKNOWN: [],
};

export type DeliveryFailureActionCode = "redeliver" | "cancel-undelivered";

/**
 * Thao tác Sale được làm trên một hồ sơ:
 * - Giao lại (`POST …/redelivery`): chỉ từ OPEN (BE `requireRedeliverable`), `sales-order-holds:UPDATE` — giao lại gỡ giữ
 *   đơn (QD-12).
 * - Huỷ phần chưa giao (`POST …/cancellation`): hồ sơ chưa đóng, `sales-order-cancellations:UPDATE` — là đóng phần còn
 *   lại của đơn (như `/remainder-closure`).
 */
export function allowedDeliveryFailureActions(
  failure: Pick<DeliveryFailureCase, "status">,
  can: (code: PermissionCode) => boolean,
): DeliveryFailureActionCode[] {
  const next = DELIVERY_FAILURE_TRANSITIONS[failure.status];
  const codes: DeliveryFailureActionCode[] = [];
  if (next.includes("REDELIVERY") && can(ORDER_PERMISSIONS.hold)) codes.push("redeliver");
  if (next.includes("CANCELLED") && can(ORDER_PERMISSIONS.cancel)) codes.push("cancel-undelivered");
  return codes;
}

/**
 * Huỷ phần chưa giao khi CHƯA có hồ sơ (`POST /orders/{id}/delivery-failures/cancellation`, WF-05 review F6.1): đơn đang
 * giữ vì giao thất bại VÀ có lô đã về (RETURNED) mà chưa có hồ sơ — hàng mất trên đường về, hoặc kho chưa lập phiếu nhận
 * hàng hoàn. BE `uncased` còn xét "lô còn nợ đơn vị" (FE không biết) → BE vẫn có thể từ chối (409).
 */
export function canCancelWithoutCase(
  order: Pick<Order, "status" | "holdReason" | "shipments">,
  cases: readonly Pick<DeliveryFailureCase, "shipmentId">[],
  can: (code: PermissionCode) => boolean,
): boolean {
  if (order.status !== "On Hold" || order.holdReason !== "DELIVERY_FAILED") return false;
  if (!can(ORDER_PERMISSIONS.cancel)) return false;
  const cased = new Set(cases.map((failure) => failure.shipmentId));
  return order.shipments.some(
    (shipment) => shipment.status === "RETURNED" && !cased.has(shipment.shipmentId),
  );
}
