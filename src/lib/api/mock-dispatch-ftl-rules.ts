/**
 * Mock chuyến nguyên xe — luật nghiệp vụ và mã lỗi đúng BE `DispatchService` / `DispatchLoad` (PR #162,
 * SCRUM-392): đặt xe, huỷ đặt xe, bắt đầu xếp hàng, dỡ kiện của đơn đã huỷ, bàn giao theo xe (lô chỉ
 * HANDED_OVER ở xe cuối cùng). Kiểm tra quét đúng xe: `mock-dispatch-ftl-scan.ts`.
 */

import {
  MOCK_DISPATCHER,
  type DispatchState,
  type MockLoad,
  type MockShipment,
} from "./mock-dispatch-store";
import { loadDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { MockResponseShape } from "./mock-route-utils";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const stamp = () => new Date().toISOString();
const detail = (state: DispatchState, load: MockLoad) => ok(loadDetailView(state, load));
const invalid = (load: MockLoad, action: string) =>
  fail(409, "INVALID_LOAD_TRANSITION", `Load ${load.code} is ${load.status}; it cannot ${action}`);

/** Mọi route của chuyến nguyên xe áp cho xe của kế hoạch (BE: chuyến gửi kiện → 409 INVALID_LOAD_TRANSITION). */
const notFtl = (load: MockLoad) => invalid(load, "be booked: it is a parcel load");

/** 409 LOAD_MANAGED_BY_PLAN — thêm / bỏ lô, huỷ chuyến của kế hoạch phải đi qua kế hoạch. */
export const managedByPlan = () =>
  fail(409, "LOAD_MANAGED_BY_PLAN", "This load belongs to a load plan; change it through the plan");

export function book(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  if (!load.ftl) return notFtl(load);
  const carrierId = text(body.carrierId);
  if (!carrierId) return validationFailed("carrierId", "must not be null");
  if (load.status !== "PLANNED" && load.status !== "VEHICLE_BOOKED")
    return invalid(load, "be booked");
  const carrier = state.carriers.find((c) => c.carrierId === carrierId);
  if (!carrier) return fail(404, "CARRIER_NOT_FOUND", "Carrier not found");
  if (carrier.status !== "ACTIVE")
    return fail(409, "CARRIER_INACTIVE", `Carrier ${carrier.code} is not in use`);
  // Hãng khác hãng đã gán trước cho lô trên xe
  const assigned = load.shipmentIds
    .map((id) => state.shipments.get(id))
    .find((s): s is MockShipment => !!s?.carrierId && s.carrierId !== carrierId);
  if (assigned) {
    return fail(
      409,
      "SHIPMENT_OTHER_CARRIER",
      `Shipment ${assigned.code} goes with another carrier`,
    );
  }
  load.carrierId = carrierId;
  load.vehiclePlate = text(body.vehiclePlate) || null;
  load.driverName = text(body.driverName) || null;
  load.driverPhone = text(body.driverPhone) || null;
  load.status = "VEHICLE_BOOKED";
  load.ftl.bookedAt = stamp();
  load.ftl.bookedBy = MOCK_DISPATCHER;
  load.version += 1;
  return detail(state, load);
}

export function cancelBooking(
  state: DispatchState,
  load: MockLoad,
  reason: string,
): MockResponseShape {
  if (!load.ftl) return notFtl(load);
  if (load.status !== "VEHICLE_BOOKED") return invalid(load, "cancel its booking");
  if (!reason) return validationFailed("reason", "must not be blank");
  load.carrierId = null;
  load.vehiclePlate = null;
  load.driverName = null;
  load.driverPhone = null;
  load.status = "PLANNED";
  load.ftl.bookedAt = null;
  load.ftl.bookedBy = null;
  load.ftl.bookingCancelledAt = stamp();
  load.ftl.bookingCancelReason = reason;
  load.version += 1;
  return detail(state, load);
}

export function startLoading(state: DispatchState, load: MockLoad): MockResponseShape {
  if (!load.ftl) return notFtl(load);
  if (load.status !== "VEHICLE_BOOKED") {
    return fail(
      409,
      "INVALID_LOAD_TRANSITION",
      `Load ${load.code} has no vehicle booked yet: book it first`,
    );
  }
  load.status = "LOADING";
  load.loadingStartedAt = stamp();
  load.version += 1;
  return detail(state, load);
}

/** Xe không còn gì để chở (mọi lô bị huỷ) → hệ thống tự huỷ; đã đặt xe thì nhắc huỷ xe ngoài hệ thống. */
function callOffIfEmpty(state: DispatchState, load: MockLoad): void {
  if (load.status === "CANCELLED") return;
  const carrying = load.shipmentIds.some((id) => state.shipments.get(id)?.status !== "CANCELLED");
  if (carrying || !load.ftl || load.ftl.pendingUnloads.length > 0) return;
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
  const pending = load.ftl?.pendingUnloads.find((u) => u.packageId === known.packageId);
  if (!load.ftl || !pending) {
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

const REASON_CODES: readonly string[] = ["XE_HONG", "SAI_XE", "KIEN_KHONG_VUA", "KHAC"];

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
  if (!load.ftl) return invalid(load, "be cancelled under control: it is a parcel load");
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

/** Xác nhận dỡ một kiện KHÔNG quét (nhãn hỏng; BE `overrideUnload`): chọn theo `packageId`, ghi chú tuỳ chọn. */
export function overrideUnload(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const packageId = text(body.packageId);
  if (!packageId) return validationFailed("packageId", "must not be null");
  const pending = load.ftl?.pendingUnloads.find((u) => u.packageId === packageId);
  if (!load.ftl || !pending) {
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
  if (!load.ftl) return true;
  return ![...state.loads.values()].some(
    (other) =>
      other.ftl &&
      other.loadId !== load.loadId &&
      other.status !== "CANCELLED" &&
      other.status !== "DISPATCHED" &&
      other.shipmentIds.includes(shipment.shipmentId),
  );
}
