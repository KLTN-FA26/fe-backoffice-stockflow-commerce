/**
 * Kế hoạch xếp xe (docs 09 §4.2, §5; BE PR #161 `LoadPlanController`), base `/api/v1/fulfillment`:
 *
 *   GET  /fulfillment/load-plan-candidates?warehouseId[&loadPlanId]   → lô giao nguyên xe chờ xuất  (…:READ)
 *   POST /fulfillment/load-plans {requestId, warehouseId, shipmentIds, vehicleTypeIds, selectionMode, note}  (…:CREATE)
 *   GET  /fulfillment/load-plans?warehouseId&status&search&page&size  → PageResponse<PlanRow>
 *   GET  /fulfillment/load-plans/{id} · /layouts · /reconciliation                                  (…:READ)
 *   PUT  /fulfillment/load-plans/{id}/inputs                                                        (…:UPDATE)
 *
 * Các bước còn lại (tính, tính lại xe, xác nhận kiện chưa xếp, chốt, mở lại, huỷ) ở `api-steps.ts`. Mọi thay đổi gửi
 * `expectedVersion`; 409 `OPTIMISTIC_LOCK` nếu đã đổi.
 */

import { LOAD_PLAN_LIMITS, PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import {
  beCandidateListSchema,
  beLayoutListSchema,
  bePlanDetailSchema,
  bePlanRowPageSchema,
  beVehicleTypeOptionPageSchema,
} from "./plan-schemas";
import { beReconciliationSchema } from "./reconciliation-schemas";

import type { LoadPlanStatus } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  CandidateShipment,
  CreatePlanInput,
  PlanDetail,
  PlanRow,
  Reconciliation,
  SetInputsInput,
  VehicleTypeOption,
} from "./plan-types";
import type { Layout } from "./types";

export const LOAD_PLANS_PATH = "/fulfillment/load-plans";
export const LOAD_PLAN_CANDIDATES_PATH = "/fulfillment/load-plan-candidates";
const VEHICLE_TYPES_PATH = "/fulfillment/vehicle-types";

export const loadPlanPath = (id: string) => `${LOAD_PLANS_PATH}/${encodeURIComponent(id)}`;

export interface ListLoadPlanParams extends ListQueryParams {
  warehouseId?: string;
  /** BE nhận MỘT trạng thái. */
  status?: LoadPlanStatus;
  /** So khớp trong mã kế hoạch. */
  search?: string;
}

export async function listLoadPlans(
  params: ListLoadPlanParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<PlanRow>> {
  const { data } = await api.get<unknown>(LOAD_PLANS_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      warehouseId: params.warehouseId || undefined,
      status: params.status || undefined,
      search: params.search?.trim() || undefined,
    },
    signal,
  });
  return bePlanRowPageSchema.parse(data);
}

export async function getLoadPlan(id: string, signal?: AbortSignal): Promise<PlanDetail> {
  const { data } = await api.get<unknown>(loadPlanPath(id), { signal });
  return bePlanDetailSchema.parse(data);
}

/** Bố cục mọi xe của kế hoạch (một bản đồ màu cho cả kế hoạch), theo `seq`. */
export async function getLoadPlanLayouts(id: string, signal?: AbortSignal): Promise<Layout[]> {
  const { data } = await api.get<unknown>(`${loadPlanPath(id)}/layouts`, { signal });
  return beLayoutListSchema.parse(data);
}

export async function getLoadPlanReconciliation(
  id: string,
  signal?: AbortSignal,
): Promise<Reconciliation> {
  const { data } = await api.get<unknown>(`${loadPlanPath(id)}/reconciliation`, { signal });
  return beReconciliationSchema.parse(data);
}

/** `loadPlanId`: kiện của chính kế hoạch đó được tính là còn trống (khi đổi đầu vào). */
export async function listLoadPlanCandidates(
  warehouseId: string,
  loadPlanId?: string,
  signal?: AbortSignal,
): Promise<CandidateShipment[]> {
  const { data } = await api.get<unknown>(LOAD_PLAN_CANDIDATES_PATH, {
    params: { warehouseId, loadPlanId: loadPlanId || undefined },
    signal,
  });
  return beCandidateListSchema.parse(data);
}

/** Loại xe đang dùng cho ô chọn (danh mục chung `fulfillment-vehicle-types:READ`; không import feature loại xe). */
export async function listActiveVehicleTypes(signal?: AbortSignal): Promise<VehicleTypeOption[]> {
  const { data } = await api.get<unknown>(VEHICLE_TYPES_PATH, {
    params: { status: "ACTIVE", page: 0, size: LOAD_PLAN_LIMITS.vehicleTypePickerSize },
    signal,
  });
  return beVehicleTypeOptionPageSchema.parse(data).items;
}

/** Lập kế hoạch nháp kèm đầu vào; idempotent theo `requestId` (gửi lại trả đúng kế hoạch đã tạo). */
export async function createLoadPlan(input: CreatePlanInput): Promise<PlanDetail> {
  const { data } = await api.post<unknown>(LOAD_PLANS_PATH, {
    requestId: input.requestId,
    warehouseId: input.warehouseId,
    shipmentIds: input.shipmentIds,
    vehicleTypeIds: input.vehicleTypeIds,
    selectionMode: input.selectionMode,
    note: input.note?.trim() || undefined,
  });
  return bePlanDetailSchema.parse(data);
}

/** Thay nguyên cả lô, loại xe và chế độ; kế hoạch đã tính (PLANNED) về DRAFT và bỏ các xe. */
export async function setLoadPlanInputs(input: SetInputsInput): Promise<PlanDetail> {
  const { data } = await api.put<unknown>(`${loadPlanPath(input.loadPlanId)}/inputs`, {
    expectedVersion: input.expectedVersion,
    shipmentIds: input.shipmentIds,
    vehicleTypeIds: input.vehicleTypeIds,
    selectionMode: input.selectionMode,
  });
  return bePlanDetailSchema.parse(data);
}
