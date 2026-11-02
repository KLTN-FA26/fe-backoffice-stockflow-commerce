/**
 * Dựng phản hồi của mock kế hoạch xếp xe từ `MockPlan` — đúng hình `LoadPlans.PlanDetail` / `PlanRow` / `Layout` /
 * `Reconciliation` của BE PR #161 (số tiền, kích thước, tỉ lệ tính từ dữ liệu, không bịa).
 */

import { getMockPlans, getMockShipments } from "./mock-load-plan-store";
import { getVehicleTypeStore } from "./mock-vehicle-type-store";

import type { MockParcel, MockPlan, MockPlanVehicle, MockShipment } from "./mock-load-plan-store";

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;

export function parcelIndex(): Map<string, MockParcel> {
  return new Map(
    getMockShipments().flatMap((s) => s.packages.map((p) => [p.packageId, p] as const)),
  );
}

export const shipmentsOf = (plan: MockPlan): MockShipment[] =>
  getMockShipments().filter((s) => plan.shipmentIds.includes(s.shipmentId));

/** Kiện kế hoạch đang giữ (không tính kiện đã bị thả khi chốt). */
export const heldParcels = (plan: MockPlan): MockParcel[] =>
  shipmentsOf(plan).flatMap((s) =>
    s.packages.filter((p) => !plan.leftBehind.includes(p.packageId)),
  );

const seqOfParcel = (plan: MockPlan, packageId: string): number | undefined =>
  plan.vehicles.find((v) => v.boxes.some((b) => b.packageId === packageId))?.seq;

const isTransferParcel = (parcel: MockParcel): boolean =>
  getMockShipments().some((s) => s.shipmentId === parcel.shipmentId && !!s.transfer);

/** Kiện ra wire: của lệnh chuyển kho thì không có lô giao, chỉ có `transferOrderId` (BE `LoadPlans.ParcelView`). */
function wireParcel(parcel: MockParcel) {
  return isTransferParcel(parcel)
    ? { ...parcel, shipmentId: null, shipmentCode: null, transferOrderId: parcel.shipmentId }
    : parcel;
}

function parcelView(plan: MockPlan, parcel: MockParcel) {
  return {
    ...wireParcel(parcel),
    vehicleSeq: seqOfParcel(plan, parcel.packageId) ?? null,
    unplacedReason: plan.unplaced.get(parcel.packageId) ?? null,
  };
}

export function candidateView(shipment: MockShipment, held: ReadonlySet<string>) {
  const free = shipment.packages.filter((p) => !held.has(p.packageId));
  const { transfer } = shipment;
  return {
    sourceType: transfer ? "TRANSFER" : "ORDER",
    shipmentId: transfer ? null : shipment.shipmentId,
    code: shipment.code,
    orderId: transfer ? null : shipment.orderId,
    orderNumber: transfer ? null : shipment.orderNumber,
    transferOrderId: transfer?.transferOrderId ?? null,
    toWarehouseId: transfer?.toWarehouseId ?? null,
    allowPartialShipment: shipment.allowPartialShipment,
    readyAt: shipment.readyAt,
    packageCount: shipment.packages.length,
    packagesInOtherPlans: shipment.packages.length - free.length,
    weightKg: round(
      free.reduce((sum, p) => sum + p.weightKg, 0),
      3,
    ),
    volumeMm3: free.reduce((sum, p) => sum + p.lengthMm * p.widthMm * p.heightMm, 0),
    packages: free.map((p) => ({ ...wireParcel(p), vehicleSeq: null, unplacedReason: null })),
  };
}

function usedOf(vehicle: MockPlanVehicle, parcels: Map<string, MockParcel>) {
  let volume = 0;
  let weight = 0;
  for (const box of vehicle.boxes) {
    volume += box.wMm * box.hMm * box.dMm;
    weight += parcels.get(box.packageId)?.weightKg ?? 0;
  }
  const capacity = vehicle.innerMm.l * vehicle.innerMm.w * vehicle.innerMm.h;
  return {
    usedVolumeMm3: volume,
    usedWeightKg: round(weight, 3),
    volumeFillPct: round((volume / capacity) * 100),
    weightFillPct: round((weight / vehicle.maxPayloadKg) * 100),
  };
}

export function layoutView(vehicle: MockPlanVehicle) {
  const parcels = parcelIndex();
  return {
    seq: vehicle.seq,
    code: vehicle.code,
    vehicleTypeId: vehicle.vehicleTypeId,
    innerMm: vehicle.innerMm,
    maxPayloadKg: vehicle.maxPayloadKg,
    gussets: [],
    ...usedOf(vehicle, parcels),
    boxes: vehicle.boxes.map((box, index) => {
      const parcel = parcels.get(box.packageId);
      return {
        ...box,
        ref: box.packageId,
        label: parcel?.labelCode ?? box.packageId,
        partName: parcel?.partName ?? "",
        kitGroup: parcel?.kitGroupId ?? null,
        origMm: { l: parcel?.lengthMm ?? 1, w: parcel?.widthMm ?? 1, h: parcel?.heightMm ?? 1 },
        rotatable: parcel?.rotatable ?? true,
        weightKg: parcel?.weightKg ?? 0,
        loadSequence: index + 1,
      };
    }),
  };
}

export function planRow(plan: MockPlan) {
  const held = heldParcels(plan);
  return {
    loadPlanId: plan.loadPlanId,
    code: plan.code,
    warehouseId: plan.warehouseId,
    status: plan.status,
    sourceType: plan.sourceType,
    selectionMode: plan.selectionMode,
    shipmentCount: plan.shipmentIds.length,
    packageCount: held.length,
    vehicleCount: plan.vehicles.length,
    unplacedCount: plan.unplaced.size,
    createdAt: plan.createdAt,
    calculatedAt: plan.calculatedAt,
    confirmedAt: plan.confirmedAt,
    version: plan.version,
  };
}

function transferInPlan(plan: MockPlan) {
  const shipment = plan.sourceType === "TRANSFER" ? shipmentsOf(plan)[0] : undefined;
  if (!shipment?.transfer) return null;
  return {
    transferOrderId: shipment.transfer.transferOrderId,
    number: shipment.transfer.number,
    fromWarehouseId: shipment.warehouseId,
    toWarehouseId: shipment.transfer.toWarehouseId,
    status: shipment.transfer.status,
    packageCount: shipment.packages.length,
  };
}

export function planDetail(plan: MockPlan) {
  const parcels = parcelIndex();
  const held = heldParcels(plan);
  const types = getVehicleTypeStore();
  return {
    loadPlanId: plan.loadPlanId,
    code: plan.code,
    warehouseId: plan.warehouseId,
    sourceType: plan.sourceType,
    selectionMode: plan.selectionMode,
    status: plan.status,
    note: plan.note,
    vehicleTypes: plan.vehicleTypeIds.flatMap((id) => {
      const t = types.get(id);
      return t
        ? [
            {
              vehicleTypeId: id,
              code: t.code,
              name: t.name,
              kind: t.kind,
              availableCount: t.availableCount,
              status: t.status,
            },
          ]
        : [];
    }),
    // Kế hoạch TRANSFER không có lô giao: lệnh chuyển kho nằm ở `transferOrder`
    shipments:
      plan.sourceType === "TRANSFER"
        ? []
        : shipmentsOf(plan).map((s) => ({
            shipmentId: s.shipmentId,
            code: s.code,
            orderId: s.orderId,
            orderNumber: s.orderNumber,
            allowPartialShipment: s.allowPartialShipment,
            packageCount: s.packages.length,
          })),
    transferOrder: transferInPlan(plan),
    vehicles: plan.vehicles.map((v) => ({
      seq: v.seq,
      loadPlanVehicleId: v.loadPlanVehicleId,
      vehicleTypeId: v.vehicleTypeId,
      code: v.code,
      packageCount: v.boxes.length,
      ...usedOf(v, parcels),
      load: v.load,
      needsRecalculation: v.needsRecalculation,
    })),
    packages: held.map((p) => parcelView(plan, p)),
    packageCount: held.length,
    placedCount: plan.vehicles.reduce((sum, v) => sum + v.boxes.length, 0),
    unplacedCount: plan.unplaced.size,
    unplacedAcknowledgement: plan.acknowledgement
      ? { ...plan.acknowledgement, by: "mock-user" }
      : null,
    calculatedAt: plan.calculatedAt,
    solverMeta: plan.calculatedAt ? { algorithm: "MOCK_SHELF", budgetExhausted: false } : null,
    confirmedAt: plan.confirmedAt,
    reopenedAt: plan.reopenedAt,
    reopenReason: plan.reopenReason,
    cancelledAt: plan.cancelledAt,
    cancelReason: plan.cancelReason,
    createdAt: plan.createdAt,
    version: plan.version,
  };
}

export const planOf = (id: string): MockPlan | undefined => getMockPlans().get(id);
