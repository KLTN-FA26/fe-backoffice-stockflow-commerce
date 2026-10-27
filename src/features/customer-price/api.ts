/**
 * API bảng giá riêng của khách hàng — BE `CustomerPriceController` (`/catalog/customer-prices`; client
 * đã thêm `/api/v1`). Parse zod tại biên (api-conventions §3.2) và kiểm response đúng khách / SKU đã hỏi.
 * Danh sách là MẢNG thường (BE không phân trang) — không gửi `page` / `size`. Chưa dùng: `/schedule`
 * (xem trước giá khách trả) và DELETE.
 */
import { z } from "zod";

import { api } from "@/lib/api/client";

import {
  beCustomerPriceSchema,
  customerPriceValuesSchema,
  customerPriceVersionSchema,
} from "./schemas";

import type { CustomerPrice, CustomerPriceValues, ValidCustomerPriceValues } from "./schemas";

const BASE = "/catalog/customer-prices";

function requireId(value: string, name: string): string {
  if (value.trim() === "") throw new Error(`Customer price needs a ${name}`);
  return value;
}

const pricePath = (customerId: string, sku: string) =>
  `${BASE}/${encodeURIComponent(requireId(customerId, "customer id"))}/${encodeURIComponent(requireId(sku, "sku"))}`;

/**
 * BE chuẩn hoá SKU (bỏ khoảng trắng, in hoa) trước khi so — so cùng cách. `customerId` là UUID (không
 * phân biệt hoa thường): BE trả dạng chữ thường dù đường dẫn gửi chữ hoa (vd `?customerId=` gõ tay).
 */
const sameSku = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Bản ghi phải là của đúng khách (và SKU, khi biết) đã hỏi — khác là lỗi hợp đồng, không vào cache. */
function parsePrice(data: unknown, customerId: string, sku?: string): CustomerPrice {
  const price = beCustomerPriceSchema.parse(data);
  if (!sameId(price.customerId, customerId) || (sku !== undefined && !sameSku(price.sku, sku))) {
    throw new Error("Customer price response belongs to another customer or SKU");
  }
  return price;
}

/**
 * `GET ?customerId=` (bắt buộc) `&sku=…` (tuỳ chọn, lặp được) — mọi giá riêng của khách, BE sắp theo SKU.
 * SKU không có giá thì đơn giản không có trong kết quả.
 */
export async function listCustomerPrices(
  customerId: string,
  skus: readonly string[] = [],
  signal?: AbortSignal,
): Promise<CustomerPrice[]> {
  const params = new URLSearchParams({ customerId: requireId(customerId, "customer id") });
  for (const sku of skus) params.append("sku", sku);
  const { data } = await api.get<unknown>(BASE, { params, signal });
  return z
    .array(z.unknown())
    .parse(data)
    .map((row) => parsePrice(row, customerId));
}

/** `GET /{customerId}/{sku}` — 404 CUSTOMER_PRICE_NOT_FOUND khi khách chưa có giá cho SKU này. */
export async function getCustomerPrice(
  customerId: string,
  sku: string,
  signal?: AbortSignal,
): Promise<CustomerPrice> {
  const { data } = await api.get<unknown>(pricePath(customerId, sku), { signal });
  return parsePrice(data, customerId, sku);
}

/**
 * Body `CustomerPriceRequest`. Đơn giá đã qua `travelsExactly` nên `Number` ở đây in lại đúng chữ số khi
 * `JSON.stringify`. Tạo: KHÔNG có `version` (BE: vắng = tạo). Thay: luôn có `version`.
 */
export function toCustomerPriceBody(values: ValidCustomerPriceValues) {
  return {
    tiers: values.tiers.map((t) => ({
      minQuantity: t.minQuantity,
      unitPrice: Number(t.unitPrice),
    })),
    note: values.note,
  };
}

export interface CreateCustomerPriceInput {
  customerId: string;
  sku: string;
  values: CustomerPriceValues;
}

export interface UpdateCustomerPriceInput extends CreateCustomerPriceInput {
  /** `version` của lần đọc gần nhất — gửi nguyên vẹn; lệch → 409 OPTIMISTIC_LOCK. */
  version: number;
}

/** `POST /{customerId}/{sku}` → 201. Khách đã có giá cho SKU → 409 CONFLICT. Kiểm trước khi gọi BE. */
export async function createCustomerPrice(input: CreateCustomerPriceInput): Promise<CustomerPrice> {
  const path = pricePath(input.customerId, input.sku);
  const body = toCustomerPriceBody(customerPriceValuesSchema.parse(input.values));
  const { data } = await api.post<unknown>(path, body);
  return parsePrice(data, input.customerId, input.sku);
}

/** `PUT /{customerId}/{sku}` — thay TOÀN BỘ bậc giá và ghi chú (không có PATCH). */
export async function updateCustomerPrice(input: UpdateCustomerPriceInput): Promise<CustomerPrice> {
  const path = pricePath(input.customerId, input.sku);
  const version = customerPriceVersionSchema.parse(input.version);
  const body = toCustomerPriceBody(customerPriceValuesSchema.parse(input.values));
  const { data } = await api.put<unknown>(path, { ...body, version });
  return parsePrice(data, input.customerId, input.sku);
}
