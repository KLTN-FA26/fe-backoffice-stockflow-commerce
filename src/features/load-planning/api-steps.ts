/**
 * Các bước thay đổi kế hoạch xếp xe (BE PR #161), đều `…:UPDATE`, đều gửi `expectedVersion` và trả `PlanDetail` mới:
 *
 *   POST …/calculation                          {expectedVersion}            DRAFT|PLANNED → PLANNED
 *   POST …/vehicles/{seq}/recalculation         {expectedVersion, addPackageIds?}
 *   POST …/unplaced-acknowledgement             {expectedVersion, note?}     BR-13; LP-4 → 409 ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED
 *   POST …/confirmation                         {expectedVersion}            PLANNED → CONFIRMED
 *   POST …/reopening · …/cancellation           {expectedVersion, reason}    BR-14 → 409 LOAD_PLAN_LOADING_STARTED
 *   POST …/controlled-cancellation              {expectedVersion, reasonCode, note}   SCRUM-474: huỷ sau khi đã xếp hàng,
 *        quyền `fulfillment-controlled-cancellations:UPDATE` (quản lý kho); 409 LOAD_PLAN_VEHICLE_DISPATCHED khi đã có xe đi
 *   PUT  …/placements   {expectedVersion, vehicles[{seq, boxes[{ref,xMm,yMm,zMm,wMm,hMm,dMm,orientation}]}], tray[]}
 *        chỉ khi PLANNED, nguyên tử; 422 PLACEMENT_RULE_VIOLATION fieldErrors[{field: ref | "vehicle:<seq>", code: rule}]
 */

import { api } from "@/lib/api/client";

import { loadPlanPath } from "./api";
import { bePlanDetailSchema } from "./plan-schemas";

import type { PlacementsPayload } from "./editor/payload";
import type {
  ControlledCancelPlanInput,
  PlanDetail,
  PlanStepInput,
  RecalculateVehicleInput,
} from "./plan-types";

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

/**
 * Huỷ có kiểm soát CẢ kế hoạch sau khi đã bắt đầu xếp hàng (SCRUM-474, docs 09 BR-14): kế hoạch CANCELLED ngay, kiện đã quét
 * lên xe bị khoá tới khi quét dỡ xuống. Không phải mở lại.
 */
export function cancelPlanControlled(input: ControlledCancelPlanInput): Promise<PlanDetail> {
  return post(`${loadPlanPath(input.loadPlanId)}/controlled-cancellation`, {
    expectedVersion: input.expectedVersion,
    reasonCode: input.reasonCode,
    note: input.note.trim(),
  });
}

/** Tính lại riêng một xe, thêm các kiện lấy từ khay chưa xếp; kiện không vừa quay lại khay. */
export function recalculateVehicle(input: RecalculateVehicleInput): Promise<PlanDetail> {
  return post(`${loadPlanPath(input.loadPlanId)}/vehicles/${input.seq}/recalculation`, {
    expectedVersion: input.expectedVersion,
    addPackageIds: input.addPackageIds?.length ? input.addPackageIds : undefined,
  });
}

export interface SavePlacementsInput {
  loadPlanId: string;
  payload: PlacementsPayload;
}

/** Chỉnh xếp tay cả kế hoạch, tất cả hoặc không gì (BR-11); trả `PlanDetail` mới (xe để trống đã rời kế hoạch). */
export async function savePlacements(input: SavePlacementsInput): Promise<PlanDetail> {
  const { data } = await api.put<unknown>(
    `${loadPlanPath(input.loadPlanId)}/placements`,
    input.payload,
  );
  return bePlanDetailSchema.parse(data);
}
