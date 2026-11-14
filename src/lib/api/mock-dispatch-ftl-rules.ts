/**
 * Mock chuyến xe — dỡ kiện của đơn đã huỷ, huỷ có kiểm soát một xe, bỏ xe khỏi kế hoạch (BE `DispatchService`, SCRUM-474), mã
 * lỗi đúng BE. Đặt xe / bắt đầu xếp: `mock-dispatch-booking.ts`; quét đúng xe: `mock-dispatch-ftl-scan.ts`; bàn giao (lô chỉ
 * HANDED_OVER ở xe cuối cùng): `mock-dispatch-handover.ts`; mã vận đơn: `mock-dispatch-waybill.ts`.
 */

import { UNLOAD_REASON_CODES } from "@/constants";

import { loadDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { DispatchState, MockLoad, MockShipment } from "./mock-dispatch-store";
import type { MockResponseShape } from "./mock-route-utils";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const stamp = () => new Date().toISOString();
const detail = (state: DispatchState, load: MockLoad) => ok(loadDetailView(state, load));
const invalid = (load: MockLoad, action: string) =>
  fail(409, "INVALID_LOAD_TRANSITION", `Load ${load.code} is ${load.status}; it cannot ${action}`);

/** Xe không còn gì để chở (mọi lô bị huỷ) → hệ thống tự huỷ; đã đặt xe thì nhắc huỷ xe ngoài hệ thống. */
function callOffIfEmpty(state: DispatchState, load: MockLoad): void {
  if (load.status === "CANCELLED") return;
  const carrying = load.shipmentIds.some((id) => state.shipments.get(id)?.status !== "CANCELLED");
  if (carrying || load.ftl.pendingUnloads.length > 0) return;
  load.status = "CANCELLED";
  load.cancelledAt = stamp();
  load.cancelReason =
    "auto-cancelled: nothing to carry - the orders on this vehicle were cancelled";
  load.ftl.carrierBookingToCancel = load.ftl.bookedAt !== null;
}

export function unload(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const code = text(body.packageCode);
  if (!code) return validationFailed("packageCode", "must not be blank");
  const known = [...state.shipments.values()]
    .flatMap((s) => s.parcels)
    .find((p) => p.labelCode.toUpperCase() === code.toUpperCase());
  if (!known) return fail(404, "PACKAGE_NOT_FOUND", `No package labelled ${code}`);
  const pending = load.ftl.pendingUnloads.find((u) => u.packageId === known.packageId);
  if (!pending) {
    return fail(
      409,
      "PACKAGE_NOT_IN_LOAD",
      `Package ${known.labelCode} is not waiting to be unloaded from ${load.code}`,
    );
  }
  load.ftl.pendingUnloads = load.ftl.pendingUnloads.filter((u) => u !== pending);
  load.loaded.delete(known.packageId);
  load.ftl.placed.delete(known.packageId);
  callOffIfEmpty(state, load);
  load.version += 1;
  return detail(state, load);
}

const REASON_CODES: readonly string[] = UNLOAD_REASON_CODES;

/**
 * Huỷ có kiểm soát MỘT xe đang xếp hàng (BE `DispatchService.cancelControlled`, SCRUM-474 UNLOAD-DESIGN điểm 2, 4, 7): chuyến
 * CANCELLED ngay kèm mã lý do + ghi chú, kiện đã quét thành "cần dỡ" (bị khoá), và một chuyến PLANNED cùng kế hoạch / xe /
 * kiện thay thế. Chuyến đã huỷ có kiểm soát → trả lại như cũ (không tạo thêm).
 */
export function cancelControlled(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const code = text(body.reasonCode);
  const note = text(body.note);
  if (!REASON_CODES.includes(code)) return validationFailed("reasonCode", "must be a reason code");
  if (!note) return validationFailed("note", "must not be blank");
  // Huỷ bằng đường khác (huỷ thường, tự huỷ): không phải "huỷ lại" — BE 409, không trả 200 như có chuyến thay thế
  if (load.status === "CANCELLED" && !load.ftl.cancelReasonCode)
    return invalid(load, "be called off again: it was not cancelled under control");
  // Đã huỷ có kiểm soát: trả lại như cũ kèm chuyến thay thế còn sống (BE idempotent, không tạo thêm)
  if (load.status === "CANCELLED" && load.ftl.cancelReasonCode) {
    const live = state.loads.get(`${load.loadId}-r`);
    return ok({
      cancelled: loadDetailView(state, load),
      replacement: live ? loadDetailView(state, live) : undefined,
    });
  }
  if (load.status !== "LOADING") return invalid(load, "be cancelled under control");
  const at = stamp();
  const alreadyPending = new Set(load.ftl.pendingUnloads.map((u) => u.packageId));
  const pending = [...load.loaded.keys()].flatMap((packageId) => {
    // Kiện của đơn đã huỷ đã chờ dỡ từ trước (BE: đã gỡ khỏi xe, giữ lý do cũ) — không ghi hai lần
    if (alreadyPending.has(packageId)) return [];
    const shipment = [...state.shipments.values()].find((s) =>
      s.parcels.some((p) => p.packageId === packageId),
    );
    const parcel = shipment?.parcels.find((p) => p.packageId === packageId);
    return shipment && parcel
      ? [
          {
            packageId,
            labelCode: parcel.labelCode,
            shipmentId: shipment.shipmentId,
            shipmentCode: shipment.code,
            reason: note,
            requestedAt: at,
            reasonCode: code,
          },
        ]
      : [];
  });
  const carrying = load.shipmentIds.filter((id) => state.shipments.get(id)?.status !== "CANCELLED");
  // Xe không còn gì để chở (mọi đơn trên xe đã huỷ): không mở chuyến thay thế rỗng (BE: kế hoạch không chờ xe đó)
  const replacement: MockLoad | null =
    carrying.length === 0
      ? null
      : {
          ...load,
          loadId: `${load.loadId}-r`,
          code: `${load.code}-R`,
          status: "PLANNED",
          carrierId: null,
          vehiclePlate: null,
          driverName: null,
          driverPhone: null,
          waybillNo: null,
          waybillHistory: [],
          carrierBooking: null,
          shipmentIds: carrying,
          loaded: new Map(),
          loadingStartedAt: null,
          cancelledAt: null,
          cancelReason: null,
          version: 0,
          ftl: {
            ...load.ftl,
            placed: new Set(load.ftl.placed),
            bookedAt: null,
            bookedBy: null,
            bookingCancelledAt: null,
            bookingCancelReason: null,
            pendingUnloads: [],
            carrierBookingToCancel: false,
            cancelReasonCode: null,
          },
        };
  load.ftl.pendingUnloads = [...load.ftl.pendingUnloads, ...pending];
  load.ftl.cancelReasonCode = code;
  load.ftl.replacementLoadId = replacement?.loadId ?? null;
  load.ftl.carrierBookingToCancel = load.ftl.bookedAt !== null;
  load.status = "CANCELLED";
  load.cancelledAt = at;
  load.cancelReason = note;
  load.shipmentIds = [];
  load.loaded = new Map();
  load.version += 1;
  if (replacement) state.loads.set(replacement.loadId, replacement);
  return ok({
    cancelled: loadDetailView(state, load),
    replacement: replacement ? loadDetailView(state, replacement) : undefined,
  });
}

/**
 * Bỏ MỘT xe chưa xếp khỏi kế hoạch khi mọi xe còn lại đã rời kho (BE `DispatchService.removeFromPlan`, SCRUM-474 UNLOAD-DROP):
 * chuyến PLANNED → CANCELLED kèm mã lý do + ghi chú (bắt buộc), không kiện nào bị khoá (chưa quét gì). Đã bỏ rồi → trả lại như cũ.
 * Mock không dựng lại luật "xe chung lô với xe đã đi" (`LOAD_PLAN_VEHICLE_SHARES_ORDER`) — chỉ BE từ chối.
 */
export function dropFromPlan(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const code = text(body.reasonCode);
  const note = text(body.note);
  if (!REASON_CODES.includes(code)) return validationFailed("reasonCode", "must be a reason code");
  if (!note) return validationFailed("note", "must not be blank");
  if (load.status === "CANCELLED" && load.ftl.cancelReasonCode) return detail(state, load);
  if (load.status !== "PLANNED") return invalid(load, "be dropped from its plan");
  const others = [...state.loads.values()].filter(
    (other) =>
      other.ftl.loadPlanId === load.ftl.loadPlanId &&
      other.loadId !== load.loadId &&
      other.status !== "CANCELLED",
  );
  if (others.length === 0 || others.some((other) => other.status !== "DISPATCHED"))
    return fail(
      409,
      "LOAD_PLAN_OTHER_VEHICLES_NOT_LEFT",
      `Another vehicle of the plan of load ${load.code} has not left yet`,
    );
  load.status = "CANCELLED";
  load.cancelledAt = stamp();
  load.cancelReason = note;
  load.shipmentIds = [];
  load.ftl.cancelReasonCode = code;
  load.version += 1;
  return detail(state, load);
}

/** Xác nhận dỡ một kiện KHÔNG quét (nhãn hỏng; BE `overrideUnload`): chọn theo `packageId`, ghi chú tuỳ chọn. */
export function overrideUnload(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const packageId = text(body.packageId);
  if (!packageId) return validationFailed("packageId", "must not be null");
  const pending = load.ftl.pendingUnloads.find((u) => u.packageId === packageId);
  if (!pending) {
    return fail(
      409,
      "PACKAGE_NOT_IN_LOAD",
      `Package ${packageId} is not waiting to be unloaded from ${load.code}`,
    );
  }
  load.ftl.pendingUnloads = load.ftl.pendingUnloads.filter((u) => u !== pending);
  load.loaded.delete(packageId);
  load.ftl.placed.delete(packageId);
  callOffIfEmpty(state, load);
  load.version += 1;
  return detail(state, load);
}

/**
 * Lô giao chỉ HANDED_OVER ở xe CUỐI CÙNG chở kiện của nó (LP-3): còn xe khác của kế hoạch chưa đi mang kiện
 * của lô → lô ở lại READY_TO_DISPATCH.
 */
export function isLastVehicleOf(
  state: DispatchState,
  load: MockLoad,
  shipment: MockShipment,
): boolean {
  return ![...state.loads.values()].some(
    (other) =>
      other.loadId !== load.loadId &&
      other.status !== "CANCELLED" &&
      other.status !== "DISPATCHED" &&
      other.shipmentIds.includes(shipment.shipmentId),
  );
}
