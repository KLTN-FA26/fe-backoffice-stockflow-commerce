/**
 * Hồ sơ hàng tồn — hợp đồng BE `InventoryItemController` (`/inventory/items`). Hồ sơ chỉ còn logistics:
 * không chính sách tồn để cấu hình — mọi SKU theo dõi theo lô, không serial, xuất FIFO, không hạn dùng
 * (kltn-docs 01 §3 "Chính sách tồn", BR-17; BE team plan 5-5), không điều kiện lưu kho / cờ QC / ký nhận.
 */

import { z } from "zod";

import { UI_LABELS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/* ── DTO ─────────────────────────────────────────────────────────────── */

/** BE `InventoryItemSummaryResponse` — dòng danh sách. */
export const inventoryItemSummaryDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
});

export const inventoryItemPageSchema = bePageSchema(inventoryItemSummaryDtoSchema);

/**
 * BE `InventoryItemResponse.Logistics`. Hồ sơ không còn số đo riêng (BE #396, V20261215000100; docs 01 §3, BR-03,
 * C21 chốt 2026-11-22): kích thước và khối lượng là của thùng, nằm ở quy cách thùng (đơn vị quy đổi).
 * Không `.strict()` — BE cũ còn trả 10 trường số đo thì zod bỏ qua, một bản FE chạy với cả hai bản BE.
 */
export const itemLogisticsDtoSchema = z.object({
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
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

/** Form logistics — chuỗi người dùng gõ; chuyển sang `UpdateItemLogisticsRequest` khi gửi. */
export const logisticsFormSchema = z.object({
  // BE `UpdateItemLogisticsRequest.unitOfMeasure` @Pattern
  unitOfMeasure: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{1,16}$/, V.uomFormat),
  // BE @Size(min = 1, max = 64); trống → gửi null
  barcode: z.string().trim().max(64, V.barcodeMax),
  rotatable: z.boolean(),
});
