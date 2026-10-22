/**
 * Mock giao hàng cho hãng — luật nghiệp vụ của chuyến xe, mã lỗi đúng BE `DispatchService` /
 * `DispatchLoad` (PR #137): mở chuyến idempotent theo `requestId`, quét theo biên bản (mỗi mã lỗi một
 * ngữ cảnh), `scanId` replay, bàn giao khoá `version`, từ chối theo lô nêu tên lô, huỷ chuyến.
 */

import {
  MOCK_DISPATCHER,
  isMockLoadOpen,
  type DispatchState,
  type MockLoad,
  type MockShipment,
} from "./mock-dispatch-store";
import { managedByPlan } from "./mock-dispatch-ftl-rules";
import { ftlScanCheck } from "./mock-dispatch-ftl-scan";
import { loadDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { MockResponseShape } from "./mock-route-utils";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
const stamp = () => new Date().toISOString();

const detail = (state: DispatchState, load: MockLoad, status = 200) =>
  ok(loadDetailView(state, load), status);
const invalidTransition = (load: MockLoad, action: string) =>
  fail(409, "INVALID_LOAD_TRANSITION", `Load ${load.code} is ${load.status}; it cannot ${action}`);

/** Lô được đưa lên biên bản? Trả lỗi BE tương ứng khi không. */
function addCheck(
  state: DispatchState,
  load: MockLoad,
  shipment: MockShipment,
): MockResponseShape | null {
  if (shipment.status !== "READY_TO_DISPATCH") {
    return fail(409, "SHIPMENT_STATE_CONFLICT", `Shipment ${shipment.code} is ${shipment.status}`);
  }
  if (shipment.warehouseId !== load.warehouseId) {
    return fail(
      409,
      "SHIPMENT_NOT_FOR_LOAD",
      `Shipment ${shipment.code} leaves from another warehouse`,
    );
  }
  if (shipment.carrierId && shipment.carrierId !== load.carrierId) {
    return fail(
      409,
      "SHIPMENT_OTHER_CARRIER",
      `Shipment ${shipment.code} goes with another carrier`,
    );
  }
  const other = shipment.loadId ? state.loads.get(shipment.loadId) : undefined;
  if (other && other.loadId !== load.loadId) {
    return fail(
      409,
      "SHIPMENT_ON_ANOTHER_LOAD",
      `Shipment ${shipment.code} is on load ${other.code}`,
    );
  }
  return null;
}

function attach(load: MockLoad, shipment: MockShipment): void {
  if (!load.shipmentIds.includes(shipment.shipmentId)) load.shipmentIds.push(shipment.shipmentId);
  shipment.loadId = load.loadId;
  shipment.carrierId = load.carrierId;
}

export function openLoad(state: DispatchState, body: Record<string, unknown>): MockResponseShape {
  const requestId = text(body.requestId);
  const warehouseId = text(body.warehouseId);
  const carrierId = text(body.carrierId);
  if (!requestId) return validationFailed("requestId", "must not be null");
  if (!warehouseId) return validationFailed("warehouseId", "must not be null");
  if (!carrierId) return validationFailed("carrierId", "must not be null");
  const previous = state.openRequests.get(requestId);
  const existing = previous ? state.loads.get(previous) : undefined;
  if (existing) return detail(state, existing, 201);
  const carrier = state.carriers.find((c) => c.carrierId === carrierId);
  if (!carrier) return fail(404, "CARRIER_NOT_FOUND", "Carrier not found");
  if (carrier.status !== "ACTIVE")
    return fail(409, "CARRIER_INACTIVE", `Carrier ${carrier.code} is not in use`);
  const load: MockLoad = {
    loadId: `LOAD-2026-${String(state.loads.size + 1).padStart(4, "0")}`,
    code: "",
    warehouseId,
    status: "LOADING",
    carrierId,
    vehiclePlate: text(body.vehiclePlate) || null,
    driverName: text(body.driverName) || null,
    driverPhone: text(body.driverPhone) || null,
    shipmentIds: [],
    loaded: new Map(),
    loadingStartedAt: stamp(),
    dispatchedAt: null,
    carrierRepresentative: null,
    signatureRef: null,
    handoverNote: null,
    cancelledAt: null,
    cancelReason: null,
    fixedCodTotal: null,
    version: 0,
  };
  load.code = load.loadId;
  const given = list(body.shipmentIds);
  const members = given.length
    ? given.map((id) => state.shipments.get(id))
    : [...state.shipments.values()].filter(
        (s) =>
          s.status === "READY_TO_DISPATCH" &&
          s.warehouseId === warehouseId &&
          s.carrierId === carrierId &&
          !s.loadId,
      );
  for (const member of members) {
    if (!member) return fail(404, "SHIPMENT_NOT_FOUND", "Shipment not found");
    const refused = addCheck(state, load, member);
    if (refused) return refused;
  }
  for (const member of members) if (member) attach(load, member);
  state.loads.set(load.loadId, load);
  state.openRequests.set(requestId, load.loadId);
  return detail(state, load, 201);
}

export function addShipments(
  state: DispatchState,
  load: MockLoad,
  ids: string[],
): MockResponseShape {
  if (load.ftl) return managedByPlan();
  if (!isMockLoadOpen(load.status)) return invalidTransition(load, "take shipments");
  if (ids.length === 0) return validationFailed("shipmentIds", "must not be empty");
  const members = ids.map((id) => state.shipments.get(id));
  for (const member of members) {
    if (!member) return fail(404, "SHIPMENT_NOT_FOUND", "Shipment not found");
    const refused = addCheck(state, load, member);
    if (refused) return refused;
  }
  for (const member of members) if (member) attach(load, member);
  load.version += 1;
  return detail(state, load);
}

export function removeShipment(
  state: DispatchState,
  load: MockLoad,
  shipmentId: string,
): MockResponseShape {
  if (load.ftl) return managedByPlan();
  if (!isMockLoadOpen(load.status)) return invalidTransition(load, "release shipments");
  const shipment = state.shipments.get(shipmentId);
  if (!shipment || !load.shipmentIds.includes(shipmentId)) {
    return fail(409, "SHIPMENT_NOT_FOR_LOAD", "That shipment is not on this load");
  }
  load.shipmentIds = load.shipmentIds.filter((id) => id !== shipmentId);
  for (const parcel of shipment.parcels) load.loaded.delete(parcel.packageId);
  shipment.loadId = null;
  load.version += 1;
  return detail(state, load);
}

export function scan(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const scanId = text(body.scanId) || crypto.randomUUID();
  const code = text(body.packageCode);
  if (!code) return validationFailed("packageCode", "must not be blank");
  const all = [...state.shipments.values()];
  const owner = all.find((s) =>
    s.parcels.some((p) => p.labelCode.toUpperCase() === code.toUpperCase()),
  );
  const parcel = owner?.parcels.find((p) => p.labelCode.toUpperCase() === code.toUpperCase());
  // Một scanId đã ghi được trả lời trước, bất kể chuyện gì xảy ra sau
  for (const candidate of state.loads.values()) {
    for (const loaded of candidate.loaded.values()) {
      if (loaded.scanId !== scanId) continue;
      const same = candidate.loadId === load.loadId && loaded.packageId === parcel?.packageId;
      return same
        ? detail(state, load)
        : fail(
            409,
            "LOAD_SCAN_ID_CONFLICT",
            `Scan ${scanId} was recorded for another package or load`,
          );
    }
  }
  if (!owner || !parcel) return fail(404, "PACKAGE_NOT_FOUND", `No package labelled ${code}`);
  // Chuyến nguyên xe: nhãn cũ, kiện thuộc xe khác của kế hoạch (BE PR #162)
  const ftlRefused = ftlScanCheck(state, load, parcel);
  if (ftlRefused) return ftlRefused;
  if (load.status !== "LOADING") return invalidTransition(load, "scan packages");
  if (owner.status !== "READY_TO_DISPATCH") {
    return fail(
      409,
      "PACKAGE_NOT_READY",
      `Package ${code} belongs to shipment ${owner.code}, which is ${owner.status}`,
    );
  }
  const elsewhere = [...state.loads.values()].find(
    (l) => l.loadId !== load.loadId && l.status !== "CANCELLED" && l.loaded.has(parcel.packageId),
  );
  if (elsewhere)
    return fail(
      409,
      "PACKAGE_ALREADY_LOADED",
      `Package ${code} is already on load ${elsewhere.code}`,
    );
  if (owner.warehouseId !== load.warehouseId || !load.shipmentIds.includes(owner.shipmentId)) {
    return fail(
      409,
      "PACKAGE_NOT_IN_LOAD",
      `Package ${code} is not on the manifest of ${load.code}`,
    );
  }
  if (load.loaded.has(parcel.packageId)) return detail(state, load);
  load.loaded.set(parcel.packageId, {
    packageId: parcel.packageId,
    scanId,
    loadedAt: stamp(),
    loadedBy: MOCK_DISPATCHER,
  });
  load.version += 1;
  return detail(state, load);
}

export function unscan(state: DispatchState, load: MockLoad, packageId: string): MockResponseShape {
  if (load.status !== "LOADING") return invalidTransition(load, "unload packages");
  if (load.loaded.delete(packageId)) load.version += 1;
  return detail(state, load);
}

export function cancelLoad(
  state: DispatchState,
  load: MockLoad,
  reason: string,
): MockResponseShape {
  if (load.ftl) return managedByPlan();
  if (load.status === "CANCELLED") return detail(state, load);
  if (!isMockLoadOpen(load.status)) return invalidTransition(load, "be cancelled");
  if (!reason) return validationFailed("reason", "must not be blank");
  for (const id of load.shipmentIds) {
    const shipment = state.shipments.get(id);
    if (shipment) shipment.loadId = null;
  }
  load.loaded.clear();
  load.status = "CANCELLED";
  load.cancelledAt = stamp();
  load.cancelReason = reason;
  load.version += 1;
  return detail(state, load);
}
