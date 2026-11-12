import { z } from "zod";

import {
  INVENTORY_LIMITS,
  INVENTORY_MESSAGES,
  STOCK_ADJUSTMENT_DIRECTIONS,
  STOCK_ADJUSTMENT_REASON,
  STOCK_ADJUSTMENT_REQUEST_REASONS,
  STOCK_MOVEMENT_TYPES,
} from "@/constants/inventory";
import { STOCK_ADJUSTMENT_STATUSES } from "@/constants/statuses";

import { beUuid, requiredString } from "@/lib/validation/primitives";

// Source: backend develop df34c338 StockAdjustmentResponse (+ stockPackageId, cycleCountLineId); nullable fields
// may be omitted by the backend Jackson NON_NULL policy. `reason` and `status`
// are Strings on the wire: read them open so a newer code does not invalidate
// the response. Write-side enums stay strict in adjustmentCreateInput/list input.
export const stockAdjustmentDto = z.object({
  adjustmentId: beUuid,
  number: z.string(),
  locationCode: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantityDelta: z.number().int(),
  reason: z.string(),
  note: z.string().nullish(),
  status: z.string(),
  requestedBy: beUuid,
  requestedAt: z.iso.datetime(),
  decidedBy: beUuid.nullish(),
  decidedAt: z.iso.datetime().nullish(),
  rejectionReason: z.string().nullish(),
  postedAt: z.iso.datetime().nullish(),
  withdrawnAt: z.iso.datetime().nullish(),
  version: z.number().int().nonnegative(),
  // Docs 20 BR-14: một phiếu điều chỉnh đúng một thùng. Có `cycleCountLineId` khi phiếu do kiểm kê sinh ra.
  stockPackageId: beUuid.nullish(),
  cycleCountLineId: beUuid.nullish(),
});

// Source: backend develop 0f18f24 StockMovementResponse. `type`, `status`,
// `toStatus` and `referenceType` are Strings; keep them open so one newer code
// does not invalidate the whole ledger page. status/toStatus may be null/omitted.
export const stockMovementDto = z.object({
  movementId: beUuid,
  type: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  fromLocation: z.string().nullish(),
  toLocation: z.string().nullish(),
  quantity: z.number().int().positive(),
  status: z.string().nullish(),
  toStatus: z.string().nullish(),
  referenceType: z.string(),
  referenceId: beUuid.nullish(),
  reason: z.string().nullish(),
  actorId: beUuid.nullish(),
  occurredAt: z.iso.datetime(),
});

// RequestAdjustmentRequest (docs 20 §4.3, BR-04, BR-14): một thùng theo LPN, chiều, lý do — không có số lượng.
// COUNT_VARIANCE không có trong danh sách: chỉ phiếu kiểm kê được tạo (BE từ chối 400 VALIDATION_FAILED).
export const adjustmentCreateInput = z
  .object({
    lpn: requiredString(INVENTORY_MESSAGES.required)
      .max(INVENTORY_LIMITS.lpnLength)
      .transform((value) => value.toUpperCase()),
    direction: z.enum(STOCK_ADJUSTMENT_DIRECTIONS, { error: INVENTORY_MESSAGES.required }),
    reason: z.enum(STOCK_ADJUSTMENT_REQUEST_REASONS, { error: INVENTORY_MESSAGES.required }),
    note: z.string().trim().max(INVENTORY_LIMITS.noteLength).optional(),
  })
  .superRefine((value, context) => {
    // BR-04 (docs 20): lý do OTHER bắt buộc ghi chú.
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
