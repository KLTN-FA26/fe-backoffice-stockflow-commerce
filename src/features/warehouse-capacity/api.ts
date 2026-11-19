/**
 * Bảng sức chứa kho (docs 06 §4.6, BR-20), base `/api/v1`:
 *
 *   GET /warehouse-capacity               → WarehouseCapacityBoard[]  (warehouse-capacity:READ; kho đang hoạt động,
 *                                            người bị giới hạn theo kho chỉ thấy kho của mình — BE thu hẹp)
 *   GET /warehouse-capacity/{warehouseId} → WarehouseCapacityBoard    (403 OUT_OF_DATA_SCOPE, 404 WAREHOUSE_NOT_FOUND)
 *   GET /warehouses/{warehouseId}         → Warehouse                 (warehouse-warehouses:READ)
 *   PUT /warehouses/{warehouseId}         → Warehouse                 (warehouse-warehouses:UPDATE; thay toàn bộ,
 *                                            `utilizationFactor` tuỳ chọn — 409 OPTIMISTIC_LOCK khi `version` cũ)
 *
 * BE (`WarehouseCapacityController`) đặt bảng trong module order; FE gom vào feature riêng.
 */

import { api } from "@/lib/api/client";

import { capacityBoardDto, capacityBoardListDto, factorWarehouseDto } from "./schemas";

import type { CapacityBoard, FactorWarehouse, UtilizationFactorUpdate } from "./types";

export const WAREHOUSE_CAPACITY_PATH = "/warehouse-capacity";
const id = (value: string) => encodeURIComponent(value);
const warehousePath = (warehouseId: string) => `/warehouses/${id(warehouseId)}`;

export async function listCapacityBoards(signal?: AbortSignal): Promise<CapacityBoard[]> {
  const { data } = await api.get<unknown>(WAREHOUSE_CAPACITY_PATH, { signal });
  return capacityBoardListDto.parse(data);
}

export async function getCapacityBoard(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<CapacityBoard> {
  const { data } = await api.get<unknown>(`${WAREHOUSE_CAPACITY_PATH}/${id(warehouseId)}`, {
    signal,
  });
  return capacityBoardDto.parse(data);
}

export async function getFactorWarehouse(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<FactorWarehouse> {
  const { data } = await api.get<unknown>(warehousePath(warehouseId), { signal });
  return factorWarehouseDto.parse(data);
}

/**
 * Đổi hệ số sử dụng (docs 06 §4.6 bước 2, C43). `PUT /warehouses/{id}` thay toàn bộ nên gửi lại tên, địa chỉ, khung
 * bản đồ và `version` của lần đọc gần nhất — chỉ hệ số đổi. Prefix / đơn vị bản đồ không có trong body (BR-13).
 */
export async function updateUtilizationFactor({
  warehouse,
  utilizationFactor,
}: UtilizationFactorUpdate): Promise<FactorWarehouse> {
  const { data } = await api.put<unknown>(warehousePath(warehouse.id), {
    name: warehouse.name,
    address: warehouse.address,
    returnAddress: warehouse.returnAddress ?? undefined,
    mapWidth: warehouse.mapWidth,
    mapHeight: warehouse.mapHeight,
    version: warehouse.version,
    utilizationFactor,
  });
  return factorWarehouseDto.parse(data);
}
