/**
 * Đối chiếu của mock (BE `LoadPlans.Reconciliation`): sổ kép số kiện của kế hoạch / lô / đơn, và `vsEstimate` so với
 * ước lượng hiện hành. Mock chỉ coi đơn của lô ĐẦU TIÊN trong kế hoạch là có ước lượng (nhỏ hơn thực tế 15%) để thử
 * cả hai nhánh: có cờ chênh lệch và `NO_ESTIMATE`.
 */

import { LOAD_PLAN_LIMITS } from "@/constants";

import { heldParcels, parcelIndex, shipmentsOf } from "./mock-load-plan-view";

import type { MockPlan } from "./mock-load-plan-store";

/** Ước lượng của mock bằng 85% thực tế. */
const ESTIMATE_RATIO = 0.85;

const pct = (estimated: number, actual: number) =>
  estimated === 0 ? null : Math.round(((actual - estimated) / estimated) * 10000) / 100;

function pieceCount(plan: MockPlan, key: string, code: string, ids: ReadonlySet<string>) {
  const held = heldParcels(plan).filter((p) => ids.has(p.packageId));
  const left = plan.leftBehind.filter((id) => ids.has(id)).length;
  const placed = plan.vehicles.reduce(
    (sum, v) => sum + v.boxes.filter((b) => ids.has(b.packageId)).length,
    0,
  );
  const unplaced = [...plan.unplaced.keys()].filter((id) => ids.has(id)).length + left;
  const packagesIn = held.length + left;
  return {
    key,
    code,
    packagesIn,
    placed,
    unplaced,
    leftBehind: left,
    notInPlan: 0,
    balanced: packagesIn === placed + unplaced,
  };
}

function vsEstimate(plan: MockPlan) {
  const shipments = shipmentsOf(plan);
  const first = shipments[0];
  if (!first || plan.vehicles.length === 0) return null;
  const estimatedIds = new Set(
    shipments
      .filter((s) => s.orderId === first.orderId)
      .flatMap((s) => s.packages.map((p) => p.packageId)),
  );
  const parcels = parcelIndex();
  const actualParcels = [...estimatedIds].filter((id) =>
    plan.vehicles.some((v) => v.boxes.some((b) => b.packageId === id)),
  );
  const volume = actualParcels.reduce((sum, id) => {
    const p = parcels.get(id);
    return sum + (p ? p.lengthMm * p.widthMm * p.heightMm : 0);
  }, 0);
  const weight = actualParcels.reduce((sum, id) => sum + (parcels.get(id)?.weightKg ?? 0), 0);
  const notEstimated = [...new Set(shipments.map((s) => s.orderId))].filter(
    (id) => id !== first.orderId,
  );
  const singleOrder = notEstimated.length === 0;
  const estVolume = Math.round(volume * ESTIMATE_RATIO);
  const estWeight = Math.round(weight * ESTIMATE_RATIO * 1000) / 1000;
  const flags: string[] = [];
  if (notEstimated.length > 0) flags.push("NO_ESTIMATE");
  // BE: cờ khi thực tế vượt ước lượng quá 10% (LOAD_PLAN_LIMITS.estimateTolerancePct)
  if ((pct(estVolume, volume) ?? 0) > LOAD_PLAN_LIMITS.estimateTolerancePct)
    flags.push("VOLUME_ABOVE");
  if ((pct(estWeight, weight) ?? 0) > LOAD_PLAN_LIMITS.estimateTolerancePct)
    flags.push("WEIGHT_ABOVE");
  const byType = [...new Set(plan.vehicles.map((v) => v.code))].map((code) => ({
    code,
    estimated: plan.vehicles.filter((v) => v.code === code).length,
    actual: plan.vehicles.filter((v) => v.code === code).length,
  }));
  return {
    estimateIds: [`${first.orderId}-estimate`],
    notEstimated,
    vehiclesCompared: singleOrder,
    vehiclesByType: singleOrder ? byType : [],
    orders: [
      { orderId: first.orderId, estimateId: `${first.orderId}-estimate`, vehiclesByType: byType },
    ],
    cartonsByLine: [
      {
        orderLineId: `${first.orderId}-line-1`,
        sku: first.packages[0]?.partName ?? "SKU",
        estimated: Math.floor(actualParcels.length * ESTIMATE_RATIO),
        actual: actualParcels.length,
      },
    ],
    volumeMm3: { estimated: estVolume, actual: volume, deltaPct: pct(estVolume, volume) },
    weightKg: {
      estimated: estWeight,
      actual: Math.round(weight * 1000) / 1000,
      deltaPct: pct(estWeight, weight),
    },
    flags,
  };
}

export function reconciliationView(plan: MockPlan) {
  const shipments = shipmentsOf(plan);
  const all = new Set(shipments.flatMap((s) => s.packages.map((p) => p.packageId)));
  const orders = [...new Map(shipments.map((s) => [s.orderId, s.orderNumber])).entries()];
  return {
    pieceCheck: pieceCount(plan, plan.loadPlanId, plan.code, all),
    shipments: shipments.map((s) =>
      pieceCount(plan, s.shipmentId, s.code, new Set(s.packages.map((p) => p.packageId))),
    ),
    orders: orders.map(([orderId, orderNumber]) =>
      pieceCount(
        plan,
        orderId,
        orderNumber,
        new Set(
          shipments
            .filter((s) => s.orderId === orderId)
            .flatMap((s) => s.packages.map((p) => p.packageId)),
        ),
      ),
    ),
    vsEstimate: vsEstimate(plan),
  };
}
