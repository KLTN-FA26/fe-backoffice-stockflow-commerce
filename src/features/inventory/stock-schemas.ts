import { z } from "zod";

import {
  INVENTORY_LIMITS,
  INVENTORY_MESSAGES,
  INVENTORY_SORT_DIRECTIONS,
  RESERVATION_STATUSES,
  STOCK_ALERT_KINDS,
  STOCK_ALERT_SORT_FIELDS,
  STOCK_ALERT_STATUSES,
  STOCK_ITEM_SORT_FIELDS,
  STOCK_STATUSES,
} from "@/constants/inventory";

import { inventoryPageDto } from "./schemas";

// Read side of Inventory Overview (SCRUM-438). Source: backend develop 0f18f24 InventoryController,
// StockAlertController and their response records. Jackson NON_NULL omits null fields, so every
// nullable field is `.nullish()`. Enum-valued fields are Strings on the wire and are read open, as
// in schemas.ts: one newer code must not invalidate a whole page. Request filters stay strict.

const quantity = z.number().int();
// Warehouse ids come from the shared warehouse directory (lib/references), which reads them as
// open strings; the mock directory's ids are not UUIDs. The backend validates the UUID itself.
const warehouseId = z.string().min(1);

/** StockLevelResponse: one SKU in one warehouse. Every quantity is computed by the backend. */
export const stockLevelDto = z.object({
  sku: z.string(),
  warehouseCode: z.string(),
  onHand: quantity,
  available: quantity,
  reserved: quantity,
  allocated: quantity,
  atp: quantity,
});
export const stockLevelsDto = z.array(stockLevelDto);

/** WarehouseStockItemResponse (SCRUM-462): one stock row of a warehouse, in any status. */
export const warehouseStockItemDto = z.object({
  stockItemId: z.uuid(),
  sku: z.string(),
  locationCode: z.string(),
  lotNumber: z.string().nullish(),
  expiryDate: z.iso.date().nullish(),
  onHand: quantity,
  reserved: quantity,
  available: quantity,
  status: z.string(),
  receivedAt: z.iso.datetime().nullish(),
});
export const warehouseStockItemPageDto = inventoryPageDto(warehouseStockItemDto);

/** GET /stock-items/atp answers a bare integer: zero is an answer, not "not found". */
export const atpDto = quantity;

/** ReservationRowResponse (SCRUM-462). The backend exposes the order's id, not its number. */
export const reservationRowDto = z.object({
  reservationId: z.uuid(),
  orderId: z.uuid(),
  stockItemId: z.uuid(),
  sku: z.string(),
  locationCode: z.string(),
  lotNumber: z.string().nullish(),
  quantity,
  status: z.string(),
  reservedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullish(),
  releaseReason: z.string().nullish(),
  closedAt: z.iso.datetime().nullish(),
});
export const reservationPageDto = inventoryPageDto(reservationRowDto);

/** StockAlertResponse. REORDER/SAFETY are SKU-wide: no warehouse, no lot, no expiry. */
export const stockAlertDto = z.object({
  id: z.uuid(),
  kind: z.string(),
  sku: z.string(),
  warehouseId: warehouseId.nullish(),
  warehouseCode: z.string().nullish(),
  lotNumber: z.string().nullish(),
  expiryDate: z.iso.date().nullish(),
  daysToExpiry: quantity.nullish(),
  observedQty: quantity,
  thresholdQty: quantity.nullish(),
  reservationImpaired: z.boolean(),
  status: z.string(),
  openedAt: z.iso.datetime(),
  lastObservedAt: z.iso.datetime(),
  acknowledgedBy: z.uuid().nullish(),
  acknowledgedByName: z.string().nullish(),
  acknowledgedAt: z.iso.datetime().nullish(),
  ackNote: z.string().nullish(),
  resolvedAt: z.iso.datetime().nullish(),
  resolution: z.string().nullish(),
  version: z.number().int().nonnegative(),
});
export const stockAlertPageDto = inventoryPageDto(stockAlertDto);

// ── Request inputs ─────────────────────────────────────────────────────────────────────────────

// Exact SKU only (no partial or product-name search on the backend): trimmed, upper-cased like
// the backend `Sku` record. The warehouse-stock and reservation filters compare it verbatim.
const sku = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toUpperCase());
// Absent or blank → omitted from the request, never sent as an empty string.
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);
const optionalSku = optionalText.transform((value) => value?.toUpperCase());
// Comma-joined on the wire (`status=A,B`): Spring binds that to a List/Set, not `status[]=`.
// An empty list would match nothing on the backend, so callers omit the filter instead.
function commaList<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .array(z.enum(values))
    .min(1)
    .optional()
    .transform((list) => list?.join(","));
}
function sortClause<T extends readonly [string, ...string[]]>(fields: T) {
  return z
    .object({ field: z.enum(fields), direction: z.enum(INVENTORY_SORT_DIRECTIONS) })
    .optional()
    .transform((sort) => sort && `${sort.field},${sort.direction}`);
}
const paging = {
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
};

export const stockLevelsInput = z.object({ sku });

/** Overview SKU form: the same exact code the backend `Sku` record accepts, normalised on submit. */
export const skuLookupInput = z.object({
  sku: z
    .string()
    .trim()
    .min(1, INVENTORY_MESSAGES.required)
    .min(INVENTORY_LIMITS.skuMinLength, INVENTORY_MESSAGES.invalidSku)
    .max(INVENTORY_LIMITS.skuMaxLength, INVENTORY_MESSAGES.invalidSku)
    .regex(/^[A-Za-z0-9-]+$/, INVENTORY_MESSAGES.invalidSku)
    .transform((value) => value.toUpperCase()),
});

export const warehouseStockItemsInput = z.object({
  warehouseId,
  sku: optionalSku,
  location: optionalText,
  lot: optionalText,
  status: commaList(STOCK_STATUSES),
  includeEmpty: z.boolean().optional(),
  ...paging,
  sort: sortClause(STOCK_ITEM_SORT_FIELDS),
});

// `warehouse` is the backend's optional prefix code. Without it the backend answers system-wide
// ATP without applying the caller's warehouse scope (InventoryServiceImpl.availableToPromise).
export const atpInput = z.object({ sku, warehouse: optionalText });

export const reservationListInput = z.object({
  orderId: z.uuid().optional(),
  sku: optionalSku,
  status: commaList(RESERVATION_STATUSES),
  warehouse: optionalText,
  ...paging,
});

export const stockAlertListInput = z.object({
  kind: commaList(STOCK_ALERT_KINDS),
  status: commaList(STOCK_ALERT_STATUSES),
  sku: optionalSku,
  warehouseId: warehouseId.optional(),
  ...paging,
  sort: sortClause(STOCK_ALERT_SORT_FIELDS),
});
