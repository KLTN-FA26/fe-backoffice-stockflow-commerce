/**
 * Bảng giá riêng của khách hàng — BE `CustomerPriceController` (`/api/v1/catalog/customer-prices`),
 * `CustomerPriceRequest` / `CustomerPriceResponse`, domain `CustomerPrice` + `SellingPrice`.
 * Luật nghiệp vụ (kltn-docs 13 BR-02, BR-04, BR-05, BR-06; open-questions D14): giá riêng của khách chỉ đặt cho SKU riêng
 * của chính khách đó; bậc tính theo SỐ THÙNG, đơn giá theo CÁI; giá áp dụng tới khi sửa (KHÔNG có ngày hiệu lực); MOQ =
 * `minQuantity` nhỏ nhất (BE tính); BE tự sắp bậc tăng dần; tiền tệ luôn VND (không có trong DTO). Từ 2026-11-26 SKU
 * không có giá riêng thì báo giá lấy giá chuẩn của quy cách (`features/standard-price`).
 *
 * Bậc giá (DTO + Input) dùng chung với giá chuẩn: `lib/pricing/price-tiers.ts`.
 */

import { z } from "zod";

import { CUSTOMER_PRICE_LIMITS as L } from "@/constants";
import {
  bePriceTierSchema,
  priceTierValuesSchema,
  priceVersionSchema,
} from "@/lib/pricing/price-tiers";
import { omittedOrNull } from "@/lib/validation/primitives";

import type { PriceTier, PriceTierValues, ValidPriceTierValues } from "@/lib/pricing/price-tiers";

/* ── DTO (BE → FE) ───────────────────────────────────────────────────── */

export type CustomerPriceTier = PriceTier;

/**
 * `measure` — bậc đếm gì: `CARTON` = SKU riêng của khách, bậc theo số thùng (13 BR-05); `UNIT` = giá cũ đặt
 * trên biến thể kho trước đây, bậc theo số cái — BE chỉ cho đọc và xoá, PUT luôn 409 CUSTOMER_SKU_REQUIRED.
 */
export const PRICE_MEASURES = ["CARTON", "UNIT"] as const;
export type PriceMeasure = (typeof PRICE_MEASURES)[number];

/**
 * BE `CustomerPriceResponse`. Không có id, tên sản phẩm, tiền tệ, ngày hiệu lực hay loại khách.
 * `customerId` là id mờ (BE thật: UUID). Jackson `non_null` bỏ `note` khi trống.
 */
export const beCustomerPriceSchema = z.object({
  customerId: z.string().min(1),
  sku: z.string().min(1),
  measure: z.enum(PRICE_MEASURES),
  moq: z.number().int().min(L.minQuantityMin),
  tiers: z.array(bePriceTierSchema).min(1),
  note: omittedOrNull(z.string()),
  version: z.number().int().min(0),
});
export type CustomerPrice = z.infer<typeof beCustomerPriceSchema>;

/* ── Input (FE → BE) ─────────────────────────────────────────────────── */

/** Giá trị một bảng giá (tạo hoặc thay) — luật bậc giá chung (`priceTierValuesSchema`). */
export const customerPriceValuesSchema = priceTierValuesSchema;
export type CustomerPriceValues = PriceTierValues;
export type ValidCustomerPriceValues = ValidPriceTierValues;

/** BE PUT: `version` bắt buộc (`@PositiveOrZero Long`, thiếu → 400). */
export const customerPriceVersionSchema = priceVersionSchema;
