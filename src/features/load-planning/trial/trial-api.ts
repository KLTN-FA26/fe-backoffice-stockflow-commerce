/**
 * "Ước tính thử" — API layer (BE `LoadEstimateController`, base `/api/v1/fulfillment`):
 *
 *   POST /fulfillment/load-estimates/trial {lines[{name, group, lengthMm, widthMm, heightMm, quantity, rotatable}],
 *        vehicleTypeIds, selectionMode} → 200 {trial: true, vehicles, unplaced, meta, …}. Cần
 *        `fulfillment-load-estimates:CREATE`. KHÔNG lưu gì (không bản ghi ước tính, không audit, không event).
 *        400 VALIDATION_FAILED, 404 VEHICLE_TYPE_NOT_FOUND, 409 VEHICLE_TYPE_INACTIVE,
 *        422 LOAD_ESTIMATE_TOO_MANY_CARTONS (quá 3 000 kiện).
 */

import { api } from "@/lib/api/client";

import { LOAD_ESTIMATES_PATH } from "../estimate-api";

import { TrialEstimateSchema } from "./trial-schemas";

import type { TrialEstimate, TrialRunInput } from "./trial-types";

export const TRIAL_ESTIMATE_PATH = `${LOAD_ESTIMATES_PATH}/trial`;

export async function runTrialEstimate(input: TrialRunInput): Promise<TrialEstimate> {
  const { data } = await api.post<unknown>(TRIAL_ESTIMATE_PATH, input);
  return TrialEstimateSchema.parse(data);
}
