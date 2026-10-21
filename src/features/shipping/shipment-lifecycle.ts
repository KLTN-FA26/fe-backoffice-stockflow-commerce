/**
 * Shipping — action-gating lô giao (feature-architecture §6).
 *
 * Bảng `SHIPMENT_TRANSITIONS` (lib/domain, docs 09 §5). Chọn hãng cho lô chờ xuất:
 * `fulfillment-dispatch:UPDATE` (BE `PUT /shipments/{id}/carrier`). Kết quả giao (BE PR #148, docs 09
 * BR-02): endpoint cần `fulfillment-delivery-outcomes:UPDATE`; ĐÃ GIAO / GIAO THẤT BẠI cần thêm
 * `fulfillment-delivery-outcomes:APPROVE`, HÀNG HOÀN VỀ KHO chỉ cần UPDATE.
 * UI-only — Backend phải re-check (quyền + cạnh trạng thái → 409 SHIPMENT_STATE_CONFLICT).
 */

import {
  DELIVERY_OUTCOMES,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { SHIPMENT_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { DeliveryOutcome } from "@/constants";
import type { ShippingActor } from "./lifecycle";
import type { ShipmentRow } from "./types";

const N = UI_LABELS.shipping.shipment.noActions;
const OUTCOME = FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS;

type GateShipment = Pick<ShipmentRow, "status" | "loadId">;

/** Chọn / bỏ hãng: lô còn chờ xuất, chưa nằm trên chuyến nào (BE 409 SHIPMENT_ON_ANOTHER_LOAD). */
export function canAssignCarrier(shipment: GateShipment, actor: ShippingActor): boolean {
  return (
    shipment.status === "READY_TO_DISPATCH" &&
    !shipment.loadId &&
    actor.can(FULFILLMENT_DISPATCH_PERMISSIONS.update)
  );
}

/** Ghi nhận được kết quả này? RETURNED chỉ cần UPDATE; các kết quả còn lại cần thêm APPROVE. */
function canRecord(outcome: DeliveryOutcome, actor: ShippingActor): boolean {
  if (!actor.can(OUTCOME.update)) return false;
  return outcome === "RETURNED" || actor.can(OUTCOME.approve);
}

/** Kết quả ghi nhận được từ trạng thái hiện tại, theo bảng chuyển trạng thái và quyền của người dùng. */
export function allowedOutcomes(
  shipment: Pick<ShipmentRow, "status">,
  actor: ShippingActor,
): readonly DeliveryOutcome[] {
  if (shipment.status === "UNKNOWN") return [];
  const next = SHIPMENT_TRANSITIONS[shipment.status];
  return DELIVERY_OUTCOMES.filter((outcome) => next.includes(outcome) && canRecord(outcome, actor));
}

/** Câu thay cho nút khi không có kết quả nào ghi nhận được. */
export function noOutcomeReason(
  shipment: Pick<ShipmentRow, "status">,
  actor: ShippingActor,
): string {
  if (!actor.can(OUTCOME.update)) return N.viewOnly;
  if (shipment.status === "READY_TO_DISPATCH") return N.readyToDispatch;
  if (shipment.status === "UNKNOWN") return N.terminal;
  if (SHIPMENT_TRANSITIONS[shipment.status].length === 0) return N.terminal;
  return N.needsApproval;
}
