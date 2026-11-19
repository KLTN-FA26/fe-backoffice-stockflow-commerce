/**
 * Goods receipt — zod schemas, khớp `GoodsReceiptResponse` / `GoodsReceiptRowResponse` của BE sau 4A-5 / 4A-9:
 * phiếu nhập theo Đơn sản xuất (`receiptType = PRODUCTION`), phiếu mua hàng cũ (`PURCHASE`) chỉ còn để đọc.
 * BE đã bỏ QC ở kho (docs 03 BR-07), duyệt vượt dung sai (BR-02) và phiếu không chứng từ (03 §1) — các field đó
 * không còn trên wire.
 *
 * Hai lớp (api-conventions §3.1): file này là DTO; Input của màn nhập theo Đơn sản xuất sẽ thêm ở SCRUM-566.
 */

import { z } from "zod";

import { RECEIPT_API_STATUSES, RECEIPT_TYPE_API } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { beReceiptPackageSchema, beReceiptUnitSchema } from "./carton-schemas";

/* ── Enums ───────────────────────────────────────────────────────────── */

export const receiptApiStatusSchema = z.enum(RECEIPT_API_STATUSES);
export const receiptTypeSchema = z.enum(RECEIPT_TYPE_API);

/* ── DTO: goods receipt ──────────────────────────────────────────────── */

/**
 * BE `GoodsReceiptResponse.ProductionLineProgress` (4A-5, docs 03 §4.1 bước 3): dòng của Đơn sản xuất tính theo
 * thùng và theo cái. `remaining*` của phiếu nháp = đặt − đã nhận − phiếu này.
 */
export const beProductionLineProgressSchema = z.object({
  unitsPerCarton: z.number().int().positive(),
  orderedCartons: z.number().int().min(0),
  receivedCartons: z.number().int().min(0),
  thisReceiptCartons: z.number().int().min(0),
  remainingCartons: z.number().int(),
  orderedUnits: z.number().int().min(0),
  receivedUnits: z.number().int().min(0),
  thisReceiptUnits: z.number().int().min(0),
  remainingUnits: z.number().int(),
});

/** BE `GoodsReceiptResponse.Line`. `quantityForPutaway` = phần đang chờ cất lên bin. */
export const beReceiptLineSchema = z.object({
  id: z.string(),
  inventoryItemId: z.string(),
  // BE tra SKU qua inventory.itemPolicy(...).orElse(null) — có thể null
  sku: z.string().nullish(),
  quantity: z.number().int().min(0),
  lotNumber: z.string().nullish(),
  locationCode: z.string().nullish(),
  note: z.string().nullish(),
  quantityForPutaway: z.number().int().min(0),
  warnings: z.array(z.string()).default([]),
  // SCRUM-473: đơn vị đóng gói của các thùng (null = dòng lẻ cũ); phần không vào thùng nào
  unitOfMeasure: z.string().nullish(),
  looseQuantity: z.number().int().min(0),
  packages: z.array(beReceiptPackageSchema).default([]),
  units: z.array(beReceiptUnitSchema).default([]),
  // 4A-5: null trên phiếu mua hàng cũ
  productionOrderLineId: z.string().nullish(),
  production: beProductionLineProgressSchema.nullish(),
});

/** BE `GoodsReceiptResponse` — một phiếu kèm dòng. */
export const beGoodsReceiptSchema = z.object({
  id: z.string(),
  number: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string().nullish(),
  warehouseName: z.string().nullish(),
  status: receiptApiStatusSchema,
  deliveryNote: z.string().nullish(),
  note: z.string().nullish(),
  receivedAt: z.string(),
  receivedBy: z.string().nullish(),
  receivedByName: z.string().nullish(),
  confirmedAt: z.string().nullish(),
  confirmedBy: z.string().nullish(),
  confirmedByName: z.string().nullish(),
  closedAt: z.string().nullish(),
  lines: z.array(beReceiptLineSchema).default([]),
  warnings: z.array(z.string()).default([]),
  receiptType: receiptTypeSchema,
  // 4A-5: null trên phiếu mua hàng cũ
  productionOrderId: z.string().nullish(),
  productionOrderCode: z.string().nullish(),
  productionOrderStatus: z.string().nullish(),
  producerId: z.string().nullish(),
  producerName: z.string().nullish(),
});

/** BE `GoodsReceiptRowResponse` — một dòng danh sách, không kèm dòng nhận. */
export const beGoodsReceiptRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  warehouseId: z.string(),
  warehouseCode: z.string().nullish(),
  warehouseName: z.string().nullish(),
  status: receiptApiStatusSchema,
  deliveryNote: z.string().nullish(),
  receivedAt: z.string(),
  receivedBy: z.string().nullish(),
  receivedByName: z.string().nullish(),
  confirmedAt: z.string().nullish(),
  confirmedBy: z.string().nullish(),
  confirmedByName: z.string().nullish(),
  closedAt: z.string().nullish(),
  receiptType: receiptTypeSchema,
  productionOrderId: z.string().nullish(),
  productionOrderCode: z.string().nullish(),
  producerName: z.string().nullish(),
});

export const beGoodsReceiptPageSchema = bePageSchema(beGoodsReceiptRowSchema);
