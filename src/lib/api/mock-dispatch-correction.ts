/**
 * Mock sửa tay kết quả giao (BE `ShipmentController.correctOutcome`, docs 09 §4.3 bước 5, E17): ĐÃ GIAO ↔ GIAO THẤT BẠI, lý
 * do sửa bắt buộc (≤ 500). Sửa thành giao thất bại cần lý do thất bại (+ ghi chú khi "Lý do khác") và nhớ thời điểm của lần
 * giao bị sửa — BE `ShipmentResponse.undoneDeliveredAt` (audit r3 EINV-1), chỉ có giá trị khi lô đang "giao thất bại" do
 * chính lần sửa đó. Sửa ngược về "đã giao" không gửi `deliveredAt` thì lấy lại đúng thời điểm đó; sau đó trường là null.
 */

import { MOCK_COORDINATOR } from "./mock-dispatch-store";
import { shipmentDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { DispatchState, MockShipment } from "./mock-dispatch-store";
import type { MockResponseShape } from "./mock-route-utils";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const FAILURE_REASONS = ["CUSTOMER_ABSENT", "REFUSED", "WRONG_ADDRESS", "LOST", "DAMAGED", "OTHER"];
const CORRECTABLE: Record<string, string> = {
  DELIVERED: "DELIVERY_FAILED",
  DELIVERY_FAILED: "DELIVERED",
};

export function correctOutcome(
  state: DispatchState,
  shipment: MockShipment,
  body: Record<string, unknown>,
): MockResponseShape {
  const outcome = text(body.outcome);
  if (outcome !== "DELIVERED" && outcome !== "DELIVERY_FAILED") {
    return validationFailed("outcome", "must match DELIVERED or DELIVERY_FAILED");
  }
  const why = text(body.reason);
  if (!why || why.length > 500)
    return validationFailed("reason", "required, at most 500 characters");
  const failureReason = text(body.failureReason);
  const note = text(body.note);
  if (outcome === "DELIVERY_FAILED") {
    if (!FAILURE_REASONS.includes(failureReason))
      return validationFailed("failureReason", "a failed delivery says why");
    if (failureReason === "OTHER" && !note) return validationFailed("note", "OTHER needs a note");
  }
  // Cùng kết quả gửi lại → không đổi gì
  if (shipment.status === outcome) return ok(shipmentDetailView(state, shipment));
  if (CORRECTABLE[shipment.status] !== outcome) {
    return fail(
      409,
      "SHIPMENT_STATE_CONFLICT",
      `Shipment ${shipment.code} is ${shipment.status}; it cannot be corrected to ${outcome}`,
    );
  }
  const now = new Date().toISOString();
  if (outcome === "DELIVERY_FAILED") {
    shipment.undoneDeliveredAt = shipment.outcomeAt;
    shipment.failureReason = failureReason;
    shipment.failureNote = note || null;
    shipment.outcomeAt = now;
  } else {
    shipment.outcomeAt = text(body.deliveredAt) || shipment.undoneDeliveredAt || now;
    shipment.undoneDeliveredAt = null;
    shipment.failureReason = null;
    shipment.failureNote = null;
  }
  shipment.status = outcome;
  shipment.version += 1;
  shipment.timeline.push({
    status: outcome,
    occurredAt: now,
    recordedByName: MOCK_COORDINATOR,
    note: why,
  });
  return ok(shipmentDetailView(state, shipment));
}
