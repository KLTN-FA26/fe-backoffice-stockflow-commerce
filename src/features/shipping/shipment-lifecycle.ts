/**
 * Shipping — action-gating lô giao (feature-architecture §6).
 *
 * Bảng `SHIPMENT_TRANSITIONS` (lib/domain, docs 09 §5). Chọn hãng cho lô chờ xuất: nhân viên kho
 * (BE `ShipmentController.assignCarrier`). Kết quả giao: Điều phối đơn hàng ghi nhận ĐÃ GIAO / GIAO
 * THẤT BẠI (docs 09 BR-02); HÀNG HOÀN VỀ KHO cả quản lý kho (BE kiểm vai trò trong controller).
 * UI-only — Backend phải re-check (quyền + vai trò + cạnh trạng thái → 409 SHIPMENT_STATE_CONFLICT).
 */

import { DELIVERY_OUTCOMES, SHIPMENT_PERMISSIONS, STAFF_ROLE, UI_LABELS } from "@/constants";
import { SHIPMENT_TRANSITIONS } from "@/lib/domain/lifecycle";

import { DISPATCH_ROLES, hasStaffRole } from "./lifecycle";

import type { DeliveryOutcome, StaffRole } from "@/constants";
import type { ShippingActor } from "./lifecycle";
import type { ShipmentRow } from "./types";

const N = UI_LABELS.shipping.shipment.noActions;

/** Vai trò BE được ghi nhận từng kết quả (`ShipmentController.recordOutcome`). */
export const OUTCOME_ROLES: Record<DeliveryOutcome, readonly StaffRole[]> = {
  DELIVERED: [STAFF_ROLE.ORDER_COORDINATOR],
  DELIVERY_FAILED: [STAFF_ROLE.ORDER_COORDINATOR],
  RETURNED: [STAFF_ROLE.ORDER_COORDINATOR, STAFF_ROLE.WAREHOUSE_MANAGER],
};

type GateShipment = Pick<ShipmentRow, "status" | "loadId">;

/** Chọn / bỏ hãng: lô còn chờ xuất, chưa nằm trên chuyến nào (BE 409 SHIPMENT_ON_ANOTHER_LOAD). */
export function canAssignCarrier(shipment: GateShipment, actor: ShippingActor): boolean {
  return (
    shipment.status === "READY_TO_DISPATCH" &&
    !shipment.loadId &&
    actor.can(SHIPMENT_PERMISSIONS.update) &&
    hasStaffRole(actor, DISPATCH_ROLES)
  );
}

/** Kết quả ghi nhận được từ trạng thái hiện tại, theo bảng chuyển trạng thái và vai trò của người dùng. */
export function allowedOutcomes(
  shipment: Pick<ShipmentRow, "status">,
  actor: ShippingActor,
): readonly DeliveryOutcome[] {
  if (shipment.status === "UNKNOWN" || !actor.can(SHIPMENT_PERMISSIONS.update)) return [];
  const next = SHIPMENT_TRANSITIONS[shipment.status];
  return DELIVERY_OUTCOMES.filter(
    (outcome) => next.includes(outcome) && hasStaffRole(actor, OUTCOME_ROLES[outcome]),
  );
}

/** Câu thay cho nút khi không có kết quả nào ghi nhận được. */
export function noOutcomeReason(
  shipment: Pick<ShipmentRow, "status">,
  actor: ShippingActor,
): string {
  if (!actor.can(SHIPMENT_PERMISSIONS.update)) return N.viewOnly;
  if (shipment.status === "READY_TO_DISPATCH") return N.readyToDispatch;
  if (shipment.status === "UNKNOWN") return N.terminal;
  if (SHIPMENT_TRANSITIONS[shipment.status].length === 0) return N.terminal;
  return N.wrongRole;
}
