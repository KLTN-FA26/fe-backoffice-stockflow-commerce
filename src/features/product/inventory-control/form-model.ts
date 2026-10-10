import { z } from "zod";

import { INVENTORY_CONTROL_TEXT as text, JAVA_INTEGER_MAX, MAX_SHELF_LIFE_DAYS } from "./constants";
import { inventoryControlResponseSchema } from "./schemas";

import type { InventoryControlViewModel } from "./view-model";

const threshold = z.number().int().min(0).max(JAVA_INTEGER_MAX).nullable();
// BE 8ea4ca1: StockPolicy.validate + UpdateInventoryControlRequest. No invented BR identifiers.
export const inventoryPolicyInputSchema = z
  .object({
    reorderPoint: threshold,
    safetyStock: threshold,
    removalStrategy: inventoryControlResponseSchema.shape.removalStrategy,
    trackingMode: inventoryControlResponseSchema.shape.trackingMode,
    expiryTracked: z.boolean(),
    maxShelfLifeDays: z
      .number()
      .int()
      .min(1, text.shelfRange)
      .max(MAX_SHELF_LIFE_DAYS, text.shelfRange)
      .nullable(),
  })
  .superRefine((policy, ctx) => {
    if (
      policy.reorderPoint !== null &&
      policy.safetyStock !== null &&
      policy.safetyStock > policy.reorderPoint
    )
      ctx.addIssue({ code: "custom", path: ["safetyStock"], message: text.thresholdRelation });
    if (
      policy.expiryTracked &&
      policy.trackingMode !== "LOT" &&
      policy.trackingMode !== "LOT_SERIAL"
    )
      ctx.addIssue({ code: "custom", path: ["trackingMode"], message: text.expiryTracking });
    if (policy.expiryTracked && policy.removalStrategy !== "FEFO")
      ctx.addIssue({ code: "custom", path: ["removalStrategy"], message: text.expiryRemoval });
    if (!policy.expiryTracked && policy.maxShelfLifeDays !== null)
      ctx.addIssue({ code: "custom", path: ["maxShelfLifeDays"], message: text.shelfExpiry });
  });
export const inventoryPolicyReplacementSchema = inventoryPolicyInputSchema.safeExtend({
  version: z.number().int().min(0),
});

const optionalIntegerText = z.string().refine((raw) => {
  if (raw.trim() === "") return true;
  const value = Number(raw);
  return (
    // Integer text only: converting fractional/scientific text first could round it into an integer.
    /^\+?\d+$/.test(raw.trim()) &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= JAVA_INTEGER_MAX
  );
}, text.numeric);
export const inventoryPolicyDraftSchema = z
  .object({
    reorderPoint: optionalIntegerText,
    safetyStock: optionalIntegerText,
    removalStrategy: inventoryControlResponseSchema.shape.removalStrategy,
    trackingMode: inventoryControlResponseSchema.shape.trackingMode,
    expiryTracked: z.boolean(),
    maxShelfLifeDays: optionalIntegerText,
  })
  .superRefine((draft, ctx) => {
    const result = inventoryPolicyInputSchema.safeParse(draftToPolicy(draft));
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  });
export type InventoryPolicyDraft = z.infer<typeof inventoryPolicyDraftSchema>;
export type InventoryPolicyReplacement = z.infer<typeof inventoryPolicyReplacementSchema>;
const nullableInteger = (raw: string) => (raw.trim() === "" ? null : Number(raw));
export function draftToPolicy(draft: InventoryPolicyDraft) {
  return {
    ...draft,
    reorderPoint: nullableInteger(draft.reorderPoint),
    safetyStock: nullableInteger(draft.safetyStock),
    maxShelfLifeDays: nullableInteger(draft.maxShelfLifeDays),
  };
}
export function toInventoryPolicyDraft(value: InventoryControlViewModel): InventoryPolicyDraft {
  const p = value.policy;
  return {
    ...p,
    reorderPoint: p.reorderPoint?.toString() ?? "",
    safetyStock: p.safetyStock?.toString() ?? "",
    maxShelfLifeDays: p.maxShelfLifeDays?.toString() ?? "",
  };
}
