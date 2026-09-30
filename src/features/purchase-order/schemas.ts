/**
 * Purchase Order — zod schemas.
 *
 * Two layers, never mixed (api-conventions §3.1):
 * - `Be*Dto`  — wire shape the BE returns (PurchaseOrderResponse / POLineResponse …).
 *              Parsed ONCE in `api.ts` right after the response arrives (§3.2).
 * - FE view   — what components consume (`purchaseOrderSchema`), produced by `mappers.ts`.
 * - Input     — what the create form sends (CreatePurchaseOrderRequest).
 *
 * DTO = shape only (no BR). Business rules live in the Input layer, each with a
 * `BR-xx (docs 02 §6)` cite; assumptions not settled by docs are marked
 * `ASSUMPTION (open-question Xn)` (docs/open-questions). Contract: BE Procurement
 * (PurchaseOrderController + DTOs), which narrows docs 02 (SCRUM-113/116).
 */

import { z } from "zod";

import { PO_STATUSES, PROPOSAL_STATUSES } from "@/constants";
import {
  currencySchema,
  intQty,
  isoDate,
  money,
  requiredString,
} from "@/lib/validation/primitives";

/* ── Status enums ────────────────────────────────────────────────────── */

export const poStatusValues = PO_STATUSES;
export const poStatusSchema = z.enum(poStatusValues);
export const proposalStatusValues = PROPOSAL_STATUSES;
export const proposalStatusSchema = z.enum(proposalStatusValues);

/** BE serialises BigDecimal as a JSON number; accept a numeric string too, reject NaN. */
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
  // BE: empty on a list row (PurchaseOrderSearchRepository), filled on detail/mutations.
  lines: z.array(bePoLineSchema),
  createdAt: z.string(),
  createdBy: z.string().nullish(),
  lastModifiedAt: z.string().nullish(),
  lastModifiedBy: z.string().nullish(),
  possibleDuplicate: z.boolean(),
  cancellationReason: z.string().nullish(),
  closeShortReason: z.string().nullish(),
});

/** BE `PageResponse<T>`. */
export function bePageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    size: z.number().int(),
    totalElements: z.number().int(),
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
  totalSpend: beDecimal,
  purchaseOrderCount: z.number().int().min(0),
});

/* ── FE view (output of mappers.ts) ──────────────────────────────────── */

export const poLineSchema = z.object({
  lineId: z.string(),
  poId: z.string(),
  skuId: z.string(),
  description: z.string().optional(),
  orderedQty: z.number().int().positive(),
  receivedQty: z.number().int().min(0),
  /** From BE `openQuantity` — never recomputed on the FE. */
  openQuantity: z.number().int().min(0),
  unitPrice: z.number().min(0),
  currency: currencySchema,
  lineTotal: z.number().min(0),
});

export const purchaseOrderSchema = z.object({
  poId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  // BE PurchaseOrder has no receiving warehouse yet — null until BE adds it (no fake default).
  warehouseId: z.string().nullable(),
  status: poStatusSchema,
  currency: currencySchema,
  /** Calendar date of `createdAt` in Asia/Ho_Chi_Minh (YYYY-MM-DD). */
  orderDate: z.string(),
  expectedDate: z.string(),
  createdBy: z.string(),
  approvedBy: z.string().optional(),
  notes: z.string().optional(),
  /** `cancellationReason` or `closeShortReason` from BE. */
  rejectionReason: z.string().optional(),
  /** BE `totalAmount` = Σ quantityOrdered × unitPrice (no tax/discount on BE yet). */
  grandTotal: z.number(),
  lines: z.array(poLineSchema),
});

/* ── Create PO input — BE CreatePurchaseOrderRequest ─────────────────── */

export const poLineInputSchema = z.object({
  // BR-01 (docs 02 §6): chỉ SKU `Active` — form chỉ cho chọn trong `activeSkus`.
  // ASSUMPTION (open-question C12): BE chưa kiểm SKU tồn tại/Active, chỉ kiểm định dạng mã.
  sku: requiredString("Chọn SKU"),
  description: z.string().nullable().optional(),
  // BE CreatePOLineRequest: `int quantityOrdered` @Positive.
  quantityOrdered: intQty("Số lượng phải là số nguyên > 0"),
  // BE @PositiveOrZero — 0 allowed (promo/free line).
  unitPrice: money("Đơn giá không âm"),
});

export const createPoSchema = z
  .object({
    supplierId: requiredString("Chọn nhà cung cấp"), // UUID validated server-side
    // BR-07 (docs 02 §6): tiền tệ cố định theo NCC, không trộn trong 1 PO — currency chỉ
    // tồn tại ở cấp PO (dòng không có currency riêng); BE cũng chặn line ≠ order currency.
    // ASSUMPTION (open-question A4): FE chỉ hỗ trợ VND / USD / CNY.
    currency: currencySchema,
    // BR-06 (docs 02 §6): ngày giao trong quá khứ chỉ CẢNH BÁO (`isExpectedDatePast`),
    // cố ý không refine chặn ở đây.
    expectedAt: isoDate.nullable(),
    lines: z.array(poLineInputSchema).min(1, "Phải có ít nhất 1 dòng hàng"),
  })
  // ASSUMPTION (chưa có open-question): docs không nói về SKU trùng trong cùng PO và BE cho
  // phép; FE chặn để tránh 2 dòng cùng SKU khó đối chiếu khi nhận hàng (BR-04).
  .refine((po) => new Set(po.lines.map((l) => l.sku)).size === po.lines.length, {
    message: "SKU bị trùng trong PO",
    path: ["lines"],
  });

/* ── Receive goods input — BE ReceiveGoodsRequest ──────────────────────── */

export const receiveGoodsLineInputSchema = z.object({
  lineId: requiredString("Thiếu dòng PO"),
  // BE ReceiveGoodsLineRequest: `int quantity` @Positive. Upper bound (BR-04) needs the
  // line's openQuantity — checked in `validateReceiveDraft` (selectors.ts).
  quantity: intQty("SL nhận phải là số nguyên > 0"),
});

export const receiveGoodsInputSchema = z.object({
  lines: z.array(receiveGoodsLineInputSchema).min(1, "Nhập SL nhận cho ít nhất một dòng"),
});

/* ── Replenishment Proposal ──────────────────────────────────────────── */

export const replenishmentProposalSchema = z.object({
  proposalId: z.string(),
  skuId: z.string(),
  warehouseId: z.string(),
  suggestedQty: z.number().int().positive(),
  reason: z.string(),
  status: proposalStatusSchema,
  createdAt: z.string(),
  reviewedBy: z.string().optional(),
  convertedToPoId: z.string().optional(),
});

/* ── Inferred types ──────────────────────────────────────────────────── */

export type PoStatusValue = z.infer<typeof poStatusSchema>;
export type ProposalStatusValue = z.infer<typeof proposalStatusSchema>;
export type BePoLineDto = z.infer<typeof bePoLineSchema>;
export type BePurchaseOrderDto = z.infer<typeof bePurchaseOrderSchema>;
export type PoStatusCount = z.infer<typeof bePoStatusCountSchema>;
export type SupplierSpendRow = z.infer<typeof beSupplierSpendSchema>;
export type PoLineDto = z.infer<typeof poLineSchema>;
export type PurchaseOrderDto = z.infer<typeof purchaseOrderSchema>;
export type CreatePoInput = z.infer<typeof createPoSchema>;
export type PoLineInput = z.infer<typeof poLineInputSchema>;
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsInputSchema>;
export type ReplenishmentProposalDto = z.infer<typeof replenishmentProposalSchema>;
