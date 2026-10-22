/** Kiểu của kế hoạch xếp xe — suy ra từ zod (`plan-schemas.ts`, `reconciliation-schemas.ts`), không khai báo tay. */

import type { z } from "zod";

import type { LoadPlanSelectionMode } from "@/constants";
import type {
  beCandidateShipmentSchema,
  beParcelSchema,
  bePlanDetailSchema,
  bePlanRowSchema,
  beVehicleSummarySchema,
  beVehicleTypeOptionSchema,
} from "./plan-schemas";
import type { beReconciliationSchema } from "./reconciliation-schemas";

export type PlanParcel = z.infer<typeof beParcelSchema>;
export type CandidateShipment = z.infer<typeof beCandidateShipmentSchema>;
export type PlanRow = z.infer<typeof bePlanRowSchema>;
export type PlanDetail = z.infer<typeof bePlanDetailSchema>;
export type PlanVehicle = z.infer<typeof beVehicleSummarySchema>;
export type VehicleTypeOption = z.infer<typeof beVehicleTypeOptionSchema>;
export type Reconciliation = z.infer<typeof beReconciliationSchema>;
export type EstimateComparison = NonNullable<Reconciliation["vsEstimate"]>;

/** Đầu vào của kế hoạch: lô (nguyên lô), loại xe, chế độ — cùng dạng khi tạo và khi đổi. */
export interface PlanInputs {
  shipmentIds: string[];
  vehicleTypeIds: string[];
  selectionMode: LoadPlanSelectionMode;
}

export interface CreatePlanInput extends PlanInputs {
  /** Sinh ở client để gửi lại không tạo kế hoạch thứ hai (BE idempotent theo `requestId`). */
  requestId: string;
  warehouseId: string;
  note?: string;
}

/** Mọi thay đổi gửi kèm `version` đã đọc (BE `expectedVersion`; 409 OPTIMISTIC_LOCK nếu đã đổi). */
export interface VersionedInput {
  loadPlanId: string;
  expectedVersion: number;
}

export interface SetInputsInput extends VersionedInput, PlanInputs {}

export interface ReasonInput extends VersionedInput {
  reason: string;
}

export interface RecalculateVehicleInput extends VersionedInput {
  seq: number;
  /** Kiện lấy từ khay chưa xếp (kiện của bộ kéo theo cả bộ). */
  addPackageIds?: string[];
}

/** Bước đổi trạng thái kế hoạch: một mutation chung, rẽ nhánh theo `kind`. */
export type PlanStepInput =
  | ({ kind: "calculate" } & VersionedInput)
  | ({ kind: "acknowledge" } & VersionedInput & { note?: string })
  | ({ kind: "confirm" } & VersionedInput)
  | ({ kind: "reopen" } & ReasonInput)
  | ({ kind: "cancel" } & ReasonInput);

export type PlanStepKind = PlanStepInput["kind"];
