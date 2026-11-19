/**
 * API hồ sơ hàng tồn (BE `InventoryItemController`). Parse zod tại biên; mock adapter trả đúng hình
 * response BE nên một luồng chạy cho cả mock lẫn BE thật.
 */
import { api } from "@/lib/api/client";

import { inventoryItemDtoSchema, inventoryItemPageSchema } from "./schemas";

import type { InventoryItemListParams } from "@/lib/references/inventory-item-keys";
import type { InventoryItem, InventoryItemPage, LogisticsFormValues } from "./types";

export type { InventoryItemListParams };

const itemPath = (id: string) => `/inventory/items/${encodeURIComponent(id)}`;

/** `GET /inventory/items` — chỉ lọc theo `q` (SKU hoặc mã vạch), đã trim; `page` 0-based. */
export async function listInventoryItems(
  params: InventoryItemListParams,
  signal?: AbortSignal,
): Promise<InventoryItemPage> {
  const q = params.q?.trim();
  const { data } = await api.get<unknown>("/inventory/items", {
    params: { page: params.page, size: params.size, ...(q ? { q } : {}) },
    signal,
  });
  return inventoryItemPageSchema.parse(data);
}

/** `GET /inventory/items/{id}` — quyền `inventory-inventory-items:READ`. */
export async function getInventoryItem(id: string, signal?: AbortSignal): Promise<InventoryItem> {
  const { data } = await api.get<unknown>(itemPath(id), { signal });
  return inventoryItemDtoSchema.parse(data);
}

const toNumber = (raw: string) => (raw.trim() === "" ? null : Number(raw));

/** Form → BE `UpdateItemLogisticsRequest`; trống = chưa biết (null); `version` là của item đã đọc. */
export function toLogisticsRequest(values: LogisticsFormValues, version: number) {
  return {
    version,
    unitOfMeasure: values.unitOfMeasure.trim(),
    barcode: values.barcode.trim() || null,
    weightKg: toNumber(values.weightKg),
    lengthCm: toNumber(values.lengthCm),
    widthCm: toNumber(values.widthCm),
    heightCm: toNumber(values.heightCm),
    packageWeightKg: toNumber(values.packageWeightKg),
    packageLengthCm: toNumber(values.packageLengthCm),
    packageWidthCm: toNumber(values.packageWidthCm),
    packageHeightCm: toNumber(values.packageHeightCm),
    packageCount: toNumber(values.packageCount),
    packSize: toNumber(values.packSize),
    // BE `InventoryItemWebMapper.toLogistics`: thiếu trường = true → luôn gửi, nếu không mỗi lần lưu
    // sẽ bật lại xoay kiện cho SKU đã tắt
    rotatable: values.rotatable,
  };
}

/** `PUT /inventory/items/{id}/logistics` — quyền `UPDATE`; trả cả item (version mới); version cũ → 409. */
export async function saveItemLogistics(input: {
  id: string;
  version: number;
  values: LogisticsFormValues;
}): Promise<InventoryItem> {
  const { data } = await api.put<unknown>(
    `${itemPath(input.id)}/logistics`,
    toLogisticsRequest(input.values, input.version),
  );
  return inventoryItemDtoSchema.parse(data);
}
