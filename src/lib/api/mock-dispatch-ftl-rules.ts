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
