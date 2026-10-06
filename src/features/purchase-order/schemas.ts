/**
 * Purchase Order — zod schemas.
 *
 * Hai lớp, không trộn (api-conventions §3.1):
 * - `be*Schema` — hình dạng BE trả về (PurchaseOrderResponse, DeliveryAttemptResponse…), parse
 *   MỘT lần trong `api.ts` (§3.2); chỉ kiểm hình dạng, không chứa BR.
 * - FE view (`purchaseOrderSchema`) — thứ component dùng, do `mappers.ts` tạo ra.
 * Input schema (form gửi đi, có BR + cite docs) nằm ở `input-schemas.ts`.
 */

import { z } from "zod";

import {
  PO_CANCELLATION_DELIVERY_STATUS,
  PO_CANCELLATION_DELIVERY_STATUSES,
  PO_DELIVERY_ATTEMPT_STATUSES,
  PO_DELIVERY_STATUS,
  PO_DELIVERY_STATUSES,
  PO_STATUSES,
  SUPPLIER_CONFIRMATION_STATUSES,
} from "@/constants";

import type { PoDeliveryStatus, SupplierConfirmationStatus } from "@/constants";

export * from "./input-schemas";

/* ── Status enums ────────────────────────────────────────────────────── */

export const poStatusSchema = z.enum(PO_STATUSES);

export { PO_DELIVERY_STATUSES, SUPPLIER_CONFIRMATION_STATUSES }; // nguồn: constants/statuses.ts

const confirmationStatusSchema = z.enum(SUPPLIER_CONFIRMATION_STATUSES);
// Giá trị BE mới chưa biết → UNKNOWN thay vì làm hỏng cả trang (BE ghi rõ danh sách có thể mở rộng).
const deliveryStatusSchema = z.enum(PO_DELIVERY_STATUSES).catch(PO_DELIVERY_STATUS.UNKNOWN);

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/* ── BE wire DTOs ────────────────────────────────────────────────────── */

export const bePoLineSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  description: z.string().nullish(),
  quantityOrdered: z.number().int().positive(),
  quantityReceived: z.number().int().min(0),
  openQuantity: z.number().int().min(0),
  unitPrice: beDecimal,
});

export const bePurchaseOrderSchema = z.object({
  purchaseOrderId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  status: poStatusSchema,
  currency: z.string(),
  totalAmount: beDecimal,
  expectedAt: z.string().nullish(),
  // BE: rỗng ở list row (PurchaseOrderSearchRepository), đầy đủ ở detail/mutation.
  lines: z.array(bePoLineSchema),
  createdAt: z.string(),
  createdBy: z.string().nullish(),
  lastModifiedAt: z.string().nullish(),
  lastModifiedBy: z.string().nullish(),
  possibleDuplicate: z.boolean(),
  cancellationReason: z.string().nullish(),
  closeShortReason: z.string().nullish(),
  paymentTermDays: z.number().int().min(0),
  leadTimeDays: z.number().int().min(0),
  sentAt: z.string().nullish(),
  supplierConfirmationStatus: confirmationStatusSchema,
  supplierRespondedAt: z.string().nullish(),
  supplierReference: z.string().nullish(),
  supplierResponseNote: z.string().nullish(),
  deliveryStatus: deliveryStatusSchema,
  // BE #36 (9fbb90f). Optional: BE chưa có #36 không trả field; giá trị lạ → UNKNOWN.
  cancellationDeliveryStatus: z
    .enum(PO_CANCELLATION_DELIVERY_STATUSES)
    .optional()
    .catch(PO_CANCELLATION_DELIVERY_STATUS.UNKNOWN),
  warnings: z.array(z.string()).default([]), // vd DELIVERY_DATE_IN_PAST — BR-06 (docs 02 §6)
});

/** BE `PageResponse<T>` (trang từ 0). */
export function bePageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(0),
    size: z.number().int().positive(),
    totalElements: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  });
}

export const bePoStatusCountSchema = z.object({
  status: poStatusSchema,
  count: z.number().int().min(0),
});

export const beSupplierSpendSchema = z.object({
  supplierId: z.string(),
  supplierCode: z.string(),
  supplierName: z.string(),
  // BE #40: một dòng / cặp NCC + tiền tệ. Nhánh `test` cũ chưa có field → optional.
  currency: z.string().optional(),
  totalSpend: beDecimal,
  purchaseOrderCount: z.number().int().min(0),
});

/** BE `DeliveryAttemptResponse` — status thô của notification. */
export const beDeliveryAttemptSchema = z.object({
  id: z.string(),
  channel: z.string(),
  // BE notification `DeliveryStatus` PENDING | SENT | FAILED — enum để so sánh không gõ sai.
  status: z.enum(PO_DELIVERY_ATTEMPT_STATUSES),
  attemptedAt: z.string(),
  sentAt: z.string().nullish(),
  failure: z.string().nullish(),
  generation: z.number().int(),
  recipient: z.string().nullish(),
  // BE #36 (9fbb90f): purchase-order.sent | purchase-order.cancelled
  templateCode: z.string().nullish(),
});

/** BE `PurchaseOrderDeliveryDecisionResponse` — ai cho phép gửi / khôi phục, vì sao. */
export const beDeliveryDecisionSchema = z.object({
  id: z.string(),
  // BE đếm từ 0: 0 = gửi lần đầu, ≥ 1 = khôi phục gửi (xem `isFirstDelivery` trong selectors.ts)
  generation: z.number().int(),
  previousExpectedAt: z.string().nullish(),
  expectedAt: z.string().nullish(),
  reason: z.string().nullish(),
  reconciled: z.boolean(),
  acknowledgePastDue: z.boolean(),
  channel: z.string(),
  recipient: z.string().nullish(),
  actor: z.string().nullish(),
  requestedAt: z.string(),
});

/* ── FE view (output of mappers.ts) ──────────────────────────────────── */

export const poLineSchema = z.object({
  lineId: z.string(),
  poId: z.string(),
  skuId: z.string(),
  description: z.string().optional(),
  orderedQty: z.number().int().positive(),
  receivedQty: z.number().int().min(0),
  /** BE `openQuantity` — không tự tính lại ở FE. */
  openQuantity: z.number().int().min(0),
  unitPrice: z.number().min(0),
  /** Mã ISO đúng như BE trả (PO có thể là EUR) — không ép về VND. */
  currency: z.string(),
  lineTotal: z.number().min(0),
});

export const purchaseOrderSchema = z.object({
  poId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  status: poStatusSchema,
  currency: z.string(),
  /** Ngày của `createdAt` theo Asia/Ho_Chi_Minh (YYYY-MM-DD). */
  orderDate: z.string(),
  expectedDate: z.string(),
  createdBy: z.string(),
  /** `cancellationReason` hoặc `closeShortReason` của BE. */
  rejectionReason: z.string().optional(),
  /** BE `totalAmount` = Σ SL đặt × đơn giá (BE chưa có thuế/chiết khấu). */
  grandTotal: z.number(),
  paymentTermDays: z.number().int(),
  leadTimeDays: z.number().int(),
  sentAt: z.string().optional(),
  supplierConfirmationStatus: confirmationStatusSchema,
  supplierRespondedAt: z.string().optional(),
  supplierReference: z.string().optional(),
  supplierResponseNote: z.string().optional(),
  deliveryStatus: z.enum(PO_DELIVERY_STATUSES),
  cancellationDeliveryStatus: z.enum(PO_CANCELLATION_DELIVERY_STATUSES).optional(),
  warnings: z.array(z.string()),
  lines: z.array(poLineSchema),
});

/* ── Inferred types ──────────────────────────────────────────────────── */

export type PoStatusValue = z.infer<typeof poStatusSchema>;
export type { PoDeliveryStatus, SupplierConfirmationStatus };
export type BePoLineDto = z.infer<typeof bePoLineSchema>;
export type BePurchaseOrderDto = z.infer<typeof bePurchaseOrderSchema>;
export type PoStatusCount = z.infer<typeof bePoStatusCountSchema>;
export type SupplierSpendRow = z.infer<typeof beSupplierSpendSchema>;
export type DeliveryAttempt = z.infer<typeof beDeliveryAttemptSchema>;
export type DeliveryDecision = z.infer<typeof beDeliveryDecisionSchema>;
export type PoLineDto = z.infer<typeof poLineSchema>;
export type PurchaseOrderDto = z.infer<typeof purchaseOrderSchema>;
