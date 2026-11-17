/**
 * Hồ sơ hàng tồn — hợp đồng BE `InventoryItemController` (`/inventory/items`): SKU và logistics.
 */

import { z } from "zod";

import { UI_LABELS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/* ── DTO ─────────────────────────────────────────────────────────────── */

/**
 * BE `InventoryItemSummaryResponse` — dòng danh sách. Không còn lớp lưu trữ, cách theo dõi hay chính
 * sách tồn: mọi SKU theo lô, FIFO, không serial, không ngưỡng / cảnh báo tồn (docs 01 BR-17, 06 — bỏ
 * lớp lưu trữ, 20 BR-13).
 */
export const inventoryItemSummaryDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
});

export const inventoryItemPageSchema = bePageSchema(inventoryItemSummaryDtoSchema);

/** BE `InventoryItemResponse.Logistics` — kích thước / khối lượng là `null` khi chưa biết. */
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
  // BE #121 InventoryItemResponse.Logistics.rotatable (docs 01 E13: kiện được xoay 6 hướng khi xếp
  // xe); response cũ chưa có trường → mặc định true như BE ("true when absent")
  rotatable: z.boolean().default(true),
});

/** BE `InventoryItemResponse` — `version` gửi kèm PUT logistics. */
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
  unitOfMeasure: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{1,16}$/, V.uomFormat),
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
