/**
 * Các bước thay đổi kế hoạch xếp xe (BE PR #161), đều `…:UPDATE`, đều gửi `expectedVersion` và trả `PlanDetail` mới:
 *
 *   POST …/calculation                          {expectedVersion}            DRAFT|PLANNED → PLANNED
 *   POST …/vehicles/{seq}/recalculation         {expectedVersion, addPackageIds?}
 *   POST …/unplaced-acknowledgement             {expectedVersion, note?}     BR-13; LP-4 → 409 ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED
 *   POST …/confirmation                         {expectedVersion}            PLANNED → CONFIRMED
 *   POST …/reopening · …/cancellation           {expectedVersion, reason}    BR-14 → 409 LOAD_PLAN_LOADING_STARTED
 */

import { api } from "@/lib/api/client";

import { loadPlanPath } from "./api";
import { bePlanDetailSchema } from "./plan-schemas";

import type { PlanDetail, PlanStepInput, RecalculateVehicleInput } from "./plan-types";

async function post(path: string, body: Record<string, unknown>): Promise<PlanDetail> {
  const { data } = await api.post<unknown>(path, body);
  return bePlanDetailSchema.parse(data);
}

/** Một bước đổi trạng thái, rẽ nhánh theo `kind`. */
export function runPlanStep(step: PlanStepInput): Promise<PlanDetail> {
  const base = loadPlanPath(step.loadPlanId);
  const { expectedVersion } = step;
  switch (step.kind) {
    case "calculate":
      return post(`${base}/calculation`, { expectedVersion });
    case "acknowledge":
      return post(`${base}/unplaced-acknowledgement`, {
        expectedVersion,
        note: step.note?.trim() || undefined,
      });
    case "confirm":
      return post(`${base}/confirmation`, { expectedVersion });
    case "reopen":
      return post(`${base}/reopening`, { expectedVersion, reason: step.reason.trim() });
    case "cancel":
      return post(`${base}/cancellation`, { expectedVersion, reason: step.reason.trim() });
  }
}

/** Tính lại riêng một xe, thêm các kiện lấy từ khay chưa xếp; kiện không vừa quay lại khay. */
export function recalculateVehicle(input: RecalculateVehicleInput): Promise<PlanDetail> {
  return post(`${loadPlanPath(input.loadPlanId)}/vehicles/${input.seq}/recalculation`, {
    expectedVersion: input.expectedVersion,
    addPackageIds: input.addPackageIds?.length ? input.addPackageIds : undefined,
  });
}
