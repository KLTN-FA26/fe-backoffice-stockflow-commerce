/**
 * Giá chuẩn theo quy cách — BE `StandardPriceController` (`/api/v1/catalog/standard-prices`), `StandardPriceRequest` /
 * `StandardPriceResponse`, domain `StandardPrice` + `PriceTiers` (kltn-docs 13 BR-04 sửa ngày 2026-11-26). Quản lý kinh
 * doanh giữ cho mỗi quy cách của danh mục (không phải SKU riêng của khách) 1–20 bậc giá: từ N thùng một đơn giá VND nguyên
 * cho một cái, cho mẫu in thông thường. Không có ngày hiệu lực; MOQ = bậc nhỏ nhất (BE tính); tiền tệ luôn VND.
 * Bậc giá (DTO + Input) chung với bảng giá riêng của khách: `lib/pricing/price-tiers.ts`.
 */

import { z } from "zod";

import { PRICE_TIER_LIMITS as L } from "@/constants";
import {
  bePriceTierSchema,
  priceTierValuesSchema,
  priceVersionSchema,
} from "@/lib/pricing/price-tiers";
import { omittedOrNull } from "@/lib/validation/primitives";

/**
 * BE `StandardPriceResponse`. `productName` / `variantName` có để màn hình không phải tra sản phẩm; null (Jackson
 * `non_null` bỏ khỏi JSON) khi BE không biết.
 */
export const beStandardPriceSchema = z.object({
  sku: z.string().min(1),
  productName: omittedOrNull(z.string()),
  variantName: omittedOrNull(z.string()),
  moq: z.number().int().min(L.minQuantityMin),
  tiers: z.array(bePriceTierSchema).min(1),
  note: omittedOrNull(z.string()),
  version: z.number().int().min(0),
});
export type StandardPrice = z.infer<typeof beStandardPriceSchema>;

/** Giá trị một giá chuẩn (tạo hoặc thay) — cùng luật bậc giá với bảng giá riêng của khách. */
export const standardPriceValuesSchema = priceTierValuesSchema;

/** BE PUT / DELETE: `version` bắt buộc. */
export const standardPriceVersionSchema = priceVersionSchema;
