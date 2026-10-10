import { z } from "zod";

import { canonicalUuidSchema } from "../variant-schemas";

/** InventoryControlResponse at BE 8ea4ca1; NON_NULL omits boxed nullable values. */
export const inventoryControlResponseSchema = z.object({
  skuId: canonicalUuidSchema,
  sku: z.string(),
  unitOfMeasure: z.string(),
  version: z.number().int(),
  reorderPoint: z.number().int().optional(),
  safetyStock: z.number().int().optional(),
  removalStrategy: z.enum(["FIFO", "FEFO"]),
  trackingMode: z.enum(["NONE", "LOT", "SERIAL", "LOT_SERIAL"]),
  expiryTracked: z.boolean(),
  maxShelfLifeDays: z.number().int().optional(),
  usableOnHand: z.number().int(),
  reorderRequired: z.boolean().optional(),
  belowSafetyStock: z.boolean().optional(),
});

export type InventoryControlResponse = z.infer<typeof inventoryControlResponseSchema>;
