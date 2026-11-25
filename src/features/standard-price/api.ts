/**
 * API giá chuẩn theo quy cách — BE `StandardPriceController` (`/catalog/standard-prices`; client đã thêm `/api/v1`).
 * Parse zod tại biên (api-conventions §3.2) và kiểm response đúng SKU đã hỏi. Danh sách là MẢNG thường (BE không phân
 * trang) — không gửi `page` / `size`.
 */
import { z } from "zod";

import { api } from "@/lib/api/client";
import { toPriceTierBody } from "@/lib/pricing/price-tiers";

import {
  beStandardPriceSchema,
  standardPriceValuesSchema,
  standardPriceVersionSchema,
} from "./schemas";

import type { PriceTierValues } from "@/lib/pricing/price-tiers";
import type { StandardPrice } from "./schemas";

const BASE = "/catalog/standard-prices";

/** BE chuẩn hoá SKU (bỏ khoảng trắng, in hoa) trước khi so — so cùng cách. */
const sameSku = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

function pricePath(sku: string): string {
  if (sku.trim() === "") throw new Error("Standard price needs a sku");
  return `${BASE}/${encodeURIComponent(sku)}`;
}

/** Bản ghi phải là của đúng SKU đã hỏi — khác là lỗi hợp đồng, không vào cache. */
function parsePrice(data: unknown, sku?: string): StandardPrice {
  const price = beStandardPriceSchema.parse(data);
  if (sku !== undefined && !sameSku(price.sku, sku)) {
    throw new Error("Standard price response belongs to another SKU");
  }
  return price;
}

/** `GET ?sku=…` (tuỳ chọn, lặp được; không có = mọi giá chuẩn). SKU không có giá chuẩn thì không có trong kết quả. */
export async function listStandardPrices(
  skus: readonly string[] = [],
  signal?: AbortSignal,
): Promise<StandardPrice[]> {
  const params = new URLSearchParams();
  for (const sku of skus) params.append("sku", sku);
  const { data } = await api.get<unknown>(BASE, { params, signal });
  return z
    .array(z.unknown())
    .parse(data)
    .map((row) => parsePrice(row));
}

/** `GET /{sku}` — 404 STANDARD_PRICE_NOT_FOUND khi quy cách chưa có giá chuẩn. */
export async function getStandardPrice(sku: string, signal?: AbortSignal): Promise<StandardPrice> {
  const { data } = await api.get<unknown>(pricePath(sku), { signal });
  return parsePrice(data, sku);
}

export interface CreateStandardPriceInput {
  sku: string;
  values: PriceTierValues;
}

export interface UpdateStandardPriceInput extends CreateStandardPriceInput {
  /** `version` của lần đọc gần nhất — gửi nguyên vẹn; lệch → 409 OPTIMISTIC_LOCK. */
  version: number;
}

/**
 * `POST /{sku}` → 201. Quy cách đã có giá chuẩn → 409 CONFLICT; SKU riêng của khách → 409
 * STANDARD_PRICE_VARIANT_REQUIRED; SKU không có trong danh mục → 404 VARIANT_NOT_FOUND.
 */
export async function createStandardPrice(input: CreateStandardPriceInput): Promise<StandardPrice> {
  const body = toPriceTierBody(standardPriceValuesSchema.parse(input.values));
  const { data } = await api.post<unknown>(pricePath(input.sku), body);
  return parsePrice(data, input.sku);
}

/** `PUT /{sku}` — thay TOÀN BỘ bậc giá và ghi chú (không có PATCH). */
export async function updateStandardPrice(input: UpdateStandardPriceInput): Promise<StandardPrice> {
  const version = standardPriceVersionSchema.parse(input.version);
  const body = toPriceTierBody(standardPriceValuesSchema.parse(input.values));
  const { data } = await api.put<unknown>(pricePath(input.sku), { ...body, version });
  return parsePrice(data, input.sku);
}

export interface DeleteStandardPriceInput {
  sku: string;
  /** `version` của lần đọc gần nhất — lệch → 409 OPTIMISTIC_LOCK. */
  version: number;
}

/** `DELETE /{sku}?version=` — xoá giá chuẩn; không có → 404. */
export async function deleteStandardPrice(input: DeleteStandardPriceInput): Promise<void> {
  const version = standardPriceVersionSchema.parse(input.version);
  await api.delete(pricePath(input.sku), { params: { version } });
}
