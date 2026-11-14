/**
 * Mock bàn giao + kết quả giao — mã lỗi đúng BE `DispatchService.handOver` / `DispatchLoad.handOver` / `Shipment`:
 * 409 OPTIMISTIC_LOCK (khoá `version`); bàn giao là tất cả hoặc không (09 BR-18): có đơn chưa được phép đi (chưa thu đợt
 * thanh toán trước khi giao, chưa tới cửa sổ giao, đang giữ) → 409 LOAD_HANDOVER_BLOCKED kèm `details.orders`; rồi 409
 * LOAD_UNLOAD_PENDING, 400 HANDOVER_NOT_SIGNED, 409 LOAD_WAYBILL_MISSING (BR-23), LOAD_EMPTY, LOAD_NOT_FULLY_LOADED;
 * ghi nhận kết quả theo bảng chuyển trạng thái docs 09 §5.
 */

import { isLastVehicleOf } from "./mock-dispatch-ftl-rules";
import { parcelsOn } from "./mock-dispatch-ftl-view";
import { MOCK_COORDINATOR, MOCK_DISPATCHER } from "./mock-dispatch-store";
import { handoverBlocksOf, loadDetailView, shipmentDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { DispatchState, MockLoad, MockShipment } from "./mock-dispatch-store";
import type { MockResponseShape } from "./mock-route-utils";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const stamp = () => new Date().toISOString();

export function handover(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  // Đã bàn giao: trả nguyên chuyến (gọi lại là vô hại)
  if (load.status === "DISPATCHED") return ok(loadDetailView(state, load));
  if (body.version !== load.version) {
    return fail(
      409,
      "OPTIMISTIC_LOCK",
      `Load ${load.code} changed since version ${String(body.version)} (now ${load.version})`,
    );
  }
  if (load.status !== "LOADING") {
    return fail(
      409,
      "INVALID_LOAD_TRANSITION",
      `Load ${load.code} is ${load.status}; it cannot be handed over`,
    );
  }
  // Tất cả hoặc không: một đơn không được đi thì cả xe bị từ chối, kèm danh sách đơn (số tiền thiếu, đợt giao, ngày mở cửa sổ)
  const blocks = handoverBlocksOf(state, load);
  if (blocks.length > 0) {
    return fail(
      409,
      "LOAD_HANDOVER_BLOCKED",
      `The vehicle cannot be handed over: ${blocks.map((b) => `${b.orderNumber} (${b.reasonCode})`).join(", ")}`,
      [],
      { orders: blocks.map((b) => ({ ...b, amountDue: String(b.amountDue) })) },
    );
  }
  // BE PR #162: kiện của đơn đã huỷ còn trên xe thì chưa ký được
  if (load.ftl.pendingUnloads.length > 0) {
    return fail(
      409,
      "LOAD_UNLOAD_PENDING",
      `Load ${load.code} still carries ${load.ftl.pendingUnloads.length} parcel(s) of a cancelled order: unload them first`,
    );
  }
  if (body.signed !== true) {
    return fail(
      400,
      "HANDOVER_NOT_SIGNED",
      `Both sides sign the manifest of load ${load.code} before it leaves`,
    );
  }
  // BR-23: không có mã vận đơn thì chưa ký được
  if (!load.waybillNo) {
    return fail(
      409,
      "LOAD_WAYBILL_MISSING",
      `Load ${load.code} has no waybill number: record the carrier's number before the driver signs`,
    );
  }
  const representative = text(body.carrierRepresentative);
  const plate = text(body.vehiclePlate) || load.vehiclePlate;
  if (!representative) return validationFailed("carrierRepresentative", "must not be blank");
  if (!plate) return validationFailed("vehiclePlate", "The manifest names the vehicle plate");
  const members = load.shipmentIds
    .map((id) => state.shipments.get(id))
    .filter((s): s is MockShipment => !!s);
  if (members.length === 0)
    return fail(409, "LOAD_EMPTY", `Load ${load.code} has no shipment on its manifest`);
  const missing = members.flatMap((s) =>
    parcelsOn(load, s)
      .filter((p) => !load.loaded.has(p.packageId))
      .map((p) => p.labelCode),
  );
  if (missing.length > 0) {
    return fail(
      409,
      "LOAD_NOT_FULLY_LOADED",
      `Not scanned onto the vehicle yet: ${missing.sort().join(", ")}`,
    );
  }
  const at = stamp();
  for (const shipment of members) {
    // Lô chở trên nhiều xe chỉ HANDED_OVER ở xe cuối cùng (BE LP-3)
    if (!isLastVehicleOf(state, load, shipment)) continue;
    shipment.status = "HANDED_OVER";
    shipment.handedOverAt = at;
    shipment.carrierId = load.carrierId;
    shipment.version += 1;
    shipment.timeline.push({
      status: "HANDED_OVER",
      occurredAt: at,
      recordedByName: MOCK_DISPATCHER,
      note: null,
    });
  }
  load.status = "DISPATCHED";
  load.dispatchedAt = at;
  load.carrierRepresentative = representative;
  load.vehiclePlate = plate;
  // BE `DispatchLoad.handOver`: chưa có tên tài xế thì lấy tên người ký bên hãng
  load.driverName = load.driverName ?? representative;
  load.driverPhone = text(body.driverPhone) || load.driverPhone;
  load.signatureRef = text(body.signatureRef) || null;
  load.handoverNote = text(body.note) || null;
  load.version += 1;
  return ok(loadDetailView(state, load));
}

const OUTCOME_TARGETS: Record<string, readonly string[]> = {
  HANDED_OVER: ["DELIVERED", "DELIVERY_FAILED"],
  DELIVERY_FAILED: ["DELIVERED", "RETURNED"],
};
const FAILURE_REASONS = ["CUSTOMER_ABSENT", "REFUSED", "WRONG_ADDRESS", "LOST", "DAMAGED", "OTHER"];

export function recordOutcome(
  state: DispatchState,
  shipment: MockShipment,
  body: Record<string, unknown>,
): MockResponseShape {
  const outcome = text(body.outcome);
  if (!["DELIVERED", "DELIVERY_FAILED", "RETURNED"].includes(outcome)) {
    return validationFailed("outcome", "must match DELIVERED, DELIVERY_FAILED or RETURNED");
  }
  const reason = text(body.failureReason);
  const note = text(body.note);
  if (outcome === "DELIVERY_FAILED") {
    if (!FAILURE_REASONS.includes(reason))
      return validationFailed("failureReason", "a failed delivery says why");
    if (reason === "OTHER" && !note) return validationFailed("note", "OTHER needs a note");
  }
  // Cùng kết quả gửi lại → không đổi gì
  if (shipment.status === outcome) return ok(shipmentDetailView(state, shipment));
  if (!OUTCOME_TARGETS[shipment.status]?.includes(outcome)) {
    return fail(
      409,
      "SHIPMENT_STATE_CONFLICT",
      `Shipment ${shipment.code} is ${shipment.status}; it cannot become ${outcome}`,
    );
  }
  const at = stamp();
  shipment.status = outcome as MockShipment["status"];
  shipment.outcomeAt = at;
  if (outcome === "DELIVERY_FAILED") {
    shipment.failureReason = reason;
    shipment.failureNote = note || null;
  }
  shipment.version += 1;
  shipment.timeline.push({
    status: shipment.status,
    occurredAt: at,
    recordedByName: MOCK_COORDINATOR,
    note: note || null,
  });
  return ok(shipmentDetailView(state, shipment));
}
