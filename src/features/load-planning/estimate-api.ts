/**
 * Ước tính xếp xe — API layer (BE PR #160 `LoadEstimateController`, base `/api/v1/fulfillment`):
 *
 *   POST /fulfillment/load-estimates {sources:[{type:"ORDER", id}], warehouseId?, vehicleTypeIds, selectionMode}
 *        → 201 LoadEstimate; cần `fulfillment-load-estimates:CREATE`. Đơn CONFIRMED bắt buộc `warehouseId`.
 *        422 LOAD_ESTIMATE_PACKAGING_MISSING (không dòng nào đủ dữ liệu) / LOAD_ESTIMATE_TOO_MANY_CARTONS,
 *        409 LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE / VEHICLE_TYPE_INACTIVE, 400 VALIDATION_FAILED.
 *   GET  /fulfillment/load-estimates?sourceType=ORDER&sourceId= → ước tính hiện hành; cần `:READ`;
 *        404 LOAD_ESTIMATE_NOT_FOUND khi đơn chưa có — với màn này đó là "chưa có", không phải lỗi.
 *   GET  /fulfillment/vehicle-types?status=ACTIVE → loại xe đang dùng (ô chọn); cần `fulfillment-vehicle-types:READ`.
 */

import { LOAD_ESTIMATE_LIMITS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { EstimateVehicleTypePageSchema, LoadEstimateSchema } from "./estimate-schemas";

import type { CreateEstimateInput, EstimateVehicleType, LoadEstimate } from "./estimate-types";

export const LOAD_ESTIMATES_PATH = "/fulfillment/load-estimates";
export const ESTIMATE_VEHICLE_TYPES_PATH = "/fulfillment/vehicle-types";

/** Body POST: `warehouseId` chỉ gửi khi có (đơn đã release dùng kho của nó và BE từ chối kho khác). */
export function toEstimateBody(input: CreateEstimateInput) {
  return {
    sources: [{ type: "ORDER", id: input.orderId }],
    ...(input.warehouseId ? { warehouseId: input.warehouseId } : {}),
    vehicleTypeIds: input.vehicleTypeIds,
    selectionMode: input.selectionMode,
  };
}

export async function createLoadEstimate(input: CreateEstimateInput): Promise<LoadEstimate> {
  const { data } = await api.post<unknown>(LOAD_ESTIMATES_PATH, toEstimateBody(input));
  return LoadEstimateSchema.parse(data);
}

/** Ước tính hiện hành của đơn, hoặc null khi đơn chưa có (404 LOAD_ESTIMATE_NOT_FOUND). */
export async function getCurrentLoadEstimate(
  orderId: string,
  signal?: AbortSignal,
): Promise<LoadEstimate | null> {
  try {
    const { data } = await api.get<unknown>(LOAD_ESTIMATES_PATH, {
      params: { sourceType: "ORDER", sourceId: orderId },
      signal,
    });
    return LoadEstimateSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiError && error.code === "LOAD_ESTIMATE_NOT_FOUND") return null;
    throw error;
  }
}

export async function listEstimateVehicleTypes(
  signal?: AbortSignal,
): Promise<EstimateVehicleType[]> {
  const { data } = await api.get<unknown>(ESTIMATE_VEHICLE_TYPES_PATH, {
    params: { status: "ACTIVE", page: 0, size: LOAD_ESTIMATE_LIMITS.vehicleTypesPageSize },
    signal,
  });
  return EstimateVehicleTypePageSchema.parse(data).items;
}
