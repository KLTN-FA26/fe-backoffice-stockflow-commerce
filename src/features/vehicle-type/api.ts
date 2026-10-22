/**
 * Danh mục loại xe (docs 09 §3, BE PR #153 `VehicleTypeController`), base `/api/v1/fulfillment`:
 *
 *   GET  /fulfillment/vehicle-types?status&search&page&size   → PageResponse<VehicleType>  (…:READ)
 *   GET  /fulfillment/vehicle-types/{id}                      → VehicleType; 404 VEHICLE_TYPE_NOT_FOUND
 *   POST /fulfillment/vehicle-types                           → 201; 409 VEHICLE_TYPE_CODE_EXISTS  (…:UPDATE)
 *   PUT  /fulfillment/vehicle-types/{id} {…, version}         → 409 OPTIMISTIC_LOCK; mã khác → 400 VALIDATION_FAILED
 *
 * Không có DELETE: ngừng dùng bằng `status: INACTIVE`. PUT đòi đủ tên, loại, kích thước, tải trọng,
 * số xe; `rentalPrice` vắng = xoá giá; `gussetMm` vắng = giữ nguyên; `status` vắng = giữ nguyên.
 */

import { PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { beVehicleTypePageSchema, beVehicleTypeSchema } from "./schemas";

import type { VEHICLE_TYPE_STATUSES } from "@/constants";
import type { ListQueryParams, PaginatedResponse } from "@/lib/api/query-factory";
import type {
  SetVehicleTypeStatusInput,
  UpdateVehicleTypeInput,
  VehicleType,
  VehicleTypeBody,
} from "./types";

export const VEHICLE_TYPES_PATH = "/fulfillment/vehicle-types";
const vehicleTypePath = (id: string) => `${VEHICLE_TYPES_PATH}/${encodeURIComponent(id)}`;

export interface ListVehicleTypeParams extends ListQueryParams {
  /** BE nhận MỘT trạng thái. */
  status?: (typeof VEHICLE_TYPE_STATUSES)[number];
  /** So khớp trong mã hoặc tên. */
  search?: string;
}

export async function listVehicleTypes(
  params: ListVehicleTypeParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<VehicleType>> {
  const { data } = await api.get<unknown>(VEHICLE_TYPES_PATH, {
    params: {
      page: Math.max(0, params.page ?? 0),
      size: params.size ?? PAGE_SIZE.md,
      status: params.status || undefined,
      search: params.search?.trim() || undefined,
    },
    signal,
  });
  return beVehicleTypePageSchema.parse(data);
}

export async function getVehicleType(id: string, signal?: AbortSignal): Promise<VehicleType> {
  const { data } = await api.get<unknown>(vehicleTypePath(id), { signal });
  return beVehicleTypeSchema.parse(data);
}

/** Mã viết hoa như BE (BE tự viết hoa, gửi sẵn để bản ghi tạo ra khớp cái người dùng thấy). */
export async function createVehicleType(body: VehicleTypeBody): Promise<VehicleType> {
  const { data } = await api.post<unknown>(VEHICLE_TYPES_PATH, {
    ...body,
    code: body.code.toUpperCase(),
  });
  return beVehicleTypeSchema.parse(data);
}

export async function updateVehicleType({
  vehicleTypeId,
  version,
  body,
}: UpdateVehicleTypeInput): Promise<VehicleType> {
  const { data } = await api.put<unknown>(vehicleTypePath(vehicleTypeId), { ...body, version });
  return beVehicleTypeSchema.parse(data);
}

/** Dòng hiện có → body PUT đủ trường; mã không đổi (BE từ chối mã khác). */
export function bodyOfVehicleType(
  row: VehicleType,
  status: VehicleType["status"] = row.status,
): VehicleTypeBody {
  return {
    code: row.code,
    name: row.name,
    kind: row.kind,
    innerLengthMm: row.innerLengthMm,
    innerWidthMm: row.innerWidthMm,
    innerHeightMm: row.innerHeightMm,
    gussetMm: row.gussetMm,
    maxPayloadKg: row.maxPayloadKg,
    availableCount: row.availableCount,
    rentalPrice: row.rentalPrice ?? undefined,
    status,
  };
}

/** Ngừng dùng / dùng lại từ bảng: PUT đủ trường của dòng, chỉ đổi `status`, kèm `version` đã đọc. */
export function setVehicleTypeStatus({
  vehicleType,
  status,
}: SetVehicleTypeStatusInput): Promise<VehicleType> {
  return updateVehicleType({
    vehicleTypeId: vehicleType.vehicleTypeId,
    version: vehicleType.version,
    body: bodyOfVehicleType(vehicleType, status),
  });
}
