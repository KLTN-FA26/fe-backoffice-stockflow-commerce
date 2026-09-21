/**
 * Purchase Order — zod schemas.
 *
 * Contract: BE Procurement (CreatePurchaseOrderRequest / PurchaseOrderResponse).
 * BR cites: BE ProcurementServiceImpl + PurchaseOrder aggregate (supply via BE javadoc,
 * not docs/warehouse — BE is narrower scope per SCRUM-113/116).
 */

import { z } from "zod";

import { PO_STATUSES, PROPOSAL_STATUSES } from "@/constants";

/* ── Status enums ────────────────────────────────────────────────────── */

export const poStatusValues = PO_STATUSES;
export const poStatusSchema = z.enum(poStatusValues);
export const proposalStatusValues = PROPOSAL_STATUSES;
export const proposalStatusSchema = z.enum(proposalStatusValues);

/* ── PO Line schema (FE view — mapped from BE BePOLine) ─────────────── */

export const poLineSchema = z.object({
  lineId: z.string(),
  poId: z.string(),
  skuId: z.string(),
  orderedQty: z.number().int().positive("Số lượng phải > 0"),
  receivedQty: z.number().int().min(0),
  unitPrice: z.number().min(0, "Đơn giá không âm"),
  currency: z.enum(["VND", "USD", "CNY"]),
  taxRate: z.number().min(0).max(1, "Thuế suất 0–100%"),
  discountRate: z.number().min(0).max(1, "Chiết khấu 0–100%"),
  uom: z.enum(["pcs", "box", "kg", "m", "ream", "set"]),
  lineTotal: z.number().min(0),
});

/* ── BE response line (wire — BE POLineResponse) ─────────────────────── */

export const bePoLineSchema = z.object({
  lineId: z.string(),
  sku: z.string(),
  description: z.string().nullable().optional(),
  quantityOrdered: z.number().int().positive(),
  quantityReceived: z.number().int().min(0),
  openQuantity: z.number().int().min(0),
  unitPrice: z.union([z.number(), z.string()]),
});

/* ── PO response DTO — BE PurchaseOrderResponse ──────────────────────── */

export const purchaseOrderSchema = z.object({
  poId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  warehouseId: z.string(),
  status: poStatusSchema,
  currency: z.enum(["VND", "USD", "CNY"]),
  orderDate: z.string(),
  expectedDate: z.string(),
  createdBy: z.string(),
  approvedBy: z.string().optional(),
  approvalNote: z.string().optional(),
  rejectionReason: z.string().optional(),
  subtotal: z.number(),
  taxTotal: z.number(),
  grandTotal: z.number(),
  lines: z.array(poLineSchema),
  fromProposalId: z.string().optional(),
  revisionOf: z.string().optional(),
  notes: z.string().optional(),
  // BE-only, surfaced on create response
  possibleDuplicate: z.boolean().optional(),
  cancellationReason: z.string().nullable().optional(),
  closeShortReason: z.string().nullable().optional(),
});

export const bePurchaseOrderSchema = z.object({
  purchaseOrderId: z.string(),
  poNumber: z.string(),
  supplierId: z.string(),
  status: poStatusSchema,
  currency: z.string(),
  totalAmount: z.union([z.number(), z.string()]),
  expectedAt: z.string().nullable(),
  lines: z.array(bePoLineSchema),
  createdAt: z.string(),
  createdBy: z.string(),
  lastModifiedAt: z.string(),
  lastModifiedBy: z.string(),
  possibleDuplicate: z.boolean(),
  cancellationReason: z.string().nullable().optional(),
  closeShortReason: z.string().nullable().optional(),
});

/* ── Create PO input — BE CreatePurchaseOrderRequest ───────────────────
 * BE: {supplierId:UUID NotNull, currency:[A-Z]{3}, expectedAt:LocalDate,
 *      lines:[{sku:NotBlank, description, quantityOrdered:Positive, unitPrice:PositiveOrZero}]}
 */

export const poLineInputSchema = z.object({
  sku: z.string().min(1, "Nhập SKU"),
  description: z.string().nullable().optional(),
  quantityOrdered: z.number().int().positive("Số lượng phải > 0"),
  unitPrice: z.number().min(0, "Đơn giá không âm"),
});

export const createPoSchema = z.object({
  supplierId: z.string().min(1, "Chọn nhà cung cấp"), // validated UUID server-side
  currency: z.string().regex(/^[A-Z]{3}$/, "Mã tiền tệ 3 ký tự in hoa"),
  // BE field is expectedAt (LocalDate, nullable); FE keeps expectedDate alias for compat
  expectedAt: z.string().nullable().optional(),
  expectedDate: z.string().optional(),
  lines: z
    .array(poLineInputSchema)
    // BE rejects via @NotEmpty; keep FE guard too
    .min(1, "Phải có ít nhất 1 dòng hàng"),
  // FE-only aliases (not sent to BE — stripped by toBeCreateBody)
  warehouseId: z.string().optional(),
  notes: z.string().optional(),
  fromProposalId: z.string().optional(),
});

/* ── Transition input — per-action (BE has no generic targetStatus) ─── */

export const transitionPoSchema = z.object({
  id: z.string(),
  action: z.enum(["approve", "send", "cancel", "closeShort"]),
  reason: z.string().optional(),
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
export type PoLineDto = z.infer<typeof poLineSchema>;
export type BePoLineDto = z.infer<typeof bePoLineSchema>;
export type PurchaseOrderDto = z.infer<typeof purchaseOrderSchema>;
export type BePurchaseOrderDto = z.infer<typeof bePurchaseOrderSchema>;
export type CreatePoInput = z.infer<typeof createPoSchema>;
export type PoLineInput = z.infer<typeof poLineInputSchema>;
export type TransitionPoInput = z.infer<typeof transitionPoSchema>;
export type ReplenishmentProposalDto = z.infer<typeof replenishmentProposalSchema>;
