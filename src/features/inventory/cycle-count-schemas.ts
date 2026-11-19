import { z } from "zod";

import {
  CYCLE_COUNT_CREATE_LABELS,
  CYCLE_COUNT_LIMITS,
  CYCLE_COUNT_STATUSES,
} from "@/constants/cycle-count";
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

// PlanCycleCountRequest (docs 20 §4.2 a1, BR-12): the warehouse, one scope - zones, shelves by their own code, full
// bin codes and SKUs (sent as the request's `scope` object), at least one of them - blind or not, who counts if already known, the day (today when absent) and a
// note: every field docs 20 §3 lists for a sheet planned by hand.
export const planCycleCountInput = z
  .object({
    warehouseId: beUuid,
    blind: z.boolean(),
    assignedUserId: beUuid.optional(),
    // Docs 20 §3: "Ngày kiểm, ghi chú - mặc định hôm nay; ghi chú ≤ 500 ký tự" (the BE defaults an absent day to today)
    plannedDate: z.iso.date().optional(),
    note: z.string().trim().max(CYCLE_COUNT_LIMITS.noteLength).optional(),
    zoneIds: z.array(beUuid).max(CYCLE_COUNT_LIMITS.maxZones),
    shelfCodes: z
      .array(z.string().min(1).max(CYCLE_COUNT_LIMITS.shelfLength))
      .max(CYCLE_COUNT_LIMITS.maxShelves),
    locationCodes: z
      .array(z.string().min(1).max(CYCLE_COUNT_LIMITS.locationLength))
      .max(CYCLE_COUNT_LIMITS.maxLocations),
    skus: z
      .array(z.string().min(1).max(CYCLE_COUNT_LIMITS.skuLength))
      .max(CYCLE_COUNT_LIMITS.maxSkus),
  })
  .refine(
    (input) =>
      input.zoneIds.length +
        input.shelfCodes.length +
        input.locationCodes.length +
        input.skus.length >
      0,
    { path: ["zoneIds"], message: CYCLE_COUNT_CREATE_LABELS.anyScope },
  )
  // The BE's PlanCycleCountRequest (SCRUM-162) takes the four lists inside one `scope` object, `scope` being required.
  .transform(({ zoneIds, shelfCodes, locationCodes, skus, ...request }) => ({
    ...request,
    scope: { zoneIds, shelfCodes, locationCodes, skus },
  }));

export const plannedCycleCountDto = z.object({
  count: cycleCountDto,
  skipped: z.array(z.object({ locationCode: z.string(), sku: z.string() }).loose()).default([]),
});

export const cycleCountAssigneesDto = z.array(
  z.object({ userId: beUuid, displayName: z.string() }).loose(),
);

/** "A01, A02\nA03" → ["A01", "A02", "A03"]: split on commas, semicolons and whitespace, without repeats. */
export function splitCodes(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).filter(Boolean))];
}
