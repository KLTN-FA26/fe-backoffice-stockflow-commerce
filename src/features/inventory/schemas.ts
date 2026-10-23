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
import { skuSchema } from "@/lib/validation/sku";

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
    // BE `@ValidSku` (common.domain.Sku): 1–64, chữ/số/'.'/'_'/'-' — xem lib/validation/sku.ts.
    sku: skuSchema({
      required: INVENTORY_MESSAGES.required,
      format: INVENTORY_MESSAGES.invalidSku,
    }),
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
