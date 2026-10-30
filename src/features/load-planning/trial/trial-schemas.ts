/**
 * "Ước tính thử" (SCRUM-474 TRIAL-FLOW, LP2-9; BE `POST /fulfillment/load-estimates/trial`) — DTO trả về (parse tại biên
 * API) và đầu vào yêu cầu. Trả về cùng dạng khung 3D của ước tính thật (`vehicles` = `Layout`, `unplaced`, `meta`) kèm
 * `trial: true`; KHÔNG có id / nguồn / thời điểm vì BE không lưu gì.
 */

import { z } from "zod";

import {
  LOAD_ESTIMATE_LIMITS,
  LOAD_ESTIMATE_SELECTION_MODES,
  TRIAL_GROUP_MAX,
  TRIAL_MAX_BOXES,
  TRIAL_MAX_MM,
  TRIAL_NAME_MAX,
} from "@/constants";

import { EstimateMetaSchema, EstimateUnplacedSchema } from "../estimate-schemas";
import { LayoutSchema } from "../schemas";

export const TrialEstimateSchema = z.object({
  /** Luôn true: câu trả lời không được lưu, không lấy lại được. */
  trial: z.literal(true),
  selectionMode: z.string(),
  vehicleTypeIds: z.array(z.string()),
  vehicles: z.array(LayoutSchema),
  unplaced: z.array(EstimateUnplacedSchema).default([]),
  meta: EstimateMetaSchema,
});

const mm = z.number().int().positive().max(TRIAL_MAX_MM);

/** BE `TrialLoadEstimateRequest.Line`. */
export const TrialLineInputSchema = z.object({
  name: z.string().max(TRIAL_NAME_MAX),
  group: z.string().max(TRIAL_GROUP_MAX),
  lengthMm: mm,
  widthMm: mm,
  heightMm: mm,
  quantity: z.number().int().positive(),
  rotatable: z.boolean(),
});

/**
 * Yêu cầu chạy thử. Tối đa `TRIAL_MAX_BOXES` kiện cộng dồn — cùng giới hạn với ước tính thật (BE
 * `EstimateCartons.MAX_BOXES`, kltn-docs 09 §4.0 mục 4); `vehicleTypeIds` rỗng = mọi loại đang dùng, tối đa 20.
 */
export const TrialRunInputSchema = z.object({
  lines: z
    .array(TrialLineInputSchema)
    .min(1)
    .refine((lines) => lines.reduce((sum, line) => sum + line.quantity, 0) <= TRIAL_MAX_BOXES),
  vehicleTypeIds: z.array(z.string().min(1)).max(LOAD_ESTIMATE_LIMITS.vehicleTypesMax),
  selectionMode: z.enum(LOAD_ESTIMATE_SELECTION_MODES),
});
