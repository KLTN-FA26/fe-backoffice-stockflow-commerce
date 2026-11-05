/**
 * Supplier item — API layer, khớp BE `SupplierItemController` (BE #117):
 * GET/POST `/suppliers/{id}/items`, PUT/DELETE `/suppliers/{id}/items/{itemId}`.
 * Parse tại biên (api-conventions §3.2): zod validate một lần ở đây.
 */

import { api } from "@/lib/api/client";
import { bePageSchema } from "@/lib/api/page-schema";
import { supplierItemSchema } from "@/lib/references/supplier-items";

import { normalizeDecimal } from "./item-schemas";

import type { PaginatedResponse } from "@/lib/api/query-factory";
import type { SupplierItemListParams } from "@/lib/references/supplier-items";
import type { SupplierItem, SupplierItemFormValues } from "./types";

const itemPageSchema = bePageSchema(supplierItemSchema);

const itemsPath = (supplierId: string) => `/suppliers/${encodeURIComponent(supplierId)}/items`;
const itemPath = (supplierId: string, itemId: string) =>
  `${itemsPath(supplierId)}/${encodeURIComponent(itemId)}`;

/**
 * Body `SaveSupplierItemRequest`. KHÔNG có `currency` (BE quy giá về tiền tệ NCC).
 * Luôn có `preferred`: BE coi thiếu/false trên dòng đang ưu tiên là xoá NCC mặc định của SKU
 * (BE #121, docs 01 §3 "Nhà cung cấp mặc định").
 */
export function toSaveSupplierItemRequest(values: SupplierItemFormValues, version?: number) {
  const supplierSkuCode = values.supplierSkuCode.trim();
  const leadTimeDays = values.leadTimeDays.trim();
  return {
    sku: values.sku.trim().toUpperCase(),
    supplierSkuCode: supplierSkuCode === "" ? null : supplierSkuCode,
    price: Number(normalizeDecimal(values.price)),
    moq: Number(values.moq),
    packSize: Number(values.packSize),
    leadTimeDays: leadTimeDays === "" ? null : Number(leadTimeDays),
    preferred: values.preferred,
    ...(version === undefined ? {} : { version }),
  };
}

export async function listSupplierItems(
  supplierId: string,
  params: SupplierItemListParams,
  signal?: AbortSignal,
): Promise<PaginatedResponse<SupplierItem>> {
  const { page = 0, size, sort } = params;
  const query = new URLSearchParams({ page: String(Math.max(0, page)) });
  if (size !== undefined) query.set("size", String(size));
  if (sort?.trim()) query.set("sort", sort.trim());
  const { data } = await api.get<unknown>(itemsPath(supplierId), { params: query, signal });
  return itemPageSchema.parse(data);
}

export interface CreateSupplierItemInput {
  supplierId: string;
  values: SupplierItemFormValues;
}

export interface UpdateSupplierItemInput extends CreateSupplierItemInput {
  item: SupplierItem;
}

export interface DeleteSupplierItemInput {
  supplierId: string;
  item: SupplierItem;
}

export async function createSupplierItem({
  supplierId,
  values,
}: CreateSupplierItemInput): Promise<SupplierItem> {
  const { data } = await api.post<unknown>(
    itemsPath(supplierId),
    toSaveSupplierItemRequest(values),
  );
  return supplierItemSchema.parse(data);
}

export async function updateSupplierItem({
  supplierId,
  item,
  values,
}: UpdateSupplierItemInput): Promise<SupplierItem> {
  const { data } = await api.put<unknown>(
    itemPath(supplierId, item.supplierItemId),
    toSaveSupplierItemRequest(values, item.version),
  );
  return supplierItemSchema.parse(data);
}

export async function deleteSupplierItem({
  supplierId,
  item,
}: DeleteSupplierItemInput): Promise<void> {
  await api.delete(itemPath(supplierId, item.supplierItemId), {
    params: new URLSearchParams({ version: String(item.version) }),
  });
}
