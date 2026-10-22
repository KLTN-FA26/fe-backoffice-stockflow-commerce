/**
 * Thao tác của mock kế hoạch xếp xe theo `LoadPlan` / `LoadPlanService` của BE PR #161: chuyển trạng thái (docs 09 §5),
 * BR-09 (một kiện một kế hoạch sống), BR-13 (xác nhận kiện chưa xếp), BR-14 (đang xếp hàng thì không mở lại / huỷ),
 * LP-4 (đơn không cho giao một phần). Mỗi hàm sửa `plan` tại chỗ và trả lỗi BE (hoặc `null` khi xong); `version`
 * tăng 1 mỗi lần ghi như BE.
 */

import { LOAD_PLAN_STATUS } from "@/constants";

import { solveMock } from "./mock-load-plan-solver";
import { getMockShipments, heldPackageIds } from "./mock-load-plan-store";
import { heldParcels, parcelIndex, shipmentsOf } from "./mock-load-plan-view";
import { fail } from "./mock-route-utils";
import { getVehicleTypeStore } from "./mock-vehicle-type-store";

import type { MockResponseShape } from "./mock-route-utils";
import type { MockPlan, MockPlanVehicle } from "./mock-load-plan-store";
import type { SolvedVehicle } from "./mock-load-plan-solver";

type Err = MockResponseShape | null;

const transition = () =>
  fail(409, "INVALID_LOAD_PLAN_TRANSITION", "The load plan cannot do that in its current status");
const stamp = (plan: MockPlan) => {
  plan.version += 1;
};

function requireStatus(plan: MockPlan, ...allowed: MockPlan["status"][]): Err {
  return allowed.includes(plan.status) ? null : transition();
}

/** Lô, loại xe của kế hoạch phải hợp lệ: BR-09, `VEHICLE_TYPE_INACTIVE`, lô cùng kho. */
export function checkInputs(
  warehouseId: string,
  shipmentIds: readonly string[],
  vehicleTypeIds: readonly string[],
  exceptPlanId?: string,
): Err {
  const held = heldPackageIds(exceptPlanId);
  for (const id of shipmentIds) {
    const shipment = getMockShipments().find((s) => s.shipmentId === id);
    if (!shipment || shipment.warehouseId !== warehouseId)
      return fail(409, "SHIPMENT_NOT_FOR_LOAD", "This shipment does not leave on this load");
    if (shipment.packages.some((p) => held.has(p.packageId)))
      return fail(
        409,
        "LOAD_PLAN_PACKAGE_TAKEN",
        `A package of shipment ${shipment.code} is already in another load plan`,
      );
  }
  const types = getVehicleTypeStore();
  if (vehicleTypeIds.some((id) => types.get(id)?.status !== "ACTIVE"))
    return fail(409, "VEHICLE_TYPE_INACTIVE", "This vehicle type is no longer in use");
  return null;
}

function placeInto(plan: MockPlan, solved: SolvedVehicle[]): MockPlanVehicle[] {
  return solved.map((vehicle, index) => ({
    seq: index + 1,
    loadPlanVehicleId: `${plan.loadPlanId}-v${index + 1}-${plan.version}`,
    vehicleTypeId: vehicle.type.vehicleTypeId,
    code: vehicle.type.code,
    innerMm: {
      l: vehicle.type.innerLengthMm,
      w: vehicle.type.innerWidthMm,
      h: vehicle.type.innerHeightMm,
    },
    maxPayloadKg: vehicle.type.maxPayloadKg,
    boxes: vehicle.boxes.map((box) => ({
      packageId: box.parcel.packageId,
      xMm: box.xMm,
      yMm: box.yMm,
      zMm: box.zMm,
      wMm: box.extent.wMm,
      hMm: box.extent.hMm,
      dMm: box.extent.dMm,
      orientation: box.orientation,
    })),
    needsRecalculation: false,
    load: null,
  }));
}

export function setInputs(
  plan: MockPlan,
  input: {
    shipmentIds: string[];
    vehicleTypeIds: string[];
    selectionMode: MockPlan["selectionMode"];
  },
): Err {
  const wrongStatus = requireStatus(plan, "DRAFT", "PLANNED");
  if (wrongStatus) return wrongStatus;
  const invalid = checkInputs(
    plan.warehouseId,
    input.shipmentIds,
    input.vehicleTypeIds,
    plan.loadPlanId,
  );
  if (invalid) return invalid;
  plan.shipmentIds = input.shipmentIds;
  plan.vehicleTypeIds = input.vehicleTypeIds;
  plan.selectionMode = input.selectionMode;
  // Đổi đầu vào của kế hoạch đã tính: về DRAFT và bỏ các xe (docs 09 §5)
  plan.status = LOAD_PLAN_STATUS.DRAFT;
  plan.vehicles = [];
  plan.unplaced.clear();
  plan.leftBehind = [];
  plan.acknowledgement = null;
  plan.calculatedAt = null;
  stamp(plan);
  return null;
}

export function calculate(plan: MockPlan): Err {
  const wrongStatus = requireStatus(plan, "DRAFT", "PLANNED");
  if (wrongStatus) return wrongStatus;
  const types = plan.vehicleTypeIds.flatMap((id) => getVehicleTypeStore().get(id) ?? []);
  if (types.some((type) => type.status !== "ACTIVE"))
    return fail(409, "VEHICLE_TYPE_INACTIVE", "This vehicle type is no longer in use");
  const result = solveMock(heldParcels(plan), types, plan.selectionMode);
  if (result.vehicles.length === 0)
    return fail(409, "LOAD_PLAN_EMPTY", "The load plan has nothing to plan or confirm");
  plan.vehicles = placeInto(plan, result.vehicles);
  plan.unplaced = new Map(result.unplaced.map((u) => [u.parcel.packageId, u.reason]));
  plan.acknowledgement = null;
  plan.status = LOAD_PLAN_STATUS.PLANNED;
  plan.calculatedAt = new Date().toISOString();
  stamp(plan);
  return null;
}

export function recalculateVehicle(
  plan: MockPlan,
  seq: number,
  addPackageIds: readonly string[],
): Err {
  const wrongStatus = requireStatus(plan, "PLANNED");
  if (wrongStatus) return wrongStatus;
  const vehicle = plan.vehicles.find((v) => v.seq === seq);
  if (!vehicle)
    return fail(404, "LOAD_PLAN_VEHICLE_NOT_FOUND", "This vehicle is not in the load plan");
  const parcels = parcelIndex();
  const type = getVehicleTypeStore().get(vehicle.vehicleTypeId);
  if (!type) return fail(409, "VEHICLE_TYPE_INACTIVE", "This vehicle type is no longer in use");
  const own = vehicle.boxes.flatMap((b) => parcels.get(b.packageId) ?? []);
  const added = addPackageIds
    .filter((id) => plan.unplaced.has(id))
    .flatMap((id) => parcels.get(id) ?? []);
  // Một xe thôi (loại của chính xe này, một chiếc): phần không vừa quay về khay
  const result = solveMock([...own, ...added], [{ ...type, availableCount: 1 }], "SINGLE_TYPE");
  const [solved] = placeInto(plan, result.vehicles.slice(0, 1));
  for (const id of added.map((p) => p.packageId)) plan.unplaced.delete(id);
  for (const item of result.unplaced) plan.unplaced.set(item.parcel.packageId, item.reason);
  plan.vehicles = plan.vehicles.map((v) =>
    v.seq === seq ? { ...v, boxes: solved?.boxes ?? [], needsRecalculation: false } : v,
  );
  plan.acknowledgement = null;
  stamp(plan);
  return null;
}

/** LP-4: đơn không cho giao một phần mà kế hoạch để lại một phần kiện của đơn. */
function partialShipmentError(plan: MockPlan): Err {
  const blocked = shipmentsOf(plan)
    .filter(
      (s) => !s.allowPartialShipment && s.packages.some((p) => plan.unplaced.has(p.packageId)),
    )
    .map((s) => s.orderNumber);
  return blocked.length === 0
    ? null
    : fail(
        409,
        "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED",
        "This order does not allow partial shipments",
        [{ field: "orderNumber", message: [...new Set(blocked)].join(", ") }],
      );
}

export function acknowledgeUnplaced(plan: MockPlan, note: string | null): Err {
  const wrongStatus = requireStatus(plan, "PLANNED");
  if (wrongStatus) return wrongStatus;
  const blocked = partialShipmentError(plan);
  if (blocked) return blocked;
  plan.acknowledgement = { at: new Date().toISOString(), note };
  stamp(plan);
  return null;
}

export function confirm(plan: MockPlan): Err {
  const wrongStatus = requireStatus(plan, "PLANNED");
  if (wrongStatus) return wrongStatus;
  if (plan.vehicles.length === 0)
    return fail(409, "LOAD_PLAN_EMPTY", "The load plan has nothing to plan or confirm");
  if (plan.vehicles.some((v) => v.needsRecalculation))
    return fail(
      409,
      "LOAD_PLAN_NEEDS_RECALCULATION",
      "A vehicle of this load plan lost parcels and must be recalculated first",
    );
  if (plan.unplaced.size > 0 && !plan.acknowledgement)
    return fail(
      409,
      "LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED",
      "Acknowledge the packages left unplaced before confirming",
    );
  const blocked = partialShipmentError(plan);
  if (blocked) return blocked;
  plan.leftBehind = [...plan.unplaced.keys()];
  plan.unplaced.clear();
  plan.vehicles = plan.vehicles.map((v) => ({
    ...v,
    load: {
      loadId: `${v.loadPlanVehicleId}-load`,
      code: `LD-${plan.code.slice(3)}-${v.seq}`,
      status: "PLANNED",
    },
  }));
  plan.status = LOAD_PLAN_STATUS.CONFIRMED;
  plan.confirmedAt = new Date().toISOString();
  stamp(plan);
  return null;
}

const loadingStarted = (plan: MockPlan) =>
  plan.vehicles.some((v) => v.load?.status === "LOADING" || v.load?.status === "DISPATCHED");

const reasonError = (reason: string): Err =>
  reason.trim() === ""
    ? fail(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "reason", message: "must not be blank" },
      ])
    : null;

export function reopen(plan: MockPlan, reason: string): Err {
  const wrongStatus = requireStatus(plan, "CONFIRMED");
  if (wrongStatus) return wrongStatus;
  const invalid = reasonError(reason);
  if (invalid) return invalid;
  if (loadingStarted(plan))
    return fail(
      409,
      "LOAD_PLAN_LOADING_STARTED",
      "A vehicle of this load plan is already being loaded",
    );
  // LP-11: các chuyến của kế hoạch (kể cả đã đặt xe) bị huỷ cùng lý do
  plan.vehicles = plan.vehicles.map((v) => ({ ...v, load: null }));
  plan.status = LOAD_PLAN_STATUS.PLANNED;
  plan.reopenedAt = new Date().toISOString();
  plan.reopenReason = reason.trim();
  plan.confirmedAt = null;
  stamp(plan);
  return null;
}

export function cancel(plan: MockPlan, reason: string): Err {
  const wrongStatus = requireStatus(plan, "DRAFT", "PLANNED", "CONFIRMED");
  if (wrongStatus) return wrongStatus;
  const invalid = reasonError(reason);
  if (invalid) return invalid;
  if (loadingStarted(plan))
    return fail(
      409,
      "LOAD_PLAN_LOADING_STARTED",
      "A vehicle of this load plan is already being loaded",
    );
  plan.vehicles = plan.vehicles.map((v) => ({ ...v, load: null }));
  plan.status = LOAD_PLAN_STATUS.CANCELLED;
  plan.cancelledAt = new Date().toISOString();
  plan.cancelReason = reason.trim();
  stamp(plan);
  return null;
}
