/**
 * Kiểm tra đầu vào form kế hoạch xếp xe trước khi gọi BE (`CreateLoadPlanRequest`, `LoadPlanInputsRequest`,
 * `LoadPlanReasonRequest`, `VehicleRecalculationRequest`, PR #161). BE vẫn re-check mọi thứ.
 */

import { z } from "zod";

import {
  LOAD_PLAN_FIELD_MESSAGES as M,
  LOAD_PLAN_LIMITS as LIMITS,
  LOAD_PLAN_SELECTION_MODES,
} from "@/constants";

const ids = (min: string, max: number, tooMany: string) =>
  z.array(z.string().min(1)).min(1, min).max(max, tooMany);

/** Đầu vào của một kế hoạch: lô (nguyên lô, LP-5), loại xe, chế độ chọn xe (LP-6). */
export const planInputsSchema = z.object({
  shipmentIds: ids(M.shipmentsRequired, LIMITS.shipmentsMax, M.shipmentsTooMany),
  vehicleTypeIds: ids(M.vehicleTypesRequired, LIMITS.vehicleTypesMax, M.vehicleTypesTooMany),
  selectionMode: z.enum(LOAD_PLAN_SELECTION_MODES),
});

/**
 * Đầu vào của kế hoạch nguồn TRANSFER (BE PR #164, LP-9; docs 09 §4.2 bước 1): đúng MỘT lệnh chuyển kho, đi nguyên.
 * `transferOrderIds` @Size(max = 1); BE từ chối trộn với lô giao (`LOAD_PLAN_SOURCE_MISMATCH`).
 */
export const transferPlanInputsSchema = z.object({
  transferOrderIds: z
    .array(z.string().min(1))
    .min(1, M.transferRequired)
    .max(LIMITS.transferOrdersMax, M.transferOnlyOne),
  vehicleTypeIds: ids(M.vehicleTypesRequired, LIMITS.vehicleTypesMax, M.vehicleTypesTooMany),
  selectionMode: z.enum(LOAD_PLAN_SELECTION_MODES),
});

const planHeader = {
  warehouseId: z.string().min(1, M.warehouseRequired),
  note: z.string().trim().max(LIMITS.noteMax, M.noteTooLong).optional(),
};

export const createPlanFormSchema = planInputsSchema.extend(planHeader);

export const createTransferPlanFormSchema = transferPlanInputsSchema.extend(planHeader);

/** Lý do mở lại / huỷ: bắt buộc, tối đa 500 ký tự (LP-11: lý do đi tới các chuyến bị huỷ). */
export const planReasonSchema = z.object({
  reason: z.string().trim().min(1, M.reasonRequired).max(LIMITS.reasonMax, M.reasonTooLong),
});

export const addPackagesSchema = z
  .array(z.string().min(1))
  .max(LIMITS.addPackagesMax, M.packagesTooMany);

export type CreatePlanFormValues = z.infer<typeof createPlanFormSchema>;
export type CreateTransferPlanFormValues = z.infer<typeof createTransferPlanFormSchema>;
