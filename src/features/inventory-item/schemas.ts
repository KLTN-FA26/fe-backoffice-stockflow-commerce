/**
 * Hồ sơ hàng tồn — hợp đồng BE `InventoryItemController` (`/inventory/items`). Hồ sơ chỉ còn logistics:
 * không chính sách tồn để cấu hình — mọi SKU theo dõi theo lô, không serial, xuất FIFO, không hạn dùng
 * (kltn-docs 01 §3 "Chính sách tồn", BR-17; BE team plan 5-5), không điều kiện lưu kho / cờ QC / ký nhận.
 */

import { z } from "zod";

import { UI_LABELS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/* ── DTO ─────────────────────────────────────────────────────────────── */

/** BE `InventoryItemSummaryResponse` — dòng danh sách. */
export const inventoryItemSummaryDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
});

export const inventoryItemPageSchema = bePageSchema(inventoryItemSummaryDtoSchema);

/** BE `InventoryItemResponse.Logistics` — kích thước / khối lượng là `null` (vắng) khi chưa biết. */
export const itemLogisticsDtoSchema = z.object({
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
  weightKg: beDecimal.nullish(),
  lengthCm: beDecimal.nullish(),
  widthCm: beDecimal.nullish(),
  heightCm: beDecimal.nullish(),
  packageWeightKg: beDecimal.nullish(),
  packageLengthCm: beDecimal.nullish(),
  packageWidthCm: beDecimal.nullish(),
  packageHeightCm: beDecimal.nullish(),
  packageCount: z.number().int(),
  packSize: z.number().int(),
  // Kiện được xoay 6 hướng khi xếp xe (docs 01 E13), thùng xoay ngang cho vừa bin (06 BR-01)
  rotatable: z.boolean().default(true),
});

/** BE `InventoryItemResponse` — `version` gửi lại khi PUT logistics. */
export const inventoryItemDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  version: z.number().int(),
  logistics: itemLogisticsDtoSchema,
});

/* ── Input ───────────────────────────────────────────────────────────── */

const V = UI_LABELS.inventoryItem.validation;

const optionalPositive = z
  .string()
  .trim()
  .refine((v) => v === "" || Number(v) > 0, V.mustBePositive);
const optionalCount = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1), V.integerAtLeast1);

/** Form logistics — chuỗi người dùng gõ; chuyển sang `UpdateItemLogisticsRequest` khi gửi. */
export const logisticsFormSchema = z.object({
  // BE `UpdateItemLogisticsRequest.unitOfMeasure` @Pattern
  unitOfMeasure: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{1,16}$/, V.uomFormat),
  // BE @Size(min = 1, max = 64); trống → gửi null
  barcode: z.string().trim().max(64, V.barcodeMax),
  weightKg: optionalPositive,
  lengthCm: optionalPositive,
  widthCm: optionalPositive,
  heightCm: optionalPositive,
  packageWeightKg: optionalPositive,
  packageLengthCm: optionalPositive,
  packageWidthCm: optionalPositive,
  packageHeightCm: optionalPositive,
  packageCount: optionalCount,
  packSize: optionalCount,
  rotatable: z.boolean(),
});
