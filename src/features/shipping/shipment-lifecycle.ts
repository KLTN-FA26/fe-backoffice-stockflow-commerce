/**
 * Shipping — action-gating lô giao (feature-architecture §6).
 *
 * Bảng `SHIPMENT_TRANSITIONS` (lib/domain, docs 09 §5). Hãng gắn vào xe khi ghi nhận đặt xe, không còn chọn hãng
 * cho từng lô. Kết quả giao (BE PR #148, docs 09 BR-02): endpoint cần `fulfillment-delivery-outcomes:UPDATE`, và MỌI kết quả
 * cần thêm `fulfillment-delivery-outcomes:APPROVE` — kể cả HÀNG HOÀN VỀ KHO (WF-05 Q-7, BE-14, F-6): ghi hàng hoàn về
 * đóng hẳn phần hàng của lô khỏi đơn và dẫn tới tính tiền, không sửa lại được, nên là việc của người có quyền phê duyệt.
 * UI-only — Backend phải re-check (quyền + cạnh trạng thái → 409 SHIPMENT_STATE_CONFLICT).
 */

import {
  DELIVERY_OUTCOMES,
  FULFILLMENT_DELIVERY_CORRECTION_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";
import { PACK_SHIPMENT_STATUS } from "@/constants/statuses";
import { SHIPMENT_TRANSITIONS } from "@/lib/domain/lifecycle";

import type { DeliveryOutcome } from "@/constants";
import type { ShippingActor } from "./lifecycle";
import type { ShipmentRow } from "./types";

const N = UI_LABELS.shipping.shipment.noActions;
const OUTCOME = FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS;

/** Ghi nhận được kết quả này? Mọi kết quả (gồm RETURNED, Q-7) cần UPDATE + APPROVE — BE 403 nếu thiếu APPROVE. */
function canRecord(_outcome: DeliveryOutcome, actor: ShippingActor): boolean {
  return actor.can(OUTCOME.update) && actor.can(OUTCOME.approve);
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

/**
 * Sửa tay kết quả giao (docs 09 §4.3 bước 5): chỉ lô đã có kết quả ĐÃ GIAO hoặc GIAO THẤT BẠI, và người dùng có
 * `fulfillment-delivery-corrections:UPDATE`. Đơn đã hoàn tất / lô giao cả đơn do BE từ chối (409) — FE không đoán.
 */
export function canCorrectOutcome(
  shipment: Pick<ShipmentRow, "status">,
  actor: ShippingActor,
): boolean {
  if (
    shipment.status !== PACK_SHIPMENT_STATUS.DELIVERED &&
    shipment.status !== PACK_SHIPMENT_STATUS.DELIVERY_FAILED
  ) {
    return false;
  }
  return actor.can(FULFILLMENT_DELIVERY_CORRECTION_PERMISSIONS.update);
}

/**
 * Có tải được biên bản giao nhận (PDF) của lô không: cần `fulfillment-shipments:READ`; lô đã huỷ không có biên bản (BE 409
 * SHIPMENT_STATE_CONFLICT). UI-only — Backend phải re-check (quyền + trạng thái).
 */
export function canDownloadDeliveryNote(
  shipment: Pick<ShipmentRow, "status">,
  actor: ShippingActor,
): boolean {
  return actor.can(SHIPMENT_PERMISSIONS.read) && shipment.status !== "CANCELLED";
}
