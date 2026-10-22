/**
 * Fixture kế hoạch xếp xe (BE PR #161) cho test: dựng từ bố cục F1 (`LAYOUT_PICKUP_KIT` — xe bán tải 4 bộ bàn A+B + 3 ghế
 * bar) nên bảng kiện, bản đồ màu và hộp 3D khớp nhau. Dạng trả về là kiểu đã parse; schema parse lại được nguyên văn.
 */

import { LAYOUT_PICKUP_KIT } from "./layouts";

import type { CandidateShipment, PlanDetail, PlanParcel, PlanVehicle } from "../plan-types";
import type { Layout } from "../types";

export const PLAN_ID = "11111111-0000-4000-8000-000000000001";
export const WAREHOUSE_ID = "WH-HN-01";
export const SHIPMENT_ID = "22222222-0000-4000-8000-000000000001";
export const VEHICLE_TYPE_ID = "33333333-0000-4000-8000-000000000001";

const BASE_PARCEL = {
  shipmentId: SHIPMENT_ID,
  shipmentCode: "SO-20261004-000001-S1",
  kitPartNo: null,
  kitPartCount: null,
  vehicleSeq: null,
  unplacedReason: null,
} as const;

/** Mỗi hộp của bố cục là một kiện của lô; `ref` của hộp = id kiện (hợp đồng BE). */
export function parcelsOfLayout(layout: Layout): PlanParcel[] {
  return layout.boxes.map((box, index) => ({
    ...BASE_PARCEL,
    packageId: box.ref,
    labelCode: `PKG-${index + 1}`,
    partName: box.partName,
    lengthMm: box.origMm.l,
    widthMm: box.origMm.w,
    heightMm: box.origMm.h,
    weightKg: box.weightKg,
    rotatable: box.rotatable,
    kitGroupId: box.kitGroup,
    vehicleSeq: layout.seq,
  }));
}

export function vehicleOfLayout(layout: Layout, overrides: Partial<PlanVehicle> = {}): PlanVehicle {
  const capacity = layout.innerMm.l * layout.innerMm.w * layout.innerMm.h;
  return {
    seq: layout.seq,
    loadPlanVehicleId: `veh-${layout.seq}`,
    vehicleTypeId: VEHICLE_TYPE_ID,
    code: layout.code,
    packageCount: layout.boxes.length,
    usedVolumeMm3: layout.usedVolumeMm3,
    usedWeightKg: layout.usedWeightKg,
    volumeFillPct: Math.round((layout.usedVolumeMm3 / capacity) * 10000) / 100,
    weightFillPct: Math.round((layout.usedWeightKg / layout.maxPayloadKg) * 10000) / 100,
    load: null,
    needsRecalculation: false,
    ...overrides,
  };
}

/** Kiện chưa xếp được (khay) — kích thước vượt xe bán tải. */
export function unplacedParcel(
  reason: NonNullable<PlanParcel["unplacedReason"]>,
  n = 1,
): PlanParcel {
  return {
    ...BASE_PARCEL,
    packageId: `unplaced-${reason}-${n}`,
    labelCode: `PKG-U${n}`,
    partName: "Tủ vải",
    lengthMm: 2600,
    widthMm: 500,
    heightMm: 500,
    weightKg: 30,
    rotatable: true,
    kitGroupId: null,
    unplacedReason: reason,
  };
}

/** Kế hoạch PLANNED, một xe, mọi kiện đã xếp; ghi đè từng trường theo ca test. */
export function planFixture(overrides: Partial<PlanDetail> = {}): PlanDetail {
  const packages = parcelsOfLayout(LAYOUT_PICKUP_KIT);
  return {
    loadPlanId: PLAN_ID,
    code: "LP-20261022-0001",
    warehouseId: WAREHOUSE_ID,
    sourceType: "SHIPMENT",
    selectionMode: "SINGLE_TYPE",
    status: "PLANNED",
    note: null,
    vehicleTypes: [
      {
        vehicleTypeId: VEHICLE_TYPE_ID,
        code: "PICKUP",
        name: "Pickup truck",
        kind: "PICKUP",
        availableCount: 10,
        status: "ACTIVE",
      },
    ],
    shipments: [
      {
        shipmentId: SHIPMENT_ID,
        code: "SO-20261004-000001-S1",
        orderId: "order-1",
        orderNumber: "SO-20261004-000001",
        allowPartialShipment: false,
        packageCount: packages.length,
      },
    ],
    vehicles: [vehicleOfLayout(LAYOUT_PICKUP_KIT)],
    packages,
    packageCount: packages.length,
    placedCount: packages.length,
    unplacedCount: 0,
    unplacedAcknowledgement: null,
    calculatedAt: "2026-10-22T02:05:00Z",
    solverMeta: { algorithm: "GRASP_KIT", budgetExhausted: false },
    confirmedAt: null,
    reopenedAt: null,
    reopenReason: null,
    dispatchedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: "2026-10-22T02:00:00Z",
    version: 4,
    ...overrides,
  };
}

/** Kế hoạch PLANNED còn một kiện ở khay (chưa xác nhận để lại). */
export function planWithUnplaced(reason: NonNullable<PlanParcel["unplacedReason"]> = "TOO_LARGE") {
  const base = planFixture();
  const parcel = unplacedParcel(reason);
  return planFixture({
    packages: [...base.packages, parcel],
    packageCount: base.packageCount + 1,
    unplacedCount: 1,
  });
}

export function candidateFixture(overrides: Partial<CandidateShipment> = {}): CandidateShipment {
  const packages = parcelsOfLayout(LAYOUT_PICKUP_KIT).map((p) => ({ ...p, vehicleSeq: null }));
  return {
    shipmentId: SHIPMENT_ID,
    code: "SO-20261004-000001-S1",
    orderId: "order-1",
    orderNumber: "SO-20261004-000001",
    allowPartialShipment: false,
    readyAt: "2026-10-22T01:30:00Z",
    packageCount: packages.length,
    packagesInOtherPlans: 0,
    weightKg: 201,
    volumeMm3: 8_023_920_000,
    packages,
    ...overrides,
  };
}
