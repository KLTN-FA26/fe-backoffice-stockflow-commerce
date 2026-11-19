/**
 * Trả hàng — DTO của BE (order module: `ReturnRequestController`, `ReturnResolutionController`; procurement:
 * `ReturnReceiptController`). Jackson `non_null` bỏ trường chưa đặt → `.nullish()`; tiền là `BigDecimal` → number.
 * Schema nhập liệu: `input-schemas.ts`. Docs 17 §4.10, 03 §4.2, 15 §4.5.
 */

import { z } from "zod";

import {
  RETURN_API_STATUSES,
  RETURN_CHANNELS,
  RETURN_REASONS,
  RETURN_RECEIPT_API_STATUSES,
} from "@/constants/returns";
import { bePageSchema } from "@/lib/api/page-schema";

const status = z.enum(RETURN_API_STATUSES);
const reason = z.enum(RETURN_REASONS);

/* ── Yêu cầu trả hàng: bản của back-office (BE `ReturnRequestResponse`) ─────────────────── */

export const returnLineDtoSchema = z.object({
  id: z.string(),
  orderLineId: z.string(),
  sku: z.string(),
  customPrinted: z.boolean(),
  unitPrice: z.number(),
  requestedQuantity: z.number().int(),
  approvedQuantity: z.number().int().nullish(),
  receivedQuantity: z.number().int().nullish(),
  refundQuantity: z.number().int(),
  refundAmount: z.number().nullish(),
});

export const returnEvidenceDtoSchema = z.object({
  id: z.string(),
  stage: z.string(),
  originalName: z.string().nullish(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().nullish(),
  uploadedBy: z.string().nullish(),
  uploadedAt: z.string(),
  /** Link ảnh nhỏ có hạn ngắn, chỉ có ở chi tiết. */
  thumbnailUrl: z.string().nullish(),
});

export const returnReviewDtoSchema = z.object({
  decidedBy: z.string().nullish(),
  decidedAt: z.string().nullish(),
  note: z.string().nullish(),
  rejectionReason: z.string().nullish(),
  returnRequired: z.boolean().nullish(),
  returnDeadline: z.string().nullish(),
});

export const returnReceiptRefDtoSchema = z.object({
  receivedBy: z.string().nullish(),
  receivedAt: z.string().nullish(),
  locationCode: z.string().nullish(),
  goodsReceiptId: z.string().nullish(),
});

/** Hoàn tiền: `settlementAmount` = `offsetAmount` (cấn trừ đợt còn nợ) + `refundedAmount` (đã trả, phải chuyển lại). */
export const returnResolutionDtoSchema = z.object({
  moneyMode: z.string().nullish(),
  settlementAmount: z.number().nullish(),
  proposedBy: z.string().nullish(),
  proposedAt: z.string().nullish(),
  note: z.string().nullish(),
  settledBy: z.string().nullish(),
  settledAt: z.string().nullish(),
  offsetAmount: z.number().nullish(),
  refundedAmount: z.number().nullish(),
  vatAdjustmentRequired: z.boolean().nullish(),
});

export const returnDiscrepancyDtoSchema = z.object({
  id: z.string(),
  lineId: z.string().nullish(),
  kind: z.string(),
  sku: z.string().nullish(),
  quantity: z.number().int(),
  note: z.string().nullish(),
  recordedAt: z.string().nullish(),
});

export const returnHistoryDtoSchema = z.object({
  from: z.string().nullish(),
  to: z.string(),
  reason: z.string().nullish(),
  actorId: z.string().nullish(),
  occurredAt: z.string(),
});

export const returnRequestDtoSchema = z.object({
  id: z.string(),
  rmaNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  /** Lô giao đã giao mà hàng trả thuộc về (WF-05 TH-1); null với đơn giao không qua lô. */
  shipmentId: z.string().nullish(),
  status,
  reasonCode: reason,
  description: z.string().nullish(),
  requestedResolution: z.string().nullish(),
  channel: z.enum(RETURN_CHANNELS),
  requestedBy: z.string().nullish(),
  requestedAt: z.string(),
  lateClaimReason: z.string().nullish(),
  currency: z.string(),
  review: returnReviewDtoSchema.nullish(),
  receipt: returnReceiptRefDtoSchema.nullish(),
  resolution: returnResolutionDtoSchema.nullish(),
  cancelledBy: z.string().nullish(),
  cancellationReason: z.string().nullish(),
  closedAt: z.string().nullish(),
  lines: z.array(returnLineDtoSchema),
  evidence: z.array(returnEvidenceDtoSchema).nullish(),
  discrepancies: z.array(returnDiscrepancyDtoSchema).nullish(),
  history: z.array(returnHistoryDtoSchema).nullish(),
  version: z.number().int(),
});

/** Một dòng của hàng đợi (BE `ReturnRequestRowResponse`). */
export const returnRowDtoSchema = z.object({
  id: z.string(),
  rmaNumber: z.string(),
  orderId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  shipmentId: z.string().nullish(),
  status,
  reasonCode: reason,
  requestedResolution: z.string().nullish(),
  channel: z.enum(RETURN_CHANNELS),
  requestedAt: z.string(),
  returnDeadline: z.string().nullish(),
  settlementAmount: z.number().nullish(),
  refundedAmount: z.number().nullish(),
  offsetAmount: z.number().nullish(),
  currency: z.string(),
  vatAdjustmentRequired: z.boolean(),
  closedAt: z.string().nullish(),
  version: z.number().int(),
});
export const returnPageDtoSchema = bePageSchema(returnRowDtoSchema);

export const evidenceLinkDtoSchema = z.object({ url: z.string() });

/* ── Phiếu nhập hàng hoàn (BE `ReturnReceiptService.ReturnReceiptView` / `ReturnReceiptRow`) ── */

const receiptStatus = z.enum(RETURN_RECEIPT_API_STATUSES);

export const returnReceiptCartonDtoSchema = z.object({
  lpn: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  condition: z.string().nullish(),
  scannedBy: z.string().nullish(),
  scannedAt: z.string().nullish(),
});

export const expectedCartonDtoSchema = z.object({
  lpn: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int(),
  scanned: z.boolean(),
});

export const returnReceiptDtoSchema = z.object({
  id: z.string(),
  number: z.string(),
  receiptType: z.string().nullish(),
  status: receiptStatus,
  warehouseId: z.string(),
  orderId: z.string().nullish(),
  orderNumber: z.string().nullish(),
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  returnRequestId: z.string().nullish(),
  rmaNumber: z.string().nullish(),
  quarantineLocationId: z.string().nullish(),
  quarantineLocationCode: z.string().nullish(),
  note: z.string().nullish(),
  receivedAt: z.string().nullish(),
  receivedBy: z.string().nullish(),
  confirmedAt: z.string().nullish(),
  confirmedBy: z.string().nullish(),
  closedAt: z.string().nullish(),
  cartons: z.array(returnReceiptCartonDtoSchema),
  expectedCartons: z.array(expectedCartonDtoSchema),
  version: z.number().int(),
});

export const returnReceiptRowDtoSchema = z.object({
  id: z.string(),
  number: z.string(),
  receiptType: z.string().nullish(),
  status: receiptStatus,
  warehouseId: z.string(),
  orderId: z.string().nullish(),
  shipmentId: z.string().nullish(),
  returnRequestId: z.string().nullish(),
  receivedAt: z.string().nullish(),
  receivedBy: z.string().nullish(),
  closedAt: z.string().nullish(),
  cartonCount: z.number().int(),
});
export const returnReceiptPageDtoSchema = bePageSchema(returnReceiptRowDtoSchema);

/** Chuyến hãng hoàn về — chỉ những trường màn lập phiếu cần (BE `ShipmentRowResponse`, `status=RETURNED`). */
export const returnedShipmentDtoSchema = z
  .object({
    shipmentId: z.string(),
    code: z.string().nullish(),
    orderId: z.string(),
    orderNumber: z.string().nullish(),
    warehouseId: z.string(),
    status: z.string(),
    packageCount: z.number().int(),
  })
  .loose();
export const returnedShipmentPageDtoSchema = bePageSchema(returnedShipmentDtoSchema);
