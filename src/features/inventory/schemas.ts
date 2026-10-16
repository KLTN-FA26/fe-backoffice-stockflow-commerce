import { z } from "zod";

import {
  INVENTORY_LIMITS,
  INVENTORY_MESSAGES,
  STOCK_ADJUSTMENT_REASON,
  STOCK_ADJUSTMENT_REASONS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUSES } from "@/constants/statuses";

import { requiredString } from "@/lib/validation/primitives";

// Source: backend develop 0f18f24 StockAdjustmentResponse; nullable fields
// may be omitted by the backend Jackson NON_NULL policy. `reason` and `status`
// are Strings on the wire: read them open so a newer code does not invalidate
// the response. Write-side enums stay strict in adjustmentCreateInput/list input.
export const stockAdjustmentDto = z.object({
  adjustmentId: z.uuid(),
  number: z.string(),
  locationCode: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantityDelta: z.number().int(),
  reason: z.string(),
  note: z.string().nullish(),
  status: z.string(),
  requestedBy: z.uuid(),
  requestedAt: z.iso.datetime(),
  decidedBy: z.uuid().nullish(),
  decidedAt: z.iso.datetime().nullish(),
  rejectionReason: z.string().nullish(),
  postedAt: z.iso.datetime().nullish(),
  withdrawnAt: z.iso.datetime().nullish(),
  version: z.number().int().nonnegative(),
});

// Source: backend develop 0f18f24 StockMovementResponse. `type`, `status`,
// `toStatus` and `referenceType` are Strings; keep them open so one newer code
// does not invalidate the whole ledger page. status/toStatus may be null/omitted.
export const stockMovementDto = z.object({
  movementId: z.uuid(),
  type: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  fromLocation: z.string().nullish(),
  toLocation: z.string().nullish(),
  quantity: z.number().int().positive(),
  status: z.string().nullish(),
  toStatus: z.string().nullish(),
  referenceType: z.string(),
  referenceId: z.uuid().nullish(),
  reason: z.string().nullish(),
  actorId: z.uuid().nullish(),
  occurredAt: z.iso.datetime(),
});

export const adjustmentCreateInput = z
  .object({
    locationCode: requiredString(INVENTORY_MESSAGES.required).max(INVENTORY_LIMITS.locationLength),
    sku: requiredString(INVENTORY_MESSAGES.required)
      .min(INVENTORY_LIMITS.skuMinLength)
      .max(INVENTORY_LIMITS.skuMaxLength)
      .regex(/^[A-Za-z0-9-]+$/, INVENTORY_MESSAGES.invalidSku),
    lotNumber: z.string().trim().max(INVENTORY_LIMITS.lotLength).optional(),
    quantityDelta: z
      .number()
      .int()
      .min(-INVENTORY_LIMITS.delta)
      .max(INVENTORY_LIMITS.delta)
      // StockAdjustment constructor (SCRUM-424): every adjustment changes quantity.
      .refine((delta) => delta !== 0, INVENTORY_MESSAGES.nonzeroDelta),
    reason: z.enum(STOCK_ADJUSTMENT_REASONS),
    note: z.string().trim().max(INVENTORY_LIMITS.noteLength).optional(),
  })
  .superRefine((value, context) => {
    // StockAdjustment constructor / ck_stock_adjustment_writes_down (SCRUM-424).
    if (
      [STOCK_ADJUSTMENT_REASON.SCRAP, STOCK_ADJUSTMENT_REASON.SAMPLE].some(
        (reason) => reason === value.reason,
      ) &&
      value.quantityDelta > 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["quantityDelta"],
        message: INVENTORY_MESSAGES.writeDown,
      });
    }
    // StockAdjustment constructor (SCRUM-424): OTHER must carry an explanation.
    if (value.reason === STOCK_ADJUSTMENT_REASON.OTHER && !value.note) {
      context.addIssue({ code: "custom", path: ["note"], message: INVENTORY_MESSAGES.otherNote });
    }
  });

export const adjustmentRejectionInput = z.object({
  reason: requiredString(INVENTORY_MESSAGES.required).max(INVENTORY_LIMITS.rejectionLength),
});

export const movementListInput = z.object({
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  sku: z.string().optional(),
  location: z.string().optional(),
  type: z.enum(STOCK_MOVEMENT_TYPES).optional(),
});

export const adjustmentListInput = movementListInput.omit({ type: true }).extend({
  status: z.enum(STOCK_ADJUSTMENT_STATUSES).optional(),
  sort: z.string().optional(),
});

export function inventoryPageDto<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().nonnegative(),
    size: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  });
}

export const adjustmentPageDto = inventoryPageDto(stockAdjustmentDto);
export const movementPageDto = inventoryPageDto(stockMovementDto);

// Inventory overview (SCRUM-438): UI view-models only. These are NOT backend DTOs or wire-format
// validators.
const reference = z.object({ code: z.string(), name: z.string().nullable() });
const stockContext = z.object({
  id: z.string(),
  sku: z.string(),
  productName: z.string().nullable(),
  warehouse: reference,
});
// Presentation hints supplied by the adapter; no client-side threshold or status inference.
export const inventoryHighlightSchema = z.object({
  severity: z.enum(["warning", "critical"]),
  label: z.string(),
});
export const stockLevelRowSchema = stockContext.extend({
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  atp: z.number(),
  lowStockHighlight: inventoryHighlightSchema.nullable(),
  availabilityHighlight: inventoryHighlightSchema.nullable(),
});
export const stockItemRowSchema = stockContext.extend({
  location: z.string(),
  lot: z.string().nullable(),
  expiry: z.string().nullable(),
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  // Separate presentation values: no assumption that status implies condition.
  status: z.string().nullable(),
  condition: z.string().nullable(),
  nearExpiryHighlight: inventoryHighlightSchema.nullable(),
  availabilityHighlight: inventoryHighlightSchema.nullable(),
});
export const reservationRowSchema = stockContext.extend({
  orderReference: z.string(),
  quantity: z.number(),
  location: z.string().nullable(),
  reservedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  status: z.string().nullable(),
});
export const atpLookupInputSchema = z.object({
  sku: z.string().trim().min(1, "Nhập SKU"),
  warehouseCode: z.string().trim().min(1, "Chọn kho"),
});
export const atpLookupResultSchema = atpLookupInputSchema.extend({ quantity: z.number() });
export const inventoryOverviewSchema = z.object({
  stockLevels: z.array(stockLevelRowSchema),
});
