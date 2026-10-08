import { z } from "zod";

// UI view-models only. These are NOT backend DTOs or wire-format validators.
const reference = z.object({ code: z.string(), name: z.string().nullable() });
const stockContext = z.object({
  id: z.string(),
  sku: z.string(),
  productName: z.string().nullable(),
  warehouse: reference,
});
export const stockLevelRowSchema = stockContext.extend({
  onHand: z.number(),
  reserved: z.number(),
  available: z.number(),
  atp: z.number(),
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
export const inventoryPreviewSchema = z.object({
  stockLevels: z.array(stockLevelRowSchema),
  stockItems: z.array(stockItemRowSchema),
  reservations: z.array(reservationRowSchema),
  atp: atpLookupResultSchema.nullable(),
});
