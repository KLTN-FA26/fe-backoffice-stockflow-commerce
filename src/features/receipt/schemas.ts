/**
 * Goods receipt — zod schemas, khớp hợp đồng BE PR #62 (GoodsReceiptController, SCRUM-435).
 *
 * Hai lớp (api-conventions §3.1):
 *  - DTO: đúng hình dạng response BE (`GoodsReceiptResponse`, `GoodsReceiptRowResponse`) và
 *    phần PO mà phiếu nhận cần từ `GET /purchase-orders` (xem `receivablePoSchema`).
 *  - Input: dữ liệu form gửi đi + BR refine — ở `input-schemas.ts`.
 */

import { z } from "zod";

import { QC_OUTCOME_API, RECEIPT_API_STATUSES, RECEIPT_QC_PROGRESS_API } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/* ── Enums ───────────────────────────────────────────────────────────── */

export const receiptApiStatusSchema = z.enum(RECEIPT_API_STATUSES);
export const qcProgressSchema = z.enum(RECEIPT_QC_PROGRESS_API);
export const qcOutcomeSchema = z.enum(QC_OUTCOME_API);

/* ── DTO: goods receipt ──────────────────────────────────────────────── */

/** BE `GoodsReceiptResponse.Inspection` — một phần kết luận QC của dòng. */
export const beInspectionSchema = z.object({
  id: z.string(),
  outcome: qcOutcomeSchema,
  quantity: z.number().int().positive(),
  // null với phần ACCEPTED: hàng đạt nằm lại khu QC chờ putaway
  locationCode: z.string().nullish(),
  reason: z.string().nullish(),
  inspectedBy: z.string(),
  inspectedAt: z.string(),
});

/** BE `GoodsReceiptResponse.Line`. `quantityForPutaway` = phần đang chờ cất lên bin. */
export const beReceiptLineSchema = z.object({
  id: z.string(),
  purchaseOrderLineId: z.string(),
  purchaseOrderLineNo: z.number().int().nullish(),
  inventoryItemId: z.string(),
  // BE tra SKU qua inventory.itemPolicy(...).orElse(null) — có thể null
  sku: z.string().nullish(),
  quantity: z.number().int().positive(),
  lotNumber: z.string().nullish(),
  expiryDate: z.string().nullish(),
  locationCode: z.string().nullish(),
  note: z.string().nullish(),
  qcRequired: z.boolean(),
  qcProgress: qcProgressSchema,
  qcLocationCode: z.string().nullish(),
  movedToQcAt: z.string().nullish(),
  quantityForPutaway: z.number().int().min(0),
  inspections: z.array(beInspectionSchema).default([]),
});

/** BE `GoodsReceiptResponse` — một phiếu kèm dòng và kết quả QC. */
export const beGoodsReceiptSchema = z.object({
  id: z.string(),
  number: z.string(),
  purchaseOrderId: z.string(),
  purchaseOrderNumber: z.string().nullish(),
  warehouseId: z.string(),
  status: receiptApiStatusSchema,
  deliveryNote: z.string().nullish(),
  note: z.string().nullish(),
  receivedAt: z.string(),
  receivedBy: z.string().nullish(),
  confirmedAt: z.string().nullish(),
  confirmedBy: z.string().nullish(),
  closedAt: z.string().nullish(),
  lines: z.array(beReceiptLineSchema).default([]),
});

/** BE `GoodsReceiptRowResponse` — một dòng danh sách, không kèm dòng nhận. */
export const beGoodsReceiptRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  purchaseOrderId: z.string(),
  warehouseId: z.string(),
  status: receiptApiStatusSchema,
  deliveryNote: z.string().nullish(),
  receivedAt: z.string(),
  receivedBy: z.string().nullish(),
  confirmedAt: z.string().nullish(),
  closedAt: z.string().nullish(),
});

export const beGoodsReceiptPageSchema = bePageSchema(beGoodsReceiptRowSchema);

/* ── DTO: PO để nhận hàng ────────────────────────────────────────────── */

/**
 * Phần `PurchaseOrderResponse` mà phiếu nhận cần, đọc qua `GET /purchase-orders`.
 * Chỉ giữ field dùng tới — feature này KHÔNG import `features/purchase-order` (import boundary).
 * `lineId` chính là `purchaseOrderLineId` gửi lên `PUT /goods-receipts/{id}/lines`.
 */
export const receivablePoLineSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  description: z.string().nullish(),
  quantityOrdered: z.number().int().positive(),
  quantityReceived: z.number().int().min(0),
  openQuantity: z.number().int().min(0),
});

export const receivablePoSchema = z.object({
  purchaseOrderId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  status: z.string(),
  expectedAt: z.string().nullish(),
  // Dòng danh sách PO trả `lines: []` (BE PurchaseOrderSearchRepository) — chỉ detail có dòng
  lines: z.array(receivablePoLineSchema).default([]),
});

export const receivablePoPageSchema = bePageSchema(receivablePoSchema);
