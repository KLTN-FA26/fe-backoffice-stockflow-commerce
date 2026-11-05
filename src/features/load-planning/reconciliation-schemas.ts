/**
 * Đối chiếu kế hoạch xếp xe (BE PR #161 `GET load-plans/{id}/reconciliation`, `LoadPlans.Reconciliation`):
 * số kiện vào = đã xếp + chưa xếp (sổ kép của `nesting-reconcile`), và `vsEstimate` — so với ước lượng HIỆN HÀNH của
 * từng đơn (PR EST #160). `vsEstimate` chỉ để tham khảo; BE không chặn việc chốt vì nó.
 */

import { z } from "zod";

import { LOAD_PLAN_ESTIMATE_FLAGS } from "@/constants";

import { beDecimal } from "./plan-schemas";

import type { LoadPlanEstimateFlag } from "@/constants";

/** `LoadPlans.PieceCount`: `key` là id, `code` là mã của kế hoạch / lô giao / đơn. */
export const bePieceCountSchema = z.object({
  key: z.string(),
  /** Vắng khi BE không tra được đơn (`order == null ? null : orderNumber`). */
  code: z.string().nullish(),
  packagesIn: z.number().int(),
  placed: z.number().int(),
  unplaced: z.number().int(),
  leftBehind: z.number().int(),
  notInPlan: z.number().int(),
  balanced: z.boolean(),
});

const beVehicleCountSchema = z.object({
  code: z.string(),
  estimated: z.number().int(),
  actual: z.number().int(),
});

/** `Measure`: `deltaPct` vắng khi không có gì được ước lượng. */
const beMeasureSchema = z.object({
  estimated: beDecimal,
  actual: beDecimal,
  deltaPct: beDecimal.nullish(),
});

/** `flags` nhận chuỗi tự do (BE thêm cờ mới không làm vỡ màn); `knownFlags` lọc cờ có nhãn khi hiển thị. */
const beEstimateComparisonSchema = z.object({
  estimateIds: z.array(z.string()),
  /** Id các đơn của kế hoạch chưa có ước lượng hiện hành (cờ NO_ESTIMATE). */
  notEstimated: z.array(z.string()),
  /** Chỉ so số xe khi kế hoạch có đúng một đơn có ước lượng. */
  vehiclesCompared: z.boolean(),
  vehiclesByType: z.array(beVehicleCountSchema),
  orders: z.array(
    z.object({
      orderId: z.string(),
      estimateId: z.string(),
      vehiclesByType: z.array(beVehicleCountSchema),
    }),
  ),
  cartonsByLine: z.array(
    z.object({
      orderLineId: z.string(),
      sku: z.string(),
      estimated: z.number(),
      actual: z.number().int(),
    }),
  ),
  /**
   * Vắng (BE bỏ null, `default-property-inclusion: non_null`) khi KHÔNG đơn nào có ước lượng — trường hợp thường gặp,
   * cờ chỉ có `NO_ESTIMATE`.
   */
  volumeMm3: beMeasureSchema.nullish(),
  weightKg: beMeasureSchema.nullish(),
  flags: z.array(z.string()),
});

export const beReconciliationSchema = z.object({
  pieceCheck: bePieceCountSchema,
  shipments: z.array(bePieceCountSchema),
  orders: z.array(bePieceCountSchema),
  /** Vắng khi BE chưa so được (không có ước lượng nào). */
  vsEstimate: beEstimateComparisonSchema.nullish(),
});

/** Cờ FE có nhãn tiếng Việt, theo thứ tự cố định; cờ lạ bị bỏ khỏi danh sách hiển thị. */
export function knownFlags(flags: readonly string[]): LoadPlanEstimateFlag[] {
  return LOAD_PLAN_ESTIMATE_FLAGS.filter((flag) => flags.includes(flag));
}
