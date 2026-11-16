import { z } from "zod";

import { CYCLE_COUNT_LIMITS, CYCLE_COUNT_STATUSES } from "@/constants/cycle-count";
import { INVENTORY_MESSAGES } from "@/constants/inventory";

import { beUuid, requiredString } from "@/lib/validation/primitives";

import { inventoryPageDto } from "./schemas";

// Source: backend develop df34c338 `CycleCountResponse` / `CycleCountSummaryResponse`. Jackson NON_NULL drops
// absent fields, so every optional one is `nullish`. `status` and `triggerType` are Strings on the wire: read
// them open so a newer code does not invalidate a whole page; write-side enums below stay strict.
//
// Docs 20 BR-07 (kiểm mù): for a counter on a blind count the BE leaves out `note`, each line's `booked` and
// `adjustments` (and the summary's `varianceCount`) — the schema must accept their absence, and the UI must
// never fill them in.
const cycleCountHeader = {
  id: beUuid,
  countNumber: z.string(),
  warehouseId: beUuid,
  triggerType: z.string(),
  status: z.string(),
  blind: z.boolean(),
  assignedUserId: beUuid.nullish(),
  plannedDate: z.string().nullish(),
  startedAt: z.iso.datetime().nullish(),
  completedAt: z.iso.datetime().nullish(),
  note: z.string().nullish(),
  createdAt: z.iso.datetime(),
};

export const cycleCountSummaryDto = z.object({
  ...cycleCountHeader,
  lineCount: z.number().int().nonnegative(),
  countedCount: z.number().int().nonnegative(),
  varianceCount: z.number().int().nonnegative().nullish(),
});

export const cycleCountLineAdjustmentDto = z.object({
  id: beUuid,
  number: z.string(),
  quantityDelta: z.number().int(),
  status: z.string(),
});

// One line = one LPN carton (docs 20 §4.2 a2). `found` stays absent until the line is counted.
export const cycleCountLineDto = z.object({
  id: beUuid,
  locationCode: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  stockPackageId: beUuid.nullish(),
  lpn: z.string().nullish(),
  booked: z.boolean().nullish(),
  found: z.boolean().nullish(),
  countedBy: beUuid.nullish(),
  countedAt: z.iso.datetime().nullish(),
  recountRequired: z.boolean(),
  adjustments: z.array(cycleCountLineAdjustmentDto).nullish(),
});

export const cycleCountDto = z.object({
  ...cycleCountHeader,
  lines: z.array(cycleCountLineDto),
});

export const cycleCountPageDto = inventoryPageDto(cycleCountSummaryDto);

export const cycleCountListInput = z.object({
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
  status: z.enum(CYCLE_COUNT_STATUSES).optional(),
});

// CountLineRequest: the carton scanned at its bin (true) or not found there (false) — never a number of units
// (docs 20 §4.2 b4, BR-14).
export const countLineInput = z.object({ found: z.boolean() });

// AddCountLineRequest (docs 20 §4.2 b5): a carton found that the plan did not list, scanned in the bin it was found.
export const addCountLineInput = z.object({
  locationCode: requiredString(INVENTORY_MESSAGES.required)
    .max(CYCLE_COUNT_LIMITS.locationLength)
    .transform((value) => value.toUpperCase()),
  lpn: requiredString(INVENTORY_MESSAGES.required)
    .max(CYCLE_COUNT_LIMITS.lpnLength)
    .transform((value) => value.toUpperCase()),
});

// CancelCycleCountRequest: the reason is required (docs 20 §4.2 e).
export const cancelCycleCountInput = z.object({
  reason: requiredString(INVENTORY_MESSAGES.required).max(CYCLE_COUNT_LIMITS.reasonLength),
});

// RecountRequest (docs 20 §4.2 d11): the lines whose variance adjustment was rejected, and an optional note.
export const recountCycleCountInput = z.object({
  lineIds: z.array(beUuid).min(1, INVENTORY_MESSAGES.required).max(CYCLE_COUNT_LIMITS.maxLines),
  note: z.string().trim().max(CYCLE_COUNT_LIMITS.noteLength).optional(),
});
